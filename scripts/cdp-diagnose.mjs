// Diagnostic CDP : lit la console du renderer et l'état du DOM.
const target = process.argv[2];
const wsUrl = process.argv[3];
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
  const evalRes = await send("Runtime.evaluate", {
    expression: `JSON.stringify({
      hasApex: typeof window.apex,
      rootChildren: document.getElementById('root')?.childElementCount,
      rootHtmlLen: document.getElementById('root')?.innerHTML.length,
      sidebar: document.querySelectorAll('.sidebar').length,
      navBtns: document.querySelectorAll('.nav-btn').length,
      cards: document.querySelectorAll('.card').length,
      bodyText: document.body.innerText.slice(0, 300)
    })`,
    returnByValue: true,
  });
  console.log("DOM:", evalRes.result?.result?.value);
  // Laisse 3 s pour capter les erreurs asynchrones (IPC, fetch)
  setTimeout(async () => {
    console.log("ERREURS CAPTÉES:", JSON.stringify(errors.slice(0, 10), null, 1));
    ws.close();
    process.exit(0);
  }, 3000);
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
    errors.push("EXCEPTION: " + (msg.params.exceptionDetails?.text || "") + " " + (msg.params.exceptionDetails?.exception?.description || ""));
  }
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
    errors.push("LOG: " + msg.params.entry.text + " " + (msg.params.entry.url || ""));
  }
};
ws.onerror = (e) => { console.error("WS-FAIL", e.message); process.exit(1); };
void target;
