// Vérifie le guide Microsoft : carte, étapes, champ client ID, codes d'erreur.
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
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
ws.onopen = async () => {
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('.nav-btn')].find(x=>/comptes|ccounts/.test(x.innerText))?.click()` });
  await new Promise((r) => setTimeout(r, 1500));
  console.log("GUIDE:", await ev(`JSON.stringify({ steps: document.querySelectorAll('.content ol li').length, input: document.querySelectorAll('.content input[placeholder]').length, portal: !!document.querySelector('.content a[href*=azure]') })`));
  console.log("ERR_NO_ID:", await ev(`window.apex.invoke('auth:microsoft-start', {}).then(r=>r.error).catch(e=>String(e))`));
  await ev(`window.apex.invoke('settings:update', {microsoftClientId:'bad-id'}).then(()=> 'saved')`);
  console.log("ERR_BAD_ID:", await ev(`window.apex.invoke('auth:microsoft-start', {}).then(r=>r.error).catch(e=>String(e))`));
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
