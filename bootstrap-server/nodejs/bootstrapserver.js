/** @fileOverview Boostrap functionality */

var WebSocketServer = require('websocket').server;
var http = require('http');
var fs = require('fs');

/**
 * @constructor
 * @param port {Number} Port this server shall listen on
 */
BootstrapServer = function(hostname, port) {
    if(!(this instanceof BootstrapServer)) {
        return new BootstrapServer();
    }
    this._port = port;
    this._hostname = hostname;
    this._users = {};
    this._httpServer = null;
    this._websocketServer = null;
    return this;
};

BootstrapServer.prototype = {
    /**
     * Start listening
     * 
     * @param successCallback {Function} Gets called when the http server is listening
     */
    listen: function(successCallback) {
        this._httpServer = http.createServer(this._onHttpRequest.bind(this));
        this._httpServer.listen(this._port, this._hostname, successCallback);
        this._websocketServer = new WebSocketServer({
            httpServer: this._httpServer,
            autoAcceptConnections: false
        });
        this._websocketServer.on('request', this._onWebSocketRequest.bind(this));
        console.log((new Date()) + ' BootstrapServer listening on ' + this._hostname + ':' + this._port);
    },

    /**
     * Gets called on a HTTP Request to this server (serving static files)
     *
     * @param request {http.IncomingMessage}
     * @param response {http.ServerResponse}
     */
    _onHttpRequest: function(request, response) {
        console.log((new Date()) + ' Received HTTP request for ' + request.url);
        
        try {
            response.writeHead(200);
            response.write(fs.readFileSync(__dirname + request.url));
        } catch (e) {
            response.writeHead(404);
            response.write('404 - Not Found');
        }
        response.end();
    },

    /**
     * Gets called when a client initiates a WebSocket connection 
     * to the server. Associates the initiated connection with a peerId
     * given in the initial connection URI (as 12345 in ws://localhost/ws/12345)
     * 
     * @param request {WebSocketRequest}
     */
    _onWebSocketRequest: function(request) {
        var conn;
        var url = request.httpRequest.url;
        var peerId = url.substr(4);
        if (!peerId || url.substr(0,4) !== '/ws/') {
            request.reject('404', 'malformed request');
            console.log((new Date()) + ' Discarding Request because of malformed uri ' + request.httpRequest.url);
            return;
        }
        console.log((new Date()) + ' Received WS request from PeerId ' + peerId);
        conn = request.accept(null, request.origin);
        conn.on('close', this._onWebSocketClose.bind(this, peerId));
        conn.on('message', this._onWebSocketMessage.bind(this));
        this._users[peerId] = conn;
    },

    /**
     * Gets called whenever a peer sends a message over its websocket connection
     * 
     * @param rawMsg {String} incoming UTF8-String containing the message
     */
    _onWebSocketMessage: function(rawMsg) {
        var msg;
        try {
            msg = JSON.parse(rawMsg.utf8Data);
        } catch (e) {
            console.log((new Date()) + ' Could not parse incoming message: ' + rawMsg.utf8Data + ' ' + e);
            return;
        }
        if (typeof(msg.payload) === 'undefined' || msg.payload === null) {
            console.log((new Date()) + ' Discarding message: ' + JSON.stringify(msg) + ' because it does not carry any payload');
            return;
        }
        switch (msg.payload.type) {
            case 'offer':
                this._handleOffer(msg);
                break;
            case 'answer':
                this._handleAnswer(msg);
                break;
            default:
                console.log((new Date()) + ' Discarding message: ' + JSON.stringify(msg) + ' because the type is unknown');
        }
    },

    /**
     * Forwards an offer to a connected peer via its WebSocket 
     * connection. The peer is chosen at random if not explicitly 
     * set in the message's `to` field
     *
     * @param msg {Object} The message containing the offer
     */
    _handleOffer: function(msg) {
        var receiver, user, count = 0;
        if (Object.keys(this._users).length <= 1 || (msg.to && !this._users[msg.to])) {
            // denied
            this._users[msg.from].send(JSON.stringify({
                type: 'signaling-protocol',
                to: msg.from,
                from: 'signaling-server',
                payload: {type: 'denied'}
            }));
            return;
        }
        if (msg.to && this._users[msg.to]) {
            // receiver known
            receiver = this._users[msg.to];
        } else {
            // random receiver (inital offer)
            for (user in this._users) {
                if (Math.random() < 1/++count && user !== msg.from) {
                    console.log((new Date()) + ' Sending offer from: ' + msg.from + ' to: ' + user);
                    msg.to = user;
                    receiver = this._users[user];
                    break;
                }
            }
        }
        try {
            receiver.send(JSON.stringify(msg));
        } catch (e) {
            console.log((new Date()) + ' Could not send offer to ' + msg.to + ' because the WebSocket connection failed: ' + e);
        }
    },

    /**
     * Forwards an answer to the corresponding peer (set in the `msg.to` field 
     * from the client).
     *
     * @param msg {Object} The message containing the answer
     */
    _handleAnswer: function(msg) {
        var receiver = this._users[msg.to];
        try {
            console.log((new Date()) + ' Sending answer from: ' + msg.from + ' to: ' + msg.to);
            this._users[msg.to].send(JSON.stringify(msg));
        } catch(e) {
            console.log((new Date()) + ' Could not send offer to ' + msg.to + ' because the WebSocket connection failed: ' + e);
        }
    },

    /**
     * Removes a peer from the user table when the WebSocket closes
     *
     * @param peerId {String} The ID of the disconnected peer
     * @param reasonCode {Object} (unused) Reason code for disconnect
     * @param description {Object} (unused) Description for disconnect
     */
    _onWebSocketClose: function(peerId, reasonCode, description) {
        console.log((new Date()) + ' Removing user: ' + peerId);
        delete this._users[peerId];
    },

    /**
     *
     *
     */
    close: function() {
        this._websocketServer.shutDown();
        this._httpServer.close();
    }
};

if(typeof(module) !== 'undefined') {
    module.exports = BootstrapServer;
}
