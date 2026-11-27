import {
    RateLimiter,
    rateLimitKey,
} from './ratelimit';


describe(
    'Rate limit',
    () => {
        describe(
            'Key',
            () => {
                it(
                    'should count an IPv4 address on its own',
                    () => {
                        expect(rateLimitKey('203.0.113.10'))
                            .toBe('203.0.113.10');
                        expect(rateLimitKey('::ffff:203.0.113.10'))
                            .toBe('203.0.113.10');
                    }
                );

                it(
                    'should count an IPv6 address with its /64 network',
                    () => {
                        expect(rateLimitKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd'))
                            .toBe('2001:db8:1:2::/64');
                        expect(rateLimitKey('2001:db8:1:2::1'))
                            .toBe('2001:db8:1:2::/64');
                        expect(rateLimitKey('2001:0DB8:0001:0002::ffff'))
                            .toBe('2001:db8:1:2::/64');
                        expect(rateLimitKey('2001:db8::1'))
                            .toBe('2001:db8:0:0::/64');
                        expect(rateLimitKey('::1'))
                            .toBe('0:0:0:0::/64');
                        expect(rateLimitKey('2001:db8:1:3::1')).not.toBe(rateLimitKey('2001:db8:1:2::1'));
                    }
                );

                it(
                    'should count anything else as it is',
                    () => {
                        expect(rateLimitKey(''))
                            .toBe('');
                        expect(rateLimitKey('2001:db8::1::2'))
                            .toBe('2001:db8::1::2');
                        expect(rateLimitKey('2001:db8:1:2:3:4:5'))
                            .toBe('2001:db8:1:2:3:4:5');
                        expect(rateLimitKey('zzzz:db8:1:2::1'))
                            .toBe('zzzz:db8:1:2::1');
                    }
                );
            }
        );

        describe(
            'Limiter',
            () => {
                const WINDOW = 60000;
                let nowTime: number;
                const now = () => nowTime;

                beforeEach(() => {
                    nowTime = 1000000;
                });

                it(
                    'should accept the limit per key and per window, and refuse the rest',
                    () => {
                        const limiter = new RateLimiter(
                            2,
                            WINDOW,
                            100,
                            now
                        );

                        expect(limiter.take('a'))
                            .toBe(true);
                        expect(limiter.take('a'))
                            .toBe(true);
                        expect(limiter.take('a'))
                            .toBe(false);
                        expect(limiter.take('a'))
                            .toBe(false);
                        expect(limiter.take('b'))
                            .toBe(true);

                        // The next window starts a new count
                        nowTime += WINDOW;
                        expect(limiter.take('a'))
                            .toBe(true);
                        expect(limiter.take('a'))
                            .toBe(true);
                        expect(limiter.take('a'))
                            .toBe(false);
                    }
                );

                it(
                    'should forget the keys of finished windows',
                    () => {
                        const limiter = new RateLimiter(
                            2,
                            WINDOW,
                            100,
                            now
                        );

                        for (let i = 0; i < 50; ++i) {
                            limiter.take(`key${i}`);
                        }

                        expect(limiter.size)
                            .toBe(50);

                        nowTime += WINDOW;
                        limiter.take('other');

                        expect(limiter.size)
                            .toBe(1);
                    }
                );

                it(
                    'should keep its memory bounded and let requests through when it is full',
                    () => {
                        const limiter = new RateLimiter(
                            1,
                            WINDOW,
                            10,
                            now
                        );

                        limiter.take('a');
                        expect(limiter.take('a'))
                            .toBe(false);

                        for (let i = 0; i < 20; ++i) {
                            limiter.take(`key${i}`);
                        }

                        expect(limiter.size)
                            .toBeLessThanOrEqual(10);
                        expect(limiter.take('a'))
                            .toBe(true);
                    }
                );
            }
        );
    }
);
