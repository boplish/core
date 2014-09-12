var BigInteger = require("../third_party/BigInteger");
var Range = require("./range");

ChordNode = function(peer, chord, localNode) {
    if (!(this instanceof ChordNode)) {
        return new ChordNode(peer, chord);
    }

    this._peer = peer;
    if (this._peer.dataChannel) {
        this._peer.dataChannel.onmessage = this._onmessage.bind(this);
    }
    this._successor = null;
    this._predecessor = null;
    this._chord = chord;
    this._pending = {};
    this._seqnr = 0;
    this.debug = true;
    this._localNode = !! localNode;
    this._store = {};
    ChordNode.instances++;

    return this;
};

ChordNode.instances = 0;

ChordNode.prototype = {

    /**
     * Public API
     **/

    message_types: {
        FIND_SUCCESSOR: "FIND_SUCCESSOR",
        SUCCESSOR: "SUCCESSOR",
        FIND_PREDECESSOR: "FIND_PREDECESSOR",
        PREDECESSOR: "PREDECESSOR",
        GET_NODE_ID: "GET_NODE_ID",
        NODE_ID: "NODE_ID",
        UPDATE_PREDECESSOR: "UPDATE_PREDECESSOR",
        UPDATE_SUCCESSOR: "UPDATE_SUCCESSOR",
        ACK: "ACK",
        PUT: "PUT",
        GET: "GET"
    },

    toString: function() {
        return "[" + this._peer.id.toString() + "," + this.successor_id().toString() + "," + this.predecessor_id().toString() + "]";
    },

    successor: function(cb) {
        var self = this;
        if (self._successor.hasOwnPropery && self._successor.hasOwnProperty("_peer")) {
            cb(null, self._successor);
            return;
        } else {
            self._chord._connectionManager.connect(self.successor_id(), function(err, successorPeer) {
                if (err) {
                    throw err;
                }
                cb(null, new ChordNode(successorPeer, self._chord));
                return;
            });
        }
    },

    find_successor: function(id, cb) {
        var self = this;
        this._send_request({
            type: this.message_types.FIND_SUCCESSOR,
            id: id.toString()
        }, function(err, msg) {
            cb(null, new BigInteger(msg.successor));
        });
    },

    find_predecessor: function(id, cb) {
        var self = this;
        this._send_request({
            type: this.message_types.FIND_PREDECESSOR,
            id: id.toString()
        }, function(err, msg) {
            cb(null, new BigInteger(msg.predecessor));
        });
    },

    update_predecessor: function(id, cb) {
        var self = this;
        this._send_request({
            type: this.message_types.UPDATE_PREDECESSOR,
            id: id.toString()
        }, function(err, msg) {
            cb(null, null);
        });
    },

    update_successor: function(id, cb) {
        var self = this;
        this._send_request({
            type: this.message_types.UPDATE_SUCCESSOR,
            id: id.toString()
        }, function(err, msg) {
            cb(null, null);
        });
    },

    id: function() {
        return this._peer.id;
    },

    predecessor_id: function() {
        if (this._predecessor === null) {
            throw new Error("No predecessor");
        }
        if (this._predecessor.hasOwnProperty("_peer")) {
            return this._predecessor._peer.id;
        } else {
            return this._predecessor;
        }
    },

    successor_id: function() {
        if (this._successor === null) {
            throw new Error("No successor");
        }
        if (this._successor.hasOwnProperty("_peer")) {
            return this._successor._peer.id;
        } else {
            return this._successor;
        }
    },

    responsible: function(id) {
        return this.predecessor_id().equals(this.id()) || Range.inLeftClosedInterval(id, this.predecessor_id(), this.id());
    },

    put: function(key, value, callback) {
        this._send_request({
            type: this.message_types.PUT,
            key: key.toString(),
            value: value.toString()
        }, function(err, msg) {
            callback(null, null);
        });
    },

    get: function(key, callback) {
        this._send_request({
            type: this.message_types.GET,
            key: key.toString()
        }, function(err, msg) {
            callback(null, msg.value);
        });
    },

    store: function(key, value) {
        this._store[key] = value;
    },

    get_from_store: function(key) {
        return this._store[key];
    },

    /**
     * Internal API
     **/

    log: function(msg) {
        if (!this.debug) {
            return;
        }
        console.log("[" + this._peer.id + "," + this._chord._localNode._peer.id + "," + this._localNode + "] ", msg, arguments.length > 1 ? Array.prototype.slice.call(arguments, 1) : "");
    },

    _find_successor: function(id, seqnr) {
        var self = this;
        this._chord.find_successor(id, function(err, res) {
            var msg = {
                type: self.message_types.SUCCESSOR,
                successor: res.toString(),
                seqnr: seqnr
            };
            self._send(msg);
        });
    },

    _find_predecessor: function(id, seqnr) {
        var self = this;
        this._chord.find_predecessor(id, function(err, res) {
            var msg = {
                type: self.message_types.PREDECESSOR,
                predecessor: res.toString(),
                seqnr: seqnr
            };
            self._send(msg);
        });
    },

    _update_predecessor: function(id, seqnr) {
        var self = this;
        self._chord._localNode._predecessor = id;
        self._send({
            type: self.message_types.ACK,
            seqnr: seqnr
        });
    },

    _update_successor: function(id, seqnr) {
        var self = this;
        self._chord._localNode._successor = id;
        self._send({
            type: self.message_types.ACK,
            seqnr: seqnr
        });
    },

    _send_node_id: function(seqnr) {
        var msg = {
            type: this.message_types.NODE_ID,
            id: this._peer.id.toString(),
            seqnr: seqnr
        };
        this._send(msg);
    },

    _put: function(key, value, seqnr) {
        var self = this;
        this._chord.put(key, value, function(err) {
            var msg = {
                type: self.message_types.ACK,
                seqnr: seqnr
            };
            self._send(msg);
        });
    },

    _get: function(key, seqnr) {
        var self = this;
        this._chord.get(key, function(err, value) {
            var msg = {
                type: self.message_types.ACK,
                value: value,
                seqnr: seqnr
            };
            self._send(msg);
        });
    },

    _send_request: function(msg, cb) {
        msg.seqnr = this._seqnr++; // TODO(max): handle overflows
        this._pending[msg.seqnr] = cb;
        this._send(msg);
    },

    _send: function(msg) {
        msg.to = this._peer.id.toString();
        this._peer.dataChannel.send(msg);
    },

    _onmessage: function(rawMsg, sender) {
        this.log("Got message from " + sender, rawMsg);
        var msg = JSON.parse(rawMsg.data);
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
        callback(null, msg);
    },

    _handle_request: function(msg) {
        var key;
        if (typeof(msg.seqnr) === "undefined") {
            return; // ignore message without sequence number
        }
        switch (msg.type) {
            case this.message_types.GET:
                key = new BigInteger(msg.key);
                this._get(key, msg.seqnr);
                break;
            case this.message_types.PUT:
                key = new BigInteger(msg.key);
                this._put(key, msg.value, msg.seqnr);
                break;
            case this.message_types.FIND_SUCCESSOR:
                var i = new BigInteger(msg.id);
                this._find_successor(i, msg.seqnr);
                break;
            case this.message_types.FIND_PREDECESSOR:
                this._find_predecessor(new BigInteger(msg.id), msg.seqnr);
                break;
            case this.message_types.GET_NODE_ID:
                this._send_node_id(msg.seqnr);
                break;
            case this.message_types.UPDATE_PREDECESSOR:
                this._update_predecessor(new BigInteger(msg.id), msg.seqnr);
                break;
            case this.message_types.UPDATE_SUCCESSOR:
                this._update_successor(new BigInteger(msg.id), msg.seqnr);
                break;
            default:
                //unknown request
                break;
        }
    },

};


if (typeof(module) !== 'undefined') {
    module.exports = ChordNode;
}
