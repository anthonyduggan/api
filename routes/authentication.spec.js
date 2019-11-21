const request = require('supertest');
const nanoid = require('nanoid/async');
const argon2 = require('argon2');

const app = require('../app');
const config = require('../config');
const User = require('../models/User');
const ResetToken = require('../models/ResetToken');

async function _createRandomUser(verified=false) {
    const name = await nanoid(10);
    const email = `${name}@test.test`;
    const password = await nanoid();
    const hashed_password = await argon2.hash(password, config.get('argon2'));
    let user = (await User.query()
        .insertAndFetch({
            email,
            name,
            password: hashed_password,
            verified
        })).toJSON();
    user.password = password;

    return user;
}

async function _insertResetTokenByEmail(email) {
    const reset_token = await nanoid();
    const user = await User.query().findOne({email: email});
    await user
        .$relatedQuery('reset_tokens')
        .insert({id: reset_token, active: true});
}

let server;
describe('Authentication-centric routes', () => {
    beforeAll(async () => {
        await app.knex.migrate.latest(require('../knexfile').migrations);
        server = app.listen();
    });

    afterAll(() => {
        server.close();
    });

    describe('POST - /login', () => {
        test('should reject bad credentials', async () => {
            const response = await request(server)
                .post('/login')
                .send({
                    email: 'bad@bad.bad',
                    password: 'asdfasdf123!'
                });

            expect(response.status).toBe(401);
            expect(response.body.error.code).toBe('INVALID_EMAIL_OR_PASSWORD');
        });

        test('should return a token for good credentials', async () => {
            const user = await _createRandomUser(true);

            const response = await request(server)
                .post('/login')
                .send({
                    email: user.email,
                    password: user.password
                });

            expect(response.status).toBe(200);
            expect(response).toHaveProperty('body.user.email', user.email);
            expect(response).toHaveProperty('body.user.name', user.name);
            expect(response).toHaveProperty('body.token');
        });
    });

    describe('POST - /reset', () => {
        describe('if email exists', () => {
            test('should return a 204', async () => {
                const user = await _createRandomUser();

                const response = await request(server)
                    .post('/reset')
                    .send({
                        email: user.email
                    });

                expect(response.status).toBe(204);
            });

            test('should create an active reset token', async () => {
                const countQuery = ResetToken.query()
                    .first()
                    .count('id as count')
                    .where('active', true);
                let countQueryResult = await countQuery;
                const startCount = parseInt(countQueryResult.count);

                const user = await _createRandomUser();

                await request(server)
                    .post('/reset')
                    .send({
                        email: user.email
                    });

                countQueryResult = await countQuery;
                const endCount = parseInt(countQueryResult.count);

                expect(endCount).toBeGreaterThan(startCount);
            });
        });

        describe('if email does not exist', () => {
            test('should return a 204', async () => {
                let email = await nanoid(10);
                email = `${email}@test.test`;

                const response = await request(server)
                    .post('/reset')
                    .send({
                        email
                    });

                expect(response.status).toBe(204);
            });

            test('should not create a reset token', async () => {
                const countQuery = ResetToken.query()
                    .first()
                    .count('id as count');
                let countQueryResult = await countQuery;
                const startCount = parseInt(countQueryResult.count);

                let email = await nanoid(10);
                email = `${email}@test.test`;

                await request(server)
                    .post('/reset')
                    .send({
                        email
                    });

                countQueryResult = await countQuery;
                const endCount = parseInt(countQueryResult.count);

                expect(endCount).toEqual(startCount);
            });
        });
    });

    describe('POST - /reset/:token', () => {
        describe('if token exists', () => {

        });

        describe('if token does not exist', () => {
            test('should get code INVALID_RESET_TOKEN', async () => {
                const bad_token = await nanoid(10);

                const response = await request(server)
                    .post(`/reset/${bad_token}`)
                    .send({
                        password: 'testpassword123'
                    });

                expect(response.status).toBe(400);
                expect(response.body.error.code).toBe('INVALID_RESET_TOKEN');
            });
        });

        describe('if token exists', () => {
            test('it should get deactivated', async () => {
                const user = await _createRandomUser();

                await _insertResetTokenByEmail(user.email);

                let token = await ResetToken.query()
                    .first('reset_tokens.id')
                    .join('users', 'reset_tokens.user_id', 'users.id')
                    .where('users.email', user.email);

                const response = await request(server)
                    .post(`/reset/${token.id}`)
                    .send({
                        password: user.password + 'a'
                    });

                token = await ResetToken.query()
                    .first('id')
                    .where('id', token.id)
                    .andWhere('active', true);

                expect(response.status).toBe(204);
                expect(token).toBe(undefined);
            });

            test('should get an ok response', async () => {
                const user = await _createRandomUser();

                await _insertResetTokenByEmail(user.email);

                const token = await ResetToken.query()
                    .first('reset_tokens.id')
                    .join('users', 'reset_tokens.user_id', 'users.id')
                    .where('users.email', user.email);

                const response = await request(server)
                    .post(`/reset/${token.id}`)
                    .send({
                        password: user.password + 'a'
                    });

                expect(response.status).toBe(204);
            });
        });
    });
});