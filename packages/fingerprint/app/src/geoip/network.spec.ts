import {
    networkFromPrefix,
    normalizeIp,
} from './network';


describe(
    'Fingerprint - network helpers',
    () => {
        it(
            'should normalise IPv4-mapped IPv6 addresses',
            () => {
                expect(normalizeIp('::ffff:13.38.69.243'))
                    .toBe('13.38.69.243');
                expect(normalizeIp('13.38.69.243'))
                    .toBe('13.38.69.243');
                expect(normalizeIp('2a02:1234:5678::1'))
                    .toBe('2a02:1234:5678::1');
            }
        );

        it(
            'should compute IPv4 networks',
            () => {
                expect(networkFromPrefix(
                    '13.38.69.243',
                    14
                ))
                    .toBe('13.36.0.0/14');
                expect(networkFromPrefix(
                    '::ffff:13.38.69.243',
                    24
                ))
                    .toBe('13.38.69.0/24');
                expect(networkFromPrefix(
                    '192.168.1.77',
                    32
                ))
                    .toBe('192.168.1.77/32');
                expect(networkFromPrefix(
                    '192.168.1.77',
                    0
                ))
                    .toBe('0.0.0.0/0');
            }
        );

        it(
            'should compute IPv6 networks',
            () => {
                expect(networkFromPrefix(
                    '2a02:1234:5678:9abc::1',
                    32
                ))
                    .toBe('2a02:1234::/32');
                expect(networkFromPrefix(
                    '2001:db8:0:0:1:0:0:1',
                    64
                ))
                    .toBe('2001:db8::/64');
                expect(networkFromPrefix(
                    '2001:db8::1',
                    128
                ))
                    .toBe('2001:db8::1/128');
            }
        );

        it(
            'should reject invalid input',
            () => {
                expect(networkFromPrefix(
                    'not-an-ip',
                    24
                ))
                    .toBeNull();
                expect(networkFromPrefix(
                    '10.0.0.1',
                    33
                ))
                    .toBeNull();
            }
        );
    }
);
