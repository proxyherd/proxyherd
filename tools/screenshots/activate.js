const BASE = `http://localhost:${process.env.COMMANDER_PORT || 8890}`;
const seed = require(process.argv[2]); const active = process.argv[3] === 'true';
let cookie = '';
async function call(method, path, body) {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const t = await res.text(); if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${t}`); return t;
}
(async () => {
  await call('POST', '/api/users/auths/local', { username: process.env.AUTH_LOCAL_USERNAME, password: process.env.AUTH_LOCAL_PASSWORD });
  await call('POST', `/api/frontend/projects/${seed.projectId}/connectors/${seed.connectorId}/activate`, { active });
  console.log('connector active =', active);
})().catch(e => { console.error(e.message); process.exit(1); });
