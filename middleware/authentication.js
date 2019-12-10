const crypto = require('crypto');
const SessionToken = require('../models/SessionToken');

module.exports = async (ctx, next) => {
    const token = ctx.headers['authorization'];

    ctx.state.user = {
        roles: []
    };

    if (token !== undefined) {
        const hashedToken = crypto.createHash('sha3-512').update(token).digest('hex');
        const sessionToken = await SessionToken.query().findOne({
            id: hashedToken,
            active: true
        }).eager('user.roles');
        ctx.state.user = sessionToken.user; // eslint-disable-line require-atomic-updates
    }

    await next();
};
