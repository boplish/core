var assert = require("should");
var adapter = require('./adapter-mock.js');

describe('Adapter-Mock', function(){
    var rtc1, rtc2, desc1, desc2, dc1, dc2;

    describe('RTCPeerConnection', function(){
        describe('Peer1#constructor', function(){
            it('should return an instance', function(){
                rtc1 = new adapter.RTCPeerConnection({});
                rtc1.should.instanceof(adapter.RTCPeerConnection);
            });
        });
        describe('Peer1#createOffer', function(){
            it('should return an offer', function(){
                rtc1.createOffer(function(desc){
                    desc1 = desc;
                    desc1.obj.should.equal(rtc1);
                });
            });
        });
        describe('Peer1#setLocalDescription', function(){
            it('should set the local mocked channel', function(){
                rtc1.setLocalDescription(desc1);
                assert.ok(true);
            });
        });

        rtc2 = new adapter.RTCPeerConnection({});
        describe('Peer2#setRemoteDescription', function(){
            it('should connect', function(){
                rtc2.setRemoteDescription(new adapter.RTCSessionDescription(desc1));
                rtc2.should.have.property('remote', rtc1);
            });
        });
        describe('Peer2#createAnswer', function(){
            it('should create an answer', function(done){
                rtc2.createAnswer(function(desc){
                    desc2 = desc;
                    desc2.obj.should.equal(rtc2);
                    done();
                });
            });
        });
        describe('Peer2#setLocalDescription', function(){
            it('should set the local mocked channel', function(){
                rtc2.setLocalDescription(desc2);
                assert.ok(true);
            });
        });
        describe('Peer1#setRemoteDescription', function(){
            it('should set the remote mocked channel and connect the two Peers', function(){
                rtc1.setRemoteDescription(new adapter.RTCSessionDescription(desc2));
                rtc1.should.have.property('remote', rtc2).and.should.not.equal(rtc1);
            });
        });
        describe('#createDataChannel', function(){
            it('should create a DataChannel between the two peers', function(){
                dc2 = rtc2.createDataChannel('dcLabel');
                dc1 = rtc1.createDataChannel('dcLabel');
                dc1.should.not.equal(dc2);
            });
            it('should be able to send a message from peer1 to peer2', function(done){
                var testmsg = 'testmsg from peer1 to peer2';
                dc1.remote.should.equal(rtc2);
                rtc1.dataChannels.forEach(function(val){
                    if (val.label === 'dcLabel') {
                        val.should.equal(dc1);
                    }
                });
                dc2.onmessage = function(msg) {
                    msg.should.equal(testmsg);
                    done();
                };
                dc1.send(testmsg);
            });
            it('should be able to send a message from peer2 to peer1', function(done){
                var testmsg = 'testmsg from peer2 to peer1';
                dc2.remote.should.equal(rtc1);
                rtc2.dataChannels.forEach(function(val){
                    if (val.label === 'dcLabel') {
                        val.should.equal(dc2);
                    }
                });
                dc1.onmessage = function(msg) {
                    msg.should.equal(testmsg);
                    done();
                };
                dc2.send(testmsg);
            });
        });
        describe('create DataChannel before PeerConnection', function(){
            var rtc1, rtc2, desc1, desc2, dc1, dc2;

            it('should initiate the connection after adding DataChannels', function(){
                rtc1 = new adapter.RTCPeerConnection({});
                rtc2 = new adapter.RTCPeerConnection({});
                dc1 = rtc1.createDataChannel('test');
                dc2 = rtc2.createDataChannel('test');

                rtc1.createOffer(function(desc){
                    desc1 = desc;
                    rtc1.setLocalDescription(desc1);
                });
                rtc2.setRemoteDescription(new adapter.RTCSessionDescription(desc1));
                rtc2.createAnswer(function(desc){
                    desc2 = desc;
                    rtc2.setLocalDescription(desc2);
                });
                rtc1.setRemoteDescription(new adapter.RTCSessionDescription(desc2));
            });
            it('should be able to send a message from peer1 to peer2', function(done){
                var testmsg = 'testmsg from peer1 to peer2';
                dc1.remote.should.equal(rtc2);
                rtc1.dataChannels.forEach(function(val){
                    if (val.label === 'dcLabel') {
                        val.should.equal(dc1);
                    }
                });
                dc2.onmessage = function(msg) {
                    msg.should.equal(testmsg);
                    done();
                };
                dc1.send(testmsg);
            });
            it('should be able to send a message from peer2 to peer1', function(done){
                var testmsg = 'testmsg from peer2 to peer1';
                dc2.remote.should.equal(rtc1);
                rtc2.dataChannels.forEach(function(val){
                    if (val.label === 'dcLabel') {
                        val.should.equal(dc2);
                    }
                });
                dc1.onmessage = function(msg) {
                    msg.should.equal(testmsg);
                    done();
                };
                dc2.send(testmsg);
            });
        });
        describe('open multiple DataChannel before PeerConnection', function(){

        });
    });
});
