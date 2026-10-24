import { Module } from '@nestjs/common';
import { ConnectorprovidersModule } from '@proxyherd/backend-sdk';
import { TransportZyteModule } from './transport';
import { ConnectorZyteFactory } from './zyte.factory';


@Module({
    imports: [
        ConnectorprovidersModule, TransportZyteModule,
    ],
    providers: [
        ConnectorZyteFactory,
    ],
})
export class ConnectorZyteModule {}
