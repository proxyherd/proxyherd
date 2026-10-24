# Python API for ProxyHerd

Scrapy middlewares and a small REST client for [ProxyHerd](https://proxyherd.github.io/proxyherd/),
the open-source super proxy manager.

```shell
pip install proxyherd
```

Documentation: https://proxyherd.github.io/proxyherd/integration/python/scrapy/guide

## Migrating from the `scrapoxy` package

`proxyherd` is the continuation of the `scrapoxy` Python package (community fork of Scrapoxy 4.17.4).
The module `proxyherd` exposes the same middlewares; the settings are now prefixed `PROXYHERD_`
(`PROXYHERD_MASTER`, `PROXYHERD_API`, `PROXYHERD_USERNAME`, `PROXYHERD_PASSWORD`, ...).
The old `SCRAPOXY_` settings and the `scrapoxy` module keep working as deprecated aliases.
