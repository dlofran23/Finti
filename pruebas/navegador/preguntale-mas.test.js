// Pregúntale entiende más (28-nov-2026): preguntas que respondía mal. Con los datos de ejemplo.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const esp = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c.addInitScript(() => { const D = Date, f = new D(2026, 10, 20, 10, 0).getTime(); Date = class extends D { constructor(...a) { super(...(a.length ? a : [f])); } static now() { return f; } }; });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#inicio', { waitUntil: 'networkidle' }); await esp(1000);
  await p.evaluate(() => document.getElementById('btn-preguntas-menu').click()); await esp(500);
  async function preg(q) { await p.fill('#pr-input', q); await p.press('#pr-input', 'Enter'); await esp(700); return p.evaluate(() => { const m = document.querySelectorAll('#pr-log .pr-msg.app'); return m[m.length - 1].textContent.replace(/ /g, ' '); }); }
  let r;
  ok(/Premium es un pago único/.test(await preg('qué es premium')), '¿Qué es Premium? explica Premium');
  ok(/Premium es un pago único/.test(await preg('cuanto cuesta premium')), '¿Cuánto cuesta Premium? no lo confunde con un producto del mercado');
  r = await preg('estoy mal?'); console.log('   estoy mal → ' + r.slice(0, 120)); ok(!/no la entendí/.test(r), '¿Estoy mal? dice cómo va el mes');
  ok(/tus cuotas son|cuota nueva/.test(await preg('debo sacar un credito')), '¿Debo sacar un crédito? aconseja sobre el crédito, no lista las deudas');
  ok(/esto es lo que más te sirve/.test(await preg('ayudame a ahorrar')), 'Ayúdame a ahorrar da ideas con tus números');
  r = await preg('quiero ahorrar 500 mil para diciembre');
  ok(/Para tener \$ 500\.000 en diciembre aparta \$ 500\.000 este mes/.test(r), 'arma el plan para diciembre: ' + r.slice(0, 80));
  r = await preg('necesito juntar 2 millones en 6 meses');
  ok(/\$ 2\.000\.000 en 6 meses aparta \$ 334\.000 al mes durante 6 meses/.test(r) && /de lo que te entra/.test(r), 'y en 6 meses, con cuánto es de lo que te entra');
  ok(!errs.length, 'sin errores de página' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
