import { Module } from '@nestjs/common';
import {
    ConnectorprovidersModule,
    TransportProxyModule,
} from '@proxyherd/backend-sdk';
import { ConnectorLiveproxiesFactory } from './liveproxies.factory';


@Module({
    imports: [
        ConnectorprovidersModule, TransportProxyModule,
    ],
    providers: [
        ConnectorLiveproxiesFactory,
    ],
})
export class ConnectorLiveproxiesModule {}
