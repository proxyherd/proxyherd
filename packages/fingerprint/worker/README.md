# ProxyHerd fingerprint service on Cloudflare Workers

The smallest way to host the fingerprint service: no server, no database.
Cloudflare attaches the caller's location and network to every request, and
the Worker returns them in the same shape as `packages/fingerprint/app`.

```shell
cd packages/fingerprint/worker
npx wrangler login
npx wrangler deploy
```

Then set `FINGERPRINT_URL=https://proxyherd-fingerprint.<your-subdomain>.workers.dev/api/json`
on ProxyHerd.

Differences from the Node service: `asnNetwork` is always `null` (Cloudflare
does not expose the prefix), and city-level accuracy depends on Cloudflare's
data. The free plan allows 100,000 requests per day; ProxyHerd issues one
request per proxy per refresh, so size accordingly or use the Node service.

Before choosing this variant read the sizing section of the documentation
(https://proxyherd.github.io/proxyherd/deployment/fingerprint#sizing-and-proxy-traffic):
at default settings ProxyHerd checks each proxy every few seconds, so the free
plan's 100,000 requests per day cover only a handful of proxies unless
`PROXY_REFRESH_DELAY` and `FREEPROXY_REFRESH_DELAY` are raised.

This directory is not part of the Nx build; it is deployed with wrangler only.
