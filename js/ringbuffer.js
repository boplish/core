var RingBuffer = function(size) {
    if (size <= 0) {
        throw new RangeError("RingBuffer size must be > 0");
    }
    if (!(this instanceof RingBuffer)) {
        return new RingBuffer(size);
    }
    this._array = Array(size);
    this._curIdx = 0;
};

RingBuffer.prototype = {
    push: function(val) {
        this._array[this._curIdx] = val;
        this._curIdx = (this._curIdx + 1) % this._array.length;
        return this;
    },

    get: function(idx) {
        return this._array[idx % this._array.length];
    },

    getall: function() {
        return this._array.slice(0);
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = RingBuffer;
}
