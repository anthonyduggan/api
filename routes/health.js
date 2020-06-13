const Router = require('@koa/router');
const User = require('../models/User');

const router = new Router();

router.get('/health', async function health(ctx) {
    let response = {
        healthy: true,
        status: {
            database: true
        }
    };

    try {
        await User.query().limit(1);
    } catch (err) {
        response.status.database = false;
    }

    const allStatusesOk = Object.entries(response.status).reduce((acc, v) => {
        return acc && v[1];
    }, true);

    response.healthy = allStatusesOk;

    if (allStatusesOk) {
        ctx.ok(response);
    } else {
        ctx.ok(response); // Eventually return some bad status code, just needs to be 200 for now
    }
});

module.exports = router;
