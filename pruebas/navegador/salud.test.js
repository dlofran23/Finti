// Salud técnica en el navegador: los errores llegan sin datos personales, las métricas se envían una vez al día,
// "No rastrear" se respeta y el panel muestra todo con su clave.
require('./sin-bienvenida.js');
const CAPTURAS = require('path').join(__dirname, 'capturas'); require('fs').mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const salud = () => fetch(BASE + '/__salud').then((r) => r.json());
const hoy = (s) => Object.keys(s).filter((k) => k.startsWith('metricas/')).sort().map((k) => s[k]).pop() || {};
const errores = (s) => Object.keys(s).filter((k) => k.startsWith('errores/')).flatMap((k) => Object.values(s[k]));
const total = (ev) => Object.values(ev || {}).reduce((a, b) => a + b, 0);

(async () => {
  const b = await chromium.launch();
  // El servidor de pruebas es compartido con otras pruebas: se miden diferencias, no totales.
  const pc0 = (hoy(await salud()).abrir || {}).pc || 0;
  const c = await b.newContext({ viewport: { width: 1200, height: 900 } }); const p = await c.newPage();
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(2200);
  let s = await salud();
  ok(hoy(s).abrir.pc === pc0 + 1, 'al abrir la app se cuenta una apertura del computador');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2200);
  s = await salud();
  ok(hoy(s).abrir.pc === pc0 + 1, 'volver a abrir el mismo día no cuenta de nuevo');
  const n0 = (errores(s).find((x) => /Falla de prueba/.test(x.m)) || { n: 0 }).n;

  // Un error real en la página
  await p.evaluate(() => setTimeout(() => { throw new Error('Falla de prueba con saldo 1250000 de ana@correo.com'); }, 0));
  await p.evaluate(() => { Promise.reject(new TypeError('Failed to fetch')); });
  await p.waitForTimeout(800);
  s = await salud();
  const e = errores(s).find((x) => /Falla de prueba/.test(x.m));
  ok(!!e && /Falla de prueba con saldo # de @$/.test(e.m) && e.v && e.plat.pc >= 1 && e.n === n0 + 1, 'el error llega sin números ni correo: "' + (e && e.m) + '"');
  ok(!errores(s).some((x) => /Failed to fetch/.test(x.m)), 'quedarse sin conexión no se reporta como error');
  await p.evaluate(() => setTimeout(() => { throw new Error('Falla de prueba con saldo 1250000 de ana@correo.com'); }, 0));
  await p.waitForTimeout(500);
  ok(errores(await salud()).find((x) => /Falla de prueba/.test(x.m)).n === n0 + 1, 'el mismo error no se envía dos veces desde la misma pantalla');

  // Ver Premium
  await p.evaluate(() => { const b = document.getElementById('btn-premium'); if (b) b.click(); }); await p.waitForTimeout(500);
  ok(total(hoy(await salud()).vio_premium) >= 1, 'abrir Premium se cuenta (una vez al día)');
  await c.close();

  // No rastrear: nada de métricas
  const antes = total(hoy(await salud()).abrir);
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' });
  await c2.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }));
  const q = await c2.newPage(); await q.goto(BASE, { waitUntil: 'networkidle' }); await q.waitForTimeout(2200);
  ok(total(hoy(await salud()).abrir) === antes, 'con "No rastrear" (Control Global de Privacidad) no se envían métricas');
  await c2.close();
  const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' });
  const and0 = (hoy(await salud()).abrir || {}).android || 0;
  const r = await c3.newPage(); await r.goto(BASE, { waitUntil: 'networkidle' }); await r.waitForTimeout(2200);
  ok(hoy(await salud()).abrir.android === and0 + 1, 'un Android cuenta como Android');
  await c3.close();

  // Panel
  const c4 = await b.newContext({ viewport: { width: 1200, height: 900 } }); const pn = await c4.newPage(); const perr = [];
  pn.on('pageerror', (x) => perr.push(x.message));
  await pn.goto(BASE + '/panel', { waitUntil: 'networkidle' });
  ok(await pn.isVisible('#clave'), 'el panel pide la clave');
  await pn.fill('#clave', 'una-clave-equivocada'); await pn.click('#f-clave button'); await pn.waitForTimeout(400);
  ok(/incorrecta/.test(await pn.textContent('#msg')) && !(await pn.isVisible('#datos')), 'con la clave equivocada no muestra nada');
  await pn.fill('#clave', 'clave-de-prueba-del-panel'); await pn.click('#f-clave button'); await pn.waitForTimeout(600);
  ok(await pn.isVisible('#datos') && /Aperturas/.test(await pn.textContent('#tiles')), 'con la clave correcta muestra el panel');
  ok(/Falla de prueba con saldo # de @/.test(await pn.textContent('#errores')), 'muestra los errores de la semana');
  ok(/Computador/.test(await pn.textContent('#plataformas')) && /Android/.test(await pn.textContent('#plataformas')), 'separa por tipo de dispositivo');
  ok((await pn.$$('#grafica rect[data-i]')).length === 30, 'gráfica de 30 días');
  await pn.hover('#grafica rect[data-i="29"]'); await pn.waitForTimeout(100);
  ok(/apertura/.test(await pn.textContent('#tip')), 'al pasar el cursor muestra el valor del día');
  await pn.screenshot({ path: require('path').join(CAPTURAS, 'panel.png'), fullPage: true });
  await pn.reload({ waitUntil: 'networkidle' }); await pn.waitForTimeout(500);
  ok(await pn.isVisible('#datos'), 'la clave se recuerda mientras la pestaña siga abierta');
  ok(!perr.length, 'el panel no tiene errores de JavaScript ' + perr.join(' '));
  await c4.close();

  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO BIEN (salud técnica)');
  await b.close();
})();
