const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;
const IPV6_GROUP = /^[0-9a-f]{1,4}$/i;
const IPV6_GROUPS = 8;
const IPV6_NETWORK_GROUPS = 4;
const ONE_MINUTE_IN_MS = 60 * 1000;
const MAX_KEYS_DEFAULT = 200000;


/**
 * What requests are counted by. An IPv4 address counts on its own. An IPv6 address counts with
 * its /64 network, the block one customer usually gets: counted address by address, a single
 * machine has 2^64 of them to get past the limit with.
 *
 * The Cloudflare Worker (packages/fingerprint/worker) counts the same way; keep the two alike.
 */
export function rateLimitKey(ip: string): string {
    if (!ip.includes(':')) {
        return ip;
    }

    const mapped = IPV4_MAPPED.exec(ip);

    if (mapped) {
        return mapped[ 1 ];
    }

    const parts = ip.split('::');

    if (parts.length > 2) {
        return ip;
    }

    const head = parts[ 0 ].length > 0 ? parts[ 0 ].split(':') : [];
    let groups: string[];

    if (parts.length === 2) {
        const tail = parts[ 1 ].length > 0 ? parts[ 1 ].split(':') : [];
        const missing = IPV6_GROUPS - head.length - tail.length;

        if (missing < 1) {
            return ip;
        }

        const zeros: string[] = Array.from(
            {
                length: missing,
            },
            () => '0'
        );

        groups = [
            ...head, ...zeros, ...tail,
        ];
    } else {
        groups = head;
    }

    const network = groups.slice(
        0,
        IPV6_NETWORK_GROUPS
    );

    // Not an address this function understands: count it as it is
    if (groups.length !== IPV6_GROUPS || !network.every((group) => IPV6_GROUP.test(group))) {
        return ip;
    }

    return `${network.map((group) => parseInt(
        group,
        16
    )
        .toString(16))
        .join(':')}::/64`;
}


interface IWindow {
    start: number;
    count: number;
}


/**
 * Counts requests per key in windows of one minute, in memory. A key may use `limit` requests
 * in a window; across the boundary of two windows it can briefly reach twice that, which is
 * fine for a limit meant to stop one address from hammering the service.
 *
 * Memory is bounded: finished windows are dropped every minute, and past `maxKeys` distinct
 * keys in one window the counts are dropped altogether. Letting requests through is the safe
 * side here: the limit protects the service and must not be what takes it down.
 */
export class RateLimiter {
    private readonly windows = new Map<string, IWindow>();

    private lastSweep: number;

    constructor(
        private readonly limit: number,
        private readonly windowMs = ONE_MINUTE_IN_MS,
        private readonly maxKeys = MAX_KEYS_DEFAULT,
        private readonly now: () => number = Date.now
    ) {
        this.lastSweep = this.now();
    }

    get size(): number {
        return this.windows.size;
    }

    /**
     * Counts one request. Returns false when the key is over its limit.
     */
    take(key: string): boolean {
        const nowTime = this.now();

        this.sweep(nowTime);

        const current = this.windows.get(key);

        if (!current || nowTime - current.start >= this.windowMs) {
            this.windows.set(
                key,
                {
                    start: nowTime,
                    count: 1,
                }
            );

            return true;
        }

        current.count += 1;

        return current.count <= this.limit;
    }

    private sweep(nowTime: number) {
        if (this.windows.size >= this.maxKeys) {
            this.windows.clear();
            this.lastSweep = nowTime;

            return;
        }

        if (nowTime - this.lastSweep < this.windowMs) {
            return;
        }

        this.lastSweep = nowTime;

        for (const [
            key, current,
        ] of this.windows) {
            if (nowTime - current.start >= this.windowMs) {
                this.windows.delete(key);
            }
        }
    }
}
