/**
 * ProxyHerd fingerprint service as a Cloudflare Worker.
 *
 * Same contract as packages/fingerprint/app, with no database to manage: Cloudflare attaches
 * geolocation and ASN data to every request (`request.cf`). Deploy with `npx wrangler deploy`
 * from this directory, then set FINGERPRINT_URL=https://<worker>.workers.dev/api/json.
 *
 * wrangler.toml holds an optional rate limit per IP address. The Node service counts requests
 * the same way (packages/fingerprint/app/src/ratelimit); keep the two alike.
 */

export interface IRateLimiter {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
}

// The names of the bindings of wrangler.toml
export interface IEnv {
    // Optional: only there when the rate limit of wrangler.toml is turned on
    // eslint-disable-next-line @typescript-eslint/naming-convention
    RATE_LIMITER?: IRateLimiter;
}

export interface ICfProperties {
    asn?: number;
    asOrganization?: string;
    continent?: string;
    country?: string | null;
    city?: string;
    timezone?: string;
    latitude?: string;
    longitude?: string;
}

interface IRequestWithCf extends Request {
    cf?: ICfProperties;
}

interface ICountry {
    countryCode: string | null;
    countryName: string | null;
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
const REGION_NAMES = new Intl.DisplayNames(
    [
        'en',
    ],
    {
        type: 'region',
    }
);
const COUNTRY_CODE = /^[A-Z]{2}$/;
// Cloudflare's code for "no country data"
const COUNTRY_CODE_UNKNOWN = 'XX';
const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;
const IPV6_GROUP = /^[0-9a-f]{1,4}$/i;
const IPV6_GROUPS = 8;
const IPV6_NETWORK_GROUPS = 4;
const RETRY_AFTER_SECONDS = 60;
// Every answer depends on the caller's address: nothing on the way back may store and replay it
const HEADERS_TEXT = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
};


function toNumber(value: string | undefined): number | null {
    if (value === undefined) {
        return null;
    }

    const parsed = parseFloat(value);

    return Number.isFinite(parsed) ? parsed : null;
}


/**
 * The country of the caller. Cloudflare also uses codes that are not countries: `XX` when it has
 * no data and `T1` for the Tor network. They are reported as unknown, like the Node service does,
 * and never reach Intl.DisplayNames, which throws on a code such as `T1`.
 */
export function toCountry(code: string | null | undefined): ICountry {
    if (!code || !COUNTRY_CODE.test(code) || code === COUNTRY_CODE_UNKNOWN) {
        return {
            countryCode: null,
            countryName: null,
        };
    }

    let name: string | undefined;
    try {
        name = REGION_NAMES.of(code);
    } catch (err: any) {
        name = void 0;
    }

    return {
        countryCode: code,
        // An unassigned code comes back unchanged
        countryName: name && name !== code ? name : null,
    };
}


/**
 * What requests are counted by. An IPv4 address counts on its own. An IPv6 address counts with
 * its /64 network, the block one customer usually gets: counted address by address, a single
 * machine has 2^64 of them to get past the limit with.
 */
export function rateLimitKey(ip: string): string {
    if (!ip.includes(':')) {
        return ip;
    }

    const mapped = IPV4_MAPPED.exec(ip);

    if (mapped) {
        return mapped[ 1 ];
    }

    const parts = ip.split('::');

    if (parts.length > 2) {
        return ip;
    }

    const head = parts[ 0 ].length > 0 ? parts[ 0 ].split(':') : [];
    let groups: string[];

    if (parts.length === 2) {
        const tail = parts[ 1 ].length > 0 ? parts[ 1 ].split(':') : [];
        const missing = IPV6_GROUPS - head.length - tail.length;

        if (missing < 1) {
            return ip;
        }

        const zeros: string[] = Array.from(
            {
                length: missing,
            },
            () => '0'
        );

        groups = [
            ...head, ...zeros, ...tail,
        ];
    } else {
        groups = head;
    }

    const network = groups.slice(
        0,
        IPV6_NETWORK_GROUPS
    );

    // Not an address this function understands: count it as it is
    if (groups.length !== IPV6_GROUPS || !network.every((group) => IPV6_GROUP.test(group))) {
        return ip;
    }

    return `${network.map((group) => parseInt(
        group,
        16
    )
        .toString(16))
        .join(':')}::/64`;
}


