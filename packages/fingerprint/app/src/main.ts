import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
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
    setupApp(
        app,
        config
    );

    await app.listen(config.port);

    const logger = new Logger('Fingerprint');
    logger.log(`ProxyHerd fingerprint service listening on port ${config.port} (GeoIP provider: ${config.provider})`);

    if (config.trustProxy > 0) {
        logger.log(`Caller address read from X-Forwarded-For, behind ${config.trustProxy} trusted reverse proxy(ies)`);
    }

    if (config.rateLimitPerMinute > 0) {
        logger.log(`Rate limit: ${config.rateLimitPerMinute} requests per minute per address`);
    }
})()
    .catch((err: any) => {
        console.error(err.message ?? err);
        process.exit(1);
    });
