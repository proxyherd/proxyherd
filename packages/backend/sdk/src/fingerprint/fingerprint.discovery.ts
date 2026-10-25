import {
    IncomingMessage,
    request as requestHttp,
} from 'http';
import { request as requestHttps } from 'https';
import { Logger } from '@nestjs/common';
import { ONE_SECOND_IN_MS } from '@proxyherd/common';


export const FINGERPRINT_URL_DISCOVERY_DELAY_DEFAULT = 10 * ONE_SECOND_IN_MS;

/** How long a check waits for the first answer before giving up on the proxy. */
export const FINGERPRINT_URL_DISCOVERY_WAIT = 30 * ONE_SECOND_IN_MS;

const DISCOVERY_REQUEST_TIMEOUT = 5 * ONE_SECOND_IN_MS;
const DISCOVERY_ANSWER_MAX_LENGTH = 64 * 1024;


export class FingerprintUrlNotDiscoveredError extends Error {
    constructor(discoveryUrl: string) {
        super(`The fingerprint address has not been discovered yet from ${discoveryUrl}`);
    }
}


export interface IFingerprintUrlDiscoveryOptions {
    /** Endpoint that knows the public address of the fingerprint service. */
    discoveryUrl: string;
    /** Milliseconds between two polls. */
    delay: number;
    /** Address to use until the first answer, typically FINGERPRINT_URL when set. */
    initialUrl?: string;
}


/**
 * Reads the fingerprint address out of a discovery answer.
 *
 * Accepted documents:
 * - `{"url": "https://fingerprint.example.com/api/json"}`, used as is;
 * - `{"hostname": "random-words.trycloudflare.com"}`, which becomes
 *   `https://random-words.trycloudflare.com/api/json`. This is what the metrics server of
 *   cloudflared answers on `/quicktunnel` for a quick tunnel.
 *
 * Returns `undefined` when the document is well-formed but carries no address yet (the tunnel
 * is still connecting), and throws when it is not a document of that shape.
 */
export function parseFingerprintUrlDiscoveryAnswer(body: string): string | undefined {
    let data: any;
    try {
        data = JSON.parse(body);
    } catch (err: any) {
        throw new Error('The discovery answer is not a JSON document');
    }

    if (!data || typeof data !== 'object') {
        throw new Error('The discovery answer is not a JSON object');
    }

    if (typeof data.url === 'string') {
        const url = data.url.trim();

        return url.length > 0 ? url : void 0;
    }

    if (typeof data.hostname === 'string') {
        const hostname = data.hostname.trim();

        return hostname.length > 0 ? `https://${hostname}/api/json` : void 0;
    }

    throw new Error('The discovery answer has neither a "url" nor a "hostname" field');
}


function fetchDiscoveryAnswer(discoveryUrl: string): Promise<string> {
    return new Promise<string>((
        resolve, reject
    ) => {
        let url: URL;
        try {
            url = new URL(discoveryUrl);
        } catch (err: any) {
            reject(new Error(`Invalid discovery address: ${discoveryUrl}`));

            return;
        }

        const requestFn = url.protocol === 'https:' ? requestHttps : requestHttp;
        const req = requestFn(
            url,
            {
                method: 'GET',
                timeout: DISCOVERY_REQUEST_TIMEOUT,
                headers: {
                    Accept: 'application/json',
                },
            },
            (res: IncomingMessage) => {
                const chunks: Buffer[] = [];
                let length = 0;

                res.on(
                    'data',
                    (chunk: Buffer) => {
                        length += chunk.length;

                        if (length > DISCOVERY_ANSWER_MAX_LENGTH) {
                            res.destroy(new Error('The discovery answer is too large'));

                            return;
                        }

                        chunks.push(chunk);
                    }
                );

                res.on(
                    'error',
                    (err: any) => {
                        reject(err);
                    }
                );

                res.on(
                    'end',
                    () => {
                        const body = Buffer.concat(chunks)
                            .toString();

                        if (res.statusCode !== 200) {
                            reject(new Error(`Get ${res.statusCode} status code: ${body}`));

                            return;
                        }

                        resolve(body);
                    }
                );
            }
        );

        req.on(
            'timeout',
            () => {
                req.destroy(new Error('Request timeout'));
            }
        );

        req.on(
            'error',
            (err: any) => {
                reject(err);
            }
        );

        req.end();
    });
}


