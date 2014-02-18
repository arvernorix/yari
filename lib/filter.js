'use strict';

function Filter() {
}

Filter.prototype = new function () {

    this.trim = function (v) {
        return v;
    };

    this.lowercase = function (v) {
        return (typeof v === 'string' ? v.toLowerCase() : v);
    };

};

module.exports = new Filter;
