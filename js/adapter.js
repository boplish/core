/*global navigator, document, console, window */

/**
 * @fileOverview
 * <p>
 * Adapter code for handling browser differences.
 * </p>
 * <p>
 * Original version retrieved from <a href="https://apprtc.appspot.com/js/adapter.js">https://apprtc.appspot.com/js/adapter.js</a>.
 * </p>
 */

var RTCPeerConnection = null;
var getUserMedia = null;
var attachMediaStream = null;
var reattachMediaStream = null;
var webrtcDetectedBrowser = null;
var webrtcDetectedVersion = null;

function trace(text) {
    // This function is used for logging.
    if (text[text.length - 1] === '\n') {
        text = text.substring(0, text.length - 1);
    }
    console.log((performance.now() / 1000).toFixed(3) + ": " + text);
}

if (typeof(process) !== 'undefined' && process.title === 'node') {
    console.log("This appears to be Node.js");

    var webrtc = require('wrtc');
    var util = require('util');
    var WebSocketClient = require('websocket').client;

    RTCPeerConnection = function() {
        webrtc.RTCPeerConnection.call(this);
        var that = this;
        (function checkIceState(){
            setTimeout(function(){
                if (that.iceGatheringState === 'complete') {
                    that.onicecandidate(null);
                } else {
                    checkIceState();
                }
            }, 1000).unref();
        })(); // miserable hack, waiting for https://github.com/js-platform/node-webrtc/issues/44
    }
    util.inherits(RTCPeerConnection, webrtc.RTCPeerConnection);

    GLOBAL.RTCPeerConnection = RTCPeerConnection;
    GLOBAL.RTCIceCandidate = webrtc.RTCIceCandidate;
    GLOBAL.RTCSessionDescription = webrtc.RTCSessionDescription;
    GLOBAL.DataChannel = webrtc.DataChannel;

    WebSocket = function (url){
        WebSocketClient.call(this);
        this.onopen = function(){};
        this.onerror = function(){};
        this.onmessage = function(){};
        this.send = function(){};
        this.on('connect', function(connection){
            connection.on('message', function(msg){
                msg.data = msg.utf8Data;
                this.onmessage(msg);
            }.bind(this));
            this.send = function(msg) {
                connection.send(msg);
            };
            this.onopen();
        });
        this.on('error', this.onerror);
        process.nextTick(function(){ // break event loop to set onopen callback
            this.connect(url)
        }.bind(this));
    }
    util.inherits(WebSocket, WebSocketClient);

    GLOBAL.WebSocket = WebSocket;
} else if (typeof(navigator) !== 'undefined' && navigator.mozGetUserMedia) {
    console.log("This appears to be Firefox");

    webrtcDetectedBrowser = "firefox";

    webrtcDetectedVersion =
        parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);

    // The RTCPeerConnection object.
    RTCPeerConnection = mozRTCPeerConnection;

    // The RTCSessionDescription object.
    RTCSessionDescription = mozRTCSessionDescription;

    // The RTCIceCandidate object.
    RTCIceCandidate = mozRTCIceCandidate;

    // Get UserMedia (only difference is the prefix).
    // Code from Adam Barth.
    getUserMedia = navigator.mozGetUserMedia.bind(navigator);

    // Creates iceServer from the url for FF.
    createIceServer = function(url, username, password) {
        var iceServer = null;
        var url_parts = url.split(':');
        if (url_parts[0].indexOf('stun') === 0) {
            // Create iceServer with stun url.
            iceServer = {
                'url': url
            };
        } else if (url_parts[0].indexOf('turn') === 0 &&
            (url.indexOf('transport=udp') !== -1 ||
                url.indexOf('?transport') === -1)) {
            // Create iceServer with turn url.
            // Ignore the transport parameter from TURN url.
            var turn_url_parts = url.split("?");
            iceServer = {
                'url': turn_url_parts[0],
                'credential': password,
                'username': username
            };
        }
        return iceServer;
    };

    // Attach a media stream to an element.
    attachMediaStream = function(element, stream) {
        console.log("Attaching media stream");
        element.mozSrcObject = stream;
        element.play();
    };

    reattachMediaStream = function(to, from) {
        console.log("Reattaching media stream");
        to.mozSrcObject = from.mozSrcObject;
        to.play();
    };

    // Fake get{Video,Audio}Tracks
    MediaStream.prototype.getVideoTracks = function() {
        return [];
    };

    MediaStream.prototype.getAudioTracks = function() {
        return [];
    };
} else if (typeof(navigator) !== 'undefined' && navigator.webkitGetUserMedia) {
    console.log("This appears to be Chrome");

    webrtcDetectedBrowser = "chrome";
    webrtcDetectedVersion =
        parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2], 10);

    // Creates iceServer from the url for Chrome.
    createIceServer = function(url, username, password) {
        var iceServer = null;
        var url_parts = url.split(':');
        if (url_parts[0].indexOf('stun') === 0) {
            // Create iceServer with stun url.
            iceServer = {
                'url': url
            };
        } else if (url_parts[0].indexOf('turn') === 0) {
            if (webrtcDetectedVersion < 28) {
                // For pre-M28 chrome versions use old TURN format.
                var url_turn_parts = url.split("turn:");
                iceServer = {
                    'url': 'turn:' + username + '@' + url_turn_parts[1],
                    'credential': password
                };
            } else {
                // For Chrome M28 & above use new TURN format.
                iceServer = {
                    'url': url,
                    'credential': password,
                    'username': username
                };
            }
        }
        return iceServer;
    };

    // The RTCPeerConnection object.
    RTCPeerConnection = webkitRTCPeerConnection;

    // Get UserMedia (only difference is the prefix).
    // Code from Adam Barth.
    getUserMedia = navigator.webkitGetUserMedia.bind(navigator);

    // Attach a media stream to an element.
    attachMediaStream = function(element, stream) {
        if (typeof element.srcObject !== 'undefined') {
            element.srcObject = stream;
        } else if (typeof element.mozSrcObject !== 'undefined') {
            element.mozSrcObject = stream;
        } else if (typeof element.src !== 'undefined') {
            element.src = URL.createObjectURL(stream);
        } else {
            console.log('Error attaching stream to element.');
        }
    };

    reattachMediaStream = function(to, from) {
        to.src = from.src;
    };

    // The representation of tracks in a stream is changed in M26.
    // Unify them for earlier Chrome versions in the coexisting period.
    if (!webkitMediaStream.prototype.getVideoTracks) {
        webkitMediaStream.prototype.getVideoTracks = function() {
            return this.videoTracks;
        };
        webkitMediaStream.prototype.getAudioTracks = function() {
            return this.audioTracks;
        };
    }

    // New syntax of getXXXStreams method in M26.
    if (!webkitRTCPeerConnection.prototype.getLocalStreams) {
        webkitRTCPeerConnection.prototype.getLocalStreams = function() {
            return this.localStreams;
        };
        webkitRTCPeerConnection.prototype.getRemoteStreams = function() {
            return this.remoteStreams;
        };
    }
} else {
    console.log("Browser does not appear to be WebRTC-capable");
}
