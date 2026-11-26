// Precios de referencia del DANE (SIPSA) para Dónde comprar y Pregúntale.
//
// El servicio web del DANE es público y gratis, pero no acepta filtros: cada consulta trae TODO el historial
// (cientos de megas de XML, más o menos un minuto). Eso no cabe en una función programada de Netlify gratis
// (30 segundos), así que lo corre GitHub Actions (gratis) una vez al día, lee la respuesta por partes sin
// guardarla entera, se queda con las dos últimas semanas y manda un resumen pequeño a /api/precios.
//
// Uso:
//   node herramientas/sipsa.mjs --salida sipsa.json                 descarga del DANE y escribe el resumen
//   node herramientas/sipsa.mjs --xml respuesta.xml --salida s.json  usa un XML ya descargado (pruebas)
//   CLAVE=… node herramientas/sipsa.mjs --via https://…/api/precios-dane --salida sipsa.json
//                                                                    pasa por el trabajador de Cloudflare
//                                                                    (el DANE corta las conexiones de GitHub)
//
// No envía nada de nadie: solo descarga datos públicos.
import fs from "node:fs";
import { resumenValido, SIPSA_URL, sobre, ENCABEZADOS_SIPSA } from "../netlify/lib/precios.mjs";

export { SIPSA_URL, OPERACION, sobre } from "../netlify/lib/precios.mjs";

const ENT = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
const desescapar = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENT[m]).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

// Lector por partes: recibe pedazos de texto y llama a alRegistro con cada <return>...</return> como objeto
// { campo: texto }. No usa DTD ni entidades externas (solo las cinco básicas).
export function lectorPorPartes(alRegistro) {
  let buf = "";
  return {
    agregar(pedazo) {
      buf += pedazo;
      for (;;) {
        const i = buf.search(/<(?:[\w-]+:)?return>/);
        if (i < 0) { if (buf.length > 4096) buf = buf.slice(-4096); return; }
        const cierre = /<\/(?:[\w-]+:)?return>/.exec(buf.slice(i));
        if (!cierre) { buf = buf.slice(i); return; }
        const cuerpo = buf.slice(i, i + cierre.index);
        buf = buf.slice(i + cierre.index + cierre[0].length);
        const r = {};
        cuerpo.replace(/<(?:[\w-]+:)?(\w+)>([^<]*)<\/(?:[\w-]+:)?\1>/g, (_, k, v) => { r[k] = desescapar(v.trim()); return ""; });
        alRegistro(r);
      }
    },
    falla() { return /<(?:[\w-]+:)?Fault>/.test(buf) ? (/<(?:[\w-]+:)?Text[^>]*>([^<]*)/.exec(buf) || [])[1] || "Falla del servicio" : ""; },
  };
}

// "2026-11-09T00:00:00-05:00", "2026-11-09", "09/11/2026" -> "2026-11-09"
export function fechaDe(s) {
  s = String(s || "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[1] + "-" + m[2] + "-" + m[3];
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); if (m) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  return "";
}

// "Bogotá, D.C., Corabastos" -> "Bogotá"; "Medellín, Central Mayorista de Antioquia" -> "Medellín"
export function ciudadDe(central) {
  const s = String(central || "").replace(/\s+/g, " ").trim();
  const c = s.split(",")[0].trim();
  return c || s;
}

const mediana = (l) => { const s = l.slice().sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };

