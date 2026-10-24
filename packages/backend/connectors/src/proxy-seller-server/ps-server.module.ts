import { Module } from '@nestjs/common';
import {
    ConnectorprovidersModule,
    TransportProxyModule,
} from '@proxyherd/backend-sdk';
import { ConnectorProxySellerServerFactory } from './ps-server.factory';


@Module({
    imports: [
        ConnectorprovidersModule, TransportProxyModule,
    ],
    providers: [
        ConnectorProxySellerServerFactory,
    ],
})
export class ConnectorProxySellerServerModule {}
