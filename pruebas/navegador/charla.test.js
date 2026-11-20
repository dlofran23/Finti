// Inicio nuevo (saludo, Hoy puedes gastar, anillo con tarjetas) y Cuéntame un gasto: registro conversado, escrito o dicho.
require('./sin-bienvenida.js');
const { chromium } = require('playwright'); const pagarCon = require('./_pagar-con.js');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(900);

  // ---------- Inicio ----------
  const saludo = await p.textContent('#saludo-h');
  ok(/^(Buenos días|Buenas tardes|Buenas noches)\. /.test(saludo), 'saludo según la hora y el mes: ' + saludo);
  ok(await p.isVisible('#hoy-card') && /\$/.test(await p.textContent('#hoy-v')), 'tarjeta Hoy puedes gastar con su cifra: ' + await p.textContent('#hoy-v'));
  ok(/Faltan \d+ días|Último día/.test(await p.textContent('#hoy-dias')), 'dice cuántos días faltan');
  const tarjetas = await p.$$eval('#donut-legend button', (l) => l.map((x) => [x.dataset.id, x.style.getPropertyValue('--c'), !!x.querySelector('.ct-v')]));
  ok(tarjetas.length >= 3 && tarjetas.every((t) => t[1] && t[2]), 'cada categoría tiene su tarjeta de color con lo gastado (' + tarjetas.length + ')');
  ok(await p.$$eval('#donut .seg', (l) => l.some((x) => x.getAttribute('stroke-linecap') === 'round')), 'el anillo tiene puntas redondeadas');
  await p.click('#donut-legend button[data-id="alimentacion"]'); await p.waitForTimeout(150);
  if (await p.isVisible('#dlg-cat')) { await p.click('#dlg-cat [data-close]'); await p.waitForTimeout(150); }
  ok(await p.textContent('#donut-k') === 'Alimentación' && await p.$eval('#donut-legend', (x) => x.classList.contains('con-sel')), 'tocar una tarjeta resalta su categoría en el anillo');

  // ---------- Entender frases ----------
  const E = (t) => p.evaluate((t) => window.FinCharla.entender(t), t);
  let r;
  r = await E('18 mil en almuerzo'); ok(r.m === 18000 && r.cat === 'alimentacion' && r.c === 'Almuerzo' && r.t === 'g', '18 mil en almuerzo: ' + JSON.stringify(r));
  r = await E('pagué un taxi de doce mil'); ok(r.m === 12000 && r.cat === 'transporte' && r.c === 'Taxi', 'números en palabras (doce mil) y "un taxi": ' + JSON.stringify(r));
  r = await E('gasté cinco lucas en un tinto'); ok(r.m === 5000 && r.cat === 'alimentacion', 'cinco lucas en un tinto: ' + JSON.stringify(r));
  r = await E('veinticinco mil quinientos pesos en mercado'); ok(r.m === 25500, 'veinticinco mil quinientos: ' + r.m);
  r = await E('dos millones quinientos mil arriendo'); ok(r.m === 2500000 && r.cat === 'vivienda', 'dos millones quinientos mil: ' + r.m);
  r = await E('cuarenta y cinco mil en cine'); ok(r.m === 45000 && r.cat === 'ocio', 'cuarenta y cinco mil: ' + r.m);
  r = await E('$ 14.000 gaseosa y pan'); ok(r.m === 14000, '$ 14.000: ' + r.m);
  // Vocabulario ampliado (palabras y comercios de Colombia; gana la frase más larga)
  const vocab = [['8 mil en pandebono', 'alimentacion'], ['recarga tullave 20 mil', 'transporte'], ['recarga del celular 10 mil', 'servicios'],
    ['pipeta de gas 90 mil', 'servicios'], ['corte de pelo 20 mil', 'compras'], ['concentrado para el perro 60 mil', 'otros'], ['dolex 8 mil', 'salud'],
    ['matrícula del colegio 400 mil', 'educacion'], ['pagué el fiado de la tienda 30 mil', 'deudas'], ['unas polas 25 mil', 'ocio'], ['perro caliente 10 mil', 'ocio'],
    ['mensualidad del gimnasio 90 mil', 'suscripciones'], ['metí 100 mil al CDT', 'ahorro'], ['el plomero 50 mil', 'vivienda'], ['comparendo 600 mil', 'transporte'],
    ['D1 45 mil', 'alimentacion'], ['detergente y jabón 18 mil', 'alimentacion'], ['vacuna del gato 50 mil', 'otros']];
  const malas = [];
  for (const [t, cat] of vocab) { const x = await E(t); if (x.cat !== cat) malas.push(t + ' → ' + x.cat); }
  ok(!malas.length, 'reconoce la categoría en ' + vocab.length + ' frases de todos los días' + (malas.length ? ': ' + malas.join('; ') : ''));
  ok(await p.evaluate(() => window.FinCharla.palabras()) >= 500, 'el vocabulario tiene más de 500 palabras y comercios');
  r = await E('cine con mi novia 40 mil'); ok(r.c === 'Cine con mi novia', 'el concepto queda sin relleno pero con sus conectores: ' + r.c);
  r = await E('me pagaron 50 mil por un trabajo'); ok(r.t === 'i' && r.m === 50000, 'me pagaron: es un ingreso: ' + JSON.stringify(r));

  // ---------- La charla ----------
  const antes = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta') || 'null'); return s; });
  await p.click('#hoy-registrar'); await p.waitForTimeout(300);
  ok(await p.isVisible('#dlg-charla'), 'Cuéntame un gasto abre la charla');
  ok(/no salen de aquí/.test(await p.textContent('#dlg-charla')), 'dice que todo se entiende en el teléfono');
  await p.fill('#ch-input', 'pagué un taxi de doce mil'); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(250);
  ok(/¿Con qué lo pagaste/.test(await p.textContent('#ch-log')) && (await p.$$('#ch-chips [data-ch^="cuenta:"]')).length > 1, 'no supone efectivo: pregunta con qué pagaste y muestra tus cuentas');
  ok(await pagarCon(p, 'Efectivo'), 'se elige la cuenta con un toque');
  ok(/12\.000/.test(await p.textContent('#ch-log')) && /Transporte/.test(await p.textContent('#ch-log')) && await p.isVisible('[data-ch="si"]'), 'muestra lo que entendió y pide confirmar');
  ok(/Efectivo/.test(await p.textContent('#ch-log .ch-res')), 'anota la cuenta que elegiste');
  const efAntes = await p.evaluate(() => [...document.querySelectorAll('.acct')].length);
  await p.click('[data-ch="si"]'); await p.waitForTimeout(300);
  ok(/quedó anotado/.test(await p.textContent('#ch-log')), 'confirma que quedó anotado');
  const gastoTaxi = await p.evaluate(() => window.FinPreguntas && document.querySelector('#ch-log').textContent);
  ok(/Efectivo queda en/.test(gastoTaxi), 'dice cómo queda el efectivo');
  await p.click('[data-ch="deshacer"]'); await p.waitForTimeout(200);
  ok(/lo quité/.test(await p.textContent('#ch-log')), 'se puede deshacer');

  // Pide lo que falta: sin monto, luego sin categoría
  await p.fill('#ch-input', 'propina'); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(200);
  ok(/¿Cuánto fue/.test(await p.textContent('#ch-log')), 'sin monto, pregunta cuánto fue');
  await p.click('[data-ch="monto:5000"]'); await p.waitForTimeout(200); await pagarCon(p);
  ok(await p.isVisible('[data-ch="si"]'), 'con el monto, pide confirmar');
  await p.click('[data-ch="no"]'); await p.waitForTimeout(150);
  await p.fill('#ch-input', '30 mil'); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(200);
  ok(/¿En qué categoría/.test(await p.textContent('#ch-log')), 'sin categoría, la pregunta');
  await p.click('[data-ch="cat:ocio"]'); await p.waitForTimeout(150); await pagarCon(p);
  await p.fill('#ch-input', 'sí'); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(300);
  ok(/quedó anotado/.test(await p.textContent('#ch-log')), 'responder "sí" escrito también lo anota');
  // Aprende: si me toca preguntar la categoría, la recuerdo para esa palabra
  await p.click('[data-ch="otro"]'); await p.waitForTimeout(100);
  await p.fill('#ch-input', 'le di 20 mil a mi papá'); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(200);
  ok(/¿En qué categoría/.test(await p.textContent('#ch-log')), 'una palabra que no conoce: pregunta la categoría');
  await p.click('[data-ch="cat:otros"]'); await p.waitForTimeout(150); await pagarCon(p);
  await p.click('[data-ch="si"]'); await p.waitForTimeout(300);
  ok(/Aprendí algo/.test(await p.textContent('#ch-log')), 'dice que aprendió la palabra');
  r = await E('papá 30 mil'); ok(r.cat === 'otros' && r.por === 'aprendida', 'la próxima vez ya la sabe: ' + JSON.stringify(r));
  await p.click('#dlg-charla [data-close]');

  // ---------- Desde la app de Android: accion=charla con lo dicho ----------
  const dicho = Buffer.from('gasté veinte mil en mercado', 'utf8').toString('base64url');
  await p.goto(BASE + '/?app=android&lectura=0&v=9#accion=charla&dicho=' + dicho, { waitUntil: 'networkidle' }); await p.waitForTimeout(1300);
  ok(await p.isVisible('#dlg-charla') && /20\.000/.test(await p.textContent('#ch-log')) && /gasté veinte mil en mercado/.test(await p.textContent('#ch-log')), 'lo dicho en el teléfono llega a la charla y se entiende');
  ok(await p.isVisible('#ch-voz'), 'en la app 1.8 el micrófono usa el reconocimiento del teléfono');
  ok(!/dicho=/.test(await p.evaluate(() => location.hash)), 'lo dicho no queda en la dirección');

  // ---------- Fechas, cuentas, varios gastos, compartidos ----------
  if (await p.isVisible('#dlg-charla')) { await p.click('#dlg-charla [data-close]'); await p.waitForTimeout(200); }
  const hoyD = new Date(); const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const ayer = iso(new Date(hoyD.getFullYear(), hoyD.getMonth(), hoyD.getDate() - 1)), antier = iso(new Date(hoyD.getFullYear(), hoyD.getMonth(), hoyD.getDate() - 2));
  r = await E('ayer gasté 20 mil en mercado'); ok(r.f === ayer && r.m === 20000 && r.c === 'Mercado', 'entiende "ayer": ' + JSON.stringify(r));
  r = await E('antier taxi 12 mil'); ok(r.f === antier, 'entiende "antier"');
  r = await E('hace 3 días pandebono 5 mil'); ok(r.f === iso(new Date(hoyD.getFullYear(), hoyD.getMonth(), hoyD.getDate() - 3)), 'entiende "hace 3 días"');
  r = await E('pagué 10 mil el 1'); ok(/^\d{4}-\d{2}-01$/.test(r.f) && r.m === 10000, 'entiende "el 1" sin confundirlo con el monto: ' + JSON.stringify(r));
  const ids = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('presupuesto-web-sin-cuenta') || 'null'); return s ? s.cuentas.map((c) => c.tipo + ':' + c.id) : []; });
  const idDe = (t) => (ids.find((x) => x.startsWith(t + ':')) || '').split(':')[1];
  r = await E('almuerzo 18 mil con Nequi'); ok(r.cuenta && r.cuenta === idDe('nequi'), 'entiende "con Nequi": ' + r.cuenta);
  r = await E('pagué el mercado con la tarjeta 230 mil'); ok(r.cuenta === idDe('tarjeta'), 'entiende "con la tarjeta"');
  r = await E('pagué la cuota de la tarjeta 300 mil'); ok(!r.cuenta && r.cat === 'deudas', '"la cuota de la tarjeta" es una deuda, no la cuenta con que pagó');
  r = await E('pagué 60 mil del almuerzo, la mitad es de Juan'); ok(r.comp && r.comp.partes === 2 && r.comp.quien === 'Juan' && r.c === 'Almuerzo', 'gasto compartido a la mitad: ' + JSON.stringify(r.comp));
  r = await E('cena 90 mil entre tres con Ana y Luis'); ok(r.comp && r.comp.partes === 3 && r.comp.quien === 'Ana y Luis', 'entre tres con Ana y Luis');
  const todo = await p.evaluate(() => window.FinCharla.todo('almuerzo 18 mil y taxi 12 mil'));
  ok(todo.length === 2 && todo[0].m === 18000 && todo[1].m === 12000 && todo[1].cat === 'transporte', 'varios gastos en una frase');
  ok((await p.evaluate(() => window.FinCharla.todo('pan y leche 8 mil'))).length === 1, '"pan y leche 8 mil" es un solo gasto');
  ok((await p.evaluate(() => window.FinCharla.todo('treinta y cinco mil en mercado')))[0].m === 35000, '"treinta y cinco" no se parte');

  // ---------- Tirilla ----------
  const tir = await p.evaluate(() => window.FinCharla.tirilla('TIENDAS D1 SAS\nNIT 900.276.962-1\nFECHA: 02/01/2020\nARROZ 4.590\nSUBTOTAL 30.630\nIVA 0\nTOTAL A PAGAR 30.630\nEFECTIVO 50.000\nCAMBIO 19.370'));
  ok(tir.m === 30630 && /Tiendas D1/.test(tir.c), 'de la tirilla toma el total a pagar y el comercio: ' + JSON.stringify(tir));

  // ---------- Charla: varios, corrección, cuadre, compartido, me pagó, préstamo ----------
  const say = async (t) => { await p.fill('#ch-input', t); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(220); };
  const ultimo = () => p.evaluate(() => { const m = document.querySelectorAll('#ch-log .pr-msg.app'); return m[m.length - 1].textContent; });
  await p.click('#hoy-registrar'); await p.waitForTimeout(300);
  await say('almuerzo 18 mil y taxi 12 mil');
  ok(/¿Con qué pagaste todo esto/.test(await ultimo()) && /30\.000/.test(await ultimo()), 'con varios gastos, pregunta una sola vez con qué pagaste (y dice el total)'); await pagarCon(p);
  ok(/Anoto estos 2/.test(await ultimo()), 'confirma los dos gastos juntos');
  await say('no, el taxi eran 15 mil');
  ok(/15\.000/.test(await ultimo()) && /18\.000/.test(await ultimo()), 'corrige solo el taxi');
  await say('sí'); ok(/anoté los 2/.test(await ultimo()), 'anota los dos');
  await p.click('[data-ch="otro"]');
  await say('cuadrar billetera'); await say('tengo 10 mil');
  ok(/faltan/.test(await ultimo()) && await p.isVisible('[data-ch="cuadre-ajustar"]'), 'cuadre: dice cuánto falta y ofrece ajustar');
  await p.click('[data-ch="cuadre-ajustar"]'); await p.waitForTimeout(200);
  ok(/queda en \$\s?10\.000/.test(await ultimo()), 'ajusta el efectivo a lo que hay en la billetera');
  await p.click('[data-ch="cerrar"]'); await p.waitForTimeout(150);
  await p.click('#hoy-registrar'); await p.waitForTimeout(250);
  await say('pagué 60 mil del almuerzo, la mitad es de Juan'); await pagarCon(p); await say('dale');
  ok(/Te deben/.test(await ultimo()), 'el compartido queda en Te deben');
  ok(await p.isVisible('#tedeben-panel') || /Juan/.test(await p.textContent('#tedeben-lista')), 'el panel Te deben muestra a Juan');
  await say('Juan me pagó'); ok(/Juan te pagó \$\s?30\.000/.test(await ultimo()) && /paz y salvo/.test(await ultimo()), 'Juan me pagó: suma al efectivo y salda la deuda');
  await say('le presté 50 mil a Pedro'); ok(/préstamo/.test(await ultimo()) && /Pedro/.test(await ultimo()), 'entiende un préstamo');
  await pagarCon(p); await say('sí'); ok(/Pedro me pagó/.test(await ultimo()), 'el préstamo queda en Te deben');
  await p.click('[data-ch="deshacer"]'); await p.waitForTimeout(150);
  ok(!/Pedro/.test(await p.textContent('#tedeben-lista')), 'deshacer también quita lo que te deben');
  await p.click('#dlg-charla [data-close]');

  // ---------- Palabras que aprendí ----------
  await p.evaluate(() => document.getElementById('btn-aprendidas-menu').click()); await p.waitForTimeout(250);
  ok(await p.isVisible('#dlg-aprendidas') && await p.$('#ap-lista [data-k="papa"]'), 'la lista muestra lo que aprendió (papá)');
  await p.click('#ap-lista [data-k="papa"] [data-quitar]'); await p.waitForTimeout(150);
  ok(!(await p.$('#ap-lista [data-k="papa"]')) && (await E('papá 30 mil')).por !== 'aprendida', 'se puede olvidar una palabra');
  await p.click('#dlg-aprendidas [data-close]');

  // ---------- Foto de la tirilla, leída en el dispositivo ----------
  await p.click('#hoy-registrar'); await p.waitForTimeout(250);
  ok(await p.isVisible('#ch-cam'), 'la charla tiene el botón de foto');
  await p.setInputFiles('#ch-foto', __dirname + '/tirilla-prueba.jpg');
  await p.waitForFunction(() => /Leí la tirilla|No pude/.test(document.getElementById('ch-log').textContent), null, { timeout: 90000 });
  ok(/30\.630/.test(await ultimo()) && /Alimentación/.test(await ultimo()), 'lee la tirilla de prueba: total y categoría');
  await p.click('#dlg-charla [data-close]');

  ok(!errs.length, 'sin errores en la página: ' + errs.join(' | '));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
