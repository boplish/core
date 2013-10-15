var assert = require('should');
var Router = require('../js/router.js');
var Peer = require('../js/peer.js');
var sinon = require('sinon');
var RTCPeerConnection = require('./adapter-mock.js').RTCPeerConnection;
var DataChannel = require('./adapter-mock.js').DataChannel;

describe('Router', function(){
    describe('#constructor()', function(){
        it('should return an instance', function(){
            var router = new Router('1', {}, null);
            router.should.be.an.instanceof(Router);
        });
        it('should set the ID correctly', function() {
            var router = new Router('1', {}, null);
            router.should.have.property('_id', '1');
        });
    });
    describe('#addPeer()', function(){
        it('should add a peer to the routing table', function(){
            var router = new Router('1', {});
            var peer = new Peer('2', sinon.stub(new RTCPeerConnection()), sinon.stub(new DataChannel()));
            router.addPeer(peer);
            router.should.have.property('_peerTable');
            Object.keys(router._peerTable).should.have.length(1);
        });
        it('should discover neighbors from 1st peer', function(){
            var router = new Router('1', {});
            var dc = new DataChannel();
            var stub = sinon.stub(dc, 'send');
            var peer1 = new Peer('2', sinon.stub(new RTCPeerConnection()), dc);
            var peer2 = new Peer('3', sinon.stub(new RTCPeerConnection()), sinon.stub(new DataChannel()));
            router.addPeer(peer1);
            router.addPeer(peer2);

            sinon.assert.calledOnce(stub);
        });
    });
    describe('#getPeerIds()', function(){
        it('should return a list of all peer ids in the routing table', function(){
            var router = new Router('1', {});
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
    describe('#removePeer()', function(){
        it('should remove a peer from the routing table', function(){
            var router = new Router('1', {});
            var peer = new Peer('2', sinon.stub(new RTCPeerConnection()), sinon.stub(new DataChannel()));
            router.removePeer(peer);
            router.should.have.property('_peerTable');
            Object.keys(router._peerTable).should.have.length(0);
            router.addPeer(peer);
        });
    });
    describe('#registerDeliveryCallback()', function(){
        it('should register a callback function', function(){
            var router = new Router('1', {});
            router.registerDeliveryCallback('test', function(){});
            router._messageCallbacks.should.have.property('test');
            Object.keys(router._messageCallbacks).should.have.length(3);
        });
    });
    describe('#route()', function(){
        it('should deliver messages directed to this id locally by calling `deliver()`', function(done){
            var router = new Router('1', {});
            var spy = sinon.spy(router, 'deliver');
            var testMsg = {
                data: 'test'
            };
            router.registerDeliveryCallback('test', function(msg) {
                sinon.assert.calledOnce(spy);
                sinon.assert.calledWith(spy, {
                    from: router._id,
                    to: router._id,
                    type: 'test',
                    payload: msg
                });
                done();
            });
            router.route(router._id, 'test', testMsg);
        });
        it('should route messages directed to a remote peer', function(){
            var router = new Router('1', {});
            var dc = new DataChannel();
            var stub = sinon.stub(dc, 'send');
            var peer = new Peer('2', sinon.stub(new RTCPeerConnection()), dc);
            router.addPeer(peer);
            var testMsg = {
                data: 'xyz',
            };
            router.route('2', 'test', testMsg);
            // once for discovery, twice for actual routing of the msg
            sinon.assert.calledTwice(stub);
        });
    });
    describe('#deliver()', function(){
        it('should be called when an incoming message is directed to this peer', function(done) {
            var router = new Router('1', {});
            var spy = sinon.spy(router, 'deliver');
            var testMsg = {
                data: 'test'
            };
            router.registerDeliveryCallback('test', function(msg){
                sinon.assert.calledOnce(spy);
                sinon.assert.calledWith(spy, {
                    from: router._id,
                    to: router._id,
                    type: 'test',
                    payload: msg
                });
                done();
            });
            router.route(router._id, 'test', testMsg);
        });
        it('should be able to determine the type of a incoming message and forward to the corresponding callback', function(done){
            var router = new Router('1', {});
            var spy = sinon.spy(router, 'deliver');
            var testMsg1 = {
                data: 'an offer message'
            };
            var testMsg2 = {
                data: 'some discovery msg'
            };
            router.registerDeliveryCallback('offer', function(msg){
                sinon.assert.callCount(spy, 1);
                sinon.assert.calledWith(spy, {
                    from: router._id,
                    to: router._id,
                    payload: msg,
                    type: 'offer'
                });
            });
            router.registerDeliveryCallback('discovery', function(msg){
                sinon.assert.callCount(spy, 2);
                sinon.assert.calledWith(spy, {
                    from: router._id,
                    to: router._id,
                    type: 'discovery',
                    payload: msg
                });
                done();
            });
            router.route(router._id, 'offer', testMsg1);
            router.route(router._id, 'discovery', testMsg2);
        });
    });
    describe('#neighbor discovery', function(){
        it('should call the answer callback when an discovery answer is received', function(){
            var router = new Router('1', {});
            var stub = sinon.stub(router._messageCallbacks, 'discovery-answer');
            var fakeDiscoveryAnswerMessage = {
                payload: {ids:[0,1]}
            };
            router.route(router._id, 'discovery-answer', fakeDiscoveryAnswerMessage);

            sinon.assert.calledOnce(stub);
            sinon.assert.calledWith(stub, fakeDiscoveryAnswerMessage);
        });
        it('should call the request callback when an request message is received', function(){
            var router = new Router('1', {});
            var stub = sinon.stub(router._messageCallbacks, 'discovery-request');

            router.route(router._id, 'discovery-request', '');

            sinon.assert.calledOnce(stub);
            sinon.assert.calledWith(stub, '');
        });
        it('should call an error callback when no answer is received in time');
    });
});
