var ChordNode = require('./node.js');
var Peer = require('../peer.js');
var Sha1 = require('../third_party/sha1.js');
var BigInteger = require('../third_party/BigInteger.js');
var async = require("async");
var Range = require("./range.js");
var chordConfig = require('../config.js').chord;

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

    if (typeof(chordConfig.maxFingerTableEntries) !== 'undefined' && (chordConfig.maxFingerTableEntries < 1 || chordConfig.maxFingerTableEntries > 160)) {
        throw new Error("Illegal maxFingerTableEntries value: " + maxFingerTableEntries + ". Must be between 1 and 160 (inclusively).");
    }

    Helper.defineProperties(this);

    this._m = m();

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
    this._maxPeerConnections = chordConfig.maxPeerConnections || 15;
    this._joining = false;
    this.debug = chordConfig.debug || false;
    this._successorList = [];
    this._routeInterceptor = [];
    this._helper = Helper;

    var memoizer = Helper.memoize(Helper.fingerTableIntervalStart.bind(this));
    for (var i = 1; i <= this._m; i++) {
        this._fingerTable[i] = {
            i: i,
            start: memoizer.bind(null, i),
            node: this._localNode
        };
    }

    this._stabilizeInterval = chordConfig.stabilizeInterval || 1000;
    this._stabilizeTimer = setTimeout(this.stabilize.bind(this), this._stabilizeInterval);
    this._fixFingersInterval = chordConfig.fixFingersInterval || 1000;
    this._fixFingersTimer = setTimeout(this._fix_fingers.bind(this), this._fixFingersInterval);

    return this;
};

/**
 * Returns the configured value of m (number of bits in key IDs) or the default.
 */

function m() {
    return chordConfig.maxFingerTableEntries || 16;
}

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

    fingerTableIntervalStart: function(k) {
        return this.id.add(BigInteger(2).pow(k - 1)).mod(BigInteger(2).pow(this._m));
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
    },

    random: function(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    },

    randomFingerTableIndex: function(table) {
        var keys = Object.keys(table);
        return keys[Helper.random(0, keys.length - 1)];
    }
};

Chord.prototype._closest_preceding_finger = function(id) {
    var i;
    for (i = this._m; i >= 1; i--) {
        if (this._fingerTable[i] && this._fingerTable[i].node !== this._localNode && Range.inOpenInterval(this._fingerTable[i].node.id(), this.id, id)) {
            return this._fingerTable[i].node;
        }
    }
    return this._localNode;
};

Chord.prototype._fix_fingers = function() {
    var self = this;
    var i = Helper.randomFingerTableIndex(self._fingerTable),
        start;
    start = self._fingerTable[i].start();

    self.find_successor(start, function(err, msg) {
        if (err) {
            console.log('Error during fix_fingers:', err);
        } else if (msg.successor.equals(self.id)) {
            // we are the successor
            self._fingerTable[i].node = self._localNode;
        } else {
            // connect to new successor
            self.connect(msg.successor, function(err, node) {
                if (err) {
                    return console.log('Error during fix_fingers:', err);
                }
                self._fingerTable[i].node = node;
            });
        }
    });

    self._fixFingersTimer = setTimeout(self._fix_fingers.bind(self), self._fixFingersInterval);
};

