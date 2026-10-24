import { Module } from '@nestjs/common';
import { FINGERPRINT_SERVICE_CONFIG } from './config';
import { FingerprintController } from './fingerprint.controller';
import { GeoipService } from './geoip/geoip.service';
import type { IFingerprintServiceConfig } from './config';
import type { DynamicModule } from '@nestjs/common';


@Module({})
export class AppModule {
    static forRoot(config: IFingerprintServiceConfig): DynamicModule {
        return {
            module: AppModule,
            controllers: [
                FingerprintController,
            ],
            providers: [
                {
                    provide: FINGERPRINT_SERVICE_CONFIG,
                    useValue: config,
                },
                GeoipService,
            ],
        };
    }
}
