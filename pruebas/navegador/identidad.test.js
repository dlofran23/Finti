// Identidad visual Finti, etapa 1: letra Unbounded + Manrope, Vibrante como tema por defecto, temas nuevos gratis,
// paso único de Cobalto a Vibrante, colores de identidad por categoría, cifras que caben y resorte al tocar botones.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const acento = (p) => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase());

(async () => {
  const b = await chromium.launch(); const errs = [];

  // ---------- Persona nueva: Vibrante, letras nuevas, temas nuevos ----------
  let c = await b.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: 'light' });
  let p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  ok(await acento(p) === '#7d97ff', 'tema por defecto: Finti, en modo oscuro (azul claro #7d97ff, la noche del 19-nov-2026)');
  const fuentes = await p.evaluate(() => [getComputedStyle(document.documentElement).getPropertyValue('--font-display'), getComputedStyle(document.body).fontFamily]);
  ok(/^\s*"?Plus Jakarta Sans/.test(fuentes[0]) && /^\s*"?Plus Jakarta Sans/.test(fuentes[1]), 'letras: Plus Jakarta Sans para títulos y texto');
  ok(await p.evaluate(async () => { await document.fonts.ready; return !!document.querySelector('link[href="/fuentes/fuentes.css"]') && document.fonts.check('700 20px "Plus Jakarta Sans"'); }), 'carga Plus Jakarta Sans desde la app (/fuentes/)');
  await p.click('#btn-colores'); await p.waitForTimeout(250);
  const temas = await p.$$eval('#theme-grid [data-tema]', (l) => l.map((x) => x.dataset.tema + ':' + x.getAttribute('aria-pressed') + ':' + /Gratis/.test(x.textContent)));
  ok(temas.slice(0, 4).join() === 'finti:true:true,vibrante:false:true,electrico:false:true,jade:false:true', 'primero Finti (elegido) y los temas nuevos, gratis: ' + temas.slice(0, 4));
  ok(temas.some((t) => t.startsWith('cobalto:')), 'Cobalto sigue disponible');
  ok(await p.$eval('#seg-modo [data-modo="oscuro"]', (b) => b.getAttribute('aria-pressed')) === 'true' && await p.evaluate(() => document.documentElement.hasAttribute('data-modo-oscuro')), 'quien llega por primera vez la ve en modo oscuro, aunque el sistema esté en claro');
  await p.click('#seg-modo [data-modo="claro"]'); await p.waitForTimeout(150);
  await p.click('#theme-grid [data-tema="jade"]'); await p.waitForTimeout(150);
  ok(await acento(p) === '#007a61', 'elegir Jade cambia el color principal');
  await p.click('#seg-modo [data-modo="oscuro"]'); await p.waitForTimeout(150);
  ok(await acento(p) === '#2ed8a9', 'Jade en modo oscuro usa su versión clara (#2ed8a9)');
  await p.click('#seg-modo [data-modo="auto"]'); await p.click('#theme-grid [data-tema="vibrante"]');
  await p.click('#dlg-colores [data-close]'); await p.waitForTimeout(150);

  // ---------- Colores de categoría ----------
  const cats = await p.$$eval('.cat-ic', (l) => [...new Set(l.map((x) => x.style.getPropertyValue('--c').trim().toLowerCase()))]);
  ok(cats.includes('#7c5cff') && cats.includes('#ff7a59') && !cats.includes('#d6336c'), 'categorías con colores de identidad (vivienda violeta, alimentación coral): ' + cats.slice(0, 5));
  const icono = await p.evaluate(() => { const e = [...document.querySelectorAll('.cat-ic')].find((x) => x.style.getPropertyValue('--c').trim().toLowerCase() === '#ffc53d'); return e ? getComputedStyle(e).color : ''; });
  ok(!icono || icono !== 'rgb(255, 197, 61)', 'en modo claro el amarillo del ícono se oscurece para que se vea: ' + icono);

  // ---------- Cifras largas caben en su tarjeta ----------
  await p.evaluate(() => document.querySelector('#tabs [data-tab="analisis"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => { const b = document.getElementById('an-detalle'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }); await p.waitForTimeout(300);
  await p.evaluate(() => { document.getElementById('s-ing').textContent = '$ 123.450.000'; });
  await p.waitForTimeout(300);   // el ajuste espera a que la cifra se quede quieta (140 ms)
  const cabe = await p.evaluate(() => { const e = document.getElementById('s-ing'); return [e.scrollWidth <= e.clientWidth + 1, e.style.fontSize]; });
  ok(cabe[0] && cabe[1], 'una cifra larga se encoge y no se sale de la tarjeta (' + cabe[1] + ')');

  // ---------- Resorte al tocar ----------
  ok(await p.evaluate(() => document.documentElement.hasAttribute('data-resorte')), 'el resorte está activo');
  const anim = await p.evaluate(() => {
    const btn = document.getElementById('btn-colores'), r = btn.getBoundingClientRect(), o = { bubbles: true, clientX: r.x + 5, clientY: r.y + 5, pointerId: 1 };
    btn.dispatchEvent(new PointerEvent('pointerdown', o)); const al = btn.getAnimations().length;
    document.dispatchEvent(new PointerEvent('pointerup', o)); const su = btn.getAnimations().map((a) => a.effect.getTiming().duration);
    return [al, su];
  });
  ok(anim[0] === 1 && anim[1].length === 1 && anim[1][0] === 420, 'al presionar se hunde y al soltar rebota (420 ms): ' + JSON.stringify(anim));
  await c.close();

  // ---------- Reducir movimiento: sin resorte ----------
  c = await b.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
  p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(700);
  ok(!(await p.evaluate(() => document.documentElement.hasAttribute('data-resorte'))), 'con "reducir movimiento" no hay resorte');
  await c.close();

  // ---------- Quien venía en Cobalto pasa una sola vez a Finti ----------
  c = await b.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: 'light' });
  await c.addInitScript(() => {
    if (sessionStorage.getItem('sembrado')) return; sessionStorage.setItem('sembrado', '1');
    const s = { v: 3, titulo: 'Mío', prefs: { tema: 'cobalto', modo: 'auto' }, meses: { '2026-11': { ingresos: [{ id: 'i1', concepto: 'Salario', plan: 2000000, real: 2000000 }], gastos: [] } }, mes: '2026-11' };
    localStorage.setItem('presupuesto-web-sin-cuenta', JSON.stringify(s)); localStorage.setItem('presupuesto-web-sin-cuenta-t', String(Date.now() + 60000));
  });
  p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  ok(await p.evaluate(() => document.querySelector('.title-input') ? document.querySelector('.title-input').value : '') === 'Mío', 'cargó el presupuesto guardado');
  ok(await acento(p) === '#2e5bff', 'Cobalto guardado de antes pasa a Finti (azul)');
  await p.click('#btn-colores'); await p.waitForTimeout(200);
  await p.click('#theme-grid [data-tema="cobalto"]'); await p.waitForTimeout(1500);
  ok(await acento(p) === '#2f4bd8', 'se puede volver a elegir Cobalto');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  ok(await acento(p) === '#2f4bd8', 'quien elige Cobalto después del cambio lo conserva al volver a abrir');
  await c.close();

  ok(!errs.length, 'sin errores en la página: ' + errs.join(' | '));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
