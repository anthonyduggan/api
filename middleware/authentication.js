const SessionToken = require('../models/SessionToken');

module.exports = async (ctx, next) => {
    const token = ctx.headers['authorization'];

    ctx.state.user = null;
    ctx.state.user_roles = [];
    if (token !== undefined) {
        const session_token = await SessionToken.query().findById(token).eager('user.roles');
        ctx.state.user = session_token.user; // eslint-disable-line require-atomic-updates
    }

    if (!ctx.state.user) {
        ctx.state.user = { // eslint-disable-line require-atomic-updates
            roles: []
        };
    }

    await next();
};
