/** @fileOverview Routing functionality */

var Peer = require('./peer.js');
var BigInteger = require('./third_party/BigInteger.js');
var Sha1 = require('./third_party/sha1.js');
var Range = require('./chord/range.js');

/**
 * @constructor
 * @class The main routing class. Used by {@link ConnectionManager} instances to route
 * messages through the user network.
 *
 * @param id ID of the local peer
 * @param fallbackSignaling
 */
var Router = function(id, fallbackSignaling, connectionManager) {
    if (!(this instanceof Router)) {
        return new Router();
    }

    this._peerTable = {};
    this._fallbackSignaling = fallbackSignaling;
    this._fallbackSignaling.onmessage = this.onmessage.bind(this);
    this._connectionManager = connectionManager;
    this.id = id;
    this._messageCallbacks = {};
    this._monitorCallback = null;
    this._pendingPutRequests = {};
    this._pendingGetRequests = {};
    this.registerDeliveryCallback('discovery-protocol', this._onDiscoveryMessage.bind(this));

    return this;
};

Router.randomId = function() {
    var randomId = Sha1.bigIntHash(Math.random().toString());
    return randomId;
};

Router.prototype = {

    /**
     * Add a peer to the peer table.
     *
     * @param peer {Peer} The peer to add.
     * @todo add test for onclosedconnection behaviour
     */
    addPeer: function(peer, cb) {
        this._peerTable[peer.id] = peer;
        peer.dataChannel.onmessage = this.onmessage.bind(this);
        peer.peerConnection.onclosedconnection = this.removePeer.bind(this, peer);
        if (Object.keys(this._peerTable).length === 1) {
            // ask first peer for its neighbours
            this._discoverNeighbours(peer);
        }
        if (typeof(cb) === 'function') {
            cb();
        }
    },

    /**
     * Remove a peer from the peer table.
     *
     * @param peer {Peer} The peer to remove.
     * @todo disconnect peerConnection before removal
     */
    removePeer: function(peer) {
        delete this._peerTable[peer.id];
    },

    /**
     * Return a list of all peer ids currently in the routing table.
     *
     * @returns {Array}
     */
    getPeerIds: function() {
        var peers = [];
        var peer;
        for (peer in this._peerTable) {
            if (this._peerTable.hasOwnProperty(peer)) {
                peers.push(peer);
            }
        }
        return peers;
    },

    onmessage: function(msg) {
        try {
            this.forward(JSON.parse(msg.data));
        } catch (e) {
            console.log('Unable to parse incoming message ' + JSON.stringify(msg.data) + ': ' + e);
        }
    },

    /**
     * Encapsulates message in router format and forwards them.
     *
     * @param to recipient
     * @param type the message type
     * @param payload the message payload
     */
    route: function(to, payload) {
        if (typeof(to) !== 'string') {
            to = to.toString();
        }
        this.forward({
            to: to,
            from: this.id.toString(),
            type: 'route',
            payload: payload
        });
    },

    /**
     * Forward message or deliver if recipient is me. This implementation
     * implies that we are using a fully meshed network where every peer
     * is connected to all other peers.
     *
     * @param msg {String} The message to route.
     */
    forward: function(msg) {
        if (typeof(this._monitorCallback) === 'function') {
            this._monitorCallback(msg);
        }
        if (!msg.to) {
            throw Error('Unable to route message because no recipient can be determined');
        }
        if (this.id.toString() === msg.to) {
            this.deliver(msg);
            return;
        }
        var receiver = this._peerTable[msg.to];
        if (!(receiver instanceof Peer)) {
            this._fallbackSignaling.send(JSON.stringify(msg));
            return;
        }
        try {
            receiver.dataChannel.send(JSON.stringify(msg));
        } catch (e) {
            console.log('Unable to route message to ' + msg.to + ' because the DataChannel connection failed.');
        }
    },

    get: function(hash, cb) {
        this._pendingGetRequests[hash.toString()] = cb;
        var peer = this.responsible(hash);
        this.forward({
            to: peer.toString(),
            from: this.id.toString(),
            type: 'get-request',
            payload: {
                hash: hash.toString()
            }
        });
    },

    _handleGetRequest: function(msg) {
        try {
            var val = JSON.parse(localStorage.getItem(msg.payload.hash));
            this.forward({
                to: msg.from,
                from: this.id.toString(),
                type: 'get-response',
                payload: {
                    hash: msg.payload.hash,
                    val: val
                }
            });
        } catch (e) {
            console.log(e);
        }
    },

    _handleGetResponse: function(msg) {
        if (typeof(this._pendingGetRequests[msg.payload.hash]) === 'function') {
            this._pendingGetRequests[msg.payload.hash.toString()](msg.payload.val);
            delete this._pendingGetRequests[msg.payload.hash.toString()];
        }
    },

    put: function(hash, val, cb) {
        this._pendingPutRequests[hash.toString()] = cb;
        var peer = this.responsible(hash);
        this.forward({
            to: peer.toString(),
            from: this.id.toString(),
            type: 'put-request',
            payload: {
                hash: hash.toString(),
                val: val
            }
        });
    },

    _handlePutRequest: function(msg) {
        try {
            localStorage.setItem(msg.payload.hash, JSON.stringify(msg.payload.val));
            this.forward({
                to: msg.from,
                from: this.id.toString(),
                type: 'put-response',
                payload: {
                    hash: msg.payload.hash
                }
            });
        } catch (e) {
            console.log(e);
        }
    },

    _handlePutResponse: function(msg) {
        if (typeof(this._pendingPutRequests[msg.payload.hash]) === 'function') {
            this._pendingPutRequests[msg.payload.hash](null);
        }
    },

    responsible: function(hash) {
        var candidate = this.id;
        for (var k in this._peerTable) {
            if (Range.inLeftClosedInterval(new BigInteger(k), hash, candidate)) {
                candidate = new BigInteger(k);
            }
        }
        return candidate;
    },

    /**
     * Deliver a message to this peer. Is called when the `to` field of
     * the message contains the id of this peer. Decides where to deliver
     * the message to by calling the registered callback using the `type`
     * field (e.g. webrtc connection/ neighbour discovery/ application) of
     * the message.
     *
     * @param msg {String}
     */
    deliver: function(msg) {
        switch (msg.type) {
            case 'route':
                try {
                    this._messageCallbacks[msg.payload.type](msg.payload);
                } catch (e) {
                    console.log(msg);
                    console.log('Unable to handle message of type ' + msg.payload.type + ' from ' + msg.payload.from + ' because no callback is registered: ' + e);
                }
                break;
            case 'get-request':
                this._handleGetRequest(msg);
                break;
            case 'get-response':
                this._handleGetResponse(msg);
                break;
            case 'put-request':
                this._handlePutRequest(msg);
                break;
            case 'put-response':
                this._handlePutResponse(msg);
                break;
            default:
                console.log('Discarding message', msg, 'because the type is unknown');
        }
    },

    /**
     * Register a delivery callback. The registered callback gets
     * called when a specific type of message arrives with the `from`
     * field set to this peers' id.
     *
     * @param msgType {String} refers to the `type`-field of the message
     * this callback should respond to
     * @param callback {Function} The callback to call when a message of
     * the given type arrives
     */
    registerDeliveryCallback: function(msgType, callback) {
        this._messageCallbacks[msgType] = callback;
    },

    /**
     * Register a monitor callback. The registered callback gets
     * called when a message arrives with the `from` field set to
     * this peers' id.
     *
     * @param callback {Function} The callback to call when a message is delivered
     */
    registerMonitorCallback: function(callback) {
        this._monitorCallback = callback;
    },

    /**
     * Kick off neighbour discovery mechanism by sending a `discovery-request' message to
     * a connected peer.
     *
     * @param peer {Peer}
     * @todo implement
     */
    _discoverNeighbours: function(peer) {
        this.route(peer.id, {
            type: 'discovery-protocol',
            payload: {
                type: 'request',
                from: this.id.toString()
            }
        });
    },

    _onDiscoveryMessage: function(msg) {
        switch (msg.payload.type) {
            case 'response':
                this._processDiscoveryResponse(msg);
                break;
            case 'request':
                this._processDiscoveryRequest(msg);
                break;
            default:
                console.log('Router: received invalid discovery message with type %s from %s', msg.payload.type, msg.payload.from);
                break;
        }
    },

    /**
     * Gets called when a neighbour discovery response message is received.
     *
     * @param msg {String} Message containing ids of another peers peer table.
     * @todo should this call the connection manager?
     */
    _processDiscoveryResponse: function(msg) {
        //console.log('connecting to', msg.payload.ids)
        var i, ids = msg.payload.ids;
        for (i = 0; i < ids.length; i++) {
            if (ids[i] !== this.id.toString()) {
                this._connectionManager.connect(ids[i], this._processDiscoveryCallback.bind(this, ids[i]));
            }
        }
    },

    _processDiscoveryCallback: function(err, id) {
        if (err) {
            console.log('Error connecting to', id, ':', err);
        }
    },

    /**
     * Answer a received neighbour discovery message. Respond with
     * known ids of all peers in the peerTable.
     *
     * @param msg {String} Message containing the discovery request from another peer.
     * @todo discovery message format
     */
    _processDiscoveryRequest: function(msg) {
        var peerIds = [],
            peer;
        for (peer in this._peerTable) {
            if (this._peerTable.hasOwnProperty(peer) && this._peerTable[peer] instanceof Peer) {
                peerIds.push(peer);
            }
        }
        this.route(msg.payload.from, {
            type: 'discovery-protocol',
            payload: {
                type: 'response',
                from: this.id.toString(),
                ids: peerIds
            }
        });
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = Router;
}
