var Range = {
    /**
     * [start, end)
     */
    inLeftClosedInterval: function(val, start, end) {
        if (start.lesserOrEquals(end)) {
            return val.greaterOrEquals(start) && val.lesser(end);
        } else {
            return val.greaterOrEquals(start) || val.lesser(end);
        }
    },

    /**
     * (start, end]
     */
    inRightClosedInterval: function(val, start, end) {
        if (start.lesserOrEquals(end)) {
            return val.greater(start) && val.lesserOrEquals(end);
        } else {
            return val.greater(start) || val.lesserOrEquals(end);
        }
    },

    /**
     * (start, end)
     */
    inOpenInterval: function(val, start, end) {
        if (start.lesser(end)) {
            return val.greater(start) && val.lesser(end);
        } else {
            return val.greater(start) || val.lesser(end);
        }
    }
};

module.exports = Range;