/**
 * Follows the public address of the fingerprint service when it is not known in advance.
 *
 * ProxyHerd behind NAT publishes its fingerprint service through a Cloudflare quick tunnel,
 * whose hostname changes on every restart of the tunnel. Instead of copying that hostname into
 * FINGERPRINT_URL by hand, ProxyHerd polls a discovery endpoint from its own network (never
 * through the proxies) and uses whatever address it answers with, switching as soon as the
 * answer changes. Between two successful polls the last known address stays in use.
 */
export class FingerprintUrlDiscovery {
    private readonly logger = new Logger(FingerprintUrlDiscovery.name);

    private current: string | undefined;

    private timer: NodeJS.Timeout | undefined = void 0;

    private running = false;

    private failures = 0;

    private readonly waiters: ((url: string) => void)[] = [];

    constructor(private readonly options: IFingerprintUrlDiscoveryOptions) {
        this.current = options.initialUrl && options.initialUrl.length > 0 ? options.initialUrl : void 0;
    }

    get discoveryUrl(): string {
        return this.options.discoveryUrl;
    }

    /** The address known so far, or `undefined` before the first successful answer. */
    get url(): string | undefined {
        return this.current;
    }

    start(): void {
        if (this.running) {
            return;
        }

        this.running = true;

        this.logger.log(`Discovering the fingerprint address from ${this.options.discoveryUrl}`);

        void this.poll();
    }

    stop(): void {
        this.running = false;

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = void 0;
        }
    }

    /**
     * Resolves with the address as soon as one is known, or rejects after `timeout`
     * milliseconds with a FingerprintUrlNotDiscoveredError.
     */
    waitForUrl(timeout: number): Promise<string> {
        if (this.current) {
            return Promise.resolve(this.current);
        }

        return new Promise<string>((
            resolve, reject
        ) => {
            let timer: NodeJS.Timeout | undefined = void 0;
            const waiter = (url: string) => {
                if (timer) {
                    clearTimeout(timer);
                }

                resolve(url);
            };

            timer = setTimeout(
                () => {
                    const index = this.waiters.indexOf(waiter);

                    if (index >= 0) {
                        this.waiters.splice(
                            index,
                            1
                        );
                    }

                    reject(new FingerprintUrlNotDiscoveredError(this.options.discoveryUrl));
                },
                timeout
            );

            this.waiters.push(waiter);
        });
    }

    /**
     * Polls the discovery endpoint once and returns the address it currently answers with
     * (`undefined` when it has none yet). Throws when the endpoint cannot be read; the last
     * known address is kept in that case.
     */
    async refresh(): Promise<string | undefined> {
        const body = await fetchDiscoveryAnswer(this.options.discoveryUrl);
        const url = parseFingerprintUrlDiscoveryAnswer(body);

        if (url && url !== this.current) {
            this.current = url;

            this.logger.log(`Fingerprint address: ${url}`);

            const waiters = this.waiters.splice(0);
            for (const waiter of waiters) {
                waiter(url);
            }
        }

        return url;
    }

    private async poll(): Promise<void> {
        try {
            await this.refresh();

            if (this.failures > 0) {
                this.logger.log(`The discovery endpoint ${this.options.discoveryUrl} answers again`);
                this.failures = 0;
            }
        } catch (err: any) {
            this.failures++;

            const message = `Cannot read the fingerprint address from ${this.options.discoveryUrl}: ${err.message}`;

            // Warn once per outage, not on every poll.
            if (this.failures === 1) {
                this.logger.warn(message);
            } else {
                this.logger.debug(message);
            }
        } finally {
            if (this.running) {
                this.timer = setTimeout(
                    () => {
                        void this.poll();
                    },
                    this.options.delay
                );
                this.timer.unref();
            }
        }
    }
}
