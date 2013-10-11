BOPlishClient = function(bootstrapHost, successCallback, errorCallback) {
    this.id = sha1.hash(Math.random().toString());
    bootstrapHost = bootstrapHost || window.location.host;

    var channel = new WebSocket('ws://' + bootstrapHost + '/ws/' + this.id);
    channel.onerror = function() {
        errorCallback();
    };
    channel.onopen = function() {
        this._connectionManager.bootstrap(this._router, successCallback, errorCallback);
    }.bind(this);

    this._connectionManager = new ConnectionManager();
    this._router = new Router(this.id, channel, this._connectionManager);
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
