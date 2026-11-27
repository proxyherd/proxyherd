# Fingerprint service

ProxyHerd decides whether a proxy is usable by asking the proxy to fetch a small
web service, the **fingerprint service**, and reading the answer: the proxy's
public IP address, its network (ASN) and its approximate location. A proxy that
cannot reach it is marked offline and receives no traffic.

Scrapoxy relied on a hosted service for this, which no longer exists. ProxyHerd
works out of the box with a **shared service** run by the project, and ships
the same service for you to run yourself.


## Shared service (default)

When neither `FINGERPRINT_URL` nor `FINGERPRINT_URL_DISCOVERY` is set, ProxyHerd
uses the shared service at `https://fingerprint.proxyherd.com/api/json` and says
so once in its log at start. Nothing to install: start ProxyHerd, add proxies,
and they come online. ProxyHerd 1.2.0 and later; earlier versions refuse to
start without `FINGERPRINT_URL`.

It is meant for trials and small installations:

- **10 checks a minute per installation.** Every installation that has not set
  up its own service shares this one, so ProxyHerd spreads its own checks: a
  reserve of 100 at start, so that a first pool comes online at once, then 10 a
  minute. Nothing fails beyond that; each proxy is checked less often. With 10
  proxies each one is checked every minute, with 100 every ten minutes, and a
  dead proxy is noticed that much later. Pool entries of a Proxy List connector
  count as well. ProxyHerd says so once in its log when a pool outgrows the
  budget. In a cluster, each refresh process has its own budget.
- **Rate limited per IP address.** The service accepts about 20 requests per
  minute from one public address; IPv6 addresses are counted together with the
  rest of their /64 network. The limit is reached when many proxies share one
  exit address or one IPv6 /64. Requests over it get `429 Too Many Requests`,
  and the proxy is shown offline with that message. ProxyHerd does not repeat a
  rate limited check at once; the next refresh tries again.
