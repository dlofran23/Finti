// Mudanza a una dirección nueva: localhost y 127.0.0.1 son dos "direcciones" distintas para el navegador
// (cada una con sus propios datos), servidas por el mismo servidor, como pasará con el dominio propio.
const { chromium, devices } = require('playwright');
const escribirTitulo = require('./titulo.js');
const BASE = process.env.BASE, NUEVA = BASE.replace('localhost', '127.0.0.1');
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const espera = (ms) => new Promise(r => setTimeout(r, ms));
const FAKE_GIS = `window.google={accounts:{id:{initialize:function(){},renderButton:function(){}}}};`;
async function codigoDe(p, correo) { const l = await (await p.request.get(BASE + '/__correos')).json(); const m = l.filter(x => x.to === correo).pop(); return /(\d{6})/.exec(m.subject)[1]; }
const volver = async (pg) => {
  await pg.evaluate(() => { window.__vis = 'hidden'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis }); document.dispatchEvent(new Event('visibilitychange')); });
  await espera(3300);
  await pg.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
};

(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext(devices['Pixel 7']);
  await c.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }));
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));

  // ---------- En la dirección vieja: datos propios, cuenta y buzón ----------
  await p.goto(BASE, { waitUntil: 'networkidle' }); await espera(500);
  await p.click('#bienv-sin'); await p.click('#btn-zero'); await p.click('#btn-zero');
  await escribirTitulo(p, 'Plata que se muda'); await espera(300);
  await p.click('#nudge-cuenta-si'); await p.fill('#cta-correo', 'muda@correo.com'); await p.click('#cta-enviar'); await espera(400);
  await p.locator('#cta-code input').first().fill(await codigoDe(p, 'muda@correo.com')); await espera(2000);
  await p.keyboard.press('Escape');
  await p.click((await p.isVisible('#btn-menu')) ? '#btn-menu' : '#barra-mas'); await espera(300); await p.click('#lateral [data-clic="btn-fuentes-menu"]'); await espera(500);
  await p.evaluate(() => document.querySelectorAll('#fuentes-body details').forEach((d) => { d.open = true; }));
  await p.click('#btn-crear-buzon'); await espera(2500); await p.keyboard.press('Escape');
  const bzViejo = await p.evaluate(() => JSON.parse(localStorage.getItem('fintelligente-buzon')));
  ok(bzViejo && bzViejo.buzon, 'dirección vieja con cuenta y buzón');
  const codigoConexion = 'FT-' + bzViejo.buzon + '-' + bzViejo.clave;

  // ---------- Se configura la dirección nueva: la vieja lleva los datos sola ----------
  await p.request.get(BASE + '/__mudanza?a=' + encodeURIComponent(NUEVA));
  const posts = []; p.on('request', (r) => { if (r.url().endsWith('/api/mudanza') && r.method() === 'POST') posts.push(r.postData()); });
  await p.reload(); await p.waitForURL(NUEVA + '/**', { timeout: 15000 }); await p.waitForLoadState('networkidle'); await espera(1200);
  ok(p.url().startsWith(NUEVA), 'la dirección vieja abre la nueva (' + p.url().slice(0, 40) + ')');
  ok(posts.length === 1 && !posts[0].includes('Plata que se muda') && !posts[0].includes('muda@correo.com'), 'el servidor solo recibe el paquete cifrado (sin el título ni el correo)');
  ok(!/#mudanza/.test(p.url()), 'la llave se quita de la dirección apenas se lee');
  ok(await p.isVisible('#dlg-mudanza'), 'pregunta antes de usar los datos');
  const resumen = await p.textContent('#mudanza-resumen');
  ok(/muda@correo\.com/.test(resumen) && /Sigue conectado/.test(resumen), 'muestra la cuenta y el buzón que trae: ' + resumen.replace(/\s+/g, ' ').slice(0, 120));
  ok(!(await p.isVisible('#dlg-bienvenida')), 'no tapa con la pantalla de entrada');
  await p.click('#mudanza-si'); await p.waitForLoadState('networkidle'); await espera(1500);
  ok((await p.inputValue('#f-titulo')) === 'Plata que se muda', 'en la dirección nueva están los datos');
  const cta = await p.evaluate(() => JSON.parse(localStorage.getItem('fintelligente-cuenta') || 'null'));
  ok(cta && cta.usuario.correo === 'muda@correo.com', 'sigue con la sesión iniciada');
  ok(await p.isVisible('#btn-cuenta.on'), 'el botón de la cuenta muestra la sesión');
  const bzNuevo = await p.evaluate(() => JSON.parse(localStorage.getItem('fintelligente-buzon') || 'null'));
  ok(bzNuevo && bzNuevo.buzon === bzViejo.buzon, 'el buzón es el mismo (el atajo del iPhone no cambia)');

  // El atajo envía un movimiento con el MISMO código: la dirección nueva lo puede leer.
  const st = (await p.request.post(NUEVA + '/api/entrada', { data: { codigo: codigoConexion, texto: 'Compraste $7.300 en Panadería con tu tarjeta' } })).status();
  await volver(p); await espera(2500);
  const pend = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta')); return (s.pendientes || []).map((x) => x.comercio || x.concepto || x.texto || '').join('|'); });
  ok(st === 200 && /Panader/i.test(pend), 'un aviso nuevo llega a la dirección nueva (' + pend.slice(0, 60) + ')');

  // El paquete solo se puede usar una vez.
  ok((await (await p.request.get(NUEVA + '/__mudanzas')).json()).guardadas === 0, 'el paquete se borró del servidor al recogerlo');

  // Volver a la dirección vieja: lleva directo a la nueva, sin crear otro paquete.
  posts.length = 0;
  await p.goto(BASE + '/?app=android', { waitUntil: 'commit' }); await p.waitForURL(NUEVA + '/**', { timeout: 15000 }); await espera(800);
  ok(p.url().startsWith(NUEVA + '/?app=android') && posts.length === 0, 'la dirección vieja ya solo redirige (y conserva ?app=android)');

  // Un enlace de mudanza falso o vencido no cambia nada.
  await p.goto(NUEVA + '/#mudanza=AAAAAAAAAAAAAAAAAAAAAA.' + 'B'.repeat(43), { waitUntil: 'networkidle' }); await espera(800);
  ok(/ya se usó o no existe/.test(await p.textContent('#mudanza-msg')), 'enlace inexistente: lo explica');
  ok((await p.inputValue('#f-titulo')) === 'Plata que se muda', 'y los datos siguen intactos');
  await p.request.get(BASE + '/__mudanza?a=');

  console.log('errores de página:', errs);
  ok(!errs.length, 'sin errores de JavaScript');
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO BIEN (mudanza)');
  await b.close();
})();
