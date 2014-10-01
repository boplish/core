var assert = require('should');
var sinon = require('sinon');
var BopURI = require('../js/bopuri.js');

describe('BopURI', function() {
    describe('constructor', function() {
        it('should return an instance', function() {
            var uri1 = BopURI('bop:max@example.org:documents/img/test.png?csum=sha256:aa:bb:cc');
            uri1.should.be.an.instanceof(BopURI);
            var uri2 = new BopURI('bop:max@example.org:documents/img/test.png?csum=sha256:aa:bb:cc');
            uri2.should.be.an.instanceof(BopURI);
        });
        it('should throw with invalid parameter', function() {
            (function() {
                var uri = new BopURI('test');
            }).should.
            throw ();
            (function() {
                var uri = new BopURI();
            }).should.
            throw ();
        });
        it('should fill fields correctly', function() {
            var uri = new BopURI('bop:max@example.org:documents/img/test.png?csum=sha256:aa:bb:cc');
            uri.should.have.property('scheme', 'bop');
            uri.should.have.property('uid', 'max@example.org');
            uri.should.have.property('protocol', 'documents');
            uri.should.have.property('path', '/img/test.png');
            uri.should.have.property('query', 'csum=sha256:aa:bb:cc');
        });
        it('should handle corner cases', function() {
            var uri = new BopURI('bop:max@example.org:proto/p/a/t/h');
            uri.should.have.property('path', '/p/a/t/h');

            uri = new BopURI('bop:max@example.org:proto');
            uri.should.not.have.property('path');

            uri = new BopURI('bop:max@example.org:proto/');
            uri.should.have.property('path', '/');
            uri.should.not.have.property('query');

            uri = new BopURI('bop:max:proto/?q');
            uri.should.have.property('path', '/');
            uri.should.have.property('query', 'q');

            uri = new BopURI('bop:max:proto/?');
            uri.should.have.property('query', '');

            uri = new BopURI('bop:max:proto/?a/b');
            uri.should.have.property('query', 'a/b');
        });
        describe('#create', function() {
            it('should return an instance', function() {
                var uri = BopURI.create('max@example.org', 'documents', '/chat/room1');
                uri.should.be.an.instanceof(BopURI);
                uri.should.have.property('scheme', 'bop');
                uri.should.have.property('uid', 'max@example.org');
                uri.should.have.property('protocol', 'documents');
                uri.should.have.property('path', '/chat/room1');
                uri.should.not.have.property('query');

                uri = BopURI.create('max@example.org', 'documents', 'chat/room1', 'status=away');
                uri.should.be.an.instanceof(BopURI);
                uri.should.have.property('scheme', 'bop');
                uri.should.have.property('uid', 'max@example.org');
                uri.should.have.property('protocol', 'documents');
                uri.should.have.property('path', '/chat/room1');
                uri.should.have.property('query', 'status=away');
            });
        });
        describe('#toString', function() {
            it('should return the correct string', function() {
                new BopURI('bop:max:proto/?q').toString().should.equal('bop:max:proto/?q');
                BopURI.create('max@example.org', 'documents', '/chat/room1').toString().should.equal('bop:max@example.org:documents/chat/room1');
                BopURI.create('max@example.org', 'documents', 'chat/room1', 'status=away').toString().should.equal('bop:max@example.org:documents/chat/room1?status=away');
            });
        });
    });
});
