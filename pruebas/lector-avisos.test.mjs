// Lector de avisos de bancos y billeteras: un banco de pruebas con mensajes de muchas entidades de Colombia.
// Cada caso: [texto, tipo esperado ("" = no se registra), valor, comercio (vacío = no se revisa)].
import fs from "node:fs"; import vm from "node:vm";
let fallas = 0; const ok = (c, m) => { if (!c) { fallas++; console.log("FALLA:", m); } };
const codigo = fs.readFileSync(new URL("../fuente/logica/lector-de-avisos.js", import.meta.url), "utf8");
const ctx = { console, Math, Date, JSON, String, Number, RegExp, isFinite, parseFloat, parseInt, Array, Object };
vm.createContext(ctx); vm.runInContext(codigo, ctx);
const L = ctx.FinLector, hoy = new Date(2026, 10, 16);
const CASOS = [
["Itau: Transaccion aprobada $ 33.500 ESTABLECIMIENTO: D1 SAS 16/11/26", "gasto", 33500, "D1"],
["Bancolombia: Te abonaron $1.850.000 por NOMINA EMPRESA XYZ SAS en tu cuenta *4321", "ingreso", 1850000, "NOMINA EMPRESA XYZ"],
["Falabella: Usaste tu CMR por $159.900 en FALABELLA ANDINO a 3 cuotas", "gasto", 159900, "FALABELLA ANDINO"],
["Nequi: Tu recarga de $10.000 a Tigo 3001234567 fue exitosa", "gasto", 10000, "Recarga Tigo"],
["Codensa: Tu factura por $ 145.230 vence el 25/11/2026", "", 0, ""],
["Davivienda: Apreciado cliente, se realizo una compra en RAPPI COLOMBIA por $32.900 con su tarjeta terminada en 4455 el 16/11/2026", "gasto", 32900, "RAPPI COLOMBIA"],
["Banco Popular: Se ha debitado de su cuenta $ 65.000 por pago PSE a EPM", "gasto", 65000, "EPM"],
["Scotiabank Colpatria: Compra por $78,500.00 en FARMATODO CEDRITOS. Tarjeta terminada 7788", "gasto", 78500, "FARMATODO CEDRITOS"],
["AV Villas: Se debito $25.000 de su cuenta por compra en EXITO EXPRESS", "gasto", 25000, "EXITO EXPRESS"],
["Banco Caja Social: Retiro por $200.000 en cajero CORRESPONSAL el 16/11/2026", "retiro", 200000, ""],
[
"Bancolombia: Compraste $45.000,00 en EXITO CALLE 80 con tu T.Deb *1234, el 15/11/2026 a las 12:30. Si tienes dudas, encuentranos aqui: 6045109095.",
"gasto",
45000,
"Exito Calle 80"
],
[
"Bancolombia le informa Compra por $128.900,00 en FALABELLA UNICENTRO 18:42. 14/11/2026 T.Cred *5678. Inquietudes al 6045109095",
"gasto",
128900,
"Falabella Unicentro"
],
[
"Bancolombia: Transferiste $250.000 desde tu cuenta *4321 a la cuenta *9876 el 13/11/2026 a las 09:15.",
"gasto",
250000,
""
],
[
"Bancolombia: Recibiste una transferencia por $1.200.000 de EMPRESA SAS en tu cuenta *4321, el 15/11/2026 a las 08:01.",
"ingreso",
1200000,
"Empresa SAS"
],
[
"Bancolombia: Pagaste $85.400 a CODENSA desde tu cuenta *4321 el 10/11/2026.",
"gasto",
85400,
"Codensa"
],
[
"Bancolombia: Retiraste $200.000 en CAJERO BANCOLOMBIA PLAZA 12:10 15/11/2026 T.Deb *1234.",
"retiro",
200000,
""
],
[
"Nequi: Pagaste $18.000 en D1 SUBA el 16 de noviembre de 2026 a las 13:20.",
"gasto",
18000,
"D1 Suba"
],
[
"Enviaste $50.000 a JUAN PEREZ desde tu Nequi.",
"gasto",
50000,
"Juan Perez"
],
[
"Nequi: Juan Pérez te envió $20.000.",
"ingreso",
20000,
"Juan Pérez"
],
[
"¡Te llegó plata! Laura Gómez te envió $35.000 a tu Nequi.",
"ingreso",
35000,
"Laura Gómez"
],
[
"Nequi: Recargaste $10.000 a tu celular Claro 3001234567.",
"gasto",
10000,
"Recarga Claro"
],
[
"Nequi: Moviste $100.000 de tu Nequi a tu Colchón.",
"propio",
100000,
""
],
[
"DaviPlata: Pagaste $12.500 en TIENDAS ARA con tu DaviPlata. 16/11/2026 11:02",
"gasto",
12500,
"Tiendas Ara"
],
[
"DaviPlata: Recibiste $80.000 de MARIA LOPEZ. Saldo disponible $95.300.",
"ingreso",
80000,
"Maria Lopez"
],
[
"Daviplata: Enviaste $30.000 a 3105556677 el 15/11/2026.",
"gasto",
30000,
""
],
[
"Davivienda informa: Compra por $67.900 en RAPPI*RESTAURANTES el 15/11/2026 12:45 con tarjeta credito terminada en 4455.",
"gasto",
67900,
"Rappi*Restaurantes"
],
[
"Davivienda: Se realizo un pago PSE por $230.000 a EPM el 12/11/2026.",
"gasto",
230000,
"EPM"
],
[
"BBVA: Compra aprobada por $54.300 en CARULLA 85 con tu tarjeta *7788 el 15/11/2026 19:30.",
"gasto",
54300,
"Carulla 85"
],
[
"BBVA informa que recibio una transferencia de $500.000 de CARLOS RUIZ el 14/11/2026.",
"ingreso",
500000,
"Carlos Ruiz"
],
[
"Banco de Bogota: Compra por $22.000 en DROGUERIA LA REBAJA con T. Debito *3344 el 16/11/2026 10:10.",
"gasto",
22000,
"Drogueria La Rebaja"
],
[
"Banco de Bogotá: Recibiste por llave $45.000 desde Davivienda el 16/11/2026 08:40.",
"ingreso",
45000,
""
],
[
"Bre-B: Enviaste $25.000 por llave @juanp el 16/11/2026.",
"gasto",
25000,
"@juanp"
],
[
"Recibiste $60.000 de ANA*** RUI*** por Bre-B.",
"ingreso",
60000,
"ANA*** RUI***"
],
[
"Pagaste con QR Bre-B $8.500 a PANADERIA EL TRIGAL.",
"gasto",
8500,
"Panaderia El Trigal"
],
[
"Nu: Compra de COP 23.000 en RAPPI aprobada con tu tarjeta *1122.",
"gasto",
23000,
"Rappi"
],
[
"Nu Colombia: Tu compra en NETFLIX.COM por $38.900 fue aprobada.",
"gasto",
38900,
"Netflix.com"
],
[
"Banco Falabella: Compra aprobada por $199.900 en FALABELLA.COM con tu CMR *9090 el 13/11/2026.",
"gasto",
199900,
"Falabella.com"
],
[
"AV Villas: Compra en OLIMPICA CALLE 72 por $41.250 con su tarjeta debito *2211 el 15/11/2026.",
"gasto",
41250,
"Olimpica Calle 72"
],
[
"Scotiabank Colpatria: Compra por $15.900 en SPOTIFY el 14/11/2026 con su TC *6677.",
"gasto",
15900,
"Spotify"
],
[
"Banco de Occidente: Se debito de su cuenta *5544 $120.000 por pago de cuota credito.",
"gasto",
120000,
""
],
[
"Banco Popular: Abono por nomina $2.350.000 en su cuenta *8899 el 15/11/2026.",
"ingreso",
2350000,
""
],
[
"Caja Social: Transferencia recibida por $90.000 de PEDRO DIAZ a su cuenta *1010.",
"ingreso",
90000,
"Pedro Diaz"
],
[
"Itau: Compra por $33.400 en TERPEL AUTOPISTA con tarjeta *3030 el 16/11/2026 07:55.",
"gasto",
33400,
"Terpel Autopista"
],
[
"Lulo Bank: Pagaste $9.900 en UBER *TRIP con tu tarjeta.",
"gasto",
9900,
"Uber *Trip"
],
[
"RappiPay: Compra por $47.000 en RAPPI con tu RappiCard.",
"gasto",
47000,
"Rappi"
],
[
"MOVii: Pagaste $5.000 en TIENDA DON JOSE.",
"gasto",
5000,
"Tienda Don Jose"
],
[
"dale!: Enviaste $15.000 a Camila.",
"gasto",
15000,
"Camila"
],
[
"Bancolombia: Pago exitoso de tu tarjeta de credito *5678 por $600.000 el 15/11/2026.",
"pagoTarjeta",
600000,
""
],
[
"Bancolombia: Compraste COP45.000,00 en D1 KENNEDY con tu T.Deb *1234 el 16/11/2026 a las 18:02",
"gasto",
45000,
"D1 Kennedy"
],
[
"Compraste $ 12.900 en OXXO CHAPINERO.",
"gasto",
12900,
"Oxxo Chapinero"
],
[
"Bancolombia: Se realizo una compra por valor de 75000 en HOMECENTER el 15-11-2026.",
"gasto",
75000,
"Homecenter"
],
[
"Davivienda: Compra por $1.250.000,00 en ALKOSTO VENECIA el 14 nov 2026 con TC *4455.",
"gasto",
1250000,
"Alkosto Venecia"
],
[
"Nequi: Tu código de seguridad es 482915. No lo compartas con nadie.",
"",
0,
""
],
[
"Bancolombia: tienes una transferencia pendiente por $350.000 vía Bre-B, confírmala aquí antes de 24 horas: bit.ly/xx12",
"",
0,
""
],
[
"Nequi: Se te devolvieron $18.000 de tu compra en D1 SUBA.",
"ingreso",
18000,
"D1 Suba"
],
[
"Bancolombia: Debito automatico de $45.900 a CLARO MOVIL desde tu cuenta *4321 el 10/11/2026.",
"gasto",
45900,
"Claro Movil"
],
[
"Banco de Bogotá: Avance de $300.000 con tu tarjeta de crédito *1212 en CAJERO SERVIBANCA.",
"retiro",
300000,
""
],
[
"Pagaste $3.200 de transporte en TRANSMILENIO con tu tarjeta TuLlave.",
"gasto",
3200,
"Transmilenio"
]
];
const FECHAS = {"Nequi: Pagaste $18.000 en D1 SUBA el 16 de noviembre de 2026 a las 13:20.": "2026-11-16", "Davivienda: Compra por $1.250.000,00 en ALKOSTO VENECIA el 14 nov 2026 con TC *4455.": "2026-11-14", "Bancolombia: Se realizo una compra por valor de 75000 en HOMECENTER el 15-11-2026.": "2026-11-15", "Bancolombia: Compraste $45.000,00 en EXITO CALLE 80 con tu T.Deb *1234, el 15/11/2026 a las 12:30. Si tienes dudas, encuentranos aqui: 6045109095.": "2026-11-15"};
for (const [t, tipo, monto, com] of CASOS) {
  const r = L.leerAviso(t, { hoy });
  if (!tipo) { ok(!r.ok, "no se registra: " + t); continue; }
  ok(r.ok && r.tipo === tipo, "tipo " + tipo + " (leído " + (r.tipo || r.motivo) + "): " + t);
  ok(r.monto === monto, "valor " + monto + " (leído " + r.monto + "): " + t);
  if (com) ok(String(r.comercio).toLowerCase() === com.toLowerCase(), "comercio " + com + " (leído " + r.comercio + "): " + t);
  if (FECHAS[t]) ok(r.fecha === FECHAS[t], "fecha " + FECHAS[t] + " (leída " + r.fecha + "): " + t);
}
// Categorías que salen solas del comercio
const cat = (t) => L.sugerirCategoria(L.leerAviso(t, { hoy }), {}).cat;
ok(cat("Nu Colombia: Tu compra en NETFLIX.COM por $38.900 fue aprobada.") === "suscripciones", "Netflix es suscripción");
ok(cat("Nequi: Recargaste $10.000 a tu celular Claro 3001234567.") === "servicios", "una recarga de Claro es servicios");
ok(cat("BBVA: Compra aprobada por $54.300 en CARULLA 85 con tu tarjeta *7788 el 15/11/2026 19:30.") === "alimentacion", "Carulla es alimentación");
console.log(fallas ? fallas + " fallas de " + CASOS.length + " avisos" : "lector de avisos: " + CASOS.length + " avisos, todo bien"); process.exit(fallas ? 1 : 0);
