const request = require('supertest');
const nanoid = require('nanoid/async').nanoid;
const argon2 = require('argon2');
const crypto = require('crypto');

const app = require('../app');
const config = require('../config');
const User = require('../models/User');
const ResetToken = require('../models/ResetToken');
const SessionToken = require('../models/SessionToken');
const APIKey = require('../models/APIKey');

async function _createRandomUser(verified=false) {
    const name = await nanoid(10);
    const email = `${name}@test.test`;
    const password = await nanoid();
    const hashedPassword = await argon2.hash(password, config.get('argon2'));
    let user = (await User.query()
        .insertAndFetch({
            email,
            name,
            password: hashedPassword,
            verified
        })).toJSON();
    user.password = password;

    return user;
}

async function _insertResetTokenByEmail(email) {
    const resetToken = await nanoid();
    const hashedToken = crypto.createHash('sha3-512').update(resetToken).digest('hex');
    const user = await User.query().findOne({email: email});
    await user
        .$relatedQuery('reset_tokens')
        .insert({id: hashedToken, active: true});
    return resetToken;
}

async function _insertApiKey() {
    const key = await nanoid();
    const hashedKey = crypto.createHash('sha3-512').update(key).digest('hex');
    await APIKey.query().insert({id: hashedKey, active: true});
    return key;
}

let server;
let apiKey;
describe('Authentication-centric routes', () => {
    beforeAll(async () => {
        await app.knex.migrate.latest(require('../knexfile').migrations);
        server = app.listen();
        apiKey = await _insertApiKey();
    });

    afterAll(() => {
        server.close();
        app.knex.destroy();
    });

    describe('POST - /login', () => {
        test('should 401 and not make a token for a user that doesnt exist', async () => {
            const tokenCountQuery = SessionToken.query()
                .first()
                .count('id as count');
            const startTokenCount = parseInt((await tokenCountQuery).count);

            const response = await request(server)
                .post('/login')
                .set({'x-api-key': apiKey})
                .send({
                    email: 'bad@bad.bad',
                    password: 'asdfasdf123!'
                });

            const endTokenCount = parseInt((await tokenCountQuery).count);

            expect(response.status).toBe(401);
            expect(response.body.error.code).toBe('INVALID_EMAIL_OR_PASSWORD');
            expect(endTokenCount).toEqual(startTokenCount);
        });

        test('should 401 and not make a token for a user that does exist', async () => {
            const user = await _createRandomUser(true);

            const tokenCountQuery = SessionToken.query()
                .first()
                .count('id as count');
            const startTokenCount = parseInt((await tokenCountQuery).count);

            const response = await request(server)
                .post('/login')
                .set({'x-api-key': apiKey})
                .send({
                    email: user.email,
                    password: `test${user.password}`
                });

            const endTokenCount = parseInt((await tokenCountQuery).count);

            expect(response.status).toBe(401);
            expect(response.body.error.code).toBe('INVALID_EMAIL_OR_PASSWORD');
            expect(endTokenCount).toEqual(startTokenCount);
        });

        test('should return a token for good credentials', async () => {
            const user = await _createRandomUser(true);

            const response = await request(server)
                .post('/login')
                .set({'x-api-key': apiKey})
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
                    .set({'x-api-key': apiKey})
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
                    .set({'x-api-key': apiKey})
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
                    .set({'x-api-key': apiKey})
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
                    .set({'x-api-key': apiKey})
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
                const badToken = await nanoid(10);

                const response = await request(server)
                    .post(`/reset/${badToken}`)
                    .set({'x-api-key': apiKey})
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

                const token = await _insertResetTokenByEmail(user.email);

                const response = await request(server)
                    .post(`/reset/${token}`)
                    .set({'x-api-key': apiKey})
                    .send({
                        password: user.password + 'a'
                    });

                const newToken = await ResetToken.query()
                    .first('id')
                    .where('id', token)
                    .andWhere('active', true);

                expect(response.status).toBe(204);
                expect(newToken).toBe(undefined);
            });

            test('should get an ok response', async () => {
                const user = await _createRandomUser();

                const token = await _insertResetTokenByEmail(user.email);

                const response = await request(server)
                    .post(`/reset/${token}`)
                    .set({'x-api-key': apiKey})
                    .send({
                        password: user.password + 'a'
                    });

                expect(response.status).toBe(204);
            });
        });
    });
});
