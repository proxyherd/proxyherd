# ProxyHerd fingerprint service

The service every ProxyHerd installation points `FINGERPRINT_URL` at. Each
proxy fetches it to prove it is online, and the answer tells ProxyHerd the
proxy's public IP address, its network (ASN) and its approximate location,
resolved from a GeoIP database on your own disk. Nothing is reported to a
third party.

It must be reachable **through your proxies**, that is from the public
internet, not only from the machine running ProxyHerd.

## Run

```shell
docker run -d -p 3000:3000 -v proxyherd-geoip:/data/geoip ghcr.io/proxyherd/fingerprint
```

On first start it downloads the free DB-IP "lite" city and ASN databases
(about 150 MB) into the volume and refreshes them weekly. Then set
`FINGERPRINT_URL=https://<public host>/api/json` on ProxyHerd.

Put it behind TLS (a reverse proxy or a platform that terminates HTTPS) and
set `TRUST_PROXY=true` so the client address is read from `X-Forwarded-For`.

## Endpoints

| Path | Answer |
|---|---|
| `GET /api/json` | `{ ip, useragent, asnName, asnNetwork, continentCode, continentName, countryCode, countryName, cityName, timezone, latitude, longitude }`; every field but `ip` may be `null` |
| `GET /api/text` | the client IP address as plain text |
| `GET /health` | provider, database state and last refresh |
| `GET /` | a short description and the GeoIP attribution |

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `FINGERPRINT_PORT` | `3000` | Listening port |
| `GEOIP_PROVIDER` | `dbip` | `dbip` (free, no key), `maxmind` (GeoLite2, needs a free licence key, better accuracy) or `none` (IP only) |
| `GEOIP_DIR` | `geoip` (`/data/geoip` in the image) | Where the `.mmdb` files live |
| `GEOIP_AUTO_DOWNLOAD` | `true` | Download the databases at start and refresh them |
| `GEOIP_REFRESH_HOURS` | `168` | Refresh interval |
| `MAXMIND_LICENSE_KEY` | | Required for `GEOIP_PROVIDER=maxmind` |
| `TRUST_PROXY` | `false` | Read the client address from `X-Forwarded-For` (only behind a reverse proxy you control) |

You can also drop your own `city.mmdb` and `asn.mmdb` into `GEOIP_DIR` and
set `GEOIP_AUTO_DOWNLOAD=false`.

## Attribution

With the default provider, IP geolocation is provided by
[DB-IP](https://db-ip.com) under the Creative Commons Attribution 4.0
licence. With `maxmind`, the data is from MaxMind's GeoLite2 databases under
the GeoLite2 End User License Agreement; you need your own account and key.
