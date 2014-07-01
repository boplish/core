var assert = require("should");
require('./adapter-mock.js');
require('../js/third_party/sha1.js');
var sinon = require('sinon');
var ConnectionManager = require('../js/connectionmanager.js');

var RouterAPI = {
    registerDeliveryCallback: function() {},
    route: function() {}
};

describe('ConnectionManager', function() {
    describe('#constructor()', function() {
        it('should return an instance', function() {
            var pm = new ConnectionManager();
            pm.should.be.an.instanceof(ConnectionManager);
            pm = ConnectionManager();
            pm.should.be.an.instanceof(ConnectionManager);
        });
        it('should set the correct state', function() {
            var cm = new ConnectionManager();
            cm.should.have.property('_state', 'uninitialized');
        });
    });
    describe('#bootstrap()', function() {
        it('should register the correct callbacks', function() {
            var cm = new ConnectionManager();

            var mockRouter = sinon.mock(RouterAPI);
            mockRouter.expects("registerDeliveryCallback").withArgs('signaling-protocol');
            cm.bootstrap(RouterAPI);
            mockRouter.restore();
        });
        it('should route the initial offer', function() {
            var cm = new ConnectionManager();
            var mockRouter = sinon.mock(RouterAPI);
            mockRouter.expects('route').once();
            cm.bootstrap(RouterAPI);
        });
        it('should create the correct offer packet', function(done) {
            var cm = new ConnectionManager();
            var router = {
                registerDeliveryCallback: function() {},
                route: function(to, type, msg) {
                    to.should.equal('*');
                    type.should.equal('signaling-protocol');
                    msg.should.have.property('type', 'offer');
                    msg.should.have.property('sdp');
                    done();
                }
            };
            cm.bootstrap(router);
        });
        it('should set the correct state', function(done) {
            var cm = new ConnectionManager();
            var router = {
                registerDeliveryCallback: function() {},
                route: function() {
                    cm.should.have.property('_state', 'bootstrapping');
                    done();
                }
            };
            cm.bootstrap(router);
        });
        it('should not allow being called twice', function(done) {
            var cm = new ConnectionManager();
            var router = {
                registerDeliveryCallback: function() {},
                route: function() {},
            };
            cm.bootstrap(router);
            cm.bootstrap(router, null, function() {
                done();
            });
        });
    });
});
/*
        it('should connect two peers on bootstrap', function(done) {
            var sigch1 = {
                send: function(data) {
                    data.should.have.property('from', router1.id);
                    sigch2.onmessage({data: data});
                },
            };
            var sigch2 = {
                send: function(data) {
                    data.should.have.property('from', router2.id);
                    data.should.have.property('to', 1);
                    sigch1.onmessage({data: data});
                    assert.ok(pm1._connected);
                    done();
                },
            };
            var pm1 = new ConnectionManager();
            var router1 = new MockRouter(sigch1, pm1);
            var pm2 = new ConnectionManager();
            var router2 = new MockRouter(sigch2, pm2);
            pm1.bootstrap(router1, function(){}, function(){});

        });
        it('should reset if the offer is denied', function(){
            var pm = new ConnectionManager(new MockSignalingChannel(true), new MockRouter(1));
            var spy = sinon.spy(pm, '_onOfferDenied');
            pm.connect(function() {});
            sinon.assert.calledOnce(spy);
            pm.should.have.property('_pc');
            pm._pc.should.be.an.instanceof(RTCPeerConnection);
            pm.should.have.property('_dc', null);
        });
        it('should set the DataChannel', function() {
            var pm = new ConnectionManager(
                new MockSignalingChannel(),
                {
                    addPeer: function(peer) {
                        peer.should.have.property('peerConnection');
                        peer.should.have.property('dataChannel');
                    }
                });
            pm.connect(function() {});
        });
        it('should set connected state to true', function(done) {
            var pm = new ConnectionManager(new MockSignalingChannel(), new MockRouter(1));
            pm.connect(function() {
                assert.ok(pm._connected);
                done();
            });
        });
*/
