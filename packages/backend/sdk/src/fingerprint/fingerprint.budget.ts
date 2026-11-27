const ONE_MINUTE_IN_MS = 60 * 1000;


/**
 * How many checks one installation sends to the shared fingerprint service: a steady rate, and a
 * reserve so that a pool comes online at once after a start. The service is shared by every
 * installation that has not set up its own, so each one takes a small, equal part of it.
 */
export const FINGERPRINT_SHARED_CHECKS_PER_MINUTE = 10;

export const FINGERPRINT_SHARED_CHECKS_BURST = 100;


/**
 * A budget of checks, refilled at a steady rate up to a reserve.
 *
 * The refresh loops ask how many checks may start now and take at most that many proxies from
 * the commander. Proxies beyond the budget are not failed: they stay due and are checked on a
 * later turn, so a pool larger than the budget is checked less often, in the same order.
 */
export class FingerprintBudget {
    private tokens: number;

    private lastTs: number;

    constructor(
        public readonly perMinute: number,
        public readonly burst: number,
        private readonly now: () => number = Date.now
    ) {
        this.tokens = burst;
        this.lastTs = this.now();
    }

    /**
     * The number of checks that may start now. Zero or less: none, wait.
     */
    available(): number {
        this.refill();

        return Math.floor(this.tokens);
    }

    /**
     * Counts checks that were started. Two loops share one budget and may each take what was
     * available at the same moment: the budget then goes below zero and is paid back first.
     */
    consume(count: number) {
        this.refill();
        this.tokens -= count;
    }

    private refill() {
        const nowTime = this.now();
        const elapsed = nowTime - this.lastTs;

        if (elapsed <= 0) {
            return;
        }

        this.lastTs = nowTime;
        this.tokens = Math.min(
            this.burst,
            this.tokens + elapsed * this.perMinute / ONE_MINUTE_IN_MS
        );
    }
}
