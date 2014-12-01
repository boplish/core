/** @fileOverview URI parsing functionality for BOPlish URIs */

/**
 * @constructor
 * @class BOPlish URI class. Parses BOPlish URIs and allows access to the
 * different components.
 *
 * @param str the URI string to parse
 */
var BopURI = function(str) {

    if (!(this instanceof BopURI)) {
        return new BopURI(str);
    }

    var pathSepIdx = str.indexOf('/');
    var prefix = str.slice(0, pathSepIdx);

    var prefixArr = prefix.split(":");
    this.scheme = prefixArr[0];
    if (this.scheme !== 'bop') {
        throw new Error('Tried to create URI with unknown scheme: ' + this.scheme);
    }
    this.uid = prefixArr[1];
    this.protocol = prefixArr[2];

    if (pathSepIdx != -1) {
        var suffix = str.slice(pathSepIdx);
        var querySepIdx = suffix.indexOf('?');
        if (querySepIdx == -1) {
            this.path = suffix;
        } else {
            this.path = suffix.slice(0, querySepIdx);
            this.query = suffix.slice(querySepIdx + 1);
        }
    }
    if (this.scheme === undefined || this.uid === undefined || this.protocol === undefined) {
        throw new Error('Tried to create URI from wrongly formatted string');
    }

    return this;
};

BopURI.create = function(authority, protocol, path, query) {
    return new BopURI('bop:' + authority + ':' + protocol + "/" + encodeURIComponent(path[0] === '/' ? path.substr(1) : path) + (query ? '?' + query : ''));
};

BopURI.prototype = {
    toString: function() {
        return this.scheme + ":" + this.uid + ":" + this.protocol + this.path + (this.query ? "?" + this.query : "");
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = BopURI;
}
