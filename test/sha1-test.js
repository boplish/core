var assert = require('should');
var sinon = require('sinon');
var Sha1 = require('../js/third_party/sha1');
var BigInteger = require('../js/third_party/BigInteger');

describe('Sha1', function() {
    describe('#hexString', function() {
        it('should return the correct string', function() {
            var sha1 = new Sha1();
            sha1.update('1');
            Sha1.hexString(sha1.digest()).should.equal('356a192b7913b04c54574d18c28d46e6395428ab');
        });
    });
    describe('#bigInteger', function() {
        it('should return the correct BigInteger', function() {
            var sha1 = new Sha1();
            sha1.update('max@example.org');
            var actual = Sha1.bigInteger(sha1.digest());
            var expected = new BigInteger('1302030195245224886854489520030607688166950098602');
            assert.ok(actual.equals(expected));
        });
        it('should be performant', function() {
            var i, digest, sha1 = new Sha1();
            sha1.update('max@example.org');
            digest = sha1.digest();
            this.timeout(50);
            for (i = 0; i < 10; i++) {
                Sha1.bigInteger(digest);
            }
        });
    });
    describe('#bigIntHash', function() {
        it('should return the correct BigInteger', function() {
            var actual = Sha1.bigIntHash('max@example.org');
            var expected = new BigInteger('1302030195245224886854489520030607688166950098602');
            assert.ok(actual.equals(expected));
        });
    });
});
