// Modo discreto, bloqueo con PIN, informe del mes y alertas inteligentes.
require('./sin-bienvenida.js');
const path = require('path'), fs = require('fs');
const CAPTURAS = path.join(__dirname, 'capturas'); fs.mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 400, height: 860 }, isMobile: true, hasTouch: true });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);

  // ---------- Modo discreto ----------
  await p.click('#btn-discreto'); await p.waitForTimeout(300);
  const blur = await p.$eval('#hero-saldo', (e) => getComputedStyle(e).filter);
  ok(/blur/.test(blur) && (await p.getAttribute('#btn-discreto', 'aria-pressed')) === 'true', 'el ojo oculta las cifras (' + blur + ')');
  ok(/blur/.test(await p.$eval('#s-ing', (e) => getComputedStyle(e).filter)), 'también el resumen');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1000);
  ok(/blur/.test(await p.$eval('#hero-saldo', (e) => getComputedStyle(e).filter)), 'se recuerda al volver a abrir');
  await p.click('#btn-discreto'); await p.waitForTimeout(200);
  ok(!/blur/.test(await p.$eval('#hero-saldo', (e) => getComputedStyle(e).filter)), 'se vuelve a mostrar');

  // ---------- PIN ----------
  await p.evaluate(() => document.getElementById('btn-privado-menu').click()); await p.waitForTimeout(300);
  await p.click('#priv-pin-crear');
  await p.fill('#priv-pin1', '1111'); await p.fill('#priv-pin2', '1111'); await p.click('#priv-pin-form button'); await p.waitForTimeout(200);
  ok(/muy fácil/.test(await p.textContent('#priv-msg')), 'rechaza un PIN fácil de adivinar');
  await p.fill('#priv-pin1', '2580'); await p.fill('#priv-pin2', '2581'); await p.click('#priv-pin-form button'); await p.waitForTimeout(200);
  ok(/no coinciden/.test(await p.textContent('#priv-msg')), 'pide repetirlo igual');
  await p.fill('#priv-pin1', '2580'); await p.fill('#priv-pin2', '2580'); await p.click('#priv-pin-form button'); await p.waitForTimeout(900);
  const guardado = await p.evaluate(() => localStorage.getItem('fintelligente-pin'));
  ok(/Listo/.test(await p.textContent('#priv-msg')) && guardado && !guardado.includes('2580'), 'guarda el PIN solo como huella');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  ok(await p.isVisible('#bloqueo') && (await p.evaluate(() => getComputedStyle(document.querySelector('.hero')).visibility)) === 'hidden', 'al abrir pide el PIN y no deja ver nada');
  await p.fill('#bloq-pin', '1357'); await p.waitForTimeout(900);
  ok(/PIN incorrecto/.test(await p.textContent('#bloq-msg')) && await p.isVisible('#bloqueo'), 'un PIN equivocado no entra');
  await p.screenshot({ path: path.join(CAPTURAS, 'bloqueo.png') });
  await p.fill('#bloq-pin', '2580'); await p.waitForTimeout(900);
  ok(!(await p.isVisible('#bloqueo')), 'con el PIN correcto entra (sin tocar "Entrar")');
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.evaluate(() => { const cfg = JSON.parse(localStorage.getItem('fintelligente-pin')); cfg.min = 0; localStorage.setItem('fintelligente-pin', JSON.stringify(cfg)); });
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(300);
  ok(await p.isVisible('#bloqueo'), 'se bloquea al volver a la app');
  await p.fill('#bloq-pin', '2580'); await p.waitForTimeout(900);
  await p.evaluate(() => document.getElementById('btn-privado-menu').click()); await p.waitForTimeout(300);
  await p.click('#priv-pin-quitar'); await p.waitForTimeout(200);
  ok(!(await p.evaluate(() => localStorage.getItem('fintelligente-pin'))), 'se puede quitar el PIN');
  await p.keyboard.press('Escape');

  // ---------- Informe ----------
  await p.evaluate(() => { window.__impreso = 0; window.print = () => { window.__impreso++; }; document.getElementById('btn-informe').click(); });
  await p.waitForTimeout(300);
  const inf = await p.textContent('#informe');
  ok((await p.evaluate(() => window.__impreso)) === 1 && /Gastos por categoría/.test(inf) && /Metas de ahorro/.test(inf) && /Salud financiera/.test(inf), 'el informe se arma y abre la impresión');
  await p.emulateMedia({ media: 'print' });
  ok(await p.isVisible('#informe') && !(await p.isVisible('#t-hero')), 'al imprimir solo sale el informe');
  await p.emulateMedia({ media: 'screen' });
  ok(!(await p.isVisible('#informe')), 'en pantalla el informe no se ve');

  // ---------- Alertas inteligentes ----------
  ok(await p.isHidden('#alertas-card'), 'con el ejemplo no hay alertas');
  const hoy = new Date(), dia = (m, d) => { const x = new Date(hoy.getFullYear(), hoy.getMonth() - m, d); return x.toLocaleDateString("sv-SE"); };
  const nd = Math.min(28, hoy.getDate());
  const hd = (n) => { const x = new Date(hoy); x.setDate(x.getDate() - n); return x.toLocaleDateString("sv-SE"); };
  const movs = [
    // Los cobros mensuales caen el mismo día de cada mes (el de hoy, hasta el 28), como un cobro real; así no depende del día en que corra.
    { id: 'n1', f: dia(2, nd), t: 'g', cat: 'suscripciones', c: 'Netflix', m: 26900 }, { id: 'n2', f: dia(1, nd), t: 'g', cat: 'suscripciones', c: 'Netflix', m: 26900 },
    { id: 'n3', f: dia(0, nd), t: 'g', cat: 'suscripciones', c: 'Netflix', m: 33900 },
    { id: 's1', f: dia(1, nd), t: 'g', cat: 'suscripciones', c: 'Spotify', m: 16900 }, { id: 's2', f: dia(0, nd), t: 'g', cat: 'suscripciones', c: 'Spotify', m: 16900 },
    { id: 'r1', f: hd(0), t: 'g', cat: 'ocio', c: 'Rappi', m: 45600 }, { id: 'r2', f: hd(0), t: 'g', cat: 'ocio', c: 'Rappi', m: 45600 },
    { id: 'v1', f: dia(5, 3), t: 'g', cat: 'otros', c: 'Papelería', m: 5000 }
  ];
  for (let i = 0; i < 8; i++) movs.push({ id: 'a' + i, f: dia(1, 1 + i), t: 'g', cat: 'alimentacion', c: 'Tienda', m: 20000 + i * 1000 });
  movs.push({ id: 'big', f: hd(2), t: 'g', cat: 'alimentacion', c: 'Almacén', m: 480000 });
  await p.evaluate(() => document.querySelector('#tabs [data-tab="analisis"]').click()); await p.waitForTimeout(300);
  await p.fill('#f-nota-nueva', 'para guardar'); await p.click('#btn-nota'); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('#tabs [data-tab="inicio"]').click()); await p.waitForTimeout(300);
  await p.evaluate((movs) => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.meses) { v.movs = movs; v.ejemplo = false; localStorage.setItem(k, JSON.stringify(v)); } } catch (e) {} } }, movs);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  const al = (await p.textContent('#alertas-card')).replace(/\u00a0/g, ' ');
  ok(await p.isVisible('#alertas-card'), 'aparece la tarjeta de alertas');
  ok(/Netflix te cobró \$ 33\.900, antes \$ 26\.900/.test(al), 'detecta la suscripción que subió');
  const preg = async (q) => { await p.fill('#pr-input', q); await p.press('#pr-input', 'Enter'); await p.waitForTimeout(700); return p.evaluate(() => [...document.querySelectorAll('#pr-log .pr-msg.app')].pop().textContent.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ')); };
  await p.evaluate(() => document.getElementById('btn-preguntas-menu').click()); await p.waitForTimeout(300);
  let a = await preg('¿Hay algo raro en mis gastos?');
  ok(/Rappi te cobró \$ 45\.600 dos veces/.test(a), 'detecta el posible cobro duplicado');
  ok(/cobro mensual nuevo: Spotify/.test(a), 'detecta la suscripción nueva');
  ok(/Gasto grande: \$ 480\.000 en Almacén/.test(a), 'detecta el gasto fuera de lo normal');
  a = await preg('¿Qué suscripciones tengo?');
  ok(/Netflix/.test(a) && /Spotify/.test(a) && /al año/.test(a), 'lista los cobros mensuales con el total al año');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(CAPTURAS, 'alertas.png') });
  const antes = (await p.$$('#alertas-lista li')).length;
  await p.click('#alertas-lista [data-alerta]'); await p.waitForTimeout(200);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1000);
  const idsTras = await p.$$eval('#alertas-lista [data-alerta]', (l) => l.map((x) => x.dataset.alerta));
  ok(!idsTras.some((id) => /^sube\|netflix/.test(id)), '"Entendido" la descarta y no vuelve (' + antes + ' → ' + idsTras.length + ')');

  ok(!errs.length, 'sin errores en la página ' + errs.join(' | '));
  await b.close();
  if (fallas) { console.log(fallas + ' falla(s)'); process.exit(1); }
  console.log('privacidad, informe y alertas: todo bien');
})().catch((e) => { console.error(e); process.exit(1); });
