import { Module } from '@nestjs/common';
import {
    ConnectorprovidersModule,
    TransportHardwareModule,
} from '@proxyherd/backend-sdk';
import { ConnectorXProxyFactory } from './xproxy.factory';


@Module({
    imports: [
        ConnectorprovidersModule, TransportHardwareModule,
    ],
    providers: [
        ConnectorXProxyFactory,
    ],
})
export class ConnectorXProxyModule {}
