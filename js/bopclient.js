/** WIP */
/** @fileOverview API for application developers. */

var bowser = require('bowser');
var ConnectionManager = require('./connectionmanager.js');
var Router = require('./chord/chord.js');
var ChordNode = require('./chord/node.js');
var BigInteger = require('./third_party/BigInteger.js');
var BopURI = require('./bopuri.js');
var Scribe = require('./scribe.js');
var config = require('./config.js');
var bopclientConfig = config.bopclient;

/**
 * @constructor
 * @class This is the top-level API for BOPlish applications. It should be the
 * only interface used for interacting with the P2P network.
 * @param bootstrapHost {String} Name and port of the host running the signaling
 * server. The format is 'ws[s]://HOSTNAME[:PORT][/]'. If this is undefined or null then
 * the host of the serving application is used. Using the `wss` scheme for tls encrypted
 * communication to the `bootstrapHost` is highly recommended.
 * @param successCallback {BOPlishClient~onSuccessCallback} Called when a
 * connection to the P2P network has been established.
 * @param errorCallback {BOPlishClient~onErrorCallback} Called when a connection
 * to the P2P network could not be established (e.g. if the WebSocket connection
 * to the bootstrapHost failed.
 */

BOPlishClient = function(bootstrapHost, successCallback, errorCallback) {
    if (!(this instanceof BOPlishClient)) {
        return new BOPlishClient(bootstrapHost, successCallback, errorCallback);
    } else if (typeof(bootstrapHost) !== 'string' || typeof(successCallback) !== 'function' || typeof(errorCallback) !== 'function') {
        throw new TypeError('Not enough arguments or wrong type');
    }
    var self = this;

    // when join fails, retry after 5s
    self._joinDelay = bopclientConfig.joinDelay || 5000;
    // number of retries
    self._joinTrials = bopclientConfig.joinTrials || 3;

    var browser = bowser.browser;
    if (browser.firefox && browser.version >= 26) {
        // we are on FF
    } else if (browser.chrome && browser.version >= 33) {
        // we are on Chrome
    } else if (typeof(process) === 'object') {
        // we are on Node.js
    } else {
        errorCallback('You will not be able to use BOPlish as your browser is currently incompatible. Please use either Firefox 26 or Chrome 33 upwards.');
        return;
    }

    if (bootstrapHost.substring(bootstrapHost.length - 1, bootstrapHost.length) !== '/') { // add trailing slash if missing
        bootstrapHost += '/';
    }
    if (bootstrapHost.substring(0, 6) !== 'wss://' && bootstrapHost.substring(0, 5) !== 'ws://') { // check syntax
        errorCallback('Syntax error in bootstrapHost parameter');
        return;
    }
    var id = Router.randomId();
    var channel = new WebSocket(bootstrapHost + 'ws/' + id.toString());

    this.bopid = bopclientConfig.bopid || Math.random().toString(36).replace(/[^a-z]+/g, '') + '@id.com';

    channel.onerror = function(ev) {
        errorCallback('Failed to open connection to bootstrap server:' + bootstrapHost + ': ' + ev);
    };

    this._connectionManager = new ConnectionManager();
    this._router = new Router(id, channel, this._connectionManager);
    this._scribe = new Scribe(this._router);
    this._scribe.onmessage = this._onGroupMessage.bind(this);
    this._protocols = {};

    channel.onopen = function() {
        (function join() {
            self._connectionManager.bootstrap(self._router, _authBopId.bind(self), function(err) {
                if (--self._joinTrials >= 0) {
                    console.log('Join did not work: ', err);
                    setTimeout(join, self._joinDelay);
                } else {
                    this._router = null;
                    this._connectionManager = null;
                    errorCallback('Could not join the DHT, giving up: ' + err);
                }
            });
        })();
    };

    function _authBopId() {
        // creating a random bopid (for now) and store it in the dht
        var auth = {
            chordId: id.toString(),
            timestamp: new Date()
        };

        function errorHandler(err) {
            if (err) {
                errorCallback(err);
            }
        }
        this._router.put(this.bopid, auth, errorHandler);
        setInterval(function() {
            this._router.put(this.bopid, auth, errorHandler);
        }.bind(this), 2000);
        successCallback();
    }
};

