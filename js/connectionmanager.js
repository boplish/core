/** @fileOverview Mid-level connection broking and signaling functionality. */

var Peer = require('./peer.js');
var BigInteger = require('./third_party/BigInteger.js');

/**
 * @constructor
 * @class Handles the connection establishment to other nodes as
 * well as joining a network.
 */
var ConnectionManager = function() {
    if (!(this instanceof ConnectionManager)) {
        return new ConnectionManager();
    }
    this._pending = {};
    this._pcoptions = {
        iceServers: [{
            //"url": "stun:stun.l.google.com:19302"
            "url": "stun:localhost"
        }]
    };
    return this;
};

ConnectionManager.prototype = {

    utils: {
        /**
         * Returns a list of field values of the given field in the given SDP.
         */
        findInSDP: function(sdp, field) {
            var result = [];
            sdp.split('\r\n').forEach(function(line) {
                if (line.match(new RegExp("^" + field + "="))) {
                    result.push(line.split("=", 2)[1]);
                }
            });
            return result;
        },

        /**
         * Returns the session ID contained in the given SDP. This ID is used
         * for glare handling.
         */
        findSessionId: function(sdp) {
            return parseInt(this.findInSDP(sdp, "o")[0].split(" ")[1], 10);
        },
    },

    /**
     * Connects this instance to the P2P network by establishing a DataChannel
     * connection to an arbitrary peer.
     *
     * @param router {Router} used for delivering the initial offer.
     * @param successCallback {Function} called when a connection has been established
     * and the peer is ready to send/receive data.
     * @param errorCallback {Function} called when the connection could not be
     * established.
     */
    bootstrap: function(router, successCallback, errorCallback) {
        this._router = router;
        router.registerDeliveryCallback('signaling-protocol', this._onMessage.bind(this));
        this.connect("*", function(err, peer) {
            if (err) {
                if (err !== "Offer denied") {
                    errorCallback(err);
                    return;
                } else {
                    successCallback();
                    return;
                }
            }
            this._router.addPeer(peer, function(err) {
                if (err) {
                    errorCallback(err);
                    return;
                }
                successCallback();
            });
        }.bind(this));
    },

    /**
     * Creates a DataChannel connection to the given peer.
     *
     * @param to ID of the remote peer
     */
    connect: function(to, callback) {
        var pc = new RTCPeerConnection(this._pcoptions);
        var dc = pc.createDataChannel(null, {});
        var seqnr = Math.floor(Math.random() * 1000000);
        this._pending[seqnr] = {
            seqnr: seqnr,
            pc: pc,
            dc: dc,
            callback: callback,
        };
        pc.createOffer(this._onCreateOfferSuccess.bind(this, pc, to, this._pending[seqnr],
            callback), this._onCreateOfferError.bind(this, callback));
    },

    _onCreateOfferSuccess: function(pc, to, pendingOffer, callback, sessionDesc) {
        if (pendingOffer.drop) {
            return;
        }
        pc.onicecandidate = function(iceEvent) {
            if (pc.iceGatheringState === 'complete' || iceEvent.candidate === null) {
                // spec specifies that a null candidate means that the ice gathering is complete
                pc.onicecandidate = function() {};
                pc.createOffer(function(offer) {
                    this._router.route(to, {
                        type: 'signaling-protocol',
                        seqnr: pendingOffer.seqnr,
                        to: to.toString(),
                        from: this._router.id.toString(),
                        payload: {
                            type: "offer",
                            offer: offer
                        }
                    }, function(err) {
                        if (err) {
                            callback(err);
                        }
                    });
                }.bind(this), this._onCreateOfferError.bind(this, callback));
            }
        }.bind(this);
        pc.setLocalDescription(sessionDesc, function() {}, function(err) {
            console.error("Error setting local description", err);
        });
    },

    _onCreateOfferError: function(callback, error) {
        // TODO(max): clean up state (delete PC object etc.)
        callback(error);
    },

    _onMessage: function(msg) {
        if (msg.type !== 'signaling-protocol') {
            console.log('ConnectionManager: Discarding JSEP message because the type is unknown: ' + JSON.stringify(msg));
            return;
        }

        switch (msg.payload.type) {
            case 'offer':
                this._onReceiveOffer(msg, new BigInteger(msg.from));
                break;
            case 'answer':
                this._onReceiveAnswer(msg, new BigInteger(msg.from));
                break;
            case 'denied':
                this._onOfferDenied(msg);
                break;
            default:
                console.log('ConnectionManager: Discarding JSEP message because the type is unknown: ' + JSON.stringify(msg));
        }
    },

    _onReceiveAnswer: function(message, from) {
        var desc = message.payload.answer;
        var pending = this._pending[message.seqnr];
        if (pending === undefined) {
            return; // we haven't offered to this node, silently discard
        }
        pending.pc.setRemoteDescription(new RTCSessionDescription(desc), function() {}, function(err) {
            console.error("Error setting remote description", err);
        });
        pending.dc.onopen = function(ev) {
            // nodejs wrtc-library does not include a channel reference in `ev.target`
            var peer = new Peer(from, pending.pc, pending.dc);
            peer.sendHeartbeat(function(err) {
                if (typeof(pending.callback) !== 'function') {
                    return;
                }
                if (err) {
                    pending.callback(err);
                } else {
                    // TODO(max): would it make sense to pass the remote peer's
                    // ID to the handler?
                    pending.callback(null, peer);
                }
                delete this._pending[message.seqnr];
            }.bind(this));
        }.bind(this);
    },

    _onReceiveOffer: function(message, from) {
        var self = this;
        var desc = message.payload.offer;
        var offerId = self.utils.findSessionId(desc.sdp);
        var pc = new RTCPeerConnection(self._pcoptions);
        pc.setRemoteDescription(new RTCSessionDescription(desc), function() {}, function(err) {
            console.error("could not set remote description", err);
        });
        if (self._pending[message.seqnr]) {
            self._pending[message.seqnr].pc = pc;
        }
        pc.ondatachannel = function(ev) {
            ev.channel.onopen = function(ev2) {
                // nodejs wrtc-library does not include a channel reference in `ev2.target`
                var peer = new Peer(from, pc, ev.channel);
                peer.sendHeartbeat(function(err) {
                    if (err) {
                        self._pending[message.seqnr].callback(err);
                    } else {
                        self._router.addPeer(peer, function(err) {
                            if (self._pending[message.seqnr]) {
                                if (typeof(self._pending[message.seqnr].callback) === 'function') {
                                    self._pending[message.seqnr].callback(err, peer);
                                }
                                delete self._pending[message.seqnr];
                            }
                        });
                    }
                });
            };
        };
        pc.createAnswer(self._onCreateAnswerSuccess.bind(self, from, pc, message.seqnr), self._onCreateAnswerError.bind(self));
    },

    _onCreateAnswerSuccess: function(to, pc, seqnr, sessionDesc) {
        pc.onicecandidate = function(iceEvent) {
            if (pc.iceGatheringState === 'complete' || iceEvent.candidate === null) {
                // spec specifies that a null candidate means that the ice gathering is complete
                pc.onicecandidate = function() {};
                pc.createAnswer(function(answer) {
                    this._router.route(to, {
                        type: 'signaling-protocol',
                        seqnr: seqnr,
                        to: to.toString(),
                        from: this._router.id.toString(),
                        payload: {
                            type: "answer",
                            answer: answer
                        }
                    }, function(err) {
                        if (err) {
                            console.log(err);
                        }
                    });
                }.bind(this), this._onCreateAnswerError.bind(this));
            }
        }.bind(this);
        pc.setLocalDescription(new RTCSessionDescription(sessionDesc), function() {}, function(err) {
            console.error("Error setting local description", err);
        });
    },

    _onCreateAnswerError: function(error) {
        console.log(error);
    },

    /**
     * The server denies offers when only one peer is connected since there is
     * no other peer that could answer the offer. In that case the first peer
     * just has to sit and wait for an offer. Eventually the successCallback is
     * called.
     */
    _onOfferDenied: function(message) {
        this._pending[message.seqnr].callback("Offer denied");
        delete this._pending[message.seqnr];
    },

};

if (typeof(module) !== 'undefined') {
    module.exports = ConnectionManager;
}
