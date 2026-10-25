import { createServer } from 'http';
import {
    FingerprintUrlDiscovery,
    FingerprintUrlNotDiscoveredError,
    parseFingerprintUrlDiscoveryAnswer,
} from './fingerprint.discovery';
import {
    getEnvFingerprintConfig,
    getEnvFingerprintUrl,
    getFingerprintUrlDiscovery,
} from './fingerprint.helpers';
import type { Server } from 'http';
import type { AddressInfo } from 'net';


describe(
    'Fingerprint address discovery',
    () => {
        describe(
            'Answer parsing',
            () => {
                it(
                    'should build the address from a hostname, as cloudflared answers',
                    () => {
                        expect(parseFingerprintUrlDiscoveryAnswer('{"hostname":"random-words.trycloudflare.com"}'))
                            .toBe('https://random-words.trycloudflare.com/api/json');
                    }
                );

                it(
                    'should use a url as is',
                    () => {
                        expect(parseFingerprintUrlDiscoveryAnswer('{"url":"http://fingerprint.example.com:3000/api/json"}'))
                            .toBe('http://fingerprint.example.com:3000/api/json');
                    }
                );

                it(
                    'should return nothing while the answer carries no address yet',
                    () => {
                        expect(parseFingerprintUrlDiscoveryAnswer('{"hostname":""}'))
                            .toBeUndefined();
                        expect(parseFingerprintUrlDiscoveryAnswer('{"url":"  "}'))
                            .toBeUndefined();
                    }
                );

                it(
                    'should reject other documents',
                    () => {
                        expect(() => parseFingerprintUrlDiscoveryAnswer('not json'))
                            .toThrow('not a JSON document');
                        expect(() => parseFingerprintUrlDiscoveryAnswer('"a string"'))
                            .toThrow('not a JSON object');
                        expect(() => parseFingerprintUrlDiscoveryAnswer('{"address":"x"}'))
                            .toThrow('neither a "url" nor a "hostname"');
                    }
                );
            }
        );

        describe(
            'Polling a discovery endpoint',
            () => {
                let server: Server;
                let discoveryUrl: string;
                let status = 200;
                let body = '{"hostname":""}';

                beforeAll(async() => {
                    server = createServer((
                        req, res
                    ) => {
                        res.statusCode = status;
                        res.setHeader(
                            'Content-Type',
                            'application/json'
                        );
                        res.end(body);
                    });

                    await new Promise<void>((resolve) => {
                        server.listen(
                            0,
                            '127.0.0.1',
                            () => {
                                resolve();
                            }
                        );
                    });

                    const port = (server.address() as AddressInfo).port;
                    discoveryUrl = `http://127.0.0.1:${port}/quicktunnel`;
                });

                afterAll(async() => {
                    await new Promise<void>((resolve) => {
                        server.close(() => {
                            resolve();
                        });
                    });
                });

                beforeEach(() => {
                    status = 200;
                    body = '{"hostname":""}';
                });

                it(
                    'should wait for the first answer, then follow changes',
                    async() => {
                        const discovery = new FingerprintUrlDiscovery({
                            discoveryUrl,
                            delay: 60000,
                        });

                        expect(discovery.url)
                            .toBeUndefined();

                        await expect(discovery.refresh())
                            .resolves
                            .toBeUndefined();
                        await expect(discovery.waitForUrl(50))
                            .rejects
                            .toThrow(FingerprintUrlNotDiscoveredError);

                        body = '{"hostname":"first.trycloudflare.com"}';

                        await expect(discovery.refresh())
                            .resolves
                            .toBe('https://first.trycloudflare.com/api/json');
                        expect(discovery.url)
                            .toBe('https://first.trycloudflare.com/api/json');
                        await expect(discovery.waitForUrl(50))
                            .resolves
                            .toBe('https://first.trycloudflare.com/api/json');

                        body = '{"hostname":"second.trycloudflare.com"}';

                        await discovery.refresh();

                        expect(discovery.url)
                            .toBe('https://second.trycloudflare.com/api/json');
                    }
                );

                it(
                    'should keep the last address when the endpoint fails',
                    async() => {
                        body = '{"url":"http://203.0.113.10:3000/api/json"}';

                        const discovery = new FingerprintUrlDiscovery({
                            discoveryUrl,
                            delay: 60000,
                        });

                        await discovery.refresh();

                        status = 503;
                        body = 'down';

                        await expect(discovery.refresh())
                            .rejects
                            .toThrow('503');
                        expect(discovery.url)
                            .toBe('http://203.0.113.10:3000/api/json');

                        status = 200;
                        body = 'not json';

                        await expect(discovery.refresh())
                            .rejects
                            .toThrow('not a JSON document');
                        expect(discovery.url)
                            .toBe('http://203.0.113.10:3000/api/json');
                    }
                );

                it(
                    'should start from the initial address and release waiters when polling finds one',
                    async() => {
                        const discovery = new FingerprintUrlDiscovery({
                            discoveryUrl,
                            delay: 20,
                            initialUrl: 'http://initial.example.com/api/json',
                        });

                        expect(discovery.url)
                            .toBe('http://initial.example.com/api/json');

                        const empty = new FingerprintUrlDiscovery({
                            discoveryUrl,
                            delay: 20,
                        });
                        try {
                            empty.start();

                            const waiting = empty.waitForUrl(5000);

                            body = '{"hostname":"polled.trycloudflare.com"}';

                            await expect(waiting)
                                .resolves
                                .toBe('https://polled.trycloudflare.com/api/json');
                        } finally {
                            empty.stop();
                        }
                    }
                );

                describe(
                    'From the environment',
                    () => {
                        const saved: Record<string, string | undefined> = {};
                        const keys = [
                            'FINGERPRINT_URL', 'FINGERPRINT_URL_DISCOVERY', 'FINGERPRINT_URL_DISCOVERY_DELAY',
                        ];

                        beforeEach(() => {
                            for (const key of keys) {
                                saved[ key ] = process.env[ key ];
                                delete process.env[ key ];
                            }
                        });

                        afterEach(() => {
                            for (const key of keys) {
                                delete process.env[ key ];
                            }

                            // Stops the shared discovery
                            getFingerprintUrlDiscovery();

                            for (const key of keys) {
                                if (saved[ key ] !== undefined) {
                                    process.env[ key ] = saved[ key ];
                                }
                            }
                        });

                        it(
                            'should prefer an explicit address, then FINGERPRINT_URL, and fail without any',
                            () => {
                                expect(() => getEnvFingerprintUrl())
                                    .toThrow('FINGERPRINT_URL is not set');
                                expect(() => getEnvFingerprintConfig('1.0.0'))
                                    .toThrow('FINGERPRINT_URL is not set');

                                process.env.FINGERPRINT_URL = 'http://env.example.com/api/json';

                                expect(getEnvFingerprintUrl())
                                    .toBe('http://env.example.com/api/json');
                                expect(getEnvFingerprintUrl('http://arg.example.com/api/json'))
                                    .toBe('http://arg.example.com/api/json');
                                expect(getEnvFingerprintConfig('1.0.0').url)
                                    .toBe('http://env.example.com/api/json');
                            }
                        );

                        it(
                            'should read the discovered address on every access',
                            async() => {
                                process.env.FINGERPRINT_URL_DISCOVERY = discoveryUrl;
                                process.env.FINGERPRINT_URL_DISCOVERY_DELAY = '60000';

                                // Starts without an address. NestJS serialises module options at
                                // start, so the getter answers an empty string instead of throwing.
                                const config = getEnvFingerprintConfig('1.0.0');

                                expect(config.url)
                                    .toBe('');
                                expect(JSON.stringify(config))
                                    .toContain('"url":""');
                                expect(() => getEnvFingerprintUrl())
                                    .toThrow(FingerprintUrlNotDiscoveredError);

                                // An explicit address still wins
                                expect(getEnvFingerprintConfig(
                                    '1.0.0',
                                    'http://arg.example.com/api/json'
                                ).url)
                                    .toBe('http://arg.example.com/api/json');

                                const discovery = getFingerprintUrlDiscovery() as FingerprintUrlDiscovery;
                                expect(discovery.discoveryUrl)
                                    .toBe(discoveryUrl);

                                body = '{"hostname":"first.trycloudflare.com"}';
                                await discovery.refresh();

                                expect(config.url)
                                    .toBe('https://first.trycloudflare.com/api/json');
                                expect(getEnvFingerprintUrl())
                                    .toBe('https://first.trycloudflare.com/api/json');

                                // Connector install tasks store the options as JSON
                                expect(JSON.parse(JSON.stringify(config)).url)
                                    .toBe('https://first.trycloudflare.com/api/json');

                                body = '{"hostname":"second.trycloudflare.com"}';
                                await discovery.refresh();

                                expect(config.url)
                                    .toBe('https://second.trycloudflare.com/api/json');
                            }
                        );

                        it(
                            'should use FINGERPRINT_URL until the first answer',
                            async() => {
                                process.env.FINGERPRINT_URL = 'http://env.example.com/api/json';
                                process.env.FINGERPRINT_URL_DISCOVERY = discoveryUrl;
                                process.env.FINGERPRINT_URL_DISCOVERY_DELAY = '60000';

                                const config = getEnvFingerprintConfig('1.0.0');

                                expect(config.url)
                                    .toBe('http://env.example.com/api/json');

                                body = '{"hostname":"first.trycloudflare.com"}';
                                await (getFingerprintUrlDiscovery() as FingerprintUrlDiscovery).refresh();

                                expect(config.url)
                                    .toBe('https://first.trycloudflare.com/api/json');
                            }
                        );
                    }
                );
            }
        );
    }
);
