const Model = require('./BaseModel');

class ResetToken extends Model {
    static get tableName() {
        return 'reset_tokens';
    }

    static get jsonSchema () {
        return {
            type: 'object',
            properties: {
                id: {type: 'string'},
                user_id: {type: 'integer'}, // eslint-disable-line camelcase
                active: {type: 'boolean'}
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
                    from: 'reset_tokens.user_id',
                    to: 'users.id'
                }
            }
        };
    }
}

module.exports = ResetToken;
