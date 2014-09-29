/** @fileOverview Mid-level connection broking and signaling functionality. */

var Peer = require('./peer.js');
var BigInteger = require('./third_party/BigInteger.js');

/**
 * @constructor
 * @class Handles the connection establishment to other nodes as
 * well as joining a network (bootstrapping).
 */
var ConnectionManager = function() {
    if (!(this instanceof ConnectionManager)) {
        return new ConnectionManager();
    }
    this._bootstrap = null;
    this._pending = {};
    this._pcoptions = {
        iceServers: [{
            //"url": "stun:stun.l.google.com:19302"
            "url": "stun:localhost"
        }]
    };
    //possible states: 'uninitialized', 'bootstrapping', 'ready'
    this._state = 'uninitialized';

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
        if (this._state !== 'uninitialized') {
            errorCallback('Invalid state');
            return;
        }
        this._state = 'bootstrapping';
        this._router = router;
        var pc = new RTCPeerConnection(this._pcoptions);
        var to = '*';
        this._bootstrap = {
            pc: pc,
            dc: pc.createDataChannel(null, {}),
            onsuccess: successCallback,
            onerror: errorCallback,
        };
        router.registerDeliveryCallback('signaling-protocol', this._onMessage.bind(this));
        pc.createOffer(this._onCreateOfferSuccess.bind(this, pc, to, this._bootstrap, errorCallback),
            this._onCreateOfferError.bind(this, errorCallback));
    },

    /**
     * Creates a DataChannel connection to the given peer.
     *
     * @param to ID of the remote peer
     */
    connect: function(to, callback) {
        if (this._state !== 'ready') {
            callback('Invalid state');
            return;
        }
        var pc = new RTCPeerConnection(this._pcoptions);
        var dc = pc.createDataChannel(null, {});
        var seqnr = Math.floor(Math.random() * 1000000);
        this._pending[seqnr] = {
            seqnr: seqnr,
            pc: pc,
            dc: dc,
            callback: callback,
        };
        console.log("connecting to " + to.toString() + " with seqnr " + seqnr);
        pc.createOffer(this._onCreateOfferSuccess.bind(this, pc, to, this._pending[seqnr],
            callback), this._onCreateOfferError.bind(this, callback));
    },

    _onCreateOfferSuccess: function(pc, to, pendingOffer, callback, sessionDesc) {
        console.log("created offer for " + to.toString() + " with seqnr " + pendingOffer.seqnr);
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
                            console.log(err);
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
                this._onOfferDenied(msg.payload, msg.from);
                break;
            default:
                console.log('ConnectionManager: Discarding JSEP message because the type is unknown: ' + JSON.stringify(msg));
        }
    },

    _onReceiveAnswer: function(message, from) {
        var desc = message.payload.answer;
        if (this._state === 'bootstrapping') {
            // TODO(max): check if we actually have a pending PC and ``drop'' is not set (glare).
            this._bootstrap.pc.setRemoteDescription(new RTCSessionDescription(desc), function() {}, function(err) {
                console.error("Error setting remote description", err);
            });
            this._bootstrap.dc.onopen = function(ev) {
                // nodejs wrtc-library does not include a channel reference in `ev.target`
                this._state = 'ready';
                var peer = new Peer(from, this._bootstrap.pc, this._bootstrap.dc);
                this._router.addPeer(peer, function(err) {
                    if (err) {
                        this._bootstrap.onerror(err);
                    } else {
                        this._bootstrap.onsuccess();
                    }
                    this._bootstrap = null;
                }.bind(this));
            }.bind(this);
        } else {
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
                if (typeof(pending.callback) === 'function') {
                    // TODO(max): would it make sense to pass the remote peer's
                    // ID to the handler?
                    pending.callback(null, peer);
                }
                delete this._pending[message.seqnr];
            }.bind(this);
        }
    },

    _onReceiveOffer: function(message, from) {
        var desc = message.payload.offer;
        var offerId = this.utils.findSessionId(desc.sdp);

        if (this._state === 'bootstrapping') {
            if (this._bootstrap.pc.remoteDescription !== null) {
                // we already have a bootstrap peer
                return;
            }
            if (offerId > this._bootstrap.offerId) {
                // discard our offer and accept this one
                var newBootstrap = {
                    pc: new RTCPeerConnection(this._pcoptions),
                    onsuccess: this._bootstrap.onsuccess,
                    onerror: this._bootstrap.onerror,
                };
                // cancel all actions on the old object
                // FIXME(max): setting ``drop'' here makes no sense since it's overwritten in the next line.
                this._bootstrap.drop = true;
                this._bootstrap = newBootstrap;
            } else {
                // silently discard this offer
                return;
            }
            this._bootstrap.pc.setRemoteDescription(new RTCSessionDescription(desc), function() {}, function(err) {
                console.error("Error setting remote description", err);
            });
            this._bootstrap.pc.ondatachannel = function(ev) {
                ev.channel.onopen = function(ev2) {
                    // nodejs wrtc-library does not include a channel reference in `ev2.target`
                    this._state = 'ready';
                    var peer = new Peer(from, this._bootstrap.pc, ev.channel);
                    this._router.addPeer(peer, function(err) {
                        if (err) {
                            this._bootstrap.onerror(err);
                        } else {
                            this._bootstrap.onsuccess();
                        }
                        this._bootstrap = null;
                    }.bind(this));
                }.bind(this);
            }.bind(this);
            this._bootstrap.pc.createAnswer(this._onCreateAnswerSuccess.bind(this, from, this._bootstrap.pc, null), this._onCreateAnswerError.bind(this));
        } else {
            var pc = new RTCPeerConnection(this._pcoptions);
            pc.setRemoteDescription(new RTCSessionDescription(desc), function() {}, function(err) {
                console.error("could not set remote description", err);
            });
            if (this._pending[message.seqnr]) {
                this._pending[message.seqnr].pc = pc;
            }
            pc.ondatachannel = function(ev) {
                ev.channel.onopen = function(ev2) {
                    // nodejs wrtc-library does not include a channel reference in `ev2.target`
                    var peer = new Peer(from, pc, ev.channel);
                    this._router.addPeer(peer, function(err) {
                        if (this._pending[message.seqnr]) {
                            if (typeof(this._pending[message.seqnr].callback) === 'function') {
                                this._pending[message.seqnr].callback(err, peer);
                            }
                            delete this._pending[message.seqnr];
                        }
                    }.bind(this));
                }.bind(this);
            }.bind(this);
            pc.createAnswer(this._onCreateAnswerSuccess.bind(this, from, pc, message.seqnr), this._onCreateAnswerError.bind(this));
        }
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
    _onOfferDenied: function(desc, from) {
        if (this._state === 'bootstrapping') {
            this._bootstrap.pc = new RTCPeerConnection(this._pcoptions);
            this._bootstrap.dc = this._bootstrap.pc.createDataChannel(null, {});
            this._bootstrap.offerId = null;
            this._bootstrap.onsuccess();
            this._bootstrap.onsuccess = function() {};
        } else {
            this._pending[from].callback("Offer denied");
        }
    },

};

if (typeof(module) !== 'undefined') {
    module.exports = ConnectionManager;
}
