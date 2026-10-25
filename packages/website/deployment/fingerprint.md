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

The service must be reachable **through your proxies**, that is from the public
internet, not only from the machine running ProxyHerd. If the proxies cannot
reach `FINGERPRINT_URL`, every proxy stays offline. Test the address *through
one of your proxies*, not from your own shell:

```shell
curl -x http://user:password@proxy-host:port http://fingerprint.example.com:3000/api/json
```

The answer is a JSON document whose `ip` field is the proxy's public address.

One instance can serve several ProxyHerd installations. Expect one request per
proxy per refresh cycle, about 600 bytes each. There are three ways to run it,
in order of preference.

### ProxyHerd on a server with a public IP

The common case. Run the fingerprint container on the same host as ProxyHerd,
publish port 3000, and point `FINGERPRINT_URL` at the public address of that
host:

```yaml
services:
  fingerprint:
    image: ghcr.io/proxyherd/fingerprint
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - geoip:/data/geoip

  proxyherd:
    image: ghcr.io/proxyherd/proxyherd
    environment:
      FINGERPRINT_URL: http://203.0.113.10:3000/api/json
    # ...

volumes:
  geoip:
```

Replace `203.0.113.10` with the server's public IP address or hostname and
open `3000/tcp` in its firewall or security group. Nothing else to set up.
Plain HTTP is fine: the answer carries nothing confidential, and HTTP is
cheaper than HTTPS through proxies billed per gigabyte. The
[Get Started](/intro/get-started) page has the complete Compose file, and
[Option A](#option-a-docker-recommended) below shows how to serve it over
HTTPS behind a reverse proxy you already run.

### ProxyHerd on a laptop or behind NAT

For a trial or for development on a machine without a public address, the
fingerprint container needs a temporary public hostname. One way that needs no
account is a Cloudflare quick tunnel: a `cloudflared` container next to the
fingerprint service publishes it on a random `*.trycloudflare.com` hostname.

```yaml
services:
  fingerprint:
    image: ghcr.io/proxyherd/fingerprint
    restart: unless-stopped
    environment:
      TRUST_PROXY: "true"   # the proxy's address arrives in X-Forwarded-For
    volumes:
      - geoip:/data/geoip

  tunnel:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate --url http://fingerprint:3000
    depends_on:
      - fingerprint

volumes:
  geoip:
```

```shell
docker compose up -d fingerprint tunnel
docker compose logs tunnel | grep trycloudflare.com
```

Set `FINGERPRINT_URL=https://<random>.trycloudflare.com/api/json` on
ProxyHerd and start it. Without Docker, `cloudflared tunnel --url http://localhost:3000`
does the same for a service running on your machine, and `ngrok http 3000`
(account required) works the same way.

::: warning The hostname changes on every restart
Each restart of the tunnel gives it a new hostname. Read it again from the
logs, update `FINGERPRINT_URL` and restart ProxyHerd, or every proxy goes
offline. Quick tunnels come with no uptime guarantee: use them for trials,
not for production.
:::

### No server at all

The [Cloudflare Worker](#option-b-cloudflare-worker) variant runs the service
on Cloudflare's network: nothing to host and no database. Read
[Sizing](#sizing-and-proxy-traffic) first, because the free plan caps the
number of checks per day.


## Option A: Docker (recommended)

```shell
docker run -d --name fingerprint -p 3000:3000 \
  -v proxyherd-geoip:/data/geoip \
  ghcr.io/proxyherd/fingerprint
```

On first start the service downloads the free DB-IP "lite" city and ASN
databases (about 150 MB) into the volume, then refreshes them weekly.

Published directly on port 3000, `FINGERPRINT_URL=http://<public address>:3000/api/json`
is all ProxyHerd needs. To serve it over HTTPS instead, put it behind the
reverse proxy of your choice and set `TRUST_PROXY=true` so the client address
is read from `X-Forwarded-For`.

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
