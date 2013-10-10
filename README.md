BOPlish Core
============

Browser-based Open Publishing (BOPlish) is an infrastructure-independent content
sharing facility using WebRTC DataChannels. This repository holds the core
library for establishing a Browser-based Peer-to-Peer Network. It handles
connection maintenance and routing.

For some demo applications using BOPlish refer to
    [https://github.com/boplish/demos/](https://github.com/boplish/demos/).

This library currently only works on Firefox since DataChannel interoperation
between Firefox and Chrome doesn't work, yet. For interop progress have a look
at https://code.google.com/p/webrtc/issues/detail?id=2279.

Requirements
============

* [Node.js and npm](http://nodejs.org/download/)

Usage
=====

The main component consists of a JavaScript library. To build a minimal
JavaScript file run

    $ sudo npm install -g grunt-cli
    $ npm install
    $ grunt uglify

The library then resides in `dist/boplish.min.js` and can be included in your
HTML page.

Bootstrap server
================

In [bootstrap-server](bootstrap-server) you will find a simple implementation of
the bootstrap signaling protocol that BOPlish mandates. This is a Flask
application with a single WebSocket endpoint for every peer in the BOPlish P2P
network.
