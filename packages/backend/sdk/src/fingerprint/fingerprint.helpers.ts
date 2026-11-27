import {
    IncomingMessage,
    request,
} from 'http';
import { Logger } from '@nestjs/common';
import {
    parseError,
    Sockets,
} from '@proxyherd/proxy-sdk';
import {
    FINGERPRINT_SHARED_CHECKS_BURST,
    FINGERPRINT_SHARED_CHECKS_PER_MINUTE,
    FingerprintBudget,
} from './fingerprint.budget';
import {
    FINGERPRINT_URL_DISCOVERY_DELAY_DEFAULT,
    FINGERPRINT_URL_DISCOVERY_WAIT,
    FingerprintUrlDiscovery,
    FingerprintUrlNotDiscoveredError,
} from './fingerprint.discovery';
import { FingerprintServiceWatch } from './fingerprint.watch';
import {
    ArrayHttpHeaders,
    formatUseragent,
    urlToUrlOptions,
} from '../helpers';
import type { ATransportService } from '../transports';
import type {
    IFingerprint,
    IFingerprintOptions,
    IFingerprintRequest,
    IProxyToRefresh,
} from '@proxyherd/common';
import type { ClientRequestArgs } from 'http';


class RedirectError extends Error {
    constructor(public readonly location: string) {
        super();
    }
}


const HTTP_STATUS_TOO_MANY_REQUESTS = 429;


/**
 * The service answered, with something else than 200. The message is the reason shown on the proxy.
 */
class FingerprintStatusError extends Error {
    constructor(
        public readonly statusCode: number | undefined,
        body: string
    ) {
        super(`Get ${statusCode} status code: ${body}`);
    }
}


/**
 * A rate limited check is not tried again at once: every new request counts against the same
 * limit, so it would be refused too and keep the address over the limit for longer.
 * The next refresh, PROXY_REFRESH_DELAY later, is the retry.
 */
function isRetryable(err: any): boolean {
    return !(err instanceof FingerprintStatusError && err.statusCode === HTTP_STATUS_TOO_MANY_REQUESTS);
}


function fingerprintRequest(args: ClientRequestArgs) {
    return new Promise<IFingerprint>((
        resolve, reject
    ) => {
        let timeout: NodeJS.Timeout | undefined = void 0;
        const req = request(
            args,
            (response: IncomingMessage) => {
                if (response.statusCode &&
                    response.statusCode > 300 &&
                    response.statusCode < 400) {
                    const locationHeader = response.headers.location;

                    if (locationHeader && locationHeader.length > 0) {
                        reject(new RedirectError(locationHeader));

                        return;
                    }
                }

                const buffers: Buffer[] = [];
                response.on(
                    'error',
                    (err: any) => {
                        err = parseError(err);

                        if (timeout) {
                            clearTimeout(timeout);
                        }

                        reject(err);
                    }
                );

                response.on(
                    'end',
                    () => {
                        if (timeout) {
                            clearTimeout(timeout);
                            timeout = void 0;
                        }

                        const rawData = Buffer.concat(buffers)
                            .toString();

                        if (response.statusCode === 200) {
                            try {
                                const data = JSON.parse(rawData) as IFingerprint;

                                resolve(data);
                            } catch (err: any) {
                                reject(err);
                            }
                        } else {
                            reject(new FingerprintStatusError(
                                response.statusCode,
                                rawData
                            ));
                        }
                    }
                );

                response.on(
                    'data',
                    (buffer: Buffer) => {
                        buffers.push(buffer);
                    }
                );
            }
        );

        req.on(
            'error',
            (err: any) => {
                err = parseError(err);

                if (timeout) {
                    clearTimeout(timeout);
                    timeout = void 0;
                }

                reject(err);
            }
        );

        if (args.timeout && args.timeout > 0) {
            timeout = setTimeout(
                () => {
                    timeout = void 0;
                    req.emit(
                        'error',
                        new Error('Request timeout')
                    );
                },
                args.timeout as number
            );
        }

        req.end();
    });
}


