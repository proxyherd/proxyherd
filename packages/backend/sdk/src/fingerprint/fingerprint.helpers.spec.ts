import { createServer } from 'http';
import { EFingerprintMode } from '@proxyherd/common';
import { Sockets } from '@proxyherd/proxy-sdk';
import { fingerprint } from './fingerprint.helpers';
import type { ArrayHttpHeaders } from '../helpers';
import type { ATransportService } from '../transports';
import type {
    IFingerprint,
    IFingerprintOptions,
    IFingerprintRequest,
    IProxyToRefresh,
} from '@proxyherd/common';
import type {
    ClientRequestArgs,
    Server,
} from 'http';
import type { AddressInfo } from 'net';


const FINGERPRINT: IFingerprint = {
    ip: '203.0.113.10',
    useragent: 'ProxyHerd/1.0.0',
    asnName: 'Example Network',
    asnNetwork: '203.0.113.0/24',
    continentCode: 'EU',
    continentName: 'Europe',
    countryCode: 'FR',
    countryName: 'France',
    cityName: 'Paris',
    timezone: 'Europe/Paris',
    latitude: 48.8566,
    longitude: 2.3522,
};
// Reaches the fingerprint service directly: what matters here is how its answers are handled
const transport = {
    buildFingerprintRequestArgs(
        method: string | undefined,
        urlOpts: { hostname: string | undefined; port: number; pathname: string },
        headers: ArrayHttpHeaders
    ): ClientRequestArgs {
        return {
            method,
            hostname: urlOpts.hostname,
            port: urlOpts.port,
            path: urlOpts.pathname,
            headers: headers.toArray() as any,
            timeout: 5000,
        };
    },
} as unknown as ATransportService;
const proxy: IProxyToRefresh = {
    id: 'proxy1',
    type: 'test',
    transportType: 'test',
    projectId: 'project1',
    connectorId: 'connector1',
    key: 'proxy1',
    config: {},
    useragent: 'ProxyHerd/1.0.0',
    timeoutDisconnected: 5000,
    ciphers: null,
    requests: 0,
    requestsValid: 0,
    requestsInvalid: 0,
    bytesReceived: 0,
    bytesSent: 0,
};
const fpRequest: IFingerprintRequest = {
    installId: 'install1',
    mode: EFingerprintMode.CONNECTOR,
    connectorType: 'test',
    proxyId: 'proxy1',
};


describe(
    'Fingerprint check',
    () => {
        let server: Server;
        let options: IFingerprintOptions;
        let status = 200;
        let body = '';
        let requests: string[] = [];

        beforeAll(async() => {
            server = createServer((
                req, res
            ) => {
                requests.push(req.url as string);

                res.writeHead(
                    status,
                    {
                        'Content-Type': status === 200 ? 'application/json' : 'text/plain',
                    }
                );
                res.end(body);
            });

            await new Promise<void>((resolve) => {
                server.listen(
                    0,
                    '127.0.0.1',
                    resolve
                );
            });

            options = {
                url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/json`,
                useragent: 'ProxyHerd/1.0.0',
                followRedirectMax: 3,
                retryMax: 2,
            };
        });

        afterAll(async() => {
            await new Promise<void>((resolve) => {
                server.close(() => {
                    resolve();
                });
            });
        });

        beforeEach(() => {
            requests = [];
        });

        function check(): Promise<IFingerprint> {
            return fingerprint(
                transport,
                proxy,
                options,
                fpRequest,
                new Sockets()
            );
        }

        it(
            'should return the fingerprint with a single request',
            async() => {
                status = 200;
                body = JSON.stringify(FINGERPRINT);

                await expect(check()).resolves.toEqual(FINGERPRINT);
                expect(requests)
                    .toEqual([
                        '/api/json?version=3',
                    ]);
            }
        );

        it(
            'should try a failed check again, up to retryMax times',
            async() => {
                status = 503;
                body = 'Service unavailable';

                await expect(check()).rejects.toThrow('Get 503 status code: Service unavailable');
                expect(requests)
                    .toHaveLength(3);
            }
        );

        it(
            'should not try a rate limited check again, and give the answer of the service as the reason',
            async() => {
                status = 429;
                body = 'Too many requests from 203.0.113.10 to this fingerprint service.';

                await expect(check()).rejects.toThrow(`Get 429 status code: ${body}`);
                expect(requests)
                    .toHaveLength(1);
            }
        );
    }
);
