/* jshint expr: true */

var assert = require("should");
require('../js/third_party/sha1.js');
var Mocks = require('./adapter-mock.js');
var sinon = require('sinon');
var ConnectionManager = require('../js/connectionmanager.js');
var BigInteger = require('../js/third_party/BigInteger.js');
var peerConfig = require('../js/config').peer;
peerConfig.messageTimeout = 10;

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
    });
    describe('#bootstrap()', function() {
        it('should register the correct callbacks', function() {
            var mockRouter = sinon.mock(RouterAPI);
            mockRouter.expects("registerDeliveryCallback").withArgs('signaling-protocol');
            cm.bootstrap(RouterAPI, function() {}, function() {});
            mockRouter.restore();
        });
        it('should route the initial offer', function() {
            var mockRouter = sinon.mock(RouterAPI);
            mockRouter.expects('route').once();
            cm.bootstrap(RouterAPI, function() {}, function() {});
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
            cm.bootstrap(router, function() {}, function() {});
        });
        it('should call error callback', function(done) {
            var router = {
                id: function() {
                    return 1;
                },
                registerDeliveryCallback: function() {},
                route: function(recv, msg) {
                    cm._onReceiveAnswer({
                        seqnr: msg.seqnr,
                        payload: {
                            answer: null
                        },
                    }, null);
                    sinon.stub(cm._pending[msg.seqnr].dc, 'send');
                    cm._pending[msg.seqnr].dc.onopen();
                },
                addPeer: function(peer, cb) {
                    cb();
                }
            };
            var called = 0;
            cm.bootstrap(router, function() {}, function() {
                done();
            });
        });
    });
});
