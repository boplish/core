var assert = require('should');
var sinon = require('sinon');
var Chord = require('../../js/chord/chord');
var ChordNode = require('../../js/chord/node');
var DataChannel = require('../adapter-mock').DataChannel;
var Sha1 = require('../../js/third_party/sha1');
var BigInteger = require('../../js/third_party/BigInteger');
var Peer = require('../../js/peer');

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
    describe('constructor', function() {
        it('should return an instance', function() {
            var c = new Chord(new BigInteger(5), {});
            c.should.be.an.instanceof(Chord);
            c.should.have.property('_connectionManager', {});
            assert(c.id().equals(new BigInteger(5)));
        });
        it('should start with itself as succ and pred', function() {
            var c = new Chord(new BigInteger(5));
            assert(c._localNode.id().equals(c._localNode._successor));
            assert(c._localNode.id().equals(c._localNode._predecessor));
        });
        it('should initialize finger table', function() {
            var hash = mockHash(),
                c = new Chord(new BigInteger(0)),
                i;
            assert.equal(Object.keys(c._fingerTable).length, 8);
            for (i = 1; i <= 8; i++) {
                assert.equal(c._fingerTable[i].start().toString(), (BigInteger(2).pow(BigInteger(i - 1)).toString()));
                assert.equal(c._fingerTable[i].node, c._localNode);
            }
            assert.equal(c._localNode._successor, c.id());
            assert.equal(c._localNode._predecessor, c.id());
        });
    });
    describe('closest preceding finger', function() {
        it('should return local node prior to joining', function() {
            var hash = mockHash(),
                c = new Chord(),
                i;
            for (i = 0; i <= 255; i++) {
                assert.equal(c._closest_preceding_finger(i), c._localNode);
            }
        });
    });
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
