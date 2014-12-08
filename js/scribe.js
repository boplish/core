/** @fileOverview Scribe ALM */

var BigInteger = require('./third_party/BigInteger.js');
var Sha1 = require('./third_party/sha1.js');

var scribeConfig = require('./config.js').scribe;

var Scribe = function(router) {
    if (!(this instanceof Scribe)) {
        return new Scribe(router);
    }
    this._router = router;
    this._messageTypes = {
        CREATE: 'CREATE',
        LEAVE: 'LEAVE',
        SUBSCRIBE: 'SUBSCRIBE',
        PUBLISH: 'PUBLISH',
        DATA: 'DATA'
    };
    this._subscriptions = {}; // [groupHash][member]
    this._mySubscriptions = {}; // [groupHash]
    this._createdGroups = {}; // [groupHash]
    this._router.registerDeliveryCallback('bopscribe-protocol', this._onmessage.bind(this));
    this._router.registerInterceptor(this._onRouteIntercept.bind(this));
    this._refreshInterval = scribeConfig.refreshInterval || 5000; // ms
    setInterval(this.maintain.bind(this), this._refreshInterval);
};

Scribe.prototype = {
    maintain: function() {
        var self = this;
        // create groups periodically
        for (var grpHashStr in self._createdGroups) {
            self.create(self._createdGroups[grpHashStr], function(err, groupId) {
                if (err) {
                    console.log('could not re-create group: ' + self._createdGroups[grpHashStr] + err);
                }
            });
        }
        // remove old subscriptions
        for (var group in self._subscriptions) {
            for (var memberId in self._subscriptions[group]) {
                if (Date.now() - self._subscriptions[group][memberId].added >= self._refreshInterval * 1.5) {
                    delete self._subscriptions[group][memberId];
                }
            }
        }
        // re-subscribe to keep me in remote subscriber list
        for (var myGrpHashStr in self._mySubscriptions) {
            self.subscribe(self._mySubscriptions[myGrpHashStr], function(err, groupId) {
                if (err) {
                    console.log('could not re-subscribe to group' + self._mySubscriptions[myGrpHashStr] + err);
                }
            });
        }
    },
    _getSubscriptions: function() {
        var self = this;
        var arr = [];
        for (var group in self._subscriptions) {
            arr.push(self._mySubscriptions[group]);
        }
        return arr;
    },
    getMySubscriptions: function() {
        var self = this;
        var arr = [];
        for (var group in self._subscriptions) {
            for (var subId in self._subscriptions[group]) {
                if (subId === self._router.id.toString()) {
                    var groupname = self._mySubscriptions[group];
                    if (groupname) { // group might not yet be removed 
                        arr.push(groupname);
                    }
                }
            }
        }
        return arr;
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
            } else if (protoPayload.type === self._messageTypes.LEAVE) {
                // child leaves a group. propagate or stop
                return self._handleLeave(msg, next);
            }
        }
        return next(null, msg);
    },
    _onmessage: function(msg) {
        var self = this;
        if (!msg || (msg.type !== 'bopscribe-protocol')) {
            return console.log('Scribe: Discarding message because the type is unknown', msg);
        } else if (msg.payload.type !== self._messageTypes.DATA) {
            return console.log('Scribe: This message should not have gotten here', msg);
        }
        self._handleMessage(msg.payload);
    },
    _send: function(to, msg, cb) {
        var self = this;
        if (!to || !msg || !cb) {
            throw Error('Malformed send request');
        }
        // fit group id into key space
        to = to.mod(BigInteger(2).pow(self._router._m));
        self._router.route(to, {
            from: self._router.id,
            type: 'bopscribe-protocol',
            payload: msg
        }, cb);
    },
    remove: function(groupId, cb) {
        // @todo: remove key from dht
        var self = this;
        var hash = Sha1.bigIntHash(groupId).mod(BigInteger(2).pow(self._router._m));
        if (this._createdGroups[hash]) {
            delete this._createdGroups[hash];
            return cb(null, groupId);
        } else {
            return cb('Could not remove; we did not create group: ' + groupId);
        }
    },
    create: function(groupId, cb) {
        var self = this;
        var hash = Sha1.bigIntHash(groupId).mod(BigInteger(2).pow(self._router._m));
        self._router.put(hash, {
            groupId: groupId,
            creator: self._router.id.toString(),
            createdOn: Date.now()
        }, function(err, res) {
            if (!err) {
                self._createdGroups[hash.toString()] = groupId;
                cb(null, groupId);
            } else {
                cb('Could not create the group: ' + err);
            }
        });
    },
    leave: function(groupId, cb) {
        var self = this;
        var hash = Sha1.bigIntHash(groupId).mod(BigInteger(2).pow(self._router._m));
        var hashStr = hash.toString();

        // i want to leave the group
        if (self._subscriptions[hashStr]) {
            delete self._mySubscriptions[hashStr];
        } else {
            return cb('Not a member of group: ' + groupId);
        }

        self._send(hash, {
            type: self._messageTypes.LEAVE,
            peerId: self._router.id.toString()
        }, function(err, msg) {
            if (err) {
                return cb(err);
            } else {
                cb(null, groupId);
            }
        });
    },
    publish: function(groupId, msg, cb) {
        var self = this;
        if (typeof(cb) !== 'function') {
            throw new Error('Callback not specified');
        } else if (!groupId) {
            // @todo: check if groupId is a valid bopuri
            return cb('Discarding message as no groupId has been specified');
        } else if (!msg) {
            return cb('Discarding empty message');
        }
        var groupHash = Sha1.bigIntHash(groupId);
        self._send(groupHash, {
            type: self._messageTypes.PUBLISH,
            payload: msg
        }, function(err, msg) {
            if (err) {
                return cb(err);
            } else {
                cb(null, groupId);
            }
        });
    },
    subscribe: function(groupId, cb) {
        var self = this;
        if (typeof(cb) !== 'function') {
            throw new Error('Callback not specified');
        } else if (!groupId) {
            // @todo: check if groupId is a valid bopuri
            return cb('Discarding message as no groupId has been specified');
        }
        var peerId = self._router.id;
        var groupHash = Sha1.bigIntHash(groupId).mod(BigInteger(2).pow(self._router._m));

        self._send(groupHash, {
            type: self._messageTypes.SUBSCRIBE,
            groupId: groupId.toString(),
            from: peerId.toString()
        }, function(err, msg) {
            if (err) {
                return cb(err);
            } else {
                self._mySubscriptions[groupHash] = groupId;
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
            protoPayload.from = self._router.id.toString();
            next(null, msg, false);
        } else {
            // we are the rendezvous point - drop message
            // console.log('We are the rendezvous point for group %s', groupHash.toString());
            next(null, msg, true);
        }
    },
    _handlePublish: function(msg, next) {
        var self = this;
        var to = msg.to;
        var routerPayload = msg.payload;
        var protoPayload = routerPayload.payload;

        var groupHash = new BigInteger(to);
        // @todo: is the publisher authorized?

        // drop message, we respond with a `_messageTypes.DATA`
        next(null, msg, true);

        if (self._subscriptions[groupHash] && Object.keys(self._subscriptions[groupHash]).length <= 0) {
            return console.log('no subscribers for', groupHash.toString());
        }
        self._send(self._router.id, {
            type: self._messageTypes.DATA,
            groupHash: groupHash.toString(),
            payload: protoPayload.payload
        }, function(err, msg) {
            if (err) {
                console.log('Rendezvous point could not send message: ' + err);
            }
        });
    },
    _handleLeave: function(msg, next) {
        var self = this;
        var to = msg.to;
        var routerPayload = msg.payload;
        var protoPayload = routerPayload.payload;
        var groupHash = new BigInteger(to);
        var groupHashStr = groupHash.toString();
        var peerIdStr = protoPayload.peerId;

        // remove leaver
        if (self._subscriptions[groupHashStr]) {
            delete self._subscriptions[groupHashStr][peerIdStr];
        }

        // propagate leave if no subscribers are left and we are not the rendezvous point
        if (!self._subscriptions[groupHashStr] || Object.keys(self._subscriptions[groupHashStr]).length <= 0) {
            // cleanup group
            delete self._subscriptions[groupHashStr];
            if (!self._router._localNode.responsible(groupHash)) {
                return next(null, msg, false);
            }
        }
        // we still have some subscribers or we are the root. consume leave
        return next(null, msg, true);
    },
    _handleMessage: function(msg) {
        var self = this;
        var payload = msg.payload;
        var groupHashStr = msg.groupHash;

        // propagate message subscribers of the group
        for (var index in self._subscriptions[groupHashStr]) {
            var peerId = self._subscriptions[groupHashStr][index].peerId;
            if (peerId.equals(self._router.id)) {
                // its for me, deliver to application
                try {
                    self.onmessage(self._mySubscriptions[groupHashStr], payload);
                } catch (e) {
                    console.log('BOPscribe: Could not deliver message to subscriber ', msg, e);
                }
            } else {
                self._send(peerId, msg, function(err) {
                    if (err) {
                        console.log('BOPscribe: Error sending message to a subscriber', msg, err);
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
