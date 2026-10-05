// Taps the player skin like a phone does (touch emulation, hover: none) inside the real MegaPlay frame,
// and reports whether the controls stay up and a button can be pressed.
// usage: node tools/touchtest.mjs <watch-url> <skin.js>
import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, skinPath] = process.argv.slice(2);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const edge = spawn(EDGE, [`--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'anikku-touch-'))}`,
  '--headless=new', '--window-size=430,932', '--site-per-process', '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map(), listeners = [];
for (let i = 0; i < 50 && !ws; i++) {
  try {
    const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const s = new WebSocket(v.webSocketDebuggerUrl);
    await new Promise((res, rej) => { s.onopen = res; s.onerror = rej; });
    s.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else listeners.forEach(f => f(m)); };
    ws = s;
  } catch { await sleep(200); }
}
const send = (method, params = {}, sessionId) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const skin = readFileSync(skinPath, 'utf8');
const MEDIA = { features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }, { name: 'any-hover', value: 'none' }] };
const frames = [];

const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId: page } } = await send('Target.attachToTarget', { targetId, flatten: true });
listeners.push(async m => {
  if (m.method !== 'Target.attachedToTarget') return;
  const { sessionId, targetInfo } = m.params;
  if (targetInfo.type === 'iframe') {
    frames.push(sessionId);
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setEmulatedMedia', MEDIA, sessionId);
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
    await send('Page.addScriptToEvaluateOnNewDocument', { source: skin }, sessionId);
  }
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId);
  await send('Runtime.runIfWaitingForDebugger', {}, sessionId);
});
await send('Page.enable', {}, page);
await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true }, page);
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, page);
await send('Emulation.setEmulatedMedia', MEDIA, page);
await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, page);
await send('Page.navigate', { url }, page);
await sleep(17000);

const evalIn = async (s, expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, s)).result?.result?.value;
let player = null;
for (const s of frames) if (await evalIn(s, "!!document.getElementById('anikku-skin')")) player = s;
if (!player) { console.log('no skinned player frame'); edge.kill(); process.exit(0); }
const state = () => evalIn(player, `(() => { const ui = document.getElementById('anikku-skin').shadowRoot.querySelector('.ui');
  return { controls: ui.classList.contains('on') ? 'shown' : 'hidden', touch: ui.classList.contains('touch'), player: jwplayer().getState() }; })()`);
const box = await evalIn(page, `(() => { const r = document.querySelector('#player').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
const tap = async (x, y) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }, page);
  await sleep(60);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, page);
};

const out = { start: await state() };
await sleep(5500);                                   // let the controls hide while it plays
out.afterIdle = await state();
await tap(box.x + box.w * 0.5, box.y + box.h * 0.22); // tap the picture, away from the buttons
await sleep(700);
out.afterTapPicture = await state();
await tap(box.x + box.w * 0.5, box.y + box.h * 0.5);  // tap the big play/pause button
await sleep(700);
out.afterTapPlayButton = await state();
console.log(JSON.stringify({ playerBox: box, ...out }, null, 1));
edge.kill();
process.exit(0);
