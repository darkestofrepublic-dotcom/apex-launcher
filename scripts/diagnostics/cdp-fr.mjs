// Bascule en FR et lit la nav + hero.
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
ws.onopen = async () => {
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Runtime.evaluate", { expression: `window.apex.invoke('settings:update', {language:'fr'})`, awaitPromise: true });
  await send("Page.reload", {});
  await new Promise((r) => setTimeout(r, 4000));
  const r = await send("Runtime.evaluate", {
    expression: `JSON.stringify({ nav: [...document.querySelectorAll('.nav-btn .lbl')].map(e=>e.innerText).slice(0,4), hero: document.querySelector('.hero h1')?.innerText, html: document.documentElement.lang })`,
    returnByValue: true,
  });
  console.log("FR:", r.result?.result?.value);
  setTimeout(() => { console.log("ERREURS:", JSON.stringify(errors.slice(0, 6))); ws.close(); process.exit(0); }, 1000);
};
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === "Runtime.exceptionThrown") errors.push("EXCEPTION: " + (msg.params.exceptionDetails?.text || ""));
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") errors.push("LOG: " + msg.params.entry.text);
};
ws.onerror = (e) => { console.error("WS-FAIL", e.message); process.exit(1); };
