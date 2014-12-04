BOPlish Core
============

[![Build Status](https://travis-ci.org/boplish/core.svg?branch=master)](https://travis-ci.org/boplish/core)

Browser-based Open Publishing (BOPlish) is an infrastructure-independent content
sharing facility using WebRTC DataChannels. This repository holds the core
library for establishing a Browser-based Peer-to-Peer Network. It handles
connection maintenance and routing.

For some demo applications using BOPlish refer to
    [https://github.com/boplish/demos/](https://github.com/boplish/demos/).

**The code on this branch is deemed stable and doesn't change much. To gain
insight into our latest development, have a look at the [develop
branch](https://github.com/boplish/core/tree/develop).**

Requirements
============

* [Node.js and npm](http://nodejs.org/download/)

Usage
=====

The main component consists of a JavaScript library. To build a minimal
JavaScript file run

    $ sudo npm install -g grunt-cli
    $ npm install
    $ grunt dist

The library then resides in `dist/boplish.min.js` and can be included in your
HTML page.

Bootstrap server
================

In [bootstrap-server](bootstrap-server) you will find two sample implementations of
the bootstrap signaling protocol that BOPlish mandates. This is 

* a Flask application using Python
* a Node.js application using Javascript

The bootstrap server holds WebSocket connections to existing peers in the boplish network in
order to help joining peers find initial neighbours.

Demo
=======

Visit [http://chris.ac:5000](http://chris.ac:5000) using a supported browser for a demo.
