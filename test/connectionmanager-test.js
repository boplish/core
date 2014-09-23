/* jshint expr: true */

var assert = require("should");
require('../js/third_party/sha1.js');
var Mocks = require('./adapter-mock.js');
var sinon = require('sinon');
var ConnectionManager = require('../js/connectionmanager.js');

var RouterAPI = {
    registerDeliveryCallback: function() {},
    route: function() {},
    id: function() {}
};

describe('ConnectionManager', function() {
    var cm;

    beforeEach(function() {
        cm = new ConnectionManager();
    }),

    describe('#constructor()', function() {
        it('should return an instance', function() {
            cm.should.be.an.instanceof(ConnectionManager);
            cm = ConnectionManager();
            cm.should.be.an.instanceof(ConnectionManager);
        });
        it('should set the correct state', function() {
            cm.should.have.property('_state', 'uninitialized');
        });
    });
    describe('#bootstrap()', function() {
        it('should register the correct callbacks', function() {
            var mockRouter = sinon.mock(RouterAPI);
            mockRouter.expects("registerDeliveryCallback").withArgs('signaling-protocol');
            cm.bootstrap(RouterAPI);
            mockRouter.restore();
        });
        it('should route the initial offer', function() {
            var mockRouter = sinon.mock(RouterAPI);
            mockRouter.expects('route').once();
            cm.bootstrap(RouterAPI);
            mockRouter.restore();
        });
        it('should create the correct offer packet', function(done) {
            var router = {
                id: function() {
                    return 1;
                },
                registerDeliveryCallback: function() {},
                route: function(to, msg) {
                    to.should.equal('*');
                    msg.type.should.equal('signaling-protocol');
                    msg.should.have.property('payload');
                    msg.payload.should.have.property('type', 'offer');
                    msg.payload.offer.should.have.property('sdp');
                    done();
                }
            };
            cm.bootstrap(router);
        });
        it('should set the correct state', function(done) {
            var router = {
                id: function() {
                    return 1;
                },
                registerDeliveryCallback: function() {},
                route: function() {
                    cm.should.have.property('_state', 'bootstrapping');
                    done();
                }
            };
            cm.bootstrap(router);
        });
        it('should not allow being called twice', function(done) {
            var router = {
                id: function() {
                    return 1;
                },
                registerDeliveryCallback: function() {},
                route: function() {},
            };
            cm.bootstrap(router);
            cm.bootstrap(router, null, function() {
                done();
            });
        });
        it('should connect two peers on bootstrap', function() {
            var sigch1 = {
                send: function(data) {
                    data.should.have.property('from', router1.id);
                    if (data.type === "signaling-protocol" && data.payload.type === "offer") {
                        sigch1.onmessage({
                            data: JSON.stringify({
                                to: router1.id,
                                from: router2.id,
                                type: "signaling-protocol",
                                payload: {
                                    type: "denied"
                                }
                            })
                        });
                        return;
                    }
                    sigch2.onmessage({
                        data: JSON.stringify(data)
                    });
                },
            };
            var sigch2 = {
                send: function(data) {
                    data.should.have.property('from', router2.id);
                    data.should.have.property('to', '*');
                    sigch1.onmessage({
                        data: JSON.stringify(data)
                    });
                },
            };
            var cm1 = new ConnectionManager();
            var router1 = new Mocks.MockRouter(1, sigch1, cm1);
            var cm2 = new ConnectionManager();
            var router2 = new Mocks.MockRouter(2, sigch2, cm2);
            cm1.bootstrap(router1, function() {}, function() {});
            cm2.bootstrap(router2, function() {}, function() {});
            var ev = {
                channel: {}
            };
            cm1._bootstrap.pc.ondatachannel(ev);
            ev.channel.onopen();
            cm2._bootstrap.dc.onopen();
            router1.should.have.property("_peer");
            router1._peer.should.have.property("id").equal(router2.id);
            router2._peer.should.have.property("id").equal(router1.id);
        });
    });
});
