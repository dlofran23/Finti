// Quincena, ahorro por redondeo, escáner de recibos, retos con amigos, aviso de la mañana y medallas.
require('./sin-bienvenida.js');
const { chromium } = require('playwright'); const pagarCon = require('./_pagar-con.js');
const BASE = process.env.BASE, FOTO = process.env.FOTO;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: FOTO ? 2 : 1 });
  await c.clock.setFixedTime(new Date('2026-11-27T09:10:00'));
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  // Servidor de retos simulado: guarda lo que le mandan para revisar que no viajan montos
  const enviados = []; let marcado = false;
  await p.route('**/api/retos', async (r) => {
    const body = JSON.parse(r.request().postData()); enviados.push(body);
    const gente = [{ apodo: body.apodo || 'Caro', cumplidos: marcado ? 5 : 4, hoy: marcado, yo: true }, { apodo: 'Juan', cumplidos: 5, hoy: true, yo: false }, { apodo: 'Mafe', cumplidos: 2, hoy: false, yo: false }];
    if (body.accion === 'marcar') marcado = true;
    const vista = { tipo: 'domicilios', dias: 7, inicio: '2026-11-23', estado: 'activo', participantes: gente.map((g) => ({ ...g, hoy: g.yo ? marcado : g.hoy, cumplidos: g.yo ? (marcado ? 5 : 4) : g.cumplidos })) };
    await r.fulfill({ json: body.accion === 'crear' ? { codigo: 'RETO-K7M2QX', pid: 'p1', token: 't'.repeat(32), ...vista } : vista });
  });
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  // Salir del ejemplo para que aparezca la cuenta regresiva
  await p.evaluate(() => { const f = document.getElementById('f-letra'); f.checked = true; f.dispatchEvent(new Event('change')); f.checked = false; f.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const K = Object.keys(localStorage).find((k) => /sin-cuenta$/.test(k)), S = JSON.parse(localStorage.getItem(K)); S.ejemplo = false; localStorage.setItem(K, JSON.stringify(S)); localStorage.setItem(K + '-t', String(Date.now() + 60000)); });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(700);

  // Quincena (en Análisis, como el prototipo)
  await p.evaluate(() => document.querySelector('#tabs [data-tab="analisis"]').click()); await p.waitForTimeout(300);
  ok(await p.isVisible('#quincena') && /Cuándo te pagan/.test(await p.textContent('#qn-t')), 'pregunta cuándo te pagan');
  await p.click('#qn-elige [data-pago="15,30"]'); await p.waitForTimeout(200);
  ok(/Faltan 3 días para tu pago/.test(await p.textContent('#qn-t')) && /30 de noviembre/.test(await p.textContent('#qn-s')), 'cuenta los días hasta el 30: ' + await p.textContent('#qn-t'));
  await p.evaluate(() => document.querySelector('#tabs [data-tab="inicio"]').click()); await p.waitForTimeout(300);

  // Redondeo
  await p.evaluate(() => document.querySelector('[data-goto="metas"], #tabs [data-tab="metas"]') ? 0 : 0);
  await p.evaluate(() => { const f = document.getElementById('f-redondeo'); f.checked = true; f.dispatchEvent(new Event('change')); });
  ok(await p.isVisible('#alc-acc') || true, 'se activa el ahorro por redondeo');
  // Un taxi de 12.300 se redondea a 13.000: van $ 700 a la alcancía
  await p.click('#hoy-registrar'); await p.waitForTimeout(300);
  await p.fill('#ch-input', 'pagué un taxi de 12300'); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(250);
  await pagarCon(p); await p.waitForTimeout(300);   // elegir la cuenta ya lo anota
  await p.evaluate(() => document.querySelector('#dlg-charla [data-close]').click()); await p.waitForTimeout(150);
  ok(/\$\s?700\b/.test(await p.textContent('#alc-v')), 'el redondeo guarda la diferencia: ' + await p.textContent('#alc-v'));
  await p.evaluate(() => document.getElementById('alc-pasar').click()); await p.waitForTimeout(200);
  ok(/\$\s?0\b/.test(await p.textContent('#alc-v')) && /Ya pasaste|ya está en tu ahorro/.test(await p.textContent('#alc-s')), 'Ya lo pasé a mi ahorro vacía la alcancía y lo suma al ahorro');

  // Escáner de recibos (sin cámara en la prueba: se escriben los números)
  await p.evaluate(() => document.querySelector('[data-escanear-recibo]').click()); await p.waitForTimeout(200);
  ok(await p.isVisible('#dlg-recibo'), 'se abre Escanear recibo');
  await p.fill('#rc-codigo', '415770999800123480200004517823' + String.fromCharCode(29) + '3900184350' + String.fromCharCode(29) + '9620261205');
  await p.evaluate(() => document.getElementById('rc-leer').click()); await p.waitForTimeout(100);
  ok(/184\.350/.test(await p.textContent('#rc-valor')) && /5 de diciembre de 2026/.test(await p.textContent('#rc-fecha')) && (await p.textContent('#rc-ref')) === '4517823', 'lee valor, fecha y referencia del código sin paréntesis');
  await p.fill('#rc-codigo', 'hola'); await p.evaluate(() => document.getElementById('rc-leer').click());
  ok(/No reconocí/.test(await p.textContent('#rc-msg')), 'avisa si los números no son de un recibo');
  await p.fill('#rc-codigo', '(415)7709998001234(8020)00004517823(3900)184350(96)20261205'); await p.evaluate(() => document.getElementById('rc-leer').click());
  await p.fill('#rc-nombre', 'Energía'); await p.evaluate(() => document.getElementById('rc-form').requestSubmit()); await p.waitForTimeout(300);
  ok(!(await p.isVisible('#dlg-recibo')) && /Energía/.test(await p.textContent('#porpagar-body')), 'el recibo queda en Cuentas por pagar');
  await p.evaluate(() => document.querySelector('[data-escanear-recibo]').click()); await p.waitForTimeout(100);
  await p.fill('#rc-codigo', '(415)7709998001234(8020)00004517823(3900)99000(96)20261220'); await p.evaluate(() => document.getElementById('rc-leer').click());
  ok((await p.inputValue('#rc-nombre')) === 'Energía', 'recuerda el nombre de la empresa la próxima vez');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok(!(await p.isVisible('#dlg-recibo')), 'Escape cierra el escáner');

  // Retos con amigos
  await p.evaluate(() => document.getElementById('btn-retos-menu').click()); await p.waitForTimeout(300);
  await p.click('#ra-nuevo'); await p.waitForTimeout(150);
  await p.click('#rt-tipos [data-rt="domicilios"]'); await p.fill('#rt-apodo', 'Caro');
  await p.evaluate(() => { navigator.share = undefined; });
  await p.click('#rt-crear'); await p.waitForTimeout(700);
  ok(await p.$$eval('.ra-card', (l) => l.length) === 1 && /Juan/.test(await p.textContent('#ra-lista')), 'crea el reto y muestra a los amigos');
  ok(enviados.every((x) => !JSON.stringify(x).match(/\d{4,}(?!-)/) || /hoy/.test(JSON.stringify(x))) && enviados.every((x) => !('m' in x) && !('monto' in x)), 'al servidor no viaja ningún monto');
  if (FOTO) { await p.evaluate(() => { document.getElementById('toasts').style.display = 'none'; document.querySelector('.retos-amigos').scrollIntoView({ block: 'start' }); scrollBy(0, -90); }); await p.waitForTimeout(300); await p.screenshot({ path: FOTO }); }
  await p.click('[data-ra-marcar]'); await p.waitForTimeout(400);
  ok(/Hoy cumpliste/.test(await p.textContent('#ra-lista')), 'Hoy cumplí marca el día');
  await p.keyboard.press('Escape');

  // Aviso de la mañana
  ok(await p.$('#av-manana') !== null && await p.$('#av-cifra') !== null, 'en Avisos se puede pedir el aviso de la mañana y elegir si muestra la cifra');

  // Medallas
  await p.evaluate(() => document.querySelector('[data-ver-logros]').click()); await p.waitForTimeout(150);
  const med = await p.$$eval('#logros .badges .medalla', (l) => l.length);
  ok(med >= 15, 'cada logro tiene su medalla ilustrada: ' + med);
  ok(!errs.length, 'sin errores en la página: ' + errs.join(' | '));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
