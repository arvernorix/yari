'use strict';

var inflection = require('inflection'),
    shien = require('shien'),
    when = require('when'),

    type = require('../type'),
    filter = require('../filter'),
    validator = require('../validator'),
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
    this.validators = [];
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
            singular: 'validator',
            plural: 'validators',
            verb: 'validate',
            handler: validator,
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

        var self = this,
            t = type.get(property.type);

        if (property.required) {
            this.validators.push({
                path: path,
                humanized: property.humanized,
                method: validator.validateRequired
            });
        }

        if (Array.isArray(property.enum)) {
            var e = [];
            property.enum.forEach(function iterateEnumerationValues(item) {
                if (item) {
                    e.push(String(item));
                }
            });

            if (!e.length) {
                throw new Error('Empty enumeration array!');
            }

            this.validators.push({
                path: path,
                humanized: property.humanized,
                method: validator.validateEnum.bind(validator, e)
            });
        }

        property.bypass || (property.bypass = []);

        addons.forEach(function iterateAddonTypes(addon) {
            // Filter and validator of the type of the property itself
            if (property.bypass.indexOf(addon.singular) < 0 &&
                    typeof t[addon.verb] === 'function') {
                self[addon.plural].push({
                    path: path,
                    humanized: property.humanized,
                    method: t[addon.verb]
                });
            }

            // Additional user-defined filters and validators
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
                    self[addon.plural].push({
                        path: path,
                        humanized: property.humanized,
                        method: method
                    });
                }
            });
        });
    }

    function defineArrayProperty(path, property) {
        /* jshint validthis: true */

        if (property.type.length !== 1) {
            throw new Error('Bad array property');
        }

        var self = this,
            count = {};

        addons.forEach(function iterateAddonTypes(addon) {
            count[addon.plural] = self[addon.plural].length;
        });

        this.property(path + '.0', property.type[0]);

        addons.forEach(function iterateAddonTypes(addon) {
            var arrayAddons = self[addon.plural].splice(count[addon.plural]);
            if (!arrayAddons.length) {
                return;
            }

            var prefixPattern = '^' + path.replace('.', '\\.') + '\\.0\\.?',
                prefixRegExp = new RegExp(prefixPattern);

            arrayAddons.forEach(function (arrayAddon) {
                arrayAddon.path = arrayAddon.path.replace(prefixRegExp, '');
            });

            self[addon.plural].push({
                path: path,
                humanized: property.humanized,
                method: addon.arrayMethod.bind(self, arrayAddons)
            });
        });
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
    };

    function applyFiltering(obj, filters, allowedRoot) {
        filters.forEach(function (filter) {
            var v = shien.get(obj, filter.path);

            if (typeof v !== 'undefined') {
                v = filter.method(v);
            }

            if (typeof v !== 'undefined') {
                if (filter.path.length) {
                    shien.set(obj, filter.path, v);
                } else if (allowedRoot) {
                    obj = v;
                }
            }
        });

        return obj;
    }

    function applyValidation(obj, validators) {
        var promises = [];

        validators.forEach(function (validator) {
            var v = shien.get(obj, validator.path),
                ret = validator.method(v);

            ret = when.resolve(ret)
                .then(function transformMessage(err) {
                    if (err instanceof Error) {
                        err.message = shien.format(err.message, { field: validator.humanized });
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

    function applyArrayValidation(validators, v) {
        if (!Array.isArray(v)) {
            return;
        }

        var promises = [];

        v.forEach(function (item) {
            promises.push(
                applyValidation(item, validators)
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
                var ret = [];

                errs.forEach(function (err) {
                    if (err) {
                        ret.push(err);
                    }
                });

                return ret;
            });
    }

    this.create = function () {
        var self = this;

        this.model.filter = function (obj) {
            return applyFiltering(obj, self.filters);
        };

        this.model.validate = function (obj) {
            this.filter(obj);
            return applyValidation(obj, self.validators);
        };

        this.model.prototype.filter = function () {
            return self.model.filter(this);
        };

        this.model.prototype.validate = function () {
            return self.model.validate(this);
        };

        return this.model;
    };

};

exports.ModelCreator = ModelCreator;
