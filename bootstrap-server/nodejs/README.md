Node.js BOPlish Signaling Server
================================

This is a simple implementation of a signaling server needed by BOPlish applications for
joining the P2P network.

Requirements
============

* node.js
* npm

Usage
=====

From inside this directory issue the following commands:

    $ npm install
    $ node run.js 0.0.0.0 5000

The server is now up and serving bootstrap WebSocket connections on port 5000.

For deploying the [BOPlish demos](https://github.com/boplish/demos/) to this
server do the following (assuming that `BOOTSTRAP_SERVER` points to the folder of
the bootstrap server):

    $ cd $BOOTSTRAP_SERVER
    $ mkdir static
    $ cd static
    ... clone the demos repo here ...

When the server is running you'll be able to run the demos by e.g. pointing your
browser to 
[http://localhost:5000/static/demos/icnp13/client.html](http://localhost:5000/static/demos/icnp13/client.html)
for the demos we presented at ICNP 2013.
