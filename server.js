const debug = require('debug')('api');
let app = require('./app');

(async () => {
    const PORT = process.env.APP_PORT || 4444;
    app.listen(PORT, () => {
        debug(`Starting on http://localhost:${PORT}`);
    });
})();
