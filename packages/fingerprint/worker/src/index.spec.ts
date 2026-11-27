import worker, {
    rateLimitKey,
    toCountry,
} from './index';
import type {
    ICfProperties,
    IEnv,
    IRateLimiter,
} from './index';


const CF_PARIS: ICfProperties = {
    asn: 64496,
    asOrganization: 'Example Network',
    continent: 'EU',
    country: 'FR',
    city: 'Paris',
    timezone: 'Europe/Paris',
    latitude: '48.85660',
    longitude: '2.35220',
};


function call(
    path: string,
    env: IEnv = {},
    ip: string | null = '203.0.113.10',
    cf: ICfProperties | null = CF_PARIS
): Promise<Response> {
    const headers: Record<string, string> = {
        'User-Agent': 'ProxyHerd/1.2.0',
    };

    if (ip !== null) {
        headers[ 'CF-Connecting-IP' ] = ip;
    }

    const request = new Request(
        `https://fingerprint.example.com${path}`,
        {
            headers,
        }
    );

    return worker.fetch(
        cf ? Object.assign(
            request,
            {
                cf,
            }
        ) : request,
        env
    );
}


class RateLimiterMock implements IRateLimiter {
    readonly keys: string[] = [];

    constructor(private readonly allowed: number) {
    }

    limit(options: { key: string }): Promise<{ success: boolean }> {
        this.keys.push(options.key);

        return Promise.resolve({
            success: this.keys.filter((key) => key === options.key).length <= this.allowed,
        });
    }
}


