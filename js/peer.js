/** @fileOverview Represents a Peer in the network */

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
    this._heartbeatTimeout = 500;
    this._heartbeatInterval = 5000;
    this._heartbeatTimer = null;
    if (dataChannel instanceof WebSocket) {
        // fallback signaling, we dont need heartbeats for that
    } else {
        this._sendHeartbeat();
    }
};

Peer.prototype.send = function(msg) {
    try {
        this._dataChannel.send(JSON.stringify(msg));
    } catch (e) {
        throw ('Peer could not send message over datachannel:' + JSON.stringify(msg));
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

Peer.prototype._sendHeartbeat = function() {
    this.send({
        type: 'heartbeat',
        request: true
    });
};

Peer.prototype._onheartbeat = function(msg) {
    var self = this;
    if (msg.request) {
        self.send({
            type: 'heartbeat',
            response: true
        });
    } else if (msg.response) {
        // we received a response in time
        clearTimeout(self._heartbeatTimer);
        setTimeout(function() {
            self._heartbeatTimer = setTimeout(function() {
                // timeout reached, close connection
                self.onclose();
            }, self._heartbeatTimeout);
            self._sendHeartbeat();
        }, self._heartbeatInterval);
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = Peer;
}