function fingerprintImpl(
    url: string,
    transport: ATransportService,
    proxy: IProxyToRefresh,
    fpRequest: IFingerprintRequest,
    sockets: Sockets,
    useragent: string,
    followRedirectCount: number,
    retry: number,
    sendStats: boolean
): Promise<IFingerprint> {
    const urlOpts = urlToUrlOptions(url);

    if (!urlOpts) {
        throw new Error('Invalid url');
    }

    // Protocol version 3 carries no telemetry. The former fields are only sent when the
    // operator opts in (FINGERPRINT_SEND_STATS=true), for the logs of their own service.
    urlOpts.pathname += '?version=3';

    if (sendStats) {
        urlOpts.pathname += '&installId=' + fpRequest.installId
            + '&mode=' + fpRequest.mode
            + '&connectorType=' + fpRequest.connectorType
            + '&proxyId=' + encodeURIComponent(fpRequest.proxyId)
            + '&requests=' + proxy.requests
            + '&requestsValid=' + proxy.requestsValid
            + '&requestsInvalid=' + proxy.requestsInvalid
            + '&bytesReceived=' + proxy.bytesReceived
            + '&bytesSent=' + proxy.bytesSent;
    }

    const reqArgs = transport.buildFingerprintRequestArgs(
        'GET',
        urlOpts,
        new ArrayHttpHeaders()
            .addHeader(
                'Host',
                urlOpts.hostname as string
            )
            .addHeader(
                'User-Agent',
                useragent
            ),
        {
            Host: `${urlOpts.hostname}:${urlOpts.port}`,
        },
        proxy,
        sockets
    );

    return fingerprintRequest(reqArgs)
        .catch((err: any) => {
            if (err instanceof RedirectError) {
                const location = (err as RedirectError).location;

                if (location === url) {
                    throw new Error('Cannot redirect to same location');
                }

                if (followRedirectCount <= 0) {
                    throw new Error('Too many redirects');
                }

                return fingerprintImpl(
                    location,
                    transport,
                    proxy,
                    fpRequest,
                    sockets,
                    useragent,
                    followRedirectCount - 1,
                    retry,
                    sendStats
                );
            }

            if (retry > 0 && isRetryable(err)) {
                return fingerprintImpl(
                    url,
                    transport,
                    proxy,
                    fpRequest,
                    sockets,
                    useragent,
                    followRedirectCount,
                    retry - 1,
                    sendStats
                );
            }

            throw err;
        });
}


/**
 * The shared fingerprint service run by the ProxyHerd project, used when neither FINGERPRINT_URL
 * nor FINGERPRINT_URL_DISCOVERY is set. Best effort and rate limited per IP address: production
 * installations should run their own.
 */
export const FINGERPRINT_SHARED_HOSTNAME = 'fingerprint.proxyherd.com';

export const FINGERPRINT_URL_DEFAULT = `https://${FINGERPRINT_SHARED_HOSTNAME}/api/json`;

const FINGERPRINT_DOCS_URL = 'https://proxyherd.github.io/proxyherd/deployment/fingerprint';
const FINGERPRINT_URL_DEFAULT_NOTICE = `Using the shared fingerprint service ${FINGERPRINT_URL_DEFAULT} `
    + `(best effort: up to ${FINGERPRINT_SHARED_CHECKS_PER_MINUTE} checks a minute for this installation, `
    + 'so a large pool is checked less often). '
    + `Set FINGERPRINT_URL to use your own: ${FINGERPRINT_DOCS_URL}`;
const FINGERPRINT_BUDGET_NOTICE = `The shared fingerprint service checks up to ${FINGERPRINT_SHARED_CHECKS_PER_MINUTE} `
    + 'proxies a minute for one installation, and this one has more to check: each proxy is now checked less '
    + 'often than PROXY_REFRESH_DELAY asks, and a dead proxy is noticed later. '
    + `Run your own service to check them all on time: ${FINGERPRINT_DOCS_URL}`;
