var BigInteger = require('../third_party/BigInteger');

var Node = function(peer, chord) {
    if (!(this instanceof Node)) {
        return new Node(peer, chord);
    }

    this._peer = peer;
    this._successor = null;
    this._predecessor = null;
    this._chord = chord;
    this._pending = {};
    this._seqnr = 0;

    this._chord.registerDeliveryCallback('chord-protocol', this._onmessage.bind(this));

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
        if (this._id) {
            cb(this._id);
            return;
        }
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
        this._chord.route(this._peer.id, 'chord-protocol', msg);
    },

    _onmessage: function(msg, sender) {
        var cb = this._pending[msg.seqnr];
        // if we find a callback this message is a response to a request of ours
        if (typeof(cb) === 'function') {
            this._handle_response(msg, cb);
        } else {
            this._handle_request(msg);
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
