module.exports = async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        ctx.status = 500;
        ctx.body = {
            error: {
                code: 'UNHANDLED_ERROR'
            }
        };
        ctx.app.emit('error', err, ctx);
    }
};
