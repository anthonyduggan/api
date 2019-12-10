const crypto = require('crypto');
const APIKey = require('../models/APIKey');

module.exports = async (ctx, next) => {
    const key = ctx.headers['x-api-key'];

    if (key !== undefined) {
        const hashedKey = crypto.createHash('sha3-512').update(key).digest('hex');
        const apiKey = await APIKey.query().findOne({
            id: hashedKey,
            active: true
        });

        if (apiKey !== null) {
            await next();
        } else {
            ctx.unauthorized({
                error: {
                    code: 'INVALID_API_KEY'
                }
            });
        }
    } else {
        ctx.unauthorized({
            error: {
                code: 'NO_API_KEY'
            }
        });
    }
};
