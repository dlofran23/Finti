// Precios que comparte la gente: solo con permiso, anónimos (producto y cadena de listas cerradas, ciudad, precio y
// día; sin cookies), y lo que pagó la gente en cada cadena en ¿Dónde compro? y en Pregúntale.
require('./sin-bienvenida.js');
const { chromium } = require('playwright'); const pagarCon = require('./_pagar-con.js');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch(); const errs = [], envios = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const HOY = new Date().toISOString().slice(0, 10);
  await ctx.route('**/api/precios', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));   // sin DANE: la ciudad sale de la lista de la gente
  await ctx.route('**/api/precios-gente', async (r) => {
    const q = r.request();
    if (q.method() === 'POST') { envios.push({ body: JSON.parse(q.postData()), cookie: (await q.allHeaders()).cookie || '' }); return r.continue(); }
    const real = await (await r.fetch()).json();
    real.ciudades = { 'Bogotá': { 'arroz|u': [['D1', 4100, 5, HOY], ['Éxito', 4600, 3, HOY]] } };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(real) });
  });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const estado = () => p.evaluate(() => { const K = Object.keys(localStorage).find((k) => /sin-cuenta$/.test(k)); return JSON.parse(localStorage.getItem(K)); });
  async function contar(txt) {
    await p.click('#hoy-registrar'); await p.waitForTimeout(400);
    await p.fill('#ch-input', txt); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(500);
    await pagarCon(p); await p.waitForTimeout(500);
    await p.click('#ch-chips [data-ch="cerrar"]'); await p.waitForTimeout(300);
  }
  await contar('hoy en el D1 compré arroz de 4.200, papa criolla de 5.000 y un regalo para mi mamá de 30.000');
  await contar('hoy en la tienda de don Pedro compré leche de 4.000');

  // ---------- Pregunta antes de compartir ----------
  await p.evaluate(() => document.getElementById('btn-donde-menu').click()); await p.waitForTimeout(800);
  ok(await p.isVisible('#dc-aportar') && /¿Ayudas a otros a comprar más barato\?/.test(await p.textContent('#dc-aportar')), 'pregunta si quiere compartir sus precios');
  await p.click('#dc-aportar [data-aportar="no"]'); await p.waitForTimeout(400);
  ok((await estado()).prefs.aportar === 'no' && /No compartes tus precios/.test(await p.textContent('#dc-aportar')), '"Ahora no" queda guardado y se puede cambiar');
  ok(envios.length === 0, 'sin permiso no envía nada');

  ok(await p.$$eval('#dc-ciudad option', (l) => l.map((o) => o.value)).then((v) => v.includes('Cali') && v.includes('Bogotá')), 'la lista de ciudades incluye las de la gente (Cali)');
  await p.selectOption('#dc-ciudad', 'Bogotá'); await p.waitForTimeout(300);
  await p.click('#dc-aportar [data-aportar="si"]'); await p.waitForTimeout(1200);
  ok((await estado()).prefs.aportar === 'si', 'al aceptar queda guardado');
  ok(envios.length === 1, 'al aceptar envía sus precios: ' + envios.length);
  const e = envios[0] || { body: {} }, ap = e.body.aportes || [];
  ok(e.body.ciudad === 'Bogotá' && Object.keys(e.body).sort().join() === 'aportes,ciudad', 'manda solo la ciudad y los precios');
  ok(ap.length === 2 && ap.every((a) => Object.keys(a).sort().join() === 'c,d,p,u,v' && a.c === 'd1' && a.d === (new Date(Date.now() - new Date().getTimezoneOffset() * 6e4)).toISOString().slice(0, 10)), 'cada precio lleva solo producto, cadena, unidad, valor y día: ' + JSON.stringify(ap));
  ok(ap.some((a) => a.p === 'arroz' && a.v === 4200) && ap.some((a) => a.p === 'papa criolla'), 'arroz y papa criolla del D1');
  ok(!JSON.stringify(e.body).match(/regalo|mam|pedro|leche|30000/i), 'no manda lo que no es de la lista ni lo de tiendas que no son cadenas');
  ok(!e.cookie, 'sin cookies');
  const guardado = await (await p.request.get(BASE + '/__gente')).json();
  ok(guardado['c-bogota'] && guardado['c-bogota'].a['arroz|u'].d1[0][1] === 4200, 'el servidor lo guardó por ciudad, producto y cadena');

  // No vuelve a mandar lo mismo
  await p.click('#dc-aportar [data-aportar="no"]'); await p.waitForTimeout(200);
  await p.click('#dc-aportar [data-aportar="si"]'); await p.waitForTimeout(1000);
  ok(envios.length === 1, 'no vuelve a mandar lo que ya mandó');

  // ---------- Lo que pagó la gente ----------
  await p.fill('#dc-lista', 'arroz'); await p.click('#dc-form .btn.primary'); await p.waitForTimeout(400);
  const res = await p.textContent('#dc-res');
  ok(/Lo que pagó la gente en Bogotá, últimos 14 días/.test(res) && /D1\s*\$\s?4\.100 la unidad\s*5 personas/.test(res) && /Éxito\s*\$\s?4\.600/.test(res), 'muestra lo que pagó la gente en cada cadena: ' + res.slice(0, 220));
  await p.click('#dlg-donde [data-close]'); await p.waitForTimeout(300);
  await p.evaluate(() => document.getElementById('btn-preguntas-menu').click()); await p.waitForTimeout(500);
  await p.fill('#pr-input', '¿cómo está el arroz?'); await p.press('#pr-input', 'Enter'); await p.waitForTimeout(700);
  const r1 = await p.evaluate(() => { const m = document.querySelectorAll('#pr-log .pr-msg.app'); return m[m.length - 1].textContent; });
  ok(/La gente en Bogotá pagó menos en D1: \$\s?4\.100 la unidad \(5 personas; en Éxito, \$\s?4\.600\)/.test(r1), 'Pregúntale cuenta lo que pagó la gente: ' + r1.slice(0, 200));

  ok(!errs.length, 'sin errores de página' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
