const Router = require('@koa/router');
const router = new Router();

const health = require('./health');
router.use(health.routes(), health.allowedMethods());

const auth = require('./authentication');
router.use(auth.routes(), auth.allowedMethods());

const users = require('./users');
router.use('/users', users.routes(), users.allowedMethods());

module.exports = router;
