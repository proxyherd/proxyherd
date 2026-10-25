# Get Started

ProxyHerd runs as two services: the proxy manager itself, and a small [fingerprint service](/deployment/fingerprint)
that every proxy fetches to prove it is online and to report its location. The fingerprint service must be
reachable **from the proxies**, so it needs a **public address**. A `localhost` address can never work, because
the proxies are not on your machine. If the proxies cannot reach it, every proxy stays offline.

::: warning The fingerprint service needs a public address
ProxyHerd refuses to start until it knows where its fingerprint service is: `FINGERPRINT_URL` for a fixed public
address, or `FINGERPRINT_URL_DISCOVERY` when a tunnel assigns one at start. The two Compose files below cover
both cases: a server with a public IP address, and a laptop or any machine behind NAT.
:::


## With Docker Compose

Ensure that [Docker](https://www.docker.com) is installed on your computer.

Create a folder, and in it a file named `compose.yaml`. Pick the tab that matches your machine:

::: code-group

```yaml [Server with a public IP]
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

```yaml [Laptop or behind NAT]
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
    # Publishes the fingerprint service on a temporary public hostname (no account needed)
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

:::

Replace `admin`, `password`, `secret1` and `secret2` with your own values. Then:

- **Server with a public IP**: replace `203.0.113.10` with the public IP address or hostname of the machine and
  open port `3000/tcp` in its firewall or security group. Plain HTTP is fine here: the answer carries nothing
  confidential, and HTTP is cheaper than HTTPS through proxies billed per gigabyte.
- **Laptop or behind NAT**: nothing else to set. The `cloudflared` service publishes the fingerprint service on a
  temporary `*.trycloudflare.com` hostname, and ProxyHerd asks it for that hostname and follows it when it
  changes, so a reboot needs no action from you. Quick tunnels have no uptime guarantee: fine for a trial, not for
  production. Details on the [fingerprint page](/deployment/fingerprint#proxyherd-on-a-laptop-or-behind-nat).

Open the **terminal** in that folder and run:

```shell
docker compose up -d
```

User interface is now running on http://localhost:8890 with `admin` as username and `password` as password.

Before adding proxies, check that the fingerprint service answers from outside, ideally **through one of your proxies**:

```shell
curl -x http://user:password@proxy-host:port http://203.0.113.10:3000/api/json
```

On a laptop, `docker compose logs proxyherd | grep "Fingerprint address"` prints the address to check instead
of `http://203.0.113.10:3000/api/json`.

The answer is a JSON document whose `ip` field is the proxy's public address. If the request fails, fix the
address or the firewall first: ProxyHerd would mark every proxy offline.

::: tip No server at all?
The fingerprint service also runs as a [Cloudflare Worker](/deployment/fingerprint#option-b-cloudflare-worker):
nothing to host, a stable address, and a free plan that covers small installations.
:::

::: warning Storage on Docker Desktop for macOS
Keep the configuration (`/cfg`) in a Docker named volume, as above, or in a folder on the internal disk.
Do not bind-mount it from an exFAT or FAT formatted external drive: ProxyHerd then logs
`Cannot write store: ENOENT` on every save, the configuration lives only in memory and is lost when the container restarts.
:::

:::tip
To upgrade ProxyHerd, run `docker compose pull` and then `docker compose up -d` again.
:::

Already have a proxy subscription from a provider without a dedicated connector, for example Webshare? Load it through the [Proxy List connector](/connectors/freeproxies/guide#paid-proxy-lists-webshare-and-others).


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
