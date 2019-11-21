const debug = require('debug')('api:joi');
const Joi = require('joi');

Joi.middleware = (routeParamsDefinition) => {
    let bodySchema = Joi.object();
    if (routeParamsDefinition.body !== undefined) {
        bodySchema = routeParamsDefinition.body;
    }

    let querySchema = Joi.object();
    if (routeParamsDefinition.query !== undefined) {
        querySchema = routeParamsDefinition.query;
    }

    return async (ctx, next) => {
        const bodyResult = Joi.validate(ctx.request.body, bodySchema);
        const queryResult = Joi.validate(ctx.request.query, querySchema);

        // Eventually this can probably return what is wrong in the request, for now just return a generic error

        if (queryResult.error !== null) {
            debug(queryResult.error);
            ctx.badRequest({
                error: {
                    code: 'INVALID_REQUEST_QUERY'
                }
            });
            return;
        }

        if (bodyResult.error !== null) {
            debug(bodyResult.error);
            ctx.badRequest({
                error: {
                    code: 'INVALID_REQUEST_BODY'
                }
            });
            return;
        }

        await next();
    };
};

module.exports = Joi;
