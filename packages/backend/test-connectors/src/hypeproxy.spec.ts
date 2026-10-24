import * as fs from 'fs';
import { ConnectorHypeproxyModule } from '@proxyherd/backend-connectors';
import { Agents } from '@proxyherd/backend-sdk';
import { testConnectors } from '@proxyherd/backend-test-sdk';
import { CONNECTOR_HYPEPROXY_TYPE } from '@proxyherd/common';


describe(
    'Connector Provider - HypeProxy',
    () => {
        const agents = new Agents();
        const credentialConfigData = fs.readFileSync('packages/backend/test-connectors/src/assets/hypeproxy/credentials.json');

        afterAll(() => {
            agents.close();
        });

        testConnectors(
            {
                beforeAll, afterAll, it, expect,
            },
            agents,
            [
                ConnectorHypeproxyModule,
            ],
            CONNECTOR_HYPEPROXY_TYPE,
            [
                {
                    name: 'Unique Credential',
                    config: JSON.parse(credentialConfigData.toString()),
                    connectors: [
                        {
                            name: 'Test on 4G modem',
                        },
                    ],
                },
            ]
        );
    }
);
