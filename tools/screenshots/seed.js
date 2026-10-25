// Seeds the local ProxyHerd instance: project, Proxy List credential + connector, a free list source.
const BASE = `http://localhost:${process.env.COMMANDER_PORT || 8890}`;
const USER = process.env.AUTH_LOCAL_USERNAME, PASS = process.env.AUTH_LOCAL_PASSWORD;
let cookie = '';
async function call(method, path, body) {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}
(async () => {
  await call('POST', '/api/users/auths/local', { username: USER, password: PASS });
  const me = await call('GET', '/api/users/me');
  console.log('logged in as', me.name);
  let projects = await call('GET', '/api/frontend/projects');
  let project = projects.find(p => p.name === 'My Project');
  if (!project) {
    project = await call('POST', '/api/frontend/projects', {
      name: 'My Project',
      autoRotate: { enabled: true, min: 300000, max: 600000 },
      autoScaleUp: true,
      autoScaleDown: { enabled: true, value: 600000 },
      cookieSession: true, mitm: false, proxiesMin: 1, useragentOverride: false, ciphersShuffle: false,
    });
    console.log('project created', project.id);
  }
  const pid = project.id;
  let creds = await call('GET', `/api/frontend/projects/${pid}/credentials`);
  let cred = creds.find(c => c.name === 'Proxy List Credential');
  if (!cred) { cred = await call('POST', `/api/frontend/projects/${pid}/credentials`, { name: 'Proxy List Credential', type: 'freeproxies', config: {} }); console.log('credential created', cred.id); }
  let connectors = await call('GET', `/api/frontend/projects/${pid}/connectors`);
  let conn = connectors.map(c => c.connector || c).find(c => c.name === 'Proxy List Connector');
  if (!conn) {
    conn = await call('POST', `/api/frontend/projects/${pid}/connectors`, {
      name: 'Proxy List Connector', credentialId: cred.id, proxiesMax: 10,
      proxiesTimeoutDisconnected: 5000, proxiesTimeoutUnreachable: { enabled: true, value: 600000 }, certificateDurationInMs: 31536000000,
      config: { freeproxiesTimeoutDisconnected: 5000, freeproxiesTimeoutUnreachable: { enabled: true, value: 1800000 } },
    });
    console.log('connector created', conn.id);
    await call('POST', `/api/frontend/projects/${pid}/connectors/${conn.id}/sources`, [
      { url: 'https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&proxy_format=protocolipport&format=text', delay: 3600000 },
    ]);
    console.log('source added');
  }
  await call('POST', `/api/frontend/projects/${pid}/status`, { status: 'HOT' });
  await call('POST', `/api/frontend/projects/${pid}/connectors/${conn.id}/activate`, { active: true });
  await call('POST', `/api/frontend/projects/${pid}/default`, { connectorDefaultId: conn.id });
  const token = await call('GET', `/api/frontend/projects/${pid}/token`);
  console.log(JSON.stringify({ projectId: pid, credentialId: cred.id, connectorId: conn.id, token: token.token }));
  require('fs').writeFileSync(process.argv[2], JSON.stringify({ projectId: pid, credentialId: cred.id, connectorId: conn.id, token: token.token }, null, 2));
})().catch(e => { console.error(e.message); process.exit(1); });
