// Diseño "amigo financiero" (Claude Design, 17 de noviembre de 2026): tema Finti azul, identidad propia (fichas y la F, sin objetos 3D genéricos), Cuéntame que
// pregunta con qué se pagó (y desde qué cuenta salió la llave), billetera con los colores de cada banco,
// Análisis sencillo primero, Pregúntale con la marca de Finti, la dona con grosor (semana o mes) y Metas gratis con 1 meta.
require('./sin-bienvenida.js');
const { chromium } = require('playwright'); const pagarCon = require('./_pagar-con.js');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(1000);
  await p.evaluate(() => document.querySelector('[data-modo="claro"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
  const v = (n) => p.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), n);

  // Tema e identidad
  ok(await v('--accent') === '#2e5bff' && await v('--fuerte') === '#2e5bff', 'el tema por defecto es Finti, azul eléctrico');
  ok(await p.evaluate(() => { const cs = getComputedStyle(document.querySelector('.saludo-h')); return cs.fontFamily.includes('Plus Jakarta Sans') && +cs.fontWeight >= 700; }), 'la voz de Finti va en Plus Jakarta Sans, grande y gruesa');
  ok(!(await p.isVisible('.saludo-mascota')), 'sin mascota');
  ok((await p.isVisible('#hoy-card .marca-agua') || await p.isVisible('#banda .bf')) && !(await p.$('#hoy-card img')), 'Hoy puedes gastar lleva la F de Finti, sin objetos sueltos');
  if ((p.viewportSize() || {}).width <= 760) {
    const banda = await p.evaluate(() => { const b = document.getElementById('banda'), r = document.getElementById('hoy-registrar').getBoundingClientRect();
      const h = new Date().getHours(); return { visible: getComputedStyle(b).display === 'block', alto: b.offsetHeight, fin: r.bottom + scrollY, astro: b.classList.contains(h >= 6 && h < 18 ? 'dia' : 'noche') }; });
    ok(banda.visible && banda.alto > banda.fin, 'en el celular, Inicio vive sobre la banda azul hasta Cuéntame');
    ok(banda.astro, 'el punto de la F es el sol de día y la luna de noche, según la hora');
    const isla = await p.evaluate(() => { const b = getComputedStyle(document.getElementById('barra')); return parseFloat(b.borderTopLeftRadius) >= 30 && parseFloat(b.left) >= 10 && parseFloat(b.bottom) >= 10; });
    ok(isla, 'la barra de abajo es una isla flotante');
  }

  // Categorías con su ficha (identidad Finti) y palabras claras
  const fila = await p.$('#ct-grid .ct-fila');
  ok(fila && !!(await fila.$('.cat-ic.ficha svg use')), 'cada categoría lleva su ficha con el trazo de Finti');
  ok(await p.$$eval('#ct-grid .ct-fila .ct-l', (l) => l.every((x) => /Vas bien|Casi al límite|Ya está completo|Te pasaste|Gastaste/.test(x.textContent))), 'cada categoría dice cómo va en palabras');
  ok(await p.evaluate(() => !document.querySelector('img[src*="/3d/"]')), 'no quedan objetos 3D genéricos');
  ok(await p.$eval('#ct-grid .cat-ic.ficha', (x) => getComputedStyle(x).boxShadow !== 'none'), 'las fichas tienen grosor');
  // La dona: con grosor, esta semana o este mes
  ok(await p.isVisible('#donut-modo'), 'en la dona se elige semana o mes');
  await p.evaluate(() => document.querySelector('#donut-modo [data-dm="mes"]').click()); await p.waitForTimeout(400);
  ok(/Este mes|Vivienda|Alimentación/.test(await p.textContent('#donut-k')) && (await p.$$('#donut circle.seg')).length >= 3, 'este mes muestra las porciones por categoría');
  await p.evaluate(() => document.querySelector('#donut circle.seg').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await p.waitForTimeout(500);
  ok(await p.$eval('#donut .trozo.on', (g) => /translate\((?!0px, 0px)/.test(g.style.transform)), 'la porción tocada sale hacia afuera');
  await p.evaluate(() => document.querySelector('#donut-modo [data-dm="semana"]').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(() => localStorage.getItem('fintelligente-donut')) === 'semana', 'recuerda semana o mes');

  // Cuéntame: pregunta con qué se pagó; la llave pregunta desde qué cuenta
  const ultimo = () => p.evaluate(() => { const m = document.querySelectorAll('#ch-log .pr-msg.app'); return m[m.length - 1].textContent; });
  const say = async (t) => { await p.fill('#ch-input', t); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(350); };
  await p.click('#hoy-registrar'); await p.waitForTimeout(400);
  await say('taxi de 12 mil');
  ok(/12\.000/.test(await ultimo()) && /¿Con qué lo pagaste/.test(await ultimo()), 'sin decirlo, pregunta con qué lo pagaste y repite lo que entendió');
  const chips = await p.$$eval('#ch-chips [data-ch^="cuenta:"]', (l) => l.map((x) => x.textContent));
  ok(chips.length >= 3 && chips.includes('Nequi') && chips.includes('Efectivo'), 'ofrece tus cuentas: ' + chips.join(', '));
  ok(await p.$eval('#ch-chips [data-ch^="cuenta:"]:has-text("Nequi") .ch-marca', (x) => getComputedStyle(x).backgroundColor) === 'rgb(218, 0, 129)', 'el botón de Nequi lleva su color');
  ok(!(await p.isVisible('#ch-chips [data-ch="si"]')), 'no anota hasta saber con qué se pagó');
  await say('nequi');
  ok(/quedó anotado/.test(await ultimo()) && /Nequi/.test(await p.textContent('#ch-log')), 'responder "nequi" escrito sirve y lo anota');
  await p.click('[data-ch="otro"]').catch(() => {}); await p.waitForTimeout(200);
  await say('arriendo 900 mil por llave');
  ok(/¿Desde qué cuenta salió la llave/.test(await ultimo()), 'con llave, pregunta desde qué cuenta salió');
  const desde = await p.$$eval('#ch-chips [data-ch^="cuenta:"]', (l) => l.map((x) => x.textContent));
  ok(!desde.includes('Efectivo') && !desde.some((x) => /crédito/i.test(x)), 'la llave sale de un banco o billetera, no de efectivo ni de la tarjeta: ' + desde.join(', '));
  await p.click('[data-ch="no"]'); await p.waitForTimeout(200);
  await say('almuerzo 18 mil con Nequi');
  ok(await p.isVisible('#ch-chips [data-ch="si"]') && !(await p.$('#ch-chips [data-ch^="cuenta:"]')), 'si la frase lo dice, no pregunta');
  await p.click('#ch-chips [data-ch="si"]'); await p.waitForTimeout(300);
  await p.click('#dlg-charla [data-close]'); await p.waitForTimeout(300);

  // Movimientos: la cuenta con el color de su banco
  await p.evaluate(() => document.querySelector('[data-ir="movimientos"]').click()); await p.waitForTimeout(600);
  ok(/Nequi/.test(await p.textContent('#pd-lista .mv-cta')) && await p.$eval('#pd-lista .mv-cta i', (x) => getComputedStyle(x).backgroundColor) === 'rgb(218, 0, 129)', 'cada movimiento dice con qué cuenta, con su color');

  // Billetera
  await p.evaluate(() => { const b = document.querySelector('[data-ir="cuentas"]') || document.querySelector('#tabs [data-tab="cuentas"]'); b.click(); }); await p.waitForTimeout(600);
  const tarjetas = await p.$$eval('.billetera .bt-carta', (l) => l.map((x) => x.getAttribute('aria-label') + '|' + x.style.getPropertyValue('--fondo')));
  ok(tarjetas.length >= 3 && tarjetas.some((x) => /^Nequi/.test(x) && /#200020/.test(x)), 'las cuentas son tarjetas con el color de su banco: ' + tarjetas.length);
  const atras = await p.$('.billetera .bt-carta[aria-pressed="false"]'); await atras.click({ position: { x: 60, y: 14 } }); await p.waitForTimeout(500);
  ok(await p.$eval('.billetera .bt-carta[aria-pressed="true"]', (x) => x.getAttribute('aria-label')) !== tarjetas[0].split('|')[0], 'tocar una tarjeta la pasa al frente');
  ok(await p.isVisible('.billetera .bt-chip') || await p.isVisible('.billetera .bt-ic'), 'tarjetas con chip o con su ícono (billetera o efectivo)');

  // Análisis: sencillo primero
  await p.evaluate(() => document.querySelector('#tabs [data-tab="analisis"]').click()); await p.waitForTimeout(500);
  ok(/Vas bien|Vas justo|Ojo|Empecemos/.test(await p.textContent('#an-v')) && (await p.textContent('#an-frase')).length > 20, 'Análisis empieza con cómo va el mes en una frase');
  ok(await p.$$eval('#an-lista .an-fila .an-est', (l) => l.length > 0 && l.every((x) => x.querySelector('svg') && /Bien|Ojo|Listo|Te pasaste|Sin plan/.test(x.textContent))), 'cada categoría con ícono y palabra (no solo color)');
  ok(!(await p.isVisible('#t-hero')) && !(await p.isVisible('.score-card')), 'las gráficas esperan detrás de un toque');
  await p.click('#an-detalle'); await p.waitForTimeout(400);
  ok(await p.isVisible('#t-hero') && await p.getAttribute('#an-detalle', 'aria-expanded') === 'true', '"Ver el detalle con gráficas" las muestra');
  await p.click('#an-detalle'); await p.waitForTimeout(300);

  // Pregúntale
  await p.evaluate(() => { const b = [...document.querySelectorAll('#preg-ej button')].find((x) => /alcanza/.test(x.textContent)); b.click(); }); await p.waitForTimeout(1200);
  ok(await p.isVisible('#pr-log .pr-fila .pr-avatar') && /\$/.test(await p.textContent('#pr-log .pr-voz')), 'Pregúntale responde con la marca de Finti y la frase principal en grande');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  // Metas: gratis, 1 meta
  await p.evaluate(() => (document.querySelector('#barra [data-ir="metas"]') || document.querySelector('#tabs [data-tab="metas"]')).click()); await p.waitForTimeout(500);
  await p.click('#add-meta'); await p.waitForTimeout(500);
  ok(await p.isVisible('#dlg-premium') && /1 meta/.test(await p.textContent('#prem-msg')), 'con Finti gratis, la segunda meta pide Premium');

  ok(!errs.length, 'sin errores en la página: ' + errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
