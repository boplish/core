var ChordNode = require('./node.js');
var Peer = require('../peer.js');
var Sha1 = require('../third_party/sha1.js');
var BigInteger = require('../third_party/BigInteger.js');
var async = require("async");
var Range = require("./range.js");

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
    this._localNode._successor = this._localNode;
    this._localNode._predecessor = this._localNode;
    this._remotes = {};
    this._connectionManager = connectionManager;
    this._messageCallbacks = {};
    this._monitorCallback = function() {};
    this._fingerTable = {};
    this._m = 160;
    this._joining = false;
    this._joined = false; // are we joined to a Chord ring, yet?
    this.debug = false;

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
    if (!this.debug) {
        return;
    }
    var prelude = "[" + this._localNode._peer.id.toString() + "]";
    if (arguments.length > 1) {
        console.log([prelude, msg].concat(Array.prototype.slice.call(arguments, 1)).join(" "));
    } else {
        console.log([prelude, msg].join(" "));
    }
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
    if (self._joining) {
        callback("Already joining");
        return;
    }
    self._joining = true;
    self.connect(bootstrap_id, function(err, bootstrapNode) {
        if (err) {
            callback(err);
            return;
        }
        bootstrapNode.find_successor(self._localNode._peer.id, function(err, successor) {
            if (err) {
                callback(err);
                return;
            }
            self.connect(successor, function(err, successorNode) {
                if (err) {
                    callback(err);
                    return;
                }
                self._localNode._successor = successorNode;
                self._localNode._successor.find_predecessor(self._localNode._peer.id, function(err, predecessor) {
                    self.log("predecessor is " + predecessor.toString());
                    if (err) {
                        callback(err);
                        return;
                    }
                    self._localNode._successor.update_predecessor(self._localNode.id(), function(err, res) {
                        self.log("updated predecessor");
                        if (err) {
                            callback(err);
                            return;
                        }
                        self.connect(predecessor, function(err, predecessorNode) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            self._localNode._predecessor = predecessorNode;
                            self._localNode._predecessor.update_successor(self._localNode.id(), function() {
                                self.log("updated successor");
                                self._joining = false;
                                callback();
                            });
                        });
                    });
                });
            });
        });
    });
};

Chord.prototype._addRemote = function(node) {
    this._remotes[node.id()] = node;
};

Chord.prototype.find_successor = function(id, callback) {
    var self = this;
    if (self._localNode.responsible(id)) {
        self.log("It is me");
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

Chord.prototype.connect = function(id, callback) {
    var self = this;
    if (this._remotes[id]) {
        callback(null, this._remotes[id]);
    } else {
        this._connectionManager.connect(id, function(err, peer) {
            if (err) {
                callback(err);
                return;
            }
            self._addRemote(new ChordNode(peer, self, false));
            callback(null, self._remotes[id]);
        });
    }
};

Chord.prototype.addPeer = function(peer, callback) {
    this._remotes[peer.id.toString()] = new ChordNode(peer, this, false);
    // TODO: what if we already have a node with this ID?
    if (Object.keys(this._remotes).length === 1 && !this._joining) {
        this.join(peer.id, function(err) {
            if (err) {
                callback(err);
                return;
            }
            console.log("JOINED");
            callback();
        });
    } else {
        callback();
    }
    peer.onclose = this.removePeer.bind(this, peer);
    // TODO: update finger table ()
};

Chord.prototype.removePeer = function(peer) {
    this.log('peer not reachable:', peer.id.toString());
    //delete this._remotes[peer.id.toString()];
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
    this._monitorCallback(message);
    if (to === "*") {
        this.log("routing (" + [message.type, message.seqnr].join(", ") + ") to signaling server");
        this._localNode.route(to, message, callback);
    } else if (this.id.equals(to)) {
        try {
            this.log("(" + [message.type, message.seqnr].join(", ") + ") is for me");
            this._messageCallbacks[message.type](message);
            callback(null);
        } catch (e) {
            this.log('Error handling message: ', e);
            callback("Error handling message: " + e);
        }
    } else if (Range.inOpenInterval(to, this._localNode.predecessor_id(), this.id)) {
        this.log("routing (" + [message.type, message.payload.type, message.seqnr].join(", ") + ") to " + to.toString() + " through signaling server");
        this._localNode.route(to, message, callback);
    } else {
        if (message.type === 'signaling-protocol') {
            // we need to route offer/answer packets through the server to avoid
            // endless route loops
            this._localNode.route(to, message, callback);
        } else {
            console.log("asking successor to route message to " + to.toString());
            this._localNode.successor(function(err, successorNode) {
                this.log("routing (" + [message.type, message.payload.type, message.seqnr].join(", ") + ") to " + successorNode.id().toString());
                successorNode.route(to, message, callback);
            }.bind(this));
        }
    }
};

Chord.prototype.registerDeliveryCallback = function(protocol, callback) {
    this._messageCallbacks[protocol] = callback;
};

Chord.prototype.registerMonitorCallback = function(callback) {
    this._monitorCallback = callback;
};

/**
 * Return a list of all peer ids currently in the routing table.
 *
 * @returns {Array}
 */
Chord.prototype.getPeerIds = function() {
    var peers = [];
    var peer;
    for (peer in this._remotes) {
        if (this._remotes.hasOwnProperty(peer)) {
            peers.push(peer);
        }
    }
    return peers;
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
