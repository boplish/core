var assert = require('should');
var Router = require('../js/router.js');
var Peer = require('../js/peer.js');
var sinon = require('sinon');
var RTCPeerConnection = require('./adapter-mock.js').RTCPeerConnection;
var DataChannel = require('./adapter-mock.js').DataChannel;
var ConnectionManager = require('../js/connectionmanager.js');

describe('Router', function() {
    var router;

    beforeEach(function() {
        router = new Router('1', {}, sinon.stub(new ConnectionManager()));
    });
    afterEach(function() {
        // restore the environment as it was before
        sinon.restore();
    });

    describe('#constructor()', function() {
        it('should return an instance', function() {
            router.should.be.an.instanceof(Router);
        });
        it('should set the ID correctly', function() {
            router.should.have.property('id', '1');
        });
    });
    describe('#addPeer()', function() {
        it('should add a peer to the routing table', function() {
            var peer = new Peer('2', sinon.stub(new RTCPeerConnection()), sinon.stub(new DataChannel()));
            router.addPeer(peer);
            router.should.have.property('_peerTable');
            Object.keys(router._peerTable).should.have.length(1);
        });
        it('should discover neighbors from 1st peer', function() {
            var dc = new DataChannel();
            var stub = sinon.stub(dc, 'send');
            var peer1 = new Peer('2', sinon.stub(new RTCPeerConnection()), dc);
            var peer2 = new Peer('3', sinon.stub(new RTCPeerConnection()), sinon.stub(new DataChannel()));
            router.addPeer(peer1);
            router.addPeer(peer2);

            sinon.assert.calledTwice(stub); // 1*heartbeat; 1*discovery
        });
    });
    describe('#getPeerIds()', function() {
        it('should return a list of all peer ids in the routing table', function() {
            var peer1 = new Peer('1', sinon.stub(new RTCPeerConnection()), sinon.stub(new DataChannel()));
            var peer2 = new Peer('abc', sinon.stub(new RTCPeerConnection()), sinon.stub(new DataChannel()));
            router.addPeer(peer1);
            router.addPeer(peer2);

            var ids = router.getPeerIds();

            ids.should.have.length(2);
            ids.should.include(peer1.id);
            ids.should.include(peer2.id);
        });
    });
    describe('#removePeer()', function() {
        it('should remove a peer from the routing table', function() {
            var peer = new Peer('2', sinon.stub(new RTCPeerConnection()), sinon.stub(new DataChannel()));
            router.addPeer(peer);

            router.removePeer(peer);

            router.should.have.property('_peerTable');
            Object.keys(router._peerTable).should.have.length(0);
        });
    });
    describe('#registerDeliveryCallback()', function() {
        it('should register a callback function', function() {
            router.registerDeliveryCallback('test', function() {});

            router._messageCallbacks.should.have.property('test');
            Object.keys(router._messageCallbacks).should.have.length(2);
        });
    });
    describe('#route()', function(done) {
        it('should deliver messages directed to this id locally by calling `deliver()`', function(done) {
            var spy = sinon.spy(router, 'deliver');
            var testMsg = {
                type: 'test',
                payload: {
                    data: 'test'
                }
            };
            router.registerDeliveryCallback('test', function(msg) {
                sinon.assert.calledOnce(spy);
                sinon.assert.calledWith(spy, {
                    from: router.id,
                    to: router.id,
                    type: 'ROUTE',
                    payload: testMsg
                });
                done();
            });
            router.route(router.id, testMsg);
        });
        it('should route messages directed to a remote peer', function() {
            var dc = new DataChannel();
            var stub = sinon.stub(dc, 'send');
            var peer = new Peer('2', sinon.stub(new RTCPeerConnection()), dc);
            router.addPeer(peer);
            var testMsg = {
                type: 'test',
                payload: {
                    data: 'test'
                }
            };
            router.route('2', testMsg);
            // once for heartbeat, twice for discovery, thrice for actual routing of the msg
            sinon.assert.calledThrice(stub);
        });
        it('should route messages to unknown peers via fallback channel', function() {
            var ws = {
                send: function() {}
            };
            var testMsg = {
                type: 'test',
                payload: {}
            };
            var stub = sinon.stub(ws, 'send');
            var router = new Router('1', ws, {});
            router.route('2', testMsg);
            sinon.assert.calledOnce(stub);
        });
    });
    describe('#deliver()', function() {
        it('should be called when an incoming message is directed to this peer', function(done) {
            var spy = sinon.spy(router, 'deliver');
            var testMsg = {
                type: 'test',
                payload: {}
            };
            router.registerDeliveryCallback('test', function(msg) {
                sinon.assert.calledOnce(spy);
                sinon.assert.calledWith(spy, {
                    from: router.id,
                    to: router.id,
                    type: 'ROUTE',
                    payload: testMsg
                });
                done();
            });
            router.route(router.id, testMsg);
        });
        it('should be able to determine the type of a incoming message and forward to the corresponding callback', function(done) {
            var spy = sinon.spy(router, 'deliver');
            var testMsg1 = {
                type: 'offer',
                payload: {}
            };
            var testMsg2 = {
                type: 'discovery',
                payload: {}
            };
            router.registerDeliveryCallback('offer', function(msg) {
                sinon.assert.callCount(spy, 1);
                sinon.assert.calledWith(spy, {
                    from: router.id,
                    to: router.id,
                    payload: testMsg1,
                    type: 'ROUTE'
                });
            });
            router.registerDeliveryCallback('discovery', function(msg) {
                sinon.assert.callCount(spy, 2);
                sinon.assert.calledWith(spy, {
                    from: router.id,
                    to: router.id,
                    type: 'ROUTE',
                    payload: testMsg2
                });
                done();
            });
            router.route(router.id, testMsg1);
            router.route(router.id, testMsg2);
        });
    });
    describe('#neighbor discovery', function() {
        it('should call the answer callback when an discovery answer is received', function() {
            var stub = sinon.stub(router._messageCallbacks, 'discovery-protocol');
            var fakeDiscoveryAnswerMessage = {
                type: 'discovery-protocol',
                payload: {
                    type: 'answer',
                    payload: {
                        ids: [0, 1]
                    }
                }
            };
            router.route(router.id, fakeDiscoveryAnswerMessage);

            sinon.assert.calledOnce(stub);
            sinon.assert.calledWith(stub, fakeDiscoveryAnswerMessage);
        });
        it('should call the request callback when an request message is received', function() {
            var stub = sinon.stub(router._messageCallbacks, 'discovery-protocol');
            var testMsg = {
                type: 'discovery-protocol',
                payload: {
                    type: 'request'
                }
            };

            router.route(router.id, testMsg);

            sinon.assert.calledOnce(stub);
            sinon.assert.calledWith(stub, testMsg);
        });
        it('should call an error callback when no answer is received in time');
    });
});
