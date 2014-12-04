var assert = require("should");
var BOPlishClient = require('../deprecated/application.js');

describe('Application', function() {
    describe('#constructor()', function() {
        it('should return an instance', function() {
            var boplishClient = new BOPlishClient('test', function() {}, function() {});
            boplishClient.should.be.an.instanceof(BOPlishClient);
        });
        it('should check bootstrap host syntax', function(done) {
            var boplishClient = new BOPlishClient('test', function() {}, function(msg) {
                if (msg === 'Syntax error in bootstrapHost parameter') {
                    done();
                }
            });
        });
    });
});
