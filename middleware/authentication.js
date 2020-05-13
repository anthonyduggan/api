const hash = require('../utils/hash');
const SessionToken = require('../models/SessionToken');

module.exports = async (ctx, next) => {
    const token = ctx.headers['authorization'];

    ctx.state.user = {
        roles: []
    };

    if (token !== undefined) {
        const hashedToken = hash(token);
        const sessionToken = await SessionToken.query().findOne({
            id: hashedToken,
            active: true
        }).withGraphFetched('user.roles');
        ctx.state.user = sessionToken.user; // eslint-disable-line require-atomic-updates
    }

    await next();
};
