import { Module } from '@nestjs/common';
import {
    ConnectorprovidersModule,
    TransportProxyModule,
} from '@proxyherd/backend-sdk';
import { ConnectorNinjasproxyFactory } from './ninjasproxy.factory';


@Module({
    imports: [
        ConnectorprovidersModule, TransportProxyModule,
    ],
    providers: [
        ConnectorNinjasproxyFactory,
    ],
})
export class ConnectorNinjasproxyModule {}
