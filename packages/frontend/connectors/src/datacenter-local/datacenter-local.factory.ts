import {
    Injectable,
    Type,
} from '@angular/core';
import { CONNECTOR_DATACENTER_LOCAL_TYPE } from '@proxyherd/common';
import {
    ConnectorprovidersService,
    EConnectorType,
} from '@proxyherd/frontend-sdk';
import { ConnectorDatacenterLocalComponent } from './connector/connector.component';
import { CredentialDatacenterLocalComponent } from './credential/credential.component';
import { InstallDatacenterLocalComponent } from './install/install.component';
import type {
    IConnectorComponent,
    IConnectorConfig,
    IConnectorFactory,
    ICredentialComponent,
    IInstallComponent,
} from '@proxyherd/frontend-sdk';


@Injectable()
export class ConnectorDatacenterLocalFactory implements IConnectorFactory {
    readonly type = CONNECTOR_DATACENTER_LOCAL_TYPE;

    readonly config: IConnectorConfig = {
        name: 'Local datacenter',
        description: 'Local datacenter is test datacenter for Scrapoxy internal use.',
        coupon: null,
        defaultCredentialName: 'Local Datacenter Credential',
        defaultConnectorName: 'Local Datacenter Connector',
        url: 'https://github.com/proxyherd/proxyherd',
        type: EConnectorType.Datacenter,
        canInstall: true,
        canUninstall: true,
        canReplaceProxy: false,
        useCertificate: true,
    };

    constructor(connectorproviders: ConnectorprovidersService) {
        connectorproviders.register(this);
    }

    init() {
        // Nothing
    }

    getCredentialComponent(): Type<ICredentialComponent> {
        return CredentialDatacenterLocalComponent;
    }

    getConnectorComponent(): Type<IConnectorComponent> {
        return ConnectorDatacenterLocalComponent;
    }

    getInstallComponent(): Type<IInstallComponent> {
        return InstallDatacenterLocalComponent;
    }
}
