const argon2 = require('argon2');
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
    }
    if (success) {
        await user.$relatedQuery('session_tokens')
            .insert({
                id: token,
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
        await user.$relatedQuery('reset_tokens')
            .insert({
                id: resetToken,
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

    const reset_token = await ResetToken.query()
        .findOne({
            id: token,
            active: true
        })
        .eager('user');
    let success = false;
    if (reset_token && reset_token.user) {
        const hashedPassword = await argon2.hash(password, config.get('argon2'));
        const knex = ResetToken.knex();
        await transaction(knex, async (trx) => {
            await reset_token
                .$query(trx)
                .patch({active: false});

            await reset_token.user
                .$query(trx)
                .patch({
                    verified: true,
                    password: hashedPassword
                });
            success = true;
        });
    }
    if (success) {
        await emailer.send(reset_token.user.email, 'noreply@anthonyduggan.com', 'password_was_changed', {
            user: reset_token.user
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

    const new_user = await User.query()
        .insertGraph({
            email: ctx.request.body.email,
            name: ctx.request.body.name,
            reset_tokens: [{id: token, active: true}]
        });
    ctx.created(new_user);

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
    const is_admin = ctx.state.user.roles.map(r => r.code).includes('admin');
    if (is_admin === false) {
        count = Math.min(count, 10);
    }

    let query = User.query()
        .select('users.id', 'users.created_at', 'users.name', 'users.verified', 'users.active')
        .where('active', true)
        .eager('roles')
        .page(page-1, count);
    if (is_admin === true) {
        query = query
            .select('users.email');
    }
    const result = await query;
    const page_count = Math.ceil(result.total/count);

    const response = {
        results: result.results,
        paging: {
            total_entries: result.total,
            page_count: page_count,
            page: parseInt(page),
        }
    };
    ctx.ok(response);
}

async function get(ctx) {
    const user_id = parseInt(ctx.params.user_id);
    const is_admin = ctx.state.user.roles.map(r => r.code).includes('admin');
    let user;
    try {
        let query = User.query()
            .findById(user_id)
            .select('users.id', 'users.created_at', 'users.name', 'users.verified', 'users.active')
            .where('active', true)
            .eager('roles');
        if (is_admin === true || ctx.state.user.id === user_id) {
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
    const user_id = ctx.state.user.id;
    if (user_id == undefined) {
        ctx.unauthorized();
        return;
    }

    const user = await User.query()
        .findById(user_id)
        .select('users.id', 'users.created_at', 'users.name', 'users.verified', 'users.active', 'users.email')
        .where('active', true)
        .eager('roles');

    ctx.ok(user);
}

async function update(ctx) {
    const user_id = parseInt(ctx.params.user_id);
    const email = ctx.request.body.email;
    const name = ctx.request.body.name;
    let roles = ctx.request.body.roles;

    let has_permission = false;
    if (ctx.state.user.id === user_id || ctx.state.user.roles.map(r => r.code).includes('admin')) {
        has_permission = true;
    }

    if (has_permission === true) {
        if (ctx.request.body.roles !== undefined) {
            roles = ctx.request.body.roles;
        }

        const updated_user = await User.query()
            .patchAndFetchById(user_id, {
                email,
                name
            })
            .eager('roles');

        // TODO: implement role updating, probably transact the whole thing with updating the user

        ctx.ok(updated_user);
    } else {
        ctx.forbidden({
            error: {
                code: 'FORBIDDEN'
            }
        });
    }
}

module.exports = {
    login,
    forgot,
    reset,
    create,
    list,
    get,
    me,
    update
};
