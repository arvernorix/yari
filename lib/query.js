'use strict';

var shien = require('shien'),
    when = require('when'),
    nodeFn = require('when/node/function');

function Query(coll, crit, single) {
    this.collection = coll;

    this.criteria = crit || {};
    this.fields = null;
    this.options = {};

    this.single = (single ? true : false);

    if (!this.single) {
        this.options.limit = 20;
    }
}

Query.prototype = new function () {

    this.select = function (fields) {
        if (typeof fields === 'string') {
            fields = fields.split(' ');
        }

        if (!Array.isArray(fields)) {
            throw new Error('Bad fields to select!');
        }

        this.fields = {};

        fields.forEach(function (field) {
            this.fields[field] = true;
        }, this);

        return this;
    };

    this.sort = function (cond) {
        if (typeof cond === 'string') {
            this.sorting = cond;
            return this;
        }

        if (typeof cond !== 'object') {
            throw new Error('Bad sorting condition!');
        }

        var sort = [];

        for (var prop in cond) {
            if (cond.hasOwnProperty(prop)) {
                var dir = cond[prop];
                if (dir !== 'asc' && dir !== 'desc') {
                    throw new Error('Bad sorting direction!');
                }

                sort.push([ prop, dir ]);
            }
        }

        this.opts.sort = sort;

        return this;
    };

    this.limit = function (num) {
        if (this.single) {
            throw new Error('Cannot set limit when querying for a single document!');
        }

        if (typeof num !== 'number') {
            throw new Error('Bad querying limit!');
        }

        this.options.limit = num;

        return this;
    };

    this.skip = function (num) {
        if (typeof num !== 'number') {
            throw new Error('Bad querying skipping!');
        }

        this.options.skip = num;

        return this;
    };

    this.exec = function () {
        var self = this,
            args = getArguments.call(this);

        if (this.single) {
            return when.promise(function (resolve, reject) {
                args.push(function (err, res) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });

                executeFunction.call(self, args);
            });

        } else {
            var q = executeFunction.call(this, args);
            return nodeFn.call(q.toArray.bind(q));
        }
    };

    this.stream = function () {
        if (this.single) {
            throw new Error('Cannot stream when querying for a single document!');
        }

        var args = getArguments.call(this);

        return executeFunction.call(this, args)
            .stream();
    };

    function getArguments() {
        /* jshint validthis: true */

        var args = [ this.criteria ];

        if (this.fields) {
            args.push(this.fields);
        }

        if (!shien.object.isEmpty(this.options)) {
            args.push(this.options);
        }

        return args;
    }

    function executeFunction(args) {
        /* jshint validthis: true */
        return this.collection[this.single ? 'findOne' : 'find']
            .apply(this.collection, args);
    }

};

exports.Query = Query;
