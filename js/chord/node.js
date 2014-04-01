var BigInteger = require('../third_party/BigInteger');

var Node = function(id, successor, dc, chord) {
    if (!(this instanceof Node)) {
        return new Node();
    }

    this._id = id;
    this._successor = successor;
    this._dc = dc;
    this._chord = chord;
    this._pending = {};
    this._seqnr = 0;

    if (this._dc) {
        this._dc.onmessage = this._onmessage.bind(this);
    }

    return this;
};

Node.prototype = {

    /**
     * Public API
     **/

    message_types: {
        FIND_SUCCESSOR: 1,
        SUCCESSOR: 2,
        GET_NODE_ID: 3,
        NODE_ID: 4,
    },

    find_successor: function(id, cb) {
        this._send_request({
            type: this.message_types.FIND_SUCCESSOR,
            id: id.toString()
        }, function(msg) {
            cb(msg.successor);
        });
    },

    get_node_id: function(cb) {
        this._send_request({
            type: this.message_types.GET_NODE_ID
        }, function(msg) {
            this._id = BigInteger(msg.id); // TODO(max) sanity checks
            cb(this._id);
        }.bind(this));
    },

    /**
     * Internal API
     **/

    _send_successor: function(seqnr) {
        var msg = {
            type: this.message_types.SUCCESSOR,
            successor: this._successor,
            seqnr: seqnr
        };
        this._send(msg);
    },

    _send_node_id: function(seqnr) {
        var msg = {
            type: this.message_types.NODE_ID,
            id: this._id.toString(),
            seqnr: seqnr
        };
        this._send(msg);
    },

    _send_request: function(msg, cb) {
        msg.seqnr = this._seqnr++; // TODO(max): handle overflows
        this._pending[msg.seqnr] = cb;
        this._send(msg);
    },

    _send: function(msg) {
        this._dc.send(JSON.stringify(msg));
    },

    _onmessage: function(msg) {
        var decoded, cb;
        try {
            decoded = JSON.parse(msg.data);
        } catch (e) {
            return;
        }
        cb = this._pending[decoded.seqnr];
        if (typeof(cb) === 'function') {
            this._handle_response(decoded, cb);
        } else {
            this._handle_request(decoded);
        }
    },

    _handle_response: function(msg, callback) {
        delete this._pending[msg.seqnr];
        callback(msg);
    },

    _handle_request: function(msg) {
        if (typeof(msg.seqnr) === "undefined") {
            return; // ignore message without sequence number
        }
        switch (msg.type) {
            case this.message_types.FIND_SUCCESSOR:
                this._send_successor(msg.seqnr);
                break;
            case this.message_types.GET_NODE_ID:
                this._send_node_id(msg.seqnr);
                break;
            default:
                //unknown request
                break;
        }
    },

};


if (typeof(module) !== 'undefined') {
    module.exports = Node;
}
