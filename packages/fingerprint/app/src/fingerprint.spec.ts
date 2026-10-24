import { request } from 'http';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { EGeoipProvider } from './config';
import { GeoipService } from './geoip/geoip.service';
import type { IFingerprintServiceConfig } from './config';
import type { IGeoipLookup } from './geoip/geoip.service';
import type { INestApplication } from '@nestjs/common';
import type { IFingerprint } from '@proxyherd/common';
import type { AddressInfo } from 'net';


const CONFIG: IFingerprintServiceConfig = {
    port: 0,
    provider: EGeoipProvider.None,
    dataDir: 'geoip',
    autoDownload: false,
    refreshIntervalMs: 0,
    maxmindLicenseKey: void 0,
    trustProxy: false,
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
): Promise<{ status: number; contentType: string; body: string }> {
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


describe(
    'Fingerprint service',
    () => {
        let app: INestApplication;
        let port: number;
        let geoipLookup: jest.Mock;

        beforeAll(async() => {
            geoipLookup = jest.fn()
                .mockReturnValue(LOOKUP);

            const moduleRef = await Test.createTestingModule({
                imports: [
                    AppModule.forRoot(CONFIG),
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

            app = moduleRef.createNestApplication();
            await app.listen(0);
            port = (app.getHttpServer()
                .address() as AddressInfo).port;
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
