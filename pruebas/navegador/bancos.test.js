// Bancos conocidos (28-nov-2026): al agregar una cuenta se elige la entidad de una lista (bancos de Colombia,
// billeteras, cooperativas e internacionales); la tarjeta toma el color de la entidad y las cuentas viejas lo toman
// por su nombre.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const esp = (ms) => new Promise((r) => setTimeout(r, ms));
const estado = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta')));
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#inicio', { waitUntil: 'networkidle' }); await esp(1200);
  if (await p.isVisible('#dlg-inicio')) { await p.keyboard.press('Escape'); await esp(400); }
  await p.evaluate(() => document.querySelector('#tabs [data-tab="cuentas"]').click()); await esp(300);
  await p.click('#add-cuenta'); await esp(300);
  ok(await p.isVisible('#dlg-bancos'), 'agregar cuenta abre la lista de entidades');
  const grupos = await p.$$eval('#bk-res .bk-grupo', (x) => x.map((h) => h.textContent));
  ok(['Billeteras y bancos digitales', 'Bancos de Colombia', 'Cooperativas y financieras', 'Internacionales'].every((g) => grupos.includes(g)), 'por grupos: ' + grupos.join(', '));
  const n = await p.$$eval('#bk-res [data-banco]', (x) => x.length);
  await p.screenshot({ path: require('path').join(__dirname, 'capturas', 'bancos.png') });
  ok(n >= 50, 'muchas entidades conocidas: ' + n);
  for (const nom of ['Bancolombia', 'Nequi', 'Davivienda', 'Banco de Bogotá', 'Nu', 'Lulo Bank', 'PayPal', 'Wise']) ok(await p.locator('#bk-res .bk-carta', { hasText: nom }).count() > 0, 'está ' + nom);
  await p.fill('#bk-buscar', 'bogota'); await esp(100);
  ok((await p.$$eval('#bk-res [data-banco]:not([data-banco^="="])', (x) => x.map((e) => e.textContent))).join() === 'Banco de Bogotá', 'la búsqueda sin tilde encuentra Banco de Bogotá');
  await p.fill('#bk-buscar', ''); await esp(100);
  await p.click('#bk-res [data-banco="bancolombia"]'); await esp(400);
  let st = await estado(p), cu = st.cuentas[st.cuentas.length - 1];
  ok(!(await p.isVisible('#dlg-bancos')) && cu.nombre === 'Bancolombia' && cu.banco === 'bancolombia' && cu.tipo === 'banco', 'eligió Bancolombia: queda la cuenta con su entidad');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.dataset.f === 'saldo'), 'y queda lista para poner el saldo');
  const fondo = await p.$eval('.bt-carta[data-bt="' + cu.id + '"]', (e) => e.getAttribute('style'));
  ok(/#fdda24/i.test(fondo) && /--tinta:#2c2a29/.test(fondo), 'la tarjeta de Bancolombia es amarilla con letra oscura');
  // Tarjeta de crédito de un banco
  await p.click('#add-cuenta'); await esp(300); await p.click('#bk-tc'); await p.click('#bk-res [data-banco="davivienda"]'); await esp(400);
  st = await estado(p); cu = st.cuentas[st.cuentas.length - 1];
  ok(cu.tipo === 'tarjeta' && /Davivienda/.test(cu.nombre) && cu.banco === 'davivienda', 'tarjeta de crédito de Davivienda');
  ok(/#e01b22/i.test(await p.$eval('.bt-carta[data-bt="' + cu.id + '"]', (e) => e.getAttribute('style'))), 'con el rojo de Davivienda');
  // Una entidad que no está
  await p.click('#add-cuenta'); await esp(300); await p.fill('#bk-buscar', 'Banco Inventado'); await esp(100); await p.click('#bk-res [data-banco="=otra"]'); await esp(400);
  st = await estado(p); cu = st.cuentas[st.cuentas.length - 1];
  ok(cu.nombre === 'Banco Inventado' && !cu.banco, 'si no está, se agrega con el nombre escrito');
  // Una cuenta vieja toma el color por su nombre
  ok(await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta')); return s.cuentas.some((x) => /nequi/i.test(x.nombre)); }), 'hay una cuenta de Nequi de antes');
  ok(await p.evaluate(() => [...document.querySelectorAll('.acct')].some((a) => /Nequi/.test(a.querySelector('[data-f="nombre"]').value) && /#da0081/i.test(a.getAttribute('style')))), 'y toma el color de Nequi por su nombre');
  ok(!errs.length, 'sin errores de página' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
