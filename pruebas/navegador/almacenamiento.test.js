// Almacenamiento en el navegador: IndexedDB con copia en localStorage, paso automático de los datos viejos,
// navegador sin espacio en localStorage, varias pestañas abiertas y el aviso de iPhone en Safari.
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const espera = (ms) => new Promise(r => setTimeout(r, ms));
// En el Inicio el título del presupuesto no se muestra (encabezado limpio): se edita desde otra pestaña.
// El título del presupuesto se ve en Tu presupuesto
const verTitulo = (p) => p.evaluate(() => { const t = document.querySelector('[data-tab="presupuesto"], [data-goto="presupuesto"]'); if (t && document.body.dataset.vista !== 'presupuesto') t.click(); });
const FAKE_GIS = `window.google={accounts:{id:{initialize:function(){},renderButton:function(){}}}};`;
const enIdb = (p) => p.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('fintelligente-datos', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('estado');
  r.onsuccess = () => { const q = r.result.transaction('estado').objectStore('estado').get('presupuesto-web-sin-cuenta'); q.onsuccess = () => { const v = q.result; r.result.close(); res(v ? JSON.parse(v.s).titulo : null); }; };
  r.onerror = () => res(null);
}));
async function nuevo(b, dev, init) {
  const c = await b.newContext(dev);
  await c.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }));
  await c.addInitScript(() => { try { sessionStorage.setItem('fintelligente-sin-cuenta', '1'); } catch (e) {} });
  if (init) await c.addInitScript(init);
  return c;
}

