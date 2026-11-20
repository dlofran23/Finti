const CAPTURAS = require('path').join(__dirname, 'capturas'); require('fs').mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright');
const BASE = process.env.BASE;
const T = async (p, sel) => (await p.textContent(sel)).replace(/ /g, ' ');
const ok = (c, m) => { if (!c) { console.log('FALLA:', m); process.exitCode = 1; } else console.log('ok -', m); };
const post = (path, body, raw) => fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': raw ? 'text/plain' : 'application/json' }, body: raw ? body : JSON.stringify(body) }).then(r => r.json());
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.addInitScript(() => { const D = Date, fixed = new D(2026, 9, 27, 10, 0).getTime(); Date = class extends D { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } }; });
  await p.goto(BASE + '/#inicio'); await p.waitForTimeout(800);
  // Conectar bancos → crear buzón
  await p.click('#tabs [data-tab="cuentas"]'); await p.click('[data-open-fuentes]'); await p.waitForTimeout(200);
  await p.click('#btn-crear-buzon'); await p.waitForTimeout(2500);
  ok((await T(p, '#fuentes-msg')).includes('Listo'), 'buzón creado: ' + await T(p, '#fuentes-msg'));
  const bz = await p.evaluate(() => JSON.parse(localStorage.getItem('fintelligente-buzon')));
  ok((await T(p, '#fuentes-body')).includes(bz.buzon + '@entrada.fintelligente.co'), 'muestra la dirección privada');
  await p.click('[data-tab-f="iphone"]'); ok((await T(p, '#fuentes-body')).includes('/api/entrada'), 'pasos de iPhone con URL');
  await p.click('[data-tab-f="android"]'); ok((await T(p, '#fuentes-body')).includes('MacroDroid'), 'pasos de Android');
  // Llegan: correo de Bancolombia, factura de D1, verificación de Gmail y un atajo de Nequi
  const correo = ['From: Alertas <alertasynotificaciones@an.notificacionesbancolombia.com>', 'To: ' + bz.buzon + '@entrada.fintelligente.co', 'Subject: Alertas y Notificaciones', 'Content-Type: text/html; charset=utf-8', '',
    '<p>Bancolombia le informa Compra por $45.900,00 en EXITO LAURELES 12:05. 26/10/2026 T.Deb *1234.</p>'].join('\r\n');
  ok((await post('/__correo?buzon=' + bz.buzon, correo, true)).ok, 'correo del banco entregado al buzón');
  const verif = ['From: Gmail Team <forwarding-noreply@google.com>', 'To: ' + bz.buzon + '@entrada.fintelligente.co', 'Subject: (#987654321) Confirmación de reenvío de Gmail', 'Content-Type: text/plain; charset=utf-8', '', 'Código de confirmación: 987654321'].join('\r\n');
  await post('/__correo?buzon=' + bz.buzon, verif, true);
  ok((await post('/api/entrada', { buzon: bz.buzon, clave: bz.clave, texto: 'Enviaste $35.000 a CAMILA RODRIGUEZ', app: 'Nequi' })).ok, 'atajo de Nequi entregado');
  ok((await post('/api/entrada', { buzon: bz.buzon, clave: bz.clave, texto: 'Bancolombia le informa Pago de Tarjeta de Credito por $250.000 desde cta *4521. 27/10/2026' })).ok, 'pago de tarjeta entregado');
  await p.click('#btn-revisar-buzon'); await p.waitForTimeout(2500);
  ok((await T(p, '#fuentes-msg')).includes('Llegaron 4'), 'la app descifra lo que llegó: ' + await T(p, '#fuentes-msg'));
  await p.click('#dlg-fuentes [data-close]');
  await p.click('#tabs [data-tab="inicio"]'); await p.waitForTimeout(200);
  ok(await p.isVisible('#bandeja-banner') && (await T(p, '#bandeja-n')).includes('4'), 'banner: 4 por confirmar');
  await p.click('#bandeja-ver'); await p.waitForTimeout(300);
  const lista = await T(p, '#bandeja-lista');
  ok(lista.includes('987654321'), 'código de Gmail visible para copiar');
  ok(lista.includes('Exito Laureles') && lista.includes('Camila Rodriguez'), 'movimientos con comercio limpio');
  ok(lista.includes('Es el pago de Cuota tarjeta de crédito'), 'reconoce el pago de la cuenta por pagar');
  const exito = p.locator('.mov', { hasText: 'Exito Laureles' });
  ok(await exito.locator('[data-f="cat"]').inputValue() === 'alimentacion', 'categoría sugerida: Alimentación');
  ok((await exito.locator('[data-f="fila"] option:checked').textContent()) === 'Mercado', 'se sumará a «Mercado»');
  const antes = await p.evaluate(() => JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta')));
  const merc0 = Object.values(antes.meses)[0].gastos.find(r => r.concepto === 'Mercado').real, aho0 = antes.cuentas.find(c => c.id === 'a1').saldo;
  await exito.locator('[data-confirmar]').click(); await p.waitForTimeout(300);
  let st = await p.evaluate(() => JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta')));
  ok(Object.values(st.meses)[0].gastos.find(r => r.concepto === 'Mercado').real === merc0 + 45900, 'Mercado sube $45.900');
  ok(st.cuentas.find(c => c.id === 'a1').saldo === aho0 - 45900, 'la cuenta de ahorros baja $45.900');
  // Camila: cambiar a «Salidas y ocio» y confirmar; la regla se aprende
  const cam = p.locator('.mov', { hasText: 'Camila Rodriguez' });
  await cam.locator('[data-f="cat"]').selectOption('ocio'); await p.waitForTimeout(100);
  await p.locator('.mov', { hasText: 'Camila Rodriguez' }).locator('[data-confirmar]').click(); await p.waitForTimeout(300);
  st = await p.evaluate(() => JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta')));
  ok(st.reglas['camila rodriguez'] === 'ocio', 'aprendió que Camila Rodriguez va en Salidas y ocio');
  // Pago de tarjeta: marca la cuenta por pagar
  await p.locator('.mov', { hasText: 'Pago de tarjeta' }).locator('[data-confirmar]').click(); await p.waitForTimeout(300);
  st = await p.evaluate(() => JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta')));
  ok(Object.keys(st.porPagar.find(x => x.id === 'p4').pagos).length === 1, 'la cuota de la tarjeta quedó pagada');
  await p.locator('.mov.verif [data-descartar]').click(); await p.waitForTimeout(200);
  ok(st.pendientes.length === 1 && (await T(p, '#bandeja-lista')).includes('Todo al día'), 'bandeja vacía');
  // Pegar un aviso a mano
  await p.click('#pegar-box summary').catch(() => {});
  await p.fill('#pegar-texto', 'Pagaste $8.500 en TIENDA DON PEPE con Nequi.'); await p.click('#pegar-leer'); await p.waitForTimeout(200);
  ok((await T(p, '#pegar-msg')).includes('$ 8.500'), 'aviso pegado leído: ' + await T(p, '#pegar-msg'));
  await p.fill('#pegar-texto', 'Pagaste $8.500 en TIENDA DON PEPE con Nequi.'); await p.click('#pegar-leer'); await p.waitForTimeout(200);
  ok((await T(p, '#pegar-msg')).includes('ya estaba'), 'no duplica');
  await p.screenshot({ path: CAPTURAS + '/v6-bandeja-m.png' });
  // Enlace de atajo que abre la app (sin servidor)
  await p.goto(BASE + '/#importar=' + encodeURIComponent('Nu: Compraste $19.900 en Spotify con tu tarjeta.')); await p.waitForTimeout(1200);
  ok(await p.isVisible('#dlg-bandeja') && (await T(p, '#bandeja-lista')).includes('Spotify'), 'el enlace #importar abre la bandeja con Spotify');
  ok(errs.length === 0, 'sin errores de JavaScript ' + JSON.stringify(errs));
  ok(errs.length === 0, 'sin errores al final ' + JSON.stringify(errs));
  await b.close();
})();