// Junta los registros: se queda con la última semana y la anterior, y arma por producto la mediana nacional,
// el cambio contra la semana anterior, la central más barata y el precio por ciudad.
export function resumir(registros, ahora = new Date()) {
  const porSemana = new Map();
  for (const r of registros) {
    const f = fechaDe(r.fechaIni || r.fechaMesIni || r.enmaFecha);
    const p = Number(String(r.promedioKg || "").replace(",", "."));
    const n = String(r.artiNombre || "").replace(/\s+/g, " ").trim();
    const c = String(r.fuenNombre || "").replace(/\s+/g, " ").trim();
    if (!f || !n || !c || !(p > 0) || p > 5e6) continue;
    if (!porSemana.has(f)) porSemana.set(f, []);
    porSemana.get(f).push({ n, c, p });
  }
  const semanas = [...porSemana.keys()].sort();
  const ult = semanas[semanas.length - 1], ant = semanas[semanas.length - 2] || "";
  if (!ult) return null;
  const agrupar = (l) => { const m = new Map(); for (const x of l || []) { if (!m.has(x.n)) m.set(x.n, []); m.get(x.n).push(x); } return m; };
  const A = agrupar(porSemana.get(ult)), B = agrupar(porSemana.get(ant));
  const productos = [];
  for (const [n, l] of A) {
    const g = Math.round(mediana(l.map((x) => x.p)));
    const prev = B.get(n), gAnt = prev ? mediana(prev.map((x) => x.p)) : 0;
    const barata = l.reduce((a, x) => (x.p < a.p ? x : a), l[0]);
    const ciudades = {};
    const porC = new Map(); for (const x of l) { const k = ciudadDe(x.c); if (!porC.has(k)) porC.set(k, []); porC.get(k).push(x); }
    for (const [k, xs] of porC) { const b = xs.reduce((a, x) => (x.p < a.p ? x : a), xs[0]); ciudades[k] = [Math.round(mediana(xs.map((x) => x.p))), b.c, Math.round(b.p)]; }
    productos.push({ n, g, v: gAnt ? Math.round((g / gAnt - 1) * 1000) / 10 : null, b: [barata.c, Math.round(barata.p)], c: ciudades });
  }
  productos.sort((a, b) => a.n.localeCompare(b.n, "es"));
  return { fuente: "DANE, SIPSA", unidad: "kg", tipo: "mayorista", semana: ult, anterior: ant || null, generado: ahora.toISOString(), productos };
}

// Descarga del DANE leyendo por partes. Solo guarda los registros de las últimas 3 semanas (cabe en memoria).
// Con "via" (la dirección de /api/precios-dane y la clave PRECIOS_CLAVE) la consulta pasa por el trabajador de Cloudflare.
export async function descargar({ fetchImpl = fetch, ahora = new Date(), dias = 21, via = "", clave = "" } = {}) {
  const desde = new Date(ahora.getTime() - dias * 864e5).toISOString().slice(0, 10);
  const headers = via ? { ...ENCABEZADOS_SIPSA, Authorization: "Bearer " + clave } : ENCABEZADOS_SIPSA;
  const r = await fetchImpl(via || SIPSA_URL, { method: "POST", headers, body: sobre() });
  if (!r.ok && r.status !== 500) throw new Error((via ? "Finti respondió " : "El DANE respondió ") + r.status);
  const guardados = []; let total = 0;
  const lector = lectorPorPartes((x) => { total++; const f = fechaDe(x.fechaIni || x.fechaMesIni); if (f && f >= desde) guardados.push(x); });
  const dec = new TextDecoder("utf-8");
  for await (const pedazo of r.body) lector.agregar(dec.decode(pedazo, { stream: true }));
  lector.agregar(dec.decode());
  const f = lector.falla(); if (f && !total) throw new Error("El DANE devolvió una falla: " + f);
  return { registros: guardados, total };
}

// ---------- Línea de comandos ----------
if (import.meta.url === "file://" + process.argv[1]) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ""; };
  const salida = arg("--salida") || "sipsa.json", xml = arg("--xml");
  let registros, total;
  if (xml) {
    registros = []; const l = lectorPorPartes((x) => registros.push(x)); l.agregar(fs.readFileSync(xml, "utf8")); total = registros.length;
  } else {
    const via = arg("--via");
    if (via && !process.env.CLAVE) { console.error("Con --via hace falta la variable CLAVE (PRECIOS_CLAVE)."); process.exit(1); }
    ({ registros, total } = await descargar({ via, clave: process.env.CLAVE || "" }));
  }
  const r = resumir(registros);
  if (!r || !resumenValido(r)) { console.error("No salió un resumen válido (" + total + " registros leídos)."); process.exit(1); }
  fs.writeFileSync(salida, JSON.stringify(r));
  console.log(`SIPSA: ${total} registros leídos, semana ${r.semana}, ${r.productos.length} productos, ${fs.statSync(salida).size} bytes.`);
}
