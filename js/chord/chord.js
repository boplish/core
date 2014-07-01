var ChordNode = require('./node.js');

/** @fileOverview Chord DHT implementation */

/**
 * @constructor
 * @class This is a Chord DHT implementation using WebRTC data channels.
 *
 * @param connectionManager {ConnectionManager} The connection manager instance
 * to be used for requesting data channel connections.
 */
var Chord = function(connectionManager, hash, keyLength) {
    if (!(this instanceof Chord)) {
        return new Chord(connectionManager, hash, keyLength);
    }

    // TODO(max): externalize this so Node can reuse it upon (de-)serializing
    hash.update(Math.random().toString());
    var digest = hash.digest();

    this._connectionManager = connectionManager;
    this._id = hash.bigInteger(digest);
    this._fingerTable = {};
    this._m = keyLength;
    this._joined = false; // are we joined to a Chord ring, yet?
    this._localNode = new ChordNode(new Peer(this._id, null, {
        send: this._onmessage
    }), this);

    var memoizer = Helper.memoize(Helper.fingerTableIntervalStart.bind(this));
    for (var i = 1; i <= this._m; i++) {
        this._fingerTable[i] = {
            start: memoizer.bind(null, i),
            node: this._localNode
        };
    }

    return this;
};

/**
 * Internal Helper Functions
 **/

var Helper = {
    memoize: function(func) {
        var memo = {};
        var slice = Array.prototype.slice;
        return function() {
            var args = slice.call(arguments);
            if (!(args in memo)) {
                memo[args] = func.apply(this, args);
            }
            return memo[args];
        };
    },

    fingerTableIntervalStart: function(i) {
        return this._id.add(BigInt(2).pow(i - 1)).mod(BigInt(2).pow(this._m));
    },

    /**
     * [start, end)
     */
    inInterval: function(val, start, end) {
        return val.greaterOrEquals(start) && val.lesser(end);
    },

    /**
     * (start, end)
     */
    inOpenInterval: function(val, start, end) {
        return val.greater(start) && val.lesser(end);
    }
};

/**
 * Internal API
 **/

Chord.prototype._init_finger_table = function(remote, successCallback) {
    remote.find_successor(this._fingerTable[1].start, function(successor) {
        this._fingerTable[1].node = successor;
        this._predecessor = successor.predecessor;
        this._successor.predecessor = this._localNode;
        successCallback();
    });
};

Chord.prototype._onmessage = function(msg) {
    try {
        this._forward(JSON.parse(msg.data));
    } catch (e) {
        console.log('Unable to parse incoming message ' + JSON.stringify(msg.data) + ': ' + e);
    }
};

Chord.prototype._forward = function(msg) {
    if (!msg.to) {
        throw Error('Unable to route message because no recipient can be determined');
    }
    if (this._id === msg.to) {
        this.deliver(msg);
        return;
    }

    // TODO: fill in magic here (eval via field, route forward via DHT)
};

Chord.prototype._update_others = function() {
    // TODO(max) implement
};

Chord.prototype._closest_preceding_finger = function(id) {
    var i;
    for (i = this._m; i >= 1; i--) {
        if (Helper.inOpenInterval(this._fingerTable[i].node._id, this._id, id)) {
            return this._fingerTable[i].node;
        }
    }
    return this._localNode;
};

/**
 * Public API
 **/

/**
 *
 *
 * @param dc DataChannel connection to remote peer
 */
Chord.prototype.add_peer = function(dc) {};

/**
 * join the DHT by using the 'bootstrap' node
 *
 * @param bootstrap {ChordNode} instance of the bootstrap host
 * @param successCallback {Chord~joinCallback} called after the join operation has been
 * carried out successfully.
 */
Chord.prototype._join = function(bootstrap, successCallback) {
    var i;
    // TODO: implement
    bootstrap.get_node_id(function() {
        this._init_finger_table(bootstrapNode, function() {
            this._update_others();
            // move keys in (predecessor,n] from successor
            successCallback();
        });
    });
};

/**
 * Public API
 **/

/**
 *
 *
 * @param dc DataChannel connection to remote peer
 */
Chord.prototype.addPeer = function(peer) {
    var node = new ChordNode(peer, this);
    peer.dataChannel.onmessage = this.onmessage.bind(this);
    // TODO: implement removing peer/updating finger table
    peer.peerConnection.onclosedconnection = this.removePeer.bind(this, peer);
    if (!this._joined) {
        this._join(node, function() {
            this._joined = true;
        });
        return;
    }
    // TODO: update finger table
};

/**
 * Store 'value' under 'key' in the DHT
 *
 * @param key
 * @param value
 */
Chord.prototype.put = function(key, value) {
    // TODO: implement
};

Chord.prototype.remove = function(key) {
    // TODO: implement
};

Chord.prototype.get = function(key) {
    // TODO: implement
};

if (typeof(module) !== 'undefined') {
    module.exports = Chord;
}

/**
 * Invoked after the node has joined the DHT.
 * @callback Chord~joinCallback
 * @param id {Number} This node's Chord ID.
 */
