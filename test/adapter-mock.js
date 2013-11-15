/** @fileOverview Adapter code for mocking a WebRTC capable browser. */

RTCPeerConnection = function(configuration) {
  this.dataChannels = [];
};

RTCSessionDescription = function(sdp) {
  return sdp;
};

RTCIceCandidate = function() {
  throw new Error('not implemented');
};

getUserMedia = function() {
  throw new Error('not implemented');
};

RTCPeerConnection.prototype = {
  localDescription: null,
  remoteDescription: null,
  signalingState: null,
  iceGatheringState: null,
  iceConnectionState: null,
  dataChannels: null,
  remote: null,
  createDataChannelOnConnectLabel: null,
  onicecandidate: function(){},
  createOffer: function(cb_success, cb_error) {
    cb_success({obj: this, type: 'offer', sdp: "o=UA " + Math.floor(Math.random()*100)});
  },
  createAnswer: function(cb_success, cb_error) {
    cb_success({obj: this, type: 'answer', sdp: "o=UA " + Math.floor(Math.random()*100)});
  },
  setLocalDescription: function(sdp_description, cb_success, cb_error) {
    this.localDescription = {type: sdp_description.type, sdp: sdp_description.sdp};

    this.iceGatheringState = 'complete';
    this.onicecandidate({candidate:null});

    if (cb_success) {
        cb_success();
    }
  },
  setRemoteDescription: function(sdp_description, cb_success, cb_error) {
    this.remoteDescription = {type: sdp_description.type, sdp: sdp_description.sdp};
    this.remote = sdp_description.obj;
    
    // we are connected, set remote ends on all created DataChannels
    this.dataChannels.forEach(function(val, index){
      val.remote = sdp_description.obj;
    });

    if (cb_success) {
        cb_success();
    }
  },
  createDataChannel: function(label) {
    var dc = new DataChannel(label);
    // are we connected yet? if so, set remote end straight away
    if (this.remote) {
        dc.remote = this.remote;
    }
    this.dataChannels.push(dc);
    return dc;
  },
  updateIce: function() {
    throw new Error('not implemented');
  },
  addIceCandidate: function(candidate, cb_success, cb_error) {
    throw new Error('not implemented');
  },
  getLocalStreams: function() {
    throw new Error('not implemented');
  },
  getRemoteStreams: function() {
    throw new Error('not implemented');
  },
  getStreamById: function(streamId) {
    throw new Error('not implemented');
  },
  addStream: function(stream) {
    throw new Error('not implemented');
  },
  removeStream: function(stream) {
    throw new Error('not implemented');
  },
  close: function() {
    throw new Error('not implemented');
  }
};

DataChannel = function(label){
  this.label = label;
};

DataChannel.prototype = {
  remote: null,
  onmessage: function(){},
  send: function(msg) {
    // find other end dc and deliver message
    var self = this;
    var found = this.remote.dataChannels.some(function(el){
      if (el.label === self.label) {
        if (typeof(el.onmessage) === 'function') {
            el.onmessage(msg);
        }
        return true;
      }
    });
    if (!found) {
        throw Error('DataChannel Endpoint not reachable');
    }
  }
};

MockSignalingChannel = function(denied) {
    this.denied = denied;
};
MockSignalingChannel.prototype.send = function(data) {
    switch(data.payload.type) {
        case 'offer':
            if (this.denied) {
                this.onmessage({data: '{"from": "'+data.from+'", "type": "denied"}'});
            } else {
                this.onmessage({data: JSON.stringify(data)});
            }
            break;
        case 'answer':
            break;
    }
};

MockRouter = function(signalingChannel, connectionManager) {
    this.id = Math.floor(Math.random()*100);
    this.signalingChannel = signalingChannel;
    this.signalingChannel.onmessage = this.onmessage.bind(this);
    this.callbacks = [];
};
MockRouter.prototype = {
    addPeer: function(peerId) {},
    registerDeliveryCallback: function(type, cb) {
        this.callbacks[type] = cb;
    },
    route: function(to, type, payload) {
        this.signalingChannel.send({from: this.id, type: type, payload: payload});
    },
    onmessage: function(msg) {
        var packet = msg.payload;
        console.log(packet.type);
        this.callbacks[packet.type](packet.from, packet.payload);
    },
};

if(typeof(module.exports) !== 'undefined') {
    module.exports = {
      RTCPeerConnection: RTCPeerConnection,
      RTCSessionDescription: RTCSessionDescription,
      RTCIceCandidate: RTCIceCandidate,
      getUserMedia: getUserMedia,
      DataChannel: DataChannel,
      MockSignalingChannel: MockSignalingChannel,
    };
}
