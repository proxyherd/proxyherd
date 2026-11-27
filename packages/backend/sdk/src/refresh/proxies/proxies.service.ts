import {
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common';
import { EFingerprintMode } from '@proxyherd/common';
import { Sockets } from '@proxyherd/proxy-sdk';
import { REFRESH_PROXIES_CONFIG } from './proxies.constants';
import { CommanderRefreshClientService } from '../../commander-client';
import { NoProxyToRefreshError } from '../../errors';
import {
    countFingerprintChecks,
    fingerprint,
    getFingerprintCheckAllowance,
    getFingerprintServiceWatch,
} from '../../fingerprint';
import { TransportprovidersService } from '../../transports';
import { ARefresh } from '../refresh.abstract';
import type { IRefreshProxiesModuleConfig } from './proxies.module';
import type { OnModuleDestroy } from '@nestjs/common';
import type {
    IFingerprintRequest,
    IProxiesToRefresh,
    IProxyRefreshed,
} from '@proxyherd/common';


@Injectable()
export class RefreshProxiesService extends ARefresh<IProxiesToRefresh> implements OnModuleDestroy {
    protected readonly logger = new Logger(RefreshProxiesService.name);

    private readonly sockets: Sockets | undefined;

    constructor(
        @Inject(REFRESH_PROXIES_CONFIG)
        private readonly config: IRefreshProxiesModuleConfig,
        private readonly commander: CommanderRefreshClientService,
        private readonly transportproviders: TransportprovidersService
    ) {
        super(config);

        this.sockets = config.trackSockets ? new Sockets() : void 0;
    }

    get socketsSize(): number {
        if (!this.sockets) {
            throw new Error('Sockets are not tracked');
        }

        return this.sockets.size;
    }

    async next(): Promise<IProxiesToRefresh | undefined> {
        // With a budget of checks (the shared service), take what it covers now and leave the rest due
        const url = this.config.fingerprint.url;
        const allowance = getFingerprintCheckAllowance(url);

        if (allowance !== undefined && allowance <= 0) {
            return;
        }

        try {
            const proxies = await this.commander.getNextProxiesToRefresh(allowance);

            countFingerprintChecks(
                url,
                proxies.proxies.length
            );

            return proxies;
        } catch (err: any) {
            if (err instanceof NoProxyToRefreshError) {
                return;
            }

            throw err;
        }
    }

    async task(proxiesToRefresh: IProxiesToRefresh): Promise<void> {
        this.logger.debug(`fingerprint ${proxiesToRefresh.proxies.length} instances`);

        const url = this.config.fingerprint.url;
        const watch = getFingerprintServiceWatch(this.config.fingerprint.useragent);
        watch.touch(url);

        // Parallel version
        const sockets = new Sockets(this.sockets);
        let proxiesRefreshed: IProxyRefreshed[];
        try {
            proxiesRefreshed = await Promise.all(proxiesToRefresh.proxies.map((proxy) => {
                const transport = this.transportproviders.getTransportByType(proxy.transportType);
                const fpRequest: IFingerprintRequest = {
                    installId: proxiesToRefresh.installId,
                    mode: EFingerprintMode.CONNECTOR,
                    connectorType: proxy.type,
                    proxyId: proxy.id,
                };

                return fingerprint(
                    transport,
                    proxy,
                    this.config.fingerprint,
                    fpRequest,
                    sockets
                )
                    .then((fp) => {
                        const refreshed: IProxyRefreshed = {
                            id: proxy.id,
                            fingerprint: fp,
                            fingerprintError: null,
                        };

                        return refreshed;
                    })
                    .catch((err: any) => {
                        const refreshed: IProxyRefreshed = {
                            id: proxy.id,
                            fingerprint: null,
                            fingerprintError: err.message,
                        };

                        return refreshed;
                    });
            }));
        } finally {
            sockets.closeAll();
        }

        // A failed check counts against the proxy only while the fingerprint service itself answers
        if (proxiesRefreshed.some((proxy) => !proxy.fingerprint) && await watch.isDown(url)) {
            proxiesRefreshed = proxiesRefreshed.filter((proxy) => proxy.fingerprint);
        }

        if (proxiesRefreshed.length > 0) {
            await this.commander.refreshProxies(proxiesRefreshed);
        }
    }

    onModuleDestroy() {
        if (this.sockets) {
            this.sockets.closeAll();
        }
    }
}
