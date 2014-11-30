var BigInteger = require("../third_party/BigInteger.js");
var Range = require("./range.js");

var ChordNode = function(peer, chord, localNode) {
    if (!(this instanceof ChordNode)) {
        return new ChordNode(peer, chord, localNode);
    }

    if (typeof peer === "undefined") {
        throw new Error("Trying to instantiate a ChordNode without a Peer");
    }

    this._peer = peer;
    this._peer.onmessage = this._onmessage.bind(this);
    this._successor = null;
    this._predecessor = null;
    this._chord = chord;
    this._pending = {};
    this._seqnr = 0;
    this.debug = false;
    this._localNode = !!localNode;
    this._store = {};

    return this;
};

ChordNode.prototype = {

    /**
     * Public API
     **/

    message_types: {
        FIND_SUCCESSOR: "FIND_SUCCESSOR",
        FIND_PREDECESSOR: "FIND_PREDECESSOR",
        PREDECESSOR: "PREDECESSOR",
        NOTIFY: "NOTIFY",
        ACK: "ACK",
        PUT: "PUT",
        GET: "GET",
        ROUTE: "ROUTE",
        ERROR: "ERROR"
    },

    toString: function() {
        var succ_id = this.successor_id();
        var pred_id = this.predecessor_id();
        return "[" + this.id() + "," + (succ_id ? succ_id.toString() : "") + "," + (pred_id ? pred_id.toString() : "") + "]";
    },

    id: function() {
        return this._peer.id;
    },

    predecessor_id: function() {
        if (this._predecessor === null) {
            return this.id();
        }
        if (this._predecessor instanceof ChordNode) {
            return this._predecessor._peer.id;
        } else {
            throw new Error("Predecessor is not a ChordNode");
        }
    },

    successor_id: function() {
        if (this._successor instanceof ChordNode) {
            return this._successor._peer.id;
        } else {
            throw new Error("Successor is not a ChordNode");
        }
    },

    find_successor: function(id, cb) {
        var self = this;
        self.log("finding successor of", id);
        this._send_request({
            type: this.message_types.FIND_SUCCESSOR,
            id: id.toString()
        }, function(err, msg) {
            self.log(JSON.stringify(msg));
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

    notify: function(id, cb) {
        var self = this;
        this._send_request({
            type: this.message_types.NOTIFY,
            id: id.toString()
        }, function(err, msg) {
            cb(null, null);
        });
    },

    responsible: function(id) {
        // I'm responsible for (predecessorId, myId]
        // if predecessorId==null i'm not sure
        // as inRightClosedInterval() returns false in that case
        // @todo: what do we do if predecessorId is currently not set or set to our id? 
        if (this.predecessor_id().equals(this.id())) {
            return true;
        } else {
            return id.equals(this.id()) || Range.inRightClosedInterval(id, this.predecessor_id(), this.id());
        }
    },

    put: function(key, value, callback) {
        this._send_request({
            type: this.message_types.PUT,
            key: key.toString(),
            value: value
        }, function(err, msg) {
            callback(null, null);
        });
    },

    get: function(key, callback) {
        var self = this;
        self.log("sending GET request");
        this._send_request({
            type: this.message_types.GET,
            key: key.toString()
        }, function(err, msg) {
            callback(null, msg.value);
        });
    },

    route: function(to, message, callback) {
        var self = this;
        this._send_request({
            type: this.message_types.ROUTE,
            to: to.toString(),
            payload: message
        }, function(err, msg) {
            callback(err);
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
        var prelude = "[" + this._peer.id.toString() + "," + this._chord._localNode._peer.id.toString() + "," + this._localNode + "] ";
        if (arguments.length > 1) {
            console.log([prelude, msg].concat(Array.prototype.slice.call(arguments, 1)).join(" "));
        } else {
            console.log([prelude, msg].join(" "));
        }
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

    _notify: function(proposedId, seqnr) {
        var self = this;

        var myId = self._chord._localNode.id();
        var preId = self._chord._localNode.predecessor_id();

        if (proposedId.equals(preId)) {
            self.log('not updating my predecessor');
        } else if (preId.equals(myId) || Range.inLeftClosedInterval(proposedId, preId, myId)) {
            self.log('updating my predecessor to ' + proposedId.toString());
            // we got an id with a new predecessor. connect to it now 
            self._chord.connect(proposedId, function(err, chordNode) {
                self._chord._localNode._predecessor = chordNode;
            });
        } else {
            self.log('not updating my predecessor');
        }
        self._send({
            type: self.message_types.ACK,
            seqnr: seqnr
        });
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

    _route: function(msg) {
        var self = this;
        this._chord.route(new BigInteger(msg.to), msg.payload, function(err) {
            var resp = {
                type: self.message_types.ACK,
                seqnr: msg.seqnr,
                to: msg.from
            };
            if (err) {
                resp.type = self.message_types.ERROR;
                resp.error = err;
            }
            self._send(resp);
        });
    },

    _send_request: function(msg, cb) {
        msg.seqnr = Math.floor(Math.random() * 4294967296);
        this._pending[msg.seqnr] = cb;
        this._send(msg);
    },

    _send: function(msg) {
        msg.from = this._chord.id.toString();
        try {
            this._peer.send(msg);
        } catch (e) {
            this.log("Error sending", e);
        }
    },

    _onmessage: function(msg) {
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
        callback(msg.error, msg);
    },

    _handle_request: function(msg) {
        var key;
        if (typeof(msg.seqnr) === "undefined") {
            return; // ignore message without sequence number
        }
        switch (msg.type) {
            case this.message_types.ROUTE:
                this._route(msg);
                break;
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
            case this.message_types.NOTIFY:
                this._notify(new BigInteger(msg.id), msg.seqnr);
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
