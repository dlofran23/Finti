// Etapa 3 de Finti: registro rápido (escribirlo, teclado grande en celular, burbujas de color) y sonidos con vibración.
require('./sin-bienvenida.js');
const { chromium } = require('playwright'); const pagarCon = require('./_pagar-con.js');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  // La vibración se anota para comprobar qué "sonó" (el audio no se puede oír en la prueba)
  await c.addInitScript(() => { window.__vib = []; try { Object.defineProperty(navigator, 'vibrate', { value: (p) => { window.__vib.push(JSON.stringify(p)); return true; }, configurable: true }); } catch (e) {} });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  const vib = () => p.evaluate(() => window.__vib.slice());
  const limpiar = () => p.evaluate(() => { window.__vib = []; });

  // ---------- Registro rápido en celular ----------
  await p.click((await p.isVisible('#btn-registrar-top')) ? '#btn-registrar-top' : '#barra-registrar'); await p.waitForTimeout(300);
  ok(await p.isVisible('#add-teclado'), 'en celular aparece el teclado grande');
  ok(await p.getAttribute('#add-monto', 'inputmode') === 'none', 'y no se abre el teclado del sistema');
  for (const k of ['1', '2', '000']) await p.click('#add-teclado [data-k="' + k + '"]');
  ok(await p.inputValue('#add-monto') === '12.000', 'el teclado marca el monto: ' + await p.inputValue('#add-monto'));
  await p.click('#add-teclado [data-k="borrar"]');
  ok(await p.inputValue('#add-monto') === '1.200', 'borrar quita el último número');
  const burbujas = await p.$$eval('#add-items .pick.burbuja', (l) => l.filter((x) => x.style.getPropertyValue('--c')).length);
  ok(burbujas >= 5, 'cada concepto es una burbuja con el color de su categoría (' + burbujas + ')');

  // Escribirlo
  const hoy = new Date(), ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  await p.fill('#add-texto', 'ayer 18 mil en almuerzo con Nequi'); await p.waitForTimeout(450);
  const ent = await p.textContent('#add-entendi');
  ok(/18\.000/.test(ent) && /Nequi/.test(ent) && /ayer/.test(ent), 'muestra lo que entendió: ' + ent);
  ok(await p.inputValue('#add-monto') === '18.000', 'pone el monto');
  ok(await p.$eval('#add-items [aria-checked="true"]', (x) => x.style.getPropertyValue('--c').trim()) !== '', 'elige el concepto');
  ok(/Nequi/.test(await p.textContent('#add-cuentas [aria-pressed="true"]')), 'elige la cuenta Nequi');
  await limpiar();
  await p.click('#add-save'); await p.waitForTimeout(500);
  const mov = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta')); return s.movs[s.movs.length - 1]; });
  ok(mov && mov.m === 18000 && mov.f === iso(ayer), 'queda anotado con la fecha de ayer: ' + JSON.stringify(mov));
  ok((await vib()).includes('[10]'), 'suena la gota (vibración corta): ' + (await vib()).join(' '));

  // Compartido desde el registro: lo pasa a la charla
  await p.click((await p.isVisible('#btn-registrar-top')) ? '#btn-registrar-top' : '#barra-registrar'); await p.waitForTimeout(250);
  await p.fill('#add-texto', 'cena 60 mil, la mitad es de Juan'); await p.waitForTimeout(450);
  ok(await p.isVisible('#add-a-charla'), 'si es compartido, ofrece anotarlo en la charla');
  await p.click('#add-a-charla'); await p.waitForTimeout(500);
  ok(/¿Con qué (lo )?pagaste/.test(await p.textContent('#ch-log')), 'la charla pregunta con qué pagaste (no supone efectivo)'); await pagarCon(p);
  ok(await p.isVisible('#dlg-charla') && /Juan te debe/.test(await p.textContent('#ch-log')), 'la charla lo recibe con lo que debe Juan');
  await p.click('#dlg-charla [data-close]'); await p.waitForTimeout(200);

  // ---------- Más sonidos ----------
  await limpiar();
  await p.click((await p.isVisible('#btn-registrar-top')) ? '#btn-registrar-top' : '#barra-registrar'); await p.waitForTimeout(250);
  await p.fill('#add-texto', 'me pagaron 50 mil'); await p.waitForTimeout(450);
  await p.click('#add-save'); await p.waitForTimeout(400);
  ok((await vib()).includes('[8,40,8]'), 'cuando entra plata suenan monedas');
  await limpiar();
  await p.evaluate(() => { location.hash = 'inicio'; }); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#donut-modo [data-dm="mes"]').click()); await p.waitForTimeout(200);   // con gastos de esta semana, la dona abre en la semana
  await p.click('#donut-legend button[data-id="vivienda"]'); await p.waitForTimeout(200);
  ok((await vib()).includes('[5]'), 'tocar una categoría del anillo da su nota');
  await p.click('#dlg-cat [data-close]'); await p.waitForTimeout(150);
  // Pasarse: gota y luego el acorde de calma
  await limpiar();
  await p.click((await p.isVisible('#btn-registrar-top')) ? '#btn-registrar-top' : '#barra-registrar'); await p.waitForTimeout(250);
  await p.fill('#add-texto', '900 mil en restaurante'); await p.waitForTimeout(450);
  await p.click('#add-save'); await p.waitForTimeout(800);
  ok((await vib()).includes('[35]'), 'al pasarse de la categoría suena la calma, no una alarma: ' + (await vib()).join(' '));

  // ---------- Se pueden apagar ----------
  await p.evaluate(() => document.getElementById('btn-colores').click()); await p.waitForTimeout(250);
  ok(await p.isChecked('#f-sonidos'), 'los sonidos vienen encendidos');
  await p.click('#dlg-colores label[for="f-sonidos"]'); await p.waitForTimeout(150);
  ok(!(await p.isChecked('#f-sonidos')), 'se apagan en Colores y modo');
  await p.click('#dlg-colores [data-close]'); await limpiar();
  await p.click((await p.isVisible('#btn-registrar-top')) ? '#btn-registrar-top' : '#barra-registrar'); await p.waitForTimeout(250);
  await p.fill('#add-texto', 'tinto 2 mil'); await p.waitForTimeout(450);
  await p.click('#add-save'); await p.waitForTimeout(400);
  ok(!(await vib()).length, 'apagados: no suena ni vibra');

  ok(!errs.length, 'sin errores en la página: ' + errs.join(' | '));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
