const Model = require('./BaseModel');

class UserRole extends Model {
    static get tableName() {
        return 'user_roles';
    }

    static get jsonSchema () {
        return {
            type: 'object',
            properties: {
                id: {type: 'integer'},
                code: {type: 'string', minLength: 1, maxLength: 32},
                name: {type: 'string', minLength: 1, maxLength: 32}
            }
        };
    }

    static get relationMappings() {
        const User = require('./User');
        return {
            users: {
                relation: Model.ManyToManyRelation,
                modelClass: User,
                join: {
                    from: 'user_roles.id',
                    to: 'user.id',
                    through: {
                        from: 'user_role_members.user_role_id',
                        to: 'user_role_members.user_id'
                    }
                }
            }
        };
    }
}

module.exports = UserRole;
