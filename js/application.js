/** @fileOverview API for application developers. */

/**
 * @constructor
 * @class This is the top-level API for BOPlish applications. It should be the
 * only interface used for interacting with the P2P network.
 * @param bootstrapHost {String} Name and port of the host running the signaling
 * server. The format is 'HOSTNAME[:PORT]'. If this is undefined or null then
 * the host of the serving application is used.
 * @param successCallback {BOPlishClient~onSuccessCallback} Called when a
 * connection to the P2P network has been established.
 * @param errorCallback {BOPlishClient~onErrorCallback} Called when a connection
 * to the P2P network could not be established (e.g. if the WebSocket connection
 * to the bootstrapHost failed.
 */
BOPlishClient = function(bootstrapHost, successCallback, errorCallback) {
    var browser = this.utils.whatBrowserAmI();
    if (browser.vendor === 'Firefox' && Number(browser.version.slice(0, 2)) >= 26) {
        // we are on FF
    } else if (browser.vendor === 'Chrome' && Number(browser.version.slice(0, 2)) >= 33) {
        // we are on Chrome
    } else if (browser.vendor === 'Node.js') {
        // we are on Node.js
    } else {
        errorCallback('You will not be able to use BOPlish as your browser is currently incompatible. Please use either Firefox 26 or Chrome 33 upwards.');
        return;
    }

    this.id = sha1.hash(Math.random().toString());
    bootstrapHost = bootstrapHost || window.location.host;

    var channel = new WebSocket('ws://' + bootstrapHost + '/ws/' + this.id);
    channel.onerror = function(err) {
        errorCallback(err);
    };
    channel.onopen = function() {
        this._connectionManager.bootstrap(this._router, successCallback, errorCallback);
    }.bind(this);

    this._connectionManager = new ConnectionManager();
    this._router = new Router(this.id, channel, this._connectionManager);
};

BOPlishClient.prototype = {

    utils: {
        /**
         * Returns an object with information about the browser in use
         */
        whatBrowserAmI: function() {
            if (typeof(process) !== 'undefined' && typeof(module) !== 'undefined') {
                return {
                    vendor:'Node.js',
                    version: process.version
                }
            }
            // source http://stackoverflow.com/questions/5916900/detect-version-of-browser
            var ua = navigator.userAgent,
                N = navigator.appName,
                tem,
                M = ua.match(/(opera|chrome|safari|firefox|msie|trident)\/?\s*([\d\.]+)/i) || [];
            M = M[2] ? [M[1], M[2]] : [N, navigator.appVersion, '-?'];
            if (M && (tem = ua.match(/version\/([\.\d]+)/i)) !== null) {
                M[2] = tem[1];
            }
            return {
                vendor: M[0],
                version: M[1]
            };
        }
    },
    /**
     * Sends a message to the given peer.
     * @param to {String} Receiver of the message
     * @param protocol {String} Protocol name. On the receiver side a handler
     * has to be installed for this protocol.
     * @param payload {Object} The payload to send.
     */
    send: function(to, protocol, payload) {
        this._router.route(to, protocol, payload);
    },
    /**
     * Installs a handler for the given protocol name.
     * @param protocol {String} The protocol to handle.
     * @param callback {BOPlishClient~onMessageCallback} The function invoked when a message of the
     * given protocol is received through the P2P network.
     */
    setOnMessageHandler: function(protocol, callback) {
        this._router.registerDeliveryCallback(protocol, callback);
    },
    /**
     * Installs a special callback that receives all messages despite their
     * protocol.
     * @param callback {BOPlishClient~monitorCallback} Invoked on reception of a
     * message.
     */
    setMonitorCallback: function(callback) {
        this._router.registerMonitorCallback(callback);
    },
    /**
     * @return {Array} The list of all IDs of peers this peer has an open
     * connection to.
     */
    getConnectedPeers: function() {
        return this._router.getPeerIds();
    }
};

/**
 * Invoked when a message is received.
 * @callback BOPlishClient~onMessageCallback
 * @param from {String} The sender's ID
 * @param payload {Object} The message object in JSON format.
 */

/**
 * Invoked when a connection to the P2P network has been established.
 * @callback BOPlishClient~onSuccessCallback
 */

/**
 * Invoked when a connection to the P2P network could not be established.
 * @callback BOPlishClient~onErrorCallback
 */


/**
 * Invoked when a message has been received. Useful for monitoring the complete
 * traffic passing in/out of this peer.
 * @callback BOPlishClient~monitorCallback
 * @param message {Object} The raw message in router format.
 */
