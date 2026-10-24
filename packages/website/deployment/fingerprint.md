# Fingerprint service

ProxyHerd decides whether a proxy is usable by asking the proxy to fetch a small
web service, the **fingerprint service**, and reading the answer: the proxy's
public IP address, its network (ASN) and its approximate location. A proxy that
cannot reach it is marked offline and receives no traffic.

Scrapoxy relied on a hosted service for this, which no longer exists. ProxyHerd
ships its own. You run it, and nothing about your proxies is reported anywhere.

::: warning REQUIRED
`FINGERPRINT_URL` has no default. ProxyHerd refuses to start until it points at
a fingerprint service, for example `https://fingerprint.example.com/api/json`.
:::


## Where to run it

The service must be reachable **through your proxies**, so it needs a public
address: a small VPS, a container platform, or a Cloudflare Worker. It does
not need to run next to ProxyHerd, and one instance can serve several
ProxyHerd installations.

Expect one request per proxy per refresh cycle, about 600 bytes each.


## Option A: Docker (recommended)

```shell
docker run -d --name fingerprint -p 3000:3000 \
  -v proxyherd-geoip:/data/geoip \
  ghcr.io/proxyherd/fingerprint
```

On first start the service downloads the free DB-IP "lite" city and ASN
databases (about 150 MB) into the volume, then refreshes them weekly.

Put it behind HTTPS with the reverse proxy of your choice and set
`TRUST_PROXY=true` so the client address is read from `X-Forwarded-For`.

Docker Compose, with Caddy terminating TLS:

```yaml
services:
  fingerprint:
    image: ghcr.io/proxyherd/fingerprint
    restart: unless-stopped
    environment:
      TRUST_PROXY: "true"
    volumes:
      - geoip:/data/geoip

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    command: caddy reverse-proxy --from fingerprint.example.com --to fingerprint:3000
    volumes:
      - caddy:/data

volumes:
  geoip:
  caddy:
```

Then, on ProxyHerd: `FINGERPRINT_URL=https://fingerprint.example.com/api/json`.


## Option B: Cloudflare Worker

