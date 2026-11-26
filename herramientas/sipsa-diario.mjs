// Precios del día del DANE (SIPSA, boletín diario de precios mayoristas) para Dónde comprar y Pregúntale.
//
// Cada día de mercado el DANE publica en www.dane.gov.co un Excel ("anex-SIPSADiario-25nov2026.xlsx") con el precio
// por kilo de unos 40 alimentos frescos en las principales centrales mayoristas del país y su variación contra el día
// de mercado anterior. Este programa busca el más reciente, lo lee (sin librerías: un .xlsx es un zip con XML) y arma
// un resumen pequeño con la misma forma que espera /api/precios. Lo corre GitHub Actions ("Precios del DANE").
// (El servicio web SOAP del DANE, que usa herramientas/sipsa.mjs, corta las conexiones que llegan desde GitHub.)
//
// Uso:
//   node herramientas/sipsa-diario.mjs --salida sipsa.json                  busca y descarga el boletín más reciente
//   node herramientas/sipsa-diario.mjs --xlsx boletin.xlsx --salida s.json  usa un archivo ya descargado
//
// No envía nada de nadie: solo descarga datos públicos.
import fs from "node:fs";
import zlib from "node:zlib";
import { resumenValido } from "../netlify/lib/precios.mjs";
import { ciudadDe } from "./sipsa.mjs";

export const PAGINA = "https://www.dane.gov.co/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa/componente-precios-mayoristas";
const BASE = "https://www.dane.gov.co";
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Enlaces a los anexos diarios en la página del DANE, del más reciente al más viejo: [{ url, dia: "2026-11-25" }]
export function enlacesDiarios(html) {
  const vistos = new Map();
  for (const m of String(html).matchAll(/href="([^"]*anex-SIPSADiario-(\d{1,2})([a-z]{3})(\d{4})\.xlsx)"/gi)) {
    const mes = MESES.indexOf(m[3].toLowerCase()); if (mes < 0) continue;
    const dia = m[4] + "-" + String(mes + 1).padStart(2, "0") + "-" + m[2].padStart(2, "0");
    const url = m[1].startsWith("http") ? m[1] : BASE + (m[1].startsWith("/") ? "" : "/") + m[1];
    if (url.startsWith(BASE + "/")) vistos.set(dia, url);
  }
  return [...vistos].map(([dia, url]) => ({ dia, url })).sort((a, b) => (a.dia < b.dia ? 1 : -1));
}

// Lee los archivos de un zip (solo los que pide "querer"). Formato estándar: directorio central al final.
export function leerZip(buf, querer = () => true) {
  const b = Buffer.from(buf), fin = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (fin < 0) throw new Error("No es un archivo zip/xlsx");
  const n = b.readUInt16LE(fin + 10); let p = b.readUInt32LE(fin + 16);
  const out = {};
  for (let i = 0; i < n; i++) {
    if (b.readUInt32LE(p) !== 0x02014b50) throw new Error("Zip dañado");
    const metodo = b.readUInt16LE(p + 10), tam = b.readUInt32LE(p + 20), ln = b.readUInt16LE(p + 28), le = b.readUInt16LE(p + 30), lc = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42), nombre = b.toString("utf8", p + 46, p + 46 + ln);
    p += 46 + ln + le + lc;
    if (!querer(nombre)) continue;
    const ini = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28), datos = b.subarray(ini, ini + tam);
    if (metodo === 0) out[nombre] = datos.toString("utf8");
    else if (metodo === 8) out[nombre] = zlib.inflateRawSync(datos, { maxOutputLength: 64 * 1024 * 1024 }).toString("utf8");
  }
  return out;
}

