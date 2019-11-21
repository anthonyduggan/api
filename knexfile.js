const config = require('./config');

module.exports = {
    client: config.get('db:client'),
    connection: config.get('db:connection'),
    migrations: {
        directory: `${__dirname}/migrations`
    },
    seeds: {
        directory: `${__dirname}/seeds`
    }
};
