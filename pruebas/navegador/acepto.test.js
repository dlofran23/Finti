// Marco legal en la app: edad mínima, autorización del representante, aceptación de términos y datos
// (al crear la cuenta y para cuentas que ya existían) y páginas legales públicas.
// Corre SIN acepto-previo.js: aquí la persona tiene que marcar las casillas.
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE;
const FAKE_GIS = `window.google={accounts:{id:{initialize:function(o){window.__gcb=o.callback;},renderButton:function(el){var b=document.createElement('button');b.type='button';b.textContent='Continuar con Google';b.className='fake-g btn full';b.onclick=function(){fetch('/__google-token?email='+encodeURIComponent(window.__gmail||'gina@correo.com')+'&nombre=Gina').then(function(r){return r.json()}).then(function(j){window.__gcb({credential:j.credential})});};el.appendChild(b);}}}};`;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const espera = (ms) => new Promise(r => setTimeout(r, ms));
async function ctx(b, dev) { const c = await b.newContext(dev); await c.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS })); return c; }
// Elige la fecha de cumpleaños en las ruedas (como en Instagram): abre, escribe el año en la rueda del año y toca Listo
const ANIO = new Date().getFullYear(), ANIOS = { '18+': ANIO - 30, '14-17': ANIO - 16, '-14': ANIO - 10 };
async function edad(p, bloque, v) {
  if (!(await p.isVisible(bloque + ' .nac-panel'))) { await p.click(bloque + ' .nac-btn'); await espera(250); }
  await p.focus(bloque + ' .nac-rueda[data-r="a"]'); await p.keyboard.type(String(ANIOS[v]), { delay: 40 }); await espera(200);
  await p.click(bloque + ' .nac-listo'); await espera(200);
}
const correos = async (p) => (await (await p.request.get(BASE + '/__correos')).json());

