var Server = require('./server');
var Chord = require('../js/chord/chord');
var BigInteger = require('../js/third_party/BigInteger');
var ChordNode = require('../js/chord/node');

var ids = [];
var chords = [];
var joined = [];

Array.prototype.contains = function(elem) {
    return this.reduce(function(prev, cur, idx, arr) {
        if (cur.equals(elem)) {
            return prev += 1;
        } else {
            return prev;
        }
    }, 0) !== 0;
};

for (var i = 0; i < 30; i++) {
    var rnd;
    do {
        rnd = Math.floor(Math.random() * 256);
    } while (ids.contains(rnd));
    ids.push(new BigInteger(rnd));
}

ids.forEach(function(id) {
    var chord;
    var server = new Server(id);
    server.onconnect = function(from) {
        chord.addPeer(from, function() {
            console.log("added peer " + from.id + " to " + id);
        });
    };
    chord = new Chord(id, server, server);
    chords.push(chord);
});

chords[0].create(function() {});
joined.push(chords[0]);

for (var i = 1; i < chords.length; i++) {
    var bootstrapId = ids[Math.floor(Math.random() * i)];
    //chords[i].join(bootstrapId, printData.bind(this, chords[i], chords[i]._localNode.id(), bootstrapId));
    chords[i].join(bootstrapId, debug.bind(this, chords[i], chords[i]._localNode.id(), bootstrapId));
}

function debug(chord, id, bootstrapId, err, res) {
    joined.push(chord);
    joined.forEach(function(chord) {
        console.log(chord._localNode.toString());
        console.log("[" + chord._localNode._peer.id + "] has " + Object.keys(chord._remotes).length + " remotes ");
    });
    if (joined.length === chords.length) {
        var k = new BigInteger(Math.floor(Math.random() * 256));
        chords[5].put(k, {
            a: Math.random(),
            b: Math.random()
        }, function(err) {
            chords[1].get(k, function(err2, v) {
                console.log("//{" + k + ": " + JSON.stringify(v) + "}");
            });
        });
        var to = chords[3].id;
        chords[3].registerDeliveryCallback("signaling", function(msg) {
            console.log("Incoming 'signaling' message", msg);
        });
        chords[9].route(to, {
            type: "signaling",
            to: 1,
            from: 2,
            payload: {
                type: "offer",
                offer: "OFFER SDP"
            }
        }, function(err) {
            if (err) {
                console.log("Error routing to", to.toString(), err);
            } else {
                console.log("routing successful");
            }
        });
    }
}

function printData(chord, id, bootstrapId, err, res) {
    joined.push(chord);
    var joinedIds = [];
    var max = 255;
    if (joined.length === chords.length) {
        joined.forEach(function(chord) {
            joinedIds.push({
                id: chord._localNode.id(),
                successor: chord._localNode.successor_id(),
                predecessor: chord._localNode.predecessor_id()
            });
        });
        console.log("var max = " + max + ";");
        console.log("var data = ");
        var sorted = joinedIds.sort(function(a, b) {
            return a.id - b.id;
        });
        for (var i = 0; i < sorted.length - 1; i++) {
            if (!sorted[i].successor.equals(sorted[i + 1].id)) {
                console.log("Successor of " + sorted[i].id.toString() + " is wrong");
            }
        }
        console.log(";");
        /*

        */

    }
}