describe(
    'Fingerprint Worker',
    () => {
        describe(
            'Rate limit key',
            () => {
                it(
                    'should count an IPv4 address on its own',
                    () => {
                        expect(rateLimitKey('203.0.113.10'))
                            .toBe('203.0.113.10');
                        expect(rateLimitKey('::ffff:203.0.113.10'))
                            .toBe('203.0.113.10');
                    }
                );

                it(
                    'should count an IPv6 address with its /64 network',
                    () => {
                        expect(rateLimitKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd'))
                            .toBe('2001:db8:1:2::/64');
                        expect(rateLimitKey('2001:db8:1:2::1'))
                            .toBe('2001:db8:1:2::/64');
                        expect(rateLimitKey('2001:0DB8:0001:0002::ffff'))
                            .toBe('2001:db8:1:2::/64');
                        expect(rateLimitKey('2001:db8::1'))
                            .toBe('2001:db8:0:0::/64');
                        expect(rateLimitKey('2001:db8:1::'))
                            .toBe('2001:db8:1:0::/64');
                        expect(rateLimitKey('::1'))
                            .toBe('0:0:0:0::/64');
                        expect(rateLimitKey('64:ff9b::203.0.113.10'))
                            .toBe('64:ff9b:0:0::/64');
                    }
                );

                it(
                    'should give two addresses of one /64 the same key, and another /64 its own',
                    () => {
                        expect(rateLimitKey('2001:db8:1:2::1'))
                            .toBe(rateLimitKey('2001:db8:1:2:ffff:ffff:ffff:ffff'));
                        expect(rateLimitKey('2001:db8:1:3::1')).not.toBe(rateLimitKey('2001:db8:1:2::1'));
                    }
                );

                it(
                    'should count anything else as it is',
                    () => {
                        expect(rateLimitKey('2001:db8::1::2'))
                            .toBe('2001:db8::1::2');
                        expect(rateLimitKey('2001:db8:1:2:3:4:5'))
                            .toBe('2001:db8:1:2:3:4:5');
                        expect(rateLimitKey('2001:db8:1:2:3:4:5:6:7'))
                            .toBe('2001:db8:1:2:3:4:5:6:7');
                        expect(rateLimitKey('zzzz:db8:1:2::1'))
                            .toBe('zzzz:db8:1:2::1');
                    }
                );
            }
        );

        describe(
            'Country',
            () => {
                it(
                    'should name a country',
                    () => {
                        expect(toCountry('FR'))
                            .toEqual({
                                countryCode: 'FR',
                                countryName: 'France',
                            });
                    }
                );

                it(
                    'should report the codes that are not countries as unknown',
                    () => {
                        const unknown = {
                            countryCode: null,
                            countryName: null,
                        };

                        // No data, the Tor network, and nothing at all
                        expect(toCountry('XX'))
                            .toEqual(unknown);
                        expect(toCountry('T1'))
                            .toEqual(unknown);
                        expect(toCountry(null))
                            .toEqual(unknown);
                        expect(toCountry(void 0))
                            .toEqual(unknown);
                        expect(toCountry(''))
                            .toEqual(unknown);
                    }
                );

                it(
                    'should keep a code without a known name',
                    () => {
                        expect(toCountry('QQ'))
                            .toEqual({
                                countryCode: 'QQ',
                                countryName: null,
                            });
                    }
                );
            }
        );

        describe(
            'Endpoints',
            () => {
                it(
                    'should answer /api/json with the fingerprint of the caller',
                    async() => {
                        const res = await call('/api/json?version=3');

                        expect(res.status)
                            .toBe(200);
                        expect(res.headers.get('Content-Type'))
                            .toContain('application/json');
                        expect(res.headers.get('Cache-Control'))
                            .toBe('no-store');
                        expect(await res.json())
                            .toEqual({
                                ip: '203.0.113.10',
                                useragent: 'ProxyHerd/1.2.0',
                                asnName: 'Example Network',
                                asnNetwork: null,
                                continentCode: 'EU',
                                continentName: 'Europe',
                                countryCode: 'FR',
                                countryName: 'France',
                                cityName: 'Paris',
                                timezone: 'Europe/Paris',
                                latitude: 48.8566,
                                longitude: 2.3522,
                            });
                    }
                );

                it(
                    'should answer a caller from the Tor network, which has no country',
                    async() => {
                        const res = await call(
                            '/api/json',
                            {},
                            '198.51.100.7',
                            {
                                country: 'T1',
                            }
                        );

                        expect(res.status)
                            .toBe(200);
                        expect(await res.json())
                            .toEqual({
                                ip: '198.51.100.7',
                                useragent: 'ProxyHerd/1.2.0',
                                asnName: null,
                                asnNetwork: null,
                                continentCode: null,
                                continentName: null,
                                countryCode: null,
                                countryName: null,
                                cityName: null,
                                timezone: null,
                                latitude: null,
                                longitude: null,
                            });
                    }
                );

                it(
                    'should answer without any location data',
                    async() => {
                        const res = await call(
                            '/api/json',
                            {},
                            '203.0.113.10',
                            null
                        );

                        expect(res.status)
                            .toBe(200);
                        expect((await res.json() as { ip: string }).ip)
                            .toBe('203.0.113.10');
                    }
                );

                it(
                    'should answer /api/text with the address of the caller',
                    async() => {
                        const res = await call('/api/text');

                        expect(res.status)
                            .toBe(200);
                        expect(res.headers.get('Cache-Control'))
                            .toBe('no-store');
                        expect(await res.text())
                            .toBe('203.0.113.10');
                    }
                );

                it(
                    'should say on /health whether the rate limit is in place',
                    async() => {
                        expect(await (await call('/health')).json())
                            .toEqual({
                                status: 'ok',
                                provider: 'cloudflare',
                                rateLimit: false,
                            });
                        expect(await (await call(
                            '/health',
                            {
                                RATE_LIMITER: new RateLimiterMock(1),
                            }
                        )).json())
                            .toEqual({
                                status: 'ok',
                                provider: 'cloudflare',
                                rateLimit: true,
                            });
                    }
                );

                it(
                    'should describe itself on other paths',
                    async() => {
                        expect(await (await call('/')).text())
                            .toContain('ProxyHerd fingerprint service (Cloudflare Worker)');
                    }
                );
            }
        );

        describe(
            'Rate limit',
            () => {
                let errors: jest.SpyInstance;

                beforeEach(() => {
                    errors = jest.spyOn(
                        console,
                        'error'
                    )
                        .mockImplementation(() => void 0);
                });

                afterEach(() => {
                    errors.mockRestore();
                });

                it(
                    'should never limit a deployment without the binding',
                    async() => {
                        for (let i = 0; i < 50; ++i) {
                            expect((await call('/api/json')).status)
                                .toBe(200);
                        }
                    }
                );

                it(
                    'should answer 429 with an explanation over the limit',
                    async() => {
                        const env = {
                            RATE_LIMITER: new RateLimiterMock(2),
                        };

                        expect((await call(
                            '/api/json',
                            env
                        )).status)
                            .toBe(200);
                        expect((await call(
                            '/api/text',
                            env
                        )).status)
                            .toBe(200);

                        const res = await call(
                            '/api/json',
                            env
                        );

                        expect(res.status)
                            .toBe(429);
                        expect(res.headers.get('Retry-After'))
                            .toBe('60');
                        expect(res.headers.get('Cache-Control'))
                            .toBe('no-store');

                        const body = await res.text();

                        expect(body)
                            .toContain('Too many requests from 203.0.113.10');
                        expect(body)
                            .toContain('https://proxyherd.github.io/proxyherd/deployment/fingerprint');

                        // Another address has its own count
                        expect((await call(
                            '/api/json',
                            env,
                            '203.0.113.11'
                        )).status)
                            .toBe(200);
                    }
                );

                it(
                    'should count the addresses of one IPv6 /64 network together',
                    async() => {
                        const env = {
                            RATE_LIMITER: new RateLimiterMock(1),
                        };

                        expect((await call(
                            '/api/json',
                            env,
                            '2001:db8:1:2::1'
                        )).status)
                            .toBe(200);

                        const res = await call(
                            '/api/json',
                            env,
                            '2001:db8:1:2:aaaa:bbbb:cccc:dddd'
                        );

                        expect(res.status)
                            .toBe(429);
                        expect(await res.text())
                            .toContain('Too many requests from 2001:db8:1:2::/64');
                        expect(env.RATE_LIMITER.keys)
                            .toEqual([
                                '2001:db8:1:2::/64', '2001:db8:1:2::/64',
                            ]);

                        // The answer still carries the address itself
                        const other = await call(
                            '/api/json',
                            env,
                            '2001:db8:1:3::1'
                        );

                        expect(other.status)
                            .toBe(200);
                        expect((await other.json() as { ip: string }).ip)
                            .toBe('2001:db8:1:3::1');
                    }
                );

                it(
                    'should not count /health or the description page',
                    async() => {
                        const env = {
                            RATE_LIMITER: new RateLimiterMock(0),
                        };

                        expect((await call(
                            '/health',
                            env
                        )).status)
                            .toBe(200);
                        expect((await call(
                            '/',
                            env
                        )).status)
                            .toBe(200);
                        expect(env.RATE_LIMITER.keys)
                            .toHaveLength(0);
                    }
                );

                it(
                    'should not count a request without an address',
                    async() => {
                        const env = {
                            RATE_LIMITER: new RateLimiterMock(0),
                        };
                        const res = await call(
                            '/api/text',
                            env,
                            null
                        );

                        expect(res.status)
                            .toBe(200);
                        expect(await res.text())
                            .toBe('');
                        expect(env.RATE_LIMITER.keys)
                            .toHaveLength(0);
                    }
                );

                it(
                    'should answer the request when the limiter fails, and log it without the address',
                    async() => {
                        const res = await call(
                            '/api/json',
                            {
                                RATE_LIMITER: {
                                    limit: () => Promise.reject(new Error('limiter unavailable')),
                                },
                            }
                        );

                        expect(res.status)
                            .toBe(200);
                        expect((await res.json() as { ip: string }).ip)
                            .toBe('203.0.113.10');
                        expect(errors)
                            .toHaveBeenCalledTimes(1);

                        const logged = errors.mock.calls[ 0 ][ 0 ] as string;

                        expect(JSON.parse(logged))
                            .toEqual({
                                message: 'rate limiter failed, request allowed',
                                error: 'limiter unavailable',
                            });
                        expect(logged).not.toContain('203.0.113.10');
                    }
                );
            }
        );

        describe(
            'Failure',
            () => {
                it(
                    'should answer one line of text when the request cannot be handled',
                    async() => {
                        const errors = jest.spyOn(
                            console,
                            'error'
                        )
                            .mockImplementation(() => void 0);

                        try {
                            const res = await worker.fetch(
                                {
                                    url: 'not a url',
                                    headers: new Headers(),
                                } as Request,
                                {}
                            );

                            expect(res.status)
                                .toBe(500);
                            expect(res.headers.get('Content-Type'))
                                .toBe('text/plain; charset=utf-8');
                            expect(await res.text())
                                .toBe('The fingerprint service could not answer this request.\n');
                            expect(errors)
                                .toHaveBeenCalledTimes(1);
                        } finally {
                            errors.mockRestore();
                        }
                    }
                );
            }
        );
    }
);
