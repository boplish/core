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
    this._localNode._predecessor = null;
    this._remotes = {};
    this._connectionManager = connectionManager;
    this._messageCallbacks = {};
    this._monitorCallback = function() {};
    this._fingerTable = {};
    this._m = 160;
    this._joining = false;
    this._joined = false; // are we joined to a Chord ring, yet?
    this.debug = false;
    this._successorList = [];
    this._stabilizeInterval = 1000;
    this._maxPeerConnections = 10;

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
        self.log("my bootstrap node is " + bootstrap_id.toString());
        if (err) {
            callback(err);
            return;
        }
        bootstrapNode.find_predecessor(self._localNode.id(), function(err, res) {
            self.log("my successor is " + res.successor.toString());
            if (err) {
                callback(err);
                return;
            }
            self.connect(res.successor, function(err, successorNode) {
                if (err) {
                    callback(err);
                    return;
                }
                self._localNode._successor = successorNode;

                self.updateSuccessorList(function() {
                    self._joining = false;
                    setTimeout(self.stabilize.bind(self), self._stabilizeInterval);
                    callback();
                });
            });
        });
    });
};

Chord.prototype.updateSuccessorList = function(cb) {
    var self = this;
    var newSuccessorList = [];
    // fill up successorList with the next two peers behind successor (if it's not me)
    self.find_successor(self._localNode.successor_id().plus(1), function(err, res) {
        if (!err || !res.successor.equals(self._localNode.id())) {
            newSuccessorList.push(res.successor);
            self.find_successor(res.successor.plus(1), function(err, res) {
                if (!err || !res.successor.equals(self._localNode.id())) {
                    newSuccessorList.push(res.successor);
                    self._successorList = newSuccessorList;
                    cb(null, self._successorList);
                } else {
                    cb(err);
                }
            });
        } else {
            cb(err);
        }
    });
};

Chord.prototype._addRemote = function(node) {
    this._remotes[node.id()] = node;
};

Chord.prototype.find_successor = function(id, callback) {
    //     var self = this;
    this.find_predecessor(id, callback)
    //     if (self._localNode.responsible(id)) {
    //         callback(null, self._localNode.id());
    //     } else if (Range.inRightClosedInterval(id, self._localNode.id(), self._localNode.successor_id())) {
    //         callback(null, self._localNode.successor_id());
    //     } else {
    //         // @todo: use finger table to route further
    //         self._localNode._successor.find_successor(id, callback);
    //     }
};

Chord.prototype.find_predecessor = function(id, callback) {
    var self = this;

    if (Range.inRightClosedInterval(id, self._localNode.id(), self._localNode.successor_id())) {
        callback(null, {
            predecessor: self._localNode.id(),
            successor: self._localNode.successor_id()
        });
    } else if (self._localNode.responsible(id)) {
        callback(null, {
            predecessor: self._localNode.predecessor_id(),
            successor: self._localNode.id()
        });
    } else {
        // @todo: use finger table to route further
        self._localNode._successor.find_predecessor(id, callback);
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
    // keep length of remotes low, if bigger than x, delete one if its not succ or pre
    if (this._remotes.length >= this._maxPeerConnections) {
        var keys = Obect.keys(this._remotes);
        var node = this._remotes[keys[keys.length * Math.random() << 0]];
        if (!node.equals(this._localNode._successor) && !node.equals(this._localNode._predecessor)) {
            node._peer._peerConnection.close();
            delete this._remotes[node];
        }
    }
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
};

Chord.prototype.removePeer = function(peer) {
    delete this._remotes[peer.id()];
};

Chord.prototype.stabilize = function() {
    var self = this;

    // check if pre is still up if it's not unset
    if (!self._localNode.predecessor_id().equals(self._localNode.id())) {
        self._localNode._predecessor._peer.sendHeartbeat(function(err) {
            if (err) {
                self.log('predecessor down - removed it');
                // just remove it if its gone, someone else will update ours
                self._localNode._predecessor = null;
            }
        });
    }

    // check if successor is still up if it's not me and update succesor list
    if (!self._localNode.successor_id().equals(self._localNode.id())) {
        self._localNode._successor._peer.sendHeartbeat(function(err) {
            if (!!err && self._successorList.length <= 0) {
                // successor failed, we're fucked
                // @todo: need to wait for another peer to connect
                self._localNode._successor = self._localNode;
                setTimeout(self.stabilize.bind(self), self._stabilizeInterval);
            } else if (!!err && self._successorList.length > 0) {
                // successor failed, we can recover using the successor list
                var new_suc_id = self._successorList[Math.floor(Math.random() * self._successorList.length)];
                self.log('successor down, trying to recover using', new_suc_id.toString());
                self.connect(new_suc_id, function(err, newSuccessorNode) {
                    self.log('yai, we got us a new successor');
                    // yai, we got us a new successor
                    self._localNode._successor = newSuccessorNode;
                    var index = self._successorList.indexOf(new_suc_id);
                    var proposedSuccessorId = self._successorList.splice(index, 1);
                    self.log('removed proposed successor from successorList:', proposedSuccessorId.toString());
                    setTimeout(self.stabilize.bind(self), self._stabilizeInterval); // delay timeout until we're done connecting
                });
            } else {
                // successor is up, check if someone smuggeld in between (id, successor_id]
                // or if successor.predecessor == successor (special case when predecessor is unknown)
                self._localNode._successor.find_predecessor(self._localNode.successor_id(), function(err, res) {
                    if (Range.inOpenInterval(res.predecessor, self._localNode.id(), self._localNode.successor_id())) {
                        self.log('we have a successor in (myId, sucId), it becomes our new successor');
                        self.connect(res.predecessor, function(err, suc_pre_node) {
                            self._localNode._successor = suc_pre_node;
                            setTimeout(self.stabilize.bind(self), self._stabilizeInterval);
                        });
                    } else {
                        setTimeout(self.stabilize.bind(self), self._stabilizeInterval);
                    }
                });
                // update successor list if everything is allright
                self.updateSuccessorList(function() {});
            }
        });
    } else {
        setTimeout(self.stabilize.bind(self), self._stabilizeInterval);
    }

    // notify our successor of us
    self._localNode._successor.notify(self._localNode.id(), function() {});
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
        this._localNode._successor.put(key, value, callback);
    }
};

Chord.prototype.get = function(key, callback) {
    var val;
    if (this._localNode.responsible(key)) {
        val = this._localNode.get_from_store(key);
        callback(null, val);
    } else {
        this._localNode._successor.get(key, callback);
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
            this.log("Error handling message: ", e);
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
            this._localNode._successor.route(to, message, callback);
            this.log("routing (" + [message.type, message.payload.type, message.seqnr].join(", ") + ") to " + this._localNode.successor_id().toString());
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
