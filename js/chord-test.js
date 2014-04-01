var Chord = require('chord/chord');
var chord = new Chord();

function run() {
    var start = new Date();
    for (var i = 1; i <= 160; i++) {
        chord._fingerTable[i].start();
    }
    var end = new Date();
    console.log(end - start);
}

run();
run();
