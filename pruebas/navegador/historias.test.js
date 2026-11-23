// Tu mes contado y Tu año contado: historias a pantalla completa e imagen para compartir sin montos.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, reducedMotion: 'reduce' });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  await p.evaluate(() => document.getElementById('btn-historia-menu').click()); await p.waitForTimeout(300);
  ok(await p.isVisible('#dlg-historia'), 'Tu mes contado se abre a pantalla completa');
  ok(/Tu (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/.test(await p.textContent('#hi-t')), 'empieza con la portada del mes');
  const n = await p.$$eval('#hi-barras span', (l) => l.length);
  ok(n >= 4, 'tiene ' + n + ' historias con su barra de avance');
  const vistos = [];
  for (let i = 0; i < n; i++) { vistos.push(await p.textContent('#hi-escena .hi-k')); if (i < n - 1) await p.click('#hi-sig'); await p.waitForTimeout(80); }
  ok(vistos.some((t) => /En qué se fue/.test(t)) && vistos.some((t) => /estrella/.test(t)) && vistos.some((t) => /ahorro/i.test(t)) && /Lo mejor/.test(vistos[vistos.length - 1]), 'cuenta en qué se fue, la estrella, el ahorro y lo mejor: ' + vistos.join(' / '));
  const sinMontos = await p.$eval('#hi-escena', (x) => !/\$\s?\d/.test(x.textContent));
  ok(sinMontos, 'la última historia no muestra montos');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.click('#hi-compartir')]);
  ok(!!dl && /-finti\.png$/.test(dl.suggestedFilename()), 'Compartir sin montos arma la imagen: ' + (dl && dl.suggestedFilename()));
  await p.click('#hi-ant'); await p.waitForTimeout(80);
  ok(await p.$$eval('#hi-barras span.ahora', (l) => l.length) === 1, 'se puede volver a la historia anterior');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok(!(await p.isVisible('#dlg-historia')), 'Escape la cierra');
  await p.evaluate(() => document.getElementById('btn-anio-menu').click()); await p.waitForTimeout(300);
  ok(/Tu \d{4}/.test(await p.textContent('#hi-t')) && /año/.test(await p.textContent('#hi-escena .hi-k')), 'Tu año contado también existe');
  await p.click('#hi-cerrar');
  ok(!errs.length, 'sin errores en la página: ' + errs.join(' | '));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
