// Vérifie : switches, verre ON/OFF, dark neutre.
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
  await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('.nav-btn')].find(x=>/tings|mètres/.test(x.innerText))?.click()` });
  await new Promise((r) => setTimeout(r, 1200));
  console.log("SWITCHES:", await ev(`document.querySelectorAll('.switch').length`));
  console.log("GLASS_ON:", await ev(`JSON.stringify({ body: getComputedStyle(document.body).backgroundColor, sidebar: getComputedStyle(document.querySelector('.sidebar')).backgroundColor })`));
  await send("Runtime.evaluate", { expression: `window.apex.invoke('settings:update', {transparency:false})`, awaitPromise: true });
  await send("Page.reload", {});
  await new Promise((r) => setTimeout(r, 3500));
  console.log("GLASS_OFF:", await ev(`JSON.stringify({ body: getComputedStyle(document.body).backgroundColor, sidebar: getComputedStyle(document.querySelector('.sidebar')).backgroundColor, dt: document.documentElement.dataset.transparency })`));
  await send("Runtime.evaluate", { expression: `window.apex.invoke('settings:update', {transparency:true})`, awaitPromise: true });
  await send("Page.reload", {});
  await new Promise((r) => setTimeout(r, 3500));
  console.log("GLASS_BACK:", await ev(`JSON.stringify({ body: getComputedStyle(document.body).backgroundColor, dt: document.documentElement.dataset.transparency })`));
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
