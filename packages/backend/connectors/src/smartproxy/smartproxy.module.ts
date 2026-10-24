import { Module } from '@nestjs/common';
import { ConnectorprovidersModule } from '@proxyherd/backend-sdk';
import { ConnectorSmartproxyFactory } from './smartproxy.factory';
import { TransportSmartproxyModule } from './transport';


@Module({
    imports: [
        ConnectorprovidersModule, TransportSmartproxyModule,
    ],
    providers: [
        ConnectorSmartproxyFactory,
    ],
})
export class ConnectorSmartproxyModule {}
