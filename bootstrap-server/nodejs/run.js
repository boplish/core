var BootstrapServer = require('./bootstrapserver.js');
var hostname = process.argv[2];
var port = process.argv[3];
var server = new BootstrapServer(hostname, port);
server.listen();
