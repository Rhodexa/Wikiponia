// cdp_drive.mjs: drive a headless Chrome over the DevTools protocol to test Wikiponia like a phone.
// 1) python3 -m http.server 8765   2) google-chrome --headless=new --remote-debugging-port=9333 --window-size=412,915 about:blank
//    (add --enable-unsafe-swiftshader --use-angle=swiftshader to test the 3D Cutie Map)
// 3) node --experimental-websocket tools/cdp_drive.mjs steps.json
// steps.json: [{"go": url} | {"eval": js} | {"wait": ms} | {"shot": "out.png"}], run in order; console errors are printed at the end.
// usage: node --experimental-websocket cdp.mjs steps.json
import fs from 'fs';
const steps = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page = list.find(p => p.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Runtime.consoleAPICalled') logs.push('console.' + d.params.type + ': ' + d.params.args.map(a => a.value ?? a.description).join(' '));
  if (d.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + JSON.stringify(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
};
await new Promise(r => ws.onopen = r);
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 1, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true });
for (const s of steps) {
  if (s.go) await send('Page.navigate', { url: s.go });
  if (s.eval) { const r = await send('Runtime.evaluate', { expression: s.eval, awaitPromise: true, returnByValue: true }); if (r.result?.result?.value !== undefined) console.log('eval>', JSON.stringify(r.result.result.value).slice(0, 600)); if (r.result?.exceptionDetails) console.log('evalerr>', JSON.stringify(r.result.exceptionDetails).slice(0,400)); }
  if (s.wait) await new Promise(r => setTimeout(r, s.wait));
  if (s.shot) { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(s.shot, Buffer.from(r.result.data, 'base64')); console.log('shot', s.shot); }
}
console.log(logs.join('\n'));
process.exit(0);
