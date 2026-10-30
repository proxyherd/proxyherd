# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub:
[report a vulnerability](https://github.com/proxyherd/proxyherd/security/advisories/new).
Do not open a public issue, discussion or pull request for a security problem.

A useful report includes the ProxyHerd version, how it is deployed (Docker,
npm, Helm), the steps to reproduce, and what an attacker could do with it.

## What to expect

ProxyHerd is maintained by volunteers. We aim to acknowledge a report within a
week, to keep you informed until a fix is released, and to publish a GitHub
security advisory with the fix. Reporters are credited in the advisory unless
they prefer otherwise.

## Supported versions

Security fixes go into the latest release only. Please check that the problem
still exists in the latest release before reporting it.

## Scope

In scope: everything in this repository, that is the proxy manager, the user
interface, the fingerprint service, the Helm charts, the Python client and the
container images built from it.

Out of scope: Scrapoxy releases and services of the original project, and the
services of proxy vendors and cloud providers that ProxyHerd connects to.

## Known issues

- **Shared MITM certificate.** Every installation ships the same CA certificate,
  inherited from Scrapoxy, and its private key is public in this repository.
  Trust it only in the scrapers and browsers that send traffic through
  ProxyHerd. See the
  [warning in the documentation](https://proxyherd.github.io/proxyherd/intro/ui#project-settings).
  A CA generated for each installation is planned; no need to report this one.
