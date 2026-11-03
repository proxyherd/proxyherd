/**
 * ProxyHerd fingerprint service as a Cloudflare Worker.
 *
 * Same contract as packages/fingerprint/app, with no database to manage: Cloudflare attaches
 * geolocation and ASN data to every request (`request.cf`). Deploy with `npx wrangler deploy`
 * from this directory, then set FINGERPRINT_URL=https://<worker>.workers.dev/api/json.
 *
 * The shared service at fingerprint.proxyherd.com is the same Worker deployed with
 * `npx wrangler deploy --env hosted`, which adds a per-IP rate limit (see wrangler.toml).
 */

interface IRateLimiter {
    limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface IEnv {
    // Optional: only declared in the environments of wrangler.toml that limit requests per IP
    RATE_LIMITER?: IRateLimiter;
    HOSTED?: string;
}

interface ICfProperties {
    asn?: number;
    asOrganization?: string;
    continent?: string;
    country?: string;
    city?: string;
    timezone?: string;
    latitude?: string;
    longitude?: string;
}

const DOCS_URL = 'https://proxyherd.github.io/proxyherd/deployment/fingerprint';
const CONTINENT_NAMES: Record<string, string> = {
    AF: 'Africa',
    AN: 'Antarctica',
    AS: 'Asia',
    EU: 'Europe',
    NA: 'North America',
    OC: 'Oceania',
    SA: 'South America',
};

function toNumber(value: string | undefined): number | null {
    if (value === undefined) {
        return null;
    }

    const parsed = parseFloat(value);

    return Number.isFinite(parsed) ? parsed : null;
}

async function isRateLimited(
    env: IEnv, ip: string
): Promise<boolean> {
    if (!env.RATE_LIMITER) {
        return false;
    }

    const { success } = await env.RATE_LIMITER.limit({ key: ip });

    return !success;
}


export default {
    async fetch(
        request: Request, env: IEnv
    ): Promise<Response> {
        const url = new URL(request.url);
        const ip = request.headers.get('CF-Connecting-IP') ?? '';
        const cf = ((request as unknown as { cf?: ICfProperties }).cf) ?? {};

        // ProxyHerd shows this body as the reason a proxy is offline, so it says what to do
        if ((url.pathname === '/api/json' || url.pathname === '/api/text') && await isRateLimited(
            env,
            ip
        )) {
            return new Response(
                `Too many requests from ${ip} to this fingerprint service. Check fewer proxies per IP address, `
                + `raise PROXY_REFRESH_DELAY, or run your own service: ${DOCS_URL}\n`,
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                        'Retry-After': '60',
                    },
                }
            );
        }

        switch (url.pathname) {
            case '/api/json': {
                const countryCode = cf.country ?? null;
                const continentCode = cf.continent ?? null;

                return Response.json({
                    ip,
                    useragent: request.headers.get('User-Agent'),
                    asnName: cf.asOrganization ?? null,
                    asnNetwork: null,
                    continentCode,
                    continentName: continentCode ? CONTINENT_NAMES[ continentCode ] ?? null : null,
                    countryCode,
                    countryName: countryCode ? new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) ?? null : null,
                    cityName: cf.city ?? null,
                    timezone: cf.timezone ?? null,
                    latitude: toNumber(cf.latitude),
                    longitude: toNumber(cf.longitude),
                });
            }

            case '/api/text': {
                return new Response(ip, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
            }

            case '/health': {
                return Response.json({ status: 'ok', provider: 'cloudflare' });
            }

            default: {
                const description = env.HOSTED === 'true' ?
                    'Shared ProxyHerd fingerprint service: best effort, rate limited per IP address, no request logs.\n'
                    + `For production, run your own: ${DOCS_URL}\n` :
                    'ProxyHerd fingerprint service (Cloudflare Worker)\n';

                return new Response(
                    `${description}GET /api/json, GET /api/text, GET /health\n`,
                    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
                );
            }
        }
    },
};
