var assert = require("should");
var BOPlishClient = require('../js/bopclient.js');
var sinon = require('sinon');

describe('Application', function(){
    var bc;

    beforeEach(function(){
        bc = new BOPlishClient('ws://foo.bar:1337/', function(){}, function(){});
    }),

    describe('#constructor()', function(){
        it('should return an instance', function(){
            bc.should.be.an.instanceof(BOPlishClient);
            bc = BOPlishClient('ws://foo.bar:1337/', function(){}, function(){});
            bc.should.be.an.instanceof(BOPlishClient);
        });
        it('should check bootstrap host syntax');
        it('should abort on incompatible client');
        it('should create an BOPlishClient');
    });
    describe('#registerProtocol()', function(){
        it('should return a protocol object');
        it('should have a send method');
        it('should be able to set onmessage callback');
    });
    describe('#setMonitorCallback()', function(){
        it('should allow to set a monitor callback');
        it('should respond to all messages');
    });
    describe('#getConnectedPeers()', function(){
        it('should return all connected peers');
    });
});
