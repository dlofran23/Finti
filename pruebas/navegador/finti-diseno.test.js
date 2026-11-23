// Diseño de Finti (16 de noviembre de 2026): nombre, pantalla de carga, barra de abajo, tarjetas de categorías,
// Movimientos por día, pantallas vacías con la F, íconos de las categorías propias y metas como alcancías.
require('./sin-bienvenida.js');
const path = require('path');
const CAPTURAS = path.join(__dirname, 'capturas'); require('fs').mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const T = async (p, sel) => ((await p.textContent(sel)) || '').replace(/ /g, ' ');

(async () => {
  // Licencia de prueba firmada con la clave del servidor de pruebas (no es la de producción)
  const P = await import(path.join(__dirname, '../../netlify/lib/pagos.mjs'));
  const lic = { ref: 'PRE-PRUEBADISENO', token: P.tokenLicencia('PRE-PRUEBADISENO', 's3cr3t') };
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light' });
  await c.addInitScript((l) => { try { localStorage.setItem('presupuesto-licencia', JSON.stringify(l)); localStorage.setItem('presupuesto-licencia-revisada', String(Date.now())); } catch (e) {} }, lic);
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); const pedidosGoogle = []; p.on('request', (q) => { if (/fonts\.(googleapis|gstatic)\.com/.test(q.url())) pedidosGoogle.push(q.url()); });
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);

  // Nombre y carga
  ok(/^Finti/.test(await p.title()) && /Finti/.test(await T(p, '.lateral .brand-name')), 'la app se llama Finti: ' + await p.title());
  await p.waitForSelector('#arranque', { state: 'detached', timeout: 4000 }).catch(() => {});   // se ve al menos 1,9 s: el punto firma la F
  ok(!(await p.$('#arranque')), 'la pantalla de carga se va sola al cargar');

  // Tarjetas de color por categoría en el Inicio
  ok(await p.isVisible('#cat-tarjetas') && (await p.$$eval('#ct-grid .ct-carta', (l) => l.length)) >= 2, 'el Inicio muestra tarjetas de color por categoría');
  ok(await p.$eval('#ct-grid .ct-carta', (x) => /[Qq]uedan|Te pasaste|Gastaste|completo/.test(x.textContent)), 'cada tarjeta dice cuánto queda o cuánto se pasó');
  await p.click('#ct-grid .ct-carta'); await p.waitForTimeout(500);
  ok(await p.isVisible('#dlg-cat'), 'tocar una tarjeta abre el detalle de la categoría');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  // Movimientos por día: vacío con la F, luego con lo anotado
  await p.click('#barra [data-ir="movimientos"]'); await p.waitForTimeout(700);
  ok(await p.isVisible('#pd-lista p.empty') && await p.$eval('#pd-lista p.empty', (x) => getComputedStyle(x, '::before').backgroundImage.includes('svg')), 'sin movimientos, la F espera con un mensaje amable');
  for (const t of ['almuerzo 18 mil', 'taxi 12 mil']) {
    await p.click('#barra-registrar'); await p.waitForTimeout(500);
    await p.fill('#add-texto', t); await p.press('#add-texto', 'Enter'); await p.waitForTimeout(500);
    if (await p.isVisible('#add-save')) { await p.click('#add-save'); await p.waitForTimeout(500); }
    if (await p.isVisible('#dlg-add')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  }
  await p.click('#barra [data-ir="movimientos"]'); await p.waitForTimeout(700);
  const dia = await T(p, '#pd-lista .pd-dia');
  ok(/^Hoy/.test(dia) && /Almuerzo/i.test(dia) && /Taxi/i.test(dia) && /−\$ 30\.000/.test(dia), 'Movimientos agrupa lo anotado por día con su total: ' + dia.replace(/\s+/g, ' ').slice(0, 90));
  await p.screenshot({ path: path.join(CAPTURAS, 'finti-por-dia.png') });

  // Categorías propias: el ícono se adivina por el nombre y se puede cambiar
  await p.evaluate(() => document.getElementById('btn-cats').click()); await p.waitForTimeout(400);
  await p.fill('#f-cat-nombre', 'Comida del perro'); await p.click('#btn-cat-add'); await p.waitForTimeout(300);
  ok((await p.getAttribute('#cat-rows .cat-row:last-child .cat-ic-btn use', 'href')) === '#c-mascotas', 'una categoría "Comida del perro" recibe el ícono de mascotas');
  await p.click('#cat-rows .cat-row:last-child .cat-ic-btn'); await p.waitForTimeout(200);
  ok((await p.$$eval('#cat-rows .cat-iconos [data-icono]', (l) => l.length)) >= 26, 'el selector ofrece todos los íconos nuevos');
  await p.click('#cat-rows .cat-iconos [data-icono="gimnasio"]'); await p.waitForTimeout(200);
  ok((await p.getAttribute('#cat-rows .cat-row:last-child .cat-ic-btn use', 'href')) === '#c-gimnasio', 'se puede elegir otro ícono (gimnasio)');
  await p.click('#dlg-cats [data-close]'); await p.waitForTimeout(300);
  const guardado = await p.evaluate(() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.categorias) return v.categorias.map((x) => x.ic).join(); } catch (e) {} } return ''; });
  ok(guardado === 'gimnasio', 'el ícono elegido se guarda: ' + guardado);

  // Metas como alcancías
  await p.click('#barra [data-ir="metas"]'); await p.waitForTimeout(900);
  ok((await p.$$eval('#metas-body .goal-jar', (l) => l.length)) >= 1 && await p.$eval('#metas-body .goal-jar .jar-ola', (x) => getComputedStyle(x).animationName === 'jarOla'), 'cada meta es una alcancía que se llena con una ola');
  await p.screenshot({ path: path.join(CAPTURAS, 'finti-metas.png') });

  // Íconos a dos tonos
  ok(await p.$eval('#c-vivienda', (s) => !!s.querySelector('[fill-opacity]')) && await p.$eval('#i-home', (s) => !!s.querySelector('[fill-opacity]')), 'los íconos son a dos tonos (trazo y relleno suave)');

  // Como el prototipo: Inicio corto, Movimientos con filtros, Metas con resumen y el presupuesto aparte
  await p.click('#barra [data-ir="inicio"]'); await p.waitForTimeout(700);
  const orden = await p.evaluate(() => ['#hoy-card', '#hoy-registrar', '#h-donut', '#h-pagos', '#cat-tarjetas', '#hist-play'].map((q) => { const e = document.querySelector(q); return e && e.offsetParent !== null || (e && getComputedStyle(e).position === 'fixed') ? e.getBoundingClientRect().top + scrollY : -1; }));
  ok(orden.slice(0, 5).every((y, i, a) => y >= 0 && (i === 0 || y > a[i - 1])), 'Inicio en el orden del prototipo: hoy, cuéntame, en qué se va, próximos pagos y categorías (' + orden.map(Math.round) + ')');
  ok(await p.evaluate(() => !document.querySelector('[data-view="inicio"] #pron, [data-view="inicio"] #tu-dia, [data-view="inicio"] .score-card, [data-view="inicio"] .notas-panel') && !!document.querySelector('[data-view="analisis"] #pron') && !!document.querySelector('[data-view="analisis"] .notas-panel')), 'lo demás de Inicio pasó a Análisis');
  ok(await p.$eval('#hist-play', (e) => !e.hidden && getComputedStyle(e).position === 'fixed'), 'Tu mes contado flota sobre la barra de abajo, como un reproductor');
  ok(/^Cuéntame un gasto/.test(await p.textContent('#hoy-registrar')), 'Cuéntame un gasto está en Inicio, como una caja para escribir');
  ok(!(await p.isVisible('.title-row')), 'sin "Presupuesto de" arriba');
  await p.click('#barra [data-ir="movimientos"]'); await p.waitForTimeout(700);
  ok((await p.textContent('#mv-t')) === 'Movimientos' && await p.isVisible('#mv-resumen') && !(await p.isVisible('#h-gas')) && !(await p.isVisible('#example-notice')) && !(await p.isVisible('.title-row')), 'Movimientos: título y resumen, sin la tabla del presupuesto ni el aviso del ejemplo');
  await p.click('#barra [data-ir="metas"]'); await p.waitForTimeout(700);
  ok((await p.textContent('#mt-t')) === 'Metas' && (await p.textContent('#mt-resumen')).length > 10 && !(await p.isVisible('.title-row')), 'Metas: título y resumen, sin "Presupuesto de"');
  ok(await p.evaluate(() => { const v = document.querySelector('[data-view="metas"]'); const y = (q) => v.querySelector(q).getBoundingClientRect().top; return y('#h-metas') < y('#h-alcancia') && y('#h-metas') < y('#h-retos-a'); }), 'las metas van primero; el redondeo y los retos, después');
  await p.evaluate(() => document.querySelector('#tabs [data-tab="presupuesto"]').click()); await p.waitForTimeout(700);
  ok(await p.isVisible('#h-ing') && await p.isVisible('#h-gas') && await p.isVisible('.title-row') && (await p.getAttribute('#barra-mas', 'aria-current')) === 'page', 'Tu presupuesto tiene ingresos, gastos y el título; en la barra queda marcado Más');
  await p.click('#barra [data-ir="inicio"]'); await p.waitForTimeout(500);

  // Letras dentro de la app: nada se pide a Google y Plus Jakarta Sans está cargada
  ok(!pedidosGoogle.length, 'no se piden letras a Google: ' + pedidosGoogle.join(' '));
  ok(await p.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 20px "Plus Jakarta Sans"') && [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Plus Jakarta Sans' && f.status === 'loaded'); }), 'Plus Jakarta Sans carga desde /fuentes/');
  ok(!errs.length, 'sin errores en la página: ' + errs.join(' | '));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
