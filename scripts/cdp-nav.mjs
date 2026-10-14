// Liste la nav et clique Skins en vérifiant chaque étape.
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
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result?.result?.value;
ws.onopen = async () => {
  await send("Runtime.enable");
  console.log("NAV:", await ev(`JSON.stringify([...document.querySelectorAll('.nav-btn .lbl')].map(e=>e.innerText))`));
  console.log("CLICK:", await ev(`(() => { const b=[...document.querySelectorAll('.nav-btn')].find(x=>/skin/i.test(x.innerText)); b?.click(); return b ? b.innerText : 'not-found'; })()`));
  await new Promise((r) => setTimeout(r, 1500));
  console.log("PAGE:", await ev(`JSON.stringify({ h2: document.querySelector('.content h2')?.innerText, head: document.querySelector('.content')?.innerText.slice(0,120) })`));
  ws.close();
  process.exit(0);
};
ws.onmessage = (evm) => {
  const msg = JSON.parse(evm.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
ws.onerror = (e) => { console.error("WS-FAIL", e.message); process.exit(1); };
