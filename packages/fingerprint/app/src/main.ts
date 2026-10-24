import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getEnvConfig } from './config';
import type { NestExpressApplication } from '@nestjs/platform-express';


(async() => {
    const config = getEnvConfig();
    const app = await NestFactory.create<NestExpressApplication>(
        AppModule.forRoot(config),
        {
            logger: [
                'log', 'warn', 'error',
            ],
        }
    );
    app.enableShutdownHooks();

    if (config.trustProxy) {
        app.set(
            'trust proxy',
            true
        );
    }

    await app.listen(config.port);

    new Logger('Fingerprint')
        .log(`ProxyHerd fingerprint service listening on port ${config.port} (GeoIP provider: ${config.provider})`);
})()
    .catch((err: any) => {
        console.error(err.message ?? err);
        process.exit(1);
    });
