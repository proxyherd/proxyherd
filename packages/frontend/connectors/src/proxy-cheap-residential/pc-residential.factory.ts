import {
    Injectable,
    Type,
} from '@angular/core';
import { CONNECTOR_PROXY_CHEAP_RESIDENTIAL_TYPE } from '@proxyherd/common';
import {
    ConnectorprovidersService,
    EConnectorType,
} from '@proxyherd/frontend-sdk';
import { ConnectorProxyCheapResidentialComponent } from './connector/connector.component';
import { CredentialProxyCheapResidentialComponent } from './credential/credential.component';
import type {
    IConnectorComponent,
    IConnectorConfig,
    IConnectorFactory,
    ICredentialComponent,
    IInstallComponent,
} from '@proxyherd/frontend-sdk';


@Injectable()
export class ConnectorProxyCheapResidentialFactory implements IConnectorFactory {
    readonly type = CONNECTOR_PROXY_CHEAP_RESIDENTIAL_TYPE;

   readonly config: IConnectorConfig = {
       name: 'Proxy-Cheap Residential',
       description: 'Proxy-Cheap offers enterprise-level proxies for novices and professionals. They provide affordable solutions for customers to obtain data and circumvent restrictions while operating at scale.',
       coupon: null,
       defaultCredentialName: 'Proxy-Cheap Residential Credential',
       defaultConnectorName: 'Proxy-Cheap Residential Connector',
       url: 'https://app.proxy-cheap.com/r/lt6xyT',
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
       return CredentialProxyCheapResidentialComponent;
   }

   getConnectorComponent(): Type<IConnectorComponent> {
       return ConnectorProxyCheapResidentialComponent;
   }

   getInstallComponent(): Type<IInstallComponent> {
       throw new Error('Not implemented');
   }
}
