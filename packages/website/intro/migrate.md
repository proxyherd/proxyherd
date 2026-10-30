# Migrating from Scrapoxy

ProxyHerd is forked from Scrapoxy 4.17.4, the last release published under the MIT licence, and nothing
from later versions is included. [NOTICE.md](https://github.com/proxyherd/proxyherd/blob/main/NOTICE.md)
records the provenance.

An installation of **Scrapoxy 4.17.4** upgrades in place: ProxyHerd reads the same configuration,
storage and REST API. The only new requirement is a fingerprint service of your own, because the hosted
one Scrapoxy relied on no longer exists.

::: warning Later Scrapoxy versions
Scrapoxy 4.18 and later were published under other licences and have not been tested with ProxyHerd.
If you run one of them, back up your storage first and tell us what you find in
[GitHub Discussions](https://github.com/proxyherd/proxyherd/discussions).
:::


## What stays the same

- **Environment variables**: same names and meaning. `FINGERPRINT_URL` used to default to the hosted
  service and is now required; `FINGERPRINT_URL_DISCOVERY` is new and replaces it on a machine without a
  public address.
- **Storage**: the file storage keeps its format and its default name `scrapoxy.json`; the MongoDB database
  `scrapoxy` and the RabbitMQ queues `scrapoxyorders` and `scrapoxyevents` keep their names.
- **Projects, credentials and connectors**: they live in the storage, so they come across as they are,
  including the username and password your scrapers use.
- **Ports and API**: `8888` for the proxy endpoint, `8890` for the user interface and the REST API.
- **Wire identifiers**: the `X-Scrapoxy-*` headers and the `scrapoxy-proxyname` sticky-session cookie.
- **Cloud resources**: instances and images keep the `scrapoxy` prefix, so existing ones are found and reused.
- **MITM certificate**: the same CA certificate as Scrapoxy 4.17.4 (the file is now named `proxyherd-ca.crt`),
  so clients that already trust it keep working. Read the [warning about this certificate](/intro/ui#project-settings).


## What changes

| | Scrapoxy 4.17.4 | ProxyHerd |
|---|---|---|
| Container image | `scrapoxy/scrapoxy` | `ghcr.io/proxyherd/proxyherd` |
| npm package and command | `scrapoxy` | `proxyherd` |
| Helm charts | `scrapoxy` from `https://charts.scrapoxy.io` | `proxyherd` from `oci://ghcr.io/proxyherd/charts` |
| Python package (Scrapy) | `scrapoxy` | `proxyherd` |
| Fingerprint service | hosted by the original author, now offline | [self-hosted](/deployment/fingerprint), required |


## Step 1: Back up the storage

- **File storage**: copy the JSON file named in `STORAGE_FILE_FILENAME` (by default `scrapoxy.json`).
  In Docker, for example: `docker cp <container>:/cfg/scrapoxy.json .`
- **Helm charts**: the Scrapoxy charts keep it in the commander pod at `/etc/scrapoxy/config.json`:
  `kubectl cp <commander pod>:/etc/scrapoxy/config.json config.json`
- **MongoDB** (distributed deployments): `mongodump --db scrapoxy`.


## Step 2: Run a fingerprint service

Every proxy fetches the fingerprint service to prove it is online and to report its location, so it must
be reachable from the proxies, that is from the public internet. Pick one of the setups in
[Get Started](/intro/get-started) or on the [fingerprint page](/deployment/fingerprint): a server with a
public address (`FINGERPRINT_URL`), a laptop or a machine behind NAT (`FINGERPRINT_URL_DISCOVERY`), or a
Cloudflare Worker.


## Step 3: Switch the installation

### Docker

Keep your volume and your environment variables, change the image, and add the fingerprint address:

```shell
docker run -d -p 8888:8888 -p 8890:8890 -v ./scrapoxy:/cfg \
  -e AUTH_LOCAL_USERNAME=admin -e AUTH_LOCAL_PASSWORD=password \
  -e BACKEND_JWT_SECRET=secret1 -e FRONTEND_JWT_SECRET=secret2 \
  -e STORAGE_FILE_FILENAME=/cfg/scrapoxy.json \
  -e FINGERPRINT_URL=http://203.0.113.10:3000/api/json \
  ghcr.io/proxyherd/proxyherd
```

Replace `203.0.113.10` with the public address of your fingerprint service. With Docker Compose, change
`image:` and add `FINGERPRINT_URL` under `environment:` in the same way.

### npm

Run `npx --yes proxyherd` instead of `npx --yes scrapoxy`, with the same environment variables plus
`FINGERPRINT_URL`.

### Kubernetes

Install the `proxyherd` chart as described in [Single Instance](/deployment/single-instance) or
[Simple Cluster](/deployment/simple-cluster). The chart has a new name, so Helm installs it as a new
release: its values go under `proxyherd:` (or `proxyherd-simple-cluster:`), and `fingerprintUrl` is required.

The new release starts with an empty volume. Copy the backup from step 1 into the commander pod, at the
new path, and restart the pod. Do it before anyone logs in to the new release: any change made there
rewrites the file.

```shell
kubectl cp config.json <commander pod>:/etc/proxyherd/config.json
kubectl delete pod <commander pod>
```

When everything works, uninstall the old Scrapoxy release.


## Step 4: Update your scrapers

Scrapers that only use the proxy endpoint (`http://username:password@host:8888`) need no change: Requests,
Puppeteer, Playwright, Selenium and the other integrations keep working as they are.

**Scrapy** projects that use the Python middlewares change the package and the middleware paths:

```shell
pip uninstall scrapoxy
pip install proxyherd
```

```python
DOWNLOADER_MIDDLEWARES = {
    'proxyherd.ProxyDownloaderMiddleware': 100,
    'proxyherd.BlacklistDownloaderMiddleware': 101,
}
```

The settings are now named `PROXYHERD_MASTER`, `PROXYHERD_API`, `PROXYHERD_USERNAME`, `PROXYHERD_PASSWORD`
and so on. The old `SCRAPOXY_*` names are still read when the new ones are missing, so you can rename them
later. See the [Scrapy guide](/integration/python/scrapy/guide).


## Step 5: Check

Open the user interface on port `8890`. Your projects and connectors are there, and proxies come online
within a minute or two. If every proxy stays offline, the proxies cannot reach the fingerprint service:
check its address and firewall as described in [Get Started](/intro/get-started).
