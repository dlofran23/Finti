// Ideas nuevas (28-nov-2026): Tus suscripciones (cuándo cobra cada una, cuánto suman al año y pagos que se repiten),
// retos de ahorro que la app sigue sola, dividir una cuenta (tu parte como gasto y lo demás en Te deben) y los días en
// que te pagan en el calendario de pagos.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const esp = (ms) => new Promise((r) => setTimeout(r, ms));
const estado = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta')));
const T = async (p, s) => (await p.textContent(s)).replace(/ /g, ' ');
const pestana = (p, t) => p.evaluate((x) => document.querySelector('#tabs [data-tab="' + x + '"]').click(), t);
async function sinGuiado(p) { if (await p.isVisible('#dlg-inicio')) { await p.keyboard.press('Escape'); await esp(300); } }
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  // Hora fija: 20 de noviembre de 2026
  await c.addInitScript(() => {
    const D = Date, fixed = new D(2026, 10, 20, 10, 0).getTime();
    Date = class extends D { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } };
  });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  // Tres meses de Netflix en los movimientos y los días de pago (estado guardado antes de abrir la app)
  await c.addInitScript(() => {
    if (localStorage.getItem('presupuesto-web-sin-cuenta')) return;
    localStorage.setItem('presupuesto-web-sin-cuenta', JSON.stringify({ mes: '2026-11', meses: { '2026-11': { ingresos: [{ id: 'i1', concepto: 'Sueldo', plan: 3000000, real: 3000000 }], gastos: [{ id: 'g1', concepto: 'Mercado', cat: 'alimentacion', dia: 0, plan: 600000, real: 0 }] } },
      movs: [
        { id: 'v1', f: '2026-09-14', h: 9, t: 'g', cat: 'suscripciones', c: 'Netflix', m: 44900, com: 'Netflix' },
        { id: 'v2', f: '2026-10-14', h: 9, t: 'g', cat: 'suscripciones', c: 'Netflix', m: 44900, com: 'Netflix' },
        { id: 'v3', f: '2026-11-14', h: 9, t: 'g', cat: 'suscripciones', c: 'Netflix', m: 44900, com: 'Netflix' }
      ], prefs: { diasPago: [15, 30] } }));
  });
  await p.goto(BASE + '/#inicio', { waitUntil: 'networkidle' }); await esp(1000); await sinGuiado(p);
  await pestana(p, 'cuentas'); await esp(400);

  // Suscripciones
  ok(await p.isVisible('#subs-panel'), 'hay una sección Tus suscripciones');
  const det = await T(p, '#subs-body');
  ok(/Encontré pagos que se repiten/.test(det) && /Netflix · \$ 44\.900 al mes/.test(det), 'encuentra Netflix entre los pagos que se repiten');
  await p.click('#subs-body [data-sub-det="0"]'); await esp(400);
  let st = await estado(p); const nf = st.porPagar.find((x) => x.nombre === 'Netflix');
  ok(nf && nf.monto === 44900 && nf.dia === 14 && nf.aviso === 2 && nf.cat === 'suscripciones', 'Avisarme antes la vuelve cuenta por pagar con aviso 2 días antes');
  const subs = await T(p, '#subs-body');
  ok(/Se cobra el 14 de diciembre \(en 24 días\)/.test(subs) && /te aviso 2 días antes/.test(subs), 'dice cuándo cobra y que avisa antes: ' + subs.slice(0, 90));
  ok(/\$ 538\.800 al año/.test(await T(p, '#subs-anual')), 'y cuánto suma al año');
  await p.click('#subs-body [data-sub-nueva="Spotify"]'); await esp(500);
  st = await estado(p);
  ok(st.porPagar.some((x) => x.nombre === 'Spotify' && x.cat === 'suscripciones') && await p.evaluate(() => document.activeElement && document.activeElement.dataset.f === 'monto'), 'agregar Spotify deja lista la casilla del valor');

  // Calendario: días de pago
  ok(await p.$$eval('#calpag-grid .cp-dia.paga', (l) => l.map((x) => x.dataset.dia).join()) === '2026-11-15,2026-11-30', 'el calendario marca los días en que te pagan');
  ok(/Te pagan el 15 y el 30/.test(await T(p, '#calpag-res')), 'y lo dice abajo');

  // Dividir una cuenta
  await p.click('#td-dividir'); await esp(300);
  ok(await p.isVisible('#dlg-dividir'), 'Te deben tiene Dividir una cuenta');
  await p.fill('#dv-concepto', 'la cena'); await p.fill('#dv-total', '120.000'); await p.fill('#dv-quien', 'Ana, Luis y Carlos'); await esp(100);
  ok(/Son 4 contándote a ti: cada uno pone \$ 30\.000/.test(await T(p, '#dv-res')), 'divide en partes iguales contándote');
  const movsAntes = (await estado(p)).movs.length;
  await p.click('#dv-form button[type="submit"]'); await esp(500);
  st = await estado(p);
  const deben = st.meDeben.filter((x) => x.c === 'la cena');
  ok(deben.length === 3 && deben.every((x) => x.m === 30000) && ['Ana', 'Luis', 'Carlos'].every((n) => deben.some((x) => x.quien === n)), 'cada uno queda debiendo $ 30.000');
  ok(st.movs.length === movsAntes + 1 && st.movs[st.movs.length - 1].m === 30000, 'y tu parte queda anotada como gasto');

  // Retos de ahorro
  await pestana(p, 'metas'); await esp(400);
  ok(await p.isVisible('#rm-panel') && (await p.$$('#rm-lista [data-rm-nuevo]')).length === 4, 'hay 4 retos de ahorro para empezar');
  await p.click('#rm-lista [data-rm-nuevo="guarda"]'); await esp(300);
  ok(/Llevas \$ 0 guardados/.test(await T(p, '#rm-lista')), 'el reto empieza en cero');
  await p.click('#rm-lista [data-rm-check]'); await esp(300);
  ok(/Llevas \$ 5\.000 guardados en 1 día/.test(await T(p, '#rm-lista')) && await p.$eval('#rm-lista [data-rm-check]', (x) => x.disabled), 'Hoy guardé suma $ 5.000 y no deja marcar dos veces');
  await p.click('#rm-lista [data-rm-nuevo="domicilios"]'); await esp(300);
  ok(/Vas 1 día de 7 sin domicilios/.test(await T(p, '#rm-lista')), 'la semana sin domicilios cuenta los días');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta')); s.movs.push({ id: 'v9', f: '2026-11-20', h: 12, t: 'g', cat: 'alimentacion', c: 'Rappi almuerzo', m: 25000, com: 'Rappi' }); localStorage.setItem('presupuesto-web-sin-cuenta', JSON.stringify(s)); });
  await p.reload({ waitUntil: 'networkidle' }); await esp(900); await sinGuiado(p);
  await pestana(p, 'metas'); await esp(400);
  ok(/Hubo un domicilio el 20 de noviembre/.test(await T(p, '#rm-lista')) && /Volver a empezar/.test(await T(p, '#rm-lista')), 'un domicilio rompe el reto, sin regañar, y deja volver a empezar');

  ok(!errs.length, 'sin errores de página' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
