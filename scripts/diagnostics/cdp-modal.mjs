// Ouvre le modal de création d'instance et vérifie le flip du select de version (80 options).
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
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result?.result?.value;
ws.onopen = async () => {
  await send("Runtime.enable");
  console.log("NEWBTN:", await ev(`(() => { const b=[...document.querySelectorAll('.card .btn')].find(x=>/instance/i.test(x.innerText)); b?.click(); return !!b; })()`));
  await new Promise((r) => setTimeout(r, 5000));
  console.log("MODAL:", await ev(`JSON.stringify({ modal: document.querySelectorAll('.modal').length, selects: document.querySelectorAll('.modal .cselect-btn').length })`));
  console.log("OPEN:", await ev(`(() => { const btns=[...document.querySelectorAll('.modal .cselect-btn')]; const b=btns[0]; if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`));
  await new Promise((r) => setTimeout(r, 700));
  console.log("POP:", await ev(`(() => { const p=document.querySelector('.cselect-pop'); if(!p) return 'none'; const r=p.getBoundingClientRect(); return p.style.position+'|top='+p.style.top+'|bottom='+p.style.bottom+'|items='+document.querySelectorAll('.cselect-item').length+'|visibleTop='+Math.round(r.top)+'|visibleBottom='+Math.round(r.bottom)+'|vh='+window.innerHeight; })()`));
  ws.close();
  process.exit(0);
};
ws.onmessage = (evm) => {
  const msg = JSON.parse(evm.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
ws.onerror = (e) => { console.error("WS-FAIL", e.message); process.exit(1); };
