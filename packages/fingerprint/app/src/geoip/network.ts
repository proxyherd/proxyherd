import {
    isIPv4,
    isIPv6,
} from 'net';


const IPV4_MAPPED_PREFIX = '::ffff:';


/**
 * Normalise an address as reported by a socket: IPv4-mapped IPv6 addresses become plain IPv4.
 */
export function normalizeIp(ip: string): string {
    const lower = ip.toLowerCase();

    if (lower.startsWith(IPV4_MAPPED_PREFIX)) {
        const candidate = lower.substring(IPV4_MAPPED_PREFIX.length);

        if (isIPv4(candidate)) {
            return candidate;
        }
    }

    return ip;
}


function expandIpv6(ip: string): bigint {
    const [
        head, tail,
    ] = ip.split('::');
    const headParts = head.length > 0 ? head.split(':') : [];
    const tailParts = tail && tail.length > 0 ? tail.split(':') : [];
    const missing = 8 - headParts.length - tailParts.length;
    const parts = [
        ...headParts,
        ...new Array<string>(Math.max(
            missing,
            0
        ))
            .fill('0'),
        ...tailParts,
    ];
    let value = BigInt(0);

    for (const part of parts) {
        value = (value << BigInt(16)) + BigInt(parseInt(
            part,
            16
        ));
    }

    return value;
}


function compressIpv6(value: bigint): string {
    const groups: number[] = [];

    for (let i = 7; i >= 0; i--) {
        groups.push(Number(value >> BigInt(16 * i) & BigInt(0xffff)));
    }

    // Find the longest run of zero groups to replace with "::"
    let bestLength = 0,
        bestStart = -1,
        start = -1;

    for (let i = 0; i <= groups.length; i++) {
        if (i < groups.length && groups[ i ] === 0) {
            if (start < 0) {
                start = i;
            }
        } else {
            if (start >= 0 && i - start > bestLength) {
                bestStart = start;
                bestLength = i - start;
            }

            start = -1;
        }
    }

    const hex = groups.map((g) => g.toString(16));

    if (bestLength >= 2) {
        const left = hex.slice(
            0,
            bestStart
        )
            .join(':');
        const right = hex.slice(bestStart + bestLength)
            .join(':');

        return `${left}::${right}`;
    }

    return hex.join(':');
}


/**
 * Compute the network in CIDR notation that contains `ip` for the given prefix length,
 * e.g. ("13.38.69.243", 14) => "13.36.0.0/14".
 */
export function networkFromPrefix(
    ip: string, prefixLength: number
): string | null {
    const normalized = normalizeIp(ip);

    if (isIPv4(normalized)) {
        if (prefixLength < 0 || prefixLength > 32) {
            return null;
        }

        const octets = normalized.split('.')
            .map((o) => parseInt(
                o,
                10
            ));
        const value = (octets[ 0 ] << 24 >>> 0) + (octets[ 1 ] << 16) + (octets[ 2 ] << 8) + octets[ 3 ];
        const mask = prefixLength === 0 ? 0 : 0xffffffff << 32 - prefixLength >>> 0;
        const network = (value & mask) >>> 0;
        const parts = [
            network >>> 24,
            network >>> 16 & 0xff,
            network >>> 8 & 0xff,
            network & 0xff,
        ];

        return `${parts.join('.')}/${prefixLength}`;
    }

    if (isIPv6(normalized)) {
        if (prefixLength < 0 || prefixLength > 128) {
            return null;
        }

        const value = expandIpv6(normalized.split('%')[ 0 ]);
        const all = (BigInt(1) << BigInt(128)) - BigInt(1);
        const mask = prefixLength === 0 ? BigInt(0) : all << BigInt(128 - prefixLength) & all;

        return `${compressIpv6(value & mask)}/${prefixLength}`;
    }

    return null;
}
