// Vérifie le rendu FR puis bascule en EN via l'IPC et revérifie.
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
  const fr = await send("Runtime.evaluate", {
    expression: `JSON.stringify({ nav: [...document.querySelectorAll('.nav-btn .lbl')].map(e=>e.innerText), hero: document.querySelector('.hero h1')?.innerText, svg: document.querySelectorAll('.sidebar svg').length })`,
    returnByValue: true,
  });
  console.log("FR:", fr.result?.result?.value);
  // Bascule en anglais via le pont IPC
  const sw = await send("Runtime.evaluate", {
    expression: `window.apex.invoke('settings:update', {language:'en'}).then(()=>JSON.stringify({ok:true})).catch(e=>JSON.stringify({err:String(e)}))`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log("SWITCH:", sw.result?.result?.value);
  await new Promise((r) => setTimeout(r, 1500));
  const en = await send("Runtime.evaluate", {
    expression: `JSON.stringify({ nav: [...document.querySelectorAll('.nav-btn .lbl')].map(e=>e.innerText), hero: document.querySelector('.hero h1')?.innerText, html: document.documentElement.lang })`,
    returnByValue: true,
  });
  console.log("EN:", en.result?.result?.value);
  // Retour en français pour laisser un état propre
  await send("Runtime.evaluate", { expression: `window.apex.invoke('settings:update', {language:'fr'})`, awaitPromise: true });
  setTimeout(() => {
    console.log("ERREURS:", JSON.stringify(errors.slice(0, 8)));
    ws.close();
    process.exit(0);
  }, 1500);
};
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
    return;
  }
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
  }
  if (msg.method === "Runtime.exceptionThrown") {
    errors.push("EXCEPTION: " + (msg.params.exceptionDetails?.text || ""));
  }
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
    errors.push("LOG: " + msg.params.entry.text);
  }
};
ws.onerror = (e) => { console.error("WS-FAIL", e.message); process.exit(1); };
