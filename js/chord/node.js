var Node = function(id, dc) {
    if (!(this instanceof Node)) {
        return new Node();
    }

    this._id = id;
    this._successor = null;
    this._dc = dc;
    this._dc.onmessage = this.onmessage.bind(this);
    this._pending = {};
    this._seqnr = 0;

    return this;
};

Node.prototype = {

    message_types: {
        FIND_SUCCESSOR: 1,
        SUCCESSOR: 2,
    },

    send_request: function(msg, cb) {
        msg.seqnr = this._seqnr++;
        this._pending[msg.seqnr] = cb;
        this.send(msg);
    },

    send_successor: function(seqnr) {
        var msg = {type: this.message_types.SUCCESSOR, successor: 3, seqnr: seqnr};
        this.send(msg);
    },

    send: function(msg) {
        this._dc.send(JSON.stringify(msg));
    },

    onmessage: function(msg) {
        var decoded, cb;
        try {
            decoded = JSON.parse(msg.data);
        } catch(e) {
            return;
        }
        cb = this._pending[decoded.seqnr];
        if(typeof(cb) === 'function') {
            this.handle_response(decoded, cb);
        } else {
            this.handle_request(decoded);
        }
    },

    handle_response: function(msg, callback) {
        delete this._pending[msg.seqnr];
        callback(msg);
    },

    handle_request: function(msg) {
        if(typeof(msg.seqnr) === "undefined") {
            return; // ignore message without sequence number
        }
        switch(msg.type) {
            case this.message_types.FIND_SUCCESSOR:
                this.send_successor(msg.seqnr);
                break;
            default:
                //unknown request
                break;
        }
    },

    find_successor: function (id, cb) {
        this.send_request({type: this.message_types.FIND_SUCCESSOR, id: id}, function(msg) {
            cb(msg.successor);
        });
    },

};


if (typeof(module) !== 'undefined') {
    module.exports = Node;
}
