<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/proxyherd/proxyherd/main/packages/website/public/assets/images/proxyherd-lockup-dark.svg">
    <img alt="ProxyHerd" src="https://raw.githubusercontent.com/proxyherd/proxyherd/main/packages/website/public/assets/images/proxyherd-lockup.svg" width="420">
  </picture>
</p>

<p align="center"><b>One endpoint for every proxy.</b> Open-source super proxy manager.</p>

<p align="center">
  <a href="https://proxyherd.github.io/proxyherd/">Documentation</a> ·
  <a href="https://github.com/proxyherd/proxyherd/discussions">Discussions</a> ·
  <a href="https://github.com/proxyherd/proxyherd/issues">Issues</a>
</p>

---

ProxyHerd orchestrates all your proxies from one place instead of spreading
proxy logic across every scraper. Deployed on your own infrastructure, it is
the **single proxy endpoint** your scrapers talk to. It builds a pool of
private proxies from your cloud accounts, plugs in proxy vendors, checks
every proxy's health and location, rotates IP addresses, keeps sessions
sticky for browsers, and routes traffic to avoid bans.

ProxyHerd is forked from **Scrapoxy 4.17.4**, the last release published under
the MIT licence, and nothing from later versions is included. [NOTICE.md](NOTICE.md)
records the provenance. The project continues after Scrapoxy's original author
discontinued it, and is not affiliated with, endorsed by, or supported by the
original author or CoreDump Engineering. Coming from Scrapoxy? Follow the
[migration guide](https://proxyherd.github.io/proxyherd/intro/migrate).

## Features

- **Cloud providers**: AWS, Azure, GCP, DigitalOcean and OVH. ProxyHerd installs a proxy image on each instance, starts and stops instances to rotate addresses, and scales the pool with your traffic.
- **Proxy vendors**: Bright Data, Smartproxy, IPRoyal, Zyte, Rayobyte, Proxy-Seller, NetNut, Proxy-Cheap, Geonode, HypeProxy, Live Proxies, Nimble, Ninjas Proxy, Proxyrack and more, with country and OS selection where the vendor supports it.
- **Hardware**: 4G proxy farms such as Proxidize and XProxy, with IP rotation through their APIs.
- **Proxy lists**: plain HTTP, HTTPS, SOCKS4 and SOCKS5 lists, tested for connectivity before use.
- **Health checks and geo data** from a fingerprint service: the shared one to start, or your own so that no data leaves your infrastructure. Offline or slow proxies are removed from the pool automatically.
- **Auto-rotation** of IP addresses at the interval you choose, and **auto-scaling** of the pool to match incoming traffic.
- **Sticky sessions**, including for headless browsers, by intercepting requests and injecting a session cookie.
- **Ban management**: the proxy name is injected into every response, so a scraper that detects a ban can ask ProxyHerd to drop that proxy.
- **Traffic interception** to add or rewrite headers and keep your scraping stack consistent.
- **Monitoring**: requests, active proxies, per-proxy metrics and a world map of your coverage.
- **Production ready**: one container to start, or a distributed deployment on Kubernetes with the Helm charts.

## Quick start

One container is enough to start:

```shell
docker run -d --name proxyherd --restart unless-stopped \
  -p 8888:8888 -p 8890:8890 -v proxyherd:/cfg \
  -e AUTH_LOCAL_USERNAME=admin -e AUTH_LOCAL_PASSWORD=password \
  -e BACKEND_JWT_SECRET=secret1 -e FRONTEND_JWT_SECRET=secret2 \
  -e STORAGE_FILE_FILENAME=/cfg/proxyherd.json \
  ghcr.io/proxyherd/proxyherd
```

Replace `admin`, `password`, `secret1` and `secret2` with your own values and
open http://localhost:8890. Your scrapers connect to port 8888.

Every proxy fetches a fingerprint service to prove it is online. Out of the
box ProxyHerd uses the shared service run by the project, which is best effort
and rate limited per IP address: fine for a trial or a small pool. For
production, run your own on a server, behind NAT with a tunnel, or as a
Cloudflare Worker, and set `FINGERPRINT_URL`; see the
[fingerprint page](https://proxyherd.github.io/proxyherd/deployment/fingerprint).
The [documentation](https://proxyherd.github.io/proxyherd/intro/get-started)
also covers npm and Kubernetes.

## Compatibility with Scrapoxy 4.17.4

ProxyHerd 1.0 reads the same configuration, storage and REST API as
Scrapoxy 4.17.4, so an existing installation can be upgraded in place. The
wire identifiers that scrapers depend on are unchanged on purpose:

- the `X-Scrapoxy-*` response and request headers, including `X-Scrapoxy-Proxyname`;
- the `scrapoxy-proxyname` sticky-session cookie;
- the `scrapoxy` prefix of cloud resources, so existing instances are found and reused.

The npm package, binary, container image, Helm charts and Python package are
named `proxyherd`. The hosted fingerprint service the original project
depended on no longer exists: ProxyHerd uses a shared service run by the
project by default, and you can run your own. The [migration guide](https://proxyherd.github.io/proxyherd/intro/migrate)
lists every step.

## Contributing

Bug reports, feature requests and pull requests are welcome. Read the
[contribution guidelines](https://proxyherd.github.io/proxyherd/contrib/guidelines)
first. Contributions are accepted under the
[Developer Certificate of Origin](https://proxyherd.github.io/proxyherd/contrib/licence):
sign your commits off with `git commit -s`.

Questions and ideas go to [GitHub Discussions](https://github.com/proxyherd/proxyherd/discussions).

## Security

Please report vulnerabilities privately, not in public issues. See
[SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENCE.md). ProxyHerd includes work copyright © 2016-2024 Fabien
Vauchelles, the author of Scrapoxy, under the same licence. Scrapoxy is a
trademark of its author; the name is used here only to describe the origin of
this project.
