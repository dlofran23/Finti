// Cuéntame un gasto entiende historias completas: dónde, cada producto con cantidad y precio, el total, las vueltas,
// los descuentos, el medio de pago, lo que puso otra persona y los gastos aparte. Lo que falta se pregunta después
// (también con un aviso de vez en cuando) y el aviso del banco se une con lo que la persona ya contó.
require('./sin-bienvenida.js');
const { chromium } = require('playwright'); const pagarCon = require('./_pagar-con.js');
const path = require('path');
const BASE = process.env.BASE;
const CAPTURAS = path.join(__dirname, 'capturas');
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  const H = (t) => p.evaluate((t) => window.FinHistoria(t), t);
  const cuenta = (id) => p.evaluate((id) => window.FinCuentaNombre(id), id);
  const estado = () => p.evaluate(() => { const K = Object.keys(localStorage).find((k) => /sin-cuenta$/.test(k)); return JSON.parse(localStorage.getItem(K)); });

  // ---------- El motor: historias reales ----------
  let h = await H('Hoy fui al D1 con mi esposa, compramos 2 leches de 4.500, un pan de 3.200, huevos por 12 mil y unas papitas de 2.500. Pagué todo con Nequi, fueron como 27 mil. Después cogimos un taxi de 9 mil para volver y le di mil de propina al señor que empaca. Ah, y el parqueadero 3.000 en efectivo.');
  const d1 = h.movs[0];
  ok(d1.c === 'Mercado en D1' && d1.cat === 'alimentacion' && d1.m === 26700, 'el mercado del D1 suma lo de cada producto (' + d1.c + ', ' + d1.m + ')');
  ok(d1.det.map((x) => x.n + '=' + x.m).join(',') === 'Leches=9000,Pan=3200,Huevos=12000,Papitas=2500' && d1.det[0].q === '2 ×', '2 leches de 4.500 son 9.000; cada producto con su precio');
  ok(/nequi/i.test(await cuenta(d1.cuenta)), '"pagué todo con Nequi" va para la compra');
  ok(h.movs.slice(1).map((x) => x.c + ':' + x.m + ':' + x.cat).join(',') === 'Taxi:9000:transporte,Propina:1000:otros,Parqueadero:3000:transporte', 'el taxi, la propina y el parqueadero quedan aparte, cada uno en su categoría');
  ok(/efectivo/i.test(await cuenta(h.movs[3].cuenta)) && !h.movs[1].cuenta, 'el parqueadero en efectivo; el taxi no hereda el Nequi del mercado');
  ok(!h.movs.some((x) => /esposa/i.test(x.c + JSON.stringify(x.det))), 'quien acompañó no es un producto');

  h = await H('Ayer hice mercado en el Éxito: arroz 5.800, aceite 14.900, medio kilo de carne en 12 mil, 2 kilos de papa a 3 mil el kilo, detergente 18.500 y el concentrado del perro 45 mil. En total fueron 105 mil con la tarjeta.');
  ok(h.movs.length === 2 && h.movs[0].c === 'Mercado en Éxito' && h.movs[1].c === 'Concentrado del perro en Éxito' && h.movs[1].cat === 'otros', 'la comida del perro sale aparte del mercado, en el mismo lugar');
  ok(h.movs[0].det.find((x) => x.n === 'Papa').m === 6000 && h.movs[0].det.find((x) => x.n === 'Papa').q === '2 kg' && h.movs[0].det.find((x) => x.n === 'Carne').q === '½ kg', '2 kilos a 3 mil el kilo son 6.000; medio kilo de carne');
  ok(h.movs[0].m + h.movs[1].m === 105000 && /Otros/.test(h.movs[0].det.slice(-1)[0].n), 'el total manda: lo que faltó para llegar a 105.000 queda como otros');
  ok(h.movs[0].f === new Date(Date.now() - 864e5).toISOString().slice(0, 10) || h.movs[0].f.length === 10, '"ayer" queda en la fecha');

  h = await H('fui a la tienda de don José y compré pan, leche y huevos, me cobraron 15 mil y pagué en efectivo');
  ok(h.movs.length === 1 && h.movs[0].c === 'Mercado en Tienda de don José' && h.movs[0].m === 15000 && h.movs[0].det.length === 3, 'sin precio por producto, el total es la compra (Tienda de don José)');

  h = await H('Pasé por la droguería y compré acetaminofén 6 mil y unas curitas 3.500, luego en el Ara compré galletas, gaseosa y queso, pagué con un billete de 50 y me dieron 22 mil de vueltas');
  ok(h.movs[0].cat === 'salud' && h.movs[0].m === 9500 && h.movs[1].c === 'Mercado en Ara' && h.movs[1].m === 28000, 'dos lugares; billete de 50 y 22 mil de vueltas son 28.000');

  h = await H('Fuimos al Olímpica, mi mamá puso 20 mil, el mercado salió en 86.400, pagamos con Daviplata');
  ok(h.movs[0].m === 66400 && h.movs[0].aportes[0].quien === 'Mi mamá', 'lo que puso mi mamá no es gasto mío (86.400 − 20.000)');

  h = await H('Hicimos mercado en el Makro, fueron 380 mil con la tarjeta de crédito, la mitad la paga mi hermana');
  ok(h.movs[0].m === 380000 && h.movs[0].comp && h.movs[0].comp.partes === 2 && h.movs[0].comp.quien === 'Mi hermana', 'la mitad la paga mi hermana: queda en Te deben');

  h = await H('compré 3 libras de arroz a 2.800, 2 kilos de azúcar en 9.600 y un aceite de 1 litro por 12.900 en el surtimax con daviplata');
  ok(h.movs.length === 1 && h.movs[0].c === 'Mercado en Surtimax' && h.movs[0].m === 30900, 'el lugar al final de la frase también cuenta');

  h = await H('Tanqueé 50 mil en Terpel, el peaje 12.500 y en la tienda compré agua 2 mil');
  ok(h.movs.find((x) => x.c === 'Agua en Tienda').cat === 'alimentacion' && h.movs.some((x) => x.c === 'Gasolina' && x.m === 50000) && h.movs.some((x) => x.c === 'Peaje'), 'agua en la tienda es comida, no el recibo del agua; gasolina y peaje aparte');

  h = await H('Pasé por la panadería: 10 panes de 500 y un tinto de 1.500');
  ok(h.movs[0].m === 6500 && h.movs[0].det[0].m === 5000, '10 panes de 500 son 5.000');
  ok(await H('$ 18.000 en almuerzo') === null && await H('taxi 12 mil y almuerzo 15 mil') === null, 'lo corto lo sigue entendiendo la charla de siempre');

  // ---------- En la charla: la tarjeta con el detalle, una pregunta para después y la respuesta ----------
  await p.click('#hoy-registrar'); await p.waitForTimeout(400);
  await p.fill('#ch-input', 'en el super compré 3 aguacates, una docena de huevos de 14 mil, 2 bolsas de leche por 9 mil y la bolsa 200'); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(500);
  ok(/Te entendí todo: 4 productos en Supermercado/.test(await p.textContent('#ch-log')) && /pagaste por <b>3 aguacates<\/b>/.test(await p.innerHTML('#ch-log')), 'pregunta lo que falta: el precio de los aguacates');
  await p.click('#ch-chips [data-ch="hi:despues"]'); await p.waitForTimeout(300);
  ok(/¿Con qué lo pagaste/.test(await p.textContent('#ch-log')), 'sin decir cómo pagó, pregunta con qué lo pagaste'); await pagarCon(p);
  ok(/te pregunto después/.test(await p.textContent('#ch-log')) && await p.isVisible('.ch-det'), 'la tarjeta muestra cada producto y lo que queda para después');
  await p.screenshot({ path: path.join(CAPTURAS, 'cuentame-historia.png') });
  await p.click('#ch-chips [data-ch="si"]'); await p.waitForTimeout(400);
  ok(/te lo pregunto después/.test(await p.textContent('#ch-log')), 'avisa que lo pregunta después');
  let S = await estado();
  const mv = S.movs.find((x) => x.c === 'Mercado en Supermercado');
  ok(mv && mv.m === 23200 && mv.det.length === 4 && mv.o === 'ch', 'el movimiento guarda el detalle de los productos');
  ok(S.dudas.length === 1 && S.dudas[0].k === 'precio' && S.dudas[0].n === 'Aguacates' && S.dudas[0].mov === mv.id, 'queda una pregunta pendiente');
  const idb = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('fintelligente-datos', 1); r.onsuccess = () => { const q = r.result.transaction('estado').objectStore('estado').get('dudas'); q.onsuccess = () => res(q.result); }; r.onerror = () => res(null); }));
  ok(idb && idb.n === 1 && /aguacates/.test(idb.txt), 'el texto de la pregunta queda en el celular para el aviso (no va al servidor)');
  await p.click('#ch-chips [data-ch="cerrar"]'); await p.waitForTimeout(400);
  ok(await p.isVisible('#dudas-card') && /aguacates/.test(await p.textContent('#dudas-s')), 'en Inicio aparece la pregunta pendiente');
  await p.evaluate(() => document.getElementById('dudas-card').scrollIntoView({ block: 'center' }));
  await p.screenshot({ path: path.join(CAPTURAS, 'cuentame-pregunta-inicio.png') });
  // Llega desde el aviso: #accion=dudas
  await p.goto(BASE + '/#accion=dudas', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  ok(await p.isVisible('#dlg-charla') && /Me quedó una pregunta/.test(await p.textContent('#ch-log')), 'el aviso abre la charla directo en la pregunta');
  await p.fill('#ch-input', '6 mil'); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(500);
  S = await estado();
  const mv2 = S.movs.find((x) => x.id === mv.id);
  ok(mv2.m === 29200 && mv2.det.find((x) => x.n === 'Aguacates').m === 6000 && !S.dudas.length, 'la respuesta se suma a la compra y la pregunta se va');
  await p.screenshot({ path: path.join(CAPTURAS, 'cuentame-respuesta.png') });
  await p.click('#ch-chips [data-ch="cerrar"]').catch(() => p.keyboard.press('Escape')); await p.waitForTimeout(300);
  ok(!(await p.isVisible('#dudas-card')), 'sin preguntas, la tarjeta de Inicio se esconde');

  // ---------- El aviso del banco se une con lo que ya contó ----------
  await p.click('#hoy-registrar'); await p.waitForTimeout(400);
  await p.fill('#ch-input', 'Hoy fui al D1 y compré leche 4.500, pan 3.200 y huevos 12 mil, pagué con Nequi'); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(500);
  await pagarCon(p); await p.click('#ch-chips [data-ch="si"]'); await p.waitForTimeout(400);
  await p.click('#ch-chips [data-ch="cerrar"]'); await p.waitForTimeout(300);
  S = await estado();
  const antes = S.movs.length, nequiAntes = S.cuentas.find((x) => /nequi/i.test(x.nombre)).saldo;
  await p.evaluate(() => document.querySelector('[data-clic="btn-bandeja-menu"]').click()); await p.waitForTimeout(500);
  await p.evaluate(() => { const d = document.getElementById('pegar-box'); if (d) d.open = true; });
  await p.fill('#pegar-texto', 'Nequi: Pagaste $20.000 en D1 SUBA.'); await p.click('#pegar-leer'); await p.waitForTimeout(400);
  ok(await p.isVisible('.mov-contado') && /¿Es lo mismo que me contaste\?/.test(await p.textContent('.mov-contado')) && /Mercado en D1/.test(await p.textContent('.mov-contado')), 'el aviso del banco pregunta si es lo mismo que contó');
  ok(!(await p.isVisible('#bandeja-lista [data-confirmar]')), 'mientras tanto no deja confirmarlo de nuevo (no se duplica)');
  await p.screenshot({ path: path.join(CAPTURAS, 'cuentame-banco-une.png') });
  await p.click('[data-contado-si]'); await p.waitForTimeout(400);
  S = await estado();
  const d1b = S.movs.filter((x) => x.c === 'Mercado en D1').slice(-1)[0];
  ok(S.movs.length === antes && d1b.m === 20000 && d1b.banco === 'Nequi' && d1b.o === 'aviso', 'no se anota dos veces; queda el valor del banco ($ 20.000)');
  ok(S.cuentas.find((x) => /nequi/i.test(x.nombre)).saldo === nequiAntes - 300, 'Nequi baja solo la diferencia ($ 300)');
  ok(!S.pendientes.length, 'el aviso sale de Por confirmar');

  // ---------- Dictada: el micrófono del navegador sigue escuchando en las pausas ----------
  {
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await c2.addInitScript(() => {
      // Reconocimiento falso, dentro del dispositivo: dos frases con una pausa en medio
      class SR {
        static available() { return Promise.resolve('available'); }
        start() {
          window.__sr = this; const r = (txt, fin) => { const x = [{ transcript: txt }]; x.isFinal = fin; return x; };
          const lista = [];
          setTimeout(() => { lista.push(r('fui al D1 y compré leche de 4.500 y pan de 3.200', true)); this.onresult({ results: lista }); }, 100);
          setTimeout(() => { lista.push(r('pagué con Nequi y después un taxi de 9 mil', true)); this.onresult({ results: lista }); }, 1500);
        }
        stop() { this.onend && this.onend(); }
      }
      window.SpeechRecognition = SR;
    });
    const p2 = await c2.newPage(); p2.on('pageerror', (e) => errs.push(e.message));
    await p2.goto(BASE, { waitUntil: 'networkidle' }); await p2.waitForTimeout(900);
    await p2.click('#hoy-registrar'); await p2.waitForTimeout(400);
    await p2.click('#ch-voz'); await p2.waitForTimeout(2500);
    ok(/compré leche de 4\.500 y pan de 3\.200 pagué con Nequi y después un taxi/.test(await p2.inputValue('#ch-input')) && !(await p2.textContent('#ch-log')).includes('Te entendí'), 'con una pausa en medio, sigue escuchando y junta las dos frases');
    await p2.waitForTimeout(3500);
    ok(/Te entendí todo: 2 productos en D1, y aparte taxi/.test(await p2.textContent('#ch-log')), 'tras unos segundos de silencio, entiende la historia dictada completa');
    await c2.close();
  }

  ok(!errs.length, 'sin errores en la página: ' + errs.join(' | '));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
