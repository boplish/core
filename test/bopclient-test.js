/* jshint expr: true */

var assert = require("should");
var BOPlishClient = require('../js/bopclient.js');
var sinon = require('sinon');

describe('Application', function() {
    var bc;

    beforeEach(function() {
        bc = new BOPlishClient('ws://foo.bar:1337/', function() {}, function() {});
    }),
    afterEach(function() {
        sinon.restore();
    }),

    describe('#constructor()', function() {
        it('should return an instance', function() {
            bc.should.be.an.instanceof(BOPlishClient);
            bc = BOPlishClient('ws://foo.bar:1337/', function() {}, function() {});
            bc.should.be.an.instanceof(BOPlishClient);
        });
        it('should check bootstrap host syntax', function() {
            var spySuccess = sinon.spy();
            var spyError = sinon.spy();

            bc = new BOPlishClient('ws:/foo.bar:1337/', spySuccess, spyError);
            bc = new BOPlishClient('foo.bar:1337/', spySuccess, spyError);
            bc = new BOPlishClient('foo.bar', spySuccess, spyError);

            sinon.assert.calledThrice(spyError);
            sinon.assert.notCalled(spySuccess);
        });
        it('should abort on incompatible client');
    });

    describe('#registerProtocol()', function() {
        var protoIdentifier = 'test-protocol';
        var stub_router_registerDeliveryCallback;

        beforeEach(function() {
            stub_router_registerDeliveryCallback = sinon.stub(bc._router, 'registerDeliveryCallback');
        });
        afterEach(function() {
            stub_router_registerDeliveryCallback.restore();
        });

        it('should return a protocol object', function() {
            var proto = bc.registerProtocol(protoIdentifier);

            proto.should.be.an.Object;
        });
        it('should save the callback', function() {
            var proto = bc.registerProtocol(protoIdentifier);
            proto.should.have.property("identifier").equal(protoIdentifier);
        });
        describe('boplish-protocol', function() {
            var testMsg = {
                testmsg: 'test'
            };

            it('should carry the correct properties', function() {
                var proto = bc.registerProtocol(protoIdentifier);

                proto.should.have.property('identifier', protoIdentifier);
                proto.should.have.property('onmessage').and.be.an.Function;
                proto.should.have.property('send').and.be.an.Function;
            });
            it('should fail on malformed BOPUri');
            it('should fail on empty message', function() {
                var proto = bc.registerProtocol(protoIdentifier);
                (function() {
                    proto.send('test', null);
                }).should.
                throw ();
            });
            /*it('should correctly pass messages to the Router', function(){
                var proto = bc.registerProtocol(protoIdentifier);
                var stub_router_route = sinon.stub(bc._router, 'route');
                var bopid = {uid: 'test'};
                
                proto.send(bopid, testMsg);
                
                sinon.assert.calledOnce(stub_router_route);
                sinon.assert.calledWith(stub_router_route, 'test', protoIdentifier, testMsg);
            });
            it('should allow to receive messages', function(done){
                stub_router_registerDeliveryCallback.restore();
                var proto = bc.registerProtocol(protoIdentifier);

                proto.onmessage = function(bopuri, from, msg) {
                    bopuri.should.be.ok;
                    from.should.equal('123');
                    msg.should.equal(testMsg);
                    done();
                };
                bc._router._messageCallbacks[protoIdentifier]('bop://user@example.org', '123', testMsg);
            });*/
        });
    });
    describe('#setMonitorCallback()', function() {
        it('should allow to set a monitor callback');
        it('should get called on all incoming messages');
    });
    describe('#getConnectedPeers()', function() {
        it('should return all connected peers');
    });
});
