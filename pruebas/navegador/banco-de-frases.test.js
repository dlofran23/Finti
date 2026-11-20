// Banco de frases: cómo habla la gente de verdad (jerga, dictado, errores de escritura, cifras dichas a medias).
// Mide qué tanto entiende Finti un gasto suelto, una historia completa y una pregunta. Imprime la nota de cada grupo
// y falla si alguna frase deja de entenderse. Cuando un probador mande una frase que Finti no entendió, se agrega aquí.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
const VER = !!process.env.VER;   // VER=1 muestra cada frase que falla, aunque no detenga la prueba

// [frase, valor, categoría ("" = no se revisa), tipo ("g" gasto, "i" ingreso)]
const SUELTOS = [
  ['almuerzo 18 mil', 18000, 'alimentacion'],
  ['me gasté 25 lucas en gasolina', 25000, 'transporte'],
  ['solté 12 barras en el taxi', 12000, 'transporte'],
  ['pagué el arriendo, 850 mil', 850000, 'vivienda'],
  ['netflix 26.900', 26900, 'suscripciones'],
  ['me clavaron 40 mil en el parqueadero', 40000, 'transporte'],
  ['dieciocho mil quinientos de almuerzo', 18500, 'alimentacion'],
  ['almuerso 15mil', 15000, 'alimentacion'],
  ['un tinto de 2500', 2500, 'alimentacion'],
  ['18 000 en almuerzo', 18000, 'alimentacion'],
  ['$18.000 almuerzo', 18000, 'alimentacion'],
  ['uber 14k', 14000, 'transporte'],
  ['me pagaron la quincena 1.300.000', 1300000, '', 'i'],
  ['recibí 50 mil de mi mamá', 50000, '', 'i'],
  ['factura de la luz 89 mil', 89000, 'servicios'],
  ['drogeria 23 mil', 23000, 'salud'],
  ['medio palo en ropa', 500000, 'compras'],
  ['pagué 120 mil de la tarjeta de crédito', 120000, 'deudas'],
  ['rumba el sábado 80 mil', 80000, 'ocio'],
  ['cerveza con los amigos 35 mil', 35000, 'ocio'],
  ['pasajes 5.600', 5600, 'transporte'],
  ['recarga del celular 20 mil', 20000, 'servicios'],
  ['mil quinientos de un dulce', 1500, ''],
  ['me gasté 15 en el almuerzo', 15000, 'alimentacion'],
  ['taxi de 12', 12000, 'transporte'],
  ['doce mil de taxi', 12000, 'transporte'],
  ['un millón doscientos de arriendo', 1200000, 'vivienda'],
  ['2 palos y medio la moto', 2500000, ''],
  ['veinte lucas de mercado', 20000, 'alimentacion'],
  ['gasolina 60.000 pesos', 60000, 'transporte'],
  ['me tumbaron 30 mil en el peaje', 30000, 'transporte'],
  ['spotfy 16.900', 16900, 'suscripciones'],
  ['mercdo 45 mil', 45000, 'alimentacion'],
  ['empanada 3 mil quinientos', 3500, 'alimentacion'],
  ['dos mil ochocientos de bus', 2800, 'transporte'],
  ['pague el internet 95 mil', 95000, 'servicios'],
  ['la cuota del crédito 340 mil', 340000, 'deudas'],
  ['matricula del colegio 450 mil', 450000, 'educacion'],
  ['cine con mi novia 46 mil', 46000, 'ocio'],
  ['vendí la bicicleta en 300 mil', 300000, '', 'i'],
  // Frases nuevas que no se usaron para ajustar el lector (la primera vez entendió 26 de 32)
  ['hoy almorcé en el corrientazo 14 mil',14000,'','g'],
  ['le eché 50 lucas de gasolina a la moto',50000,'','g'],
  ['me cobraron 7 mil por la lavada de la moto',7000,'','g'],
  ['onces con mi mamá 22.500',22500,'','g'],
  ['pagué el gas, 38 mil',38000,'','g'],
  ['once mil de un domicilio',11000,'','g'],
  ['ciento veinte mil del mercado',120000,'','g'],
  ['me tocó pagar 15 por el parqueadero',15000,'','g'],
  ['compré unos audífonos de 89.900',89900,'','g'],
  ['recibi el pago de un trabajo de 400 mil',400000,'','i'],
  ['medicamentos 32 mil',32000,'','g'],
  ['transmi 3.200',3200,'','g'],
];

