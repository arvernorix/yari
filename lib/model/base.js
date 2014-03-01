'use strict';

var shien = require('shien'),

    when = require('when'),
    nodeFn = require('when/node/function'),

    ObjectId = require('../type').ObjectId,
    Query = require('../query').Query;

function BaseModel(obj) {
    shien.assign(this, obj);

    if (!this._id) {
        this._id = new ObjectId();
    }
}

shien.assign(BaseModel, new function () {

    function convertToId(id) {
        return (id instanceof ObjectId ? id : new ObjectId(id));
    }

    this.find = function (cond) {
        return new Query(this.collection, cond);
    };

    this.findOne = function (cond) {
        return new Query(this.collection, cond, true);
    };

    this.findById = function (id) {
        return this.findOne({
            _id: convertToId(id)
        });
    };

    this.findByIds = function (ids) {
        if (!Array.isArray(ids)) {
            throw new Error('Bad ID array!');
        }

        return this.find({
            _id: { $in: ids.map(convertToId) }
        });
    };

    function count(crit, single) {
        /* jshint validthis: true */

        var fn = this.collection.count.bind(this.collection),
            args = [],
            opts = {};

        if (typeof crit !== 'undefined') {
            args.push(crit);
        }

        if (single) {
            opts.limit = 1;
        }

        args.push(opts);

        return nodeFn.apply(fn, args);
    }

    this.count = function (crit) {
        return count.call(this, crit);
    };

    this.countOne = function (crit) {
        return count.call(this, crit, true);
    }

    this.insert = function (docs) {
        var fn = this.collection.insert.bind(this.collection),
            p = nodeFn.call(fn, docs, { w: 1 });

        if (!Array.isArray(docs)) {
            p = p.then(function (docs) {
                return (Array.isArray(docs) && docs.length ? docs[0] : docs);
            });
        }

        return p;
    };

    function update(crit, update, multi) {
        /* jshint validthis: true */

        var fn = this.collection.update.bind(this.collection),
            opts = { w: 1 };

        if (multi) {
            opts.multi = true;
        }

        return nodeFn.call(fn, crit, update, opts);
    }

    this.update = function (crit, update) {
        return update.call(this, crit, update);
    };

    this.updateMulti = function (crit, update) {
        return update.call(this, crit, update, true);
    };

    this.save = function (doc) {
        var fn = this.collection.save.bind(this.collection);
        return nodeFn.call(fn, doc, { w: 1 });
    };

    function remove(crit, single) {
        /* jshint validthis: true */

        var args = [],
            opts = { w: 1 };

        if (typeof crit !== 'undefined') {
            args.push(crit);
        }

        if (single) {
            opts.single = true;
        }

        args.push(opts);

        return when.promise(function (resolve, reject) {
            args.push(function (err, res) {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });

            this.collection.remove.apply(this.collection, args);
        });
    }

    this.remove = function (crit) {
        remove.call(this, crit);
    };

    this.removeOne = function (crit) {
        remove.call(this, crit, true);
    };

});

BaseModel.prototype = new function () {

    function getBaseModel() {
        /* jshint proto: true, validthis: true */
        return this.__proto__.constructor;
    }

};

exports.BaseModel = BaseModel;
