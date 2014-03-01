'use strict';

var yari = require('../lib/yari');

yari.connect()
    .done(function connectedSuccessfully() {

        function UserCreator() {

            this.constant({
                nameOrder: yari.enum({
                    FIRST_NAME: [ 'first', 'First name' ],
                    MIDDLE_NAME: [ 'middle', 'Middle name' ],
                    LAST_NAME: [ 'last', 'Last name' ]
                }),

                gender: yari.enum({
                    MALE: [ 'male', 'Male' ],
                    FEMALE: [ 'female', 'Female' ]
                }),

                roles: yari.enum({
                    // High-level managers
                    SUPER_ADMIN: [ 'super_admin', 'Super administrator' ],
                    ADMIN: [ 'admin', 'Administrator' ],

                    // Content staffs
                    CONTENT_MANAGER: [ 'content_manager', 'Content manager' ],
                    CONTENT_EDITOR: [ 'content_editor', 'Content editor' ],
                    CONTENT_CONTRIBUTOR: [ 'content_contributor', 'Content contributor' ],

                    // Technical staffs
                    SYS_ADMIN: [ 'sys_admin', 'System administrator' ],
                    WEB_MASTER: [ 'web_master', 'Web master' ],
                    DEVELOPER: [ 'developer', 'Developer' ],
                    TESTER: [ 'tester', 'Tester' ],

                    // Normal user
                    USER: [ 'user', 'User' ]
                })
            });

            this.schema({
                username: {
                    type: String,
                    filters: [ 'trim', 'lowercase' ],
                    required: true,
                    unique: true
                },

                firstName: {
                    type: String,
                    required: true
                },
                middleName: String,
                lastName: String,
                nameOrder: {
                    type: [{
                        type: String,
                        enum: this.nameOrder.enum,
                        translate: this.nameOrder.translate
                    }],
                    required: true,
                    // validators: validator.validateNameOrder
                },

                gender: {
                    type: String,
                    enum: this.gender.enum,
                    translate: this.gender.translate,
                    required: true
                },
                birthday: Date,

                email: {
                    type: String,
                    required: true
                },

                avatar: {
                    small: {
                        type: String,
                        humanized: 'small avatar',
                        required: true
                    },
                    medium: {
                        type: String,
                        humanized: 'medium avatar',
                        required: true
                    },
                    large: {
                        type: String,
                        humanized: 'large avatar',
                        required: true
                    },
                    xlarge: {
                        type: String,
                        humanized: 'extra large avatar',
                        required: true
                    }
                },

                timezone: {
                    type: Number,
                    required: true,
                    /* validators: [
                        validator.validateMin.bind(null, -12),
                        validator.validateMax.bind(null, 14)
                    ] */
                },

                roles: [{
                    type: String,
                    humanized: 'role',
                    enum: this.roles.enum,
                    translate: this.roles.translate,
                }],

                lastLoginAt: {
                    type: Date,
                    humanized: 'last login time',
                    required: true
                }
            });

            this.plugin('serializable');
            this.plugin('timestampable');

            this.get('name', function () {
                var parts = [];

                this.nameOrder.forEach(function (part) {
                    parts.push(this[part + 'Name']);
                }, this);

                return parts.join(' ');
            });

            this.method('touchLastLogin', function () {
                this.lastLoginAt = new Date();
            });

        }

        var User = yari.modelize('user', UserCreator),
            user = new User({
                username: 'Damn It!',
                roles: [ 'user', 1 ],
                lastLoginAt: new Date
            });

        User.findByIds([
                '5305352151d93a361428ce28',
                '5305352351d93a361428ce29',
                '5305352451d93a361428ce2a',
                '5305352551d93a361428ce2b'
            ])
            .exec()
            .then(function (users) {
                console.dir(users);
            });

        console.log(user.lastLoginAt);
        setTimeout(function () {
            user.touchLastLogin();
            console.log(user.lastLoginAt);
        }, 5000);

        user.validate()
            .then(function (errs) {
                console.dir(errs);
                console.dir(user);
            });
    });
