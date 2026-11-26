// Boletín diario del DANE (SIPSA): encontrar el anexo más reciente, leer el Excel y armar el resumen del día.
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { enlacesDiarios, leerZip, hojaXlsx, resumirDiario, fechaLarga, descargarDiario, PAGINA } from "../herramientas/sipsa-diario.mjs";
import { resumenValido, guardarPrecios, leerPrecios } from "../netlify/lib/precios.mjs";

// Un .xlsx mínimo (zip con XML), con un archivo guardado tal cual y otro comprimido, como los de Excel
function zip(archivos) {
  const partes = [], dir = []; let pos = 0;
  for (const [i, [nombre, texto]] of Object.entries(archivos).entries()) {
    const crudo = Buffer.from(texto), comprimir = i % 2 === 1, datos = comprimir ? zlib.deflateRawSync(crudo) : crudo, n = Buffer.from(nombre);
    const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(comprimir ? 8 : 0, 8); loc.writeUInt32LE(datos.length, 18); loc.writeUInt32LE(crudo.length, 22); loc.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(comprimir ? 8 : 0, 10); cen.writeUInt32LE(datos.length, 20); cen.writeUInt32LE(crudo.length, 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(pos, 42);
    partes.push(loc, n, datos); dir.push(cen, n); pos += 30 + n.length + datos.length;
  }
  const d = Buffer.concat(dir), fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(dir.length / 2, 8); fin.writeUInt16LE(dir.length / 2, 10); fin.writeUInt32LE(d.length, 12); fin.writeUInt32LE(pos, 16);
  return Buffer.concat([...partes, d, fin]);
}
const textos = ["Miércoles 25 de noviembre de 2026", "Precio $/Kg", "Barranquilla", "Bogotá, Corabastos", "Medellín,\nCMA", "Precio", "Var %", "Verduras y hortalizas", "Tomate*", "n.d.", "Papa  criolla", "n.d. : no disponible", "Pasto, \nEl Potrerillo &amp; más"];
const s = (i) => ({ t: "s", v: i }), num = (v) => ({ v });
const filas = [
  [], [s(0)], [s(1), s(2), null, s(3), null, s(4), null, s(12)], [null, s(5), s(6), s(5), s(6), s(5), s(6), s(5), s(6)], [s(7)],
  [s(8), num(4209), num(-0.01), num(3352), num(-0.04), num(3375), num(-0.07), s(9), s(9)],
  [s(10), s(9), s(9), num(5694), num(-0.06), num(3275), num(0.06), num(2450), num(-0.02)],
  [s(11)],
];
const L = "ABCDEFGHI";
const hoja = '<?xml version="1.0"?><worksheet><sheetData>' + filas.map((f, i) => '<row r="' + (i + 1) + '">' + f.map((c, j) => c ? '<c r="' + L[j] + (i + 1) + '"' + (c.t ? ' t="' + c.t + '"' : "") + "><v>" + c.v + "</v></c>" : "").join("") + "</row>").join("") + "</sheetData></worksheet>";
const compartidos = '<?xml version="1.0"?><sst>' + textos.map((t) => "<si><t>" + t + "</t></si>").join("") + "</sst>";
const xlsx = zip({ "[Content_Types].xml": "<Types/>", "xl/sharedStrings.xml": compartidos, "xl/styles.xml": "<styleSheet/>", "xl/worksheets/sheet1.xml": hoja });

// 1. El zip se lee (guardado y comprimido)
const z = leerZip(xlsx); assert.equal(z["[Content_Types].xml"], "<Types/>"); assert.match(z["xl/sharedStrings.xml"], /Corabastos/);
assert.throws(() => leerZip(Buffer.from("no soy un zip")), /zip/);

// 2. La hoja como filas
const f = hojaXlsx(xlsx);
assert.equal(f[1][0], "Miércoles 25 de noviembre de 2026"); assert.equal(f[5][1], 4209); assert.equal(f[5][7], "n.d."); assert.equal(f[2][7], "Pasto, \nEl Potrerillo & más");
assert.equal(fechaLarga("Miércoles 25 de noviembre de 2026"), "2026-11-25"); assert.equal(fechaLarga("sin fecha"), "");

// 3. El resumen del día
const r = resumirDiario(f, { ahora: new Date("2026-11-25T17:30:00Z") });
assert.equal(r.tipo, "diario"); assert.equal(r.dia, "2026-11-25"); assert.equal(r.semana, "2026-11-25");
assert.deepEqual(r.productos.map((p) => p.n), ["Papa criolla", "Tomate"]);          // sin asterisco ni espacios dobles; sin títulos ni notas
const tomate = r.productos.find((p) => p.n === "Tomate");
assert.equal(tomate.g, 3375); assert.equal(tomate.v, -4);                           // medianas de 3 centrales
assert.deepEqual(tomate.b, ["Bogotá, Corabastos", 3352]);
assert.deepEqual(tomate.c["Medellín"], [3375, "Medellín, CMA", 3375, -7]);         // nombre de la central sin saltos de línea
assert.ok(!tomate.c["Pasto"]);                                                       // n.d.
const papa = r.productos.find((p) => p.n === "Papa criolla");
assert.deepEqual(papa.b, ["Pasto, El Potrerillo & más", 2450]); assert.deepEqual(papa.c["Pasto"], [2450, "Pasto, El Potrerillo & más", 2450, -2]);
assert.ok(resumenValido(r));
assert.equal(resumirDiario([[], ["otra cosa"]]), null);

// 4. Enlaces de la página del DANE: el más reciente primero, solo del sitio del DANE
const html = '<a href="/files/operaciones/SIPSA/anex-SIPSADiario-24nov2026.xlsx">x</a><a href="/files/operaciones/SIPSA/anex-SIPSADiario-25nov2026.xlsx">y</a>' +
  '<a href="/files/operaciones/SIPSA/bol-SIPSADiario-25nov2026.pdf">pdf</a><a href="https://otro.sitio/anex-SIPSADiario-30dic2026.xlsx">z</a><a href="/files/operaciones/SIPSA/anex-SIPSADiario-3dic2025.xlsx">w</a>';
assert.deepEqual(enlacesDiarios(html), [
  { dia: "2026-11-25", url: "https://www.dane.gov.co/files/operaciones/SIPSA/anex-SIPSADiario-25nov2026.xlsx" },
  { dia: "2026-11-24", url: "https://www.dane.gov.co/files/operaciones/SIPSA/anex-SIPSADiario-24nov2026.xlsx" },
  { dia: "2025-12-03", url: "https://www.dane.gov.co/files/operaciones/SIPSA/anex-SIPSADiario-3dic2025.xlsx" },
]);

// 5. Descarga simulada: página y luego el Excel más reciente
const pedidos = [];
const fetchFalso = async (url) => {
  pedidos.push(url);
  if (url === PAGINA) return { ok: true, status: 200, text: async () => html };
  return { ok: true, status: 200, arrayBuffer: async () => xlsx.buffer.slice(xlsx.byteOffset, xlsx.byteOffset + xlsx.length) };
};
const d = await descargarDiario({ fetchImpl: fetchFalso });
assert.equal(d.dia, "2026-11-25"); assert.equal(pedidos[1], "https://www.dane.gov.co/files/operaciones/SIPSA/anex-SIPSADiario-25nov2026.xlsx");
assert.equal(resumirDiario(hojaXlsx(d.buf)).productos.length, 2);
await assert.rejects(descargarDiario({ fetchImpl: async () => ({ ok: true, text: async () => "<p>nada</p>" }) }), /No encontré el boletín/);

// 6. /api/precios lo acepta, y el del día siguiente reemplaza al anterior
const m = new Map(); const store = { setJSON: async (k, v) => m.set(k, JSON.stringify(v)), get: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : null) };
const env = { PRECIOS_CLAVE: "c".repeat(24) }, aut = "Bearer " + env.PRECIOS_CLAVE;
assert.equal((await guardarPrecios({ store, env, autorizacion: aut, texto: JSON.stringify(r) })).status, 200);
const manana = { ...r, dia: "2026-11-26", semana: "2026-11-26" };
assert.equal((await guardarPrecios({ store, env, autorizacion: aut, texto: JSON.stringify(manana) })).status, 200);
assert.equal((await guardarPrecios({ store, env, autorizacion: aut, texto: JSON.stringify(r) })).status, 409);
assert.equal((await leerPrecios(store)).body.dia, "2026-11-26");

console.log("precios del día: todo bien");
