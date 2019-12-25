const argon2 = require('argon2');
const crypto = require('crypto');
const nanoid = require('nanoid/async');
const { transaction } = require('objection');
const config = require('../config');
const emailer = require('../utils/emailer');
const User = require('../models/User');
const ResetToken = require('../models/ResetToken');

async function login(ctx) {
    const user = await User.query().findOne({
        email: ctx.request.body.email,
        verified: true,
        active: true
    });
    let success = false;
    const token = await nanoid();
    if (user) {
        success = await argon2.verify(user.password, ctx.request.body.password);
    } else {
        /*
            In an attempt to mitigate some very rudimentary timing attacks
            just verify a real argon hash against a bad password for that hash
        */
        await argon2.verify('$argon2i$v=19$m=16,t=3,p=1$eMT+5sRCXUr6tebODeXAFA$gVinmsrAiA9yNyvkHTN+8+oKpYCzPZECxuxDL8HVUai1lXWb9Hf84aTWCWC3VhjVKJ+TtnrAktKqP8kPS5/BIA', 'notarealpassword');
    }
    if (success) {
        const hashedToken = crypto.createHash('sha3-512').update(token).digest('hex');
        await user.$relatedQuery('session_tokens')
            .insert({
                id: hashedToken,
                active: true
            });
        delete user.password;
        ctx.ok({
            user,
            token
        });
    } else {
        ctx.unauthorized({
            error: {
                code: 'INVALID_EMAIL_OR_PASSWORD'
            }
        });
    }
}

async function forgot(ctx) {
    const email = ctx.request.body.email;
    const user = await User.query().findOne('email', email);
    if (user) {
        const resetToken = await nanoid();
        const hashedToken = crypto.createHash('sha3-512').update(resetToken).digest('hex');
        await user.$relatedQuery('reset_tokens')
            .insert({
                id: hashedToken,
                active: true
            });

        const link = `${ctx.headers.origin}/reset/${resetToken}`;
        emailer.send(email, 'noreply@anthonyduggan.com', 'forgot_password', {
            user,
            link
        });
    }
    ctx.noContent();
}

async function reset(ctx) {
    const token = ctx.params.token;
    const password = ctx.request.body.password;

    const hashedToken = crypto.createHash('sha3-512').update(token).digest('hex');
    const resetToken = await ResetToken.query()
        .findOne({
            id: hashedToken,
            active: true
        })
        .eager('user');
    let success = false;
    if (resetToken && resetToken.user) {
        const hashedPassword = await argon2.hash(password, config.get('argon2'));
        const knex = ResetToken.knex();
        await transaction(knex, async (trx) => {
            await resetToken
                .$query(trx)
                .patch({active: false});

            await resetToken.user
                .$query(trx)
                .patch({
                    verified: true,
                    password: hashedPassword
                });
            success = true;
        });
    }
    if (success) {
        await emailer.send(resetToken.user.email, 'noreply@anthonyduggan.com', 'password_was_changed', {
            user: resetToken.user
        });
        ctx.noContent();
    } else {
        ctx.badRequest({
            error: {
                code: 'INVALID_RESET_TOKEN'
            }
        });
    }
}

async function create(ctx) {
    const token = await nanoid();

    const newUser = await User.query()
        .insertGraph({
            email: ctx.request.body.email,
            name: ctx.request.body.name,
            reset_tokens: [{id: token, active: true}] // eslint-disable-line camelcase
        });
    ctx.created(newUser);

    // Skip email sending if running tests
    if (config.get('NODE_ENV') === 'tests') {
        return;
    }

    const link = `${ctx.headers.origin}/reset/${token}`;
    emailer.send(ctx.request.body.email, 'noreply@anthonyduggan.com', 'new_user', {
        user: ctx.request.body.name,
        link
    });
}

async function list(ctx) {
    let {count = 10, page = 1} = ctx.query;
    const isAdmin = ctx.state.user.roles.map((r) => r.code).includes('admin');
    if (isAdmin === false) {
        count = Math.min(count, 10);
    }

    let query = User.query()
        .select('users.id', 'users.created_at', 'users.name', 'users.verified', 'users.active')
        .where('active', true)
        .eager('roles')
        .page(page-1, count);
    if (isAdmin === true) {
        query = query
            .select('users.email');
    }
    const result = await query;
    const pageCount = Math.ceil(result.total/count);

    const response = {
        results: result.results,
        paging: {
            totalEntries: result.total,
            pageCount: pageCount,
            page: parseInt(page),
        }
    };
    ctx.ok(response);
}

async function get(ctx) {
    const userId = parseInt(ctx.params.user_id);
    const isAdmin = ctx.state.user.roles.map((r) => r.code).includes('admin');
    let user;
    try {
        let query = User.query()
            .findById(userId)
            .select('users.id', 'users.created_at', 'users.name', 'users.verified', 'users.active')
            .where('active', true)
            .eager('roles');
        if (isAdmin === true || ctx.state.user.id === userId) {
            query = query
                .select('users.email');
        }
        user = await query;
    } catch (err) {
        // Shitty hack to get large user ids in the url to not crash
    }

    if (user) {
        ctx.ok(user);
    } else {
        ctx.notFound();
    }
}

async function me(ctx) {
    const userId = ctx.state.user.id;
    if (userId === undefined) {
        ctx.unauthorized();
        return;
    }

    const user = await User.query()
        .findById(userId)
        .select('users.id', 'users.created_at', 'users.name', 'users.verified', 'users.active', 'users.email')
        .where('active', true)
        .eager('roles');

    ctx.ok(user);
}

async function update(ctx) {
    const userId = parseInt(ctx.params.user_id);
    const email = ctx.request.body.email;
    const name = ctx.request.body.name;

    const isUser = ctx.state.user.id === userId;
    const isAdmin = ctx.state.user.roles.map((r) => r.code).includes('admin');
    const hasPermission = isUser || isAdmin;

    if (hasPermission === true) {
        let user = await User.query()
            .patchAndFetchById(userId, {
                email,
                name
            })
            .eager('roles');

        ctx.ok(user);
    } else {
        ctx.forbidden({
            error: {
                code: 'FORBIDDEN'
            }
        });
    }
}

async function updateRoles(ctx) {
    const userId = parseInt(ctx.params.user_id);
    const roles = ctx.request.body;
    let user = await User.query()
        .findById(userId)
        .eager('roles');

    const existingRoles = user.roles.map((r) => r.code);

    await user
        .$relatedQuery('roles')
        .unrelate()
        .whereNotIn('code', roles);

    /*
        The jank levels are high but the alternative was to loop over
        every role that needed to be added and execute a new query on
        it since Objection only supports multi insert on postgres
    */
    const knex = user.$knex();
    await knex
        .from('user_role_members')
        .from(knex.raw('?? (??, ??)', ['user_role_members', 'user_id', 'user_role_id']))
        .insert(function() {
            this
                .select(knex.raw('? as ??', [userId, 'user_id']), 'id as user_role_id')
                .from('user_roles')
                .whereIn('code', roles)
                .whereNotIn('code', existingRoles);
        });

    user = await User.query()
        .findById(userId)
        .eager('roles');

    ctx.ok(user.roles);
}

module.exports = {
    login,
    forgot,
    reset,
    create,
    list,
    get,
    me,
    update,
    updateRoles
};
