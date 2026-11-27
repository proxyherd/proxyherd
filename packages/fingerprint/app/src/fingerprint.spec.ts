import { request } from 'http';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import {
    EGeoipProvider,
    parseTrustProxy,
} from './config';
import { GeoipService } from './geoip/geoip.service';
import type { IFingerprintServiceConfig } from './config';
import type { IGeoipLookup } from './geoip/geoip.service';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { IFingerprint } from '@proxyherd/common';
import type { AddressInfo } from 'net';


const CONFIG: IFingerprintServiceConfig = {
    port: 0,
    provider: EGeoipProvider.None,
    dataDir: 'geoip',
    autoDownload: false,
    refreshIntervalMs: 0,
    maxmindLicenseKey: void 0,
    trustProxy: 0,
    rateLimitPerMinute: 0,
    downloadTimeoutMs: 1000,
};
const LOOKUP: IGeoipLookup = {
    asnName: 'Dummy ASN',
    asnNetwork: '1.1.1.0/24',
    continentCode: 'EU',
    continentName: 'Europe',
    countryCode: 'FR',
    countryName: 'France',
    cityName: 'Paris',
    timezone: 'Europe/Paris',
    latitude: 48.8534,
    longitude: 2.3488,
};


function fetch(
    port: number, path: string, headers: Record<string, string> = {}
): Promise<{ status: number; contentType: string; cacheControl: string; retryAfter: string; body: string }> {
    return new Promise((
        resolve, reject
    ) => {
        const req = request(
            {
                hostname: '127.0.0.1',
                port,
                path,
                method: 'GET',
                headers,
            },
            (res) => {
                const chunks: Buffer[] = [];
                res.on(
                    'data',
                    (chunk: Buffer) => chunks.push(chunk)
                );
                res.on(
                    'end',
                    () => {
                        resolve({
                            status: res.statusCode ?? 0,
                            contentType: res.headers[ 'content-type' ] ?? '',
                            cacheControl: res.headers[ 'cache-control' ] ?? '',
                            retryAfter: res.headers[ 'retry-after' ] ?? '',
                            body: Buffer.concat(chunks)
                                .toString(),
                        });
                    }
                );
                res.on(
                    'error',
                    reject
                );
            }
        );
        req.on(
            'error',
            reject
        );
        req.end();
    });
}


interface IStartedApp {
    app: NestExpressApplication;
    port: number;
    geoipLookup: jest.Mock;
}


// The service as main.ts starts it, with the GeoIP databases replaced by a fixed answer
async function startApp(config: IFingerprintServiceConfig): Promise<IStartedApp> {
    const geoipLookup = jest.fn()
        .mockReturnValue(LOOKUP);
    const moduleRef = await Test.createTestingModule({
        imports: [
            AppModule.forRoot(config),
        ],
    })
        .overrideProvider(GeoipService)
        .useValue({
            lookup: geoipLookup,
            status: {
                provider: EGeoipProvider.None,
                attribution: null,
                city: false,
                asn: false,
                refreshedAt: null,
                lastError: null,
            },
        })
        .compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>();
    setupApp(
        app,
        config
    );
    await app.listen(0);

    return {
        app,
        port: (app.getHttpServer()
            .address() as AddressInfo).port,
        geoipLookup,
    };
}


describe(
    'Fingerprint service',
    () => {
        let app: NestExpressApplication;
        let port: number;
        let geoipLookup: jest.Mock;

        beforeAll(async() => {
            const started = await startApp(CONFIG);
            app = started.app;
            port = started.port;
            geoipLookup = started.geoipLookup;
        });

        afterAll(async() => {
            await app.close();
        });

        it(
            'should answer /api/json with the fingerprint contract',
            async() => {
                const res = await fetch(
                    port,
                    '/api/json',
                    {
                        'User-Agent': 'ProxyHerd/1.0.0 (test)',
                    }
                );
                expect(res.status)
                    .toBe(200);
                expect(res.contentType)
                    .toContain('application/json');
                expect(res.cacheControl)
                    .toBe('no-store');

                const fingerprint = JSON.parse(res.body) as IFingerprint;
                expect(fingerprint.ip)
                    .toBe('127.0.0.1');
                expect(fingerprint.useragent)
                    .toBe('ProxyHerd/1.0.0 (test)');
                expect(fingerprint)
                    .toMatchObject(LOOKUP);
                expect(geoipLookup)
                    .toHaveBeenCalledWith('127.0.0.1');
            }
        );

        it(
            'should answer /api/text with the plain IP',
            async() => {
                const res = await fetch(
                    port,
                    '/api/text'
                );
                expect(res.status)
                    .toBe(200);
                expect(res.contentType)
                    .toContain('text/plain');
                expect(res.cacheControl)
                    .toBe('no-store');
                expect(res.body)
                    .toBe('127.0.0.1');
            }
        );

        it(
            'should ignore X-Forwarded-For unless TRUST_PROXY is on',
            async() => {
                const res = await fetch(
                    port,
                    '/api/text',
                    {
                        'X-Forwarded-For': '203.0.113.9',
                    }
                );
                expect(res.body)
                    .toBe('127.0.0.1');
            }
        );

        it(
            'should expose health and a description',
            async() => {
                const health = await fetch(
                    port,
                    '/health'
                );
                expect(health.status)
                    .toBe(200);
                expect(JSON.parse(health.body))
                    .toMatchObject({
                        status: 'ok',
                        provider: 'none',
                        rateLimit: false,
                    });

                const root = await fetch(
                    port,
                    '/'
                );
                expect(root.status)
                    .toBe(200);
                expect(root.body)
                    .toContain('ProxyHerd fingerprint service');
            }
        );
    }
);


