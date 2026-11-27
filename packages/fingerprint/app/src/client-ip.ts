import { normalizeIp } from './geoip/network';
import type { Request } from 'express';


/**
 * The address of the caller. Express applies the "trust proxy" setting to req.ip
 * (X-Forwarded-For, see TRUST_PROXY); without it, this is the address of the socket.
 */
export function clientIp(req: Request): string {
    const ip = req.ip ?? req.socket.remoteAddress ?? '';

    return normalizeIp(ip);
}
