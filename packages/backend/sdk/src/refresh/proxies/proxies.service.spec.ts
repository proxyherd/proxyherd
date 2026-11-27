import { createServer } from 'http';
import { RefreshProxiesService } from './proxies.service';
import { NoProxyToRefreshError } from '../../errors';
import {
    FingerprintBudget,
    FingerprintServiceWatch,
    resetFingerprintState,
} from '../../fingerprint';
import type { IRefreshProxiesModuleConfig } from './proxies.module';
import type { CommanderRefreshClientService } from '../../commander-client';
import type { ArrayHttpHeaders } from '../../helpers';
import type { TransportprovidersService } from '../../transports';
import type {
    IProxiesToRefresh,
    IProxyRefreshed,
    IProxyToRefresh,
} from '@proxyherd/common';
import type {
    ClientRequestArgs,
    Server,
} from 'http';
import type { AddressInfo } from 'net';


const USERAGENT = 'ProxyHerd/1.0.0';
const SHARED_URL = 'https://fingerprint.proxyherd.com/api/json';
const WATCH_CONFIG = {
    timeout: 1000,
    okTtl: 60000,
    failTtl: 0,
};


function proxyToRefresh(
    id: string, dead = false
): IProxyToRefresh {
    return {
        id,
        type: 'test',
        transportType: 'test',
        projectId: 'project1',
        connectorId: 'connector1',
        key: id,
        config: {
            dead,
        },
        useragent: USERAGENT,
        timeoutDisconnected: 5000,
        ciphers: null,
        requests: 0,
        requestsValid: 0,
        requestsInvalid: 0,
        bytesReceived: 0,
        bytesSent: 0,
    };
}


function proxiesToRefresh(...proxies: IProxyToRefresh[]): IProxiesToRefresh {
    return {
        installId: 'install1',
        proxies,
    };
}


// A live proxy relays to the fingerprint service; a dead one connects to a port nothing listens on
const transportproviders = {
    getTransportByType: () => ({
        buildFingerprintRequestArgs(
            method: string | undefined,
            urlOpts: { hostname: string | undefined; port: number; pathname: string },
            headers: ArrayHttpHeaders,
            headersConnect: unknown,
            proxy: IProxyToRefresh
        ): ClientRequestArgs {
            return {
                method,
                hostname: urlOpts.hostname,
                port: proxy.config.dead ? 1 : urlOpts.port,
                path: urlOpts.pathname,
                headers: headers.toArray() as any,
                timeout: 2000,
            };
        },
    }),
} as unknown as TransportprovidersService;


