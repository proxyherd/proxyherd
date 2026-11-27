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
data. The country is `null` when Cloudflare has no data for the address and
for exits of the Tor network. The free plan allows 100,000 requests per day;
ProxyHerd issues one request per proxy per refresh, so size accordingly or use
the Node service.

Before choosing this variant read the sizing section of the documentation
(https://proxyherd.github.io/proxyherd/deployment/fingerprint#sizing-and-proxy-traffic):
ProxyHerd checks each proxy once a minute by default (about 1,400 requests per
proxy per day), so the free plan's 100,000 requests per day cover about 60
proxies plus pool entries; shorter `PROXY_REFRESH_DELAY` /
`FREEPROXY_REFRESH_DELAY` values reduce that quickly.

This directory is not part of the Nx build; it is deployed with wrangler only.
It is linted and tested with the rest of the repository:

```shell
npx nx run fingerprint-worker:lint
npx nx run fingerprint-worker:test
```

The tests run the Worker in Node.js with a fake rate limiter. Before deploying
a change, also try it in Cloudflare's runtime with
`npx wrangler dev --env hosted`.

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

How the limit behaves:

- An IPv4 address is counted on its own. An IPv6 address is counted with its
  /64 network, because one machine usually owns the whole /64.
- The limit protects the service and cannot take it down: if the limiter itself
  fails, the request is answered and the error is logged without the caller's
  address.
- The binding needs wrangler 4.36.0 or later. Check after every deploy that it
  is in place; without it the Worker answers every request:

  ```shell
  curl https://fingerprint.example.com/health
  # {"status":"ok","provider":"cloudflare","rateLimit":true}
  ```
