const Model = require('./BaseModel');

class UserModel extends Model {
    static get tableName() {
        return 'users';
    }

    static get jsonSchema () {
        return {
            type: 'object',
            properties: {
                id: {type: 'integer'},
                email: {type: 'string', minLength: 1, maxLength: 255},
                name: {type: 'string', minLength: 1, maxLength: 32},
                verified: {type: 'boolean'},
                active: {type: 'boolean'},
            }
        };
    }

    static get relationMappings() {
        const UserRole = require('./UserRole');
        const SessionToken = require('./SessionToken');
        const ResetToken = require('./ResetToken');
        return {
            roles: {
                relation: Model.ManyToManyRelation,
                modelClass: UserRole,
                join: {
                    from: 'users.id',
                    to: 'user_roles.id',
                    through: {
                        from: 'user_role_members.user_id',
                        to: 'user_role_members.user_role_id'
                    }
                }
            },
            session_tokens: { // eslint-disable-line camelcase
                relation: Model.HasManyRelation,
                modelClass: SessionToken,
                join: {
                    from: 'users.id',
                    to: 'session_tokens.user_id'
                }
            },
            reset_tokens: { // eslint-disable-line camelcase
                relation: Model.HasManyRelation,
                modelClass: ResetToken,
                join: {
                    from: 'users.id',
                    to: 'reset_tokens.user_id'
                }
            }
        };
    }
}

module.exports = UserModel;
