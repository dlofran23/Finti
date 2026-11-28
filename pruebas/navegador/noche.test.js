// Diseño Noche en todas las pantallas (28-nov-2026): en modo oscuro, fondo de aurora y estrellas que se inclina,
// tarjetas de vidrio, íconos en relieve, botones con volumen y ventanas de vidrio. En modo claro nada cambia.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const esp = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#inicio', { waitUntil: 'networkidle' }); await esp(1200);
  if (await p.isVisible('#dlg-inicio')) { await p.keyboard.press('Escape'); await esp(300); }
  ok(await p.evaluate(() => document.documentElement.hasAttribute('data-modo-oscuro')), 'la app está en modo oscuro');
  ok(await p.evaluate(() => /radial-gradient/.test(getComputedStyle(document.body, '::before').backgroundImage) && getComputedStyle(document.body, '::after').position === 'fixed'), 'el fondo tiene aurora y estrellas');
  await p.evaluate(() => document.querySelector('#tabs [data-tab="cuentas"]').click()); await esp(900);
  const panel = await p.evaluate(() => { const s = getComputedStyle(document.querySelector('[data-view="cuentas"] .panel')); return { bg: s.backgroundImage, sh: s.boxShadow, r: s.borderTopLeftRadius }; });
  ok(/linear-gradient/.test(panel.bg) && /inset/.test(panel.sh) && panel.r === '24px', 'las tarjetas son de vidrio con filo de luz');
  ok(await p.evaluate(() => /radial-gradient/.test(getComputedStyle(document.querySelector('[data-view="cuentas"] .btn.primary')).backgroundImage)), 'los botones principales tienen volumen');
  await p.evaluate(() => document.querySelector('#tabs [data-tab="metas"]').click()); await esp(900);
  ok(await p.evaluate(() => { const i = document.querySelector('.cat-ic'); return !i || /linear-gradient/.test(getComputedStyle(i).backgroundImage); }), 'los íconos son objetos en relieve');
  // El fondo se inclina con el teléfono
  await p.evaluate(() => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: 30, beta: 45 }))); await esp(700);
  ok(await p.evaluate(() => parseFloat(document.documentElement.style.getPropertyValue('--tx')) > .5), 'al inclinar el teléfono, el fondo se mueve');
  await p.evaluate(() => document.getElementById('btn-preguntas-menu').click()); await esp(500);
  ok(await p.evaluate(() => /linear-gradient/.test(getComputedStyle(document.querySelector('#dlg-preguntas .dlg')).backgroundImage)), 'las ventanas son de vidrio oscuro');
  ok((await p.getAttribute('#pr-input', 'placeholder')) === 'Dime tu pregunta…', 'la caja de Pregúntale no se corta');
  await c.close();
  // En modo claro no cambia nada
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const q = await c2.newPage(); await q.goto(BASE + '/#inicio', { waitUntil: 'networkidle' }); await esp(900);
  if (!(await q.evaluate(() => document.documentElement.hasAttribute('data-modo-oscuro'))))
    ok(await q.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage === 'none' || !/rgba\(59, 99, 255/.test(getComputedStyle(document.body, '::before').backgroundImage)), 'en modo claro no hay aurora');
  else ok(true, 'la app quedó en oscuro también con el sistema claro');
  ok(!errs.length, 'sin errores de página' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
