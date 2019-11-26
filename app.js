const Knex = require('knex');
const { Model } = require('objection');
const debug = require('debug')('api:app');

// Configure AWS
const AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});

const config = require('./config');

const knexConfig = {
    debug: config.get('db:debug'),
    client: config.get('db:client'),
    connection: config.get('db:connection'),
    pool: config.get('db:pool'),
    searchPath: ['knex', 'public']
};

if (config.get('NODE_ENV') === 'tests') {
    knexConfig.log = {
        warn(){} // Suppress warnings while running tests
    };
}

const knex = Knex(knexConfig);

Model.knex(knex);

// Build the koa app
const Koa = require('koa');
const app = new Koa();

// Attach the knex instance to the app, it is useful for testing
app.knex = knex;

// xray tracking?
// app.use(require('./middleware/xray'));

// Bugsnag things
const bugsnagApiKey = config.get('bugsnag:apiKey');
if (bugsnagApiKey !== undefined) {
    const bugsnag = require('@bugsnag/js');
    const bugsnagKoa = require('@bugsnag/plugin-koa');
    const bugsnagClient = bugsnag({
        apiKey: bugsnagApiKey,
        releaseStage: config.get('NODE_ENV'),
        autoCaptureSessions: false
    });
    bugsnagClient.use(bugsnagKoa);
    const bugsnagMiddleware = bugsnagClient.getPlugin('koa');
    app.use(bugsnagMiddleware.requestHandler);

    app.on('error', bugsnagMiddleware.errorHandler);
}

// CORs things
const cors = require('@koa/cors');
app.use(cors()); // This is a bullshit hack for now while I figure out something long term

app.use(require('koa-respond')());

if (config.get('NODE_ENV') === 'local') {
    app.use(require('koa-logger')());
}

app.use(require('./middleware/unhandled_error'));

app.on('error', debug);

app.use(require('./middleware/authentication'));

const Body = require('koa-body');
app.use(Body());

const router = require('./routes');
app.use(router.routes(), router.allowedMethods());

module.exports = app;
