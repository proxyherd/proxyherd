import { createServer } from 'http';
import { FingerprintServiceWatch } from './fingerprint.watch';
import type { Server } from 'http';
import type { AddressInfo } from 'net';


const CONFIG = {
    timeout: 1000,
    okTtl: 60000,
    failTtl: 0,
};


describe(
    'Fingerprint service watch',
    () => {
        let server: Server;
        let port: number;
        let url: string;
        let status = 200;
        let requests = 0;

        function listen(onPort: number): Promise<void> {
            server = createServer((
                req, res
            ) => {
                requests += 1;
                res.writeHead(status);
                res.end(status === 200 ? '{"ip":"203.0.113.10"}' : 'no');
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

        beforeEach(async() => {
            status = 200;
            requests = 0;
            await listen(0);
            port = (server.address() as AddressInfo).port;
            url = `http://127.0.0.1:${port}/api/json`;
        });

        afterEach(async() => {
            if (server.listening) {
                await close();
            }
        });

        it(
            'should not call the service down while it answers',
            async() => {
                const watch = new FingerprintServiceWatch(
                    'ProxyHerd/1.0.0',
                    CONFIG
                );

                expect(await watch.isDown(url))
                    .toBe(false);
                expect(requests)
                    .toBe(1);
            }
        );

        it(
            'should call the service down when it answered before and does not now, and up again when it is back',
            async() => {
                const watch = new FingerprintServiceWatch(
                    'ProxyHerd/1.0.0',
                    CONFIG
                );

                expect(await watch.isDown(url))
                    .toBe(false);

                await close();
                expect(await watch.isDown(url))
                    .toBe(true);
                expect(await watch.isDown(url))
                    .toBe(true);

                await listen(port);
                expect(await watch.isDown(url))
                    .toBe(false);
            }
        );

        it(
            'should call the service down when it answers with an error page',
            async() => {
                const watch = new FingerprintServiceWatch(
                    'ProxyHerd/1.0.0',
                    CONFIG
                );

                expect(await watch.isDown(url))
                    .toBe(false);

                status = 530;
                expect(await watch.isDown(url))
                    .toBe(true);
            }
        );

        it(
            'should take a service that limits this machine as running',
            async() => {
                const watch = new FingerprintServiceWatch(
                    'ProxyHerd/1.0.0',
                    CONFIG
                );

                status = 429;
                expect(await watch.isDown(url))
                    .toBe(false);

                // It answered: a later silence is an outage
                await close();
                expect(await watch.isDown(url))
                    .toBe(true);
            }
        );

        it(
            'should know nothing, and say so, on a machine the service never answered',
            async() => {
                const watch = new FingerprintServiceWatch(
                    'ProxyHerd/1.0.0',
                    CONFIG
                );

                await close();

                // Never reachable from here: failed checks must keep counting
                expect(await watch.isDown(url))
                    .toBe(false);
                expect(await watch.isDown(url))
                    .toBe(false);
            }
        );

        it(
            'should start over when the address changes',
            async() => {
                const watch = new FingerprintServiceWatch(
                    'ProxyHerd/1.0.0',
                    CONFIG
                );

                expect(await watch.isDown(url))
                    .toBe(false);

                // A discovered address that changed, and does not answer: nothing is known about it
                expect(await watch.isDown('http://127.0.0.1:1/api/json'))
                    .toBe(false);
                expect(await watch.isDown(''))
                    .toBe(false);
            }
        );

        it(
            'should ask in the background while checks run, without asking on every turn',
            async() => {
                let nowTime = 1000000;
                const watch = new FingerprintServiceWatch(
                    'ProxyHerd/1.0.0',
                    {
                        timeout: 1000,
                        okTtl: 60000,
                        failTtl: 10000,
                    },
                    () => nowTime
                );

                watch.touch(url);
                watch.touch(url);
                // Waits for the request that is under way
                expect(await watch.isDown(url))
                    .toBe(false);
                expect(requests)
                    .toBe(1);

                nowTime += 30000;
                watch.touch(url);
                expect(requests)
                    .toBe(1);

                // Known to answer a few seconds ago: a failed check right after an outage starts asks again
                await close();
                expect(await watch.isDown(url))
                    .toBe(true);
            }
        );
    }
);
