// Importar el extracto del banco: la persona sube el Excel o el CSV de movimientos y quedan en su mes y su
// categoría, sin repetir los que ya estaban y sin contar como gasto los traslados entre sus cuentas.
require('./sin-bienvenida.js');
const path = require('path'), fs = require('fs'), os = require('os');
const CAPTURAS = path.join(__dirname, 'capturas'); fs.mkdirSync(CAPTURAS, { recursive: true });
// JSZip del sitio, cargado aparte (el archivo es para el navegador).
const JSZip = (() => { const vm = require('vm'), ctx = { setTimeout, clearTimeout, setImmediate, Uint8Array, ArrayBuffer, Promise, TextEncoder, TextDecoder };
  ctx.self = ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'vendor', 'jszip-3.10.1.min.js'), 'utf8'), ctx); return ctx.JSZip; })();
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const T = async (p, sel) => ((await p.textContent(sel)) || '').replace(/ /g, ' ').replace(/\s+/g, ' ');
const estado = (p) => p.evaluate(() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.meses) return v; } catch (e) {} } return null; });
const salud = () => fetch(BASE + '/__salud').then((r) => r.json());
const contar = (s, e) => Object.keys(s).filter((k) => k.startsWith('metricas/')).reduce((a, k) => a + Object.values(s[k][e] || {}).reduce((x, y) => x + y, 0), 0);

// Fechas relativas a hoy: este mes, el anterior y uno de hace cuatro meses (fuera de los 3 de la versión gratis).
const hoy = new Date(), dd = (m, d) => new Date(hoy.getFullYear(), hoy.getMonth() - m, d);
const dmy = (f) => ('0' + f.getDate()).slice(-2) + '/' + ('0' + (f.getMonth() + 1)).slice(-2) + '/' + f.getFullYear();
const iso = (f) => f.getFullYear() + '-' + ('0' + (f.getMonth() + 1)).slice(-2) + '-' + ('0' + f.getDate()).slice(-2);
const key = (f) => f.getFullYear() + '-' + ('0' + (f.getMonth() + 1)).slice(-2);
const A = dd(0, 2), B = dd(1, 5), C = dd(1, 20), V = dd(4, 10);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'extracto-'));
const csv = path.join(tmp, 'movimientos.csv');
fs.writeFileSync(csv, '﻿BANCO DE PRUEBA S.A.\nCuenta de ahorros\n\nFecha;Descripción;Referencia;Valor;Saldo\n' + [
  [dmy(A), 'COMPRA EN EXITO LAURELES', '0001', '-185.400,00', '1.000.000,00'],
  [dmy(A), 'PAGO PSE CLARO MOVIL', '0002', '-62.900,00', '937.100,00'],
  [dmy(B), 'ABONO NOMINA EMPRESA XYZ', '0003', '2.500.000,00', '3.437.100,00'],
  [dmy(B), 'TRASLADO A BOLSILLO', '0004', '-300.000,00', '3.137.100,00'],
  [dmy(B), 'PAGO TARJETA CREDITO', '0005', '-450.000,00', '2.687.100,00'],
  [dmy(C), 'RETIRO CAJERO PARQUE', '0006', '-200.000,00', '2.487.100,00'],
  [dmy(C), '"COMPRA EN RAPPI; DOMICILIO"', '0007', '-38.500,00', '2.448.600,00'],
  [dmy(V), 'COMPRA EN NETFLIX.COM', '0008', '-44.900,00', '2.403.700,00'],
  ['', 'SALDO FINAL', '', '', '2.403.700,00'],
].map((r) => r.join(';')).join('\n'));

