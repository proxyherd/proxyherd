import type {
    IAddress,
    ICertificate,
} from '@proxyherd/common';


export interface ITransportProxyRefreshedConfigDatacenter {
    address: IAddress | undefined;
}


export interface IProxyToConnectConfigDatacenter {
    address: IAddress;
    certificate: ICertificate;
}
