// Logs into the local ProxyHerd and captures screens described in a plan file.
// plan: [{ name, path, clip?: selector, pad?: number, width?, height?, before?: fn-name, overlays?: [...] }]
const path = require('path');
const puppeteer = require('puppeteer-core');
const BASE = `http://localhost:${process.env.COMMANDER_PORT || 8890}`;
const [,, planFile, outDir] = process.argv;
const plan = require(path.resolve(planFile));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const OVERLAY_CSS = `
.ph-num{position:absolute;z-index:99999;width:30px;height:30px;border-radius:50%;background:#e5007a;color:#fff;font:700 15px/30px Poppins,Inter,Helvetica,Arial,sans-serif;text-align:center;border:2px solid #7a0040;box-shadow:0 2px 6px rgba(0,0,0,.35);pointer-events:none}
.ph-box{position:absolute;z-index:99998;border:3px solid #e5007a;border-radius:4px;pointer-events:none;box-sizing:border-box}
.ph-label{position:absolute;z-index:99999;color:#e5007a;font:700 28px/1 Poppins,Inter,Helvetica,Arial,sans-serif;letter-spacing:1px;pointer-events:none;background:rgba(255,255,255,.88);padding:8px 14px;border-radius:6px}
`;

async function annotate(page, overlays) {
  await page.evaluate((css, items) => {
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    const sx = window.scrollX, sy = window.scrollY;
    const rectOf = (sel, index) => {
      const els = document.querySelectorAll(sel);
      const el = els[index || 0];
      if (!el) throw new Error('overlay target not found: ' + sel);
      const r = el.getBoundingClientRect();
      return { x: r.left + sx, y: r.top + sy, w: r.width, h: r.height };
    };
    for (const it of items) {
      const r = it.rect ? it.rect : rectOf(it.selector, it.index);
      if (it.until) { const u = rectOf(it.until, it.untilIndex); const bottom = Math.max(r.y + r.h, u.y + u.h); const right = Math.max(r.x + r.w, u.x + u.w); const left = Math.min(r.x, u.x); r.x = left; r.w = right - left; r.h = bottom - r.y; }
      if (it.type === 'num') {
        const d = document.createElement('div'); d.className = 'ph-num'; d.textContent = String(it.n);
        const pos = it.pos || 'left';
        let x = r.x - 38, y = r.y + r.h / 2 - 15;
        if (pos === 'right') x = r.x + r.w + 8;
        if (pos === 'top') { x = r.x + r.w / 2 - 15; y = r.y - 34; }
        if (pos === 'bottom') { x = r.x + r.w / 2 - 15; y = r.y + r.h + 4; }
        if (pos === 'inside-left') { x = r.x + 6; y = r.y + r.h / 2 - 15; }
        if (pos === 'inside-right') { x = r.x + r.w - 36; y = r.y + r.h / 2 - 15; }
        if (pos === 'corner') { x = r.x + r.w - 34; y = r.y + 4; }
        if (pos === 'corner-left') { x = r.x + 4; y = r.y + 4; }
        if (pos === 'top-left') { x = r.x + 8; y = r.y - 34; }
        d.style.left = (x + (it.dx || 0)) + 'px'; d.style.top = (y + (it.dy || 0)) + 'px';
        document.body.appendChild(d);
      } else if (it.type === 'box') {
        const pad = it.pad ?? 4;
        const b = document.createElement('div'); b.className = 'ph-box';
        b.style.left = (r.x - pad) + 'px'; b.style.top = (r.y - pad) + 'px'; b.style.width = (r.w + 2 * pad) + 'px'; b.style.height = (r.h + 2 * pad) + 'px';
        document.body.appendChild(b);
        if (it.label) {
          const l = document.createElement('div'); l.className = 'ph-label'; l.textContent = it.label;
          const lp = it.labelPos || 'center';
          if (lp === 'center') { l.style.left = (r.x + r.w / 2 - it.label.length * 8.5) + 'px'; l.style.top = (r.y + r.h / 2 - 14) + 'px'; }
          if (lp === 'bottom-right') { l.style.left = (r.x + r.w - it.label.length * 17 - 16) + 'px'; l.style.top = (r.y + r.h - 44) + 'px'; }
          if (lp === 'top-right') { l.style.left = (r.x + r.w - it.label.length * 17 - 16) + 'px'; l.style.top = (r.y + 14) + 'px'; }
          if (lp === 'bottom-left') { l.style.left = (r.x + 16) + 'px'; l.style.top = (r.y + r.h - 44 + (it.labelDy || 0)) + 'px'; }
          document.body.appendChild(l);
        }
      }
    }
  }, OVERLAY_CSS, overlays);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox', '--window-size=1440,900'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  // login
  await page.goto(`${BASE}/login`, { waitUntil: 'load' });
  await page.waitForSelector('#username', { timeout: 30000 });
  await sleep(600);
  for (const p of plan.filter(p => p.name === 'login' || p.preLogin)) {
    const file = path.join(outDir, `${p.name}.png`);
    if (p.clip) { const el = await page.$(p.clip); const b = await el.boundingBox(); const pad = p.pad ?? 8; await page.screenshot({ path: file, clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + 2 * pad, height: b.height + 2 * pad } }); }
    else await page.screenshot({ path: file });
    console.log('captured', p.name);
  }
  await page.type('#username', process.env.AUTH_LOCAL_USERNAME);
  await page.type('#password', process.env.AUTH_LOCAL_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForSelector('c-sidebar', { timeout: 30000 });
  await sleep(1000);
  console.log('logged in, at', page.url());
  for (const p of plan) {
    if (p.name === 'login' || p.preLogin) continue;
    if (p.width || p.height || p.scale) await page.setViewport({ width: p.width || 1440, height: p.height || 900, deviceScaleFactor: p.scale || 1 });
    await page.goto(`${BASE}${p.path}`, { waitUntil: 'load' });
    await page.waitForSelector(p.waitFor || 'c-sidebar', { timeout: 30000 });
    await page.addStyleTag({ content: 'connection { display: none !important; }' });
    await sleep(p.wait || 1200);
    if (p.actions) for (const a of p.actions) {
      if (a.style) await page.addStyleTag({ content: a.style });
      if (a.click) await page.click(a.click);
      if (a.select) await page.select(a.select, a.value);
      if (a.selectIndex !== undefined) { const v = await page.$$eval(a.selectIndex + ' option', (o, i) => o[i].value, a.index); await page.select(a.selectIndex, v); }
      if (a.hover) await page.hover(a.hover);
      if (a.type) await page.type(a.type, a.text);
      if (a.wait) await sleep(a.wait);
    }
    if (p.overlays) await annotate(page, p.overlays);
    const file = path.join(outDir, `${p.name}.png`);
    if (p.clip) {
      const el = await page.$(p.clip);
      if (!el) throw new Error('clip not found: ' + p.clip);
      const b = await el.boundingBox(); const pad = p.pad ?? 8; const padTop = p.padTop ?? pad;
      await page.screenshot({ path: file, clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - padTop), width: b.width + 2 * pad, height: b.height + pad + padTop }, captureBeyondViewport: true });
    } else {
      await page.screenshot({ path: file, fullPage: !!p.fullPage });
    }
    console.log('captured', p.name);
    if (p.width || p.height || p.scale) await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
