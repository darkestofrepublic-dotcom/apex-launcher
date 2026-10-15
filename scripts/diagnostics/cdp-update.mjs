// Invoque le vrai check de mise à jour de l'app (stack réseau Chromium d'Electron).
const wsUrl = process.argv[2];
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
  console.log("UPDATE_CHECK:", await ev(`window.apex.invoke('updates:check', {}).then(r=>JSON.stringify(r).slice(0,400)).catch(e=>JSON.stringify({thrown:String(e)}))`));
  await new Promise((r) => setTimeout(r, 1000));
  console.log("BANNER:", await ev(`JSON.stringify({ banner: document.querySelectorAll('.update-banner').length, text: document.querySelector('.update-banner')?.innerText })`));
  ws.close();
  process.exit(0);
};
ws.onmessage = (evm) => {
  const msg = JSON.parse(evm.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
ws.onerror = (e) => { console.error("WS-FAIL", e.message); process.exit(1); };
