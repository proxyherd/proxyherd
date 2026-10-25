# Documentation screenshots

Retakes the screenshots of the User Interface page (`packages/website/intro`) and of the
Proxy List guide (`packages/website/connectors/freeproxies`) from a ProxyHerd running on this
machine, and draws the numbered callouts the text refers to. Requires Google Chrome and Node.js 20.

## 1. Run ProxyHerd from the build

The fingerprint service must be reachable from the proxies, so use a public address (see the
[fingerprint page](https://proxyherd.github.io/proxyherd/deployment/fingerprint)). Ports 9890/9888
keep clear of a Docker instance on 8888/8890.

```shell
npx nx run-many --target=build
export COMMANDER_PORT=9890 MASTER_PORT=9888 PROBE_PORT=9887 NODE_ENV=production
export AUTH_LOCAL_USERNAME="Rakesh Jana" AUTH_LOCAL_PASSWORD=$(openssl rand -hex 8)
export BACKEND_JWT_SECRET=$(openssl rand -hex 16) FRONTEND_JWT_SECRET=$(openssl rand -hex 16)
export STORAGE_FILE_FILENAME=/tmp/proxyherd-shots.json ASSETS_PATH=$PWD/dist/proxyherd/assets
export FINGERPRINT_URL=http://<public address>:3000/api/json PROXY_REFRESH_DELAY=20000 FREEPROXY_REFRESH_DELAY=20000
node dist/proxyherd/proxyherd.js start --standalone
```

## 2. Seed and capture

In a second shell with the same variables exported:

```shell
cd tools/screenshots && npm install
node seed.js seed.json          # project "My Project", a Proxy List credential and connector, a free list source
node plans.js seed.json plans   # writes plans/*.json from the ids in seed.json
# wait a few minutes for proxies to come online, then send some requests through localhost:9888
# with the token printed by seed.js (base64 of username:password) so that counters are not zero
node capture.js plans/intro.json out            # connector running
node capture.js plans/guide.json out
node activate.js seed.json false                 # stop the connector
node capture.js plans/intro-stopped.json out
node capture.js plans/guide-stopped.json out
node activate.js seed.json true
```

Copy the files from `out/` over the images of the same name. `status.js seed.json` shows how many
proxies are online. The connector `freeproxies` and the credential form of `zyte` are used because
they need no provider account; other connector guides can be captured the same way by adding plans
that open `/projects/<id>/credentials/create/<connector>`.

## Plan format

Each entry of a plan is one image: `name`, `path`, optional `clip` (CSS selector, with `pad`,
`padTop`), `width`/`height`/`scale` of the viewport, `wait`, `actions` (`click`, `hover`, `type`,
`select`, `selectIndex`, `style`, `wait`) and `overlays`: numbered circles (`type: num` with `n`,
`selector`, `index`, `pos` left/right/top/bottom/top-left/corner/inside-left/inside-right, `dx`, `dy`)
and boxes (`type: box` with `selector`, `until`, `pad`, `label`, `labelPos`). `preLogin: true`
captures a screen before signing in.
