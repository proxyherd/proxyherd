import { Module } from '@nestjs/common';
import { ConnectorprovidersModule } from '@proxyherd/backend-sdk';
import { ConnectorIproyalResidentialFactory } from './iproyal-residential.factory';
import { TransportIproyalResidentialModule } from './transport';


@Module({
    imports: [
        ConnectorprovidersModule, TransportIproyalResidentialModule,
    ],
    providers: [
        ConnectorIproyalResidentialFactory,
    ],
})
export class ConnectorIproyalResidentialModule {}
