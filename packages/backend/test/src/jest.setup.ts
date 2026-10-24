// The end-to-end suite waits for background work (connector refresh, fingerprints,
// metrics) with fixed delays. On the small CI runners a wait occasionally runs out,
// so a failed test is retried there; locally a failure fails at once.
if (process.env.CI) {
    jest.retryTimes(
        2,
        {
            logErrorsBeforeRetry: true,
        }
    );
}
