// Etapa 4 de Finti: calendario de pagos, bienvenida animada y colores propios por categoría.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 1200, height: 900 } });
  // Los pagos del ejemplo se crean el día en que se abre la app y solo cuentan desde ahí: el reloj se fija el 2 del mes
  // para que todos queden por delante, sin importar qué día corra la prueba.
  const real = new Date(); await c.clock.setFixedTime(new Date(real.getFullYear(), real.getMonth(), 2, 10, 0));
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#cuentas', { waitUntil: 'networkidle' }); await p.waitForTimeout(900);

  // ---------- Calendario de pagos ----------
  ok(await p.isVisible('#calpag'), 'Cuentas por pagar muestra el calendario del mes');
  const hoy = new Date(), mesTxt = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][hoy.getMonth()];
  ok(new RegExp(mesTxt, 'i').test(await p.textContent('#calpag-mes')), 'empieza en el mes actual');
  const dias = await p.$$eval('#calpag-grid .cp-dia.con', (l) => l.map((x) => ({ d: x.dataset.dia, pts: x.querySelectorAll('.cp-pts i').length, c: x.querySelector('.cp-pts i').style.getPropertyValue('--c') })));
  ok(dias.length >= 3 && dias.every((x) => x.pts >= 1 && x.c), 'los pagos del ejemplo tienen su punto de color: ' + dias.map((x) => x.d.slice(-2)).join(', '));
  ok(await p.$('#calpag-grid .cp-dia.hoy'), 'marca el día de hoy');
  ok(/Pagos del mes/.test(await p.textContent('#calpag-res')), 'resume los pagos del mes');
  await p.click('#calpag-grid .cp-dia.con >> nth=1'); await p.waitForTimeout(200);
  const filtrados = await p.$$eval('#porpagar-body .bill', (l) => l.length);
  ok(filtrados === 1 && /Pagos del/.test(await p.textContent('#porpagar-body')), 'tocar un día deja solo sus pagos (' + filtrados + ')');
  await p.click('#cp-todos'); await p.waitForTimeout(150);
  ok(await p.$$eval('#porpagar-body .bill', (l) => l.length) === 4, 'Ver todos vuelve a la lista completa');
  await p.click('#calpag-sig'); await p.waitForTimeout(150);
  ok(!new RegExp(mesTxt, 'i').test(await p.textContent('#calpag-mes')) && await p.$$eval('#calpag-grid .cp-dia.con', (l) => l.length) >= 3, 'el mes siguiente también muestra los pagos mensuales');
  await p.click('#calpag-ant');
  ok(!/Vivienda se pasaría/.test(await p.textContent('#calpag-aviso')), 'no cuenta dos veces un pago que ya se anotó como gasto');

  // ---------- Colores de tus categorías ----------
  await p.click('#btn-colores'); await p.waitForTimeout(250);
  ok(await p.$$eval('#catcol .catcol-fila', (l) => l.length) >= 12, 'lista las categorías con su color');
  ok(await p.isHidden('#catcol-aviso'), 'con los colores de la app no hay aviso de parecidos');
  await p.click('[data-catcol="alimentacion"]'); await p.waitForTimeout(150);
  ok(await p.$$eval('.catcol-muestras button', (l) => l.length) === 14, 'ofrece 14 colores');
  await p.click('.catcol-muestras [data-muestra="#ff9f1c"]'); await p.waitForTimeout(250);
  ok(await p.isVisible('#catcol-aviso') && /Alimentación/.test(await p.textContent('#catcol-aviso')), 'avisa si dos categorías quedan parecidas');
  await p.click('#dlg-colores [data-close]'); await p.evaluate(() => { location.hash = 'inicio'; }); await p.waitForTimeout(400);
  const col = await p.$eval('#donut-legend button[data-id="alimentacion"]', (x) => x.style.getPropertyValue('--c').trim());
  ok(col === '#ff9f1c', 'el color nuevo se usa en el anillo: ' + col);
  await p.click('#btn-colores'); await p.waitForTimeout(250);
  await p.click('#catcol-reset'); await p.waitForTimeout(200);
  ok(await p.isHidden('#catcol-aviso') && await p.$eval('[data-catcol="alimentacion"]', (x) => x.closest('.catcol-fila').style.getPropertyValue('--c').trim()) === '#ff7a59', 'se puede volver a los colores de la app');
  await p.click('#dlg-colores [data-close]');
  await c.close();

  // ---------- Bienvenida animada (inicio guiado) ----------
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c2.addInitScript(() => { localStorage.removeItem('fintelligente-inicio'); });
  const q = await c2.newPage(); q.on('pageerror', (e) => errs.push(e.message));
  await q.goto(BASE, { waitUntil: 'networkidle' }); await q.waitForTimeout(1800);
  ok(await q.isVisible('#dlg-inicio .ini-logo'), 'el inicio guiado saluda con el logo animado');
  ok(await q.$eval('#dlg-inicio .ini-logo-m', (x) => getComputedStyle(x).animationName) === 'iniMoneda', 'la moneda cae');
  await q.click('#inicio-empecemos'); await q.waitForTimeout(100);
  await q.fill('#inicio-ingreso', '3000000'); await q.click('#inicio-sig1'); await q.waitForTimeout(150);
  ok(await q.$eval('#dlg-inicio .inicio-sec[data-paso="2"]', (x) => x.classList.contains('va')), 'el paso siguiente entra deslizándose');
  await q.click('#inicio-atras'); await q.waitForTimeout(150);
  ok(await q.$eval('#dlg-inicio .inicio-sec[data-paso="1"]', (x) => x.classList.contains('vuelve')), 'al volver, se desliza hacia el otro lado');
  await q.click('#inicio-sig1'); await q.click('#inicio-sig-meta'); await q.click('#inicio-sig2'); await q.click('#inicio-armar'); await q.waitForTimeout(1600);
  const segs = await q.$$eval('#inicio-anillo .ia-seg', (l) => l.map((x) => parseFloat(x.getAttribute('stroke-dasharray'))));
  ok(segs.length === 3 && segs.every((x) => x > 0), 'el anillo de Así queda tu mes se dibuja: ' + segs.map((x) => x.toFixed(0)).join(', '));
  ok(/3\.000\.000/.test(await q.textContent('#inicio-total')), 'en el centro, lo que te entra');
  ok(/\$\s?\d/.test(await q.textContent('#inicio-hoy')), 'Hoy puedes gastar rueda hasta su cifra');
  await c2.close();

  ok(!errs.length, 'sin errores en la página: ' + errs.join(' | '));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
