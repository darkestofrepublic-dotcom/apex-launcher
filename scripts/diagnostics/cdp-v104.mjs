// Vérifie : verre (backdrop-filter), couvertures galerie, page Skins.
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
const errors = [];
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result?.result?.value;
ws.onopen = async () => {
  await send("Runtime.enable");
  await send("Log.enable");
  console.log("GLASS:", await ev(`JSON.stringify({ sidebar: getComputedStyle(document.querySelector('.sidebar')).backdropFilter, cards: document.querySelectorAll('.card').length })`));
  await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('.nav-btn')][3].click()` });
  await new Promise((r) => setTimeout(r, 12000));
  console.log("COVERS:", await ev(`JSON.stringify({ cards: document.querySelectorAll('.content .grid.cards .card').length, covers: document.querySelectorAll('.content .cover img').length })`));
  await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('.nav-btn')][9].click()` });
  await new Promise((r) => setTimeout(r, 1200));
  console.log("SKINS:", await ev(`JSON.stringify({ h2: document.querySelector('.content h2')?.innerText, text: document.querySelector('.content')?.innerText.slice(0,150) })`));
  setTimeout(() => { console.log("ERREURS:", JSON.stringify(errors.slice(0, 8))); ws.close(); process.exit(0); }, 1000);
};
ws.onmessage = (evm) => {
  const msg = JSON.parse(evm.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
  if (msg.method === "Runtime.exceptionThrown") errors.push("EXCEPTION: " + (msg.params.exceptionDetails?.text || ""));
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") errors.push("LOG: " + msg.params.entry.text);
};
ws.onerror = (e) => { console.error("WS-FAIL", e.message); process.exit(1); };
