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
    $ node run.js 0.0.0.0 5000 /var/www/

The server is now up serving bootstrap WebSocket connections on port 5000 and
static files from `/var/www/`.

For deploying the [BOPlish demos](https://github.com/boplish/demos/) to this
server just clone the demos repo and point the bootstrap server to the folder on
your local file system instead of `/var/www/`.

When the server is running you'll be able to run the demos by e.g. pointing your
browser to 
[http://localhost:5000/icnp13/client.html](http://localhost:5000/icnp13/client.html)
for the demos we presented at ICNP 2013.
