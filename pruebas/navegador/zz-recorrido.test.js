// Graba el recorrido para decidir: cada escena con el screencast de Chrome (JPEG 92) y sus marcas de tiempo.
require('./sin-bienvenida.js');
const { chromium } = require('playwright'); const fs = require('fs'); const pagarCon = require('./_pagar-con.js');
const OUT = '/tmp/rec';
const SIPSA = { semana: '2026-11-09', productos: [
  { n: 'Papa capira', g: 1750, v: 9.4, b: ['Bogotá, D.C., Corabastos', 1600], c: { 'Bogotá': [1675, 'Bogotá, D.C., Corabastos', 1600] } },
  { n: 'Papa criolla', g: 3100, v: -6, b: ['Tunja, Complejo de Servicios del Sur', 2500], c: { 'Bogotá': [2900, 'Bogotá, D.C., Corabastos', 2900] } },
  { n: 'Tomate chonto', g: 3077, v: -8, b: ['Cali, Cavasa', 2800], c: { 'Bogotá': [3300, 'Bogotá, D.C., Corabastos', 3300] } },
  { n: 'Arroz de primera', g: 4200, v: 0.5, b: ['Cali, Cavasa', 4000], c: { 'Bogotá': [4300, 'Bogotá, D.C., Corabastos', 4300] } }] };
const esp = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  await c.route('**/api/precios', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SIPSA) }));
  await c.addInitScript(() => { const s = document.createElement('style'); s.textContent = '#example-notice{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s)); });
  const p = await c.newPage(); const cdp = await c.newCDPSession(p);
  let escena = null, n = 0, marcas = [];
  cdp.on('Page.screencastFrame', async (f) => {
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) {}
    if (!escena) return;
    const nom = String(n++).padStart(5, '0') + '.jpg';
    fs.writeFileSync(`${OUT}/${escena}/${nom}`, Buffer.from(f.data, 'base64')); marcas.push([nom, f.metadata.timestamp]);
  });
  async function grabar(id, fn) {
    fs.rmSync(`${OUT}/${id}`, { recursive: true, force: true }); fs.mkdirSync(`${OUT}/${id}`, { recursive: true });
    escena = id; n = 0; marcas = [];
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
    const t0 = Date.now() / 1000; await esp(120);
    await fn();
    const t1 = Date.now() / 1000;
    await cdp.send('Page.stopScreencast'); await esp(150);
    fs.writeFileSync(`${OUT}/${id}/marcas.json`, JSON.stringify({ t0, t1, marcas }));
    escena = null; console.log('escena', id, marcas.length, 'cuadros', (t1 - t0).toFixed(1), 's');
  }
  const tocar = async (sel) => { await p.tap(sel); };
  const say = async (t) => { await p.type('#ch-input', t, { delay: 45 }); await p.press('#ch-input', 'Enter'); };

  // 1. Pantalla de carga e Inicio de noche
  await grabar('s1', async () => {
    await p.goto(process.env.BASE, { waitUntil: 'commit' });
    await esp(3600);
    await p.evaluate(() => { const b = document.getElementById('banda'); b.classList.remove('dia'); b.classList.add('noche'); });
    await esp(2200);
    await p.evaluate(() => window.scrollTo({ top: 520, behavior: 'smooth' })); await esp(1800);
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await esp(1500);
  });
  // 2. El sol y la luna
  await grabar('s2', async () => {
    await esp(900);
    await p.evaluate(() => { const b = document.getElementById('banda'); b.classList.remove('noche'); b.classList.add('dia'); document.getElementById('saludo-h').textContent = 'Buenos días. Vas un poco rápido este mes.'; });
    await esp(2600);
    await p.evaluate(() => { const b = document.getElementById('banda'); b.classList.remove('dia'); b.classList.add('noche'); document.getElementById('saludo-h').textContent = 'Buenas noches. Vas un poco rápido este mes.'; });
    await esp(2600);
  });
  // 3. La barra en isla
  await grabar('s3', async () => {
    await esp(700);
    await tocar('#barra [data-ir="movimientos"]'); await esp(1600);
    await tocar('#barra [data-ir="metas"]'); await esp(1600);
    await tocar('#barra [data-ir="inicio"]'); await esp(1500);
  });
  // 4. ¿En qué se va tu plata?
  await grabar('s4', async () => {
    await p.evaluate(() => { const r = document.getElementById('h-donut').getBoundingClientRect(); window.scrollTo({ top: r.top + scrollY - 90, behavior: 'smooth' }); }); await esp(1500);
    await tocar('#donut-modo [data-dm="semana"]'); await esp(1600);
    await tocar('#donut-modo [data-dm="mes"]'); await esp(1800);
  });
  // 5. Te deben
  await grabar('s5', async () => {
    await p.evaluate(() => { location.hash = '#cuentas'; }); await esp(700);
    await p.evaluate(() => { const r = document.getElementById('tedeben-panel').getBoundingClientRect(); window.scrollTo({ top: r.top + scrollY - 140, behavior: 'smooth' }); }); await esp(1300);
    await tocar('#td-preste'); await esp(900);
    await p.type('#dd-quien', 'Caro', { delay: 70 }); await p.type('#dd-monto', '50000', { delay: 70 }); await esp(500);
    await tocar('#dd-ok'); await esp(1800);
    await pagarCon(p); await esp(900); await say('sí'); await esp(1800);
    await p.evaluate(() => document.querySelector('#dlg-charla [data-close]').click()); await esp(1800);
  });
  // 6. ¿Dónde compro?
  await grabar('s6', async () => {
    await p.evaluate(() => document.getElementById('btn-donde-menu').click()); await esp(1000);
    await p.type('#dc-lista', 'papa, tomate, arroz', { delay: 55 }); await esp(300);
    await tocar('#dc-form .btn.primary'); await esp(2600);
    await p.evaluate(() => document.querySelector('#dlg-donde .dlg').scrollBy({ top: 320, behavior: 'smooth' })); await esp(2200);
    await p.evaluate(() => document.querySelector('#dlg-donde [data-close]').click()); await esp(700);
  });
  // 7. Pregúntale
  await grabar('s7', async () => {
    await p.evaluate(() => document.getElementById('btn-preguntas-menu').click()); await esp(1200);
    await p.type('#pr-input', '¿cómo está la papa?', { delay: 55 }); await p.press('#pr-input', 'Enter'); await esp(2800);
    await p.type('#pr-input', '¿quién me debe plata?', { delay: 55 }); await p.press('#pr-input', 'Enter'); await esp(3000);
  });
  await b.close();
})();
