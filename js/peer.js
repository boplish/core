/** @fileOverview Represents a Peer in the network */

var peerConfig = require('./config.js').peer;

/**
 * @constructor
 * @class Represents a foreign Peer. Used by {@link Router} instances to route
 * messages from one Peer to another. Control over a Peer lies in the hand of a
 * {@link ConnectionManager} instance.
 *
 * @param id {String}
 * @param peerConnection {RTCPeerConnection} The PeerConnection to the remote peer.
 * @param dataChannel {DataChannel} The DataChannel to the remote peer.
 */
var Peer = function(id, peerConnection, dataChannel) {
    if (!(this instanceof Peer)) {
        return new Peer(id, peerConnection, dataChannel);
    }
    this.id = id;
    this._peerConnection = peerConnection;
    this._dataChannel = dataChannel;
    this._dataChannel.onmessage = this._onmessage.bind(this);
    this._heartbeatDefaultTimer = peerConfig.messageTimeout || 1000;
    this._heartbeatCallbacks = {};
};

Peer.prototype.send = function(msg) {
    var stringifiedMsg = JSON.stringify(msg);
    try {
        this._dataChannel.send(stringifiedMsg);
    } catch (e) {
        throw new Error('Peer could not send message over datachannel: \'' + stringifiedMsg + '\'; Cause: ' + e.name + ': ' + e.message);
    }
};

Peer.prototype._onmessage = function(rawMsg) {
    var msg;
    try {
        msg = JSON.parse(rawMsg.data);
    } catch (e) {
        console.log('Cannot parse message', rawMsg);
    }
    if (msg.type === 'heartbeat') {
        this._onheartbeat(msg);
    } else {
        this.onmessage(msg);
    }
};

Peer.prototype.onmessage = function() {
    // overwrite
};

Peer.prototype.onclose = function() {
    // overwrite
};

Peer.prototype.sendHeartbeat = function(cb, timeout) {
    var self = this;
    var randomnumber = Math.floor(Math.random() * 100001);
    self._heartbeatCallbacks[randomnumber] = cb;
    try {
        self.send({
            type: 'heartbeat',
            request: true,
            sqnr: randomnumber
        });
    } catch (e) {
        // sweep this under the table as the error is handled by the timeout
    }
    setTimeout(function() {
        if (self._heartbeatCallbacks[randomnumber]) {
            self._heartbeatCallbacks[randomnumber]('Peer unreachable');
        }
    }, timeout || self._heartbeatDefaultTimer);
};

Peer.prototype._onheartbeat = function(msg) {
    var self = this;
    if (msg.request) {
        self.send({
            type: 'heartbeat',
            response: true,
            sqnr: msg.sqnr
        });
    } else if (msg.response) {
        self._heartbeatCallbacks[msg.sqnr]();
        delete self._heartbeatCallbacks[msg.sqnr];
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = Peer;
}
