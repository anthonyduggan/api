const request = require('supertest');
const nanoid = require('nanoid/async');
const argon2 = require('argon2');

const app = require('../app');
const config = require('../config');
const User = require('../models/User');
const ResetToken = require('../models/ResetToken');

async function _createRandomUser(verified=true) {
    const name = await nanoid(10);
    const email = `${name}@test.test`;
    const password = await nanoid();
    const hashed_password = await argon2.hash(password, config.get('argon2'));
    let user = await User.query()
        .insertAndFetch({
            email,
            name,
            password: hashed_password,
            verified
        });

    const session_token = await nanoid();
    await user
        .$relatedQuery('session_tokens')
        .insert({id: session_token});

    user = user.toJSON();
    user.password = password;
    user.token = session_token;

    return user;
}

let server;
describe('User-centric routes', () => {
    beforeAll(async () => {
        await app.knex.migrate.latest(require('../knexfile').migrations);
        server = app.listen();
    });

    afterAll(() => {
        server.close();
        app.knex.destroy();
    });

    describe('POST - /users', () => {
        test('should create a user and reset token', async () => {
            const userCountQuery = User.query()
                .first()
                .count('id as count');
            const startUserCount = parseInt((await userCountQuery).count);
            const tokenCountQuery = ResetToken.query()
                .first()
                .count('id as count');
            const startTokenCount = parseInt((await tokenCountQuery).count);

            const name = await nanoid(10);
            const email = `${name}@test.test`;
            const response = await request(server)
                .post('/users')
                .send({
                    email: email,
                    name: name
                });

            expect(response.status).toBe(201);

            const endUserCount = parseInt((await userCountQuery).count);
            const endTokenCount = parseInt((await tokenCountQuery).count);

            expect(endUserCount).toBeGreaterThan(startUserCount);
            expect(endTokenCount).toBeGreaterThan(startTokenCount);
        });
    });
    describe('GET - /users', () => {
        test('should get a list of users with paging info', async () => {
            // Make sure at least one user exists
            await _createRandomUser();

            const response = await request(server)
                .get('/users');

            expect(response.status).toBe(200);
            expect(response).toHaveProperty('body.results');
            expect(response.body.results.length).toBeGreaterThan(0);
            expect(response.body.results[0]).toHaveProperty('id');
            expect(response.body.results[0]).toHaveProperty('name');
            expect(response.body.results[0]).toHaveProperty('roles');
            expect(response.body.results[0]).not.toHaveProperty('email');
            expect(response).toHaveProperty('body.paging');
            expect(response).toHaveProperty('body.paging.total_entries');
            expect(response).toHaveProperty('body.paging.page_count');
            expect(response).toHaveProperty('body.paging.page');
        });
    });
    describe('GET - /users/:user_id', () => {
        test('should get a user if one exists', async () => {
            const user = await _createRandomUser();

            const response = await request(server)
                .get(`/users/${user.id}`);

            expect(response.status).toBe(200);
            expect(response).toHaveProperty('body.id');
            expect(response.body.id).toBe(user.id);
            expect(response).toHaveProperty('body.name');
            expect(response.body.name).toBe(user.name);
            expect(response).not.toHaveProperty('body.email');
        });

        test('should 404 if user does not exist', async () => {
            const response = await request(server)
                .get(`/users/${(Math.pow(2,31)-1).toString()}`);

            expect(response.status).toBe(404);
        });

        test('should 404 if user id is out of range', async () => {
            const response = await request(server)
                .get('/users/9999999999');

            expect(response.status).toBe(404);
        });
    });
    describe('PUT - /users/:user_id', () => {
        test('should update the user', async () => {
            const user = await _createRandomUser();

            const new_name = `${user.name}_post_update`;
            const response = await request(server)
                .put(`/users/${user.id}`)
                .set('Authorization', user.token)
                .send({
                    email: user.email,
                    name: new_name
                });

            expect(response.status).toBe(200);
            expect(response).toHaveProperty('body.name');
            expect(response.body.name).toBe(new_name);
            expect(response).toHaveProperty('body.roles');
            expect(response).toHaveProperty('body.email');
            expect(response).toHaveProperty('body.active');
            expect(response).toHaveProperty('body.verified');
        });
        test('should get forbidden if not the user in question', async () => {
            const user = await _createRandomUser();
            const other_user = await _createRandomUser();

            const response = await request(server)
                .put(`/users/${user.id}`)
                .set('Authorization', other_user.token)
                .send({
                    email: user.email,
                    name: user.name
                });

            expect(response.status).toBe(403);
            expect(response).toHaveProperty('body.error.code');
            expect(response.body.error.code).toBe('FORBIDDEN');
        });
    });
    describe('GET - /users/me', () => {
        test('should get unauthorized with no token', async () => {
            const response = await request(server)
                .get('/users/me');

            expect(response.status).toBe(401);
        });
        test('should get token users info', async () => {
            const user = await _createRandomUser();

            const response = await request(server)
                .get('/users/me')
                .set('Authorization', user.token);

            expect(response.status).toBe(200);
            expect(response).toHaveProperty('body.id');
            expect(response.body.id).toBe(user.id);
            expect(response).toHaveProperty('body.name');
            expect(response.body.name).toBe(user.name);
            expect(response).toHaveProperty('body.email');
            expect(response.body.email).toBe(user.email);
        });
    });
});
