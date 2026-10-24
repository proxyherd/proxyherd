import * as fs from 'fs';
import {
    ConnectorProxyCheapResidentialModule,
    IConnectorProxyCheapResidentialConfig,
} from '@proxyherd/backend-connectors';
import { Agents } from '@proxyherd/backend-sdk';
import { testConnectors } from '@proxyherd/backend-test-sdk';
import { CONNECTOR_PROXY_CHEAP_RESIDENTIAL_TYPE } from '@proxyherd/common';


describe(
    'Connector Provider - Proxy-Cheap Residential',
    () => {
        const agents = new Agents();
        const credentialConfigData = fs.readFileSync('packages/backend/test-connectors/src/assets/proxy-cheap-residential/credentials.json');

        afterAll(() => {
            agents.close();
        });

        testConnectors(
            {
                beforeAll, afterAll, it, expect,
            },
            agents,
            [
                ConnectorProxyCheapResidentialModule,
            ],
            CONNECTOR_PROXY_CHEAP_RESIDENTIAL_TYPE,
            [
                {
                    name: 'Unique Credential',
                    config: JSON.parse(credentialConfigData.toString()),
                    connectors: [
                        {
                            name: 'Test on Residential',
                            config: {
                                country: 'All',
                            } satisfies IConnectorProxyCheapResidentialConfig,
                        },
                    ],
                },
            ]
        );
    }
);
