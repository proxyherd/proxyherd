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
ProxyHerd checks each proxy once a minute by default (about 1,400 requests per
proxy per day), so the free plan's 100,000 requests per day cover about 60
proxies plus pool entries; shorter `PROXY_REFRESH_DELAY` /
`FREEPROXY_REFRESH_DELAY` values reduce that quickly.

This directory is not part of the Nx build; it is deployed with wrangler only.

## Rate limit and the shared service

`npx wrangler deploy` deploys without a rate limit. The `hosted` environment in
`wrangler.toml` is the shared service at `fingerprint.proxyherd.com`, which
ProxyHerd uses when `FINGERPRINT_URL` is not set:

```shell
npx wrangler deploy --env hosted
```

It adds a [rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
of 20 requests per minute per IP address (counted per Cloudflare location, so
approximate), answers `429 Too Many Requests` with a short explanation over
the limit, and disables request logs. `/health` is never limited. To protect
your own deployment the same way, copy the `[[env.hosted.ratelimits]]` block
without the `env.hosted.` prefix.
