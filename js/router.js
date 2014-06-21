/** @fileOverview Routing functionality */

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
    this._id = id;
    this._messageCallbacks = {};
    this._monitorCallback = null;
    this.registerDeliveryCallback('discovery', this._onDiscoveryMessage.bind(this));

    return this;
};

Router.prototype = {

    /**
     * Add a peer to the peer table.
     *
     * @param peer {Peer} The peer to add.
     * @todo add test for onclosedconnection behaviour
     */
    addPeer: function(peer) {
        this._peerTable[peer.id] = peer;
        peer.dataChannel.onmessage = this.onmessage.bind(this);
        peer.peerConnection.onclosedconnection = this.removePeer.bind(this, peer);
        if (Object.keys(this._peerTable).length === 1) {
            // ask first peer for its neighbours
            this._discoverNeighbours(peer);
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
    route: function(to, type, payload) {
        this.forward({
            to: to,
            from: this._id,
            type: type,
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
        if (this._id === msg.to) {
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
        try {
            this._messageCallbacks[msg.type](msg.payload, msg.from);
        } catch (e) {
            console.log('Unable to handle message of type ' + msg.type + ' from ' + msg.from + ' because no callback is registered: ' + e);
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
        this.route(peer.id, 'discovery', {
            type: 'request'
        });
    },

    _onDiscoveryMessage: function(msg, from) {
        switch (msg.type) {
            case 'answer':
                this._processDiscoveryAnswer(msg, from);
                break;
            case 'request':
                this._processDiscoveryRequest(msg, from);
                break;
            default:
                console.log('Router: received invalid discovery message with type %s from %s', msg.type, from);
                break;
        }
    },

    /**
     * Gets called when a neighbour discovery answer message is received.
     *
     * @param msg {String} Message containing ids of another peers peer table.
     * @todo should this call the connection manager?
     */
    _processDiscoveryAnswer: function(msg, from) {
        var i, ids = msg.ids;
        for (i = 0; i < ids.length; i++) {
            if (ids[i] !== this._id) {
                this._connectionManager.connect(ids[i]);
            }
        }
    },

    /**
     * Answer a received neighbour discovery message. Respond with
     * known ids of all peers in the peerTable.
     *
     * @param msg {String} Message containing the discovery request from another peer.
     * @todo discovery message format
     */
    _processDiscoveryRequest: function(msg, from) {
        var peerIds = [],
            peer;
        for (peer in this._peerTable) {
            if (this._peerTable.hasOwnProperty(peer) && this._peerTable[peer] instanceof Peer) {
                peerIds.push(peer);
            }
        }
        this.route(from, 'discovery', {
            type: 'answer',
            ids: peerIds
        });
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = Router;
}
