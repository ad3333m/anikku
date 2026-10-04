// Drives a running Ciname.exe over WebView2's remote debugging port (start it with
// WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333).
// usage: node tests/cdp.mjs <url-substring> <script.js|-> [out.png]
//   evaluates the script (awaited) in the first target whose URL contains the substring,
//   prints the result, and optionally saves a screenshot of that target.
import { readFileSync, writeFileSync } from 'node:fs';

const [match, scriptPath, outPng] = process.argv.slice(2);
const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
if (match === 'list') { for (const t of targets) console.log(t.type, t.url.slice(0, 100)); process.exit(0); }
const t = targets.find(x => (x.type === 'page' || x.type === 'iframe') && x.url.includes(match));
if (!t) { console.log('no target with', match, targets.map(x => x.type + ' ' + x.url).join('\n')); process.exit(1); }

const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const pending = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

if (scriptPath && scriptPath !== '-') {
  const r = await send('Runtime.evaluate', { expression: readFileSync(scriptPath, 'utf8'), awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(r.result?.result?.value ?? r.result ?? r, null, 1));
}
if (outPng) {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s.result) writeFileSync(outPng, Buffer.from(s.result.data, 'base64'));
  else console.log('screenshot failed', JSON.stringify(s.error));
}
ws.close();
process.exit(0);
