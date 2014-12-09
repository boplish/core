var peerConfig = require('../config.js').peer;
var RingBuffer = require("../ringbuffer.js");
var ChordNode = require('./node.js');

var RTTestimator = function() {
    this._RTO = peerConfig.messageTimeout || 1000;
    this._history = new RingBuffer(10);
    this.maxRTT = -1;
};

RTTestimator.prototype = {
    /**
     * Feeds a new calculated RTT value into the estimator for further
     * processing.
     */
    newRTT: function(rtt) {
        this._history.push(rtt);
        if (rtt > this.maxRTT) {
            this.maxRTT = rtt;
        }
        var histArr = this._history.getall();
        this._RTO = histArr.reduce(function(prev, cur) {
            return prev + cur;
        }, 0) / histArr.length;
    },

    /**
     * Retrieves the current calculated RTO.
     */
    rto: function() {
        return this._RTO;
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = RTTestimator;
}
