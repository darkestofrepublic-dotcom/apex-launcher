// Diagnostique l'ouverture du select Thème pas à pas.
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
  await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('.nav-btn')][10].click()` });
  await new Promise((r) => setTimeout(r, 1000));
  console.log("LABELS:", await ev(`JSON.stringify([...document.querySelectorAll('.cselect-label')].map(e=>e.innerText))`));
  console.log("SCROLL:", await ev(`(() => { const l=[...document.querySelectorAll('.cselect-label')].find(e=>/heme/i.test(e.innerText)); const box=l?.parentElement; if(!box) return 'no-box'; box.scrollIntoView({block:'end'}); box.ownerDocument.querySelector('.content').scrollTop += 400; return 'scrolled'; })()`));
  await new Promise((r) => setTimeout(r, 400));
  console.log("RECT:", await ev(`(() => { const l=[...document.querySelectorAll('.cselect-label')].find(e=>/heme/i.test(e.innerText)); const b=l?.parentElement?.querySelector('.cselect-btn'); if(!b) return 'no-btn'; const r=b.getBoundingClientRect(); return JSON.stringify({top:Math.round(r.top),bottom:Math.round(r.bottom),vh:window.innerHeight}); })()`));
  console.log("CLICK:", await ev(`(() => { const l=[...document.querySelectorAll('.cselect-label')].find(e=>/heme/i.test(e.innerText)); const b=l?.parentElement?.querySelector('.cselect-btn'); b?.click(); return !!b; })()`));
  await new Promise((r) => setTimeout(r, 600));
  console.log("POP:", await ev(`(() => { const p=document.querySelector('.cselect-pop'); return p ? p.style.position+'|top='+p.style.top+'|bottom='+p.style.bottom : 'none'; })()`));
  ws.close();
  process.exit(0);
};
ws.onmessage = (evm) => {
  const msg = JSON.parse(evm.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
ws.onerror = (e) => { console.error("WS-FAIL", e.message); process.exit(1); };
