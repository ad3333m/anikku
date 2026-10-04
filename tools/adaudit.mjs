// Ad audit for the player frame: loads a watch page in headless Edge, clicks the player like a viewer
// would, and reports every pop-up/new tab, third-party host and leftover overlay.
// usage: node tools/adaudit.mjs <url> <skin.js|-> [clicks] [waitMs]
import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, skinPath, clicks = '4', waitMs = '14000'] = process.argv.slice(2);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'anikku-ads-'));
const edge = spawn(EDGE, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new',
  '--window-size=1280,800', '--site-per-process', '--autoplay-policy=no-user-gesture-required', '--mute-audio',
  '--disable-popup-blocking', 'about:blank'], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, nextId = 1;
const pending = new Map();
const listeners = [];
for (let i = 0; i < 50 && !ws; i++) {
  try {
    const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const sock = new WebSocket(v.webSocketDebuggerUrl);
    await new Promise((res, rej) => { sock.onopen = res; sock.onerror = rej; });
    sock.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else listeners.forEach(fn => fn(m));
    };
    ws = sock;
  } catch { await sleep(200); }
}
const send = (method, params = {}, sessionId) => {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise(res => pending.set(id, res));
};

const skin = skinPath && skinPath !== '-' ? readFileSync(skinPath, 'utf8') : null;
const frames = [];
const hosts = new Map();
const samples = new Map();
const popups = [];
const frameNavs = [];

await send('Target.setDiscoverTargets', { discover: true });
listeners.push(m => {
  if (m.method === 'Target.targetCreated' && m.params.targetInfo.type === 'page' && m.params.targetInfo.openerId)
    popups.push(m.params.targetInfo.url || '(blank)');
  if (m.method === 'Target.targetInfoChanged' && m.params.targetInfo.type === 'page' && m.params.targetInfo.openerId)
    popups.push('-> ' + m.params.targetInfo.url);
  if (m.method === 'Network.requestWillBeSent') {
    try { const h = new URL(m.params.request.url).hostname; if (h) { hosts.set(h, (hosts.get(h) || 0) + 1); if (!samples.has(h)) samples.set(h, m.params.type + ' ' + m.params.request.url.slice(0, 110)); } } catch { /* data: */ }
  }
  if (m.method === 'Page.frameNavigated' && m.params.frame.parentId) frameNavs.push(m.params.frame.url.slice(0, 120));
});

const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId: page } } = await send('Target.attachToTarget', { targetId, flatten: true });
listeners.push(async m => {
  if (m.method !== 'Target.attachedToTarget') return;
  const { sessionId, targetInfo } = m.params;
  await send('Network.enable', {}, sessionId);
  if (targetInfo.type === 'iframe') {
    frames.push(sessionId);
    await send('Page.enable', {}, sessionId);
    if (skin) await send('Page.addScriptToEvaluateOnNewDocument', { source: skin }, sessionId);
  }
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId);
  await send('Runtime.runIfWaitingForDebugger', {}, sessionId);
});

await send('Page.enable', {}, page);
await send('Network.enable', {}, page);
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, page);
await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, page);
await send('Page.navigate', { url }, page);
await sleep(+waitMs);

// click the middle of the player a few times, like someone trying to press play
const box = await send('Runtime.evaluate', { returnByValue: true, expression:
  `(() => { const f = document.querySelector('iframe'); if (!f) return null; const r = f.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()` }, page);
const c = box.result?.result?.value;
const popupsBeforeClicks = popups.length;
if (c) for (let i = 0; i < +clicks; i++) {
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', { type, x: c.x + i * 37 - 60, y: c.y + i * 23 - 30, button: 'left', clickCount: 1 }, page);
  await sleep(1500);
}
await sleep(2000);

const overlayProbe = `(() => {
  const out = [];
  const W = innerWidth, H = innerHeight;
  document.querySelectorAll('body *').forEach(el => {
    if (el.closest('.jwplayer') || el.closest('#anikku-skin')) return;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
    if (r.width * r.height < W * H * 0.04) return;
    if ((cs.position === 'fixed' || cs.position === 'absolute' || el.tagName === 'IFRAME' || el.tagName === 'A' || el.tagName === 'IMG') && !el.contains(document.querySelector('.jwplayer')))
      out.push(el.tagName + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '') + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' z' + cs.zIndex + (el.href ? ' ' + el.href.slice(0, 60) : '') + (el.src ? ' ' + el.src.slice(0, 60) : ''));
  });
  const scripts = [...document.scripts].map(s => s.src).filter(Boolean).map(s => s.slice(0, 90));
  let state = null; try { state = jwplayer().getState(); } catch {}
  return { href: location.href.slice(0, 80), state, overlays: out.slice(0, 20), scripts, iframes: [...document.querySelectorAll('iframe')].map(f => f.src.slice(0, 80)) };
})()`;
for (const s of frames) {
  const r = await send('Runtime.evaluate', { expression: overlayProbe, returnByValue: true }, s);
  const v = r.result?.result?.value;
  if (v && v.href && !v.href.startsWith('about')) console.log('[frame]', JSON.stringify(v, null, 1));
}
console.log('popups on load:', popups.slice(0, popupsBeforeClicks));
console.log('popups from clicks:', popups.slice(popupsBeforeClicks));
console.log('frame navigations:', [...new Set(frameNavs)]);
console.log('hosts:', [...hosts].sort((a, b) => b[1] - a[1]).map(([h, n]) => `${h}(${n})`).join(' '));
if (process.env.SAMPLES) for (const [h, u] of samples) console.log('  ', h, '=>', u);
edge.kill();
process.exit(0);