const logger = new Logger('Fingerprint');
let discovery: FingerprintUrlDiscovery | undefined = void 0;
let defaultNoticeLogged = false;
let sharedBudget: FingerprintBudget | undefined = void 0;
let sharedBudgetNoticeLogged = false;
let serviceWatch: FingerprintServiceWatch | undefined = void 0;


/**
 * True for the shared fingerprint service of the project, over HTTP or HTTPS, however the
 * address was given (the default, FINGERPRINT_URL or a discovered one).
 */
export function isSharedFingerprintUrl(url: string): boolean {
    try {
        return new URL(url).hostname.toLowerCase() === FINGERPRINT_SHARED_HOSTNAME;
    } catch (err: any) {
        return false;
    }
}


/**
 * How many checks may start now against this address. `undefined` means no budget applies,
 * which is the case of every service but the shared one. One budget per process: the loops
 * that check proxies and pool entries draw from the same one.
 */
export function getFingerprintCheckAllowance(url: string): number | undefined {
    if (!isSharedFingerprintUrl(url)) {
        return void 0;
    }

    if (!sharedBudget) {
        sharedBudget = new FingerprintBudget(
            FINGERPRINT_SHARED_CHECKS_PER_MINUTE,
            FINGERPRINT_SHARED_CHECKS_BURST
        );
    }

    const allowance = sharedBudget.available();

    // The reserve is used up: there is more to check than the budget covers. Say it once.
    if (allowance <= 0 && !sharedBudgetNoticeLogged) {
        sharedBudgetNoticeLogged = true;
        logger.warn(FINGERPRINT_BUDGET_NOTICE);
    }

    return allowance;
}


/**
 * Counts the checks that were started against this address (see getFingerprintCheckAllowance).
 */
export function countFingerprintChecks(
    url: string, count: number
) {
    if (sharedBudget && isSharedFingerprintUrl(url)) {
        sharedBudget.consume(count);
    }
}


/**
 * The watch that tells a fingerprint service that is down from proxies that are down.
 * One per process: every loop shares what is known about the service.
 */
export function getFingerprintServiceWatch(useragent: string): FingerprintServiceWatch {
    if (!serviceWatch) {
        serviceWatch = new FingerprintServiceWatch(useragent);
    }

    return serviceWatch;
}


/**
 * Forgets the budget and the watch of this process, or replaces them. For the tests.
 */
export function resetFingerprintState(
    budget?: FingerprintBudget, watch?: FingerprintServiceWatch
) {
    sharedBudget = budget;
    sharedBudgetNoticeLogged = false;
    serviceWatch = watch;
}


/**
 * The run-time discovery of the fingerprint address, started on first use when
 * FINGERPRINT_URL_DISCOVERY is set. One per process: every module shares the same answer.
 */
export function getFingerprintUrlDiscovery(): FingerprintUrlDiscovery | undefined {
    const discoveryUrl = process.env.FINGERPRINT_URL_DISCOVERY;

    if (!discoveryUrl || discoveryUrl.length <= 0) {
        if (discovery) {
            discovery.stop();
            discovery = void 0;
        }

        return void 0;
    }

    if (!discovery || discovery.discoveryUrl !== discoveryUrl) {
        if (discovery) {
            discovery.stop();
        }

        discovery = new FingerprintUrlDiscovery({
            discoveryUrl,
            delay: parseInt(
                process.env.FINGERPRINT_URL_DISCOVERY_DELAY ?? FINGERPRINT_URL_DISCOVERY_DELAY_DEFAULT.toString(),
                10
            ),
            initialUrl: process.env.FINGERPRINT_URL,
        });
        discovery.start();
    }

    return discovery;
}


/**
 * The address to check against. An empty `url` means the address is discovered at run time
 * and not known yet: wait a little for the first answer instead of failing the proxy at once.
 */
