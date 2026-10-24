import { EZyteCredentialType } from '@proxyherd/common';


export interface IConnectorZyteCredential {
    credentialType: EZyteCredentialType;
    token: string;
}


export interface IConnectorZyteConfig {
    region: string;
    apiUrl: string;
}
