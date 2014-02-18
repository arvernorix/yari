'use strict';

var shien = require('shien'),
    type = require('../type');

function BaseModel(obj) {
    shien.merge(this, obj);

    if (!this._id) {
        this._id = new type.ObjectId();
    }
}

exports.BaseModel = BaseModel;
