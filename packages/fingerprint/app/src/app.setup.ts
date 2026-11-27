import { clientIp } from './client-ip';
import {
    RateLimiter,
    rateLimitKey,
} from './ratelimit/ratelimit';
import type { IFingerprintServiceConfig } from './config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type {
    NextFunction,
    Request,
    Response,
} from 'express';


const DOCS_URL = 'https://proxyherd.github.io/proxyherd/deployment/fingerprint';
const RETRY_AFTER_SECONDS = 60;


/**
 * Everything the service needs on top of its routes: where the caller's address is read from,
 * and the optional limit of requests per address. Shared by main.ts and the tests.
 */
export function setupApp(
    app: NestExpressApplication, config: IFingerprintServiceConfig
) {
    if (config.trustProxy > 0) {
        app.set(
            'trust proxy',
            config.trustProxy
        );
    }

    if (config.rateLimitPerMinute > 0) {
        const limiter = new RateLimiter(config.rateLimitPerMinute);

        // /health and the description page are never limited
        app.use(
            [
                '/api/json', '/api/text',
            ],
            (
                req: Request, res: Response, next: NextFunction
            ) => {
                const key = rateLimitKey(clientIp(req));

                if (limiter.take(key)) {
                    next();

                    return;
                }

                // ProxyHerd shows this body as the reason a proxy is offline, so it says what to do
                res.status(429)
                    .set({
                        'Content-Type': 'text/plain; charset=utf-8',
                        'Cache-Control': 'no-store',
                        'Retry-After': RETRY_AFTER_SECONDS.toString(),
                    })
                    .send(`Too many requests from ${key} to this fingerprint service. Check fewer proxies per IP address, `
                        + `raise PROXY_REFRESH_DELAY, or run your own service: ${DOCS_URL}\n`);
            }
        );
    }
}
