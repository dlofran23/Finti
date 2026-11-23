// El saludo y el astro siguen la hora del celular (a la 1 a. m. es de noche), y la IA de Finti se ve en Inicio.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
(async () => {
  const b = await chromium.launch();
  for (const [hora, saludo, astro] of [['01:00', 'Buenas noches', 'noche'], ['09:00', 'Buenos días', 'dia'], ['15:00', 'Buenas tardes', 'dia'], ['20:00', 'Buenas noches', 'noche']]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Bogota' });
    const p = await c.newPage(); await p.clock.setFixedTime(new Date('2026-11-20T' + hora + ':00-05:00'));
    await p.goto(process.env.BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(2300);
    const t = await p.textContent('#saludo-h'), a = await p.evaluate(() => document.getElementById('banda').className);
    ok(t.startsWith(saludo) && a.includes(astro), `a las ${hora}: "${saludo}" y ${astro === 'dia' ? 'sol' : 'luna'} (${t.slice(0, 20)} · ${a})`);
    if (hora === '15:00') {
      ok(await p.isVisible('#hoy-preguntar'), 'Pregúntale está a la vista en Inicio');
      await p.click('#hoy-preguntar'); await p.waitForTimeout(500); ok(await p.isVisible('#dlg-preguntas'), 'y abre la IA de Finti');
      await p.evaluate(() => document.querySelector('[data-close]') && document.querySelector('#dlg-preguntas [data-close]').click());
      await p.evaluate(() => document.getElementById('btn-menu').click()); await p.waitForTimeout(500);
      ok(await p.isVisible('#lateral [data-clic="btn-donde-menu"]') && await p.isVisible('#lateral [data-clic="btn-preguntas-menu"]'), 'el menú tiene Pregúntale a Finti y ¿Dónde compro?');
    }
    await c.close();
  }
  // Micrófono sin voz dentro del navegador (como Chrome en Android o Safari en iPhone): invita a dictar con el teclado
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
  const p = await c.newPage(); await p.goto(process.env.BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(2300);
  await p.click('#hoy-registrar'); await p.waitForTimeout(500);
  ok(await p.isVisible('#ch-voz'), 'el micrófono se ve aunque el navegador no entienda voz por sí solo');
  await p.click('#ch-voz'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'ch-input') && /micrófono de tu teclado/.test(await p.textContent('#ch-log')), 'al tocarlo abre el teclado para dictar y explica cómo');
  await c.close();
  await b.close(); console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