No server and no database: Cloudflare attaches the caller's location and
network to every request, and the Worker returns them in the same shape as the
Docker service. Suitable for small installations; read [Sizing](#sizing-and-proxy-traffic)
before choosing it.

You need:

- a Cloudflare account (the free plan is enough to start; no domain required);
- Node.js 18 or later on your machine, for the `wrangler` command;
- the Worker's source, which lives in this repository under
  `packages/fingerprint/worker` (clone the repository or download that folder).

Deploy it:

```shell
git clone https://github.com/proxyherd/proxyherd.git
cd proxyherd/packages/fingerprint/worker
npx wrangler login     # opens the browser once
npx wrangler deploy    # the first deploy asks you to pick a workers.dev subdomain
```

`wrangler deploy` prints the public address. Check it from a shell:

```shell
curl https://proxyherd-fingerprint.<your-subdomain>.workers.dev/api/json
```

Then set `FINGERPRINT_URL=https://proxyherd-fingerprint.<your-subdomain>.workers.dev/api/json`
on ProxyHerd.

Limits of this variant:

- `asnNetwork` is always `null` (Cloudflare does not expose the prefix), and
  city accuracy depends on Cloudflare's data.
- The free plan allows **100,000 requests per day** for all your Workers
  together; past that, requests fail until the next day and your proxies are
  marked offline. At the default one-minute check interval the free plan
  covers about 60 proxies plus pool entries (see Sizing); shorter
  `PROXY_REFRESH_DELAY` / `FREEPROXY_REFRESH_DELAY` values reduce that quickly.
  Beyond that, use the paid Workers plan or run the Docker service.
- To update the Worker after a new ProxyHerd release, pull the repository and
  run `npx wrangler deploy` again.


## Option C: from npm

```shell
npm install -g @proxyherd/fingerprint
GEOIP_DIR=/var/lib/proxyherd/geoip proxyherd-fingerprint
```


## Sizing and proxy traffic

ProxyHerd checks every proxy again and again: the refresh loop takes the proxies
whose last check is older than `PROXY_REFRESH_DELAY`, fetches the fingerprint
through each of them, and starts over. The default is **one minute**, and
entries of a Proxy List pool follow `FREEPROXY_REFRESH_DELAY`, also one minute.
Scrapoxy and ProxyHerd 1.0.0 used one second, which meant a check through every
proxy every 5 to 10 seconds; set the variables to `1000` if you want that back.

Measured on a 1.0.0 installation with 50 proxies from a Proxy List connector
(50 running proxies plus the 50 pool entries) at the former one-second delay:
about **1,000 requests per minute**, that is 1.4 million requests per day, or
roughly 14,000 checks per proxy per day. At the one-minute default the same
installation makes about 1,400 checks per proxy per day.

Consequences:

- **Service capacity.** The Docker service handles any of this on the smallest
  machine; it answers from memory. The Cloudflare free plan allows 100,000
  requests per day: about 60 proxies plus pool entries at the one-minute
  default, about 6 at a one-second delay. The paid Workers plan removes the
  limit.
- **Proxy bandwidth.** Every check goes through the proxy. Over HTTPS each one
  pays a TLS handshake, several kilobytes; over plain HTTP a check is about one
  kilobyte in total. If your proxies are billed per gigabyte, point
  `FINGERPRINT_URL` at an `http://` address and, if needed, raise the two delays
  further. The fingerprint answer carries nothing confidential.
- **Detection speed.** A longer delay means a dead proxy is noticed later. One
  minute is a reasonable compromise for paid, stable proxies. For free proxy
  lists, which die constantly, lower `FREEPROXY_REFRESH_DELAY` and
  `PROXY_REFRESH_DELAY` to a few seconds, at the price of more checks.

Requests per day ≈ (proxies + pool entries) × 86,400 / (delay in seconds + about 5).


## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `FINGERPRINT_PORT` | `3000` | Listening port |
| `GEOIP_PROVIDER` | `dbip` | `dbip` (free, no key), `maxmind` (GeoLite2, free licence key, better accuracy) or `none` (IP only) |
| `GEOIP_DIR` | `geoip` (`/data/geoip` in the image) | Where the `.mmdb` files live |
| `GEOIP_AUTO_DOWNLOAD` | `true` | Download the databases at start and refresh them |
| `GEOIP_REFRESH_HOURS` | `168` | Refresh interval |
| `MAXMIND_LICENSE_KEY` | | Required for `GEOIP_PROVIDER=maxmind`; sign up at maxmind.com/en/geolite2/signup |
| `TRUST_PROXY` | `false` | Read the client address from `X-Forwarded-For`; only behind a reverse proxy you control |

You can also place your own `city.mmdb` and `asn.mmdb` in `GEOIP_DIR` and set
`GEOIP_AUTO_DOWNLOAD=false`.


## Endpoints

| Path | Answer |
|---|---|
| `GET /api/json` | `{ ip, useragent, asnName, asnNetwork, continentCode, continentName, countryCode, countryName, cityName, timezone, latitude, longitude }`; every field but `ip` may be `null` |
| `GET /api/text` | the client IP address as plain text |
| `GET /health` | provider, database state and last refresh |

Check it from a shell: `curl https://fingerprint.example.com/api/json`.


## What ProxyHerd sends

Each check is `GET <FINGERPRINT_URL>?version=3` through the proxy, with a
`User-Agent` of `ProxyHerd/<version>`. Nothing else. The earlier protocol also
sent an installation identifier and traffic counters; ProxyHerd only does so
when you set `FINGERPRINT_SEND_STATS=true`, for your own service's logs.


## Attribution

With the default provider, IP geolocation is provided by
[DB-IP](https://db-ip.com) under the Creative Commons Attribution 4.0
licence. With `maxmind`, the data comes from MaxMind's GeoLite2 databases
under the GeoLite2 End User License Agreement.
