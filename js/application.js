BOPlishClient = function(bootstrapHost) {
    this.id = sha1.hash(Math.random().toString());
    var bootstrap = bootstrapHost || window.location.host;
    var channel = new WebSocket('ws://' + bootstrap + '/ws/' + this.id);
    this._connectionManager = new ConnectionManager();
    this._router = new Router(this.id, channel, this._connectionManager);
    channel.onopen = function() {
        this._connectionManager.bootstrap(this._router, function(msg){console.log(msg);}, function(msg){console.log(msg);});
    }.bind(this);
};

BOPlishClient.prototype = {
    send: function(to, protocol, payload) {
        this._router.route(to, protocol, payload);
    },
    setOnMessageHandler: function(protocol, callback) {
        this._router.registerDeliveryCallback(protocol, callback);
    },
    setMonitorCallback: function(callback) {
        this._router.registerMonitorCallback(callback);
    },
    getConnectedPeers: function() {
        return this._router.getPeerIds();
    }
};
