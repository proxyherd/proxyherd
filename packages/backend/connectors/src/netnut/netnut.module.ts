import { Module } from '@nestjs/common';
import { ConnectorprovidersModule } from '@proxyherd/backend-sdk';
import { ConnectorNetnutFactory } from './netnut.factory';
import { TransportNetnutModule } from './transport';


@Module({
    imports: [
        ConnectorprovidersModule, TransportNetnutModule,
    ],
    providers: [
        ConnectorNetnutFactory,
    ],
})
export class ConnectorNetnutModule {}
