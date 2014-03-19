var winston = require('winston');
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {'timestamp': true, 'colorize': true});
var BootstrapServer = require('./bootstrapserver.js');
var hostname = process.argv[2];
var port = process.argv[3];
var staticPath = process.argv[4];
var server = new BootstrapServer(hostname, port, staticPath);
server.listen();
