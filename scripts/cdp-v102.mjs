// Vérifie : titlebar custom, boutons fenêtre, selects customs, page modpacks, navigateur de mods.
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
  console.log("TITLEBAR:", await ev(`JSON.stringify({ bar: document.querySelectorAll('.titlebar').length, winBtns: document.querySelectorAll('.win-btn').length, drag: getComputedStyle(document.querySelector('.titlebar')).webkitAppRegion })`));
  console.log("NAV:", await ev(`JSON.stringify([...document.querySelectorAll('.nav-btn .lbl')].map(e=>e.innerText))`));
  console.log("NATIVE_SELECTS:", await ev(`document.querySelectorAll('select').length`));
  // Ouvre la page modpacks via clic sur le 4e bouton de nav
  await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('.nav-btn')][3].click()` });
  await new Promise((r) => setTimeout(r, 1200));
  console.log("MODPACKS:", await ev(`JSON.stringify({ h2: document.querySelector('.content h2')?.innerText, tabs: [...document.querySelectorAll('.tabs .btn')].map(e=>e.innerText) })`));
  // Ouvre la bibliothèque (3e bouton) et le navigateur de mods
  await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('.nav-btn')][2].click()` });
  await new Promise((r) => setTimeout(r, 800));
  console.log("LIB:", await ev(`JSON.stringify({ text: document.querySelector('.content')?.innerText.slice(0,120) })`));
  setTimeout(() => { console.log("ERREURS:", JSON.stringify(errors.slice(0, 8))); ws.close(); process.exit(0); }, 1500);
};
ws.onmessage = (evm) => {
  const msg = JSON.parse(evm.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
  if (msg.method === "Runtime.exceptionThrown") errors.push("EXCEPTION: " + (msg.params.exceptionDetails?.text || ""));
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") errors.push("LOG: " + msg.params.entry.text);
};
ws.onerror = (e) => { console.error("WS-FAIL", e.message); process.exit(1); };
