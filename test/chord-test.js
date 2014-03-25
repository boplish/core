var assert = require('should');
var sinon = require('sinon');
var Chord = require('../js/chord/chord.js');
var Node = require('../js/chord/node.js');
var DataChannel = require('./adapter-mock.js').DataChannel;

describe('Chord', function() {
    describe('constructor', function() {
        it('should return an instance', function() {
            var c = new Chord({});
            c.should.be.an.instanceof(Chord);
            c.should.have.property('_connectionManager', {});
            var c2 = Chord({});
            c2.should.be.an.instanceof(Chord);
            c2.should.have.property('_connectionManager', {});
        });
    });
    describe('joining', function() {
        // ???
    });
});

describe('Node', function() {
    describe('message handling', function() {
        it('should return successor', function(done) {
            var dc_in = {send: function(msg) {
                dc_out.onmessage({data: msg});
            }},
                dc_out = {send: function(msg) {
                    dc_in.onmessage({data: msg});
                }};
            var n_in = new Node(0, dc_in);
            var n_out = new Node(1, dc_out);
            n_in.find_successor(2, function(succ) {
                if(succ === 3) {
                    done();
                }
            });
        });
    });
    describe('find_successor', function() {
        it('should send the correct message', function() {
            var dc = new DataChannel();
            var dcStub = sinon.stub(dc, 'send');
            var n = new Node(0, dc);
            n.find_successor(1);
            sinon.assert.calledWith(dcStub, JSON.stringify({type: n.message_types.FIND_SUCCESSOR, id: 1, seqnr: 0}));
        });
        it('should call the correct callback upon arrival of the ID', function(done) {
            var dc = {};
            dc.send = function(msg) {
                var dec = JSON.parse(msg);
                if(dec.id === 2) {
                    setTimeout(function() {
                        dc.onmessage({data: JSON.stringify({type: Node.prototype.message_types.SUCCESSOR, successor: 3, seqnr: dec.seqnr})});
                    }, 10);
                } else if(dec.id === 1) {
                    setTimeout(function() {
                        dc.onmessage({data: JSON.stringify({type: Node.prototype.message_types.SUCCESSOR, successor: 2, seqnr: dec.seqnr})});
                    }, 20);
                }
            };
            var n = new Node(0, dc);
            var oks = 0;
            function find_successor(id, expected) {
                n.find_successor(id, function(id) {
                    if(id === expected) {
                        if(oks === 1 && Object.keys(n._pending).length === 0) {
                            done();
                        } else {
                            oks += 1;
                        }
                    }
                });
            }
            find_successor(2, 3);
            find_successor(1, 2);
        });
    });
});
