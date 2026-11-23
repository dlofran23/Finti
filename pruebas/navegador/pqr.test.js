// Ayuda y PQR dentro de la app (radicado, fecha y hora, consulta del estado y respuesta) y Premium sin venta en la
// app de Android (política de pagos de Google Play).
require('./sin-bienvenida.js');
const path = require('path');
const CAPTURAS = path.join(__dirname, 'capturas'); require('fs').mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const T = async (p, sel) => ((await p.textContent(sel)) || '').replace(/ /g, ' ');

(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);

  // Se abre desde el menú Más
  await p.click('#barra-mas'); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelectorAll('#lateral .lat-grupo').forEach((d) => { d.open = true; })); await p.click('#lat-pqr'); await p.waitForTimeout(400);
  ok(await p.isVisible('#dlg-pqr') && /15 días hábiles/.test(await T(p, '#dlg-pqr')), 'Ayuda y PQR se abre desde el menú y dice el plazo');

  // Validaciones en la app
  await p.click('#pqr-enviar'); await p.waitForTimeout(150);
  ok(/tipo/.test(await T(p, '#pqr-msg')), 'pide el tipo de solicitud');
  await p.selectOption('#pqr-tipo', 'reclamo');
  await p.fill('#pqr-nombre', 'Ana Pérez'); await p.fill('#pqr-correo', 'ana@correo.com'); await p.fill('#pqr-ref', 'FT-ABC123');
  await p.fill('#pqr-mensaje', 'Me cobraron dos veces Premium el 15 de noviembre.');
  await p.click('#pqr-enviar'); await p.waitForTimeout(150);
  ok(/autorización/.test(await T(p, '#pqr-msg')), 'sin la autorización de datos no se envía');
  await p.check('#pqr-acepto'); await p.click('#pqr-enviar'); await p.waitForTimeout(700);
  const rad = (await T(p, '#pqr-hecho-rad')).trim();
  ok(/^PQR-\d{8}-[A-Z0-9]{6}$/.test(rad), 'muestra el radicado: ' + rad);
  const fechas = await T(p, '#pqr-hecho-fechas');
  ok(/Recibida el \d{1,2} de \w+ de \d{4}, \d{1,2}:\d{2} [ap]\. m\./.test(fechas) && /a más tardar el/.test(fechas), 'muestra la fecha y la hora de recibo y la fecha límite');
  ok(/Te enviamos el radicado a ana@correo.com/.test(await T(p, '#pqr-hecho-correo')), 'avisa que el radicado llegó al correo');
  const correos = await (await p.request.get(BASE + '/__pqr-correos')).json();
  ok(correos.some((m) => m.to === 'ana@correo.com' && m.subject.includes(rad)), 'el servidor envió el correo de recibo');
  await p.screenshot({ path: path.join(CAPTURAS, 'pqr-radicado.png') });

  // Respuesta desde el panel y consulta del estado
  const r = await p.request.post(BASE + '/api/pqr/panel', { headers: { authorization: 'Bearer clave-de-prueba-del-panel', 'content-type': 'application/json' }, data: { radicado: rad, texto: 'Ya revisamos: te devolvimos el segundo cobro.' } });
  ok(r.status() === 200, 'el panel responde la solicitud');
  await p.click('#pqr-modo [data-pqr-modo="consultar"]'); await p.waitForTimeout(200);
  ok(await p.isVisible(`#pqr-mias [data-pqr-r="${rad}"]`) && !(await p.isVisible('#pqr-hecho')), 'la consulta recuerda las solicitudes de este dispositivo');
  await p.click(`#pqr-mias [data-pqr-r="${rad}"]`); await p.waitForTimeout(600);
  const est = await T(p, '#pqr-estado');
  ok(/Respondida/.test(est) && /segundo cobro/.test(est), 'el seguimiento muestra el estado y la respuesta');
  await p.fill('#pqr-c-correo', 'otra@correo.com'); await p.click('#pqr-c-ver'); await p.waitForTimeout(500);
  ok(/No encontramos/.test(await T(p, '#pqr-c-msg')), 'con otro correo no muestra nada');
  await p.screenshot({ path: path.join(CAPTURAS, 'pqr-consulta.png') });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  // Panel de los dueños: ven la PQR y la marcan en trámite
  await p.goto(BASE + '/panel'); await p.waitForTimeout(300);
  await p.fill('#clave', 'clave-de-prueba-del-panel'); await p.click('#f-clave button'); await p.waitForTimeout(900);
  ok(await p.isVisible(`.pqr-item[data-r="${rad}"]`) && /Ana Pérez/.test(await T(p, '#pqr-lista')) && /Respondida/.test(await T(p, `.pqr-item[data-r="${rad}"]`)), 'el panel lista la PQR con su estado');
  await p.click(`.pqr-item[data-r="${rad}"] [data-pqr="cerrar"]`); await p.waitForTimeout(600);
  ok(/Cerrada/.test(await T(p, '#pqr-msg')), 'el panel puede cerrar la PQR');

  // Enlace directo /#pqr (lo usan las páginas legales)
  await p.goto(BASE + '/#pqr'); await p.waitForTimeout(1200);
  ok(await p.isVisible('#dlg-pqr'), 'el enlace /#pqr abre el formulario');

  // Páginas legales: identificación y PQR
  await p.goto(BASE + '/legal/terminos.html'); await p.waitForTimeout(300);
  const ter = await T(p, 'body');
  ok(/radicado/.test(ter) && /Invita y gana/.test(ter) && /Códigos de regalo/.test(ter) && /notificación judicial/.test(ter), 'los términos explican las PQR, Invita y gana, los códigos y la dirección de notificación');
  await p.goto(BASE + '/legal/privacidad.html'); await p.waitForTimeout(300);
  ok(/Peticiones, quejas y reclamos \(PQR\)/.test(await T(p, 'body')) && /3 años desde la respuesta/.test(await T(p, 'body')), 'la política incluye las PQR y su conservación');

  // App de Android (Google Play): no se vende Premium con Wompi
  const a = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const q = await a.newPage();
  await q.goto(BASE + '/?app=android&lectura=1&v=10', { waitUntil: 'networkidle' }); await q.waitForTimeout(800);
  await q.evaluate(() => document.getElementById('btn-premium').click()); await q.waitForTimeout(500);
  ok(await q.isVisible('#dlg-premium') && !(await q.isVisible('#web-buy')) && !(await q.isVisible('#btn-pagar')), 'en la app de Android no aparece la compra con Wompi');
  ok(await q.isVisible('#tienda-nota') && await q.isVisible('#web-restore') && await q.isVisible('#web-regalo'), 'se puede activar una compra previa o un código de regalo');
  ok(!/\$\s?\d/.test(await T(q, '#prem-msg')), 'no muestra el precio dentro de la app de Android');
  await q.screenshot({ path: path.join(CAPTURAS, 'premium-android.png') });
  await a.close();
  // En el navegador sí se vende
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.evaluate(() => document.getElementById('btn-premium').click()); await p.waitForTimeout(500);
  ok(await p.isVisible('#web-buy') && !(await p.isVisible('#tienda-nota')), 'en el navegador la compra con Wompi sigue igual');

  ok(!errs.length, 'sin errores en la página: ' + errs.join(' | '));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
