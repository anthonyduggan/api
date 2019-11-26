const Model = require('./BaseModel');

class SessionToken extends Model {
    static get tableName() {
        return 'session_tokens';
    }

    static get jsonSchema () {
        return {
            type: 'object',
            properties: {
                id: {type: 'string'},
                user_id: {type: 'integer'} // eslint-disable-line camelcase
            }
        };
    }

    static get relationMappings() {
        const User = require('./User');
        return {
            user: {
                relation: Model.BelongsToOneRelation,
                modelClass: User,
                join: {
                    from: 'session_tokens.user_id',
                    to: 'users.id'
                }
            }
        };
    }
}

module.exports = SessionToken;
