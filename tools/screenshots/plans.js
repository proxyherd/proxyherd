// Writes the capture plans for capture.js, from the ids seed.js stored in seed.json.
//   node plans.js seed.json plans/
// Plans: intro.json (User Interface page, connector active), intro-stopped.json (connector stopped),
//        guide.json (Proxy List guide, connector active), guide-stopped.json (connector stopped).
const fs = require('fs');
const path = require('path');
const seed = require(path.resolve(process.argv[2]));
const outDir = process.argv[3] || 'plans';
const P = `/projects/${seed.projectId}`;
const num = (n, selector, pos, extra) => ({ type: 'num', n, selector, pos, ...(extra || {}) });

const layoutOverlays = [
  { type: 'box', selector: 'c-sidebar', pad: 3, label: 'SIDEBAR', labelPos: 'bottom-left', labelDy: -120 },
  { type: 'box', selector: 'app-layout-header', until: '.header', pad: 3, label: 'HEADER', labelPos: 'center' },
  { type: 'box', selector: '.container-main', pad: 3, label: 'CENTRAL AREA', labelPos: 'center' },
];
const proxyRow = {
  name: 'proxy_details', path: `${P}/proxies`, clip: 'table tbody tr', pad: 8, padTop: 46, scale: 2,
  actions: [{ style: 'table thead, table thead * { visibility: hidden !important; }' }, { wait: 300 }],
  overlays: ['col-connector-name', 'col-proxy-name', 'col-proxy-address', 'col-proxy-status', 'col-proxy-bytes-received', 'col-proxy-bytes-sent', 'col-proxy-requests', 'col-proxy-uptime']
    .map((c, i) => num(i + 1, `tbody tr:first-child td.${c}`, i < 3 ? 'top-left' : 'top'))
    .concat([num(9, 'tbody tr:first-child td.col-actions button', 'top')]),
};

const intro = [
  { name: 'login', path: '/login', preLogin: true, clip: '.page c-container', pad: 60 },
  { name: 'layout', path: `${P}/proxies`, overlays: layoutOverlays },
  { name: 'project_settings', path: `${P}/update`, height: 1200, clip: 'form c-card', pad: 10, overlays: [
      num(1, '#name'), num(2, '#username'), num(3, '#password'), num(4, '[ctooltip="Renew token"]', 'bottom'),
      num(5, '#proxiesMin'), num(6, '#autoRotate'), num(7, '#autoScaleUp'), num(8, '#autoScaleDown'),
      num(9, '#mitm'), num(10, 'a[href="/api/certificate/ca"]'), num(11, '#cookieSession'), num(12, '#useragentOverride'), num(13, '#ciphersShuffle')] },
  { name: 'project_settings_menu', path: `${P}/update`, height: 760, overlays: [{ type: 'box', selector: 'a.nav-link[href$="/update"]', pad: 2 }] },
  { name: 'projects_list', path: '/projects/view', clip: '.container-main', pad: 12 },
  { name: 'marketplace', path: `${P}/marketplace`, overlays: [
      num(1, 'a.nav-link[href$="/marketplace"]', 'inside-right', { dx: -8 }), num(2, 'c-input-group.main input', 'inside-right', { dx: -8 }),
      num(3, '.provider-field.field-single .field-value', 'right'), num(4, '.provider-buttons a.btn', 'right')] },
  { name: 'credential_create', path: `${P}/credentials/create/zyte`, clip: 'form c-card', pad: 10, overlays: [num(1, '.connector-image img'), num(2, '#name'), num(3, '#credentialType')] },
  { name: 'credentials_list', path: `${P}/credentials`, clip: '.container-main c-card', pad: 12 },
  { name: 'credential_update', path: `${P}/credentials/${seed.credentialId}/update`, clip: 'form c-card', pad: 10, overlays: [
      num(1, 'c-card-footer button', 'top', { index: 0 }), num(2, 'c-card-footer button', 'top', { index: 1 })] },
  { name: 'connector_create', path: `${P}/connectors/create`, clip: 'form c-card', pad: 10, actions: [{ selectIndex: '#credentialId', index: 1 }, { wait: 1000 }], overlays: [
      num(1, '#credentialId'), num(2, '#name'), num(3, '#proxiesMax'), num(4, '#proxiesTimeoutDisconnected'), num(5, '#proxiesTimeoutUnreachable')] },
  { name: 'connectors_list', path: `${P}/connectors`, height: 640 },
  { name: 'project_status', path: `${P}/proxies`, clip: 'project-status', pad: 16, scale: 2 },
  { name: 'connector_details', path: `${P}/connectors`, clip: 'connector-view c-card', pad: 10, padTop: 48, scale: 2,
    actions: [{ style: 'a.btn-main { visibility: hidden !important; }' }], overlays: [
      num(1, 'connector-view .card-left', 'top'), num(2, 'connector-view c-card-body', 'top-left'), num(3, 'connector-view c-badge', 'top'),
      num(4, 'connector-view .scale', 'top-left', { dx: -4 }), num(5, 'connector-view .scale c-button-group', 'top'),
      num(6, 'connector-view .card-right', 'top', { index: 0 }), num(7, 'connector-view .card-right', 'top', { index: 1 }), num(8, 'connector-view c-dropdown', 'top')] },
  { name: 'proxies_list', path: `${P}/proxies` },
  proxyRow,
  { name: 'map', path: `${P}/map`, wait: 3000, overlays: [
      num(1, '.map-container', 'inside-left', { dy: 60 }), num(2, '.map-container .metrics', 'left'), num(3, '[ctooltip="Open in full screen"]', 'left')] },
  { name: 'map_fullscreen', path: `${P}/map`, width: 1920, height: 1080, wait: 3000, actions: [{ click: '[ctooltip="Open in full screen"]' }, { wait: 3000 }] },
  { name: 'metrics', path: `${P}/metrics`, height: 1560, overlays: [
      num(1, '.header c-button-group', 'left'),
      ...[...Array(10).keys()].map(i => num(i + 2, 'c-col[md="6"][xl="3"]', 'corner', { index: i })),
      ...[...Array(5).keys()].map(i => num(i + 12, 'c-col[md="6"]:not([xl])', 'corner', { index: i }))] },
  { name: 'tasks_list', path: `${P}/tasks`, clip: '.container-main c-card', pad: 12 },
  { name: 'users_list', path: `${P}/users`, clip: '.container-main c-card', pad: 12 },
];

