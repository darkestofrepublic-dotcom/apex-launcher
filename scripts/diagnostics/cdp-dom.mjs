// Diagnostic ciblé : contenu réel de la zone centrale.
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
ws.onopen = async () => {
  await send("Runtime.enable");
  const r = await send("Runtime.evaluate", {
    expression: `JSON.stringify({
      heroCount: document.querySelectorAll('.hero').length,
      h1Count: document.querySelectorAll('h1').length,
      contentKids: document.querySelector('.content')?.childElementCount,
      contentText: document.querySelector('.content')?.innerText.slice(0, 200),
      rootLen: document.getElementById('root')?.innerHTML.length
    })`,
    returnByValue: true,
  });
  console.log("DOM2:", r.result?.result?.value);
  ws.close();
  process.exit(0);
};
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
ws.onerror = (e) => { console.error("WS-FAIL", e.message); process.exit(1); };
