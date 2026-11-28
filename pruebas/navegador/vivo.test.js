// Todo se siente vivo (28-nov-2026): sistema de movimiento común, cifras que saltan al cambiar, barras que se llenan,
// la tarjeta flotante que se aparta al bajar, esqueletos mientras carga, "Cuéntame un gasto" sin cortarse y nada de
// movimiento con "reducir movimiento".
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const esp = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  ok(await p.evaluate(() => document.body.classList.contains('vivo-arranque')), 'al arrancar, las barras se llenan');
  await p.waitForLoadState('networkidle'); await esp(1900);
  ok(await p.evaluate(() => !document.body.classList.contains('vivo-arranque')), 'y después la app queda quieta');
  ok(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--curva-resorte').includes('cubic-bezier')), 'hay curvas y tiempos comunes para toda la app');

  // "Cuéntame un gasto" no se corta en un celular angosto
  const cu = await p.evaluate(() => { const b = document.getElementById('hoy-registrar'), s = b.querySelector('span'); return { t: b.textContent, ej: getComputedStyle(b.querySelector('.ini-ej')).display, corta: s.scrollWidth > s.clientWidth + 1 }; });
  ok(/^Cuéntame un gasto/.test(cu.t) && cu.ej === 'none' && !cu.corta, 'Cuéntame un gasto cabe completo en 390 px (sin el ejemplo)');

  // Una cifra que cambia salta
  await p.evaluate(() => { document.getElementById('hoy-v').textContent = '$ 12.345'; }); await esp(50);
  ok(await p.evaluate(() => { const e = document.getElementById('hoy-v'); return e.classList.contains('cifra-cambia') && getComputedStyle(e).animationName === 'vivoCifra'; }), 'cuando cambia lo que puedes gastar hoy, la cifra salta');
  await esp(800);
  ok(await p.evaluate(() => !document.getElementById('hoy-v').classList.contains('cifra-cambia')), 'y luego vuelve a quedar quieta');

  // La tarjeta flotante se aparta al bajar y vuelve al subir
  const hp = await p.$('#hist-play');
  if (hp && await hp.isVisible()) {
    await p.evaluate(() => window.scrollTo(0, 500)); await esp(120); await p.evaluate(() => window.scrollTo(0, 900)); await esp(450);
    ok(await p.evaluate(() => document.body.classList.contains('va-bajando') && getComputedStyle(document.getElementById('hist-play')).opacity < 0.2), 'al bajar, la tarjeta flotante se aparta');
    await p.evaluate(() => window.scrollTo(0, 600)); await esp(450);
    ok(await p.evaluate(() => !document.body.classList.contains('va-bajando') && getComputedStyle(document.getElementById('hist-play')).position === 'fixed'), 'al subir, vuelve');
    await p.evaluate(() => window.scrollTo(0, 0)); await esp(300);
  } else ok(true, 'sin tarjeta flotante en esta pantalla');

  // Al cambiar de pestaña, las barras se llenan y la pestaña elegida da un saltico
  await p.tap('#barra [data-ir="metas"]'); await esp(120);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#barra [data-ir="metas"] .ic')).animationName === 'vivoRebota'), 'la pestaña elegida da un saltico');
  await esp(900);
  await p.tap('#barra [data-ir="inicio"]'); await esp(250);
  ok(await p.evaluate(() => { const f = document.querySelector('[data-view="inicio"] .ct-barra > i'); return !f || getComputedStyle(f).animationName === 'vivoLlena'; }), 'al volver a Inicio, las barras de las categorías se llenan');
  await esp(900);

  // ¿Dónde compro?: esqueleto mientras busca en las tiendas, y la lista entra en cascada
  let soltar; const espera = new Promise((r) => { soltar = r; });
  await c.route('**/api/precios-buscar**', async (r) => { await espera; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ q: 'jabon rey', t: Date.now(), cadenas: [{ c: 'Olímpica', items: [{ n: 'Jabón Rey 300 g', p: 3300, u: 'kg', pu: 11000 }] }] }) }); });
  await p.evaluate(() => document.getElementById('btn-donde-menu').click()); await esp(500);
  await p.fill('#dc-lista', 'jabón rey'); await p.click('#dc-form .btn.primary'); await esp(250);
  ok(await p.isVisible('#dc-res .dc-vivo .vivo-cargando i') && await p.$eval('#dc-res .vivo-cargando i', (x) => getComputedStyle(x).animationName === 'vivoBrillo'), 'mientras busca en las tiendas, se ve un esqueleto con brillo');
  soltar(); await esp(600);
  ok(!(await p.$('#dc-res .dc-vivo .vivo-cargando')) && /Jabón Rey 300 g/.test(await p.textContent('#dc-res')), 'cuando llega la respuesta, el esqueleto se cambia por los precios');
  ok(await p.$eval('#dc-res .dc-gente li', (x) => getComputedStyle(x).animationName === 'vivoSube'), 'los resultados entran en cascada');
  await p.click('#dlg-donde [data-close]'); await esp(300);

  // Con "reducir movimiento", nada se mueve de más
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const q = await c2.newPage(); await q.goto(BASE, { waitUntil: 'networkidle' }); await esp(700);
  ok(await q.evaluate(() => !document.body.classList.contains('vivo-arranque')), 'con reducir movimiento no hay llenado al arrancar');
  await q.evaluate(() => { document.getElementById('hoy-v').textContent = '$ 1'; }); await esp(50);
  ok(await q.evaluate(() => !document.getElementById('hoy-v').classList.contains('cifra-cambia')), 'ni cifras que saltan');
  ok(await q.evaluate(() => { const d = document.createElement('div'); d.className = 'dc-item'; document.body.appendChild(d); const x = parseFloat(getComputedStyle(d).animationDuration); d.remove(); return x < 0.01; }), 'y las animaciones duran nada');

  ok(!errs.length, 'sin errores de página' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
