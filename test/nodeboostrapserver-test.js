var assert = require('should');
var BootstrapServer = require('../bootstrap-server/nodejs/bootstrapserver.js');
var winston = require('winston');
winston.remove(winston.transports.Console);
var sinon = require('sinon');
var WebSocketClient = require('websocket').client;
var WebSocketServer = require('websocket').server;

describe('BoostrapServer', function(){
    describe('#constructor()', function(){
        it('should return an instance', function(){
            var server = new BootstrapServer();
            server.should.be.an.instanceof(BootstrapServer);
        });
    });
    describe('#listen()', function(){
        it('should listen on given port and let client connect', function(done){
            var host = '0.0.0.0';
            var port = 61232;
            var server = new BootstrapServer(host, port);
            server.listen();
            var client = new WebSocketClient();
            client.on('connect', function(){
                server.close();
                done();
            });

            client.connect('ws://localhost:' + port + '/ws/myid');
        });
        it('should reject clients that use malformed requests', function(done){
            var host = '0.0.0.0';
            var port = 61232;
            var server = new BootstrapServer(host, port);
            server.listen();
            var client = new WebSocketClient();
            client.on('connectFailed', function(errorDescription){
                server.close();
                done();
            });

            client.connect('ws://localhost:' + port + '/abc');
        });
        it('should add a user on connect and remove on disconnect', function(done){
            var host = '0.0.0.0';
            var port = 61232;
            var server = new BootstrapServer(host, port);
            server.listen();

            var client = new WebSocketClient();
            client.on('connect', function(connection){
                Object.keys(server._users).should.have.length(1);
                connection.close();
                setTimeout(function(){
                    Object.keys(server._users).should.have.length(0);
                    server.close();
                    done();
                }, 100);
            });

            client.connect('ws://localhost:' + port + '/ws/myid');
        });
        it('should relay messages between two users', function(done){
            var host = '0.0.0.0';
            var port = 61232;
            var server = new BootstrapServer(host, port);
            server.listen();

            var client1 = new WebSocketClient();
            var client2 = new WebSocketClient();
            client1.on('connect', function(conn){
                conn.on('message', function(rawMsg){
                    var msg = JSON.parse(rawMsg.utf8Data);
                    msg.should.have.property('to', 'client1');
                    msg.should.have.property('from', 'client2');
                    server.close();
                    done();
                });
            });
            client2.on('connect', function(conn){
                conn.send(JSON.stringify({
                    type: 'signaling-protocol',
                    from: 'client2',
                    to: 'client1',
                    payload: {type: 'answer'}
                }));
            });

            client1.connect('ws://localhost:' + port + '/ws/client1');
            client2.connect('ws://localhost:' + port + '/ws/client2');
        });
        it('should route offer to correct peer', function(done){
            var host = '0.0.0.0';
            var port = 61232;
            var server = new BootstrapServer(host, port);
            server.listen();

            var client1 = new WebSocketClient();
            var client2 = new WebSocketClient();
            client1.on('connect', function(conn){
                conn.on('message', function(rawMsg){
                    var msg = JSON.parse(rawMsg.utf8Data);
                    msg.should.have.property('type', 'signaling-protocol');
                    msg.should.have.property('payload');
                    msg.payload.should.have.property('type', 'offer');
                    msg.should.have.property('to', 'client1');
                    msg.should.have.property('from', 'client2');
                    server.close();
                    done();
                });
            });
            client2.on('connect', function(conn){
                conn.send(JSON.stringify({
                    type: 'signaling-protocol',
                    from: 'client2',
                    to: '*',
                    payload: {type: 'offer'}
                }));
            });

            client1.connect('ws://localhost:' + port + '/ws/client1');
            client2.connect('ws://localhost:' + port + '/ws/client2');
        });
        it('should route answer to correct peer', function(done){
            var host = '0.0.0.0';
            var port = 61232;
            var server = new BootstrapServer(host, port);
            server.listen();

            var client1 = new WebSocketClient();
            var client2 = new WebSocketClient();
            client1.on('connect', function(conn){
                conn.on('message', function(rawMsg){
                    var msg = JSON.parse(rawMsg.utf8Data);
                    msg.should.have.property('type', 'signaling-protocol');
                    msg.payload.should.have.property('type', 'answer');
                    msg.should.have.property('to', 'client1');
                    msg.should.have.property('from', 'client2');
                    server.close();
                    done();
                });
            });
            client2.on('connect', function(conn){
                conn.send(JSON.stringify({
                    type: 'signaling-protocol',
                    from: 'client2',
                    to: 'client1',
                    payload: {type: 'answer'}
                }));
            });

            client1.connect('ws://localhost:' + port + '/ws/client1');
            client2.connect('ws://localhost:' + port + '/ws/client2');
        });
    });
});
