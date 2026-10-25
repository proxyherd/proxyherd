# Get Started

ProxyHerd runs as two services: the proxy manager itself, and a small [fingerprint service](/deployment/fingerprint)
that every proxy fetches to prove it is online and to report its location. The fingerprint service must be
reachable **from the proxies**, so it needs a **public address**. A `localhost` address can never work, because
the proxies are not on your machine. If the proxies cannot reach it, every proxy stays offline.

::: warning FINGERPRINT_URL is required
ProxyHerd refuses to start without `FINGERPRINT_URL`, the address of your fingerprint service. The quick start
below runs the service next to ProxyHerd and points `FINGERPRINT_URL` at the public address of the same machine.
:::


## With Docker Compose

Ensure that [Docker](https://www.docker.com) is installed on your computer.

Create a folder, and in it a file named `compose.yaml` with the following content:

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
    restart: unless-stopped
    depends_on:
      - fingerprint
    ports:
      - "8888:8888"   # proxy endpoint for your scrapers
      - "8890:8890"   # user interface and API
    environment:
      AUTH_LOCAL_USERNAME: admin
      AUTH_LOCAL_PASSWORD: password
      BACKEND_JWT_SECRET: secret1
      FRONTEND_JWT_SECRET: secret2
      STORAGE_FILE_FILENAME: /cfg/proxyherd.json
      # The public address of this machine, as the proxies see it. Not localhost.
      FINGERPRINT_URL: http://203.0.113.10:3000/api/json
    volumes:
      - cfg:/cfg

volumes:
  geoip:
  cfg:
```

Replace `admin`, `password`, `secret1` and `secret2` with your own values, and `203.0.113.10` with the public
IP address or hostname of the machine. Open port `3000/tcp` in its firewall or security group. Plain HTTP is
fine here: the answer carries nothing confidential, and HTTP is cheaper than HTTPS through proxies billed per gigabyte.

Open the **terminal** in that folder and run:

```shell
docker compose up -d
```

User interface is now running on http://localhost:8890 with `admin` as username and `password` as password.

Before adding proxies, check that the fingerprint service answers from outside, ideally **through one of your proxies**:

```shell
curl -x http://user:password@proxy-host:port http://203.0.113.10:3000/api/json
```

The answer is a JSON document whose `ip` field is the proxy's public address. If the request fails, fix the
address or the firewall first: ProxyHerd would mark every proxy offline.

::: tip Laptop, home network or office?
If the machine has no public IP address, the fingerprint service needs a temporary public hostname instead.
The fingerprint page explains how under [ProxyHerd on a laptop or behind NAT](/deployment/fingerprint#proxyherd-on-a-laptop-or-behind-nat).
No server at all? Use the [Cloudflare Worker](/deployment/fingerprint#option-b-cloudflare-worker) variant.
:::

::: warning Storage on Docker Desktop for macOS
Keep the configuration (`/cfg`) in a Docker named volume, as above, or in a folder on the internal disk.
Do not bind-mount it from an exFAT or FAT formatted external drive: ProxyHerd then logs
`Cannot write store: ENOENT` on every save, the configuration lives only in memory and is lost when the container restarts.
:::

:::tip
To upgrade ProxyHerd, run `docker compose pull` and then `docker compose up -d` again.
:::


## With NPM

Make sure that [Node.js](https://nodejs.org) is installed on your computer.

Start the fingerprint service first, on a machine with a public address. On first start it downloads its
GeoIP databases (about 150 MB) into a `geoip` folder next to where you run it:

```shell
npx --yes @proxyherd/fingerprint
```

Then start ProxyHerd with `FINGERPRINT_URL` pointing at that machine's public address, not `localhost`,
as in the Docker example above.

### On Linux

Open the **terminal** and run the following command:

```shell
AUTH_LOCAL_USERNAME=admin AUTH_LOCAL_PASSWORD=password BACKEND_JWT_SECRET=secret1 FRONTEND_JWT_SECRET=secret2 FINGERPRINT_URL=http://203.0.113.10:3000/api/json npx --yes proxyherd
```

Replace `admin`, `password`, `secret1`, `secret2` and `203.0.113.10` with your own values.


### On Windows

Open the **Command Prompt** and run the following command:

```shell
set AUTH_LOCAL_USERNAME=admin
set AUTH_LOCAL_PASSWORD=password
set BACKEND_JWT_SECRET=secret1
set FRONTEND_JWT_SECRET=secret2
set FINGERPRINT_URL=http://203.0.113.10:3000/api/json
npx --yes proxyherd
```

Replace `admin`, `password`, `secret1`, `secret2` and `203.0.113.10` with your own values.
