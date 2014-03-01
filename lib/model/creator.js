'use strict';

var inflection = require('inflection'),
    shien = require('shien'),
    when = require('when'),

    type = require('../type'),
    filter = require('../filter'),
    validation = require('../validation'),
    BaseModel = require('./base').BaseModel;

function ModelCreator(db, modelize, name, opts) {
    var o = opts || {};

    this.db = db;
    this.modelize = modelize;

    this.model = function () {
        BaseModel.apply(this, arguments);
    };

    shien.assign(this.model, BaseModel);
    shien.assign(this.model.prototype, BaseModel.prototype);

    this.model.modelName = name;

    var cn = o.collection || inflection.pluralize(name);
    cn = inflection.camelize(cn, true);

    this.model.collectionName = cn;
    this.model.collection = db.collection(cn);

    this.filters = [];
    this.validations = [];
}

ModelCreator.prototype = new function () {
    /* jshint latedef: nofunc */

    var addons = [{
            singular: 'filter',
            plural: 'filters',
            verb: 'filter',
            handler: filter,
            arrayMethod: applyArrayFiltering
        }, {
            singular: 'validation',
            plural: 'validations',
            verb: 'validate',
            handler: validation,
            arrayMethod: applyArrayValidation
        }],

        singularToPlural = {};

    addons.forEach(function (addon) {
        singularToPlural[addon.singular] = addon.plural;
    });

    this.constant = function (constants) {
        shien.assign(this, constants);
        shien.assign(this.model, constants);
    };

    this.schema = function (schema) {
        for (var prop in schema) {
            if (schema.hasOwnProperty(prop)) {
                this.property(prop, schema[prop]);
            }
        }
    };

    this.property = function (path, property) {
        if (typeof path !== 'string') {
            throw new Error('Invalid property path!');
        }

        var t = type.get(property);

        if (t) {
            property = {
                type: property
            };

        } else if (typeof property !== 'object') {
            throw new Error('Bad property!');
        }

        t || (t = type.get(property.type));

        if (!t) {
            defineNestedProperty.call(this, path, property);
            return;
        }

        if (!property.humanized) {
            var h = path;

            h = h.replace(/\.0(\.|$)/, '\'s element$1');
            h = h.replace('.', ' ');
            h = inflection.transform(h, [ 'tableize', 'singularize' ]);
            h = inflection.humanize(h, true);

            property.humanized = h;
        }

        defineSimpleProperty.call(this, path, property);

        if (t === type.CustomArray) {
            defineArrayProperty.call(this, path, property);
        }

        // TODO: Indexes and more validations
    };

    function defineNestedProperty(path, property) {
        /* jshint validthis: true */

        for (var prop in property) {
            if (property.hasOwnProperty(prop)) {
                this.property(path + '.' + prop, property[prop]);
            }
        }
    }

    function defineSimpleProperty(path, property) {
        /* jshint validthis: true */

        var t = type.get(property.type);

        if (property.required) {
            this.validations.push({
                path: path,
                humanized: property.humanized,
                method: validation.validateRequired
            });
        }

        if (Array.isArray(property.enum)) {
            var e = property.enum.filter(function iterateEnumerationValues(item) {
                return item;
            });

            if (!e.length) {
                throw new Error('Empty enumeration array!');
            }

            this.validations.push({
                path: path,
                humanized: property.humanized,
                method: validation.validateEnum.bind(validation, e, property.translate)
            });
        }

        property.bypass || (property.bypass = []);

        addons.forEach(function iterateAddonTypes(addon) {
            // Filter and validation of the type of the property itself
            if (property.bypass.indexOf(addon.singular) < 0 &&
                    typeof t[addon.verb] === 'function') {
                this[addon.plural].push({
                    path: path,
                    humanized: property.humanized,
                    method: t[addon.verb]
                });
            }

            // Additional user-defined filters and validations
            var udas = property[addon.plural];

            if (!Array.isArray(udas)) {
                udas = (udas ? [ udas ] : []);
            }

            udas.forEach(function iterateUserDefinedAddons(uda) {
                var method;
                if (typeof uda === 'string') {
                    method = addon.handler[uda];
                } else {
                    method = uda;
                }

                if (typeof method === 'function') {
                    this[addon.plural].push({
                        path: path,
                        humanized: property.humanized,
                        method: method
                    });
                }
            }, this);
        }, this);
    }

    function defineArrayProperty(path, property) {
        /* jshint validthis: true */

        if (property.type.length !== 1) {
            throw new Error('Bad array property');
        }

        var count = {};

        addons.forEach(function iterateAddonTypes(addon) {
            count[addon.plural] = this[addon.plural].length;
        }, this);

        this.property(path + '.0', property.type[0]);

        addons.forEach(function iterateAddonTypes(addon) {
            var arrayAddons = this[addon.plural].splice(count[addon.plural]);
            if (!arrayAddons.length) {
                return;
            }

            var prefixPattern = '^' + path.replace('.', '\\.') + '\\.0\\.?',
                prefixRegex = new RegExp(prefixPattern);

            arrayAddons.forEach(function (arrayAddon) {
                arrayAddon.path = arrayAddon.path.replace(prefixRegex, '');
            });

            this[addon.plural].push({
                path: path,
                humanized: property.humanized,
                method: addon.arrayMethod.bind(self, arrayAddons)
            });
        }, this);
    }

    this.belongsTo = function (target, opts) {
    };

    /*
    this.belongsTo = function (target, options) {
        var self = this,

            opts = options || {},
            field = opts.name || target,
            fn = 'get' + field.charAt(0).toUpperCase() + field.substring(1);

        if (this._model[fn]) {
            throw new Error('Conflicted method!');
        }

        this._model[fn] = function (callback) {
            var model = self._rix.model(target);
            model.findById(self._model[field], callback);
        };
    };
    */

    this.hasOne = function (target, opts) {
    };

    this.hasMany = function (target, opts) {
    };

    this.index = function () {
    };

    this.plugin = function () {
    };

    this.get = function (path, fn) {
    };

    this.set = function (path, fn) {
    };

    this.method = function (method, fn) {
        var modelProto = this.model.prototype;

        if (modelProto[method]) {
            throw new Error('Conflicted, method name is already used!')
        }

        modelProto[method] = fn;
    };

    function applyFiltering(obj, filters, allowedRoot) {
        filters.forEach(function (filter) {
            var v = shien.object.get(obj, filter.path);

            if (typeof v !== 'undefined') {
                v = filter.method(v);
            }

            if (typeof v !== 'undefined') {
                if (filter.path.length) {
                    shien.object.set(obj, filter.path, v);
                } else if (allowedRoot) {
                    obj = v;
                }
            }
        });

        return obj;
    }

    function applyValidation(obj, validations) {
        var promises = [];

        validations.forEach(function (validation) {
            var v = shien.object.get(obj, validation.path),
                ret = validation.method(v);

            ret = when.resolve(ret)
                .then(function transformMessage(err) {
                    if (err instanceof Error) {
                        err.message = shien.format(err.message, { field: validation.humanized });
                    }
                    return err;
                });

            promises.push(ret);
        });

        return processErrorPromises(promises);
    }

    function applyArrayFiltering(filters, v) {
        if (!Array.isArray(v)) {
            return;
        }

        return v.map(function (item) {
            if (typeof item !== 'undefined') {
                return applyFiltering(item, filters, true);
            }
        });
    }

    function applyArrayValidation(validations, v) {
        if (!Array.isArray(v)) {
            return;
        }

        var promises = [];

        v.forEach(function (item) {
            promises.push(
                applyValidation(item, validations)
            );
        });

        return processErrorPromises(promises);
    }

    function processErrorPromises(promises) {
        return when.settle(promises)
            .then(function mergeValues(descriptors) {
                var errs = [];

                descriptors.forEach(function (descriptor) {
                    errs = errs.concat(descriptor.value || descriptor.reason);
                });

                return errs;
            })
            .then(function truncateEmptyValues(errs) {
                return errs.filter(function (err) {
                    return err;
                });
            });
    }

    this.create = function () {
        var self = this;

        this.model.normalize = function (obj) {
            return applyFiltering(obj, self.filters);
        };

        this.model.validate = function (obj) {
            this.normalize(obj);
            return applyValidation(obj, self.validations);
        };

        this.model.prototype.normalize = function () {
            return self.model.normalize(this);
        };

        this.model.prototype.validate = function () {
            return self.model.validate(this);
        };

        return this.model;
    };

};

exports.ModelCreator = ModelCreator;
