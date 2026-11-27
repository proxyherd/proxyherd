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
`npx wrangler dev`.

## Rate limit

`npx wrangler deploy` deploys without a rate limit. `wrangler.toml` holds an
optional [rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/),
commented out: 20 requests per minute per IP address (counted per Cloudflare
location, so approximate). Over the limit the Worker answers
`429 Too Many Requests` with a short explanation, which ProxyHerd shows as the
reason the proxy is offline. `/health` is never limited.

How the limit behaves:

- An IPv4 address is counted on its own. An IPv6 address is counted with its
  /64 network, because one machine usually owns the whole /64.
- The limit protects the service and cannot take it down: if the limiter itself
  fails, the request is answered and the error is logged without the caller's
  address.
- The binding needs wrangler 4.36.0 or later. Check after every deploy that it
  is in place; without it the Worker answers every request:

  ```shell
  curl https://proxyherd-fingerprint.<your-subdomain>.workers.dev/health
  # {"status":"ok","provider":"cloudflare","rateLimit":true}
  ```

The Node service has the same limit as a setting, `RATE_LIMIT_PER_MINUTE`, and
counts requests the same way. The shared service of the project
(`fingerprint.proxyherd.com`) runs the Node service, not this Worker.
