var ChordNode = require('./node');
var Peer = require('../peer');
var Sha1 = require('../third_party/sha1');
var BigInteger = require('../third_party/BigInteger');
var async = require("async");
var Range = require("./range");

/** @fileOverview Chord DHT implementation */

/**
 * @constructor
 * @class This is a Chord DHT implementation using WebRTC data channels.
 *
 * @param id {BigInteger} the ID of this Chord instance
 * @param fallbackSignaling {WebSocket} The fallback channel to the bootstrap
 * server
 * @param connectionManager {ConnectionManager} The connection manager instance
 * to be used for requesting data channel connections.
 */
var Chord = function(id, fallbackSignaling, connectionManager) {
    if (!(this instanceof Chord)) {
        return new Chord(id, fallbackSignaling, connectionManager);
    }

    Helper.defineProperties(this);

    if (!id) {
        id = Chord.randomId();
    }

    this._localNode = new ChordNode(new Peer(id, null, fallbackSignaling), this, true);
    this._localNode._successor = id;
    this._localNode._predecessor = id;
    this._remotes = {};
    this._connectionManager = connectionManager;
    this._messageCallbacks = {};
    this._fingerTable = {};
    this._m = 8;
    this._joined = false; // are we joined to a Chord ring, yet?

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
        return this.id.add(BigInteger(2).pow(i - 1)).mod(BigInteger(2).pow(this._m));
    },

    defineProperties: function(object) {
        Object.defineProperty(object, "connectionManager", {
            set: function(cm) {
                object._connectionManager = cm;
            }
        });
        Object.defineProperty(object, "id", {
            get: function() {
                return object._localNode.id.bind(object._localNode)();
            },
            set: function(id) {}
        });
    }
};

/**
 * Internal API
 **/

Chord.prototype._init_finger_table = function(remote, successCallback) {
    var self = this;
    remote.find_successor(this._fingerTable[1].start(), function(successor) {
        self._fingerTable[1].node = successor;
        self._localNode._predecessor = successor.predecessor;
        self._localNode._successor.predecessor = this._localNode;
        successCallback();
    });
};

Chord.prototype._update_others = function() {
    // TODO(max) implement
};

Chord.prototype._closest_preceding_finger = function(id) {
    var i;
    for (i = this._m; i >= 1; i--) {
        if (Range.inOpenInterval(this._fingerTable[i].node.id(), this.id, id)) {
            return this._fingerTable[i].node;
        }
    }
    return this._localNode;
};

Chord.prototype.log = function(msg) {
    console.log("[" + this._localNode._peer.id.toString() + "] ", msg, arguments.length > 1 ? Array.prototype.slice.call(arguments, 1) : "");
};

/**
 * Public API
 **/

Chord.prototype.create = function(callback) {
    callback(this._id);
};

/**
 * join the DHT by using the 'bootstrap' node
 *
 * @param bootstrap_id {BigInteger} ID of the bootstrap host
 * @param successCallback {Chord~joinCallback} called after the join operation has been
 * carried out successfully.
 */
Chord.prototype.join = function(bootstrap_id, callback) {
    var i, self = this;
    self._connectionManager.connect(bootstrap_id, function(err, peer) {
        if (err) {
            self.log(err);
            return;
        }
        var bootstrapNode = new ChordNode(peer, self);
        bootstrapNode.find_successor(self._localNode._peer.id, function(err, successor) {
            if (err) {
                self.log(err);
                return;
            }
            self._connectionManager.connect(successor, function(err, successorPeer) {
                if (err) {
                    self.log(err);
                    return;
                }
                self._localNode._successor = new ChordNode(successorPeer, self);
                self._localNode._successor.find_predecessor(self._localNode._peer.id, function(err, predecessor) {
                    if (err) {
                        self.log(err);
                        return;
                    }
                    self._localNode._successor.update_predecessor(self._localNode.id(), function(err, res) {
                        if (err) {
                            self.log(err);
                            return;
                        }
                        self._connectionManager.connect(predecessor, function(err, predecessorPeer) {
                            if (err) {
                                self.log(err);
                                return;
                            }
                            self._localNode._predecessor = new ChordNode(predecessorPeer, self);
                            self._localNode._predecessor.update_successor(self._localNode.id(), function() {
                                callback();
                            });
                        });
                    });
                });
            });
        });
    });
};

