import {
    Controller,
    Get,
    Header,
    Req,
} from '@nestjs/common';
import { GeoipService } from './geoip/geoip.service';
import { normalizeIp } from './geoip/network';
import type { IGeoipStatus } from './geoip/geoip.service';
import type { IFingerprint } from '@proxyherd/common';
import type { Request } from 'express';


function clientIp(req: Request): string {
    // Express applies the "trust proxy" setting to req.ip (X-Forwarded-For); the socket address otherwise.
    const ip = req.ip ?? req.socket.remoteAddress ?? '';

    return normalizeIp(ip);
}


@Controller()
export class FingerprintController {
    constructor(private readonly geoip: GeoipService) {}

    @Get()
    @Header(
        'Content-Type',
        'text/plain; charset=utf-8'
    )
    getRoot(): string {
        const status = this.geoip.status;
        const lines = [
            'ProxyHerd fingerprint service',
            'GET /api/json  -> IP, network and location of the caller as JSON',
            'GET /api/text  -> IP of the caller as text',
            'GET /health    -> service status',
        ];

        if (status.attribution) {
            lines.push(status.attribution);
        }

        return `${lines.join('\n')}\n`;
    }

    @Get('health')
    getHealth(): IGeoipStatus & { status: string } {
        return {
            status: 'ok',
            ...this.geoip.status,
        };
    }

    @Get('api/json')
    getJson(@Req() req: Request): IFingerprint {
        const ip = clientIp(req);
        const useragent = req.headers[ 'user-agent' ];

        return {
            ip,
            useragent: typeof useragent === 'string' && useragent.length > 0 ? useragent : null,
            ...this.geoip.lookup(ip),
        };
    }

    @Get('api/text')
    @Header(
        'Content-Type',
        'text/plain; charset=utf-8'
    )
    getText(@Req() req: Request): string {
        return clientIp(req);
    }
}
