import {
    Injectable,
    Type,
} from '@angular/core';
import { CONNECTOR_GEONODE_TYPE } from '@proxyherd/common';
import {
    ConnectorprovidersService,
    EConnectorType,
} from '@proxyherd/frontend-sdk';
import { ConnectorGeonodeComponent } from './connector/connector.component';
import { CredentialGeonodeComponent } from './credential/credential.component';
import type {
    IConnectorComponent,
    IConnectorConfig,
    IConnectorFactory,
    ICredentialComponent,
    IInstallComponent,
} from '@proxyherd/frontend-sdk';


@Injectable()
export class ConnectorGeonodeFactory implements IConnectorFactory {
    readonly type = CONNECTOR_GEONODE_TYPE;

   readonly config: IConnectorConfig = {
       name: 'Geonode',
       description: 'The Right Proxies for Your Business from Geonode. Join thousands of developers using the fastest-growing residential proxy network. Geonode\’s proxies speak for themselves.',
       coupon: null,
       defaultCredentialName: 'Geonode Credential',
       defaultConnectorName: 'Geonode Connector',
       url: 'https://geonode.com',
       type: EConnectorType.StaticIp,
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
       return CredentialGeonodeComponent;
   }

   getConnectorComponent(): Type<IConnectorComponent> {
       return ConnectorGeonodeComponent;
   }

   getInstallComponent(): Type<IInstallComponent> {
       throw new Error('Not implemented');
   }
}
