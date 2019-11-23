const SessionToken = require('../models/SessionToken');

module.exports = async (ctx, next) => {
    const token = ctx.headers['authorization'];

    if (token !== undefined) {
        const session_token = await SessionToken.query().findOne({
            id: token,
            active: true
        }).eager('user.roles');
        ctx.state.user = session_token.user;
    }

    if (!ctx.state.user) {
        ctx.state.user = {
            roles: []
        };
    }

    await next();
};
