# Single instance with file storage Deployment

::: warning FINGERPRINT_URL is required
ProxyHerd refuses to start without `FINGERPRINT_URL`, the address of your [fingerprint service](fingerprint). The service must be reachable from the proxies themselves, so it needs a public address. The commands below use `https://fingerprint.example.com/api/json` as a placeholder; replace it with the address of your service (in Helm, the value is `fingerprintUrl`). On a machine without a public address, use `FINGERPRINT_URL_DISCOVERY` instead, as described under [laptop or behind NAT](fingerprint#proxyherd-on-a-laptop-or-behind-nat).
:::

This deployment runs a single container that encapsulates all components, including the storage, within a single file.


## Docker

The container image is published on GitHub Container Registry: [ghcr.io/proxyherd/proxyherd](https://github.com/proxyherd/proxyherd/pkgs/container/proxyherd).


### Volume

Start ProxyHerd with a volume for the configuration file:

```shell
docker run -d -p 8888:8888 -p 8890:8890 \
  -e AUTH_LOCAL_USERNAME=admin -e AUTH_LOCAL_PASSWORD=password \
  -e BACKEND_JWT_SECRET=secret1 -e FRONTEND_JWT_SECRET=secret2 \
  -e FINGERPRINT_URL=https://fingerprint.example.com/api/json \
  -e STORAGE_FILE_FILENAME=/etc/proxyherd/config.json \
  -v ./proxyherd:/etc/proxyherd \
  ghcr.io/proxyherd/proxyherd
```

:::info
The file `./proxyherd/config.json` contains the configuration on the host machine.
:::

::: warning Docker Desktop on macOS
Keep this folder on the internal disk, or use a Docker named volume instead (`-v proxyherd-cfg:/etc/proxyherd`). A bind mount from an exFAT or FAT formatted external drive fails silently: ProxyHerd logs `Cannot write store: ENOENT` on every save, the configuration lives only in memory, and it is lost when the container restarts.
:::


### Production mode

To limit the log level, set the environment variable `NODE_ENV` to `production`:

```shell
docker run -d -p 8888:8888 -p 8890:8890 \
  -e AUTH_LOCAL_USERNAME=admin -e AUTH_LOCAL_PASSWORD=password \
  -e BACKEND_JWT_SECRET=secret1 -e FRONTEND_JWT_SECRET=secret2 \
  -e FINGERPRINT_URL=https://fingerprint.example.com/api/json \
  -e NODE_ENV=production \
  ghcr.io/proxyherd/proxyherd
```


## Docker Compose

Edit `docker-compose.yml` with the following content:

```yaml
version: '3'

services:
  proxyherd:
    image: ghcr.io/proxyherd/proxyherd
    ports:
      - 8888:8888
      - 8890:8890
    environment:
      - NODE_ENV=production
      - AUTH_LOCAL_USERNAME=admin
      - AUTH_LOCAL_PASSWORD=password
      - BACKEND_JWT_SECRET=secret1
      - FRONTEND_JWT_SECRET=secret2
      - FINGERPRINT_URL=https://fingerprint.example.com/api/json
      - STORAGE_FILE_FILENAME=/etc/proxyherd/config.json
    volumes:
      - ./proxyherd:/etc/proxyherd
```

The same storage note applies: on Docker Desktop for macOS, keep `./proxyherd` on the internal disk or replace the bind mount with a named volume.

Run the following command:

```shell
docker compose up -d
```


## Kubernetes with Helm

Create an umbrella chart with Helm with the following files structure:

```
myproxyherd/
|- Chart.yaml
|- values.yaml
```

Edit `Chart.yaml` with the following content:

```yaml
apiVersion: v2
name: proxyherd
description: ProxyHerd Single Instance
type: application
version: 1.0.0
appVersion: latest
dependencies:
    -   name: proxyherd
        version: 1.0.1
        repository: oci://ghcr.io/proxyherd/charts
```

Edit `values.yaml` with the following content:

```yaml
proxyherd:
    auth:
        local:
            username: "admin"
            password: "password"

    backendJwtSecret: "secret1"
    frontendJwtSecret: "secret2"
```

Build dependencies:

```shell
helm dependency build ./myproxyherd
```

Install the chart:

```shell
helm install proxyherd ./myproxyherd
```
