// Pregúntale a Finti entiende las preguntas comunes del día a día (18 de noviembre de 2026):
// saldos de las cuentas, lo que le deben, el gasto más grande, el promedio diario, la quincena, lo de hoy y cómo va el mes.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
  await p.evaluate(() => document.getElementById('btn-preguntas-menu').click()); await p.waitForTimeout(400);
  ok((await p.$$('#pr-chips .pr-tarjeta .cat-ic.ficha')).length === 4, 'abre con cuatro sugerencias en tarjetas con su ficha');
  ok(await p.isVisible('.pr-head .pr-avatar') && /Nada sale de aquí/.test(await p.textContent('.pr-head')), 'la cabecera lleva la marca y la promesa de privacidad');
  const preg = async (q) => {
    await p.fill('#pr-input', q); await p.press('#pr-input', 'Enter'); await p.waitForTimeout(650);
    return p.evaluate(() => ({ t: [...document.querySelectorAll('#pr-log .pr-msg.app')].pop().textContent, no: !!document.querySelector('#pr-chips [data-no-entendi]') }));
  };
  let r = await preg('cuánta plata tengo'); ok(!r.no && /Entre tus cuentas tienes \$/.test(r.t) && /Nequi/.test(r.t), 'cuánta plata tengo: suma y lista las cuentas');
  r = await preg('cuál es mi saldo en nequi'); ok(/En Nequi tienes \$\s320\.000/.test(r.t), 'el saldo de una cuenta por su nombre');
  r = await preg('cuánto tengo en efectivo'); ok(/En Efectivo tienes \$/.test(r.t), 'el efectivo');
  r = await preg('cuanto me deben'); ok(!r.no && /Nadie te debe|Te deben/.test(r.t), 'lo que le deben');
  r = await preg('cuál fue mi gasto más grande'); ok(!r.no && /más grande|más se lleva/.test(r.t), 'el gasto más grande');
  r = await preg('cuánto gasto al día en promedio'); ok(!r.no && /En promedio gastas \$\s[\d.]+\sal día/.test(r.t), 'el promedio diario');
  r = await preg('cuánta plata me queda hasta la quincena'); ok(!r.no && /Hasta la próxima quincena/.test(r.t), 'hasta la quincena');
  r = await preg('cuánto puedo gastar hoy'); ok(/Hoy puedes gastar \$|Por hoy ya usaste|Te quedan \$/.test(r.t), 'lo de hoy, con la cifra del Inicio');
  r = await preg('voy bien este mes?'); ok(/^(Vas bien|Vas justo|Ojo|Empecemos)\./.test(r.t.trim()), 'cómo va el mes, igual que en Análisis');
  r = await preg('cuánto gano'); ok(/te han entrado/.test(r.t), 'cuánto gano: los ingresos');
  r = await preg('cuando vence la tarjeta'); ok(/1 pago pendiente/.test(r.t) && /tarjeta/i.test(r.t), 'un pago por su nombre, solo ese');
  ok(await p.isVisible('#pr-log .pr-fila .pr-avatar') && !(await p.$('#pr-log .pr-pensando')), 'Finti responde con su marca y los puntos de "pensando" se van');
  ok(errs.length === 0, 'sin errores: ' + errs.join(' | '));
  await b.close(); process.exit(fallas ? 1 : 0);
})();
