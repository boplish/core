/** @fileOverview use the BopProtocol blueprint code if you want to implement a protocol on top of a boplish network. */

/**
 * @constructor
 * @class Blueprint Code for protocols that are layered on top of a boplish core implementation
 * @param bopclient This peers instance of the connected bopclient
 */
BopProtocol = function(bopclient) {
    if (typeof BopProtocol.__instance === 'Object') {
        return BopProtocol.__instance;
    }
    this.__instance = this;
    this._bopclient = bopclient;
    this._protocolName = 'blueprint-protocol';
    this._callbacks = [];
    this._bopclient.setOnMessageHandler(this._protocolName, this._onMessage.bind(this));
    return this;
};

BopProtocol.prototype = {
    /** 
     * Adds a notify callback
     *
     * @param callback The callback function to add
     */
    addCallback: function(callback) {
        this._callbacks.push(callback);
    },

    /** 
     * Removes a notify callback
     *
     * @param callback The callback function to remove
     */
    removeCallback: function(callback) {
        var index = this._callbacks.indexOf(callback);
        if (index !== -1) {
            this._callbacks.slice(index, 1);
        }
    },

    /** 
     * Send a message to the given peer using the defined protocol.
     * Depending on the implemented protocol. This is the 
     * interface to trigger the protocol from the application and
     * should be renamed to some describing term of what the protocol
     * does (e.g. sendRequest, trigger, start ..)
     *
     * @param payload The actual message payload
     * @param to The id of the receiver
     */
    send: function(payload, to) {
        this._bopclient.send(to, this._protocolName, {
            type: 'request',
            payload: payload
        });
    },

    /** 
     * Gets called by the underlying layer. Routes the message
     * to a protocol-dependent function
     *
     * @param payload The actual message payload
     * @param to The id of the receiver
     */
    _onMessage: function(msg, from) {
        switch (msg.type) {
            case 'request':
                this._onRequestReceived(msg.payload, from);
                break;
            case 'response':
                this._onResponseReceived(msg.payload, from);
                break;
            default:
                throw Error('Message with unknown type: ' + msg.type + ' in protcol ' + this._protcolName + ' received');
        }
    },

    /** 
     * Called by the _onMessage handler if a request arrives
     *
     * @param payload The actual message payload
     * @param from The id of the sender
     */
    _onRequestReceived: function(payload, from) {
        // do something here
    },

    /** 
     * Called by the _onMessage handler if a response arrives
     *
     * @param payload The actual message payload
     * @param from The id of the sender
     */
    _onResponseReceived: function(payload, from) {
        var i;
        for (i=0; i<this._callbacks.length; i++) {
            if (typeof this._callbacks[i] === 'function') {
                this._callbacks[i](payload, from);
            }
        }
    },
};