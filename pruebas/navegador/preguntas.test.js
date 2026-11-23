// Pregúntale a Finti (preguntas con los números de la persona, sin IA externa) y las mini guías.
require('./sin-bienvenida.js');
const path = require('path'), fs = require('fs');
const CAPTURAS = path.join(__dirname, 'capturas'); fs.mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const salud = () => fetch(BASE + '/__salud').then((r) => r.json());
const contar = (s, e) => Object.keys(s).filter((k) => k.startsWith('metricas/')).reduce((a, k) => a + Object.values(s[k][e] || {}).reduce((x, y) => x + y, 0), 0);

(async () => {
  const b = await chromium.launch(); const errs = [];
  const s0 = await salud();
  const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);

  // ---------- Entender la frase ----------
  const E = (t) => p.evaluate((t) => window.FinPreguntas.entender(t), t);
  let r;
  r = await E('¿Cuánto gasté en comida el mes pasado?'); ok(r.intent === 'gasto' && r.cat === 'alimentacion' && /^\d{4}-\d{2}$/.test(r.per), 'gasto + categoría por sinónimo + periodo: ' + JSON.stringify(r));
  r = await E('me alcanza para unos tenis de 300 mil'); ok(r.intent === 'alcanza' && r.monto === 300000, '"300 mil" son 300.000: ' + r.monto);
  r = await E('¿puedo comprar un celular de 1,5 millones?'); ok(r.intent === 'alcanza' && r.monto === 1500000, '"1,5 millones": ' + r.monto);
  r = await E('me da para un viaje de $ 2.300.000'); ok(r.monto === 2300000, '"$ 2.300.000": ' + r.monto);
  r = await E('tengo para algo de medio palo?'); ok(r.intent === 'alcanza' && r.monto === 500000, '"medio palo": ' + r.monto);
  r = await E('cuanto llevo en uber esta semana'); ok(r.intent === 'gasto' && r.cat === 'transporte' && r.per === 'esta semana', 'uber es transporte, esta semana: ' + JSON.stringify(r));
  r = await E('en qué se me va la plata'); ok(r.intent === 'top', 'en qué se me va: top');
  r = await E('qué tengo que pagar esta semana'); ok(r.intent === 'pagos', 'pagos');
  r = await E('cómo cierro el mes'); ok(r.intent === 'cierre', 'cierre');
  r = await E('¿cómo voy frente al mes pasado?'); ok(r.intent === 'comparar', 'cómo voy: comparar (no es una pregunta de cómo usar la app)');
  r = await E('cómo conecto mi banco'); ok(r.intent === 'accion', 'cómo conecto mi banco: ayuda de la app');
  r = await E('cuanto gaste en octubre de 2026'); ok(r.intent === 'gasto' && r.per === '2026-10' && !r.monto, 'octubre de 2026 es un periodo, no un monto: ' + JSON.stringify(r));

  // ---------- La conversación ----------
  await p.click('#lateral [data-clic="btn-preguntas-menu"]'); await p.waitForTimeout(300);
  ok(await p.isVisible('#dlg-preguntas') && (await p.$$('#pr-chips .pr-chip')).length >= 3, 'se abre con un saludo y sugerencias');
  ok(/nada sale de aquí/i.test(await p.textContent('#dlg-preguntas')), 'dice que todo se calcula en el dispositivo');
  const preguntar = async (q) => { await p.fill('#pr-input', q); await p.press('#pr-input', 'Enter'); await p.waitForTimeout(650); return p.evaluate(() => { const l = [...document.querySelectorAll('#pr-log .pr-msg.app')]; return l[l.length - 1].textContent.replace(/\s+/g, ' '); }); };
  const chips = () => p.$$eval('#pr-chips .pr-chip', (l) => l.map((x) => x.textContent));
  let a = await preguntar('¿Cuánto gasté en comida?');
  ok(/llevas \$ [\d.]+ en alimentación de \$ [\d.]+ que planeaste/.test(a), 'responde con la categoría y lo planeado: ' + a.slice(0, 90));
  a = await preguntar('¿y en transporte?');
  ok(/en transporte/.test(a), 'entiende el seguimiento "¿y en transporte?"');
  a = await preguntar('me alcanza para un celular');
  ok(/¿Cuánto cuesta/.test(a) && (await chips()).includes('$ 1.000.000'), 'si falta el monto, lo pregunta con opciones');
  a = await preguntar('1.500.000');
  ok(/(no te alcanza|Justo|Sí te alcanza)/.test(a) && /Así lo calculé/.test(a), 'con el monto responde y muestra cómo lo calculó: ' + a.slice(0, 80));
  if ((await chips()).includes('Sí, calcúlalo')) {
    await p.click('#pr-chips .pr-chip >> text=Sí, calcúlalo'); await p.waitForTimeout(650);
    ok(/Para juntar/.test(await p.evaluate(() => [...document.querySelectorAll('#pr-log .pr-msg.app')].pop().textContent)), 'el "sí" continúa con el plan para comprarlo');
  }
  a = await preguntar('¿En qué gasto más?'); ok(/sobre todo en/.test(a) && /\(\d+ %\)/.test(a), 'top de categorías con porcentajes');
  a = await preguntar('cuánto debo'); ok(/Debes \$/.test(a) && /(avalancha|bola de nieve)/.test(a), 'deudas con cuál pagar primero');
  a = await preguntar('cuándo llego a mi meta'); ok(/llevas \$ [\d.]+ de \$/.test(a), 'metas con avance');
  a = await preguntar('qué tengo que pagar este mes'); ok(/(pago|al día|cuentas por pagar)/i.test(a), 'pagos pendientes');
  a = await preguntar('como esta mi salud financiera'); ok(/de 100/.test(a), 'salud financiera');
  a = await preguntar('cómo conecto mi banco');
  ok(/Conectar bancos/.test(a) && (await chips())[0] === 'Ver la guía paso a paso', 'una pregunta sobre la app ofrece la guía');
  a = await preguntar('xyzzy blabla perro'); ok(/no la entendí/.test(a), 'si no entiende, lo dice y propone opciones');
  a = await preguntar('cuanto gasto en luz'); ok(/servicios/.test(a), 'luz es servicios');
  await p.screenshot({ path: path.join(CAPTURAS, 'preguntas.png') });

  // Con historial: comercio, seguimiento con comercio, gastos hormiga y hoy
  await p.click('#pr-limpiar'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('#tabs [data-tab="analisis"]').click()); await p.waitForTimeout(300);
  await p.fill('#f-nota-nueva', 'Probar las preguntas'); await p.click('#btn-nota'); await p.waitForTimeout(700);
  const hoy = new Date(), f = (d) => { const x = new Date(hoy); x.setDate(x.getDate() - d); return x.toLocaleDateString("sv-SE"); };
  await p.evaluate((movs) => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.meses) { v.movs = movs; v.ejemplo = false; localStorage.setItem(k, JSON.stringify(v)); return; } } catch (e) {} } }, [
    { id: 'a1', f: f(0), h: 9, t: 'g', cat: 'ocio', c: 'Rappi', m: 32000 }, { id: 'a2', f: f(2), h: 20, t: 'g', cat: 'ocio', c: 'Rappi', m: 41000 },
    { id: 'a3', f: f(5), h: 13, t: 'g', cat: 'ocio', c: 'Rappi', m: 28000 }, { id: 'a4', f: f(1), h: 8, t: 'g', cat: 'alimentacion', c: 'Juan Valdez', m: 9500 },
    { id: 'a5', f: f(3), h: 8, t: 'g', cat: 'alimentacion', c: 'Juan Valdez', m: 9500 }, { id: 'a6', f: f(0), h: 8, t: 'g', cat: 'alimentacion', c: 'Tienda', m: 4000 }]);
  const hayEstado = await p.evaluate(() => Object.keys(localStorage).some((k) => { try { return JSON.parse(localStorage.getItem(k)).meses; } catch (e) { return false; } }));
  if (hayEstado) {
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1000);
    await p.click('#lateral [data-clic="btn-preguntas-menu"]'); await p.waitForTimeout(300);
    a = await preguntar('¿cuánto llevo en Rappi en los últimos 10 días?');
    ok(/En los últimos 10 días llevas \$ 101\.000 en Rappi, en 3 movimientos \(unos \$ 33\.700 cada vez\)/.test(a), 'gasto en un comercio con el historial: ' + a.slice(0, 90));
    a = await preguntar('gastos hormiga'); ok(/3 gastos pequeños/.test(a) && /Juan Valdez/.test(a), 'gastos hormiga con proyección al año: ' + a.slice(0, 90));
    a = await preguntar('¿cuánto gasté hoy?'); ok(/Hoy llevas \$ 36\.000/.test(a), 'gasto de hoy desde el historial: ' + a.slice(0, 60));
  } else console.log('(sin estado guardado: se omiten las pruebas con historial)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(!(await p.isVisible('#dlg-preguntas')), 'Escape cierra');

  // Desde la tarjeta de Inicio
  await p.fill('#preg-ini', '¿Cuánto me queda este mes?'); await p.press('#preg-ini', 'Enter'); await p.waitForTimeout(800);
  ok(await p.isVisible('#dlg-preguntas') && /Te quedan \$/.test(await p.evaluate(() => [...document.querySelectorAll('#pr-log .pr-msg.app')].pop().textContent)), 'la tarjeta de Inicio abre la conversación con la pregunta');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);

  // ---------- Mini guías ----------
  await p.evaluate(() => document.querySelectorAll('#lateral .lat-grupo').forEach((d) => { d.open = true; })); await p.click('#lateral [data-clic="btn-guias-menu"]'); await p.waitForTimeout(300);
  ok(await p.isVisible('#dlg-guias') && (await p.$$('#guias-lista .guia-item')).length >= 10, 'el menú de guías lista los temas');
  await p.click('#guias-lista [data-guia="basico"]'); await p.waitForTimeout(500);
  ok(await p.isVisible('#guia-capa') && /Paso 1 de 5/.test(await p.textContent('#guia-paso')) && !(await p.isHidden('#guia-luz')), 'la guía ilumina el primer paso');
  const luz = await p.$eval('#guia-luz', (e) => e.getBoundingClientRect()), hero = await p.$eval('#hoy-card', (e) => e.getBoundingClientRect());
  ok(luz.left <= hero.left && luz.top <= hero.top && luz.right >= hero.right && luz.bottom >= hero.bottom, 'la luz rodea el elemento');
  for (let i = 0; i < 4; i++) { await p.click('#guia-sig'); await p.waitForTimeout(400); }
  ok((await p.textContent('#guia-sig')) === 'Terminar', 'el último paso dice Terminar');
  await p.click('#guia-sig'); await p.waitForTimeout(300);
  ok(await p.isHidden('#guia-capa') && /Siguiente guía/.test(await p.textContent('#toasts')), 'al terminar, ofrece la siguiente guía');

  // Guía que abre una ventana y otra sección
  await p.evaluate(() => document.querySelectorAll('#lateral .lat-grupo').forEach((d) => { d.open = true; })); await p.click('#lateral [data-clic="btn-guias-menu"]'); await p.waitForTimeout(300);
  ok(await p.isVisible('#guias-lista [data-guia="basico"].vista'), 'la guía vista queda marcada');
  await p.click('#guias-lista [data-guia="registrar"]'); await p.waitForTimeout(500);
  await p.click('#guia-sig'); await p.waitForTimeout(500);
  ok(await p.isVisible('#dlg-add') && /¿Gasto o ingreso\?/.test(await p.textContent('#guia-t')), 'la guía abre el registro y explica sus partes');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(await p.isHidden('#guia-capa') && !(await p.isVisible('#dlg-add')), 'Escape sale de la guía y cierra lo que abrió');
  await p.evaluate(() => document.querySelectorAll('#lateral .lat-grupo').forEach((d) => { d.open = true; })); await p.click('#lateral [data-clic="btn-guias-menu"]'); await p.waitForTimeout(300);
  await p.click('#guias-lista [data-guia="metas"]'); await p.waitForTimeout(600);
  ok(await p.isVisible('[data-view="metas"]') && /Metas de ahorro/.test(await p.textContent('#guia-t')), 'la guía lleva a la sección que explica');
  await p.screenshot({ path: path.join(CAPTURAS, 'guia.png') });
  await p.click('#guia-atras').catch(() => {}); await p.click('#guia-salir'); await p.waitForTimeout(200);

  // Celular
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  m.on('pageerror', (e) => errs.push(e.message));
  await m.goto(BASE, { waitUntil: 'networkidle' }); await m.waitForTimeout(1200);
  await m.evaluate(() => document.getElementById('btn-guias-menu').click()); await m.waitForTimeout(300);
  await m.click('#guias-lista [data-guia="basico"]'); await m.waitForTimeout(500);
  const g = await m.$eval('#guia-globo', (e) => e.getBoundingClientRect());
  ok(g.left >= 0 && g.right <= 390 && g.top >= 0 && g.bottom <= 844, 'en el celular el globo cabe en la pantalla');
  for (let i = 0; i < 4; i++) { await m.click('#guia-sig'); await m.waitForTimeout(400); }
  ok(/Registrar/.test(await m.textContent('#guia-t')) && !(await m.isHidden('#guia-luz')), 'en el celular ilumina el botón Registrar');
  await m.screenshot({ path: path.join(CAPTURAS, 'guia-movil.png') });
  await m.click('#guia-sig'); await m.waitForTimeout(200);
  await m.evaluate(() => document.getElementById('btn-preguntas-menu').click()); await m.waitForTimeout(300);
  await m.fill('#pr-input', '¿En qué gasto más?'); await m.press('#pr-input', 'Enter'); await m.waitForTimeout(700);
  await m.screenshot({ path: path.join(CAPTURAS, 'preguntas-movil.png') });

  await p.waitForTimeout(300);
  const s1 = await salud();
  ok(contar(s1, 'pregunta') - contar(s0, 'pregunta') >= 1 && contar(s1, 'guia_completa') - contar(s0, 'guia_completa') >= 1, 'se cuentan las preguntas y las guías completas');
  ok(!errs.length, 'sin errores en la página ' + errs.join(' | '));
  await b.close();
  if (fallas) { console.log(fallas + ' falla(s)'); process.exit(1); }
  console.log('preguntas y guías: todo bien');
})().catch((e) => { console.error(e); process.exit(1); });
