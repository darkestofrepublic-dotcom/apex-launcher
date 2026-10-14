// Vérifie : suggestions auto (modpacks, contenu) + flip du select vers le haut.
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
const clickNav = async (i) => {
  await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('.nav-btn')][${i}].click()` });
};
ws.onopen = async () => {
  await send("Runtime.enable");
  await send("Log.enable");
  // 1. Modpacks : suggestions sans recherche
  await clickNav(3);
  await new Promise((r) => setTimeout(r, 7000));
  console.log("PACKS:", await ev(`JSON.stringify({ cards: document.querySelectorAll('.content .grid.cards .card').length, heading: document.querySelector('.content .section-title')?.innerText })`));
  // 2. Contenu : suggestions sans recherche
  await clickNav(4);
  await new Promise((r) => setTimeout(r, 6000));
  console.log("CONTENT:", await ev(`JSON.stringify({ cards: document.querySelectorAll('.content .grid.cards .card').length })`));
  // 3. Paramètres : scrolle le select Thème en bas du viewport et l'ouvre
  await clickNav(10);
  await new Promise((r) => setTimeout(r, 800));
  await send("Runtime.evaluate", {
    expression: `(() => { const labels=[...document.querySelectorAll('.cselect-label')]; const el=labels.find(e=>/hème|heme/.test(e.innerText))?.parentElement; if(el){ el.scrollIntoView({block:'end'}); } return !!el; })()`,
  });
  await new Promise((r) => setTimeout(r, 500));
  await send("Runtime.evaluate", {
    expression: `(() => { const labels=[...document.querySelectorAll('.cselect-label')]; const btn=labels.find(e=>/hème|heme/.test(e.innerText))?.parentElement?.querySelector('.cselect-btn'); btn?.click(); return !!btn; })()`,
  });
  await new Promise((r) => setTimeout(r, 700));
  console.log("SELECT_FLIP:", await ev(`JSON.stringify((() => { const p=document.querySelector('.cselect-pop'); if(!p) return null; const cs=p.style; return { pos: cs.position, top: cs.top, bottom: cs.bottom, items: document.querySelectorAll('.cselect-item').length }; })())`));
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