// Excel con débito y crédito en columnas separadas, fechas como número de Excel y filas de título arriba.
const serial = (f) => Math.round((Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
async function crearXlsx(destino) {
  const filas = [['Extracto de movimientos'], [], ['Fecha', 'Detalle', 'Débito', 'Crédito', 'Saldo'],
    [serial(A), 'Compra Juan Valdez Cafe', 15800, '', 900000], [serial(B), 'Pago Uber Trip', 23400, '', 876600], [serial(C), 'Transferencia de Ana Ruiz', '', 120000, 996600]];
  const strs = [], si = (t) => { let i = strs.indexOf(t); if (i < 0) { strs.push(t); i = strs.length - 1; } return i; };
  const col = (i) => String.fromCharCode(65 + i);
  const rows = filas.map((f, r) => '<row r="' + (r + 1) + '">' + f.map((v, c) => v === '' ? '' : typeof v === 'number'
    ? '<c r="' + col(c) + (r + 1) + '"><v>' + v + '</v></c>' : '<c r="' + col(c) + (r + 1) + '" t="s"><v>' + si(v) + '</v></c>').join('') + '</row>').join('');
  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
  z.file('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Movimientos" sheetId="1"/></sheets></workbook>');
  z.file('xl/sharedStrings.xml', '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + strs.map((t) => '<si><t>' + t + '</t></si>').join('') + '</sst>');
  z.file('xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rows + '</sheetData></worksheet>');
  fs.writeFileSync(destino, Buffer.from(await z.generateAsync({ type: 'uint8array' })));
}

(async () => {
  const xlsx = path.join(tmp, 'Movimientos.xlsx'); await crearXlsx(xlsx);
  const pdf = path.join(tmp, 'extracto.pdf'); fs.writeFileSync(pdf, '%PDF-1.4');
  const b = await chromium.launch(); const errs = [];
  const s0 = await salud();
  const c = await b.newContext({ viewport: { width: 1200, height: 900 } });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);

  await p.evaluate(() => document.querySelectorAll('#lateral .lat-grupo').forEach((d) => { d.open = true; })); await p.click('#lateral [data-clic="btn-extracto-menu"]'); await p.waitForTimeout(250);
  ok(await p.isVisible('#dlg-extracto') && /Importar el extracto del banco/.test(await T(p, '#extracto-t')), 'se abre desde el menú');
  ok(/no se envía a ninguna parte/.test(await T(p, '#dlg-extracto')), 'dice que el archivo no sale del dispositivo');

  await p.setInputFiles('#f-extracto', pdf); await p.waitForTimeout(200);
  ok(/PDF/.test(await T(p, '#extracto-msg')) && /Excel o CSV/.test(await T(p, '#extracto-msg')), 'el PDF no se puede leer y explica qué descargar');

  await p.setInputFiles('#f-extracto', csv); await p.waitForTimeout(600);
  const res = await T(p, '#extracto-res');
  ok(/5 movimientos nuevos/.test(res), 'cuenta los movimientos nuevos (sin traslados, pago de tarjeta, retiro ni la fila de saldo): ' + res.slice(0, 80));
  ok(/Gastos\s*\$ 331\.700/.test(res) && /Ingresos\s*\$ 2\.500\.000/.test(res), 'suma gastos e ingresos: ' + (res.match(/Gastos[^I]*/) || [''])[0]);
  ok(/2 traslados entre tus cuentas o pagos de tarjeta/.test(res), 'aparta los traslados y el pago de tarjeta');
  ok(/1 retiro de cajero/.test(res), 'aparta el retiro de cajero');
  ok(/versión gratis/.test(res) && new RegExp(['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][V.getMonth()]).test(res), 'avisa que el mes viejo solo queda para el asesor en la versión gratis');
  ok(/^Del \d+ de [a-z]+( de \d{4})? al \d+ de [a-z]+ de \d{4}$/.test(await T(p, '.extracto-res-top span')), 'rango de fechas legible: ' + await T(p, '.extracto-res-top span'));
  await p.screenshot({ path: path.join(CAPTURAS, 'extracto-vista.png') });

  await p.click('#extracto-ok'); await p.waitForTimeout(400);
  ok(!(await p.isVisible('#dlg-extracto')) && /importamos 5 movimientos/.test(await T(p, '#toasts')), 'importa y lo confirma con opción de deshacer');
  let s = await estado(p);
  ok(!s.ejemplo && s.metas.length === 0 && s.deudas.length === 0, 'el ejemplo se va');
  ok(s.movs.length === 5 && s.movs.every((m) => m.h === -1 || m.f === s.movs[0].f), 'quedan 5 movimientos en el historial');
  const exito = s.movs.find((m) => /Exito Laureles/.test(m.c)), rappi = s.movs.find((m) => /Rappi/.test(m.c));
  ok(exito && exito.m === 185400 && exito.f === iso(A), 'limpia la descripción ("COMPRA EN" fuera) y conserva fecha y valor');
  ok(rappi && rappi.m === 38500, 'lee bien un campo entre comillas con punto y coma adentro');
  ok(s.movs.find((m) => m.t === 'i' && m.m === 2500000), 'la nómina entra como ingreso');
  const mA = s.meses[key(A)], mB = s.meses[key(B)];
  ok(mA && mA.gastos.reduce((a, g) => a + g.real, 0) === 185400 + 62900, 'los gastos de este mes quedan en su tabla');
  ok(mB && mB.ingresos.reduce((a, g) => a + g.real, 0) === 2500000 && mB.gastos.reduce((a, g) => a + g.real, 0) === 38500, 'el mes anterior se crea con sus movimientos');
  ok(!s.meses[key(V)] && s.movs.some((m) => m.m === 44900), 'en la versión gratis el mes viejo no se crea, pero el movimiento queda para el asesor');
  ok(s.cuentas.every((x) => x.saldo === 0), 'no toca los saldos de las cuentas');

  // Subir el mismo archivo otra vez no duplica nada
  await p.evaluate(() => document.querySelectorAll('#lateral .lat-grupo').forEach((d) => { d.open = true; })); await p.click('#lateral [data-clic="btn-extracto-menu"]'); await p.waitForTimeout(250);
  await p.setInputFiles('#f-extracto', csv); await p.waitForTimeout(500);
  ok(/No hay movimientos nuevos/.test(await T(p, '#extracto-res')) && /los 5 del archivo ya estaban registrados/.test(await T(p, '#extracto-res')) && !(await p.$('#extracto-ok')), 'el mismo archivo otra vez: nada nuevo');

  // Excel con débito y crédito
  await p.setInputFiles('#f-extracto', xlsx); await p.waitForTimeout(800);
  const rx = await T(p, '#extracto-res');
  ok(/3 movimientos nuevos/.test(rx) && /Gastos\s*\$ 39\.200/.test(rx) && /Ingresos\s*\$ 120\.000/.test(rx), 'lee el Excel con columnas de débito y crédito: ' + rx);
  await p.click('#extracto-ok'); await p.waitForTimeout(300);
  s = await estado(p);
  ok(s.movs.length === 8 && s.movs.find((m) => /Juan Valdez/.test(m.c) && m.f === iso(A)), 'las fechas de Excel (número de serie) se convierten bien');

  // Deshacer
  await p.click('#toasts .toast:last-child button'); await p.waitForTimeout(300);
  s = await estado(p);
  ok(s.movs.length === 5, 'Deshacer quita lo último que se importó');

  // Desde Conectar bancos
  await p.click('#lateral [data-clic="btn-fuentes-menu"]'); await p.waitForTimeout(300);
  ok(/¿Tienes meses anteriores\?/.test(await T(p, '#dlg-fuentes')), 'Conectar bancos ofrece importar el extracto');
  await p.click('#fuentes-body [data-open-extracto]'); await p.waitForTimeout(300);
  ok(!(await p.isVisible('#dlg-fuentes')) && await p.isVisible('#dlg-extracto'), 'y lo abre');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(!(await p.isVisible('#dlg-extracto')), 'Escape cierra');

  await p.waitForTimeout(400);
  const s1 = await salud();
  ok(contar(s1, 'extracto') - contar(s0, 'extracto') === 1, 'se cuenta una vez en las métricas');
  ok(!errs.length, 'sin errores en la página ' + errs.join(' | '));
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  if (fallas) { console.log(fallas + ' falla(s)'); process.exit(1); }
  console.log('extracto: todo bien');
})().catch((e) => { console.error(e); process.exit(1); });
