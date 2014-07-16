var assert = require("should");
var BOPlishClient = require('../js/bopclient.js');
var sinon = require('sinon');
require('../js/adapter.js');

describe('Application', function(){
    describe('#constructor()', function(){
        it('should return an instance');
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
