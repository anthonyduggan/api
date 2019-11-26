const { Model } = require('objection');

class BaseModel extends Model {
    $beforeInsert() {
        this.created_at = new Date().toISOString(); // eslint-disable-line camelcase
    }

    $beforeUpdate() {
        this.updated_at = new Date().toISOString(); // eslint-disable-line camelcase
    }
}

module.exports = BaseModel;