describe(
    'Refresh of proxies',
    () => {
        let getNextProxiesToRefresh: jest.Mock;
        let refreshProxies: jest.Mock;
        let commander: CommanderRefreshClientService;

        function service(url: string): RefreshProxiesService {
            const config: IRefreshProxiesModuleConfig = {
                url: 'http://127.0.0.1:1/api',
                useragent: USERAGENT,
                jwt: {
                    secret: 'secret',
                    expiration: '60s',
                },
                emptyDelay: 10,
                errorDelay: 10,
                fingerprint: {
                    url,
                    useragent: USERAGENT,
                    followRedirectMax: 0,
                    retryMax: 0,
                },
                trackSockets: false,
            };

            return new RefreshProxiesService(
                config,
                commander,
                transportproviders
            );
        }

        beforeEach(() => {
            getNextProxiesToRefresh = jest.fn();
            refreshProxies = jest.fn()
                .mockResolvedValue(void 0);
            commander = {
                getNextProxiesToRefresh,
                refreshProxies,
            } as unknown as CommanderRefreshClientService;
        });

        afterEach(() => {
            resetFingerprintState();
        });

        describe(
            'Budget of the shared service',
            () => {
                it(
                    'should take every due proxy from the commander with a service of its own',
                    async() => {
                        getNextProxiesToRefresh.mockResolvedValue(proxiesToRefresh(proxyToRefresh('p1')));

                        const refresh = service('https://fingerprint.example.com/api/json');

                        expect(await refresh.next())
                            .toBeDefined();
                        expect(getNextProxiesToRefresh)
                            .toHaveBeenCalledWith(void 0);
                    }
                );

                it(
                    'should take what the budget covers and leave the rest due',
                    async() => {
                        let nowTime = 1000000;
                        resetFingerprintState(new FingerprintBudget(
                            10,
                            3,
                            () => nowTime
                        ));
                        getNextProxiesToRefresh.mockImplementation((count: number) => Promise.resolve(proxiesToRefresh(...[
                            proxyToRefresh('p1'), proxyToRefresh('p2'), proxyToRefresh('p3'),
                        ].slice(
                            0,
                            count
                        ))));

                        const refresh = service(SHARED_URL);

                        // The reserve of 3
                        expect((await refresh.next())?.proxies)
                            .toHaveLength(3);
                        expect(getNextProxiesToRefresh)
                            .toHaveBeenLastCalledWith(3);

                        // Used up: the commander is not asked, the loop waits
                        expect(await refresh.next())
                            .toBeUndefined();
                        expect(getNextProxiesToRefresh)
                            .toHaveBeenCalledTimes(1);

                        // 10 a minute: one more after 6 seconds
                        nowTime += 6000;
                        expect((await refresh.next())?.proxies)
                            .toHaveLength(1);
                        expect(getNextProxiesToRefresh)
                            .toHaveBeenLastCalledWith(1);
                    }
                );

                it(
                    'should keep its budget when nothing is due',
                    async() => {
                        resetFingerprintState(new FingerprintBudget(
                            10,
                            3
                        ));
                        getNextProxiesToRefresh.mockRejectedValue(new NoProxyToRefreshError());

                        const refresh = service(SHARED_URL);

                        expect(await refresh.next())
                            .toBeUndefined();
                        expect(await refresh.next())
                            .toBeUndefined();
                        expect(getNextProxiesToRefresh)
                            .toHaveBeenLastCalledWith(3);
                    }
                );
            }
        );

        describe(
            'Fingerprint service down',
            () => {
                let server: Server;
                let port: number;
                let url: string;

                function listen(onPort: number): Promise<void> {
                    server = createServer((
                        req, res
                    ) => {
                        res.writeHead(
                            200,
                            {
                                'Content-Type': 'application/json',
                            }
                        );
                        res.end(JSON.stringify({
                            ip: '203.0.113.10',
                            useragent: USERAGENT,
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
                        }));
                    });

                    return new Promise<void>((resolve) => {
                        server.listen(
                            onPort,
                            '127.0.0.1',
                            resolve
                        );
                    });
                }

                function close(): Promise<void> {
                    return new Promise<void>((resolve) => {
                        server.close(() => {
                            resolve();
                        });
                    });
                }

                function reported(): IProxyRefreshed[] {
                    return refreshProxies.mock.calls[ refreshProxies.mock.calls.length - 1 ][ 0 ] as IProxyRefreshed[];
                }

                beforeEach(async() => {
                    await listen(0);
                    port = (server.address() as AddressInfo).port;
                    url = `http://127.0.0.1:${port}/api/json`;

                    resetFingerprintState(
                        void 0,
                        new FingerprintServiceWatch(
                            USERAGENT,
                            WATCH_CONFIG
                        )
                    );
                });

                afterEach(async() => {
                    if (server.listening) {
                        await close();
                    }
                });

                it(
                    'should report a proxy that fails while the service answers',
                    async() => {
                        const refresh = service(url);

                        await refresh.task(proxiesToRefresh(
                            proxyToRefresh('alive'),
                            proxyToRefresh(
                                'dead',
                                true
                            )
                        ));

                        expect(reported())
                            .toHaveLength(2);
                        expect(reported()[ 0 ])
                            .toMatchObject({
                                id: 'alive',
                                fingerprintError: null,
                            });
                        expect(reported()[ 0 ].fingerprint?.ip)
                            .toBe('203.0.113.10');
                        expect(reported()[ 1 ])
                            .toMatchObject({
                                id: 'dead',
                                fingerprint: null,
                            });
                        expect(reported()[ 1 ].fingerprintError)
                            .toBeTruthy();
                    }
                );

                it(
                    'should set failed checks aside while the service itself is down, and count them again when it is back',
                    async() => {
                        const refresh = service(url);

                        // The service answers this machine
                        await refresh.task(proxiesToRefresh(proxyToRefresh('p1')));
                        expect(reported())
                            .toHaveLength(1);

                        // It stops: every check fails, and none of it is reported
                        await close();
                        refreshProxies.mockClear();
                        await refresh.task(proxiesToRefresh(
                            proxyToRefresh('p1'),
                            proxyToRefresh('p2')
                        ));
                        expect(refreshProxies).not.toHaveBeenCalled();

                        // It is back: a proxy that fails is reported again
                        await listen(port);
                        await refresh.task(proxiesToRefresh(
                            proxyToRefresh('p1'),
                            proxyToRefresh(
                                'p2',
                                true
                            )
                        ));
                        expect(reported())
                            .toHaveLength(2);
                        expect(reported()[ 1 ])
                            .toMatchObject({
                                id: 'p2',
                                fingerprint: null,
                            });
                    }
                );

                it(
                    'should keep reporting failed checks on a machine the service never answered',
                    async() => {
                        await close();

                        const refresh = service(url);

                        await refresh.task(proxiesToRefresh(proxyToRefresh('p1')));

                        expect(reported())
                            .toHaveLength(1);
                        expect(reported()[ 0 ])
                            .toMatchObject({
                                id: 'p1',
                                fingerprint: null,
                            });
                    }
                );
            }
        );
    }
);
