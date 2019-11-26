/*
Not REAL rbac, but good enough for what we need to do.
*/

module.exports = (allowedRoles = ['user']) => {
    return async (ctx, next) => {
        if (allowedRoles.length > 0) {
            if (ctx.state.user === null) {
                ctx.unauthorized({
                    error: {
                        code: 'UNAUTHORIZED'
                    }
                });
                return;
            }

            const intersection = allowedRoles.filter((r) => ctx.state.user.roles.map((r) => r.code).includes(r));
            if (intersection.length === 0) {
                ctx.forbidden({
                    error: {
                        code: 'FORBIDDEN'
                    }
                });
                return;
            }
        }
        await next();
    };
};
