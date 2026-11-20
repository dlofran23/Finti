const CAPTURAS = require('path').join(__dirname, 'capturas'); require('fs').mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright'); const fs = require('fs');
const BASE = process.env.BASE;
const T = async (p, sel) => (await p.textContent(sel)).replace(/\u00a0/g, ' ');
const ok = (c, m) => { if (!c) { console.log('FALLA:', m); process.exitCode = 1; } else console.log('ok -', m); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  // Hora fija: 27 oct 2026, 7:30 p. m. Push simulado (Chromium sin servicio de push real).
  await p.addInitScript(() => {
    const D = Date, fixed = new D(2026, 9, 27, 19, 30).getTime();
    Date = class extends D { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } };
    window.Notification = { permission: 'default', requestPermission: async () => 'granted' };
    if (window.PushManager) {
      PushManager.prototype.getSubscription = async () => null;
      PushManager.prototype.subscribe = async () => ({ toJSON() { return { endpoint: 'https://fcm.googleapis.com/fcm/send/prueba123456', keys: { p256dh: 'BKx'.repeat(20), auth: 'abcdefgh12345678' } }; }, unsubscribe: async () => true });
    }
  });
  await p.goto(BASE + '/#inicio'); await p.waitForTimeout(900);
  // Con datos de ejemplo se ve un solo aviso: el de armar el presupuesto; el recordatorio del día espera su turno.
  ok(await p.isVisible('#example-notice') && !(await p.isVisible('#nudge')), 'un solo aviso a la vez: primero el del ejemplo');
  ok((await p.textContent('#pagos-body')).includes('Vence mañana'), 'próximos pagos muestra la cuota de mañana');
  // Poner en cero para salir del ejemplo y probar como usuario real
  await p.click('#btn-zero'); await p.click('#btn-zero'); await p.waitForTimeout(200);
  await p.click('#tabs [data-tab="inicio"]'); await p.waitForTimeout(150);
  ok(await p.isVisible('#nudge'), 'el recordatorio de las 7:30 p. m. aparece');
  // Cuentas de dinero
  await p.click('#tabs [data-tab="cuentas"]');
  const nequi = p.locator('.acct[data-id="a2"] [data-f="saldo"]');
  await nequi.fill('500000'); await nequi.press('Tab'); await p.waitForTimeout(150);
  ok((await T(p, '#cuentas-body')).includes('$ 500.000'), 'saldo de Nequi editable');
  // Pagar el arriendo con monto propio desde Nequi
  const arr = p.locator('#porpagar-body .bill', { hasText: 'Arriendo' }).first();
  await arr.locator('[data-editar]').first().click();
  const monto = p.locator('#porpagar-body .bill', { hasText: 'Arriendo' }).locator('[data-f="monto"]'); await monto.fill('1100000'); await monto.press('Tab'); await p.waitForTimeout(150);
  await p.locator('#porpagar-body .bill', { hasText: 'Arriendo' }).locator('[data-pagar]').click(); await p.waitForTimeout(250);
  ok(await p.isVisible('#dlg-pagar'), 'abre la hoja de pago');
  await p.fill('#pagar-monto', '1000000');
  await p.locator('#pagar-cuentas [data-cuenta]', { hasText: 'Nequi' }).click();
  await p.click('#pagar-ok'); await p.waitForTimeout(300);
  ok((await p.textContent('#cuentas-body')).includes('-$ 500.000') || (await p.textContent('#cuentas-body')).includes('−$ 500.000') || (await p.textContent('#cuentas-body')).includes('$ -500.000') || (await p.evaluate(() => JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta')).cuentas.find(c => c.nombre === 'Nequi').saldo)) === -500000, 'Nequi baja 1.000.000');
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta')));
  const arrb = st.porPagar.find(x => x.nombre === 'Arriendo');
  ok(Object.keys(arrb.pagos).length === 1, 'el arriendo queda pagado: ' + JSON.stringify(arrb.pagos));
  const g = st.meses[Object.keys(st.meses)[0]].gastos.find(r => r.concepto === 'Arriendo');
  ok(g && g.real === 1000000, 'se sumó a los gastos del mes (' + (g && g.real) + ')');
  // Registro rápido desde una cuenta
  await p.click('#fab-add'); await p.fill('#add-monto', '12000');
  await p.locator('#add-items .pick', { hasText: 'Domicilios' }).click();
  await p.locator('#add-cuentas [data-cuenta]', { hasText: 'Efectivo' }).click();
  await p.click('#add-save'); await p.waitForTimeout(300);
  const st2 = await p.evaluate(() => JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta')));
  ok(st2.cuentas.find(c => c.nombre === 'Efectivo').saldo === -12000, 'efectivo descontado');
  ok(st2.registros.includes('2026-10-27'), 'el día queda registrado');
  await p.click('#tabs [data-tab="inicio"]'); await p.waitForTimeout(200);
  ok(await p.isHidden('#nudge'), 'el recordatorio desaparece tras registrar');
  ok((await p.textContent('#rachas')).includes('1'), 'la racha arranca');
  // Reto 52 semanas
  await p.click('#tabs [data-tab="metas"]'); await p.click('#reto-go'); await p.click('#reto-grid [data-sem="1"]'); await p.waitForTimeout(150);
  ok((await T(p, '#reto-body')).includes('Llevas $ 5.000'), 'reto de 52 semanas suma');
  // Avisos: .ics, push y correo bloqueado sin Premium
  await p.click('#btn-mas'); await p.click('#btn-avisos-menu'); await p.waitForTimeout(300);
  ok(await p.isVisible('#av-web') && await p.isHidden('#av-claude'), 'la ventana muestra los canales del sitio propio');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#av-ics')]);
  await dl.saveAs(require('path').join(CAPTURAS, 'pagos.ics')); const ics = fs.readFileSync(require('path').join(CAPTURAS, 'pagos.ics'), 'utf8');
  ok(ics.includes('RRULE:FREQ=MONTHLY;BYMONTHDAY=5') && ics.includes('TRIGGER:-P2DT16H') && ics.includes('BEGIN:VALARM'), '.ics con repetición mensual y alarmas');
  await p.waitForTimeout(500);
  await p.click('#av-push'); await p.waitForTimeout(1500);
  const msg = await p.textContent('#av-msg'); ok(msg.includes('Listo'), 'push activado: ' + msg);
  const srv = await (await fetch(BASE + '/__avisos')).json();
  ok(srv.perfiles.length === 1 && srv.perfiles[0].pagos.length === 4 && srv.perfiles[0].push, 'el servidor guarda el perfil con 4 pagos y la suscripción');
  ok(srv.salida.some(x => x.canal === 'push'), 'se envía la notificación de prueba');
  ok((await p.textContent('#av-mail')).includes('Premium'), 'el correo pide Premium');
  await p.click('#av-push'); await p.waitForTimeout(1200);
  const srv2 = await (await fetch(BASE + '/__avisos')).json();
  ok(srv2.perfiles.length === 0, 'al apagar se borra el perfil del servidor');
  await p.screenshot({ path: CAPTURAS + '/v5-avisos-m.png' });
  ok(errs.length === 0, 'sin errores de JavaScript ' + JSON.stringify(errs));
  await b.close();
})();