Chord.prototype.getFingerTable = function() {
    var fingers = [];
    for (var i in this._fingerTable) {
        fingers.push({
            k: this._fingerTable[i].k,
            start: this._fingerTable[i].start().toString(),
            successor: this._fingerTable[i].node.id().toString()
        });
    }
    return fingers;
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
 * @param bootstrapPeer {Peer} Peer instance of the bootstrap host
 * @param successCallback {Chord~joinCallback} called after the join operation has been
 * carried out successfully.
 */
Chord.prototype.join = function(bootstrapPeer, callback) {
    var i, self = this;
    if (self._joining) {
        callback("Already joining");
        return;
    }
    self._joining = true;

    self.addPeer(bootstrapPeer, function(err, bootstrapNode) {
        if (err) {
            self._joining = false;
            callback("Could not add the bootstrap peer: " + err);
            return;
        }
        self.log("My bootstrap peer is " + bootstrapNode.id().toString());
        bootstrapNode.find_predecessor(self.id.plus(1), function(err, res) {
            if (err) {
                self._joining = false;
                callback("Could not find a successor: " + err);
                return;
            }
            self.log("My successor is " + res.successor.toString());
            self.connect(res.successor, function(err, successorNode) {
                if (err) {
                    self._joining = false;
                    callback("The proposed successor was not reachable: " + err);
                    return;
                } else {
                    self._localNode._successor = successorNode;
                    self._joining = false;
                    console.log('JOINED');
                    callback(null);
                }
            });
        });
    });
};

Chord.prototype.updateSuccessorList = function(cb) {
    var self = this;
    var newSuccessorList = [];
    // fill up successorList with the next two peers behind successor (if it's not me)
    self._localNode._successor.find_predecessor(self._localNode.successor_id().plus(1), function(err, res) {
        if (!err && !res.successor.equals(self.id)) {
            newSuccessorList.push(res.successor);
            self._successorList = newSuccessorList;
            self._localNode._successor.find_predecessor(res.successor.plus(1), function(err, res) {
                if (!err && !res.successor.equals(self.id)) {
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
    this.find_predecessor(id, callback);
};

Chord.prototype.find_predecessor = function(id, callback) {
    var self = this;

    if (Range.inRightClosedInterval(id, self.id, self._localNode.successor_id())) {
        callback(null, {
            predecessor: self.id,
            successor: self._localNode.successor_id()
        });
    } else if (self._localNode.responsible(id)) {
        callback(null, {
            predecessor: self._localNode.predecessor_id(),
            successor: self.id
        });
    } else if (self.id.equals(self._localNode.successor_id())) {
        // inconsistent successor pointer, cannot answer this correctly
        // maybe i am the only one in the ring
        callback(null, {
            successor: self.id,
            predecessor: self.id
        });
    } else {
        var nextHop = self._closest_preceding_finger(id);
        if (nextHop.id().equals(self.id)) {
            nextHop = self._localNode._successor;
        }
        nextHop.find_predecessor(id, callback);
    }
};

Chord.prototype.connect = function(id, callback) {
    var self = this;
    if (id.equals(self.id)) {
        callback('cannot connect to myself');
        return;
    }
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

/**
 * Add a peer to the list of remotes.
 *
 * @param peer {Peer} Peer to add
 * @param callback {Function} called after the peer has been added. returns
 */
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
    callback(null, this._remotes[peer.id.toString()]);
};

Chord.prototype.removePeer = function(peer) {
    delete this._remotes[peer.id()];
};

Chord.prototype.stabilize = function() {
    var self = this;

    // dont run stabilize when we are currently joining
    if (self._joining) {
        self._stabilizeTimer = setTimeout(this.stabilize.bind(this), this._stabilizeInterval);
        return;
    }
    self._stabilizeTimer = clearTimeout(self._stabilizeTimer);

    // check if pre is still up if it's not unset
    if (!self._localNode.predecessor_id().equals(self.id)) {
        self._localNode._predecessor._peer.sendHeartbeat(function(err) {
            if (err) {
                self.log('predecessor down - removed it');
                // just remove it if its gone, someone else will update ours
                self._localNode._predecessor = null;
            }
        });
    }

    // check if successor is still up if it's not me and update succesor list
    if (!self._localNode.successor_id().equals(self.id)) {
        self._localNode._successor._peer.sendHeartbeat(function(err) {
            if (!!err && self._successorList.length <= 0) {
                self.log('successor failed, cannot recover. RESETTING');
                // @todo: we might be able to recover using a node in `self._remotes`
                // @todo: do we have to cleanup the remotes?
                self._remotes = {};
                self._localNode._successor = self._localNode;
                self._localNode._predecessor = null;
                self.stabilize();
                return;
            } else if (!!err && self._successorList.length > 0) {
                // successor failed, we can recover using the successor list
                var new_suc_id = self._successorList[Math.floor(Math.random() * self._successorList.length)];
                self.log('successor down, trying to recover using', new_suc_id.toString());
                self.connect(new_suc_id, function(err, newSuccessorNode) {
                    if (!err) {
                        self.log('yai, we got us a new successor');
                        self._localNode._successor = newSuccessorNode;
                    } else {
                        self.log('successor in successorList is down');
                    }
                    // remove the id from successorList as it either failed or is our successor now
                    var index = self._successorList.indexOf(new_suc_id);
                    var proposedSuccessorId = self._successorList.splice(index, 1);
                    self.log('removed proposed successor from successorList:', proposedSuccessorId.toString());
                    self._stabilizeTimer = setTimeout(self.stabilize.bind(self), self._stabilizeInterval);
                });
            } else {
                // successor is up, check if someone smuggled in between (id, successor_id]
                // or if successor.predecessor == successor (special case when predecessor is unknown)
                self._localNode._successor.find_predecessor(self._localNode.successor_id(), function(err, res) {
                    if (!err && Range.inOpenInterval(res.predecessor, self.id, self._localNode.successor_id())) {
                        self.log('we have a successor in (myId, sucId), it becomes our new successor');
                        self.connect(res.predecessor, function(err, suc_pre_node) {
                            if (!err) {
                                self._localNode._successor = suc_pre_node;
                            }
                            self._stabilizeTimer = setTimeout(self.stabilize.bind(self), self._stabilizeInterval);
                        });
                    } else if (!err) {
                        self.log('nobody smuggled in - everything is superb');
                        self._stabilizeTimer = setTimeout(self.stabilize.bind(self), self._stabilizeInterval);
                    } else {
                        self.log(err);
                        self._stabilizeTimer = setTimeout(self.stabilize.bind(self), self._stabilizeInterval);
                    }
                });
                // update successor list if everything is allright
                self.updateSuccessorList(function() {});
                // notify our successor of us
                self._localNode._successor.notify(self.id, function() {});
            }
        });
    } else {
        // i am my own successor. this only happens when reconnecting using 
        // the successor_list failed. In this case, pick a remote to re-join the DHT
        var remoteIds = self.getPeerIds();
        if (remoteIds.length >= 1) {
            var bootstrapNodeId = remoteIds[Math.floor(Math.random() * remoteIds.length)];
            var bootstrapNode = self._remotes[bootstrapNodeId];
            self.log('Attempting RE-JOIN using random peer from _remotes: ' + bootstrapNode.id().toString());
            self.join(bootstrapNode._peer, function(err) {
                if (err) {
                    self.log('RE-JOIN failed:', err);
                } else {
                    self.log('RE-JOIN successful');
                }
            });
        } else {
            self.log('Waiting for somebody to join me');
        }
        self._stabilizeTimer = setTimeout(self.stabilize.bind(self), self._stabilizeInterval);
    }
};

Chord.prototype._validateKey = function(key) {
    if (key.lesser(0) || key.greater(BigInteger(2).pow(this._m).minus(1))) {
        throw new Error("Key " + key.toString() + " not in acceptable range");
    }
};

/**
 * Store 'value' under 'key' in the DHT.
 *
 * @param key {String} or {BigInteger}. If key is a string, the SHA1 sum is
 * calculated from key and a valid ID created.
 * @param value
 */
Chord.prototype.put = function(key, value, callback) {
    if (typeof key === 'string') {
        key = Sha1.bigIntHash(key).mod(BigInteger(2).pow(this._m));
    } else {
        this._validateKey(key);
    }
    if (this._localNode.responsible(key)) {
        this._localNode.store(key, value);
        callback(null);
    } else {
        this._localNode._successor.put(key, value, callback);
    }
};

/**
 * Retrieve a value stored under 'key' in the DHT.
 *
 * @param key {String} or {BigInteger}. If key is a string, the SHA1 sum is
 * calculated from key and a valid ID created.
 */
Chord.prototype.get = function(key, callback) {
    if (typeof key === 'string') {
        key = Sha1.bigIntHash(key).mod(BigInteger(2).pow(this._m));
    }
    this._validateKey(key);
    var val;
    if (this._localNode.responsible(key)) {
        val = this._localNode.get_from_store(key);
        callback(null, val);
    } else {
        this._localNode._successor.get(key, callback);
    }
};

Chord.prototype.remove = function(key) {
    if (typeof key === 'string') {
        key = Sha1.bigIntHash(key).mod(BigInteger(2).pow(this._m));
    }
    this._validateKey(key);
    // TODO: implement
};

Chord.prototype.route = function(to, message, callback, options) {
    var self = this;
    var chordMsg = {
        to: to,
        payload: message
    };
    // default reliability service is reliable
    if (!options || options.reliable === undefined) {
        options = {
            reliable: true
        };
    }

    // make sure we run all interceptors before continuing
    var i = 0;
    (function callRouteInterceptor() {
        if (typeof(self._routeInterceptor[i]) === 'function') {
            self._routeInterceptor[i](chordMsg, function(err, _chordMsg, drop) {
                if (err) {
                    if (options.reliable) {
                        callback('Error from RouteInterceptor: ' + err);
                    }
                    return;
                } else if (!!drop) {
                    self.log('RouteInterceptor dropped message', JSON.stringify(_chordMsg));
                    if (options.reliable) {
                        callback(null);
                    }
                    return;
                }
                chordMsg = _chordMsg;
                i++;
                callRouteInterceptor();
            });
        } else {
            route(chordMsg.to, chordMsg.payload, callback, options);
        }
    })();

    function route(to, message, callback, options) {
        self._monitorCallback(message);
        if (to === "*" || (message.type === 'signaling-protocol' && !to.equals(self.id))) {
            // outgoing signaling messages go to bootstrap server
            self.log("routing (" + [message.type, message.seqnr].join(", ") + ") to signaling server");
            self._localNode.route(to, message, options, callback);
        } else if (self._localNode.responsible(to)) {
            try {
                self.log("(" + [message.type, message.seqnr].join(", ") + ") is for me");
                self._messageCallbacks[message.type](message);
                if (options.reliable) {
                    callback(null);
                }
            } catch (e) {
                self.log("Error handling message: ", e);
                if (options.reliable) {
                    callback("Error handling message: " + e);
                }
            }
        } else {
            // route using finger table
            var nextHop = self._closest_preceding_finger(to);
            if (nextHop === self._localNode) {
                // finger table is intialy filled with localnode, make sure not to route to myself
                if (nextHop.id().equals(self._localNode.successor_id())) {
                    // we do not know our successor, drop message and error out
                    if (options.reliable) {
                        callback('Could not route message');
                    }
                    return;
                } else {
                    nextHop = self._localNode._successor;
                }
            }
            self.log("routing (" + [message.type, message.payload.type, message.seqnr].join(", ") + ") to " + nextHop.id().toString());
            nextHop.route(to, message, options, callback);
        }
    }
};

Chord.prototype.registerDeliveryCallback = function(protocol, callback) {
    this._messageCallbacks[protocol] = callback;
};

Chord.prototype.registerInterceptor = function(interceptor) {
    this._routeInterceptor.push(interceptor);
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
    return randomId.mod(BigInteger(2).pow(BigInteger(m())));
};

if (typeof(module) !== 'undefined') {
    module.exports = Chord;
}

/**
 * Invoked after the node has joined the DHT.
 * @callback Chord~joinCallback
 * @param id {Number} This node's Chord ID.
 */

/**
 * Invoked after a Peer has been added to the Router.
 * @callback Chord~addPeerCallback
 * @param err {String} An error message if something went wrong
 * @param node {ChordNode} Node instance that was added to `_remotes`
 */