const ENT = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
const desescapar = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENT[m]).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const textoDe = (xml) => desescapar([...xml.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((m) => m[1]).join(""));

// La primera hoja del Excel como filas: [[valor de A, valor de B, ...], ...] (números como número, textos como texto)
export function hojaXlsx(buf) {
  const z = leerZip(buf, (n) => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const hojas = Object.keys(z).filter((n) => n.startsWith("xl/worksheets/")).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
  if (!hojas.length) throw new Error("El Excel no tiene hojas");
  const compartidos = [...(z["xl/sharedStrings.xml"] || "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoDe(m[1]));
  const col = (ref) => { let c = 0; for (const ch of ref.match(/^[A-Z]+/)[0]) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };
  const filas = [];
  for (const f of z[hojas[0]].matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const fila = [];
    for (const c of f[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = (/\br="([A-Z]+)\d+"/.exec(c[1]) || [])[1]; if (!ref) continue;
      const t = (/\bt="(\w+)"/.exec(c[1]) || [])[1], cuerpo = c[2] || "", v = (/<v>([^<]*)<\/v>/.exec(cuerpo) || [])[1];
      let val = null;
      if (t === "s") val = compartidos[+v] ?? null;
      else if (t === "inlineStr") val = textoDe(cuerpo);
      else if (t === "str" || t === "e") val = v != null ? desescapar(v) : null;
      else if (v != null && v !== "") val = Number(v);
      fila[col(ref)] = val;
    }
    filas[+f[1] - 1] = fila;
  }
  return filas;
}

const limpio = (s) => String(s || "").replace(/\*/g, "").replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
const mediana = (l) => { const s = l.slice().sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };

// "Miércoles 25 de noviembre de 2026" -> "2026-11-25"
export function fechaLarga(s) {
  const m = /(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i.exec(String(s || ""));
  const mes = m ? MESES_LARGOS.indexOf(m[2].toLowerCase()) : -1;
  return mes < 0 ? "" : m[3] + "-" + String(mes + 1).padStart(2, "0") + "-" + m[1].padStart(2, "0");
}

// Arma el resumen del día. Por producto: n nombre, g mediana nacional por kilo, v variación mediana contra el día de
// mercado anterior (%), b [central más barata, precio], c { ciudad: [precio, central, precio, variación %] }.
export function resumirDiario(filas, { dia = "", ahora = new Date() } = {}) {
  const iEnc = filas.findIndex((f) => f && /precio\s*\$\s*\/\s*kg/i.test(String(f[0] || "")));
  if (iEnc < 0) return null;
  const enc = filas[iEnc], centrales = [];
  for (let j = 1; j < enc.length; j++) if (typeof enc[j] === "string" && enc[j].trim()) centrales.push({ j, nombre: limpio(enc[j]) });
  for (const f of filas.slice(0, iEnc)) { const d = f && f.map(fechaLarga).find(Boolean); if (d) { dia = d; break; } }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const productos = [];
  for (const f of filas.slice(iEnc + 2)) {
    if (!f || typeof f[0] !== "string") continue;
    const n = limpio(f[0]); if (!n || n.length > 120) continue;
    const l = [];
    for (const { j, nombre } of centrales) {
      const p = f[j], v = f[j + 1];
      if (typeof p === "number" && p > 0 && p < 5e6) l.push({ c: nombre, p: Math.round(p), v: typeof v === "number" && Math.abs(v) < 10 ? Math.round(v * 1000) / 10 : null });
    }
    if (!l.length) continue;   // títulos de grupo ("Frutas frescas") y notas
    const barata = l.reduce((a, x) => (x.p < a.p ? x : a), l[0]), vs = l.map((x) => x.v).filter((x) => x != null);
    const c = {};
    for (const x of l) { const k = ciudadDe(x.c); if (!c[k] || x.p < c[k][0]) c[k] = [x.p, x.c, x.p, x.v]; }
    productos.push({ n, g: Math.round(mediana(l.map((x) => x.p))), v: vs.length ? Math.round(mediana(vs) * 10) / 10 : null, b: [barata.c, barata.p], c });
  }
  productos.sort((a, b) => a.n.localeCompare(b.n, "es"));
  return { fuente: "DANE, SIPSA (boletín diario)", unidad: "kg", tipo: "diario", dia, semana: dia, generado: ahora.toISOString(), productos };
}

const PIDE = { headers: { "User-Agent": "Finti/1.0 (precios de referencia)" } };
export async function descargarDiario({ fetchImpl = fetch } = {}) {
  const r = await fetchImpl(PAGINA, PIDE);
  if (!r.ok) throw new Error("La página del DANE respondió " + r.status);
  const enlaces = enlacesDiarios(await r.text());
  if (!enlaces.length) throw new Error("No encontré el boletín diario en la página del DANE");
  const a = await fetchImpl(enlaces[0].url, PIDE);
  if (!a.ok) throw new Error("El DANE respondió " + a.status + " al pedir " + enlaces[0].url);
  return { buf: Buffer.from(await a.arrayBuffer()), dia: enlaces[0].dia, url: enlaces[0].url };
}

// ---------- Línea de comandos ----------
if (import.meta.url === "file://" + process.argv[1]) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ""; };
  const salida = arg("--salida") || "sipsa.json", xlsx = arg("--xlsx");
  const { buf, dia, url } = xlsx ? { buf: fs.readFileSync(xlsx), dia: "", url: xlsx } : await descargarDiario();
  const r = resumirDiario(hojaXlsx(buf), { dia });
  if (!r || !resumenValido(r)) { console.error("No salió un resumen válido de " + url); process.exit(1); }
  fs.writeFileSync(salida, JSON.stringify(r));
  console.log(`SIPSA diario: ${r.dia}, ${r.productos.length} productos, ${fs.statSync(salida).size} bytes (${url}).`);
}
