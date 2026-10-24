import {
    IncomingMessage,
    request,
} from 'http';
import {
    parseError,
    Sockets,
} from '@proxyherd/proxy-sdk';
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


export function fingerprint(
    transport: ATransportService,
    proxy: IProxyToRefresh,
    options: IFingerprintOptions,
    fpRequest: IFingerprintRequest,
    sockets: Sockets
): Promise<IFingerprint> {
    return fingerprintImpl(
        options.url,
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


const FINGERPRINT_URL_HELP = 'FINGERPRINT_URL is not set. ProxyHerd needs the address of your fingerprint service, '
    + 'for example https://fingerprint.example.com/api/json. '
    + 'See https://proxyherd.github.io/proxyherd/deployment/fingerprint';


/**
 * The fingerprint service URL, from the argument or FINGERPRINT_URL. There is no default:
 * the hosted service the original project depended on no longer exists.
 */
export function getEnvFingerprintUrl(url?: string): string {
    const resolved = url && url.length > 0 ? url : process.env.FINGERPRINT_URL;

    if (!resolved || resolved.length <= 0) {
        throw new Error(FINGERPRINT_URL_HELP);
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


export function getEnvFingerprintConfig(
    version: string,
    url?: string
): IFingerprintOptions {
    return {
        url: getEnvFingerprintUrl(url),
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
