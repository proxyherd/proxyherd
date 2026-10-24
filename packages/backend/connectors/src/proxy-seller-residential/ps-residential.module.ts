import { Module } from '@nestjs/common';
import {
    ConnectorprovidersModule,
    TransportProxyModule,
} from '@proxyherd/backend-sdk';
import { ConnectorProxySellerResidentialFactory } from './ps-residential.factory';


@Module({
    imports: [
        ConnectorprovidersModule, TransportProxyModule,
    ],
    providers: [
        ConnectorProxySellerResidentialFactory,
    ],
})
export class ConnectorProxySellerResidentialModule {}
