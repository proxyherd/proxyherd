import {
    EProxyStatus,
    ONE_MINUTE_IN_MS,
} from '@proxyherd/common';
import { isUnreachableForTooLong } from './refresh.service';
import type { IFingerprint } from '@proxyherd/common';


const NOW = 100 * ONE_MINUTE_IN_MS;
const TIMEOUT = 10 * ONE_MINUTE_IN_MS;
const FINGERPRINT: IFingerprint = {
    ip: '203.0.113.10',
    useragent: null,
    asnName: null,
    asnNetwork: null,
    continentCode: null,
    continentName: null,
    countryCode: null,
    countryName: null,
    cityName: null,
    timezone: null,
    latitude: null,
    longitude: null,
};


describe(
    'Commander - Refresh - Unreachable proxies',
    () => {
        it(
            'should replace a proxy that never finishes starting',
            () => {
                expect(isUnreachableForTooLong(
                    {
                        status: EProxyStatus.STARTING,
                        fingerprint: null,
                        fingerprintError: null,
                        disconnectedTs: NOW - TIMEOUT - 1,
                        timeoutUnreachable: TIMEOUT,
                    },
                    NOW
                ))
                    .toBe(true);
            }
        );

        it(
            'should replace a started proxy whose checks have failed for too long',
            () => {
                expect(isUnreachableForTooLong(
                    {
                        status: EProxyStatus.STARTED,
                        fingerprint: null,
                        fingerprintError: 'connect ECONNREFUSED',
                        disconnectedTs: NOW - TIMEOUT - 1,
                        timeoutUnreachable: TIMEOUT,
                    },
                    NOW
                ))
                    .toBe(true);

                // A check that failed without a message is a failed check too
                expect(isUnreachableForTooLong(
                    {
                        status: EProxyStatus.STARTED,
                        fingerprint: null,
                        fingerprintError: '',
                        disconnectedTs: NOW - TIMEOUT - 1,
                        timeoutUnreachable: TIMEOUT,
                    },
                    NOW
                ))
                    .toBe(true);
            }
        );

        it(
            'should keep a started proxy that still waits for its first check',
            () => {
                // Checks spread over a budget, or set aside while the fingerprint service is down
                expect(isUnreachableForTooLong(
                    {
                        status: EProxyStatus.STARTED,
                        fingerprint: null,
                        fingerprintError: null,
                        disconnectedTs: NOW - 6 * TIMEOUT,
                        timeoutUnreachable: TIMEOUT,
                    },
                    NOW
                ))
                    .toBe(false);
            }
        );

        it(
            'should keep a proxy inside its timeout, an online proxy, and any proxy when the timeout is off',
            () => {
                expect(isUnreachableForTooLong(
                    {
                        status: EProxyStatus.STARTED,
                        fingerprint: null,
                        fingerprintError: 'connect ECONNREFUSED',
                        disconnectedTs: NOW - TIMEOUT,
                        timeoutUnreachable: TIMEOUT,
                    },
                    NOW
                ))
                    .toBe(false);

                expect(isUnreachableForTooLong(
                    {
                        status: EProxyStatus.STARTED,
                        fingerprint: FINGERPRINT,
                        fingerprintError: null,
                        disconnectedTs: null,
                        timeoutUnreachable: TIMEOUT,
                    },
                    NOW
                ))
                    .toBe(false);

                expect(isUnreachableForTooLong(
                    {
                        status: EProxyStatus.STARTING,
                        fingerprint: null,
                        fingerprintError: null,
                        disconnectedTs: NOW - 6 * TIMEOUT,
                        timeoutUnreachable: null,
                    },
                    NOW
                ))
                    .toBe(false);
            }
        );
    }
);
