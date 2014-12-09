var peerConfig = require('../config.js').peer;
var RingBuffer = require("../ringbuffer.js");
var ChordNode = require('./node.js');

var StaticRTTestimator = function() {
    this._RTO = peerConfig.messageTimeout || 1000;
};

StaticRTTestimator.prototype = {
    newRTT: function(rtt) {
        // don't care
    },

    rto: function() {
        return this._RTO;
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = StaticRTTestimator;
}
