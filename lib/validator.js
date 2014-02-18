'use strict';

var shien = require('shien');

function Validator() {
}

Validator.prototype = new function () {

    this.validateRequired = function (v) {
        if (typeof v === 'undefined' || v === null) {
            return new Error('{field} is required.');
        }
    };

    this.validateEnum = function (e, v) {
        if (typeof v !== 'undefined' && e.indexOf(v) < 0) {
            var values = '`' + e.join('`, `') + '`',
                msg = shien.format('{field} must be one of those values: ' +
                    '{values} (without the quotes).', { values: values });
            return new Error(msg);
        }
    };

};

module.exports = new Validator;