- **Best effort.** There is no uptime guarantee. While the service does not
  answer, ProxyHerd keeps the last known state of your proxies instead of
  marking them offline; see
  [when the fingerprint service is down](#when-the-fingerprint-service-is-down).
- **What it receives.** Each check arrives through your proxy, so the service
  sees the proxy's public IP address and the `ProxyHerd/<version>` user agent.
  About once a minute ProxyHerd also asks it directly, to tell an outage of the
  service from dead proxies, so it sees the public address of the machine
  running ProxyHerd as well. Nothing else is sent (see
  [what ProxyHerd sends](#what-proxyherd-sends)). The service keeps no request
  log. It sits behind Cloudflare, which forwards the requests to it.
- **The same service as the one you can run**: the
  [Docker service](#option-a-docker-recommended) with its default DB-IP data.

For production, for large pools, for proxies billed per gigabyte (your own
service can answer over plain HTTP), or to keep proxy addresses to yourself,
run your own service as described below and set `FINGERPRINT_URL`. Nothing else
changes, and no budget applies.


## Running your own

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

That hostname changes every time the tunnel starts, so do not copy it into
`FINGERPRINT_URL`. Point `FINGERPRINT_URL_DISCOVERY` at the metrics endpoint
of `cloudflared` instead: ProxyHerd asks it for the current hostname at start,
asks again every ten seconds and switches as soon as the hostname changes. One
command starts everything, and a reboot or a restarted tunnel needs nothing
from you.

```yaml
services:
  fingerprint:
    image: ghcr.io/proxyherd/fingerprint
    restart: unless-stopped
    environment:
      TRUST_PROXY: "true"   # the proxy's address arrives in X-Forwarded-For
    volumes:
      - geoip:/data/geoip

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    # --metrics lets the other services read the tunnel's hostname on port 2000 (not published)
    command: tunnel --no-autoupdate --metrics 0.0.0.0:2000 --url http://fingerprint:3000
    depends_on:
      - fingerprint

  proxyherd:
    image: ghcr.io/proxyherd/proxyherd
    restart: unless-stopped
    depends_on:
      - cloudflared
    ports:
      - "8888:8888"   # proxy endpoint for your scrapers
      - "8890:8890"   # user interface and API
    environment:
      AUTH_LOCAL_USERNAME: admin
      AUTH_LOCAL_PASSWORD: password
      BACKEND_JWT_SECRET: secret1
      FRONTEND_JWT_SECRET: secret2
      STORAGE_FILE_FILENAME: /cfg/proxyherd.json
      # Ask cloudflared for the public address of the fingerprint service and follow it
      FINGERPRINT_URL_DISCOVERY: http://cloudflared:2000/quicktunnel
    volumes:
      - cfg:/cfg

volumes:
  geoip:
  cfg:
```

```shell
docker compose up -d
docker compose logs proxyherd | grep "Fingerprint address"
```

Replace `admin`, `password`, `secret1` and `secret2` with your own values;
nothing else to set. The second command prints the address in use, for example
`Fingerprint address: https://<random>.trycloudflare.com/api/json`. Check it
through one of your proxies as shown above. `FINGERPRINT_URL_DISCOVERY` needs
ProxyHerd 1.1.0 or later.

The endpoint answers `{"hostname": "<random>.trycloudflare.com"}` and ProxyHerd
turns it into `https://<hostname>/api/json`. Any endpoint that answers with such
a `hostname`, or with a complete `url`, works the same way; see the
[environment variables](/usage/env#fingerprint).

Without Docker, `cloudflared tunnel --url http://localhost:3000 --metrics localhost:2000`
publishes a service running on your machine, and ProxyHerd started with
`FINGERPRINT_URL_DISCOVERY=http://localhost:2000/quicktunnel` follows it the
same way. `ngrok http 3000` (account required) prints its hostname instead:
copy it into `FINGERPRINT_URL=https://<hostname>/api/json` and restart
ProxyHerd after every restart of ngrok.

::: warning Trials only
Quick tunnels come with no uptime guarantee and allow 200 requests in flight.
Use them for trials and development, not for production: move to a server with
a public address or to the Cloudflare Worker variant below.
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
is read from `X-Forwarded-For`. The same setting is right behind a Cloudflare
Tunnel.

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
  city accuracy depends on Cloudflare's data. The country is `null` when
  Cloudflare has no data for the address, and for exits of the Tor network.
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
  machine; it answers from memory. The [shared service](#shared-service-default)
  takes 10 checks a minute from one installation. The Cloudflare free plan allows 100,000
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
| `TRUST_PROXY` | `false` | `true` behind one reverse proxy you control, or the number of them. The client address is then read from `X-Forwarded-For`, counted from the right, so an address the caller put in the header itself is never used |
| `RATE_LIMIT_PER_MINUTE` | `0` (no limit) | Requests per minute accepted from one address (one /64 network for IPv6) on `/api/json` and `/api/text`. Over it the service answers `429` with an explanation, which ProxyHerd shows on the proxy |

You can also place your own `city.mmdb` and `asn.mmdb` in `GEOIP_DIR` and set
`GEOIP_AUTO_DOWNLOAD=false`.


## Endpoints

| Path | Answer |
|---|---|
| `GET /api/json` | `{ ip, useragent, asnName, asnNetwork, continentCode, continentName, countryCode, countryName, cityName, timezone, latitude, longitude }`; every field but `ip` may be `null` |
| `GET /api/text` | the client IP address as plain text |
| `GET /health` | provider, database state, last refresh and whether a rate limit is in place (`rateLimit`); the Worker reports the provider and `rateLimit` |

Check it from a shell: `curl https://fingerprint.example.com/api/json`.

The answers of `/api/json` and `/api/text` depend on who asks, so they carry
`Cache-Control: no-store`: a caching proxy must not replay one caller's answer
to another.


## When the fingerprint service is down

A failed check normally means that the proxy is dead. It can also mean that the
fingerprint service did not answer, and from the proxy's side the two look the
same. Taking the second for the first would mark every proxy offline at once.

So ProxyHerd also asks the service directly, from its own machine: about once a
minute, and again when checks fail. When the service answered there before and
does not now, the failed checks of that moment are set aside. Proxies keep
their last known state, nothing is marked offline or removed, and the log says
so once. Checks count again as soon as the service answers.

This holds for the shared service and for your own, with ProxyHerd 1.2.0 and
later. Two limits:

- The machine running ProxyHerd must be able to reach the service directly.
  Where it never could (the service is only open to the proxies, or outgoing
  traffic is filtered), nothing changes: every failed check counts.
- A proxy that dies during the outage is noticed when the service is back.

A started proxy waiting for its first check is not removed as unreachable
either, whether it waits for the service or for the budget of the shared
service: unreachable means checked and failed. A proxy that never finishes
starting is still replaced after its connector's timeout, as before.


## What ProxyHerd sends

Each check is `GET <FINGERPRINT_URL>?version=3` through the proxy, with a
`User-Agent` of `ProxyHerd/<version>`. Nothing else. The earlier protocol also
sent an installation identifier and traffic counters; ProxyHerd only does so
when you set `FINGERPRINT_SEND_STATS=true`, for your own service's logs.

Since 1.2.0 ProxyHerd also sends `GET <FINGERPRINT_URL>` directly, without a
proxy, about once a minute while it has proxies to check, and again when
checks fail (see [when the fingerprint service is down](#when-the-fingerprint-service-is-down)).
It carries the same `User-Agent` and nothing else, and it comes from the
machine running ProxyHerd, so the fingerprint service sees that machine's
public address.


## Attribution

The Worker variant uses Cloudflare's geolocation data. For the shared service
and the Docker and npm service, with the default provider, IP geolocation is provided by
[DB-IP](https://db-ip.com) under the Creative Commons Attribution 4.0
licence. With `maxmind`, the data comes from MaxMind's GeoLite2 databases
under the GeoLite2 End User License Agreement.
