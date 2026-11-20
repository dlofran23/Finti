// Atajos para deudas con amigos: botones en Te deben, enlaces #accion=preste / #accion=mepagaron (ícono de la app
// en Android y en la web instalada) y lo que llega del atajo del iPhone ("le presté..." queda por anotar en Te deben).
require('./sin-bienvenida.js');
const { chromium } = require('playwright'); const pagarCon = require('./_pagar-con.js');
const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  const ultimo = () => p.evaluate(() => { const m = document.querySelectorAll('#ch-log .pr-msg.app'); return m.length ? m[m.length - 1].textContent : ''; });
  const say = async (t) => { await p.fill('#ch-input', t); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(260); };

  // ---------- Te deben vacío: igual muestra los atajos ----------
  await p.evaluate(() => { location.hash = '#cuentas'; }); await p.waitForTimeout(400);
  ok(await p.isVisible('#td-preste') && await p.isDisabled('#td-pagaron'), 'Te deben vacío: Le presté está listo y Me pagaron espera a que alguien deba');
  ok(/Nadie te debe/.test(await p.textContent('#tedeben-lista')), 'dice que nadie te debe');

  // ---------- Le presté a alguien ----------
  await p.click('#td-preste'); await p.waitForTimeout(300);
  ok(await p.isVisible('#dlg-deuda') && /Le presté/.test(await p.textContent('#dd-t')), 'abre el formulario Le presté');
  await p.fill('#dd-quien', 'Pedro'); await p.click('#dd-ok'); await p.waitForTimeout(150);
  ok(/cuánto/i.test(await p.textContent('#dd-msg')), 'pide el monto si falta');
  await p.fill('#dd-monto', '50000'); await p.click('#dd-ok'); await p.waitForTimeout(700);
  ok(await p.isVisible('#dlg-charla'), 'pasa a Cuéntame');
  const dicho = await p.evaluate(() => { const m = document.querySelectorAll('#ch-log .pr-msg.yo, #ch-log .pr-msg.user'); return m.length ? m[m.length - 1].textContent : ''; });
  ok(/le presté \$\s?50\.000 a Pedro/.test(dicho), 'arma la frase con el monto bien escrito: ' + dicho);
  await pagarCon(p); await say('sí');
  await p.click('#dlg-charla [data-close]'); await p.waitForTimeout(300);
  ok(/Pedro/.test(await p.textContent('#tedeben-lista')) && /50\.000/.test(await p.textContent('#tedeben-lista')), 'Pedro queda en Te deben');
  ok(!(await p.isDisabled('#td-pagaron')), 'ahora Me pagaron está disponible');

  // ---------- Me pagaron ----------
  await p.click('#td-pagaron'); await p.waitForTimeout(300);
  ok(/Me pagaron/.test(await p.textContent('#dd-t')) && await p.$('#dd-chips [data-n="Pedro"]'), 'Me pagaron sugiere a quienes te deben');
  await p.click('#dd-chips [data-n="Pedro"]'); await p.click('#dd-ok'); await p.waitForTimeout(800);
  ok(/Pedro te pagó/.test(await ultimo()), 'Cuéntame anota el pago: ' + (await ultimo()).slice(0, 80));
  await p.click('#dlg-charla [data-close]'); await p.waitForTimeout(300);
  ok(!/Pedro/.test(await p.textContent('#tedeben-lista')), 'Pedro sale de Te deben');

  // ---------- Enlaces del ícono (Android y web instalada) ----------
  await p.goto(BASE + '/#accion=preste', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  ok(await p.isVisible('#dlg-deuda') && /Le presté/.test(await p.textContent('#dd-t')), '#accion=preste abre Le presté');
  await p.click('#dlg-deuda [data-close]'); await p.waitForTimeout(300);
  ok(await p.isHidden('#dlg-deuda'), 'la X cierra el formulario');

  // ---------- Lo que llega del atajo del iPhone ----------
  await p.evaluate(() => localStorage.setItem('fintelligente-dichos', JSON.stringify([{ id: 'y1', t: 'le presté 20 mil a Caro' }])));
  await p.goto(BASE + '/#cuentas', { waitUntil: 'networkidle' }); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  ok(/Llegó del atajo/.test(await p.textContent('#tedeben-dichos')) && /Caro/.test(await p.textContent('#tedeben-dichos')), 'un préstamo que llegó del atajo queda por anotar en Te deben');
  await p.click('#tedeben-dichos [data-dicho="y1"]'); await p.waitForTimeout(700);
  ok(await p.isVisible('#dlg-charla') && /Caro/.test(await ultimo()), 'Anotar lo pasa a Cuéntame');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('fintelligente-dichos') || '[]').length) === 0, 'y ya no queda pendiente');

  // ---------- Botón Finti de la barra de notificaciones: lo dicho va a Cuéntame o a Pregúntale ----------
  const b64 = (t) => Buffer.from(t, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await p.goto('about:blank'); await p.goto(BASE + '/#accion=charla&dicho=' + b64('¿cuánto puedo gastar hoy?'), { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  ok(await p.isVisible('#dlg-preguntas') && !(await p.isVisible('#dlg-charla')), 'una pregunta dicha al botón abre Pregúntale');
  await p.goto('about:blank'); await p.goto(BASE + '/#accion=charla&dicho=' + b64('le presté 20 mil a Caro'), { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  ok(await p.isVisible('#dlg-charla') && /Caro/.test(await ultimo()), 'un préstamo dicho al botón va a Cuéntame');
  await p.goto('about:blank'); await p.goto(BASE + '/#accion=charla&dicho=' + b64('¿quién me debe plata?'), { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  ok(await p.isVisible('#dlg-preguntas'), 'preguntar quién te debe va a Pregúntale');

  // ---------- Atajos declarados ----------
  const man = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/manifest.webmanifest'), 'utf8'));
  ok((man.shortcuts || []).some((s) => s.url === '/#accion=preste') && man.shortcuts.some((s) => s.url === '/#accion=mepagaron'), 'el manifiesto web tiene los atajos Le presté y Me pagaron');
  const acc = fs.readFileSync(path.join(__dirname, '../../android/app/src/main/res/xml/accesos.xml'), 'utf8');
  ok(/fintelligente:\/\/deuda\/preste/.test(acc) && /fintelligente:\/\/deuda\/mepagaron/.test(acc), 'Android tiene los atajos en el ícono');

  ok(!errs.length, 'sin errores de página' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
