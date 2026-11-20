// Revisión de "conectar cuentas": entrada con Google (ventana y redirección), código por correo con cupo diario,
// copia en la nube sin falsos errores, datos de un dispositivo nuevo y menos consultas al servidor.
const { chromium, devices } = require('playwright');
const escribirTitulo = require('./titulo.js');
const BASE = process.env.BASE;
const FAKE_GIS = `window.google={accounts:{id:{initialize:function(o){window.__ginit=o;window.__gcb=o.callback;},renderButton:function(el){var b=document.createElement('button');b.type='button';b.textContent='Continuar con Google';b.className='fake-g btn full';b.onclick=function(){fetch('/__google-token?email='+encodeURIComponent(window.__gmail||'ana@correo.com')+'&nombre=Ana').then(function(r){return r.json()}).then(function(j){window.__gcb({credential:j.credential})});};el.appendChild(b);}}}};`;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const espera = (ms) => new Promise(r => setTimeout(r, ms));
async function ctx(b, dev) { const c = await b.newContext(dev); await c.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS })); return c; }
async function codigoDe(p, correo) { const l = await (await p.request.get(BASE + '/__correos')).json(); const m = l.filter(x => x.to === correo).pop(); return /(\d{6})/.exec(m.subject)[1]; }
const llamadas = async (p, desde) => (await (await p.request.get(BASE + '/__llamadas')).json()).filter((x) => x.t >= desde);
async function entrarConCorreo(p, correo) {
  await p.click('#bienv-correo'); await p.fill('#cta-correo', correo); await p.click('#cta-enviar'); await espera(400);
  await p.locator('#cta-code input').first().fill(await codigoDe(p, correo)); await espera(1800);
}

