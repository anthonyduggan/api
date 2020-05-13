// Very simeple wrapper around the build in crypto library
// Only exists to help keep things standard

const crypto = require('crypto');

function hash(value, algorithm = 'sha3-512', digest = 'hex') {
    return crypto.createHash(algorithm).update(value).digest(digest);
}

module.exports = hash;