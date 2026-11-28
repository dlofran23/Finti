// Detalle de categoría, pestañas que se deslizan, Por confirmar con gestos, letra grande y encabezado limpio.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(900);

  ok(!(await p.isVisible('.title-row')), 'en el Inicio el título del presupuesto da paso al saludo');
  await p.evaluate(() => document.querySelector('#tabs [data-tab="movimientos"]').click()); await p.waitForTimeout(100);
  ok(!(await p.isVisible('.title-row')), 'en Movimientos tampoco: como el prototipo, solo el nombre de la sección');
  ok(await p.$eval('[data-view="movimientos"]', (x) => x.classList.contains('entra-der') || x.classList.contains('entra-vt') || document.documentElement.classList.contains('con-vt')), 'la pestaña siguiente entra con su transición (deslizándose, o con el portal donde hay View Transitions)');
  await p.evaluate(() => document.querySelector('#tabs [data-tab="presupuesto"]').click()); await p.waitForTimeout(100);
  ok(await p.isVisible('.title-row'), 'el título del presupuesto está en Tu presupuesto');
  await p.evaluate(() => document.querySelector('#tabs [data-tab="inicio"]').click()); await p.waitForTimeout(100);
  ok(await p.$eval('[data-view="inicio"]', (x) => x.classList.contains('entra-izq') || x.classList.contains('entra-vt') || document.documentElement.classList.contains('con-vt')), 'y al volver, también con su transición');

  // Detalle de categoría
  await p.click('#donut-legend button[data-id="alimentacion"]'); await p.waitForTimeout(500);
  ok(await p.isVisible('#dlg-cat') && await p.textContent('#cd-t') === 'Alimentación', 'tocar una tarjeta abre el detalle de su categoría');
  ok(/\$/.test(await p.textContent('#cd-real')) && /planeados|sin plan/.test(await p.textContent('#cd-plan')), 'muestra lo gastado contra lo planeado');
  ok(await p.$$eval('#cd-hist rect', (l) => l.length) >= 1, 'gráfica de los últimos meses');
  ok(await p.$$eval('#cd-filas .cd-fila', (l) => l.length) >= 1, 'lista en qué se fue');
  ok(await p.textContent('#donut-k') === 'Alimentación', 'y la resalta entre las barras');
  await p.click('#dlg-cat [data-close]'); await p.waitForTimeout(200);
  await p.evaluate(() => (document.querySelector('#tabs [data-tab="analisis"]').click(), document.getElementById('an-detalle').getAttribute('aria-expanded') === 'true' || document.getElementById('an-detalle').click())); await p.waitForTimeout(200);
  await p.click('#cat-list [data-cat="vivienda"]'); await p.waitForTimeout(400);
  ok(await p.textContent('#cd-t') === 'Vivienda', 'en Análisis cada categoría también abre su detalle');
  await p.click('#dlg-cat [data-close]'); await p.evaluate(() => document.querySelector('#tabs [data-tab="inicio"]').click());

  // Por confirmar con gestos
  await p.evaluate(() => document.getElementById('btn-bandeja-menu').click()); await p.waitForTimeout(250);
  await p.fill('#pegar-texto', 'Bancolombia: Compraste $25.000,00 en EXITO CALLE 80 con tu T.Deb *1234, el 14/11/2026 a las 10:20.');
  await p.click('#pegar-leer'); await p.waitForTimeout(400);
  const card = await p.$('#bandeja-lista .mov'); const bb = await card.boundingBox();
  await p.mouse.move(bb.x + 50, bb.y + 20); await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(bb.x + 50 + i * 25, bb.y + 20);
  ok(await p.$eval('#bandeja-lista .mov', (x) => x.classList.contains('a-der')), 'al deslizar a la derecha dice Aceptar');
  await p.mouse.up(); await p.waitForTimeout(700);
  ok(await p.$$eval('#bandeja-lista .mov', (l) => l.length) === 0, 'soltar lo acepta');
  const mov = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta')); return s.movs[s.movs.length - 1]; });
  ok(mov && mov.m === 25000, 'el movimiento quedó anotado');
  await p.click('#dlg-bandeja [data-close]');

  // Letra grande
  await p.evaluate(() => document.getElementById('btn-colores').click()); await p.waitForTimeout(250);
  await p.click('#dlg-colores label[for="f-letra"]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.documentElement.classList.contains('letra-grande')), 'letra grande se activa en Colores y modo');
  await p.click('#dlg-colores [data-close]');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  ok(await p.evaluate(() => document.documentElement.classList.contains('letra-grande')), 'y se conserva al volver a abrir');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'con letra grande nada se sale de la pantalla');

  ok(!errs.length, 'sin errores en la página: ' + errs.join(' | '));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
