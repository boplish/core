var Node = function(id, dc) {
    if (!(this instanceof Node)) {
        return new Node();
    }

    this._id = id;
    this._successor = null;
    this._dc = dc;
    this._dc.onmessage = this.onmessage.bind(this);
    this._pending = {};

    return this;
};

Node.prototype = {

    message_types: {
        FIND_SUCCESSOR: 1,
        SUCCESSOR: 2,
    },

    send: function(msg, cb) {
        var seqnr = Object.keys(this._pending).length;
        msg.seqnr = seqnr;
        this._pending[seqnr] = cb;
        this._dc.send(JSON.stringify(msg));
    },

    onmessage: function(msg) {
        var decoded = JSON.parse(msg.data), cb;
        switch(decoded.type) {
            case this.message_types.FIND_SUCCESSOR:
                var out = {type: this.message_types.SUCCESSOR, successor: 3, seqnr: decoded.seqnr};
                this._dc.send(JSON.stringify(out));
                return;
        }
        cb = this._pending[decoded.seqnr];
        delete this._pending[decoded.seqnr];
        cb(decoded);
    },

    find_successor: function (id, cb) {
        this.send({type: this.message_types.FIND_SUCCESSOR, id: id}, function(msg) {
            cb(msg.successor);
        });
    },

};


if (typeof(module) !== 'undefined') {
    module.exports = Node;
}
