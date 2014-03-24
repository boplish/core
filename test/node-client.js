require('../js/adapter.js');
var Router = require('../js/router.js');
var ConnectionManager = require('../js/connectionmanager.js');
var Peer = require('../js/peer.js');
var BOPClient = require('../js/application.js');
var sha1 = require('../js/sha1.js');

var bopclient = new BOPlishClient('127.0.0.1:5000', function(msg){
    console.log('bopclient success callback');
});
