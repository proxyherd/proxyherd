import { request as requestHttp } from 'http';
import { request as requestHttps } from 'https';
import axios from 'axios';
import type {
    AxiosAdapter,
    InternalAxiosRequestConfig,
} from 'axios';
import type {
    IncomingMessage,
    RequestOptions,
} from 'http';


// The end-to-end suite waits for background work (connector refresh, fingerprints,
// metrics) with fixed delays. On the small CI runners a wait occasionally runs out,
// so a failed test is retried there; locally a failure fails at once.
if (process.env.CI) {
    jest.retryTimes(
        2,
        {
            logErrorsBeforeRetry: true,
        }
    );
}

// Since 1.16.1, axios tunnels an HTTPS request through a proxy with CONNECT. Before,
// it sent the request to the proxy in absolute form (GET https://host/path) over the
// proxy's own protocol, and the "HTTPS over HTTP" tests rely on that request to
// exercise the master. Keep sending it that way; every other request goes to the
// standard adapter unchanged.
const httpAdapter = axios.getAdapter('http');
const httpsOverHttpAdapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
    const proxy = config.proxy;

    if (!proxy || !axios.getUri(config)
        .startsWith('https:')) {
        return httpAdapter(config);
    }

    return httpAdapter({
        ...config,
        proxy: false,
        transport: {
            request: (
                options: RequestOptions, callback: (res: IncomingMessage) => void
            ) => {
                const target = options.port ? `${options.hostname}:${options.port}` : options.hostname as string;
                const proxyOptions: RequestOptions = {
                    ...options,
                    host: proxy.host,
                    hostname: proxy.host,
                    port: proxy.port,
                    path: `https://${target}${options.path}`,
                    headers: {
                        ...options.headers,
                        host: target,
                    },
                };

                if (proxy.protocol?.startsWith('https')) {
                    return requestHttps(
                        {
                            ...proxyOptions,
                            protocol: 'https:',
                            agent: config.httpsAgent,
                        },
                        callback
                    );
                }

                return requestHttp(
                    {
                        ...proxyOptions,
                        protocol: 'http:',
                        agent: config.httpAgent,
                    },
                    callback
                );
            },
        },
    });
};

axios.defaults.adapter = httpsOverHttpAdapter;
