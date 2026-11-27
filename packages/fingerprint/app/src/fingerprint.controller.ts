import {
    Controller,
    Get,
    Header,
    Inject,
    Req,
} from '@nestjs/common';
import { clientIp } from './client-ip';
import { FINGERPRINT_SERVICE_CONFIG } from './config';
import { GeoipService } from './geoip/geoip.service';
import type { IFingerprintServiceConfig } from './config';
import type { IGeoipStatus } from './geoip/geoip.service';
import type { IFingerprint } from '@proxyherd/common';
import type { Request } from 'express';


@Controller()
export class FingerprintController {
    constructor(
        @Inject(FINGERPRINT_SERVICE_CONFIG)
        private readonly config: IFingerprintServiceConfig,
        private readonly geoip: GeoipService
    ) {}

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
    getHealth(): IGeoipStatus & { status: string; rateLimit: boolean } {
        return {
            status: 'ok',
            ...this.geoip.status,
            // Lets a deployment check and a monitor see that RATE_LIMIT_PER_MINUTE is in place
            rateLimit: this.config.rateLimitPerMinute > 0,
        };
    }

    // The answers depend on the caller's address: nothing on the way back may store and replay them
    @Get('api/json')
    @Header(
        'Cache-Control',
        'no-store'
    )
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
    @Header(
        'Cache-Control',
        'no-store'
    )
    getText(@Req() req: Request): string {
        return clientIp(req);
    }
}
