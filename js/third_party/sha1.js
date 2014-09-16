// Copyright 2005 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview SHA-1 cryptographic hash.
 * Variable names follow the notation in FIPS PUB 180-3:
 * http://csrc.nist.gov/publications/fips/fips180-3/fips180-3_final.pdf.
 *
 * Usage:
 *   var sha1 = new sha1();
 *   sha1.update(bytes);
 *   var hash = sha1.digest();
 *
 * Performance:
 *   Chrome 23:   ~400 Mbit/s
 *   Firefox 16:  ~250 Mbit/s
 *
 */

var BigInteger = require('./BigInteger');

/**
 * SHA-1 cryptographic hash constructor.
 *
 * The properties declared here are discussed in the above algorithm document.
 * @constructor
 */
var sha1 = function() {

    /**
     * Holds the previous values of accumulated variables a-e in the compress_
     * function.
     * @type {Array.<number>}
     * @private
     */
    this.chain_ = [];

    /**
     * A buffer holding the partially computed hash result.
     * @type {Array.<number>}
     * @private
     */
    this.buf_ = [];

    /**
     * An array of 80 bytes, each a part of the message to be hashed.  Referred to
     * as the message schedule in the docs.
     * @type {Array.<number>}
     * @private
     */
    this.W_ = [];

    /**
     * Contains data needed to pad messages less than 64 bytes.
     * @type {Array.<number>}
     * @private
     */
    this.pad_ = [];

    this.pad_[0] = 128;
    for (var i = 1; i < 64; ++i) {
        this.pad_[i] = 0;
    }

    this.reset();
};


/** @override */
sha1.prototype.reset = function() {
    this.chain_[0] = 0x67452301;
    this.chain_[1] = 0xefcdab89;
    this.chain_[2] = 0x98badcfe;
    this.chain_[3] = 0x10325476;
    this.chain_[4] = 0xc3d2e1f0;

    this.inbuf_ = 0;
    this.total_ = 0;
};


/**
 * Internal compress helper function.
 * @param {Array.<number>|Uint8Array|string} buf Block to compress.
 * @param {number=} opt_offset Offset of the block in the buffer.
 * @private
 */
sha1.prototype.compress_ = function(buf, opt_offset) {
    if (!opt_offset) {
        opt_offset = 0;
    }

    var W = this.W_,
        i, t;

    // get 16 big endian words
    if (typeof(buf) === 'string') {
        for (i = 0; i < 16; i++) {
            W[i] = (buf.charCodeAt(opt_offset++) << 24) |
                (buf.charCodeAt(opt_offset++) << 16) |
                (buf.charCodeAt(opt_offset++) << 8) |
                (buf.charCodeAt(opt_offset++));
        }
    } else {
        for (i = 0; i < 16; i++) {
            W[i] = (buf[opt_offset++] << 24) |
                (buf[opt_offset++] << 16) |
                (buf[opt_offset++] << 8) |
                (buf[opt_offset++]);
        }
    }

    // expand to 80 words
    for (i = 16; i < 80; i++) {
        t = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16];
        W[i] = ((t << 1) | (t >>> 31)) & 0xffffffff;
    }

    var a = this.chain_[0];
    var b = this.chain_[1];
    var c = this.chain_[2];
    var d = this.chain_[3];
    var e = this.chain_[4];
    var f, k;

    // TODO(user): Try to unroll this loop to speed up the computation.
    for (i = 0; i < 80; i++) {
        if (i < 40) {
            if (i < 20) {
                f = d ^ (b & (c ^ d));
                k = 0x5a827999;
            } else {
                f = b ^ c ^ d;
                k = 0x6ed9eba1;
            }
        } else {
            if (i < 60) {
                f = (b & c) | (d & (b | c));
                k = 0x8f1bbcdc;
            } else {
                f = b ^ c ^ d;
                k = 0xca62c1d6;
            }
        }

        t = (((a << 5) | (a >>> 27)) + f + e + k + W[i]) & 0xffffffff;
        e = d;
        d = c;
        c = ((b << 30) | (b >>> 2)) & 0xffffffff;
        b = a;
        a = t;
    }

    this.chain_[0] = (this.chain_[0] + a) & 0xffffffff;
    this.chain_[1] = (this.chain_[1] + b) & 0xffffffff;
    this.chain_[2] = (this.chain_[2] + c) & 0xffffffff;
    this.chain_[3] = (this.chain_[3] + d) & 0xffffffff;
    this.chain_[4] = (this.chain_[4] + e) & 0xffffffff;
};


/** @override */
sha1.prototype.update = function(bytes, opt_length) {
    if (opt_length === undefined) {
        opt_length = bytes.length;
    }

    var lengthMinusBlock = opt_length - 64;
    var n = 0;
    // Using local instead of member variables gives ~5% speedup on Firefox 16.
    var buf = this.buf_;
    var inbuf = this.inbuf_;

    // The outer while loop should execute at most twice.
    while (n < opt_length) {
        // When we have no data in the block to top up, we can directly process the
        // input buffer (assuming it contains sufficient data). This gives ~25%
        // speedup on Chrome 23 and ~15% speedup on Firefox 16, but requires that
        // the data is provided in large chunks (or in multiples of 64 bytes).
        if (inbuf === 0) {
            while (n <= lengthMinusBlock) {
                this.compress_(bytes, n);
                n += 64;
            }
        }

        if (typeof(bytes) === 'string') {
            while (n < opt_length) {
                buf[inbuf++] = bytes.charCodeAt(n++);
                if (inbuf == 64) {
                    this.compress_(buf);
                    inbuf = 0;
                    // Jump to the outer loop so we use the full-block optimization.
                    break;
                }
            }
        } else {
            while (n < opt_length) {
                buf[inbuf++] = bytes[n++];
                if (inbuf == 64) {
                    this.compress_(buf);
                    inbuf = 0;
                    // Jump to the outer loop so we use the full-block optimization.
                    break;
                }
            }
        }
    }

    this.inbuf_ = inbuf;
    this.total_ += opt_length;
};


/** @override */
sha1.prototype.digest = function() {
    var digest = [];
    var totalBits = this.total_ * 8;

    // Add pad 0x80 0x00*.
    if (this.inbuf_ < 56) {
        this.update(this.pad_, 56 - this.inbuf_);
    } else {
        this.update(this.pad_, 64 - (this.inbuf_ - 56));
    }

    // Add # bits.
    for (var i = 63; i >= 56; i--) {
        this.buf_[i] = totalBits & 255;
        totalBits /= 256; // Don't use bit-shifting here!
    }

    this.compress_(this.buf_);

    var n = 0;
    for (i = 0; i < 5; i++) {
        for (var j = 24; j >= 0; j -= 8) {
            digest[n++] = (this.chain_[i] >> j) & 255;
        }
    }

    return digest;
};

sha1.hexString = function(digest) {
    var res = "",
        i;
    for (i = 0; i < digest.length; i++) {
        res = res.concat(digest[i].toString(16));
    }
    return res;
};

sha1.number = function(digest) {
    var value = 0,
        i;
    for (i = digest.length - 1; i >= 0; i--) {
        value = (value * 256) + digest[i];
    }
    return value;
};

sha1.bigInteger = function(digest) {
    var value = BigInteger(),
        i;
    for (i = digest.length - 1; i >= 0; i--) {
        value = value.multiply(256).add(digest[i]);
    }
    return value;
};

sha1.bigIntHash = function(val) {
    var _sha1 = new sha1();
    _sha1.update(val);
    return sha1.bigInteger(_sha1.digest());
};

if (typeof(module) !== 'undefined') {
    module.exports = sha1;
}
