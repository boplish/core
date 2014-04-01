var assert = require('should');
var sinon = require('sinon');
var Chord = require('../js/chord/chord.js');
var Node = require('../js/chord/node.js');
var DataChannel = require('./adapter-mock.js').DataChannel;
var Sha1 = require('../js/third_party/sha1');
var BigInt = require('../js/third_party/BigInteger');

function mock_dcs() {
    var dc_in = {
        send: function(msg) {
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
            var c = new Chord({}, new Sha1(), 160);
            c.should.be.an.instanceof(Chord);
            c.should.have.property('_connectionManager', {});
            var c2 = Chord({}, new Sha1(), 160);
            c2.should.be.an.instanceof(Chord);
            c2.should.have.property('_connectionManager', {});
        });
        it('should initialize finger table', function() {
            var hash = mockHash(),
                c = new Chord({}, hash, 8),
                i;
            assert.equal(Object.keys(c._fingerTable).length, 8);
            for (i = 1; i <= 8; i++) {
                assert.equal(c._fingerTable[i].start().toString(), BigInt(2).pow(BigInt(i - 1)).toString());
                assert.equal(c._fingerTable[i].node, c._localNode);
            }
            assert.equal(c._localNode._successor, c._id);
        });
    });
    describe('closest preceding finger', function() {
        it('should return local node prior to joining', function() {
            var hash = mockHash(),
                c = new Chord({}, hash, 8),
                i;
            for (i = 0; i <= 255; i++) {
                assert.equal(c._closest_preceding_finger(i), c._localNode);
            }
        });
    });
    describe('joining', function() {
        it('should call success callback', function(done) {
            var c = new Chord({}, new Sha1(), 160);
            c.join(null, function() {
                done();
            });
        });
    });
});

describe('Node', function() {
    describe('message handling', function() {
        it('should return successor', function(done) {
            var dcs = mock_dcs();
            var n_in = new Node(0, null, dcs[0], null);
            var n_out = new Node(1, null, dcs[1], null);
            n_in.find_successor(2, function(succ) {
                if (succ === null) {
                    done();
                }
            });
        });
        it('should handle unexpected requests gracefully', function() {
            var n = new Node(0, null, {}, null);

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
            var n1 = new Node(null, null, dcs[0], null);
            var n2 = new Node({
                digest: [123, 123],
                number: BigInt(1)
            }, null, dcs[1], null);
            n1.get_node_id(function(id) {
                assert.equal(id, {
                    digest: [123, 123],
                    number: BigInt(1)
                });
                assert.equal(n1._id, id);
                done();
            });

        });
    });
    describe('find_successor', function() {
        it('should send the correct message', function() {
            var dc = new DataChannel();
            var dcStub = sinon.stub(dc, 'send');
            var n = new Node(0, null, dc, null);
            n.find_successor(1);
            sinon.assert.calledWith(dcStub, JSON.stringify({
                type: n.message_types.FIND_SUCCESSOR,
                id: 1,
                seqnr: 0
            }));
        });
        it('should call the correct callback upon arrival of the ID', function(done) {
            var dc = {};
            dc.send = function(msg) {
                var dec = JSON.parse(msg);
                if (dec.id === 2) {
                    setTimeout(function() {
                        dc.onmessage({
                            data: JSON.stringify({
                                type: Node.prototype.message_types.SUCCESSOR,
                                successor: 3,
                                seqnr: dec.seqnr
                            })
                        });
                    }, 10);
                } else if (dec.id === 1) {
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
            var n = new Node(0, null, dc, null);
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
});
