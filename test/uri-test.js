var assert = require('should');
var sinon = require('sinon');
var URI = require('../js/uri.js');

describe('URI', function() {
    describe('constructor', function() {
        it('should return an instance', function() {
            var uri1 = URI('bop:max@example.org:documents/img/test.png?csum=sha256:aa:bb:cc');
            uri1.should.be.an.instanceof(URI);
            var uri2 = new URI('bop:max@example.org:documents/img/test.png?csum=sha256:aa:bb:cc');
            uri2.should.be.an.instanceof(URI);
        });
        it('should throw with invalid parameter', function() {
            (function () {
                var uri = new URI('test');
            }).should.throw();
            (function () {
                var uri = new URI();
            }).should.throw();
        });
        it('should fill fields correctly', function () {
            var uri = new URI('bop:max@example.org:documents/img/test.png?csum=sha256:aa:bb:cc');
            uri.should.have.property('scheme', 'bop');
            uri.should.have.property('uid', 'max@example.org');
            uri.should.have.property('protocol', 'documents');
            uri.should.have.property('path', '/img/test.png');
            uri.should.have.property('query', 'csum=sha256:aa:bb:cc');
        });
        it('should handle corner cases', function() {
            var uri = new URI('bop:max@example.org:proto/p/a/t/h');
            uri.should.have.property('path', '/p/a/t/h');

            uri = new URI('bop:max@example.org:proto');
            uri.should.not.have.property('path');

            uri = new URI('bop:max@example.org:proto/');
            uri.should.have.property('path', '/');
            uri.should.not.have.property('query');

            uri = new URI('bop:max:proto/?q');
            uri.should.have.property('path', '/');
            uri.should.have.property('query', 'q');

            uri = new URI('bop:max:proto/?');
            uri.should.have.property('query', '');

            uri = new URI('bop:max:proto/?a/b');
            uri.should.have.property('query', 'a/b');


        });
    });
});
