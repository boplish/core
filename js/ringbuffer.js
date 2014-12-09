var RingBuffer = function(size) {
    this._array = [];
    this._size = size;
    this._curIdx = 0;
};

RingBuffer.prototype = {
    push: function(val) {
        this._array[this._curIdx] = val;
        this._curIdx = (this._curIdx + 1) % this._size;
    },

    get: function(idx) {
        return this._array[idx % this._size];
    },

    getall: function() {
        return this._array.slice(0);
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = RingBuffer;
}
