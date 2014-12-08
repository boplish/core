var config = {
    peer: {
        // messageTimeout: 1000
    },
    connectionManager: {
        // pcoptions: { iceServers: [{
        //              "url": "stun:stun.l.google.com:19302"
        // }]},
        // dcoptions: {}
    },
    chord: {
        debug: false,
        // debug: false,
        // maxPeerConnections: 15,
        // maxFingerTableEntries: 16,
        // stabilizeInterval: 1000
        // fixFingersInterval: 1000
    },
    scribe: {
        // scribeConfig.refreshInterval: 5000
    },
    bopclient: {
        // joinDelay: 5000
        // joinTrials: 3
        // bopid: {random}
    }
};

module.exports = config;