Chord.prototype.find_successor = function(id, callback) {
    var self = this;
    if (self._localNode.responsible(id)) {
        callback(null, self._localNode.id());
    } else if (Range.inLeftClosedInterval(id, self._localNode.id(), self._localNode.successor_id())) {
        self._localNode.successor(function(err, successorNode) {
            callback(null, successorNode.id());
        });
    } else {
        self._localNode.successor(function(err, successorNode) {
            successorNode.find_successor(id, callback);
        });
    }
};

Chord.prototype.find_predecessor = function(id, callback) {
    var self = this;
    if (self._localNode.id().equals(self._localNode.successor_id()) || Range.inLeftClosedInterval(id, self._localNode.id(), self._localNode.successor_id())) {
        callback(null, self._localNode.id());
    } else if (self._localNode.responsible(id)) {
        callback(null, self._localNode.predecessor_id());
    } else {
        self._localNode.successor(function(err, successorNode) {
            successorNode.find_predecessor(id, callback);
        });
    }
};

/**
 *
 *
 * @param dc DataChannel connection to remote peer
 */
Chord.prototype.addPeer = function(peer, callback) {
    // TODO: what if we already have a node with this ID?
    if (Object.keys(this._remotes).length === 0) {
        this.join(peer.id, function() {
            console.log("JOINED");
            callback();
        });
    } else {
        this._remotes[peer.id] = new ChordNode(peer, this);
        callback();
    }
    // TODO: implement removing peer/updating finger table
    //peer.peerConnection.onclosedconnection = this.removePeer.bind(this, peer);
    // TODO: update finger table
};

/**
 * Store 'value' under 'key' in the DHT
 *
 * @param key
 * @param value
 */
Chord.prototype.put = function(key, value, callback) {
    if (this._localNode.responsible(key)) {
        this._localNode.store(key, value);
        callback(null);
    } else {
        this._localNode.successor(function(err, successorNode) {
            successorNode.put(key, value, callback);
        });
    }
};

Chord.prototype.get = function(key, callback) {
    var val;
    if (this._localNode.responsible(key)) {
        val = this._localNode.get_from_store(key);
        callback(null, val);
    } else {
        this._localNode.successor(function(err, successorNode) {
            successorNode.get(key, callback);
        });
    }
};

Chord.prototype.remove = function(key) {
    // TODO: implement
};

Chord.prototype.route = function(to, message, callback) {
    this.log("routing " + JSON.stringify(message) + " to " + to.toString());
    if (to === "*") {
        this._localNode.route(to, message, callback);
    } else if (this.id.equals(to)) {
        try {
            this._messageCallbacks[message.type](message);
            callback(null);
        } catch (e) {
            this.log('Unable to handle message of type ' + message.type + ' because no callback is registered: ' + e);
            callback("No application for protocol '" + message.type + "'");
        }
    } else if (Range.inOpenInterval(to, this._localNode.predecessor_id(), this.id)) {
        this._localNode.route(to, message, callback);
    } else {
        this._localNode.successor(function(err, successorNode) {
            successorNode.route(to, message, callback);
        });
    }
};

Chord.prototype.registerDeliveryCallback = function(protocol, callback) {
    this.log("registering callback for", protocol);
    this._messageCallbacks[protocol] = callback;
};

Chord.randomId = function() {
    var randomId = Sha1.bigIntHash(Math.random().toString());
    return randomId;
};

if (typeof(module) !== 'undefined') {
    module.exports = Chord;
}

/**
 * Invoked after the node has joined the DHT.
 * @callback Chord~joinCallback
 * @param id {Number} This node's Chord ID.
 */
