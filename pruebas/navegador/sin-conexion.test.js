// La app abre sin conexión: el service worker guarda la página y el script principal (/app.js?v=…).
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  ok(/\/app\.js\?v=[0-9a-f]{12}$/.test(await p.evaluate(() => [...document.scripts].map((s) => s.src).find((s) => /app\.js/.test(s)) || '')), 'el script principal se carga aparte, con su huella');
  ok(await p.evaluate(() => typeof window.FinBuscar === 'function'), 'la app arranca con el script aparte');
  await p.evaluate(() => navigator.serviceWorker.ready); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  const guardado = await p.evaluate(async () => { const ks = await (await caches.open('fintelligente-v4')).keys(); return ks.map((k) => new URL(k.url).pathname); });
  ok(guardado.includes('/') && guardado.includes('/app.js'), 'el service worker guardó la página y el script: ' + guardado.join(', '));
  await c.setOffline(true);
  await p.reload({ waitUntil: 'load' }).catch(() => {}); await p.waitForTimeout(800);
  ok(await p.evaluate(() => typeof window.FinBuscar === 'function' && !!document.getElementById('hoy-card')), 'sin conexión la app abre igual');
  ok(!errs.length, 'sin errores en la página: ' + errs.join(' | '));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
