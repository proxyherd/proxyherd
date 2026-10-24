import {
    Injectable,
    Type,
} from '@angular/core';
import { CONNECTOR_HYPEPROXY_TYPE } from '@proxyherd/common';
import {
    ConnectorprovidersService,
    EConnectorType,
} from '@proxyherd/frontend-sdk';
import { ConnectorHypeproxyComponent } from './connector/connector.component';
import { CredentialHypeproxyComponent } from './credential/credential.component';
import type {
    IConnectorComponent,
    IConnectorConfig,
    IConnectorFactory,
    ICredentialComponent,
    IInstallComponent,
} from '@proxyherd/frontend-sdk';


@Injectable()
export class ConnectorHypeproxyFactory implements IConnectorFactory {
    readonly type = CONNECTOR_HYPEPROXY_TYPE;

    readonly config: IConnectorConfig = {
        name: 'HypeProxy',
        description: 'Ultra-stable EU Mobile Proxies with Unlimited IP Rotations and 100% Clean IPs. Specially designed to meet your needs: data scraping, browser automation, account creation, growth hacking, SEO...',
        coupon: null,
        defaultCredentialName: 'HypeProxy Credential',
        defaultConnectorName: 'HypeProxy Connector',
        url: 'https://hypeproxy.io',
        type: EConnectorType.StaticIp,
        canInstall: false,
        canUninstall: false,
        useCertificate: false,
        canReplaceProxy: true,
    };

    constructor(connectorproviders: ConnectorprovidersService) {
        connectorproviders.register(this);
    }

    init() {
        // Nothing
    }

    getCredentialComponent(): Type<ICredentialComponent> {
        return CredentialHypeproxyComponent;
    }

    getConnectorComponent(): Type<IConnectorComponent> {
        return ConnectorHypeproxyComponent;
    }

    getInstallComponent(): Type<IInstallComponent> {
        throw new Error('Not implemented');
    }
}
