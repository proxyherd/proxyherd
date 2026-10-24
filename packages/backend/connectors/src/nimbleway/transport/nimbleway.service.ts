import { Injectable } from '@nestjs/common';
import {
    ATransportResidentialService,

    TransportprovidersService,
} from '@proxyherd/backend-sdk';
import { TRANSPORT_NIMBLEWAY_TYPE } from './nimbleway.constants';
import { formatUsername } from '../nimbleway.helpers';
import type {
    IConnectorNimblewayConfig,
    IConnectorNimblewayCredential,
} from '../nimbleway.interface';
import type { IProxyToConnectConfigResidential } from '@proxyherd/backend-sdk';
import type {
    IConnectorProxyRefreshed,
    IConnectorToRefresh,
} from '@proxyherd/common';


@Injectable()
export class TransportNimblewayService extends ATransportResidentialService {
    readonly type = TRANSPORT_NIMBLEWAY_TYPE;

    constructor(transportproviders: TransportprovidersService) {
        super();

        transportproviders.register(this);
    }

    completeProxyConfig(
        proxy: IConnectorProxyRefreshed, connector: IConnectorToRefresh
    ) {
        const
            connectorConfig = connector.connectorConfig as IConnectorNimblewayConfig,
            credentialConfig = connector.credentialConfig as IConnectorNimblewayCredential,
            proxyConfig = proxy.config as IProxyToConnectConfigResidential;

        proxyConfig.address = {
            hostname: 'ip.nimbleway.com',
            port: 7000,
        };
        proxyConfig.username = formatUsername(
            credentialConfig.username,
            {
                ...connectorConfig,
                session: proxy.key,
            }
        );
        proxyConfig.password = credentialConfig.password;
    }
}
