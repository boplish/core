var BootstrapServer = require('./bootstrapserver.js');
var hostname = process.argv[2] || 'localhost';
var port = process.argv[3] || 3000;
var staticPath = process.argv[4];
var server = new BootstrapServer(hostname, port, staticPath);
server.listen();
