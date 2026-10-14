// Teste le flux Microsoft : sans client ID (erreur immédiate), puis avec faux GUID (fenêtre ?).
// Usage : node cdp-msauth.mjs <wsUrl> <debugPort>
const wsUrl = process.argv[2];
const port = process.argv[3];
const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
function send(method, params) {
  return new Promise((resolve) => {
    const cur = ++id;
    pending.set(cur, resolve);
    ws.send(JSON.stringify({ id: cur, method, params }));
  });
}
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
ws.onopen = async () => {
  console.log("NO_ID:", await ev(`window.apex.invoke('auth:microsoft-start', {}).then(r=>JSON.stringify(r)).catch(e=>JSON.stringify({thrown:String(e)}))`));
  console.log("SET_FAKE:", await ev(`window.apex.invoke('settings:update', {microsoftClientId:'00000000-0000-4000-8000-000000000000'}).then(()=> 'saved')`));
  await ev(`window.apex.invoke('auth:microsoft-start', {}).then(()=>0).catch(()=>0); 'launched'`);
  await new Promise((r) => setTimeout(r, 9000));
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  console.log("TARGETS:", targets.map((t) => `${t.title.slice(0, 40)} | ${t.url.slice(0, 110)}`).join("\n"));
  ws.close();
  process.exit(0);
};
ws.onmessage = (evm) => {
  const msg = JSON.parse(evm.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
ws.onerror = (e) => { console.error("WS-FAIL", e.message); process.exit(1); };
