// Transiciones premium entre pestañas (19-nov-2026): View Transitions al tocar la barra, sin dejar nada a medias,
// y cambio inmediato con "reducir movimiento" o cuando el código cambia de vista.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const esp = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await esp(2200);
  ok(await p.evaluate(() => !!document.startViewTransition), 'el navegador de prueba tiene View Transitions');
  await p.tap('#barra [data-ir="movimientos"]'); await esp(60);
  const durante = await p.evaluate(() => { const r = document.querySelector('#barra [data-ir="movimientos"]').getBoundingClientRect(), cs = document.documentElement.style;
    return { vt: document.documentElement.classList.contains('con-vt'), px: parseFloat(cs.getPropertyValue('--px')), cx: r.left + r.width / 2, titulo: !!document.querySelector('.vt-titulo') }; });
  ok(durante.vt && Math.abs(durante.px - durante.cx) < 2, 'el círculo de luz nace en la pestaña que se tocó');
  ok(durante.titulo, 'el nombre de la pestaña viaja al título');
  await esp(900);
  const despues = await p.evaluate(() => { const v = document.querySelector('[data-view="movimientos"]'); const h = v.firstElementChild; return { vt: document.documentElement.classList.contains('con-vt'), trans: document.documentElement.getAttribute('data-trans'), vis: !v.hidden, op: getComputedStyle(h).opacity, opv: getComputedStyle(v).opacity }; });
  ok(!despues.vt && despues.vis && despues.op === '1' && despues.opv === '1' && !(await p.$('.vt-titulo')), 'al terminar no queda nada a medias: la vista nueva se ve completa');
  await p.tap('#barra [data-ir="inicio"]'); await esp(60);
  ok(await p.evaluate(() => document.documentElement.classList.contains('con-vt')), 'volver a Inicio también abre con el círculo');
  await esp(900);
  // Toques seguidos: la segunda transición reemplaza a la primera sin romper nada
  await p.tap('#barra [data-ir="metas"]'); await esp(80); await p.tap('#barra [data-ir="movimientos"]'); await esp(1000);
  ok(await p.evaluate(() => document.body.dataset.vista === 'movimientos' && !document.querySelector('[data-view="movimientos"]').hidden && !document.documentElement.classList.contains('con-vt')), 'dos toques seguidos terminan en la última pestaña');
  // Deslizar con el dedo: a mitad y suelto despacio vuelve; completo cambia; en el borde frena y no cambia
  const cdp = await c.newCDPSession(p);
  const t = (x, y, tipo) => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: tipo === 'touchEnd' ? [] : [{ x, y }] });
  async function deslizar(x0, x1, y, pausa) { await t(x0, y, 'touchStart'); for (let i = 1; i <= 14; i++) { await t(x0 + (x1 - x0) * i / 14, y, 'touchMove'); await esp(16); } if (pausa) await esp(pausa); await t(x1, y, 'touchEnd'); await esp(700); }
  await p.evaluate(() => { location.hash = '#inicio'; }); await esp(400);
  await deslizar(300, 200, 200, 250);
  ok(await p.evaluate(() => document.body.dataset.vista) === 'inicio' && await p.evaluate(() => !document.querySelector('.vecina') && document.querySelectorAll('.view:not([hidden])').length === 1), 'un arrastre corto y lento vuelve a Inicio sin dejar nada a medias');
  await deslizar(340, 40, 200);
  ok(await p.evaluate(() => document.body.dataset.vista) === 'movimientos' && await p.evaluate(() => document.querySelectorAll('.view:not([hidden])').length === 1), 'deslizar a la izquierda pasa a Movimientos');
  await deslizar(60, 360, 200);
  ok(await p.evaluate(() => document.body.dataset.vista) === 'inicio', 'deslizar a la derecha vuelve a Inicio');
  await deslizar(60, 360, 200);
  ok(await p.evaluate(() => document.body.dataset.vista === 'inicio' && !document.querySelector('.view.arrastra')), 'en el borde (Inicio) frena y no cambia');
  await p.evaluate(() => document.querySelector('#barra [data-ir="metas"]').click()); await esp(900);
  await p.evaluate(() => { document.getElementById('btn-menu').click(); }); await esp(400);
  await deslizar(340, 40, 300);
  ok(await p.evaluate(() => document.body.dataset.vista) === 'metas', 'con el menú abierto no se desliza la página');
  await p.evaluate(() => { const b = document.getElementById('lat-cerrar'); if (b) b.click(); }); await esp(300);
  // Desde el código la vista cambia al instante (el código siguiente la encuentra lista)
  ok(await p.evaluate(() => { location.hash = '#cuentas'; return true; }), 'cambio por enlace');
  await esp(200); ok(await p.isVisible('#tedeben-panel'), 'un enlace a Cuentas la muestra enseguida');
  await c.close();
  // Con "reducir movimiento": inmediato
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
  const p2 = await c2.newPage(); await p2.goto(BASE, { waitUntil: 'networkidle' }); await esp(800);
  await p2.tap('#barra [data-ir="metas"]'); await esp(30);
  ok(await p2.evaluate(() => !document.documentElement.classList.contains('con-vt') && !document.querySelector('[data-view="metas"]').hidden), 'con reducir movimiento el cambio es inmediato');
  ok(!errs.length, 'sin errores de página' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
