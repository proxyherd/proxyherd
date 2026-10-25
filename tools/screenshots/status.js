const BASE = `http://localhost:${process.env.COMMANDER_PORT || 8890}`;
const seed = require(process.argv[2]);
let cookie = '';
async function call(method, path, body) {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const t = await res.text(); if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${t}`); try { return JSON.parse(t); } catch { return t; }
}
(async () => {
  await call('POST', '/api/users/auths/local', { username: process.env.AUTH_LOCAL_USERNAME, password: process.env.AUTH_LOCAL_PASSWORD });
  const conns = await call('GET', `/api/frontend/projects/${seed.projectId}/connectors`);
  for (const c of conns) {
    const proxies = c.proxies || [];
    const online = proxies.filter(p => p.fingerprint).length;
    console.log(`connector ${c.connector?.name || c.name}: active=${c.connector?.active} proxies=${proxies.length} fingerprinted=${online} status=${JSON.stringify(proxies.slice(0,3).map(p=>({s:p.status, f:!!p.fingerprint, ip:p.fingerprint?.ip})))}`);
  }
  const sf = await call('GET', `/api/frontend/projects/${seed.projectId}/connectors/${seed.connectorId}/sourcesfreeproxies`);
  const fp = sf.freeproxies || [];
  console.log(`sources=${(sf.sources||[]).length} pool=${fp.length} pool fingerprinted=${fp.filter(p=>p.fingerprint).length}`);
})().catch(e => { console.error(e.message); process.exit(1); });
