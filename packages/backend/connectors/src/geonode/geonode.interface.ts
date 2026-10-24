import { EGeonodeProductType } from '@proxyherd/common';


export interface IConnectorGeonodeCredential {
    username: string;
    password: string;
}


export interface IConnectorGeonodeConfig {
    productType: EGeonodeProductType;
    country: string;
    lifetime: number;
}
