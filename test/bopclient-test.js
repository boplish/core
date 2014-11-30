/* jshint expr: true */

var assert = require("should");
var BOPlishClient = require('../js/bopclient.js');
var sinon = require('sinon');
var BigInteger = require('../js/third_party/BigInteger');

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
        describe('boplish-protocol', function() {
            var testMsg = {
                testmsg: 'test'
            };

            it('should carry the correct properties', function() {
                var proto = bc.registerProtocol(protoIdentifier);

                proto.should.have.property('bopid', bc.bopid);
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
            it('should correctly pass messages to the Router', function() {
                var proto = bc.registerProtocol(protoIdentifier);
                var stub_router_route = sinon.stub(bc._router, 'route');
                var stub_router_get = sinon.stub(bc._router, 'get', function(key, cb) {
                    cb(null, {
                        chordId: "12345"
                    });
                });
                var bopid = {
                    uid: 'test'
                };

                proto.send(bopid, testMsg);

                sinon.assert.calledOnce(stub_router_route);
                assert.ok(new BigInteger("12345").equals(stub_router_route.args[0][0]));
                assert.deepEqual(stub_router_route.args[0][1], {
                    from: bc.bopid,
                    to: bopid,
                    type: protoIdentifier,
                    payload: testMsg
                });
            });
            it('should allow to receive messages', function(done) {
                stub_router_registerDeliveryCallback.restore();
                var proto = bc.registerProtocol(protoIdentifier);

                proto.onmessage = function(from, msg) {
                    from.should.equal('123');
                    msg.should.equal(testMsg);
                    done();
                };
                // FIXME(max): don't make assumptions about router impl
                bc._router._messageCallbacks[protoIdentifier]({
                    from: '123',
                    payload: testMsg
                });
            });
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
