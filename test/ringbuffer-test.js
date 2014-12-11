var assert = require('should');
var RingBuffer = require('../js/ringbuffer.js');

describe('RingBuffer', function() {
    describe('constructor', function() {
        it('should require size argument', function() {
            (function() {
                var rb = new RingBuffer();
            }).should.throw();
        });
        it('should require size argument to be a number', function() {
            (function() {
                var rb = new RingBuffer("a");
            }).should.throw();
            (function() {
                var rb = new RingBuffer({
                    a: 1
                });
            }).should.throw();
        });
        it('should return RingBuffer object', function() {
            var rb1, rb2;
            rb1 = new RingBuffer(1);
            rb1.should.be.an.instanceOf(RingBuffer);
            rb2 = RingBuffer(1);
            rb2.should.be.an.instanceOf(RingBuffer);
            rb1.push(1);
            rb2.push(1);
            rb2.should.eql(rb1);
        });
        it('should not accept less-than-zero size', function() {
            (function() {
                var rb = new RingBuffer(-1);
            }).should.throw();
        });
        it('should not accept zero size', function() {
            (function() {
                var rb = new RingBuffer(0);
            }).should.throw();
        });
    });
    describe('push', function() {
        it('should wrap around', function() {
            var rb = new RingBuffer(2);
            rb.push("a");
            rb.getall().should.eql(["a"]);
            rb.push("b");
            rb.getall().should.eql(["a", "b"]);
            rb.push("c");
            rb.getall().should.eql(["c", "b"]);
        });
        it('should be chainable', function() {
            var rb = new RingBuffer(3);
            rb.push(1).push(2).push(3).getall().should.eql([1, 2, 3]);
        });
    });
    describe('get', function() {
        it('should retrieve correct values', function() {
            var rb = new RingBuffer(4);
            rb.push("a");
            rb.push("b");
            rb.push("c");
            rb.push("d");
            rb.get(0).should.equal("a");
            rb.get(1).should.equal("b");
            rb.get(2).should.equal("c");
            rb.get(3).should.equal("d");
            rb.push("e");
            rb.get(0).should.equal("e");
        });
        it('should wrap around', function() {
            var rb = new RingBuffer(3);
            rb.push("a").push("b").push("c");
            rb.get(338).should.equal("c");
            rb.get(99).should.equal("a");
        });
    });
});
