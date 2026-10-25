# Environment variables

## Security

### Commander

- `BACKEND_JWT_SECRET` : Secret of the JWT used for internal connections.
- `BACKEND_JWT_EXPIRATION` : Duration of the JWT for internal connections. The default value is `60s`.


### User interface

- `FRONTEND_JWT_SECRET` : Secret of the JWT used for users connections.
- `FRONTEND_JWT_EXPIRATION` : Duration of the JWT for users connections. The default value is `24h`.
- `FRONTEND_SECURE_COOKIE` : Enable the secure flag on the authentication cookie by setting it to `1`, especially if the ProxyHerd UI is located behind an SSL reverse proxy like [Nginx](https://www.nginx.com). The default value is `0`.


:::warning
To start ProxyHerd, it is mandatory to set the secrets `BACKEND_JWT_SECRET` and `FRONTEND_JWT_SECRET`.
:::


## Network

### Commander

- `COMMANDER_PORT` : Port of the Commander API. The default value is `8890`.
- `COMMANDER_URL` : Commander exposed API URL. It is required if using a distributed configuration. The default value is `http://localhost:COMMANDER_PORT/api`.


### User interface

- `FRONTEND_URL` : Default URL of the frontend, used for authentication. The default value is `http://localhost:8890`.


### Master

- `MASTER_PORT` : Port of the Master. The default value is `8888`.
- `MASTER_TIMEOUT` : Timeout in milliseconds when the Master relays a request to a proxy endpoint. The default value is `60000` (1 minute).
- `MASTER_CERTIFICATE_CERT` : Certificate to activate TLS support on the Master
- `MASTER_CERTIFICATE_KEY` : Secret key of the certificate. Both values must be set to activate TLS.


### Probe

- `PROBE_PORT` : Port of the probe that checks if storage is alive. The default value is `8887`.


### Fingerprint

- `FINGERPRINT_URL` : URL of your ProxyHerd fingerprint service, for example `https://fingerprint.example.com/api/json`. **Required** unless `FINGERPRINT_URL_DISCOVERY` is set: there is no default, because the service must be reachable from the public internet through your proxies. See the [fingerprint service](/deployment/fingerprint) page.
- `FINGERPRINT_URL_DISCOVERY` : Endpoint that ProxyHerd asks for the address of the fingerprint service when a tunnel assigns it at start, for example `http://cloudflared:2000/quicktunnel` next to a Cloudflare quick tunnel. ProxyHerd reads it from its own network (not through the proxies) at start and then every `FINGERPRINT_URL_DISCOVERY_DELAY` milliseconds, and switches to the new address as soon as the answer changes. The answer is a JSON document with either a `url`, used as is, or a `hostname`, turned into `https://<hostname>/api/json`. When set, `FINGERPRINT_URL` is optional and only used until the first answer. See [ProxyHerd on a laptop or behind NAT](/deployment/fingerprint#proxyherd-on-a-laptop-or-behind-nat).
- `FINGERPRINT_URL_DISCOVERY_DELAY` : Milliseconds between two reads of `FINGERPRINT_URL_DISCOVERY`. The default value is `10000` (10 seconds).
- `FINGERPRINT_FOLLOW_REDIRECT_MAX` : Max number of HTTP redirects allowed when requesting the fingerprint server. The default value is `3`.
- `FINGERPRINT_RETRY_MAX` : Maximum retries before stating a proxy or freeproxy are inaccessible. The default value is `2`.
- `FINGERPRINT_TIMEOUT` : Timeout in milliseconds of request when requesting the fingerprint server. The default value is `5000` (5 seconds).
- `FINGERPRINT_SEND_STATS` : Also send the installation id and traffic counters with every check, for your own service's logs. The default value is `false`.


### Man-in-the-middle

- `MITM_CERTIFICATE_DURATION` : Duration in milliseconds of generated website TLS certificates. The default value is `31536000000` (1 year).


## Authentication

### Username/password

To activate basic authentication, set all the following environment variables:

- `AUTH_LOCAL_USERNAME` : Username
- `AUTH_LOCAL_PASSWORD` : Password


### Github

To activate Github OAuth authentication, set all the following environment variables:

- `AUTH_GITHUB_CLIENT_ID` : Github Client ID
- `AUTH_GITHUB_SECRET` : Github Secret
- `AUTH_GITHUB_CALLBACK_URL` : Callback URL. The default value is `FRONTEND_URL/api/users/auths/github`.


### Google

To activate Google OAuth authentication, set all the following environment variables:

- `AUTH_GOOGLE_CLIENT_ID` : Google Client ID
- `AUTH_GOOGLE_SECRET` : Google Secret
- `AUTH_GOOGLE_CALLBACK_URL` : Callback URL. The default value is `FRONTEND_URL/api/users/auths/google`.


## Storage

### File

If you are using file storage, configure the following environment variables:

- `STORAGE_FILE_FILENAME` : Filename of the local configuration file. The default value is `scrapoxy.json`.
- `STORAGE_FILE_CERTIFICATES_MAX` : Maximum number of TLS certificates cached in memory for file storage. The default value is `1000`.


### Distributed

If you are using distributed storage, configure the following environment variables:
 
_For MongoDB:_
 
- `STORAGE_DISTRIBUTED_MONGO_URI` : URI of MongoDB server. The default value is `mongodb://user:password@localhost`.
- `STORAGE_DISTRIBUTED_MONGO_DB` : Name of MongoDB database. The default value is `scrapoxy`.
- `STORAGE_DISTRIBUTED_MONGO_CERTIFICATES_SZ` : Maximum size in bytes of TLS certificates cached in MongoDB. The default value is `268435456` (256 MB).

_For RabbitMQ:_
 
- `STORAGE_DISTRIBUTED_RABBITMQ_URL` : URL of RabbitMQ server. The default value is `amqp://user:password@localhost:5672`.
- `STORAGE_DISTRIBUTED_RABBITMQ_QUEUE_ORDERS` : Queue of RabbitMQ to send CQRS orders. The default value is `scrapoxyorders`.
- `STORAGE_DISTRIBUTED_RABBITMQ_QUEUE_EVENTS` : Queue of RabbitMQ to receive CQRS events. The default value is `scrapoxyevents`.


## Refresh

### Connectors

- `CONNECTORS_REFRESH_EMPTY_DELAY` : Delay in milliseconds to wait if there is no connector to refresh. The default value is `1000` (1 second).
- `CONNECTORS_REFRESH_ERROR_DELAY` : Delay in milliseconds to wait if connector's refresh triggers an error. The default value is `2000` (2 seconds).


### Proxies


- `PROXY_REFRESH_COUNT` : Number of proxies to fingerprint at once. The default value is `1000`.
- `PROXY_REFRESH_DELAY` : Delay in milliseconds before a proxy is fingerprinted again. The default value is `60000` (1 minute). Scrapoxy and ProxyHerd 1.0.0 used `1000`, a check every few seconds per proxy; set it back for free proxy lists that die quickly, see [Sizing](/deployment/fingerprint#sizing-and-proxy-traffic).
- `PROXIES_REFRESH_EMPTY_DELAY` : Delay in milliseconds to wait if there is no proxy to refresh. The default value is `1000` (1 second).
- `PROXIES_REFRESH_ERROR_DELAY` : Delay in milliseconds to wait if proxy's refresh triggers an error. The default value is `2000` (2 seconds).


### Freeproxies

- `FREEPROXY_REFRESH_COUNT` : Number of freeproxies to fingerprint at once. The default value is `5000`.
- `FREEPROXY_REFRESH_DELAY` : Delay in milliseconds before a freeproxy of the pool is fingerprinted again. The default value is `60000` (1 minute); it was `1000` before 1.0.1.
- `FREEPROXIES_REFRESH_EMPTY_DELAY` : Delay in milliseconds to wait if there is no freeproxy to refresh. The default value is `1000` (1 second).
- `FREEPROXIES_REFRESH_ERROR_DELAY` : Delay in milliseconds to wait if freeproxy's refresh triggers an error. The default value is `2000` (2 seconds).


### Metrics
 
- `MASTER_REFRESH_METRICS_DELAY` : Delay interval in milliseconds to send traffic metrics of the Master to the Commander API. The default value is `10000` (10 seconds).
- `METRICS_REFRESH_REFRESH_DELAY` : Delay interval in milliseconds to calculate metrics of all projects. The default value is `10000` (10 seconds).


### Tasks

- `TASKS_REFRESH_EMPTY_DELAY` : Delay in milliseconds to wait if there is no task to execute. The default value is `1000` (1 second).
- `TASKS_REFRESH_ERROR_DELAY` : Delay in milliseconds to wait if task's execution triggers an error. The default value is `2000` (2 seconds).


### Stopping ProxyHerd

- `CLEAR_AT_SHUTDOWN` : Clear all proxies at shutdown. Values are `1` for yes and `0` for no. This is useful when you run ProxyHerd locally. The default value is `0`.
- `STOPPING_DELAY` : Delay in milliseconds between queries count of active proxies during shutdown. It is only available if `CLEAR_AT_SHUTDOWN` is active. The default value is `2000` (2 seconds).