(async () => {
  const b = await chromium.launch(); const errs = [];

  // ---------- 1. Dispositivo con datos propios entra y crea su buzón ----------
  const A = await ctx(b, devices['Pixel 7']); const a = await A.newPage(); a.on('pageerror', e => errs.push('A ' + e.message));
  await a.goto(BASE, { waitUntil: 'networkidle' }); await espera(600);
  await a.click('#bienv-sin'); await a.click('#btn-zero'); await a.click('#btn-zero');
  await escribirTitulo(a, 'Plata de Ana'); await espera(300);
  await a.click('#nudge-cuenta-si'); await a.fill('#cta-correo', 'ana@correo.com'); await a.click('#cta-enviar'); await espera(400);
  await a.locator('#cta-code input').first().fill(await codigoDe(a, 'ana@correo.com')); await espera(2000);
  ok(await a.isVisible('#cta-listo'), 'entra con código y sube sus datos');
  await a.click('#dlg-cuenta [data-close]').catch(() => {}); await a.keyboard.press('Escape');
  await a.click((await a.isVisible('#btn-menu')) ? '#btn-menu' : '#barra-mas'); await espera(300); await a.click('#lateral [data-clic="btn-fuentes-menu"]'); await espera(500);
  await a.evaluate(() => document.querySelectorAll('#fuentes-body details').forEach((d) => { d.open = true; }));   // Opciones avanzadas
  await a.click('#btn-crear-buzon'); await espera(2500);
  await a.keyboard.press('Escape');
  const tieneBuzon = await a.evaluate(() => !!localStorage.getItem('fintelligente-buzon'));
  ok(tieneBuzon, 'buzón creado');

  // ---------- 2. Menos consultas: al abrir, una sola para nube + buzón, y nada de consultas cada minuto ----------
  let t0 = Date.now();
  await a.reload({ waitUntil: 'networkidle' }); await espera(3000);
  let ll = await llamadas(a, t0);
  const cuenta = (r, m = 'GET') => ll.filter((x) => x.ruta === r && x.metodo === m).length;
  ok(cuenta('/api/config') === 1, 'al abrir: configuración una sola vez (' + cuenta('/api/config') + ')');
  ok(cuenta('/api/estado') === 1, 'al abrir: una consulta de novedades (' + cuenta('/api/estado') + ')');
  ok(cuenta('/api/bandeja') === 0 && cuenta('/api/datos') === 0 && cuenta('/api/cuenta') === 0, 'al abrir: sin consultas separadas de buzón, nube y cuenta');
  ok(ll.length <= 3, 'al abrir: ' + ll.length + ' llamadas en total (' + ll.map((x) => x.metodo + ' ' + x.ruta).join(', ') + ')');
  t0 = Date.now(); await espera(8000);
  ll = await llamadas(a, t0);
  ok(ll.length === 0, 'en reposo con la app abierta: sin consultas repetidas (' + ll.length + ')');
  // Cambios rápidos de ventana no gastan consultas; salir y volver sí revisa.
  t0 = Date.now();
  for (let i = 0; i < 4; i++) await a.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
  await espera(600); ll = await llamadas(a, t0);
  ok(ll.filter((x) => x.ruta === '/api/estado').length <= 1, 'cambios rápidos de ventana: máximo una consulta');

  // ---------- 3. Copiar ahora mientras ya se está subiendo: no muestra un error falso ----------
  await escribirTitulo(a, 'Plata de Ana 2'); await espera(2700);   // arranca la subida automática
  await a.click('#btn-cuenta'); await espera(300);
  await a.click('#perfil-copiar'); await espera(2500);
  const msg = await a.textContent('#perfil-msg');
  ok(/al día/.test(msg), 'Copiar ahora durante otra subida: "' + msg + '"');
  await a.click('#dlg-perfil [data-close]');
  // Un cambio hecho mientras sube queda pendiente y luego se sube.
  const v0 = await a.evaluate(() => JSON.parse(localStorage.getItem('fintelligente-cuenta')).version);
  await escribirTitulo(a, 'Plata de Ana 3'); await espera(2600);
  await escribirTitulo(a, 'Plata de Ana 4'); await espera(4500);
  const fin = await a.evaluate(() => JSON.parse(localStorage.getItem('fintelligente-cuenta')));
  const tok = fin.token;
  const nube = await (await a.request.get(BASE + '/api/datos', { headers: { Authorization: 'Bearer ' + tok } })).json();
  ok(!fin.sucio && fin.version > v0 && nube.contenido.includes('Plata de Ana 4'), 'el último cambio llegó a la nube (v' + v0 + ' → v' + fin.version + ')');

  // ---------- 4. Dispositivo nuevo con datos de ejemplo: trae los de la cuenta sin preguntar ----------
  const Bx = await ctx(b, devices['Desktop Chrome']); const p2 = await Bx.newPage(); p2.on('pageerror', e => errs.push('B ' + e.message));
  await p2.goto(BASE, { waitUntil: 'networkidle' }); await espera(500);
  await entrarConCorreo(p2, 'ana@correo.com');
  ok(!(await p2.isVisible('#cta-elegir')), 'no pregunta qué datos usar si este equipo no tiene datos propios');
  ok((await p2.inputValue('#f-titulo')) === 'Plata de Ana 4', 'trae los datos de la cuenta');
  await Bx.close();

  // ---------- 5. Cupo diario de correos: al llegar al tope se pide entrar con Google ----------
  const enviados = (await (await a.request.get(BASE + '/__correos')).json()).length;
  await a.request.get(BASE + '/__cupo?tope=' + enviados);
  const Cx = await ctx(b, devices['iPhone 14']); const c = await Cx.newPage(); c.on('pageerror', e => errs.push('C ' + e.message));
  await c.goto(BASE, { waitUntil: 'networkidle' }); await espera(500);
  await c.click('#bienv-correo'); await c.fill('#cta-correo', 'nuevo@correo.com'); await c.click('#cta-enviar'); await espera(600);
  ok(/Google/.test(await c.textContent('#cta-msg')), 'sin cupo de correos: pide entrar con Google ("' + (await c.textContent('#cta-msg')) + '")');
  ok(await c.evaluate(() => document.getElementById('cta-google').classList.contains('resaltar')), 'resalta el botón de Google');
  ok(!(await c.isVisible('#cta-codigo')), 'no pasa al paso del código');
  await a.request.get(BASE + '/__cupo?tope=');
  await Cx.close();

  // ---------- 6. Google por redirección (iPhone con la app en la pantalla de inicio) ----------
  const Dx = await ctx(b, devices['iPhone 14']); const d = await Dx.newPage(); d.on('pageerror', e => errs.push('D ' + e.message));
  await d.goto(BASE + '/?google=redireccion', { waitUntil: 'networkidle' }); await espera(700);
  const init = await d.evaluate(() => window.__ginit && { modo: window.__ginit.ux_mode, uri: window.__ginit.login_uri });
  ok(init && init.modo === 'redirect' && /\/api\/cuenta\/google-redirect$/.test(init.uri), 'en modo redirección, Google vuelve a /api/cuenta/google-redirect');
  // Simula lo que hace Google: deja la marca CSRF en una cookie y envía el formulario.
  const cred = (await (await d.request.get(BASE + '/__google-token?email=redir@correo.com&nombre=Rita')).json()).credential;
  await d.evaluate((cr) => {
    document.cookie = 'g_csrf_token=marca123; path=/';
    const f = document.createElement('form'); f.method = 'POST'; f.action = '/api/cuenta/google-redirect';
    for (const [k, v] of [['credential', cr], ['g_csrf_token', 'marca123']]) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i); }
    document.body.appendChild(f); f.submit();
  }, cred);
  await d.waitForLoadState('networkidle'); await espera(2000);
  ok(!/entrar=/.test(d.url()), 'el código de entrada se quita de la dirección');
  const cd = await d.evaluate(() => JSON.parse(localStorage.getItem('fintelligente-cuenta') || 'null'));
  ok(cd && cd.usuario.correo === 'redir@correo.com' && /^fs_/.test(cd.token), 'entra con Google por redirección');
  // Marca CSRF que no coincide: vuelve con error y sin sesión
  await d.evaluate(() => localStorage.clear());
  await d.evaluate((cr) => {
    document.cookie = 'g_csrf_token=otra; path=/';
    const f = document.createElement('form'); f.method = 'POST'; f.action = '/api/cuenta/google-redirect';
    for (const [k, v] of [['credential', cr], ['g_csrf_token', 'marca123']]) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i); }
    document.body.appendChild(f); f.submit();
  }, cred);
  await d.waitForLoadState('networkidle'); await espera(1200);
  ok(/No pudimos confirmar/.test(await d.textContent('#cta-msg')) && !(await d.evaluate(() => localStorage.getItem('fintelligente-cuenta'))), 'marca CSRF distinta: no entra y lo explica');
  await Dx.close();

  console.log('errores de página:', errs);
  ok(!errs.length, 'sin errores de JavaScript');
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO BIEN (conectar cuentas)');
  await b.close();
})();
