import {
    FINGERPRINT_SHARED_CHECKS_BURST,
    FINGERPRINT_SHARED_CHECKS_PER_MINUTE,
    FingerprintBudget,
} from './fingerprint.budget';
import {
    countFingerprintChecks,
    FINGERPRINT_URL_DEFAULT,
    getFingerprintCheckAllowance,
    isSharedFingerprintUrl,
    resetFingerprintState,
} from './fingerprint.helpers';
import { limitRefreshCount } from '../commander/refresh/refresh.service';


describe(
    'Fingerprint check budget',
    () => {
        let nowTime: number;
        const now = () => nowTime;

        beforeEach(() => {
            nowTime = 1000000;
        });

        afterEach(() => {
            resetFingerprintState();
        });

        describe(
            'Budget',
            () => {
                it(
                    'should start with its reserve and refill at a steady rate',
                    () => {
                        const budget = new FingerprintBudget(
                            10,
                            100,
                            now
                        );

                        expect(budget.available())
                            .toBe(100);

                        budget.consume(100);
                        expect(budget.available())
                            .toBe(0);

                        // 10 a minute: one every 6 seconds
                        nowTime += 5999;
                        expect(budget.available())
                            .toBe(0);
                        nowTime += 1;
                        expect(budget.available())
                            .toBe(1);
                        nowTime += 54000;
                        expect(budget.available())
                            .toBe(10);
                    }
                );

                it(
                    'should never hold more than its reserve',
                    () => {
                        const budget = new FingerprintBudget(
                            10,
                            100,
                            now
                        );

                        budget.consume(40);
                        nowTime += 60 * 60 * 1000;

                        expect(budget.available())
                            .toBe(100);
                    }
                );

                it(
                    'should pay back what two loops took at the same moment before allowing more',
                    () => {
                        const budget = new FingerprintBudget(
                            10,
                            20,
                            now
                        );

                        // Both loops saw 20 available and took 20
                        budget.consume(20);
                        budget.consume(20);
                        expect(budget.available())
                            .toBe(-20);

                        nowTime += 2 * 60 * 1000;
                        expect(budget.available())
                            .toBe(0);

                        nowTime += 60 * 1000;
                        expect(budget.available())
                            .toBe(10);
                    }
                );

                it(
                    'should spread a pool larger than the budget over a longer interval',
                    () => {
                        // 50 proxies due every minute, 10 checks a minute, no reserve left
                        const budget = new FingerprintBudget(
                            10,
                            100,
                            now
                        );
                        budget.consume(100);

                        let checks = 0;
                        for (let second = 0; second < 5 * 60; ++second) {
                            nowTime += 1000;

                            const allowance = budget.available();

                            if (allowance > 0) {
                                budget.consume(allowance);
                                checks += allowance;
                            }
                        }

                        // 5 minutes at 10 a minute: the 50 proxies were each checked once
                        // (49 when the last fraction of a check is still accruing)
                        expect(checks)
                            .toBeGreaterThanOrEqual(49);
                        expect(checks)
                            .toBeLessThanOrEqual(50);
                    }
                );
            }
        );

        describe(
            'Shared service',
            () => {
                it(
                    'should recognise the shared service by its hostname',
                    () => {
                        expect(isSharedFingerprintUrl(FINGERPRINT_URL_DEFAULT))
                            .toBe(true);
                        expect(isSharedFingerprintUrl('http://fingerprint.proxyherd.com/api/json'))
                            .toBe(true);
                        expect(isSharedFingerprintUrl('https://FINGERPRINT.proxyherd.com/api/text'))
                            .toBe(true);
                        expect(isSharedFingerprintUrl('https://fingerprint.example.com/api/json'))
                            .toBe(false);
                        expect(isSharedFingerprintUrl('https://fingerprint.proxyherd.com.example.com/api/json'))
                            .toBe(false);
                        expect(isSharedFingerprintUrl('http://203.0.113.10:3000/api/json'))
                            .toBe(false);
                        expect(isSharedFingerprintUrl(''))
                            .toBe(false);
                    }
                );

                it(
                    'should give a budget to the shared service only',
                    () => {
                        expect(getFingerprintCheckAllowance('https://fingerprint.example.com/api/json'))
                            .toBeUndefined();
                        expect(getFingerprintCheckAllowance(''))
                            .toBeUndefined();
                        expect(getFingerprintCheckAllowance(FINGERPRINT_URL_DEFAULT))
                            .toBe(FINGERPRINT_SHARED_CHECKS_BURST);
                        expect(FINGERPRINT_SHARED_CHECKS_PER_MINUTE)
                            .toBe(10);
                    }
                );

                it(
                    'should count the checks of every loop of the process against one budget',
                    () => {
                        resetFingerprintState(new FingerprintBudget(
                            10,
                            30,
                            now
                        ));

                        countFingerprintChecks(
                            FINGERPRINT_URL_DEFAULT,
                            20
                        );
                        // Another service does not draw from it
                        countFingerprintChecks(
                            'https://fingerprint.example.com/api/json',
                            1000
                        );
                        countFingerprintChecks(
                            'http://fingerprint.proxyherd.com/api/json',
                            10
                        );

                        expect(getFingerprintCheckAllowance(FINGERPRINT_URL_DEFAULT))
                            .toBe(0);
                    }
                );
            }
        );

        describe(
            'Count handed out by the commander',
            () => {
                it(
                    'should be the configured count unless the loop asks for less',
                    () => {
                        expect(limitRefreshCount(
                            1000,
                            void 0
                        ))
                            .toBe(1000);
                        expect(limitRefreshCount(
                            1000,
                            7
                        ))
                            .toBe(7);
                        expect(limitRefreshCount(
                            1000,
                            5000
                        ))
                            .toBe(1000);
                        expect(limitRefreshCount(
                            1000,
                            0
                        ))
                            .toBe(0);
                        expect(limitRefreshCount(
                            1000,
                            -3
                        ))
                            .toBe(0);
                        expect(limitRefreshCount(
                            1000,
                            NaN
                        ))
                            .toBe(1000);
                    }
                );
            }
        );
    }
);
