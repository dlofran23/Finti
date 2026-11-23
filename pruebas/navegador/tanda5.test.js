// Buscar movimientos e informe del mes en PDF con la identidad nueva.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await c.clock.setFixedTime(new Date('2026-11-27T19:10:00'));
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.evaluate(() => { const f = document.getElementById('f-letra'); f.checked = true; f.dispatchEvent(new Event('change')); f.checked = false; f.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    const K = Object.keys(localStorage).find((k) => /sin-cuenta$/.test(k)), S = JSON.parse(localStorage.getItem(K));
    S.movs.push({ id: 'a', f: '2026-11-20', h: 13, t: 'g', cat: 'ocio', c: 'Rappi', m: 38900, com: 'Rappi' });
    S.movs.push({ id: 'b', f: '2026-10-12', h: 9, t: 'g', cat: 'alimentacion', c: 'Mercado', m: 186400, com: 'Éxito' });
    S.movs.push({ id: 'c', f: '2026-11-21', h: 12, t: 'g', cat: 'alimentacion', c: 'Almuerzo', m: 18000, com: 'Corrientazo' });
    S.movs.push({ id: 'd', f: '2026-11-22', h: 17, t: 'i', cat: '', c: 'Venta de postres', m: 45000, com: '' });
    localStorage.setItem(K, JSON.stringify(S)); localStorage.setItem(K + '-t', String(Date.now() + 60000));
  });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  ok(await p.evaluate(() => window.FinBuscar('rappi')) === 1, 'busca por comercio');
  ok(await p.evaluate(() => window.FinBuscar('18 mil')) === 1 && await p.evaluate(() => window.FinBuscar('18.000')) === 1, 'busca por valor, escrito de varias formas');
  ok(await p.evaluate(() => window.FinBuscar('mercado de octubre')) === 1 && await p.evaluate(() => window.FinBuscar('mercado de noviembre')) === 0, 'busca por mes');
  ok(await p.evaluate(() => window.FinBuscar('salidas')) === 1, 'busca por el nombre de la categoría');
  ok(await p.evaluate(() => window.FinBuscar('postres', 'g')) === 0 && await p.evaluate(() => window.FinBuscar('postres', 'i')) === 1, 'filtra gastos e ingresos');
  await p.evaluate(() => document.getElementById('btn-buscar-menu').click()); await p.waitForTimeout(200);
  ok(await p.isVisible('#dlg-buscar'), 'Buscar movimientos se abre desde el menú');
  await p.fill('#bs-q', 'almuerzo'); await p.waitForTimeout(100);
  ok(/1 movimiento/.test(await p.textContent('#bs-res')) && /12:00 m\./.test(await p.textContent('#bs-lista')), 'muestra el resultado con su hora: ' + await p.textContent('#bs-res'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok(!(await p.isVisible('#dlg-buscar')), 'Escape cierra la búsqueda');
  await p.evaluate(() => document.querySelector('[data-tab="movimientos"], [data-goto="movimientos"]').click()); await p.waitForTimeout(200);
  await p.evaluate(() => document.getElementById('bs-entrada').click()); await p.waitForTimeout(150);
  ok(await p.isVisible('#dlg-buscar'), 'también se busca desde Movimientos');
  await p.keyboard.press('Escape');
  // Informe
  await p.evaluate(() => { window.print = () => { window.__impreso = true; }; document.getElementById('btn-informe').click(); }); await p.waitForTimeout(300);
  const inf = await p.evaluate(() => ({ t: document.getElementById('informe').textContent, graf: document.querySelectorAll('#informe .inf-graf').length, logo: !!document.querySelector('#informe .inf-logo'), impreso: !!window.__impreso }));
  ok(inf.impreso && inf.logo && /Lo mejor del mes/.test(inf.t) && inf.graf >= 1, 'el informe trae el logo, lo mejor del mes y la gráfica por categoría');
  ok(!errs.length, 'sin errores en la página: ' + errs.join(' | '));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
