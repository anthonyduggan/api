const Path = require('path');
const nconf = require('nconf');

nconf.env({
    separator: '__',
    whitelist: [
        'NODE_ENV',
        'HOST',
        'PORT',
        'db__connectionString',
        'bugsnag__apiKey'
    ]
});

nconf.use('env_defaults', {
    type: 'literal',
    store: {
        'NODE_ENV': 'local'
    }
});

nconf.file('environment', Path.join(__dirname, `${nconf.get('NODE_ENV')}.json`));
nconf.file('base', Path.join(__dirname, 'defaults.json'));

nconf.required(['db']);

module.exports = nconf;
