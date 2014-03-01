'use strict';

var when = require('when'),
    shien = require('shien'),

    util = require('./util'),
    Connection = require('./connection').Connection,
    type = require('./type'),
    ModelCreator = require('./model/creator').ModelCreator;

function Yari() {
    this.models = {};
}

Yari.prototype = new function () {

    shien.enhance(this, util);

    // Add type constants to Yari
    type.types.forEach(function iterateTypeNames(typeName) {
        this[typeName] = type[typeName];
    }, this);

    this.connect = function (settings, opts) {
        var self = this;

        this.connection = new Connection(settings, opts);

        return when.resolve(this.connection.open())
            .then(function openedConnectionSuccessfully(db) {
                self.db = db;
            })
            .yield(this);
    };

    this.modelize = function (name, creator, opts) {
        if (arguments.length === 1) {
            return this.models[name];
        }

        var c = new ModelCreator(this.db, this.modelize.bind(this), name, opts);
        creator.call(c);

        var model = c.create();

        return (this.models[name] = model);
    };

};

module.exports = new Yari;
