var Node = require('./node');
var BigInt = require('../third_party/BigInteger');

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
    this._predecessor = null;
    this._fingerTable = {};
    this._id = {
        digest: digest,
        number: hash.bigInteger(digest)
    };
    this._m = keyLength;
    this._localNode = new Node(this._id, this._id, null);

    var memoizer = memoize(calcStart.bind(this));
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

function memoize(func) {
    var memo = {};
    var slice = Array.prototype.slice;
    return function() {
        var args = slice.call(arguments);
        if (!(args in memo)) {
            memo[args] = func.apply(this, args);
        }
        return memo[args];
    };
}

function calcStart(i) {
    return this._id.number.add(BigInt(2).pow(i - 1)).mod(BigInt(2).pow(this._m));
}

function inInterval(val, start, end) {
    return val.greaterOrEquals(start) && val.lesser(end);
}

function inOpenInterval(val, start, end) {
    return val.greater(start) && val.lesser(end);
}

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

Chord.prototype._update_others = function() {

};

Chord.prototype._closest_preceding_finger = function(id) {
    var i;
    for (i = this._m; i >= 1; i--) {
        if (inOpenInterval(this._fingerTable[i].node._id.number, this._id.number, id)) {
            return this._fingerTable[i].node;
        }
    }
    return this._localNode;
};

/**
 * Public API
 **/

/**
 * join the DHT by using the 'bootstrap' DataChannel
 *
 * @param bootstrap DataChannel connection to a bootstrap host
 * @param successCallback {Chord~joinCallback} called after the join operation has been
 * carried out successfully.
 */
Chord.prototype.join = function(bootstrap, successCallback) {
    var i;
    // TODO: implement
    if (!bootstrap) {
        for (i = 1; i <= this._m; i++) {
            this._fingerTable[i].node = this._localNode;
        }
        this._predecessor = this._localNode;
        return successCallback();
    }

    var bootstrapNode = new Node(null, null, bootstrap, this);
    bootstrapNode.get_node_id(function() {
        this._init_finger_table(bootstrapNode, function() {
            this._update_others();
            // move keys in (predecessor,n] from successor
            successCallback();
        });
    });
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
