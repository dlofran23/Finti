// Inicio con ánimo, Tu día, pronóstico, ¿Y si…?, carta del domingo y decoración de temporada.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };

async function abrir(b, fecha) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await c.clock.setFixedTime(new Date(fecha));
  const p = await c.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  // Forzar un guardado y sembrar movimientos de las dos últimas semanas y de hoy
  await p.evaluate(() => { const f = document.getElementById('f-letra'); f.checked = true; f.dispatchEvent(new Event('change')); f.checked = false; f.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    const K = Object.keys(localStorage).find((k) => /sin-cuenta$/.test(k)), S = JSON.parse(localStorage.getItem(K));
    const hoy = new Date(), pad = (n) => String(n).padStart(2, '0'), f = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const ids = S.meses[Object.keys(S.meses).sort().pop()].gastos.map((g) => g.cat);
    for (let i = 1; i < 14; i++) { const d = new Date(hoy); d.setDate(d.getDate() - i); S.movs.push({ id: 's' + i, f: f(d), h: 13, t: 'g', cat: ids[(i * 3) % ids.length], c: '', m: 20000 + i * 1000, com: '' }); }
    S.movs.push({ id: 'h1', f: f(hoy), h: 8, t: 'g', cat: ids[1], c: 'Bus al trabajo', m: 3200, com: '' });
    S.movs.push({ id: 'h2', f: f(hoy), h: 17, t: 'i', cat: '', c: 'Venta de postres', m: 45000, com: '' });
    localStorage.setItem(K, JSON.stringify(S)); localStorage.setItem(K + '-t', String(Date.now() + 60000));
  });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  return p;
}

(async () => {
  const b = await chromium.launch();
  // Domingo de diciembre por la noche
  let p = await abrir(b, '2026-12-13T19:10:00');
  ok(await p.evaluate(() => document.documentElement.classList.contains('navidad')), 'en diciembre la app se viste de Navidad');
  ok(/moneda crece/.test(await p.getAttribute('#saludo-mascota', 'aria-label')), 'la mascota explica que la moneda crece con el ahorro');
  ok(['bien', 'calma', 'rapido', 'neg', 'nuevo'].includes(await p.getAttribute('#saludo', 'data-animo')), 'el saludo tiene un ánimo según el mes');
  ok(await p.isVisible('#carta'), 'el domingo aparece la carta de la semana');
  ok(/Esta semana gastaste \$/.test(await p.textContent('#carta-cuerpo')), 'la carta cuenta el gasto de la semana');
  await p.click('#carta-ok'); await p.waitForTimeout(100);
  ok(!(await p.isVisible('#carta')), 'Gracias guarda la carta');
  // Como el prototipo, Tu día y el pronóstico están en Análisis
  await p.evaluate(() => (document.querySelector('#tabs [data-tab="analisis"]').click(), document.getElementById('an-detalle').getAttribute('aria-expanded') === 'true' || document.getElementById('an-detalle').click())); await p.waitForTimeout(300);
  ok(await p.isVisible('#tu-dia'), 'Tu día está en Análisis');
  const linea = await p.textContent('#td-linea');
  ok(/8:00 a\. m\./.test(linea) && /Bus al trabajo/.test(linea) && /Venta de postres/.test(linea), 'Tu día muestra lo de hoy en orden, con la hora');
  ok(await p.isVisible('#pron') && /(cierras el mes con|te faltarían)/.test(await p.textContent('#pron-frase')), 'el pronóstico dice cómo cierra el mes');
  await p.click('#pron-ysi'); await p.waitForTimeout(200);
  ok(await p.isVisible('#dlg-ysi'), '¿Y si…? se abre desde el pronóstico');
  ok(/En un año/.test(await p.textContent('#ysi-res-r')), 'muestra cuánto se ahorra en 3, 6 y 12 meses');
  await p.click('#ysi-tab-c'); await p.fill('#ysi-monto', '350 mil'); await p.waitForTimeout(100);
  ok(/(Te alcanza|no alcanza)/.test(await p.textContent('#ysi-res-c')), 'si compro algo, dice si alcanza');
  await p.keyboard.press('Escape');
  // Apagar la decoración
  await p.evaluate(() => { const f = document.getElementById('f-temporada'); f.checked = false; f.dispatchEvent(new Event('change')); });
  ok(!(await p.evaluate(() => document.documentElement.classList.contains('navidad'))), 'la decoración se puede apagar');
  ok(!p.errs.length, 'sin errores en diciembre: ' + p.errs.join(' | '));
  await p.context().close();
  // Un miércoles de noviembre: sin carta ni Navidad, pero la carta se abre desde el menú
  p = await abrir(b, '2026-11-18T10:20:00');
  ok(!(await p.evaluate(() => document.documentElement.classList.contains('navidad'))), 'en noviembre no hay Navidad');
  ok(!(await p.isVisible('#carta')), 'entre semana no aparece la carta sola');
  await p.evaluate(() => document.getElementById('btn-carta-menu').click()); await p.waitForTimeout(300);
  ok(await p.isVisible('#carta') && /Semana del 9 al 15/.test(await p.textContent('#carta-k')), 'desde el menú se lee la carta de la semana pasada');
  ok(!p.errs.length, 'sin errores en noviembre: ' + p.errs.join(' | '));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