/**
 * The limit protects the service and must not be able to take it down: when the limiter itself
 * fails, the request is answered. The error is logged without the address of the caller.
 */
async function isRateLimited(
    limiter: IRateLimiter, key: string
): Promise<boolean> {
    try {
        const { success } = await limiter.limit({
            key,
        });

        return !success;
    } catch (err: any) {
        console.error(JSON.stringify({
            message: 'rate limiter failed, request allowed',
            error: err instanceof Error ? err.message : String(err),
        }));

        return false;
    }
}


async function handle(
    request: Request, env: IEnv
): Promise<Response> {
    const url = new URL(request.url);
    const ip = request.headers.get('CF-Connecting-IP') ?? '';
    const cf = (request as IRequestWithCf).cf ?? {};

    if (env.RATE_LIMITER && ip.length > 0 && (url.pathname === '/api/json' || url.pathname === '/api/text')) {
        const key = rateLimitKey(ip);

        // ProxyHerd shows this body as the reason a proxy is offline, so it says what to do
        if (await isRateLimited(
            env.RATE_LIMITER,
            key
        )) {
            return new Response(
                `Too many requests from ${key} to this fingerprint service. Check fewer proxies per IP address, `
                + `raise PROXY_REFRESH_DELAY, or run your own service: ${DOCS_URL}\n`,
                {
                    status: 429,
                    headers: {
                        ...HEADERS_TEXT,
                        'Retry-After': RETRY_AFTER_SECONDS.toString(),
                    },
                }
            );
        }
    }

    switch (url.pathname) {
        case '/api/json': {
            const continentCode = cf.continent ?? null;

            return Response.json(
                {
                    ip,
                    useragent: request.headers.get('User-Agent'),
                    asnName: cf.asOrganization ?? null,
                    asnNetwork: null,
                    continentCode,
                    continentName: continentCode ? CONTINENT_NAMES[ continentCode ] ?? null : null,
                    ...toCountry(cf.country),
                    cityName: cf.city ?? null,
                    timezone: cf.timezone ?? null,
                    latitude: toNumber(cf.latitude),
                    longitude: toNumber(cf.longitude),
                },
                {
                    headers: {
                        'Cache-Control': 'no-store',
                    },
                }
            );
        }

        case '/api/text': {
            return new Response(
                ip,
                {
                    headers: HEADERS_TEXT,
                }
            );
        }

        case '/health': {
            return Response.json(
                {
                    status: 'ok',
                    provider: 'cloudflare',
                    // Lets a deployment check and a monitor see that the limit of wrangler.toml is in place
                    rateLimit: env.RATE_LIMITER !== undefined,
                },
                {
                    headers: {
                        'Cache-Control': 'no-store',
                    },
                }
            );
        }

        default: {
            return new Response(
                'ProxyHerd fingerprint service (Cloudflare Worker)\nGET /api/json, GET /api/text, GET /health\n',
                {
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                    },
                }
            );
        }
    }
}


export default {
    async fetch(
        request: Request, env: IEnv
    ): Promise<Response> {
        try {
            return await handle(
                request,
                env
            );
        } catch (err: any) {
            // One line of text instead of Cloudflare's HTML error page: ProxyHerd shows it on the proxy
            console.error(JSON.stringify({
                message: 'request failed',
                error: err instanceof Error ? err.message : String(err),
            }));

            return new Response(
                'The fingerprint service could not answer this request.\n',
                {
                    status: 500,
                    headers: HEADERS_TEXT,
                }
            );
        }
    },
};
