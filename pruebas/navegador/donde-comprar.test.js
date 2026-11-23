// ¿Dónde compro?: tus precios y los del DANE (SIPSA) por ciudad, en la pantalla y en Pregúntale.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };

const SIPSA = { fuente: 'DANE, SIPSA', unidad: 'kg', tipo: 'mayorista', semana: '2026-11-09', anterior: '2026-11-02', productos: [
  { n: 'Papa capira', g: 1750, v: 9.4, b: ['Bogotá, D.C., Corabastos', 1600], c: { 'Bogotá': [1675, 'Bogotá, D.C., Corabastos', 1600], 'Medellín': [1900, 'Medellín, Central Mayorista de Antioquia', 1900] } },
  { n: 'Papa criolla', g: 3100, v: -6, b: ['Tunja, Complejo de Servicios del Sur', 2500], c: { 'Bogotá': [2900, 'Bogotá, D.C., Corabastos', 2900] } },
  { n: 'Tomate chonto', g: 3077, v: 1, b: ['Cali, Cavasa', 2800], c: { 'Bogotá': [3300, 'Bogotá, D.C., Corabastos', 3300] } },
] };
// Para que Bogotá salga en la lista de ciudades se necesitan 5 productos con precio allí
for (let i = 0; i < 4; i++) SIPSA.productos.push({ n: 'Producto ' + i, g: 1000, v: 0, b: ['Bogotá, D.C., Corabastos', 1000], c: { 'Bogotá': [1000, 'Bogotá, D.C., Corabastos', 1000] } });

(async () => {
  const b = await chromium.launch(); const errs = []; let pedidos = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c.route('**/api/precios', (r) => { pedidos.push(r.request()); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SIPSA) }); });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  ok(pedidos.length === 0, 'no pide precios al abrir la app');

  // ---------- Pantalla ¿Dónde compro? ----------
  await p.evaluate(() => document.getElementById('btn-donde-menu').click()); await p.waitForTimeout(500);
  ok(await p.isVisible('#dlg-donde'), 'se abre desde el menú');
  ok(pedidos.length === 1 && pedidos[0].method() === 'GET' && !pedidos[0].postData(), 'trae los precios con un GET sin datos tuyos');
  await p.fill('#dc-lista', 'papa, tomate, champú'); await p.click('#dc-form .btn.primary'); await p.waitForTimeout(300);
  const res = await p.textContent('#dc-res');
  ok(/Papa capira: \$\s?1\.750 en el país/.test(res), 'muestra la referencia nacional: ' + res.slice(0, 90));
  ok(/Subiendo/.test(await p.textContent('#dc-res .dc-item:first-child .dc-tend')), 'dice que la papa está subiendo');
  ok(/Otras variedades: Papa criolla/.test(res), 'muestra otras variedades');
  ok(/El DANE no publica este producto/.test(res), 'explica cuando el DANE no tiene el producto (champú)');
  ok(await p.$$eval('#dc-ciudad option', (l) => l.map((o) => o.value)).then((v) => v.includes('Bogotá') && !v.includes('Medellín')), 'la lista de ciudades tiene las que tienen datos suficientes');
  await p.selectOption('#dc-ciudad', 'Bogotá'); await p.waitForTimeout(250);
  ok(/\$\s?1\.700 en Bogotá/.test(await p.textContent('#dc-res')), 'con ciudad elegida, muestra el precio de esa ciudad');
  ok(/semana del 9 de noviembre/.test(await p.textContent('#dc-nota')), 'dice de qué semana son los precios');
  await p.click('#dlg-donde [data-close]'); await p.waitForTimeout(300);
  ok(await p.isHidden('#dlg-donde'), 'la X cierra ¿Dónde compro?');

  // ---------- Pregúntale ----------
  await p.evaluate(() => document.getElementById('btn-preguntas-menu').click()); await p.waitForTimeout(500);
  await p.fill('#pr-input', '¿cómo está la papa?'); await p.press('#pr-input', 'Enter'); await p.waitForTimeout(700);
  const r1 = await p.evaluate(() => { const m = document.querySelectorAll('#pr-log .pr-msg.app'); return m[m.length - 1].textContent; });
  ok(/Referencia del DANE/.test(r1) && /en Bogotá/.test(r1) && /subió/.test(r1), 'Pregúntale responde con el DANE y la ciudad elegida: ' + r1.slice(0, 120));
  ok(await p.$('#pr-chips .pr-chip:has-text("¿Dónde compro papa?")') !== null || /Dónde compro/.test(await p.textContent('#pr-log')), 'ofrece ir a ¿Dónde compro?');
  await p.fill('#pr-input', '¿Dónde compro papa?'); await p.press('#pr-input', 'Enter'); await p.waitForTimeout(1200);
  ok(await p.isVisible('#dlg-donde') && /papa/i.test(await p.inputValue('#dc-lista')), 'el botón abre ¿Dónde compro? con el producto');
  await p.click('#dlg-donde [data-close]');

  // ---------- Sin internet: usa lo guardado ----------
  const antes = pedidos.length;
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(700);
  await p.evaluate(() => document.getElementById('btn-donde-menu').click()); await p.waitForTimeout(400);
  await p.fill('#dc-lista', 'tomate'); await p.click('#dc-form .btn.primary'); await p.waitForTimeout(300);
  ok(pedidos.length === antes && /Tomate chonto/.test(await p.textContent('#dc-res')), 'usa los precios guardados sin volver a pedirlos');

  ok(!errs.length, 'sin errores de página' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
