# Cluster with file storage Deployment

::: warning FINGERPRINT_URL is required
ProxyHerd refuses to start without `FINGERPRINT_URL`, the address of your [fingerprint service](fingerprint). Add `-e FINGERPRINT_URL=https://fingerprint.example.com/api/json` to the commands below, or the equivalent in Compose or Helm (`fingerprintUrl`).
:::

This deployment consists of 3 instances:
- 1 Commander instance with file storage;
- 1 Master instance;
- 1 Refresh instance.

For additional details, refer to the [Architecture](/architecture/overview) section.

::: warning
Use a separate instance for running ProxyHerd at scale.
Don’t run **VPNs** or **complicated network setups** on the same machine, 
as this can cause connection problems, especially when scaling up.
:::

## Docker Compose

Edit `docker-compose.yml` with the following content:

```yaml
services:
    commander:
        image: ghcr.io/proxyherd/proxyherd
        command: "node proxyherd.js start -f -c --storage file"
        ports:
            - 8890:8890
        environment:
            - NODE_ENV=production
            - AUTH_LOCAL_USERNAME=admin
            - AUTH_LOCAL_PASSWORD=password
            - BACKEND_JWT_SECRET=secret1
            - FRONTEND_JWT_SECRET=secret2
            - STORAGE_FILE_FILENAME=/etc/proxyherd/config.json
        volumes:
            - ./proxyherd:/etc/proxyherd

    master:
        image: ghcr.io/proxyherd/proxyherd
        command: "node proxyherd.js start -m"
        ports:
            - 8888:8888
        environment:
            - NODE_ENV=production
            - COMMANDER_URL=http://commander:8890/api
            - BACKEND_JWT_SECRET=secret1
        links:
            - commander

    refresh:
        image: ghcr.io/proxyherd/proxyherd
        command: "node proxyherd.js start -r"
        environment:
            - NODE_ENV=production
            - COMMANDER_URL=http://commander:8890/api
            - BACKEND_JWT_SECRET=secret1
        links:
            - commander
```

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
name: proxyherd-simple-cluster
description: ProxyHerd Simple Cluster
type: application
version: 1.0.0
appVersion: latest
dependencies:
    -   name: proxyherd-simple-cluster
        version: 1.0.1
        repository: oci://ghcr.io/proxyherd/charts
```

Edit `values.yaml` with the following content:

```yaml
proxyherd-simple-cluster:
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
