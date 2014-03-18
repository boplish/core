var Chord = function() {
    // TODO: implement, initialize node ID
};

/**
 * join the DHT by using the 'bootstrap' DataChannel
 *
 * @param bootstrap DataChannel connection of bootstrap host
 */
Chord.prototype.join = function(bootstrap) {
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


if (typeof(module) !== 'undefined') {
    module.exports = Chord;
}
