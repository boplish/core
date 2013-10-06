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
Peer = function(id, peerConnection, dataChannel) {
    if(!(this instanceof Peer)) {
        return new Peer(id, peerConnection, dataChannel);
    }
    this.id = id;
    this.peerConnection = peerConnection;
    this.dataChannel = dataChannel;
};

if(typeof(module) !== 'undefined') {
    module.exports = Peer;
}
