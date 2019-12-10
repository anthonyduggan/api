const request = require('supertest');
const nanoid = require('nanoid/async');
const argon2 = require('argon2');
const crypto = require('crypto');

const app = require('../app');
const config = require('../config');
const User = require('../models/User');
const UserRole = require('../models/UserRole');
const ResetToken = require('../models/ResetToken');
const APIKey = require('../models/APIKey');

async function _createRandomUser(verified=true, admin=false) {
    const name = await nanoid(10);
    const email = `${name}@test.test`;
    const password = await nanoid();
    const hashedPassword = await argon2.hash(password, config.get('argon2'));
    let user = await User.query()
        .insertAndFetch({
            email,
            name,
            password: hashedPassword,
            verified
        });

    const sessionToken = await nanoid();
    const hashedToken = crypto.createHash('sha3-512').update(sessionToken).digest('hex');
    await user
        .$relatedQuery('session_tokens')
        .insert({id: hashedToken});

    if (admin === true) {
        const adminId = (await UserRole.query()
            .findOne({code: 'admin'})).id;
        await user
            .$relatedQuery('roles')
            .relate(adminId);
    }

    user = user.toJSON();
    user.password = password;
    user.token = sessionToken;

    return user;
}

async function _insertApiKey() {
    const key = await nanoid();
    const hashedKey = crypto.createHash('sha3-512').update(key).digest('hex');
    await APIKey.query().insert({id: hashedKey, active: true});
    return key;
}

let server;
let apiKey;
describe('User-centric routes', () => {
    beforeAll(async () => {
        await app.knex.migrate.latest(require('../knexfile').migrations);
        server = app.listen();
        apiKey = await _insertApiKey();
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
                .set({'x-api-key': apiKey})
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
                .get('/users')
                .set({'x-api-key': apiKey});

            expect(response.status).toBe(200);
            expect(response).toHaveProperty('body.results');
            expect(response.body.results.length).toBeGreaterThan(0);
            expect(response.body.results[0]).toHaveProperty('id');
            expect(response.body.results[0]).toHaveProperty('name');
            expect(response.body.results[0]).toHaveProperty('roles');
            expect(response.body.results[0]).not.toHaveProperty('email');
            expect(response).toHaveProperty('body.paging');
            expect(response).toHaveProperty('body.paging.totalEntries');
            expect(response).toHaveProperty('body.paging.pageCount');
            expect(response).toHaveProperty('body.paging.page');
        });

        test('should get different info if authed user is admin', async () => {
            // Make sure at least one user exists, make them an admin
            const user = await _createRandomUser(true, true);

            const response = await request(server)
                .get('/users')
                .set({
                    'x-api-key': apiKey,
                    'Authorization': user.token
                });

            expect(response.status).toBe(200);
            expect(response).toHaveProperty('body.results');
            expect(response.body.results.length).toBeGreaterThan(0);
            expect(response.body.results[0]).toHaveProperty('id');
            expect(response.body.results[0]).toHaveProperty('name');
            expect(response.body.results[0]).toHaveProperty('roles');
            expect(response.body.results[0]).toHaveProperty('email');
            expect(response).toHaveProperty('body.paging');
            expect(response).toHaveProperty('body.paging.totalEntries');
            expect(response).toHaveProperty('body.paging.pageCount');
            expect(response).toHaveProperty('body.paging.page');
        });
    });
    describe('GET - /users/:user_id', () => {
        test('should get a user if one exists', async () => {
            const user = await _createRandomUser();

            const response = await request(server)
                .get(`/users/${user.id}`)
                .set({'x-api-key': apiKey});

            expect(response.status).toBe(200);
            expect(response).toHaveProperty('body.id');
            expect(response.body.id).toBe(user.id);
            expect(response).toHaveProperty('body.name');
            expect(response.body.name).toBe(user.name);
            expect(response).not.toHaveProperty('body.email');
        });

        test('should 404 if user does not exist', async () => {
            const response = await request(server)
                .get(`/users/${(Math.pow(2,31)-1).toString()}`)
                .set({'x-api-key': apiKey});

            expect(response.status).toBe(404);
        });

        test('should 404 if user id is out of range', async () => {
            const response = await request(server)
                .get('/users/9999999999')
                .set({'x-api-key': apiKey});

            expect(response.status).toBe(404);
        });
    });
    describe('PUT - /users/:user_id', () => {
        test('should update the user', async () => {
            const user = await _createRandomUser();

            const newName = `${user.name}_post_update`;
            const response = await request(server)
                .put(`/users/${user.id}`)
                .set({
                    'x-api-key': apiKey,
                    'Authorization': user.token
                })
                .send({
                    email: user.email,
                    name: newName
                });

            expect(response.status).toBe(200);
            expect(response).toHaveProperty('body.name');
            expect(response.body.name).toBe(newName);
            expect(response).toHaveProperty('body.roles');
            expect(response).toHaveProperty('body.email');
            expect(response).toHaveProperty('body.active');
            expect(response).toHaveProperty('body.verified');
        });
        test('should get forbidden if not the user in question', async () => {
            const user = await _createRandomUser();
            const otherUser = await _createRandomUser();

            const response = await request(server)
                .put(`/users/${user.id}`)
                .set({
                    'x-api-key': apiKey,
                    'Authorization': otherUser.token
                })
                .send({
                    email: user.email,
                    name: user.name
                });

            expect(response.status).toBe(403);
            expect(response).toHaveProperty('body.error.code');
            expect(response.body.error.code).toBe('FORBIDDEN');
        });
        test('should not update roles if not an admin', async () => {
            const user = await _createRandomUser();

            const response = await request(server)
                .put(`/users/${user.id}`)
                .set({
                    'x-api-key': apiKey,
                    'Authorization': user.token
                })
                .send({
                    email: `${user.email}update`,
                    name: `${user.name}update`,
                    roles: ['admin']
                });

            expect(response.status).toBe(200);
            expect(response).toHaveProperty('body.roles');
            expect(response.body.roles.length).toBe(0);
        });
        test('should remove extra roles', async () => {
            const user = await _createRandomUser(true, true);

            const response = await request(server)
                .put(`/users/${user.id}`)
                .set({
                    'x-api-key': apiKey,
                    'Authorization': user.token
                })
                .send({
                    email: `${user.email}update`,
                    name: `${user.name}update`,
                    roles: []
                });

            expect(response.status).toBe(200);
            expect(response).toHaveProperty('body.roles');
            expect(response.body.roles.length).toBe(0);
        });
        test('should add missing roles', async () => {
            const user = await _createRandomUser();
            const adminUser = await _createRandomUser(true, true);

            const response = await request(server)
                .put(`/users/${user.id}`)
                .set({
                    'x-api-key': apiKey,
                    'Authorization': adminUser.token
                })
                .send({
                    email: `${user.email}update`,
                    name: `${user.name}update`,
                    roles: ['admin']
                });

            expect(response.status).toBe(200);
            expect(response).toHaveProperty('body.roles');
            expect(response.body.roles.length).toBe(1);
        });
    });
    describe('GET - /users/me', () => {
        test('should get unauthorized with no token', async () => {
            const response = await request(server)
                .get('/users/me')
                .set({'x-api-key': apiKey});

            expect(response.status).toBe(401);
        });
        test('should get token users info', async () => {
            const user = await _createRandomUser();

            const response = await request(server)
                .get('/users/me')
                .set({
                    'x-api-key': apiKey,
                    'Authorization': user.token
                });

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
