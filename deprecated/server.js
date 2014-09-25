var Peer = require("../peer");

var Server = function(id) {
    if (typeof id === "undefined") {
        throw new Error("You must provide an ID");
    }
    this.id = id;

    Object.defineProperty(this, "onconnect", {
        get: function() {
            return Server.channels[this.id.toString()];
        },
        set: function(val) {
            Server.channels[this.id.toString()] = val;
        }
    });
};

Server.prototype.connect = function(to, callback) {
    var self = this;

    if (!Server.channels[to.toString()]) {
        callback(new Error("No such channel endpoint '" + to.toString() + "'"));
        return;
    }

    var remote = new Peer(to, null, {
        send: function(msg) {
            var onmessage = local.dataChannel.onmessage;
            if (typeof(onmessage) === "function") {
                onmessage.apply(local.dataChannel, [{
                    data: msg
                }]);
            }
        }
    });
    var local = new Peer(self.id, null, {
        send: function(msg) {
            var onmessage = remote.dataChannel.onmessage;
            if (typeof(onmessage) === "function") {
                onmessage.apply(remote.dataChannel, [{
                    data: msg
                }]);
            }
        }
    });
    Server.channels[to.toString()].apply(this, [local]);
    callback(null, remote);
};
Server.channels = {};

module.exports = Server;
