import { Module } from '@nestjs/common';
import { ConnectorprovidersModule } from '@proxyherd/backend-sdk';
import { ConnectorNimblewayFactory } from './nimbleway.factory';
import { TransportNimblewayModule } from './transport';


@Module({
    imports: [
        ConnectorprovidersModule, TransportNimblewayModule,
    ],
    providers: [
        ConnectorNimblewayFactory,
    ],
})
export class ConnectorNimblewayModule {}
