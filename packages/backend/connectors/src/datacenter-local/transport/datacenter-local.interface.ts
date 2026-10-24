import type { IProxyToConnectConfigDatacenter } from '@proxyherd/backend-sdk';
import type { IFingerprint } from '@proxyherd/common';


export interface IProxyToConnectConfigDatacenterLocal extends IProxyToConnectConfigDatacenter {
    fingerprintForce: IFingerprint | null;
}