describe(
    'Fingerprint service behind a reverse proxy (TRUST_PROXY)',
    () => {
        it(
            'should read TRUST_PROXY as a number of proxies, with true for one',
            () => {
                expect(parseTrustProxy(void 0))
                    .toBe(0);
                expect(parseTrustProxy(''))
                    .toBe(0);
                expect(parseTrustProxy('false'))
                    .toBe(0);
                expect(parseTrustProxy('0'))
                    .toBe(0);
                expect(parseTrustProxy('true'))
                    .toBe(1);
                expect(parseTrustProxy('yes'))
                    .toBe(1);
                expect(parseTrustProxy('1'))
                    .toBe(1);
                expect(parseTrustProxy('2'))
                    .toBe(2);
            }
        );

        describe(
            'One proxy',
            () => {
                let app: NestExpressApplication;
                let port: number;

                beforeAll(async() => {
                    const started = await startApp({
                        ...CONFIG,
                        trustProxy: 1,
                    });
                    app = started.app;
                    port = started.port;
                });

                afterAll(async() => {
                    await app.close();
                });

                it(
                    'should report the address the proxy saw',
                    async() => {
                        const res = await fetch(
                            port,
                            '/api/text',
                            {
                                'X-Forwarded-For': '203.0.113.50',
                            }
                        );
                        expect(res.body)
                            .toBe('203.0.113.50');
                    }
                );

                it(
                    'should not report an address the caller put in the header itself',
                    async() => {
                        // A proxy that appends (nginx, Cloudflare) sends: <what the caller sent>, <the caller>
                        const res = await fetch(
                            port,
                            '/api/text',
                            {
                                'X-Forwarded-For': '198.51.100.7, 203.0.113.50',
                            }
                        );
                        expect(res.body)
                            .toBe('203.0.113.50');
                    }
                );

                it(
                    'should fall back to the socket address without the header',
                    async() => {
                        const res = await fetch(
                            port,
                            '/api/text'
                        );
                        expect(res.body)
                            .toBe('127.0.0.1');
                    }
                );
            }
        );

        describe(
            'Two proxies',
            () => {
                let app: NestExpressApplication;
                let port: number;

                beforeAll(async() => {
                    const started = await startApp({
                        ...CONFIG,
                        trustProxy: 2,
                    });
                    app = started.app;
                    port = started.port;
                });

                afterAll(async() => {
                    await app.close();
                });

                it(
                    'should report the address the outer proxy saw',
                    async() => {
                        const res = await fetch(
                            port,
                            '/api/text',
                            {
                                'X-Forwarded-For': '198.51.100.7, 203.0.113.50, 10.0.0.2',
                            }
                        );
                        expect(res.body)
                            .toBe('203.0.113.50');
                    }
                );
            }
        );
    }
);


describe(
    'Fingerprint service with a rate limit (RATE_LIMIT_PER_MINUTE)',
    () => {
        let app: NestExpressApplication;
        let port: number;

        beforeAll(async() => {
            const started = await startApp({
                ...CONFIG,
                trustProxy: 1,
                rateLimitPerMinute: 3,
            });
            app = started.app;
            port = started.port;
        });

        afterAll(async() => {
            await app.close();
        });

        function check(
            ip: string, path = '/api/json'
        ) {
            return fetch(
                port,
                path,
                {
                    'X-Forwarded-For': ip,
                }
            );
        }

        it(
            'should answer 429 with an explanation over the limit, per address',
            async() => {
                expect((await check('203.0.113.10')).status)
                    .toBe(200);
                expect((await check(
                    '203.0.113.10',
                    '/api/text'
                )).status)
                    .toBe(200);
                expect((await check('203.0.113.10')).status)
                    .toBe(200);

                const res = await check('203.0.113.10');
                expect(res.status)
                    .toBe(429);
                expect(res.contentType)
                    .toBe('text/plain; charset=utf-8');
                expect(res.retryAfter)
                    .toBe('60');
                expect(res.cacheControl)
                    .toBe('no-store');
                expect(res.body)
                    .toContain('Too many requests from 203.0.113.10');
                expect(res.body)
                    .toContain('https://proxyherd.github.io/proxyherd/deployment/fingerprint');

                // Another address has its own count
                expect((await check('203.0.113.11')).status)
                    .toBe(200);
            }
        );

        it(
            'should count the addresses of one IPv6 /64 network together',
            async() => {
                expect((await check('2001:db8:1:2::1')).status)
                    .toBe(200);
                expect((await check('2001:db8:1:2::2')).status)
                    .toBe(200);
                expect((await check('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).status)
                    .toBe(200);

                const res = await check('2001:db8:1:2::3');
                expect(res.status)
                    .toBe(429);
                expect(res.body)
                    .toContain('Too many requests from 2001:db8:1:2::/64');

                expect((await check('2001:db8:1:3::1')).status)
                    .toBe(200);
            }
        );

        it(
            'should not be bypassed by an address the caller adds to the header',
            async() => {
                for (let i = 0; i < 3; ++i) {
                    expect((await check(`198.51.100.${i}, 203.0.113.20`)).status)
                        .toBe(200);
                }

                expect((await check('198.51.100.99, 203.0.113.20')).status)
                    .toBe(429);
            }
        );

        it(
            'should never limit /health, which says that the limit is in place',
            async() => {
                for (let i = 0; i < 6; ++i) {
                    const res = await check(
                        '203.0.113.30',
                        '/health'
                    );
                    expect(res.status)
                        .toBe(200);
                    expect(JSON.parse(res.body))
                        .toMatchObject({
                            status: 'ok',
                            rateLimit: true,
                        });
                }
            }
        );
    }
);
