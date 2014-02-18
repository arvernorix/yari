'use strict';

function Util() {
}

Util.prototype = new function () {

    function translate(obj, term) {
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop) && term === obj[prop][0]) {
                return obj[prop][1];
            }
        }
    }

    this.enum = function (obj) {
        obj = obj || {};

        var ret = {},
            e = [];

        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                ret[prop] = obj[prop][0];
                e.push(obj[prop][0]);
            }
        }

        ret.enum = e;
        ret.translate = translate.bind(this, obj);

        return ret;
    };

};

module.exports = new Util;