async function resolveFingerprintUrl(options: IFingerprintOptions): Promise<string> {
    if (options.url && options.url.length > 0) {
        return options.url;
    }

    const currentDiscovery = getFingerprintUrlDiscovery();

    if (currentDiscovery) {
        return currentDiscovery.waitForUrl(FINGERPRINT_URL_DISCOVERY_WAIT);
    }

    return FINGERPRINT_URL_DEFAULT;
}


export async function fingerprint(
    transport: ATransportService,
    proxy: IProxyToRefresh,
    options: IFingerprintOptions,
    fpRequest: IFingerprintRequest,
    sockets: Sockets
): Promise<IFingerprint> {
    const url = await resolveFingerprintUrl(options);

    return fingerprintImpl(
        url,
        transport,
        proxy,
        fpRequest,
        sockets,
        options.useragent,
        options.followRedirectMax,
        options.retryMax,
        options.sendStats ?? false
    );
}


/**
 * The fingerprint service URL: the argument when given, else the address discovered from
 * FINGERPRINT_URL_DISCOVERY, else FINGERPRINT_URL, else the shared service (FINGERPRINT_URL_DEFAULT).
 *
 * Returns `undefined` while a discovered address is not known yet (unless FINGERPRINT_URL
 * provides a starting point).
 */
function getEnvFingerprintUrlIfKnown(url?: string): string | undefined {
    if (url && url.length > 0) {
        return url;
    }

    const currentDiscovery = getFingerprintUrlDiscovery();

    if (currentDiscovery) {
        return currentDiscovery.url;
    }

    const resolved = process.env.FINGERPRINT_URL;

    if (!resolved || resolved.length <= 0) {
        return FINGERPRINT_URL_DEFAULT;
    }

    return resolved;
}


/**
 * Same as above, for callers that need the address now: throws a FingerprintUrlNotDiscoveredError
 * while a discovered address is not known yet.
 */
export function getEnvFingerprintUrl(url?: string): string {
    const resolved = getEnvFingerprintUrlIfKnown(url);

    if (!resolved) {
        throw new FingerprintUrlNotDiscoveredError(process.env.FINGERPRINT_URL_DISCOVERY as string);
    }

    return resolved;
}


/**
 * The plain-text variant of the fingerprint endpoint (".../api/text"), derived from the JSON one.
 */
export function getEnvFingerprintTextUrl(url?: string): string {
    const json = getEnvFingerprintUrl(url);

    if (json.endsWith('/api/json')) {
        return `${json.substring(
            0,
            json.length - '/api/json'.length
        )}/api/text`;
    }

    return json.endsWith('/') ? `${json}api/text` : `${json}/api/text`;
}


/**
 * Fingerprint options from the environment. Says once at start when the shared service is used.
 * The `url` is read on every access, so a discovered address that changes (a restarted tunnel)
 * is picked up by the next check without a restart of ProxyHerd. It is an empty string while
 * a discovered address is not known yet: NestJS serialises module options at start, so the
 * getter never throws, and `fingerprint()` waits for the address instead.
 */
export function getEnvFingerprintConfig(
    version: string,
    url?: string
): IFingerprintOptions {
    if (!defaultNoticeLogged && getEnvFingerprintUrlIfKnown(url) === FINGERPRINT_URL_DEFAULT) {
        defaultNoticeLogged = true;
        logger.log(FINGERPRINT_URL_DEFAULT_NOTICE);
    }

    return {
        get url(): string {
            return getEnvFingerprintUrlIfKnown(url) ?? '';
        },
        useragent: formatUseragent(version),
        followRedirectMax: parseInt(
            process.env.FINGERPRINT_FOLLOW_REDIRECT_MAX ?? '3',
            10
        ),
        retryMax: parseInt(
            process.env.FINGERPRINT_RETRY_MAX ?? '2',
            10
        ),
        sendStats: (process.env.FINGERPRINT_SEND_STATS ?? 'false').toLowerCase() === 'true',
    };
}
