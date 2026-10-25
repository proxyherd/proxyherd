import {
    IncomingMessage,
    request,
} from 'http';
import {
    parseError,
    Sockets,
} from '@proxyherd/proxy-sdk';
import {
    FINGERPRINT_URL_DISCOVERY_DELAY_DEFAULT,
    FINGERPRINT_URL_DISCOVERY_WAIT,
    FingerprintUrlDiscovery,
    FingerprintUrlNotDiscoveredError,
} from './fingerprint.discovery';
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
                            reject(new Error(`Get ${response.statusCode} status code: ${rawData}`));
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

            if (retry > 0) {
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


const FINGERPRINT_URL_HELP = 'FINGERPRINT_URL is not set. ProxyHerd needs the address of your fingerprint service, '
    + 'for example https://fingerprint.example.com/api/json, '
    + 'or FINGERPRINT_URL_DISCOVERY when a tunnel assigns that address at start. '
    + 'See https://proxyherd.github.io/proxyherd/deployment/fingerprint';
let discovery: FingerprintUrlDiscovery | undefined = void 0;


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

    throw new Error(FINGERPRINT_URL_HELP);
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
 * FINGERPRINT_URL_DISCOVERY, else FINGERPRINT_URL. There is no default: the hosted service
 * the original project depended on no longer exists.
 *
 * Returns `undefined` while a discovered address is not known yet (unless FINGERPRINT_URL
 * provides a starting point); throws when nothing is configured at all.
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
        throw new Error(FINGERPRINT_URL_HELP);
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
 * Fingerprint options from the environment. Fails at start when no address is configured.
 * The `url` is read on every access, so a discovered address that changes (a restarted tunnel)
 * is picked up by the next check without a restart of ProxyHerd. It is an empty string while
 * a discovered address is not known yet: NestJS serialises module options at start, so the
 * getter never throws, and `fingerprint()` waits for the address instead.
 */
export function getEnvFingerprintConfig(
    version: string,
    url?: string
): IFingerprintOptions {
    // Validates the configuration now: throws when nothing is configured.
    getEnvFingerprintUrlIfKnown(url);

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
