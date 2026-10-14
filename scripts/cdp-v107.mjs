// Vérifie : logo, splash (cible), page support, lazy.
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
  console.log("LOGO:", await ev(`JSON.stringify({ brand: document.querySelector('.brand-mark img')?.src?.slice(-9), nav: document.querySelectorAll('.nav-btn').length })`));
  await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('.nav-btn')].find(x=>/ssistance|upport/.test(x.innerText))?.click()` });
  await new Promise((r) => setTimeout(r, 1500));
  console.log("SUPPORT:", await ev(`JSON.stringify({ h2: document.querySelector('.content h2')?.innerText, faq: document.querySelectorAll('.content details').length, links: document.querySelectorAll('.content a[href^=https]').length })`));
  setTimeout(() => { console.log("ERREURS:", JSON.stringify(errors.slice(0, 6))); ws.close(); process.exit(0); }, 1000);
};
ws.onmessage = (evm) => {
  const msg = JSON.parse(evm.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
  if (msg.method === "Runtime.exceptionThrown") errors.push("EXCEPTION: " + (msg.params.exceptionDetails?.text || ""));
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") errors.push("LOG: " + msg.params.entry.text);
};
ws.onerror = (e) => { console.error("WS-FAIL", e.message); process.exit(1); };
