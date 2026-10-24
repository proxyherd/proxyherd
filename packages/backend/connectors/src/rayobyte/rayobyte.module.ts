import { Module } from '@nestjs/common';
import {
    ConnectorprovidersModule,
    TransportProxyModule,
} from '@proxyherd/backend-sdk';
import { ConnectorRayobyteFactory } from './rayobyte.factory';


@Module({
    imports: [
        ConnectorprovidersModule, TransportProxyModule,
    ],
    providers: [
        ConnectorRayobyteFactory,
    ],
})
export class ConnectorRayobyteModule {}
