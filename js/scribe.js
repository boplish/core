/** @fileOverview Scribe ALM */

var BigInteger = require('./third_party/BigInteger.js');
var Sha1 = require('./third_party/sha1.js');

var Scribe = function(router) {
    if (!(this instanceof Scribe)) {
        return new Scribe(router);
    }
    this._router = router;
    this._messageTypes = {
        CREATE: 'CREATE',
        REMOVE: 'REMOVE',
        SUBSCRIBE: 'SUBSCRIBE',
        PUBLISH: 'PUBLISH',
        MESSAGE: 'MESSAGE'
    };
    this._subscriptions = {};
    this._myGroups = [];
    this._router.registerDeliveryCallback('bopscribe-protocol', this._onmessage.bind(this));
    this._router.registerInterceptor(this._onRouteIntercept.bind(this));
};

Scribe.prototype = {
    getGroups: function() {
        var self = this;
        var arr = [];
        for (var prop in self._myGroups) {
            arr.push(self._myGroups[prop]);
        }
        return arr.toString();
    },
    _onRouteIntercept: function(msg, next) {
        var self = this;
        var to = msg.to;
        var routerPayload = msg.payload;
        var protoPayload = routerPayload.payload;

        if (routerPayload.type === 'bopscribe-protocol') {
            if (protoPayload.type === self._messageTypes.PUBLISH && self._router._localNode.responsible(to)) {
                // somebody publishes in a group that belongs to us
                return self._handlePublish(msg, next);
            } else if (protoPayload.type === self._messageTypes.SUBSCRIBE) {
                // somebody subscribes, intercept and add him as subscriber
                return self._handleSubscribe(msg, next);
            }
        }
        return next(null, msg);
    },
    _onmessage: function(msg) {
        var self = this;
        if (!msg || (msg.type !== 'bopscribe-protocol')) {
            console.log('Scribe: Discarding message because the type is unknown', msg);
            return;
        } else if (msg.payload.type !== self._messageTypes.MESSAGE) {
            console.log('Scribe: This message should not have gotten here', msg);
            return;
        }
        self._handleMessage(msg.payload);
    },
    _send: function(to, msg, cb) {
        var self = this;
        if (!to || !msg || !cb) {
            throw Error('Malformed send request');
        }
        self._router.route(to, {
            from: self._router._localNode.id(),
            type: 'bopscribe-protocol',
            payload: msg
        }, cb);
    },
    create: function(groupId, cb) {
        var self = this;
        var hash = Sha1.bigIntHash(groupId);
        self._router.put(hash, {
            groupId: groupId,
            creator: self._router._localNode.id().toString(),
            createdOn: Date.now()
        }, function(err, res) {
            if (!err) {
                cb(null, groupId);
            } else {
                cb('Could not create the group', err);
            }
        });
    },
    publish: function(groupId, msg, cb) {
        var self = this;
        if (typeof(cb) !== 'function') {
            throw new Error('Callback not specified');
        } else if (!groupId) {
            // @todo: check if groupId is a valid bopuri
            cb('Discarding message as no groupId has been specified');
            return;
        } else if (!msg) {
            cb('Discarding empty message');
            return;
        }
        var groupHash = Sha1.bigIntHash(groupId);
        self._send(groupHash, {
            type: self._messageTypes.PUBLISH,
            payload: msg
        }, cb);
    },
    subscribe: function(groupId, cb) {
        var self = this;
        if (typeof(cb) !== 'function') {
            throw new Error('Callback not specified');
        } else if (!groupId) {
            // @todo: check if groupId is a valid bopuri
            cb('Discarding message as no groupId has been specified');
            return;
        }
        var peerId = self._router._localNode.id();
        var groupHash = Sha1.bigIntHash(groupId);

        self._send(groupHash, {
            type: self._messageTypes.SUBSCRIBE,
            groupId: groupId.toString(),
            from: peerId.toString()
        }, function(err, msg) {
            if (err) {
                cb(err);
                return;
            } else {
                self._myGroups[groupHash] = groupId;
                cb(null, groupId);
            }
        });
    },
    _handleSubscribe: function(msg, next) {
        var self = this;
        var groupHash = new BigInteger(msg.to);
        var routerPayload = msg.payload;
        var protoPayload = routerPayload.payload;

        var from = new BigInteger(protoPayload.from);

        if (!self._subscriptions[groupHash]) {
            self._subscriptions[groupHash] = {};
        }
        self._subscriptions[groupHash][from] = {
            added: Date.now(),
            peerId: from
        };
        if (!self._router._localNode.responsible(groupHash)) {
            // propagate subscribe if i am not the rendezvous point
            protoPayload.from = self._router._localNode.id().toString();
            next(null, msg, false);
        } else {
            // we are the rendezvous point - drop message
            console.log('We are the rendezvous point for group %s', groupHash.toString());
            next(null, msg, true);
        }
    },
    _handlePublish: function(msg, next) {
        var self = this;
        var to = msg.to;
        var routerPayload = msg.payload;
        var protoPayload = routerPayload.payload;

        var groupHash = new BigInteger(to);
        //var from = new BigInteger(protoPayload.from);
        // @todo: is the publisher authorized?

        // drop message, we respond with a `_messageTypes.MESSAGE`
        next(null, msg, true);
        if (!self._subscriptions[groupHash]) {
            console.log('no subscribers for', groupHash.toString());
            return;
        }
        self._send(self._router._localNode.id(), {
            type: self._messageTypes.MESSAGE,
            groupHash: groupHash.toString(),
            payload: protoPayload.payload
        }, function(err, msg) {
            if (err) {
                console.log('Rendezvous point could not send message: ' + err);
            }
        });
    },
    _handleMessage: function(msg) {
        var self = this;
        var payload = msg.payload;
        var groupHashStr = msg.groupHash;

        // propagate message subscribers of the group
        for (var index in self._subscriptions[groupHashStr]) {
            var peerId = self._subscriptions[groupHashStr][index].peerId;
            if (peerId.equals(self._router._localNode.id())) {
                // its for me, deliver to application
                self.onmessage(self._myGroups[msg.groupHash], payload);
            } else {
                self._send(peerId, msg, function(err) {
                    if (err) {
                        console.log('error sending message to a subscriber', err);
                    }
                });
            }
        }
    },
    onmessage: function(group, msg) {
        // overwrite me
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = Scribe;
}
