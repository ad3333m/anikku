// Drive headless Edge over the DevTools protocol to test the player skin inside the cross-origin
// player frame, the same way the Anikku apps inject it.
// usage: node tools/cdp.mjs <url> <frameHostSubstring> <skin.js|-> <probe.js|-> <out.png> [waitMs] [width] [height]
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, frameHost, skinPath, probePath, outPng, waitMs = '12000', width = '1280', height = '800'] = process.argv.slice(2);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'anikku-cdp-'));
const edge = spawn(EDGE, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new',
  `--window-size=${width},${height}`, '--site-per-process', '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, nextId = 1;
const pending = new Map();
const listeners = [];
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      ws = new WebSocket(v.webSocketDebuggerUrl);
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
      ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        else listeners.forEach(fn => fn(m));
      };
      return;
    } catch { await sleep(200); }
  }
  throw new Error('Edge did not start');
}
function send(method, params = {}, sessionId) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise(res => pending.set(id, res));
}

const skin = skinPath && skinPath !== '-' ? readFileSync(skinPath, 'utf8') : null;
const probe = probePath && probePath !== '-' ? readFileSync(probePath, 'utf8') : null;
const frameSessions = [];

await connect();
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId: page } } = await send('Target.attachToTarget', { targetId, flatten: true });

listeners.push(async m => {
  if (m.method !== 'Target.attachedToTarget') return;
  const { sessionId, targetInfo } = m.params;
  if (process.env.CDP_DEBUG) console.log('[attach]', targetInfo.type, targetInfo.url);
  if (targetInfo.type === 'iframe' && (targetInfo.url.includes(frameHost) || !targetInfo.url || targetInfo.url === 'about:blank')) {
    frameSessions.push(sessionId);
    await send('Page.enable', {}, sessionId);
    if (skin) await send('Page.addScriptToEvaluateOnNewDocument', { source: skin }, sessionId);
    // console capture is opt-in: MegaPlay's anti-devtools check notices it and blanks the frame
    if (process.env.CDP_CONSOLE) await send('Runtime.enable', {}, sessionId);
  }
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId);
  await send('Runtime.runIfWaitingForDebugger', {}, sessionId);
});
listeners.push(m => {
  if (m.method === 'Runtime.consoleAPICalled' && frameSessions.includes(m.sessionId))
    console.log('[frame]', m.params.args.map(a => a.value ?? a.description).join(' '));
});

await send('Page.enable', {}, page);
await send('Emulation.setDeviceMetricsOverride', { width: +width, height: +height, deviceScaleFactor: 1, mobile: false }, page);
await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, page);
await send('Page.navigate', { url }, page);
await sleep(+waitMs);

if (probe) {
  for (const s of frameSessions) {
    const r = await send('Runtime.evaluate', { expression: probe, awaitPromise: true, returnByValue: true }, s);
    console.log('[probe]', JSON.stringify(r.result?.result?.value ?? r.result, null, 1));
  }
}
const shot = await send('Page.captureScreenshot', { format: 'png' }, page);
if (outPng && outPng !== '-') writeFileSync(outPng, Buffer.from(shot.result.data, 'base64'));
console.log('frames attached:', frameSessions.length);
edge.kill();
process.exit(0);