const introStopped = [
  { name: 'connector_update', path: `${P}/connectors/${seed.connectorId}/update`, clip: 'form c-card', pad: 10,
    actions: [{ style: 'sources, freeproxies-add, freeproxies, h5.card-title { display: none !important; }' }, { wait: 300 }], overlays: [
      num(1, 'c-card-footer button', 'top', { index: 0 }), num(2, 'c-card-footer button', 'top', { index: 1 }), num(3, 'c-card-footer button', 'top', { index: 2 })] },
];

const guide = [
  { name: 'spx_credential_select', path: `${P}/marketplace`, actions: [{ type: 'c-input-group.main input', text: 'proxy list' }, { wait: 600 }],
    clip: '.container-main', pad: 12, height: 760, overlays: [{ type: 'box', selector: 'c-card.card-provider', pad: 4 }] },
  { name: 'spx_credential_create', path: `${P}/credentials/create/freeproxies`, clip: 'form c-card', pad: 10, overlays: [num(1, '#name')] },
  { name: 'spx_connector_create', path: `${P}/connectors/create`, clip: 'form c-card', pad: 10, actions: [{ selectIndex: '#credentialId', index: 1 }, { wait: 1000 }], overlays: [
      num(1, '#credentialId'), num(2, '#name'), num(3, '#proxiesMax'), num(4, '#proxiesTimeoutDisconnected'), num(5, '#proxiesTimeoutUnreachable'),
      num(6, '#freeproxiesTimeoutDisconnected'), num(7, '#freeproxiesTimeoutUnreachable')] },
  { name: 'spx_connector_start', path: `${P}/connectors`, height: 330, clip: '.body', pad: 0, overlays: [
      num(1, 'project-status button', 'bottom', { index: 2 }), num(2, 'connector-view .card-right', 'top', { index: 1 })] },
  { name: 'spx_proxies', path: `${P}/proxies`, clip: '.container-main c-card', pad: 12 },
];

const guideStopped = [
  { name: 'spx_connector_stop', path: `${P}/connectors`, height: 330, clip: '.body', pad: 0, wait: 800, overlays: [
      num(1, 'connector-view .card-right', 'top', { index: 1 }), num(2, 'connector-view .scale', 'top-left', { dx: -4 })] },
  { name: 'spx_connector_update_select', path: `${P}/connectors`, height: 420, clip: '.body', pad: 0, actions: [{ click: 'connector-view c-dropdown button' }, { wait: 600 }],
    overlays: [{ type: 'box', selector: '.dropdown-menu.show button', pad: 2 }] },
  { name: 'spx_connector_source_add', path: `${P}/connectors/${seed.connectorId}/update`, clip: 'form c-card', pad: 10,
    actions: [{ style: 'sources, freeproxies { display: none !important; }' }, { wait: 300 }], overlays: [
      num(1, 'source-add input', 'bottom', { index: 0 }), num(2, 'source-add input', 'bottom', { index: 1 }), num(3, 'source-add button', 'bottom')] },
  { name: 'spx_connector_proxies_add', path: `${P}/connectors/${seed.connectorId}/update`, clip: 'form c-card', pad: 10,
    actions: [{ style: 'sources, freeproxies { display: none !important; }' }, { wait: 300 }], overlays: [{ type: 'box', selector: 'freeproxies-add', pad: 4 }] },
  { name: 'spx_connector_proxies_manage', path: `${P}/connectors/${seed.connectorId}/update`, clip: 'freeproxies', pad: 10, padTop: 50,
    actions: [{ style: 'freeproxies-add { visibility: hidden !important; }' }, { wait: 300 }], overlays: [
      num(1, 'freeproxies tbody tr:first-child button', 'left'), num(2, '[ctooltip="Remove offline proxies now"]', 'top'),
      num(3, '[ctooltip="Remove duplicate outbound IP addresses now"]', 'top'), num(4, '[ctooltip="Remove all proxies"]', 'top')] },
];

fs.mkdirSync(outDir, { recursive: true });
for (const [name, plan] of Object.entries({ intro, 'intro-stopped': introStopped, guide, 'guide-stopped': guideStopped })) {
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(plan, null, 2));
  console.log(`${name}.json: ${plan.length} screens`);
}
