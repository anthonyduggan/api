const Router = require('koa-router');
const users = require('../controllers/users');
const Joi = require('../middleware/joi');
const Authorization = require('../middleware/authorization');

const router = new Router();

const USER = {
    body: Joi.object({
        email: Joi.string().email().min(6).max(255).required(),
        name: Joi.string().min(2).max(255).required(),
        roles: Joi.array().items(Joi.string())
    })
};

const ROLES = {
    body: Joi.array().items(Joi.string())
};

router.post('/',
    Joi.middleware(USER),
    users.create);
router.get('/',
    users.list);
router.get('/me',
    users.me);
router.get('/:user_id',
    users.get);
router.put('/:user_id',
    Joi.middleware(USER),
    users.update);
router.put('/:user_id/roles',
    Authorization(['admin']),
    Joi.middleware(ROLES),
    users.updateRoles);

module.exports = router;
