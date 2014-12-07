/* jshint expr: true */

var assert = require('should');
var sinon = require('sinon');
var Chord = require('../../js/chord/chord');
var ChordNode = require('../../js/chord/node');
var DataChannel = require('../adapter-mock').DataChannel;
var Sha1 = require('../../js/third_party/sha1');
var BigInteger = require('../../js/third_party/BigInteger');
var Peer = require('../../js/peer');

var config = require('../../js/config');

function mock_dcs() {
    var dc_in = {
        send: function(msg) {
            console.log(dc_out);
            dc_out.onmessage({
                data: msg
            });
        }
    },
        dc_out = {
            send: function(msg) {
                dc_in.onmessage({
                    data: msg
                });
            }
        };
    return [dc_in, dc_out];
}

function mockHash() {
    return {
        update: function(str) {
            this.str = str;
            this.number = BigInt(0);
        },
        digest: function() {
            return [this.str];
        },
        bigInteger: function() {
            return this.number;
        }
    };

}

describe('Chord', function() {
    var c, cm, dcStub;

    beforeEach(function() {
        cm = {
            connect: function() {}
        };
        dcStub = sinon.createStubInstance(DataChannel);
        c = new Chord(new BigInteger(42), dcStub, cm);
    });

    describe('constructor', function() {
        it('should return an instance', function() {
            c.should.be.an.instanceof(Chord);
            c.should.have.property('_connectionManager', cm);
            c.should.have.property('_localNode');
            c._localNode.should.be.an.instanceof(ChordNode);

            assert.ok(c.id.equals(new BigInteger(42)));
        });
        it('should throw on inacceptable max finger table parameter', function() {
            config.chord.maxFingerTableEntries = -5;
            (function() {
                c = new Chord(new BigInteger(0), dcStub, cm);
            }).should.
            throw ();
            config.chord.maxFingerTableEntries = 0;
            (function() {
                c = new Chord(new BigInteger(0), dcStub, cm);
            }).should.
            throw ();
            config.chord.maxFingerTableEntries = 161;
            (function() {
                c = new Chord(new BigInteger(0), dcStub, cm);
            }).should.
            throw ();
            delete config.chord.maxFingerTableEntries;
        });
        it('should start with successor set to myself and predecessor set to null', function() {
            c._localNode._successor.should.equal(c._localNode);
            assert.equal(c._localNode._predecessor, null);
            assert.equal(c._localNode._peer._dataChannel, dcStub);
        });
        it('should initialize finger table with 16 entries per default', function() {
            c = new Chord(new BigInteger(42), dcStub, cm); // no maxFingerTableEntries parameter, so asusme default
            assert.equal(Object.keys(c._fingerTable).length, 16);
        });
        it('should initialize complete finger table', function() {
            var i;
            config.chord.maxFingerTableEntries = 160;
            c = new Chord(new BigInteger(42), dcStub, cm);
            assert.equal(Object.keys(c._fingerTable).length, 160);
            for (i = 1; i <= 160; i++) {
                assert.equal(c._fingerTable[i].start().toString(), (BigInteger(42).plus(BigInteger(2).pow(BigInteger(i - 1))).toString()));
                assert.equal(c._fingerTable[i].node, c._localNode);
            }
            delete config.chord.maxFingerTableEntries;
        });
        it('should initialize partially filled finger table', function() {
            config.chord.maxFingerTableEntries = 16;
            c = new Chord(new BigInteger(42), dcStub, cm);

            assert.equal(Object.keys(c._fingerTable).length, config.chord.maxFingerTableEntries);
            assert.equal(c._fingerTable[1].start().toString(), (BigInteger(42).plus(BigInteger(2).pow(BigInteger(0))).toString()));
            assert.equal(c._fingerTable[1].node, c._localNode);
            assert.equal(c._fingerTable[2].start().toString(), (BigInteger(42).plus(BigInteger(2).pow(BigInteger(1))).toString()));
            assert.equal(c._fingerTable[2].node, c._localNode);
            assert.equal(c._fingerTable[3].start().toString(), (BigInteger(42).plus(BigInteger(2).pow(BigInteger(2))).toString()));
            assert.equal(c._fingerTable[3].node, c._localNode);
            assert.equal(c._fingerTable[4].start().toString(), (BigInteger(42).plus(BigInteger(2).pow(BigInteger(3))).toString()));
            assert.equal(c._fingerTable[4].node, c._localNode);
            assert.equal(c._fingerTable[5].start().toString(), (BigInteger(42).plus(BigInteger(2).pow(BigInteger(4))).toString()));
            assert.equal(c._fingerTable[5].node, c._localNode);
            assert.equal(c._fingerTable[6].start().toString(), (BigInteger(42).plus(BigInteger(2).pow(BigInteger(5))).toString()));
            assert.equal(c._fingerTable[6].node, c._localNode);
            assert.equal(c._fingerTable[7].start().toString(), (BigInteger(42).plus(BigInteger(2).pow(BigInteger(6))).toString()));
            assert.equal(c._fingerTable[7].node, c._localNode);
            assert.equal(c._fingerTable[8].start().toString(), (BigInteger(42).plus(BigInteger(2).pow(BigInteger(7))).toString()));
            assert.equal(c._fingerTable[8].node, c._localNode);
            assert.equal(c._fingerTable[9].start().toString(), (BigInteger(42).plus(BigInteger(2).pow(BigInteger(8))).toString()));
            assert.equal(c._fingerTable[9].node, c._localNode);
            assert.equal(c._fingerTable[10].start().toString(), (BigInteger(42).plus(BigInteger(2).pow(BigInteger(9))).toString()));
            assert.equal(c._fingerTable[10].node, c._localNode);

            config.chord.maxFingerTableEntries = 1;
            c = new Chord(new BigInteger(1), dcStub, cm);

            assert.equal(Object.keys(c._fingerTable).length, 1);
            assert.equal(c._fingerTable[1].start().toString(), (BigInteger(1).plus(BigInteger(2).pow(BigInteger(0))).mod(BigInteger(2).pow(BigInteger(1)))).toString());
            assert.equal(c._fingerTable[1].node, c._localNode);

            config.chord.maxFingerTableEntries = 2;
            c = new Chord(new BigInteger(2), dcStub, cm, 2);

            assert.equal(Object.keys(c._fingerTable).length, 2);
            assert.equal(c._fingerTable[1].start().toString(), (BigInteger(2).plus(BigInteger(2).pow(BigInteger(0))).mod(BigInteger(2).pow(BigInteger(2)))).toString());
            assert.equal(c._fingerTable[1].node, c._localNode);
            assert.equal(c._fingerTable[2].start().toString(), (BigInteger(2).plus(BigInteger(2).pow(BigInteger(1))).mod(BigInteger(2).pow(BigInteger(2)))).toString());
            assert.equal(c._fingerTable[2].node, c._localNode);

            delete config.chord.maxFingerTableEntries;
        });
    });
    describe('#id', function() {
        it('should return correct ID', function() {
            assert.ok(c.id.equals(new BigInteger(42)));
        });
        it('should be immutable', function() {
            assert.ok(c.id.equals(new BigInteger(42)));
            c.id = 'something else';
            assert.ok(c.id.equals(new BigInteger(42)));
        });
    });
    describe('#join', function() {
        it('should fail after timeout', function(done) {
            c.join(new Peer(new BigInteger(1), null, dcStub), function(err) {
                if (!err) {
                    sinon.assert.fail(err);
                } else {
                    done();
                }
            });
        });
        it('should not allow to be called twice', function(done) {
            c.join(new Peer(new BigInteger(1), null, dcStub), function(err) {
                err.should.not.equal('Already joining');
                if (!err) {
                    sinon.assert.fail(err);
                }
            });
            c.join(new Peer(new BigInteger(1), null, dcStub), function(err) {
                if (err) {
                    err.should.equal('Already joining');
                    done();
                }
            });
        });
    });
    describe('#responsible', function() {
        it('should return true for my id', function() {
            c._localNode.responsible(c._localNode.id()).should.be.ok;
        });
        it('should handle (preId, myId] when predecessor is set', function() {
            c._localNode._predecessor = new ChordNode(new Peer(c._localNode.id().plus(10), null, dcStub), c, false);
            c._localNode.responsible(c._localNode.id()).should.be.ok;
            c._localNode.responsible(c._localNode.id().plus(1)).should.not.be.ok;
            c._localNode.responsible(c._localNode.predecessor_id()).should.not.be.ok;
            c._localNode.responsible(c._localNode.predecessor_id().plus(1)).should.be.ok;
        });
        it('should handle wrap around', function() {
            c._localNode._predecessor = new ChordNode(new Peer(c._localNode.id().plus(2), null, dcStub), c, false);
            c._localNode.responsible(c._localNode.id()).should.be.ok;
            c._localNode.responsible(c._localNode.id().plus(1)).should.not.be.ok;
            c._localNode.responsible(c._localNode.id().plus(2)).should.not.be.ok;
            c._localNode.responsible(c._localNode.id().plus(3)).should.be.ok;
        });
    });
    describe('#localFindOperations', function() {
        it('should locally find correct successor', function() {
            c._localNode._predecessor = new ChordNode(new Peer(c._localNode.id().minus(10), null, dcStub), c, false);
            c._localNode._successor = new ChordNode(new Peer(c._localNode.id().plus(10), null, dcStub), c, false);
            c.find_successor(c._localNode.id(), function(err, res) {
                assert.equal(err, null);
                res.successor.should.equal(c._localNode.id());
            });
            c.find_successor(c._localNode.successor_id(), function(err, res) {
                assert.equal(err, null);
                res.successor.should.equal(c._localNode.successor_id());
            });
            c.find_successor(c._localNode.id().plus(3), function(err, res) {
                assert.equal(err, null);
                res.successor.should.equal(c._localNode.successor_id());
            });
            c.find_successor(c._localNode.id().minus(3), function(err, res) {
                assert.equal(err, null);
                res.successor.should.equal(c._localNode.id());
            });
        });
        it('should locally find correct predecessor', function() {
            c._localNode._predecessor = new ChordNode(new Peer(c._localNode.id().minus(10), null, dcStub), c, false);
            c._localNode._successor = new ChordNode(new Peer(c._localNode.id().plus(10), null, dcStub), c, false);
            c.find_predecessor(c._localNode.id(), function(err, res) {
                assert.equal(err, null);
                res.predecessor.should.equal(c._localNode.predecessor_id());
            });
            c.find_predecessor(c._localNode.successor_id(), function(err, res) {
                assert.equal(err, null);
                res.predecessor.should.equal(c._localNode.id());
            });
            c.find_predecessor(c._localNode.id().plus(3), function(err, res) {
                assert.equal(err, null);
                res.predecessor.should.equal(c._localNode.id());
            });
            c.find_predecessor(c._localNode.id().minus(3), function(err, res) {
                assert.equal(err, null);
                res.predecessor.should.equal(c._localNode.predecessor_id());
            });
        });
        it('should handle edge case: predecessor unset', function() {
            c._localNode._predecessor = null;
            c._localNode._successor = new ChordNode(new Peer(c._localNode.id().plus(10), null, dcStub), c, false);
            c.find_successor(c._localNode.id(), function(err, res) {
                assert.equal(err, null);
                res.successor.should.equal(c._localNode.id());
            });
            c.find_successor(c._localNode.predecessor_id(), function(err, res) {
                assert.equal(err, null);
                res.successor.should.equal(c._localNode.id());
            });
            c.find_predecessor(c._localNode.id(), function(err, res) {
                assert.equal(err, null);
                res.predecessor.should.equal(c._localNode.id());
            });
            c.find_predecessor(c._localNode.successor_id(), function(err, res) {
                assert.equal(err, null);
                res.predecessor.should.equal(c._localNode.id());
            });
        });
        it('should handle edge case: i am my successor, predecessor unset', function() {
            c._localNode._predecessor = null;
            c._localNode._successor = new ChordNode(new Peer(c._localNode.id(), null, dcStub), c, false);
            c.find_successor(c._localNode.id(), function(err, res) {
                assert.equal(err, null);
                res.successor.should.equal(c._localNode.id());
            });
            c.find_successor(c._localNode.id().plus(3), function(err, res) {
                assert.equal(err, null);
                res.successor.should.equal(c._localNode.id());
            });
            c.find_successor(c._localNode.id().minus(3), function(err, res) {
                assert.equal(err, null);
                res.successor.should.equal(c._localNode.id());
            });
            c.find_predecessor(c._localNode.id().plus(3), function(err, res) {
                assert.equal(err, null);
                res.predecessor.should.equal(c._localNode.id());
            });
            c.find_predecessor(c._localNode.id().minus(3), function(err, res) {
                assert.equal(err, null);
                res.predecessor.should.equal(c._localNode.id());
            });
        });
    });
});
/*


    describe('joining', function() {
        it('should call success callback', function(done) {
            var s0 = {}, s1 = {};
            sinon.stub(s0, "connect");
            var c0 = new Chord(new BigInteger(0), s0);
            var c1 = new Chord(new BigInteger(10), s1);
            c0.join(c1.id(), function() {
                done();
            });
        });
    });
});
/*
                it('should fill complete finger table', function(done) {
                    var c1 = new Chord({}, new Sha1(), 5);
                    var c2 = new Chord({}, new Sha1(), 5);
                    c1.join(c2._localNode, function() {
                        / / TODO(max): check individual entries
assert.equal(Object.keys(c._fingerTable).length, 5);
done();
});
});
});
});

describe('Node', function() {
    describe('message handling', function() {
        it('should return successor', function(done) {
            var dcs = mock_dcs();
            var n_in = new ChordNode(0, null, null, dcs[0], null);
            var n_out = new ChordNode(1, null, null, dcs[1], null);
            n_in.find_successor(2, function(succ) {
                if (succ === null) {
                    done();
                }
            });
        });
        it('should handle unexpected requests gracefully', function() {
            var n = new ChordNode(0, null, null, {}, null);

            function msg(obj) {
                return {
                    data: JSON.stringify(obj)
                };
            }
            n._onmessage({
                data: "justastring"
            });
            n._onmessage(msg({}));
            n._onmessage(msg({
                type: 'hello'
            }));
            n._onmessage(msg({
                type: n.message_types.SUCCESSOR
            }));
            n._onmessage(msg({
                type: n.message_types.FIND_SUCCESSOR
            }));
        });
    });
    describe('get_node_id', function() {
        it('should return and set the correct ID', function(done) {
            var dcs = mock_dcs();
            var n1 = new ChordNode(null, null, null, dcs[0], null);
            var n2 = new ChordNode(BigInteger(1), null, null, dcs[1], null);
            n1.get_node_id(function(id) {
                assert.ok(id.equals(BigInteger(1)));
                assert.equal(n1._id, id);
                done();
            });

        });
        it('should return the same ID upon subsequent calls', function(done) {
            var dcs = mock_dcs();
            var n1 = new ChordNode(null, null, null, dcs[0], null);
            var n2 = new ChordNode(BigInt(1), null, null, dcs[1], null);
            var id1;
            n1.get_node_id(function(id) {
                id1 = id;
            });
            n1.get_node_id(function(id) {
                assert.equal(id, id1);
                done();
            });

        });
        it('should cache the ID', function() {
            var dcs = mock_dcs();
            sinon.spy(dcs[0], 'send');
            var n1 = new ChordNode(null, null, null, dcs[0], null);
            var n2 = new ChordNode(BigInt(1), null, null, dcs[1], null);
            n1.get_node_id(function() {});
            n1.get_node_id(function() {});
            assert.ok(dcs[0].send.calledOnce);
        });
    });
    describe('find_successor', function() {
        it('should send the correct message', function() {
            var dc = new DataChannel();
            var dcStub = sinon.stub(dc, 'send');
            var n = new ChordNode(0, null, null, dc, null);
            n.find_successor(1);
            sinon.assert.calledWith(dcStub, JSON.stringify({
                type: n.message_types.FIND_SUCCESSOR,
                id: "1",
                seqnr: 0
            }));
        });
        it('should call the correct callback upon arrival of the ID', function(done) {
            var dc = {};
            dc.send = function(msg) {
                var dec = JSON.parse(msg);
                if (dec.id === "2") {
                    setTimeout(function() {
                        dc.onmessage({
                            data: JSON.stringify({
                                type: Node.prototype.message_types.SUCCESSOR,
                                successor: 3,
                                seqnr: dec.seqnr
                            })
                        });
                    }, 10);
                } else if (dec.id === "1") {
                    setTimeout(function() {
                        dc.onmessage({
                            data: JSON.stringify({
                                type: Node.prototype.message_types.SUCCESSOR,
                                successor: 2,
                                seqnr: dec.seqnr
                            })
                        });
                    }, 20);
                }
            };
            var n = new ChordNode(0, null, null, dc, null);
            var oks = 0;

            function find_successor(id, expected) {
                n.find_successor(id, function(id) {
                    if (id === expected) {
                        if (oks === 1 && Object.keys(n._pending).length === 0) {
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
}); * /
*/
