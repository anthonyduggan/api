const AWSXRay = require('aws-xray-sdk-core');
AWSXRay.capturePromise();

class IncomingRequestData {
    constructor(ctx) {
        this.request = {
            method: ctx.method,
            user_agent: ctx.headers['user-agent'] || '', // eslint-disable-line camelcase
            client_ip: getClientIp(ctx), // eslint-disable-line camelcase
            url: ctx.request.path || ''
        };
    }

    close(ctx) {
        this.response = {
            status: ctx.status || ''
        };

        if (ctx.response.header['content-length']) {
            this.response.content_length = ctx.response.header['content-lenght']; // eslint-disable-line camelcase
        }
    }
}

function getClientIp(ctx) {
    let clientIp;

    if (ctx.ip) {
        clientIp = ctx.ip;
    } else if (ctx.socket && ctx.socket.remoteAddress) {
        clientIp = ctx.socket.remoteAddress;
    }

    return clientIp;
}


/*
Pulled from (sort of)
https://github.com/aws/aws-xray-sdk-node/issues/60
*/
module.exports = async (ctx, next) => {
    const namespace = AWSXRay.getNamespace();
    const segment = new AWSXRay.Segment('API');
    segment.addIncomingRequestData(new IncomingRequestData(ctx));
    await namespace.runAndReturn(async () => {
        AWSXRay.setSegment(segment);

        await next();

        segment.http.close(ctx);
        segment.close();
    });
};