// [frase, total de lo gastado, cuántos gastos, el primer lugar ("" = no se revisa), categoría del primero ("" = no se revisa)]
const HISTORIAS = [
  ['fui al d uno y compre arroz de 3 mil, leche de 4 mil y pan de 2 mil', 9000, 1, 'D1', 'alimentacion'],
  ['estuve en el éxito compré un pollo de 18 mil unas papas de 5 mil y una gaseosa de 6 mil todo me salió en 29 mil pagué con la tarjeta', 29000, 1, 'Éxito', 'alimentacion'],
  ['en el ara compre 2 atunes a 5 mil cada uno y un arroz de 4 mil', 14000, 1, 'Ara', 'alimentacion'],
  ['hoy hice el mercado en el D1, gasté 87 mil y el taxi de vuelta fueron 11 mil', 98000, 2, 'D1', 'alimentacion'],
  ['fui a la plaza compre tomate 3 mil, cebolla 2 mil, papa 5 mil, y unas frutas 10 mil', 20000, 1, 'Plaza de mercado', 'alimentacion'],
  ['pasé por la tienda y compré una cocacola de 3500 y unos chitos de 2000, después pagué el bus 2950', 8450, 2, 'Tienda', 'alimentacion'],
  ['en el olimpica gaste como 120 lucas en mercado, pague con nequi', 120000, 1, 'Olímpica', 'alimentacion'],
  ['fui al carulla, compré un vino de 45 mil, queso de 18 mil y unas uvas de 12 mil, pagué con la de crédito', 75000, 1, 'Carulla', ''],
  ['Hoy en el D1: leche 3.900, huevos 14.500, arroz 4.200, aceite 9.800. Total 32.400', 32400, 1, 'D1', 'alimentacion'],
  ['fui al exito y compre un pollo asado de 28 mil y despues en la drogueria unas pastillas de 8 mil', 36000, 2, 'Éxito', 'alimentacion'],
  ['fui al olimpca compre arros 4 mil y azucar 3 mil', 7000, 1, 'Olímpica', 'alimentacion'],
  ['hoy fui al supermercado compré leche a 4500 pan a 3000 huevos a 13000 y queso a 9000 en total 29500 con tarjeta débito', 29500, 1, 'Supermercado', 'alimentacion'],
  ['en la tienda de la esquina compré 6 huevos a 600 cada uno y una bolsa de leche de 4 mil', 7600, 1, '', 'alimentacion'],
  ['fui al D1 y gasté 15 en pan y leche', 15000, 1, 'D1', 'alimentacion'],
  ['hice mercado en el Ara de 60 lucas y el domicilio de 4 mil', 64000, 2, 'Ara', 'alimentacion'],
  ['compré en el éxito unos tenis de 180 mil y una camiseta de 45 mil', 225000, 1, 'Éxito', 'compras'],
  ['fui a la droguería por un ibuprofeno de 7 mil y un shampoo de 18 mil', 25000, 1, 'Droguería', ''],
  ['en el D1 me salió todo en 54.300, pagué con un billete de 100 y me devolvieron 45.700', 54300, 1, 'D1', 'alimentacion'],
  ['mercado en el surtimax 78 mil, después almorzamos en un corrientazo 28 mil los dos', 106000, 2, 'Surtimax', 'alimentacion'],
  ['fui al jumbo y compré carne de 35 mil, pollo de 22 mil, una libra de queso de 14 mil y detergente de 19 mil, pagué con davivienda', 90000, 1, 'Jumbo', 'alimentacion'],
  ['ayer en el ara compré 3 leches a 3.800, 2 panes de 2.500 y una docena de huevos de 13 mil', 29400, 1, 'Ara', 'alimentacion'],
  ['fui a la panadería y pedí 2 cafés y 4 pandebonos, me cobraron 14 mil', 14000, 1, 'Panadería', 'alimentacion'],
  ['en el fruver compré banano 3 mil, mango 6 mil, aguacate 5 mil y fresas 7 mil, pagué con nequi', 21000, 1, 'Fruver', 'alimentacion'],
  ['en el d1 compre leche de 4 mil pan de 3 mil y una gaseosa de 5 mil y el parqueadero me salio en 2 mil', 14000, 2, 'D1', 'alimentacion'],
  ['fui a la carnicería y compré 2 libras de carne a 14 mil la libra y un pollo de 20 mil',48000,1,'',''],
  ['en el ara gasté 43.600 en mercado y luego me tomé un tinto de 2 mil',45600,2,'',''],
  ['hoy fui al éxito, compré pañales de 52 mil, leche de 8 mil y unas galletas de 4 mil, pagué con la tarjeta de crédito',64000,1,'',''],
  ['fuimos a la plaza con mi suegra y compramos plátanos 4 mil, yuca 3 mil, cebolla 2.500 y cilantro mil, ella puso 5 mil',5500,1,'',''],
  ['en el D1 compré 4 atunes a 4.900 cada uno, 2 paquetes de pasta a 2.800 y un aceite de 11 mil, total 36.200',36200,1,'',''],
  ['pasé por la panadería y compré pan por 6 mil y un roscón de 8 mil, y después en la droguería unas vitaminas de 25 mil',39000,2,'',''],
  ['estuve en el olímpica, gasté 95 mil con daviplata, y el taxi de regreso 9.500',104500,2,'',''],
  ['compre en la tienda 3 gaseosas de 2.500 y un paquete de papas de 6 mil',13500,1,'',''],
  ['fui al jumbo hice mercado de 230 mil y me devolvieron 20 mil porque pagué con 250',230000,1,'',''],
  ['en el fruver gaste 18 mil en frutas y verduras',18000,1,'',''],
  ['fui al exito a comprar el mercado del mes, fueron 380 mil, y en la salida compré un helado de 6 mil para el niño', 386000, 2, 'Éxito', 'alimentacion'],
];

