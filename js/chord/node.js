var Node = function(id, dc) {
    if (!(this instanceof Node)) {
        return new Node();
    }

    this.finger_table = [];

    return this;
    
};

Node.prototype = {

    message_types: {
        GET_SUCCESSOR: 0,
        FIND_SUCCESSOR: 1,
        FIND_PREDECESSOR: 2,
        FIND_CLOSEST_PRECEDING_FINGER: 3,
    },

    find_successor: function (id) {
    },


};


if (typeof(module) !== 'undefined') {
    module.exports = Node;
}