(async () => {
  const b = await chromium.launch(); const errs = [];

  // ---------- 1. Datos de una versión anterior (solo en localStorage) pasan solos a IndexedDB ----------
  let c = await nuevo(b, devices['Desktop Chrome']);
  let p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await espera(400);
  await p.evaluate(() => { const s = JSON.parse(document.getElementById('budget-data').textContent); s.titulo = 'Datos de antes'; s.ejemplo = false; localStorage.setItem('presupuesto-web-sin-cuenta', JSON.stringify(s)); });
  await p.evaluate(() => new Promise((r) => { const d = indexedDB.deleteDatabase('fintelligente-datos'); d.onsuccess = d.onerror = d.onblocked = r; }));
  await p.reload({ waitUntil: 'networkidle' }); await espera(600);
  ok((await p.inputValue('#f-titulo')) === 'Datos de antes', 'abre los datos que estaban en localStorage');
  ok((await enIdb(p)) === 'Datos de antes', 'y los copia a IndexedDB');
  ok(await p.evaluate(() => !!localStorage.getItem('presupuesto-web-sin-cuenta')), 'sin borrar la copia original');
  await verTitulo(p); await p.fill('#f-titulo', 'Cambio nuevo'); await p.press('#f-titulo', 'Tab'); await p.evaluate(() => { const t = document.querySelector('[data-tab="inicio"], [data-goto="inicio"]'); if (t) t.click(); }); await espera(400);
  ok((await enIdb(p)) === 'Cambio nuevo' && (await p.evaluate(() => JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta')).titulo)) === 'Cambio nuevo', 'cada cambio queda en los dos lugares');

  // ---------- 2. Varias pestañas: la que estaba atrás no pisa lo que guardó la otra ----------
  const p2 = await c.newPage(); p2.on('pageerror', e => errs.push(e.message));
  await p2.goto(BASE, { waitUntil: 'networkidle' }); await espera(500);
  await p.bringToFront(); await verTitulo(p); await p.fill('#f-titulo', 'Desde la pestaña 1'); await p.press('#f-titulo', 'Tab'); await p.evaluate(() => { const t = document.querySelector('[data-tab="inicio"], [data-goto="inicio"]'); if (t) t.click(); }); await espera(500);
  await p2.bringToFront(); await p2.evaluate(() => window.dispatchEvent(new Event('focus'))); await espera(700);
  ok((await p2.inputValue('#f-titulo')) === 'Desde la pestaña 1', 'la otra pestaña ve el cambio al volver a ella');
  await c.close();

  // ---------- 3. localStorage lleno: todo sigue guardándose en IndexedDB ----------
  c = await nuevo(b, devices['Desktop Chrome'], () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (this === window.localStorage && String(k).indexOf('presupuesto-web-sin-cuenta') === 0 && window.__lleno) { const e = new Error('lleno'); e.name = 'QuotaExceededError'; throw e; } return orig.call(this, k, v); };
  });
  p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await espera(400);
  await p.evaluate(() => { window.__lleno = true; });
  await verTitulo(p); await p.fill('#f-titulo', 'No cabe en localStorage'); await p.press('#f-titulo', 'Tab'); await p.evaluate(() => { const t = document.querySelector('[data-tab="inicio"], [data-goto="inicio"]'); if (t) t.click(); }); await espera(500);
  ok(await p.evaluate(() => !localStorage.getItem('presupuesto-web-sin-cuenta')), 'sin espacio: no deja una copia vieja en localStorage');
  await p.addInitScript(() => { window.__lleno = true; });
  await p.reload({ waitUntil: 'networkidle' }); await espera(600);
  ok((await p.inputValue('#f-titulo')) === 'No cabe en localStorage', 'al volver a abrir, los datos salen de IndexedDB');
  await c.close();

  // ---------- 4. iPhone en Safari: aviso de que Safari puede borrar los datos ----------
  const ios = devices['iPhone 14'];
  c = await b.newContext(ios); await c.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }));
  p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await espera(500);
  ok(await p.isVisible('#bienv-ios'), 'la pantalla de entrada explica el riesgo en iPhone');
  await p.click('#bienv-sin'); await p.click('#btn-zero'); await p.click('#btn-zero');
  await verTitulo(p); await p.fill('#f-titulo', 'Mis cuentas'); await p.press('#f-titulo', 'Tab'); await p.evaluate(() => { const t = document.querySelector('[data-tab="inicio"], [data-goto="inicio"]'); if (t) t.click(); }); await espera(400);
  // Solo se ve un aviso a la vez: según la hora puede ir primero el de "¿Gastaste algo hoy?"; se cierra para ver el siguiente.
  if (await p.isVisible('#nudge')) { await p.click('#nudge-x'); await espera(200); }
  ok(await p.isVisible('#nudge-cuenta'), 'con datos propios aparece el aviso');
  ok(/Safari/.test(await p.textContent('#nudge-cuenta-t')) && /7 días/.test(await p.textContent('#nudge-cuenta-p')), 'el aviso habla de Safari y de los 7 días');
  ok(!(await p.isVisible('#nudge-ios-pasos')), 'los pasos empiezan cerrados');
  await p.click('#nudge-ios-btn'); await espera(200);
  const pasos = await p.textContent('#nudge-ios-pasos');
  ok(await p.isVisible('#nudge-ios-pasos') && /Compartir/.test(pasos) && /Agregar a inicio/.test(pasos) && /crea tu cuenta/.test(pasos), 'muestra cómo agregarla al inicio y que el ícono empieza vacío');
  await p.screenshot({ path: require('path').join(__dirname, 'capturas', 'aviso-iphone-safari.png') });
  await c.close();
  // En Android no aparece ese botón
  c = await nuevo(b, devices['Pixel 7']); p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await espera(400);
  await p.click('#btn-zero'); await p.click('#btn-zero'); await verTitulo(p); await p.fill('#f-titulo', 'Android'); await p.press('#f-titulo', 'Tab'); await p.evaluate(() => { const t = document.querySelector('[data-tab="inicio"], [data-goto="inicio"]'); if (t) t.click(); }); await espera(400);
  await espera(300); if (await p.isVisible('#nudge')) { await p.click('#nudge-x'); await espera(200); }
  ok(await p.isVisible('#nudge-cuenta') && !(await p.isVisible('#nudge-ios-btn')) && !/Safari/.test(await p.textContent('#nudge-cuenta-t')), 'en Android el aviso es el de siempre');
  await c.close();

  console.log('errores de página:', errs);
  ok(!errs.length, 'sin errores de JavaScript');
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO BIEN (almacenamiento)');
  await b.close();
})();
