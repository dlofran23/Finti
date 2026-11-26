// ¿Dónde compro? con el boletín diario del DANE: "Así amanecieron los precios hoy", por ciudad, y el detalle de cada uno.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };

const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const HOY = iso(new Date());
const c = (precio, central, v) => [precio, central, precio, v];
const SIPSA = { fuente: 'DANE, SIPSA (boletín diario)', unidad: 'kg', tipo: 'diario', dia: HOY, semana: HOY, productos: [
  { n: 'Mora de Castilla', g: 7250, v: -1, b: ['Pasto, El Potrerillo', 5625], c: { 'Bogotá': c(7021, 'Bogotá, Corabastos', 0), 'Pasto': c(5625, 'Pasto, El Potrerillo', 1) } },
  { n: 'Papa criolla', g: 4767, v: -3, b: ['Popayán', 2129], c: { 'Bogotá': c(5694, 'Bogotá, Corabastos', -6), 'Popayán': c(2129, 'Popayán', -12) } },
  { n: 'Tomate', g: 3833, v: -1, b: ['Pasto, El Potrerillo', 3125], c: { 'Bogotá': c(3352, 'Bogotá, Corabastos', 4), 'Pasto': c(3125, 'Pasto, El Potrerillo', 2) } },
] };
for (let i = 0; i < 3; i++) SIPSA.productos.push({ n: 'Yuca ' + i, g: 2400, v: 0, b: ['Cartagena, Bazurto', 2000], c: { 'Bogotá': c(2458, 'Bogotá, Corabastos', 0) } });

(async () => {
  const b = await chromium.launch(); const errs = []; let pedidos = 0;
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/api/precios', (r) => { pedidos++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SIPSA) }); });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);

  await p.evaluate(() => document.getElementById('btn-donde-menu').click()); await p.waitForTimeout(600);
  const res = await p.textContent('#dc-res');
  ok(/Así amanecieron los precios hoy/.test(res), 'sin escribir nada muestra cómo amanecieron los precios hoy');
  ok(await p.$$eval('#dc-res .dc-prod', (l) => l.length) === 6, 'lista todos los productos del DANE');
  ok(/En el país/.test(res) && /Papa criolla\s*\$\s?4\.750/.test(res), 'con todo el país muestra la mediana nacional');
  ok(/Mejor precio: Popayán \(\$\s?2\.150\)/.test(res), 'dice dónde está más barato cada producto');
  ok(/hoy/.test(await p.textContent('#dc-nota')), 'la nota dice que los precios son de hoy');

  await p.selectOption('#dc-ciudad', 'Bogotá'); await p.waitForTimeout(250);
  const enB = await p.textContent('#dc-res');
  ok(/En Bogotá/.test(enB) && /Papa criolla\s*\$\s?5\.700/.test(enB), 'con ciudad elegida muestra el precio de esa ciudad');
  ok(await p.$$eval('#dc-res .dc-prod', (l) => l.length) === 6, 'en Bogotá están todos');
  const tomate = await p.textContent('#dc-res .dc-prod[data-p="Tomate"] .dc-tend');
  ok(/Sube 4/.test(tomate), 'la tendencia es la de la ciudad (tomate sube 4 % en Bogotá): ' + tomate);
  await p.click('#dc-res .dc-prod[data-p="Papa criolla"]'); await p.waitForTimeout(300);
  const det = await p.textContent('#dc-res');
  ok(await p.inputValue('#dc-lista') === 'Papa criolla', 'tocar un producto lo busca');
  ok(/Referencia del DANE de hoy/.test(det) && /5\.700 en Bogotá/.test(det) && /en el país, la central más barata es Popayán/.test(det), 'el detalle dice el precio en tu ciudad y dónde está más barato en el país: ' + det.slice(0, 160));
  ok(/Bajando/.test(await p.textContent('#dc-res .dc-tend')), 'la papa criolla está bajando en Bogotá');
  await p.fill('#dc-lista', ''); await p.click('#dc-form .btn.primary'); await p.waitForTimeout(200);
  ok(/Así amanecieron/.test(await p.textContent('#dc-res')), 'al borrar vuelve la lista del día');
  await p.click('#dlg-donde [data-close]'); await p.waitForTimeout(300);

  // Pregúntale con el boletín diario
  await p.evaluate(() => document.getElementById('btn-preguntas-menu').click()); await p.waitForTimeout(500);
  await p.fill('#pr-input', '¿cómo está la mora?'); await p.press('#pr-input', 'Enter'); await p.waitForTimeout(700);
  const r1 = await p.evaluate(() => { const m = document.querySelectorAll('#pr-log .pr-msg.app'); return m[m.length - 1].textContent; });
  ok(/Referencia del DANE de hoy/.test(r1) && /en Bogotá/.test(r1) && /frente al día de mercado anterior/.test(r1) && /mora de Castilla/.test(r1) && /en el país: Pasto/.test(r1), 'Pregúntale responde con los precios de hoy: ' + r1.slice(0, 200));

  // Los de ayer se dicen como de ayer, y se vuelven a pedir pasadas 2 horas
  await p.evaluate(() => { const k = 'fintelligente-sipsa', s = JSON.parse(localStorage.getItem(k)); const d = new Date(); d.setDate(d.getDate() - 1);
    s.d.dia = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); s.at = Date.now() - 3 * 36e5; localStorage.setItem(k, JSON.stringify(s)); });
  await ctx.unroute('**/api/precios');
  await ctx.route('**/api/precios', (r) => { pedidos++; r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); });
  const antes = pedidos;
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(700);
  await p.evaluate(() => document.getElementById('btn-donde-menu').click()); await p.waitForTimeout(600);
  ok(pedidos > antes, 'pasadas 2 horas vuelve a pedir los precios');
  ok(/Así amanecieron los precios ayer/.test(await p.textContent('#dc-res')), 'sin respuesta nueva usa los guardados y dice que son de ayer');

  ok(!errs.length, 'sin errores de página' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
