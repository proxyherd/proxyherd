import { request as requestHttp } from 'http';
import { request as requestHttps } from 'https';
import { Logger } from '@nestjs/common';


export interface IFingerprintServiceWatchConfig {
    // How long a direct request may take
    timeout: number;
    // How long an answer of the service is taken for granted
    okTtl: number;
    // How long a failure is taken for granted before asking again
    failTtl: number;
}


export const FINGERPRINT_SERVICE_WATCH_CONFIG_DEFAULT: IFingerprintServiceWatchConfig = {
    timeout: 5000,
    okTtl: 60000,
    failTtl: 10000,
};


const HTTP_STATUS_OK = 200;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;


/**
 * Asks the fingerprint service directly, without any proxy. The service is there when it
 * answers 200, or 429: a service that limits this machine is still running.
 */
function askDirectly(
    url: string, useragent: string, timeout: number
): Promise<void> {
    return new Promise<void>((
        resolve, reject
    ) => {
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch (err: any) {
            reject(new Error(`Invalid address ${url}`));

            return;
        }

        const request = parsed.protocol === 'https:' ? requestHttps : requestHttp;
        const req = request(
            parsed,
            {
                method: 'GET',
                headers: {
                    'User-Agent': useragent,
                },
                timeout,
            },
            (res) => {
                // Only the status matters
                res.resume();

                if (res.statusCode === HTTP_STATUS_OK || res.statusCode === HTTP_STATUS_TOO_MANY_REQUESTS) {
                    resolve();
                } else {
                    reject(new Error(`status ${res.statusCode}`));
                }
            }
        );

        req.on(
            'timeout',
            () => {
                req.destroy(new Error('no answer in time'));
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
 * Tells a fingerprint service that is down from a proxy that is down.
 *
 * A check that fails says one of two things: the proxy does not relay traffic, or the service
 * did not answer. From the proxy's side they look the same, and taking the second for the first
 * marks every proxy offline at once, after which their connectors remove them. So the refresh
 * loops also ask the service directly, from this machine: when it answered here before and does
 * not now, the failed checks of that moment say nothing about the proxies and are set aside.
 *
 * "Answered here before" matters. On a machine that can never reach the service directly (it is
 * only open to the proxies, or outgoing traffic is filtered), nothing is known and every failed
 * check counts, as it always did.
 */
export class FingerprintServiceWatch {
    private readonly logger = new Logger('Fingerprint');

    private url: string | undefined = void 0;

    private everAvailable = false;

    private available = false;

    private askedTs = 0;

    private pending: Promise<void> | undefined = void 0;

    constructor(
        private readonly useragent: string,
        private readonly config: IFingerprintServiceWatchConfig = FINGERPRINT_SERVICE_WATCH_CONFIG_DEFAULT,
        private readonly now: () => number = Date.now
    ) {}

    /**
     * Keeps what is known up to date while checks are running. Does not wait for the answer.
     */
    touch(url: string) {
        if (url.length <= 0) {
            return;
        }

        this.follow(url);

        // During an outage, ask often to see the end of it; otherwise once in a while is enough
        const maxAge = this.everAvailable && !this.available ? this.config.failTtl : this.config.okTtl;

        if (this.pending !== undefined || this.now() - this.askedTs < maxAge) {
            return;
        }

        this.ask(url)
            .catch(() => void 0);
    }

    /**
     * True when the service answered this machine before and does not answer it now.
     * Asks again unless it just did.
     */
    async isDown(url: string): Promise<boolean> {
        if (url.length <= 0) {
            return false;
        }

        this.follow(url);

        // A failed check wants a fresh answer. Where the service never answered, nothing can be
        // concluded anyway: do not hold every batch back for a request that times out.
        const maxAge = this.everAvailable ? this.config.failTtl : this.config.okTtl;

        if (this.pending) {
            await this.pending;
        } else if (this.now() - this.askedTs >= maxAge) {
            await this.ask(url);
        }

        return this.everAvailable && !this.available;
    }

    private follow(url: string) {
        if (this.url === url) {
            return;
        }

        // Another address (a discovered one that changed): nothing is known about it yet
        this.url = url;
        this.everAvailable = false;
        this.available = false;
        this.askedTs = 0;
        this.pending = void 0;
    }

    private ask(url: string): Promise<void> {
        const pending = askDirectly(
            url,
            this.useragent,
            this.config.timeout
        )
            .then(
                () => {
                    this.settle(
                        url,
                        pending,
                        true,
                        ''
                    );
                },
                (err: any) => {
                    this.settle(
                        url,
                        pending,
                        false,
                        err?.message ?? String(err)
                    );
                }
            );

        this.pending = pending;

        return pending;
    }

    private settle(
        url: string, pending: Promise<void>, available: boolean, reason: string
    ) {
        // The answer to a question about a former address is of no use
        if (this.pending !== pending) {
            return;
        }

        this.pending = void 0;
        this.askedTs = this.now();

        const wasDown = this.everAvailable && !this.available;

        this.available = available;

        if (available) {
            if (wasDown) {
                this.logger.log(`The fingerprint service ${url} answers again: checks count as before`);
            }

            this.everAvailable = true;
        } else if (this.everAvailable && !wasDown) {
            this.logger.warn(`The fingerprint service ${url} does not answer this machine either (${reason}): `
                + 'failed checks are set aside and proxies keep their last state until it is back');
        }
    }
}