// [pregunta, intención esperada, categoría ("" = no se revisa)]
const PREGUNTAS = [
  ['¿cuánto gasté en comida este mes?', 'gasto', 'alimentacion'],
  ['cuanto llevo en transporte', 'gasto', 'transporte'],
  ['¿me alcanza para unos tenis de 300 mil?', 'alcanza', ''],
  ['¿en qué se me va la plata?', 'top', ''],
  ['¿cuánto gasté en leche?', 'producto', ''],
  ['¿dónde compro más barato el arroz?', 'producto', ''],
  ['¿qué es lo que más compro en el mercado?', 'productos', ''],
  ['¿subió el mercado?', 'productos', ''],
  ['¿cómo puedo ahorrar en el mercado?', 'consejo', ''],
  ['¿qué me recomiendas?', 'consejo', ''],
  ['¿cómo puedo ahorrar más?', 'consejo', ''],
  ['¿estoy gastando mucho?', 'comparar', ''],
  ['¿cuánto puedo gastar hoy?', 'hoy', ''],   // desde el 18 de noviembre de 2026 responde con la cifra de la tarjeta azul del Inicio
  ['¿qué pago primero?', 'deudas', ''],
  ['¿vale la pena comprar un carro de 40 millones?', 'alcanza', ''],
  ['¿debería sacar un crédito?', 'consejo', ''],
  ['¿cuánto debería ahorrar al mes?', 'consejo', ''],
  ['¿cuánto me gasté en el D1?', 'gasto', ''],
  ['¿cuanto gaste ayer?', 'gasto', ''],
  ['¿en que gasto mas plata?', 'top', ''],
  ['¿cuanto me queda pa terminar el mes?', 'disponible', ''],
  ['¿cómo hago para que me alcance la plata?', 'consejo', ''],
  ['¿cuánto me sale la leche?', 'producto', ''],
  ['¿cuánto gasto en mercado al mes?', 'gasto', 'alimentacion'],
  ['dame un consejo', 'consejo', ''],
  ['¿cuánto se me va en arroz?','producto',''],
  ['¿qué tanto gasto en gasolina?','gasto',''],
  ['¿dónde me sale más barata la leche?','producto',''],
  ['¿me conviene pedir un préstamo?','consejo',''],
  ['¿cómo hago para ahorrar?','consejo',''],
  ['¿qué productos compro más?','productos',''],
  ['¿cuánto llevo gastado este mes?','gasto',''],
  ['¿tengo plata para salir el fin de semana?','alcanza',''],
  ['¿cuánto pagué de luz?','gasto',''],
  ['¿qué le puedo recortar a mis gastos?','consejo',''],
];

let fallas = 0;
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const nota = (nombre, malas, total) => {
    const n = total - malas.length;
    console.log((malas.length ? 'FALLA ' : 'ok  ') + nombre + ': entiende ' + n + ' de ' + total + ' (' + Math.round(n * 100 / total) + ' %)');
    malas.forEach((m) => console.log('      ' + m));
    fallas += malas.length;
  };

  let malas = [];
  for (const [t, m, cat, tipo] of SUELTOS) {
    const r = (await p.evaluate((t) => window.FinEntender(t), t));
    const x = r.length === 1 ? r[0] : { m: r.reduce((a, y) => a + y.m, 0), cat: r[0].cat, t: r[0].t };
    const bien = x.m === m && (!cat || x.cat === cat) && x.t === (tipo || 'g');
    if (!bien) malas.push(t + '  →  ' + x.m + ' ' + (x.cat || '-') + ' ' + x.t + ' "' + (r[0].c || '') + '"');
  }
  nota('gastos sueltos', malas, SUELTOS.length);

  malas = [];
  for (const [t, total, n, lugar, cat] of HISTORIAS) {
    const h = await p.evaluate((t) => window.FinHistoria(t), t);
    // Si no es una historia, la charla la entiende como uno o varios gastos sueltos (así funciona en la app)
    const g = h ? h.movs.filter((x) => x.t !== 'i') : (await p.evaluate((t) => window.FinEntender(t), t)).filter((x) => x.t !== 'i'), suma = g.reduce((a, x) => a + x.m, 0);
    const bien = suma === total && g.length === n && (!lugar || !h || g[0].lugar === lugar) && (!cat || g[0].cat === cat);
    if (!bien) malas.push(t + '  →  ' + g.map((x) => x.c + ':' + x.m + ':' + x.cat).join(' | '));
  }
  nota('historias', malas, HISTORIAS.length);

  malas = [];
  for (const [t, intent, cat] of PREGUNTAS) {
    const r = await p.evaluate((t) => window.FinIntencion(t), t);
    if (r.intent !== intent || (cat && r.cat !== cat)) malas.push(t + '  →  ' + (r.intent || 'no entendió') + (r.cat ? ' ' + r.cat : ''));
  }
  nota('preguntas', malas, PREGUNTAS.length);

  if (errs.length) { console.log('FALLA errores en la página: ' + errs.join(' | ')); fallas++; }
  await b.close();
  if (fallas && !VER) process.exit(1);
})();
