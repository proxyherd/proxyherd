import {
    Injectable,
    Type,
} from '@angular/core';
import { CONNECTOR_SMARTPROXY_TYPE } from '@proxyherd/common';
import {
    ConnectorprovidersService,
    EConnectorType,
} from '@proxyherd/frontend-sdk';
import { ConnectorSmartproxyComponent } from './connector/connector.component';
import { CredentialSmartproxyComponent } from './credential/credential.component';
import type {
    IConnectorComponent,
    IConnectorConfig,
    IConnectorFactory,
    ICredentialComponent,
    IInstallComponent,
} from '@proxyherd/frontend-sdk';


@Injectable()
export class ConnectorSmartproxyFactory implements IConnectorFactory {
    readonly type = CONNECTOR_SMARTPROXY_TYPE;

   readonly config: IConnectorConfig = {
       name: 'Smartproxy',
       description: 'Access 65M+ global IPs via Smartproxy – award-winning proxy service provider with efficient data extraction and multi-accounting infrastructure. Proven by Proxyway.',
       coupon: null,
       defaultCredentialName: 'Smartproxy Credential',
       defaultConnectorName: 'Smartproxy Connector',
       url: 'https://smartproxy.com',
       type: EConnectorType.DynamicIP,
       canInstall: false,
       canUninstall: false,
       useCertificate: false,
       canReplaceProxy: false,
   };

   constructor(connectorproviders: ConnectorprovidersService) {
       connectorproviders.register(this);
   }

   init() {
       // Nothing
   }

   getCredentialComponent(): Type<ICredentialComponent> {
       return CredentialSmartproxyComponent;
   }

   getConnectorComponent(): Type<IConnectorComponent> {
       return ConnectorSmartproxyComponent;
   }

   getInstallComponent(): Type<IInstallComponent> {
       throw new Error('Not implemented');
   }
}
