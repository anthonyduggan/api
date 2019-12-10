const Model = require('./BaseModel');

class APIKey extends Model {
    static get tableName() {
        return 'api_keys';
    }

    static get jsonSchema () {
        return {
            type: 'object',
            properties: {
                id: {type: 'string'},
                active: {type: 'boolean'}
            }
        };
    }
}

module.exports = APIKey;