BOPlishClient.prototype = {

    /**
     * Registers and returns an protocol-specific object that can be used by
     * application protocols to interact with the BOPlish sytem.
     * @param {String} A distinct name identifying the protocol to be registered
     * @return {Object} Object with `send` and `onmessage` properties that can be
     * used by application protocols
     */
    registerProtocol: function(protocolIdentifier) {
        var self = this;
        var protocol = {
            bopid: this.bopid,
            send: function(bopuri, msg, cb) {
                if (!msg) {
                    throw new Error('Trying to send empty message');
                }

                self._send(bopuri, protocolIdentifier, msg, cb);
            },
            group: {
                create: function(groupId, cb) {
                    var uri = BopURI.create(groupId, protocolIdentifier, '', '');
                    self._scribe.create(uri.toString(), cb);
                },
                leave: function(groupId, cb) {
                    var uri = BopURI.create(groupId, protocolIdentifier, '', '');
                    self._scribe.leave(uri.toString(), cb);
                },
                subscribe: function(groupId, cb) {
                    var uri = BopURI.create(groupId, protocolIdentifier, '', '');
                    self._scribe.subscribe(uri.toString(), cb);
                },
                publish: function(groupId, msg, cb) {
                    var uri = BopURI.create(groupId, protocolIdentifier, '', '');
                    self._scribe.publish(uri.toString(), msg, cb);
                },
                getSubscriptions: function() {
                    var groups = self._scribe.getMySubscriptions();
                    var mySubscriptions = [];
                    groups.forEach(function(item) {
                        var uri = new BopURI(item);
                        if (uri.protocol === protocolIdentifier) {
                            mySubscriptions.push(uri.uid);
                        }
                    });
                    return mySubscriptions;
                }
            }
        };
        this._router.registerDeliveryCallback(protocolIdentifier, function(msg) {
            if (typeof protocol.onmessage === "function") {
                protocol.onmessage(msg.from, msg.payload);
            }
        });
        this._protocols[protocolIdentifier] = protocol;
        return protocol;
    },

    _onGroupMessage: function(to, msg) {
        var uri = new BopURI(to);
        if (this._protocols[uri.protocol]) {
            if (typeof this._protocols[uri.protocol].group.onmessage === 'function') {
                this._protocols[uri.protocol].group.onmessage(uri.uid, msg);
            }
        }
    },

    /**
     * todo
     *
     */
    _send: function(bopid, protocolIdentifier, msg, cb) {
        msg = {
            payload: msg,
            to: bopid,
            from: this.bopid,
            type: protocolIdentifier
        };

        this._router.get(bopid, function(err, auth) {
            if (err) {
                console.log("Error resolving " + bopid, err);
                if (typeof cb === 'function') {
                    cb(err);
                }
            } else if (auth && auth.chordId) {
                this._router.route(new BigInteger(auth.chordId), msg, function(err) {
                    if (err) {
                        console.log("Error routing message to " + auth.chordId, err);
                    }
                    if (typeof cb === 'function') {
                        cb(err);
                    }
                });
            } else if (typeof cb === 'function') {
                cb(new Error('Malformed response from GET request for ' + bopid + '. Returned ' + JSON.stringify(auth)));
            }
        }.bind(this));
    },

    _get: function(hashString, cb) {
        this._router.get(hashString, cb);
    },

    _put: function(hashString, value, cb) {
        this._router.put(hashString, value, cb);
    },

    /**
     * Installs a special callback that receives all messages despite their
     * protocol.
     * @param callback {BOPlishClient~monitorCallback} Invoked on reception of a
     * message.
     */
    setMonitorCallback: function(callback) {
        this._router.registerMonitorCallback(callback);
    },

    /**
     * @return {Array} The list of all IDs of peers this peer has an open
     * connection to.
     */
    getConnectedPeers: function() {
        return this._router.getPeerIds();
    }
};

BOPlishClient.BopURI = BopURI;
BOPlishClient.config = config;
BOPlishClient.setRTTEstimator = function(estimator) {
    console.log("setting estimator to ", estimator);
    ChordNode.RTTestimator = estimator;
};

if (typeof(module) !== 'undefined') {
    module.exports = BOPlishClient;
}