(async () => {
  const b = await chromium.launch(); const errs = [];

  // ---------- 1. Páginas legales públicas ----------
  const C0 = await ctx(b, devices['Desktop Chrome']); const p0 = await C0.newPage(); p0.on('pageerror', e => errs.push(e.message));
  for (const [ruta, titulo] of [['/legal/privacidad.html', 'Política de tratamiento de datos personales'], ['/legal/terminos.html', 'Términos y condiciones'], ['/legal/eliminar-cuenta.html', '¿Cómo borrar tu cuenta']]) {
    const r = await p0.goto(BASE + ruta);
    const h1 = await p0.textContent('h1'), cuerpo = await p0.textContent('body');
    ok(r.status() === 200 && h1.includes(titulo) && !cuerpo.includes('{{') && !/[«»]/.test(cuerpo), ruta + ': publicada y sin marcas pendientes');
    ok(/Francisco Antonio Jimenez Jimenez/.test(cuerpo) && /Alfonso Andres Camargo Brochero/.test(cuerpo) && /Barranquilla/.test(cuerpo) && /franciscojz14@outlook\.com/.test(cuerpo), ruta + ': responsables, ciudad y correo de contacto');
  }
  // Las páginas legales cargan su diseño y las fuentes de la app
  const estilo = await p0.evaluate(async () => { await document.fonts.ready; return { h1: getComputedStyle(document.querySelector('h1')).fontFamily, cuerpo: getComputedStyle(document.body).fontFamily, fondo: getComputedStyle(document.querySelector('main')).borderRadius }; });
  ok(/Unbounded/.test(estilo.h1) && /Manrope/.test(estilo.cuerpo), 'las páginas legales usan el diseño de la app (Unbounded y Manrope): ' + estilo.h1 + ' / ' + estilo.cuerpo);
  await p0.goto(BASE + '/legal/privacidad.html');
  const priv = await p0.textContent('main');
  ok(/14 años/.test(priv) && /representante legal/.test(priv) && /10 días hábiles/.test(priv) && /15 días hábiles/.test(priv), 'privacidad: edad mínima, representante y plazos de consultas y reclamos');
  ok(/Cloudflare/.test(priv) && /Wompi/.test(priv) && /Circular Externa 005 de 2017/.test(priv), 'privacidad: encargados y transmisión internacional');
  ok(/no envía tus cifras a nadie|no enviamos tus cifras a terceros ni a sistemas de inteligencia artificial/i.test(priv), 'privacidad: el asesor no envía datos a terceros');
  await p0.goto(BASE + '/legal/terminos.html');
  const ter = await p0.textContent('main');
  ok(/pago único/i.test(ter) && /5 días hábiles/.test(ter) && /15 días calendario/.test(ter) && /artículo 51 de la Ley 1480/.test(ter), 'términos: pago único, retracto, devolución y reversión');
  ok(await p0.$('#compra') !== null, 'términos: ancla a las condiciones de compra');
  await C0.close();

  // ---------- 2. Bienvenida: sin aceptar no se puede entrar con Google ----------
  const A = await ctx(b, devices['Pixel 7']); const a = await A.newPage(); a.on('pageerror', e => errs.push('A ' + e.message));
  await a.goto(BASE, { waitUntil: 'networkidle' }); await espera(600);
  ok(await a.isVisible('#bienv-acepto .nac-btn') && await a.isVisible('#bienv-google .g-bloqueo'), 'la bienvenida pide la fecha de cumpleaños y bloquea Google hasta aceptar');
  ok(/Desde 14 años/.test(await a.textContent('#bienv-acepto .nac-min')) && /no se muestra a nadie/.test(await a.textContent('#bienv-acepto .nac-nota')) && /14 años/.test(await a.textContent('#bienv-acepto .nac-nota')), 'muestra la edad mínima (14) y que la fecha no se muestra a nadie');
  ok(!(await a.isVisible('#bienv-acepto .nac-panel')), 'las ruedas empiezan cerradas');
  await a.click('#bienv-google .g-bloqueo'); await espera(200);
  ok(/fecha de cumpleaños/.test(await a.textContent('#bienv-msg')), 'tocar Google sin aceptar: pide la fecha (' + (await a.textContent('#bienv-msg')) + ')');
  await a.click('#bienv-acepto .nac-btn'); await espera(300);
  ok(await a.isVisible('#bienv-acepto .nac-panel') && (await a.getAttribute('#bienv-acepto .nac-btn', 'aria-expanded')) === 'true', 'al tocarla se abren las ruedas');
  ok((await a.$$eval('#bienv-acepto .nac-rueda', (l) => l.map((x) => x.getAttribute('aria-label')))).join(',') === 'Día,Mes,Año', 'tres ruedas: día, mes y año');
  ok((await a.$$eval('#bienv-acepto .nac-rueda[data-r="m"] [role=option]', (l) => l.length)) === 12 && (await a.$$eval('#bienv-acepto .nac-rueda[data-r="a"] [role=option]', (l) => l.length)) === 101, 'doce meses y cien años');
  // Las ruedas se mueven con el dedo (scroll con imán)
  await a.$eval('#bienv-acepto .nac-rueda[data-r="m"]', (w) => { w.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); w.scrollTop = 40 * 1; }); await espera(400);
  ok((await a.getAttribute('#bienv-acepto .nac-rueda[data-r="m"] [aria-selected="true"]', 'data-i')) === '1', 'al deslizar la rueda del mes queda elegido febrero');
  // Con teclado: escribir el año salta a él; el día se ajusta al mes (31 de febrero no existe)
  await a.focus('#bienv-acepto .nac-rueda[data-r="d"]'); await a.keyboard.press('End'); await espera(150);
  ok(Number(await a.textContent('#bienv-acepto .nac-rueda[data-r="d"] [aria-selected="true"]')) <= 29, 'en febrero el último día es 28 o 29');
  await a.focus('#bienv-acepto .nac-rueda[data-r="a"]'); await a.keyboard.type(String(ANIO - 10), { delay: 40 }); await espera(200);
  ok(/Tienes (9|10) años/.test(await a.textContent('#bienv-acepto .nac-edad')) && /sin cuenta/.test(await a.textContent('#bienv-acepto .nac-edad')), 'muestra la edad calculada al momento: ' + (await a.textContent('#bienv-acepto .nac-edad')));
  await a.keyboard.press('Enter'); await espera(250);
  ok(/^\d+ feb\. \d{4} · (9|10) años$/.test(await a.textContent('#bienv-acepto .edad-txt b')) && !(await a.isVisible('#bienv-acepto .nac-panel')), 'Enter confirma la fecha y cierra las ruedas');
  await a.check('#bienv-acepto [data-k="ok"]');
  await a.click('#bienv-google .g-bloqueo'); await espera(200);
  ok(/menos de 14 años no se puede crear/.test(await a.textContent('#bienv-msg')) && await a.$eval('#bienv-acepto .acepto-menor', (e) => e.classList.contains('destacado')), 'menos de 14: no deja crear la cuenta y ofrece usar la app sin cuenta');
  await a.uncheck('#bienv-acepto [data-k="ok"]');

  await edad(a, '#bienv-acepto', '14-17');
  ok(/16 años$/.test(await a.textContent('#bienv-acepto .edad-txt b')), 'la fecha elegida queda en el campo con la edad: ' + (await a.textContent('#bienv-acepto .edad-txt b')));
  ok(await a.isVisible('#bienv-acepto [data-rep]'), 'entre 14 y 17: aparece la autorización del representante');
  await a.check('#bienv-acepto [data-k="ok"]');
  ok(await a.isVisible('#bienv-google .g-bloqueo'), 'sin la autorización del representante sigue bloqueado');
  await a.click('#bienv-google .g-bloqueo'); await espera(200);
  ok(/representante/.test(await a.textContent('#bienv-msg')), 'explica que falta la autorización del representante');
  await a.check('#bienv-acepto [data-rep] input');
  ok(!(await a.isVisible('#bienv-google .g-bloqueo')), 'con todo marcado se libera el botón de Google');
  ok(await a.evaluate(() => /ft_acepto=1\.4~14~1/.test(document.cookie)), 'deja la aceptación lista para Google por redirección');
  // La misma elección aparece en la hoja de la cuenta
  await a.click('#bienv-correo'); await espera(300);
  ok(/16 años$/.test(await a.textContent('#cta-acepto .edad-txt b')) && await a.isChecked('#cta-acepto [data-k="ok"]'), 'la hoja de la cuenta conserva lo que marcó');
  // Escape cierra las ruedas sin cerrar la hoja de la cuenta
  await a.click('#cta-acepto .nac-btn'); await espera(300); await a.keyboard.press('Escape'); await espera(250);
  ok(!(await a.isVisible('#cta-acepto .nac-panel')) && await a.isVisible('#dlg-cuenta'), 'Escape cierra las ruedas y la hoja sigue abierta');
  // Entra con código: la cuenta nueva queda con la prueba de la aceptación
  await a.fill('#cta-correo', 'teen@correo.com'); await a.click('#cta-enviar'); await espera(400);
  const cod = /(\d{6})/.exec((await correos(a)).filter((x) => x.to === 'teen@correo.com').pop().subject)[1];
  await a.locator('#cta-code input').first().fill(cod); await espera(1800);
  const tok = await a.evaluate(() => JSON.parse(localStorage.getItem('fintelligente-cuenta')).token);
  const yo = await (await a.request.get(BASE + '/api/cuenta', { headers: { Authorization: 'Bearer ' + tok } })).json();
  ok(yo.usuario && yo.usuario.acepto && yo.usuario.acepto.edad === '14-17' && yo.usuario.acepto.v === '1.4', 'el servidor guardó la aceptación (14 a 17, versión 1.3)');
  ok(!JSON.stringify(yo).includes(String(ANIOS['14-17'])) && !/nac|fecha/i.test(Object.keys(yo.usuario.acepto).join(',')), 'la fecha de cumpleaños no sale del dispositivo: al servidor solo va el rango');
  ok(!(await a.isVisible('#dlg-acepto')), 'no vuelve a preguntar');
  await A.close();

  // ---------- 3. Sin aceptar no se envía el código ----------
  const Bx = await ctx(b, devices['Desktop Chrome']); const p2 = await Bx.newPage(); p2.on('pageerror', e => errs.push('B ' + e.message));
  await p2.goto(BASE, { waitUntil: 'networkidle' }); await espera(400);
  await p2.click('#bienv-correo'); await espera(300);
  const antes = (await correos(p2)).length;
  await p2.fill('#cta-correo', 'nadie@correo.com'); await p2.click('#cta-enviar'); await espera(500);
  ok((await correos(p2)).length === antes && /fecha de cumpleaños/.test(await p2.textContent('#cta-msg')), 'sin aceptar no se envía el código');
  ok(/menos de 14/.test(await p2.textContent('#cta-acepto')), 'explica que con menos de 14 se puede usar sin cuenta');
  // Google en la hoja también está bloqueado y luego entra
  await p2.click('#cta-google .g-bloqueo'); await espera(200);
  ok(/fecha de cumpleaños/.test(await p2.textContent('#cta-msg')), 'Google en la hoja también pide aceptar');
  await edad(p2, '#cta-acepto', '18+'); await p2.check('#cta-acepto [data-k="ok"]');
  await p2.click('#cta-google .fake-g'); await espera(1800);
  const g = await p2.evaluate(() => JSON.parse(localStorage.getItem('fintelligente-cuenta') || 'null'));
  ok(g && g.usuario.correo === 'gina@correo.com' && g.usuario.acepto && g.usuario.acepto.edad === '18+', 'entra con Google y queda la aceptación (18 o más)');
  await Bx.close();

  // ---------- 4. Cuenta que existía antes de los términos: se le pide aceptar una vez ----------
  const r1 = await (await fetch(BASE + '/api/cuenta/codigo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: 'vieja@correo.com' }) })).json();
  const c1 = /(\d{6})/.exec((await (await fetch(BASE + '/__correos')).json()).filter((x) => x.to === 'vieja@correo.com').pop().subject)[1];
  const v1 = await (await fetch(BASE + '/api/cuenta/verificar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: 'vieja@correo.com', codigo: c1, consentimiento: { v: '0.9', edad: '18+' } }) })).json();
  ok(r1 && v1.token && v1.usuario.acepto.v === '0.9', 'cuenta creada con una versión anterior de los documentos');
  const Cx = await ctx(b, devices['Pixel 7']); await Cx.addInitScript(() => { try { sessionStorage.setItem('fintelligente-sin-cuenta', '1'); } catch (e) {} });
  const c = await Cx.newPage(); c.on('pageerror', e => errs.push('C ' + e.message));
  await c.goto(BASE, { waitUntil: 'networkidle' });
  await c.evaluate((j) => localStorage.setItem('fintelligente-cuenta', JSON.stringify({ token: j.token, usuario: j.usuario, version: 0, sucio: false, auto: true, e2e: null })), v1);
  await c.reload({ waitUntil: 'networkidle' }); await espera(2500);
  ok(await c.isVisible('#dlg-acepto'), 'al abrir, pide aceptar la versión nueva');
  await c.click('#acepto-ok'); await espera(300);
  ok(/fecha de cumpleaños/.test(await c.textContent('#acepto-msg')), 'sin marcar no deja seguir');
  await edad(c, '#dlg-acepto-bloque', '18+'); await c.check('#dlg-acepto-bloque [data-k="ok"]');
  await c.click('#acepto-ok'); await espera(800);
  const yo2 = await (await c.request.get(BASE + '/api/cuenta', { headers: { Authorization: 'Bearer ' + v1.token } })).json();
  ok(!(await c.isVisible('#dlg-acepto')) && yo2.usuario.acepto.v === '1.4', 'acepta y el servidor guarda la versión 1.4');
  await c.reload({ waitUntil: 'networkidle' }); await espera(2000);
  ok(!(await c.isVisible('#dlg-acepto')), 'no vuelve a preguntar después');
  // ---------- 5. Cuenta que aceptó la 1.2: no se le pide aceptar otra vez; se le avisa una vez del cambio ----------
  const r5 = await (await fetch(BASE + '/api/cuenta/codigo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: 'doce@correo.com' }) })).json();
  const c5 = /(\d{6})/.exec((await (await fetch(BASE + '/__correos')).json()).filter((x) => x.to === 'doce@correo.com').pop().subject)[1];
  const v5 = await (await fetch(BASE + '/api/cuenta/verificar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: 'doce@correo.com', codigo: c5, consentimiento: { v: '1.2', edad: '18+' } }) })).json();
  const Dx = await ctx(b, devices['Pixel 7']); await Dx.addInitScript(() => { try { sessionStorage.setItem('fintelligente-sin-cuenta', '1'); } catch (e) {} });
  const d5 = await Dx.newPage(); d5.on('pageerror', e => errs.push('D ' + e.message));
  await d5.goto(BASE, { waitUntil: 'networkidle' });
  await d5.evaluate((j) => localStorage.setItem('fintelligente-cuenta', JSON.stringify({ token: j.token, usuario: j.usuario, version: 0, sucio: false, auto: true, e2e: null })), v5);
  await d5.reload({ waitUntil: 'networkidle' }); await espera(2500);
  ok(r5 && v5.usuario.acepto.v === '1.2' && !(await d5.isVisible('#dlg-acepto')), 'con la versión 1.2 no se pide aceptar de nuevo (el cambio tiene su propio permiso)');
  ok(/Actualizamos la política de privacidad \(versión 1\.4\)/.test(await d5.textContent('#toasts')), 'avisa una vez que la política cambió');
  await d5.reload({ waitUntil: 'networkidle' }); await espera(2500);
  ok(!/Actualizamos la política/.test(await d5.textContent('#toasts')), 'el aviso no se repite');
  await Dx.close();
  const priv13 = await (await fetch(BASE + '/legal/privacidad.html')).text();
  ok(/Versión 1\.3/.test(priv13) && /id="cambios"/.test(priv13) && /Decreto 1377 de 2013/.test(priv13) && /compartir tus precios/.test(priv13), 'la política dice la versión 1.3 y qué cambió');
  // Enlaces legales visibles en la app
  ok((await c.$$eval('#foot-legal a', (l) => l.map((x) => x.getAttribute('href')))).join(',') === '/legal/privacidad.html,/legal/terminos.html,/legal/eliminar-cuenta.html', 'el pie de la app enlaza los tres documentos');
  await Cx.close();

  console.log('errores de página:', errs);
  ok(!errs.length, 'sin errores de JavaScript');
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO BIEN (marco legal)');
  await b.close();
})();
