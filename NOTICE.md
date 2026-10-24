# Notice of Origin

**ProxyHerd** is a community-maintained fork of **Scrapoxy**
(https://github.com/scrapoxy/scrapoxy), created by Fabien Vauchelles.

## Base commit

| Field            | Value                                                      |
|------------------|------------------------------------------------------------|
| Upstream commit  | `5bb685f7ab89685421c18fd006ffaa5021b8f0b6`                 |
| Commit date      | 2024-12-12                                                 |
| Upstream version | 4.17.4                                                     |
| Licence at base  | MIT (see `LICENCE.md`)                                     |

This is the last upstream commit published under the MIT licence. The very next
upstream commit (`248b5a95587a07334de9615f9b469c91f319a693`, 2024-12-13,
"chore(licence): change licence from MIT to AGPLv3") relicensed the project
under AGPL-3.0, and from 2025-06-05 upstream became proprietary
("CoreDump Engineering, all rights reserved"). **No code from any commit after
the base commit above is included here, and none may be merged in.**

The full upstream git history up to the base commit (660 commits, 2015-08-31 to
2024-12-12) is preserved unchanged in this repository as provenance. Upstream
later force-pushed its history away; the commits were recovered from the public
GitHub fork network (notably `adewin/scrapoxy` and `jeanhackpy/scrapoxy`).

## Copyright

Original work Copyright (c) 2016-2024 Fabien Vauchelles, licensed under the
MIT License. The MIT licence text and copyright notice are retained in
`LICENCE.md` as required by that licence.

Modifications made in this repository after the base commit are contributed
under the MIT License as well unless a file states otherwise, and are
copyright their respective authors (see the git history and the
`Signed-off-by` lines).

## Compatibility identifiers kept from Scrapoxy

A few identifiers that travel on the wire keep their original values so that
existing scrapers and existing cloud deployments keep working: the
`X-Scrapoxy-*` HTTP headers, the `scrapoxy-proxyname` sticky-session cookie,
the `scrapoxy` prefix of cloud resources, and the storage defaults (file
`scrapoxy.json`, MongoDB database `scrapoxy`, RabbitMQ queues `scrapoxyorders`
and `scrapoxyevents`). The prefixes are defined in `packages/common/src/info.ts`. They are
compatibility names, not branding.

## Trademark

"Scrapoxy" is a trademark of the original author (registered in France,
INPI no. 5031757). ProxyHerd is not affiliated with, endorsed by, or supported
by the original author or CoreDump Engineering. The name Scrapoxy is used in
this repository only to describe the origin of the code and compatibility
with it. Do not use the upstream npm packages, Docker images or hosted
services released after 2025-06-05 with this code; they are under a different
licence, and the hosted fingerprint service has been shut down.
