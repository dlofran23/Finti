const CAPTURAS = require('path').join(__dirname, 'capturas'); require('fs').mkdirSync(CAPTURAS, { recursive: true });
const { chromium, devices } = require('playwright');
const escribirTitulo = require('./titulo.js');
const BASE = process.env.BASE;
const FAKE_GIS = `window.google={accounts:{id:{initialize:function(o){window.__gcb=o.callback;},renderButton:function(el){var b=document.createElement('button');b.type='button';b.textContent='Continuar con Google';b.className='fake-g btn full';b.onclick=function(){fetch('/__google-token?email='+encodeURIComponent(window.__gmail||'laura@correo.com')+'&nombre=Laura%20G%C3%B3mez').then(function(r){return r.json()}).then(function(j){window.__gcb({credential:j.credential})});};el.appendChild(b);}}}};`;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const espera = (ms) => new Promise(r => setTimeout(r, ms));
// La persona sale de la app unos segundos y vuelve (así la app revisa novedades).
const volver = async (pg) => {
  await pg.evaluate(() => { window.__vis = 'hidden'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis }); document.dispatchEvent(new Event('visibilitychange')); });
  await new Promise((r) => setTimeout(r, 3300));
  await pg.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
};
async function ctx(b, dev) { const c = await b.newContext(dev); await c.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS })); return c; }
async function codigoDe(p, correo) { const l = await (await p.request.get(BASE + '/__correos')).json(); const m = l.filter(x => x.to === correo).pop(); return /(\d{6})/.exec(m.subject)[1]; }
(async () => {
  const b = await chromium.launch(); const errs = [];
  // ---------- Dispositivo A: celular ----------
  const A = await ctx(b, devices['Pixel 7']); const a = await A.newPage(); a.on('pageerror', e => errs.push('A ' + e.message));
  await a.goto(BASE, { waitUntil: 'networkidle' }); await espera(800);
  ok(await a.isVisible('#dlg-bienvenida'), 'B1 bienvenida aparece la primera vez');
  ok(await a.isVisible('#bienv-google .fake-g'), 'botón de Google en la bienvenida');
  await a.screenshot({ path: 'shots/cta-B1.png' });
  await a.click('#bienv-sin'); ok(!(await a.isVisible('#dlg-bienvenida')), 'usar sin cuenta cierra');
  await a.reload({ waitUntil: 'networkidle' }); await espera(600);
  ok(!(await a.isVisible('#dlg-bienvenida')), 'no vuelve a aparecer');
  ok(!(await a.isVisible('#nudge-cuenta')), 'sin aviso mientras son datos de ejemplo');
  await a.click('#btn-zero'); await a.click('#btn-zero'); await escribirTitulo(a, 'Plata de Laura'); await espera(300);
  ok(await a.isVisible('#nudge-cuenta'), 'C1 aviso en Inicio con datos propios');
  await a.screenshot({ path: 'shots/cta-C1.png' });
  await a.click('#nudge-cuenta-si'); await espera(300);
  ok(await a.isVisible('#cta-inicio'), 'A1 hoja abre');
  await a.screenshot({ path: 'shots/cta-A1.png' });
  await a.fill('#cta-correo', 'Laura@Correo.com'); await a.click('#cta-enviar'); await espera(400);
  ok(await a.isVisible('#cta-codigo'), 'A2 paso del código');
  await a.screenshot({ path: 'shots/cta-A2.png' });
  const cod = await codigoDe(a, 'laura@correo.com');
  await a.locator('#cta-code input').first().fill(cod);   // pegar el código completo
  await espera(1500);
  ok(await a.isVisible('#cta-listo'), 'B2 cuenta conectada');
  ok((await a.textContent('#cta-listo-card')).includes('laura@correo.com'), 'muestra el correo');
  await a.screenshot({ path: 'shots/cta-B2.png' });
  await a.click('#cta-listo [data-close]');
  ok((await a.textContent('#btn-cuenta')).trim().startsWith('L'), 'botón muestra iniciales');
  ok((await a.textContent('#save-status')).includes('cuenta'), 'estado: guardado en tu cuenta');
  const tokA = await a.evaluate(() => JSON.parse(localStorage.getItem('fintelligente-cuenta')).token);
  const meta = async (p, t) => (await p.request.get(BASE + '/api/datos?meta=1', { headers: { Authorization: 'Bearer ' + t } })).json();
  ok((await meta(a, tokA)).version === 1, 'nube v1');
  // cambio → copia automática
  await escribirTitulo(a, 'Plata de Laura 2'); await espera(3500);
  ok((await meta(a, tokA)).version === 2, 'copia automática v2');

  // ---------- Dispositivo B: computador, entra con Google ----------
  const B = await ctx(b, { viewport: { width: 1280, height: 860 } }); const pb = await B.newPage(); pb.on('pageerror', e => errs.push('B ' + e.message));
  await pb.goto(BASE, { waitUntil: 'networkidle' }); await espera(800);
  ok(await pb.isVisible('#dlg-bienvenida'), 'B: bienvenida');
  await pb.click('#bienv-google .fake-g'); await espera(2000);
  ok(await pb.isVisible('#cta-listo'), 'B: Google conecta');
  ok((await pb.inputValue('#f-titulo')) === 'Plata de Laura 2', 'B: trae los datos de la nube');
  ok((await pb.textContent('#cta-listo-t')).includes('Laura'), 'B: saluda por el nombre de Google');
  await pb.screenshot({ path: 'shots/cta-B2-desktop.png' });
  await pb.click('#cta-listo [data-close]');
  await escribirTitulo(pb, 'Cambiado en el PC'); await espera(3500);
  // A se actualiza al volver
  await volver(a); await espera(1500);
  ok((await a.inputValue('#f-titulo')) === 'Cambiado en el PC', 'A recibe los cambios del PC');

  // ---------- Perfil (C2) y cifrado propio en A ----------
  await a.click('#btn-cuenta'); await espera(800);
  ok(await a.isVisible('#dlg-perfil'), 'C2 perfil abre');
  ok((await a.$$('#perfil-dev .dev')).length === 2, 'C2 muestra 2 dispositivos');
  await a.screenshot({ path: 'shots/cta-C2.png' });
  await a.click('#perfil-e2e', { force: true }); await espera(200);
  ok(await a.isVisible('#perfil-e2e-form'), 'formulario de clave');
  await a.fill('#e2e-1', 'mi-clave-segura'); await a.fill('#e2e-2', 'mi-clave-segura'); await a.click('#e2e-ok'); await espera(3500);
  ok((await a.textContent('#perfil-msg')).includes('cifrada con tu clave'), 'cifrado propio activo');
  const datos = await (await a.request.get(BASE + '/api/datos', { headers: { Authorization: 'Bearer ' + tokA } })).json();
  ok(datos.contenido.startsWith('e2e1:') && !datos.contenido.includes('Cambiado'), 'la nube solo ve texto cifrado');
  await a.click('#dlg-perfil [data-close]');

  // ---------- Dispositivo C: nuevo, con correo, pide la clave ----------
  const Cx = await ctx(b, devices['iPhone 14']); const c = await Cx.newPage(); c.on('pageerror', e => errs.push('C ' + e.message));
  await c.goto(BASE, { waitUntil: 'networkidle' }); await espera(700);
  await c.click('#bienv-correo'); await c.fill('#cta-correo', 'laura@correo.com'); await c.click('#cta-enviar'); await espera(400);
  await c.locator('#cta-code input').first().fill(await codigoDe(c, 'laura@correo.com')); await espera(2000);
  ok(await c.isVisible('#cta-clave'), 'C: pide la clave de cifrado');
  await c.fill('#cta-clave-in', 'otra-clave'); await c.click('#cta-clave-ok'); await espera(2500);
  ok((await c.textContent('#cta-msg4')).includes('no abre'), 'C: clave incorrecta rechazada');
  await c.fill('#cta-clave-in', 'mi-clave-segura'); await c.click('#cta-clave-ok'); await espera(3000);
  ok((await c.inputValue('#f-titulo')) === 'Cambiado en el PC', 'C: abre los datos con la clave correcta');

  // ---------- Conflicto: cambios en A sin conexión mientras C también cambia ----------
  await A.setOffline(true);
  await escribirTitulo(a, 'Offline en A'); await espera(3000);
  await c.click('#cta-listo [data-close]').catch(() => {});
  await escribirTitulo(c, 'Desde el iPhone'); await espera(3500);
  await A.setOffline(false);
  await volver(a); await espera(2500);
  ok(await a.isVisible('#cta-elegir'), 'A: conflicto pregunta qué conservar');
  await a.screenshot({ path: CAPTURAS + '/cta-conflicto.png' });
  await a.click('#cta-usar-local'); await espera(3000);
  const tokC = await c.evaluate(() => JSON.parse(localStorage.getItem('fintelligente-cuenta')).token);
  ok((await meta(c, tokC)).version >= 5, 'A conservó lo suyo y lo subió');

  // ---------- Cerrar sesión y borrar ----------
  await a.click('#cta-listo [data-close]').catch(() => {});
  await a.click('#btn-cuenta'); await espera(600); await a.click('#perfil-salir'); await espera(1200);
  await a.waitForLoadState('networkidle'); await espera(800);
  ok(!(await a.evaluate(() => localStorage.getItem('fintelligente-cuenta'))), 'A cerró sesión');
  ok(await a.isVisible('#dlg-bienvenida'), 'al cerrar sesión vuelve a la pantalla de entrada');
  ok((await a.textContent('#bienv-cierre')).includes('Cerraste sesión'), 'explica que cerró sesión');
  await a.screenshot({ path: CAPTURAS + '/cta-salir.png' });
  ok((await a.inputValue('#f-titulo')) !== 'Offline en A', 'el dispositivo queda limpio (los datos están en la cuenta)');
  // vuelve a entrar: recupera su presupuesto desde la nube
  await a.click('#bienv-correo'); await espera(300);
  await a.fill('#cta-correo', 'laura@correo.com'); await a.click('#cta-enviar'); await espera(400);
  await a.locator('#cta-code input').first().fill(await codigoDe(a, 'laura@correo.com')); await espera(2500);
  ok(await a.isVisible('#cta-clave'), 'al volver pide su clave de cifrado (la del dispositivo se borró al salir)');
  await a.fill('#cta-clave-in', 'mi-clave-segura'); await a.click('#cta-clave-ok'); await espera(3000);
  await a.click('#cta-listo [data-close]').catch(() => {}); await espera(300);
  ok((await a.inputValue('#f-titulo')) === 'Offline en A', 'al entrar de nuevo recupera sus datos');
  await c.click('#btn-cuenta'); await espera(800); await c.click('#perfil-borrar'); await c.click('#perfil-borrar'); await espera(1500);
  ok(!(await c.evaluate(() => localStorage.getItem('fintelligente-cuenta'))), 'C borró la cuenta');
  ok((await (await c.request.get(BASE + '/api/datos?meta=1', { headers: { Authorization: 'Bearer ' + tokC } })).status()) === 401, 'sesiones invalidadas tras borrar');
  console.log('errores de página:', errs);
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO BIEN (cuentas en el navegador)');
  await b.close();
})();
