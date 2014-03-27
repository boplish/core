var Node = require('./node');

/** @fileOverview Chord DHT implementation */

/**
 * @constructor
 * @class This is a Chord DHT implementation using WebRTC data channels.
 *
 * @param connectionManager {ConnectionManager} The connection manager instance
 * to be used for requesting data channel connections.
 */
var Chord = function(connectionManager) {
    if(!(this instanceof Chord)) {
        return new Chord(connectionManager);
    }

    this._connectionManager = connectionManager;
    this._predecessor = null;
    this._fingerTable = {};

    // TODO: implement, initialize node ID

    return this;
};

/**
 * join the DHT by using the 'bootstrap' DataChannel
 *
 * @param bootstrap DataChannel connection to a bootstrap host
 * @param successCallback {Chord~joinCallback} called after the join operation has been
 * carried out successfully.
 */
Chord.prototype.join = function(bootstrap, successCallback) {
    // TODO: implement
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

Chord.prototype.init_finger_table = function(remote) {
    // TODO: implement
    this.send(remote, {method: 'find_successor'});
};

if (typeof(module) !== 'undefined') {
    module.exports = Chord;
}

/**
 * Invoked after the node has joined the DHT.
 * @callback Chord~joinCallback
 * @param id {Number} This node's Chord ID.
 */
