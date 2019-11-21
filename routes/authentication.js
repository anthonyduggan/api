const Router = require('koa-router');
const users = require('../controllers/users');
const Joi = require('../middleware/joi');

const router = new Router();

const EMAIL = Joi.string().email().min(6).max(255).required();
const PASSWORD = Joi.string().min(8).required(); // Probably going to want some better validation here

router.post('/login', Joi.middleware({
    body: {
        email: EMAIL,
        password: PASSWORD
    }
}), users.login);
router.post('/reset', Joi.middleware({
    body: {
        email: EMAIL
    }
}), users.forgot);
router.post('/reset/:token', Joi.middleware({
    body: {
        password: PASSWORD
    }
}), users.reset);

module.exports = router;
