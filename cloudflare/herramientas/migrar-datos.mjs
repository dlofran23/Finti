// Copia los datos de Netlify Blobs al nuevo Finti en Cloudflare (D1), una sola vez, durante la mudanza.
// Lee cada almacén de producción con la API de Netlify y lo manda por lotes a /api/migrar del trabajador nuevo.
// No borra nada en Netlify. Se puede correr dos veces: la segunda vuelve a copiar encima (útil justo antes del cambio).
//
// Variables (en GitHub Actions van como secretos; ver .github/workflows/migrar-a-cloudflare.yml):
//   NETLIFY_SITE_ID   Netlify → Site configuration → Site details → Site ID
//   NETLIFY_TOKEN     Netlify → User settings → Applications → Personal access tokens
//   DESTINO           https://finti.<tu-subdominio>.workers.dev (o tu dominio)
//   MIGRAR_CLAVE      la misma que cargaste en Cloudflare como secreto
import { getStore } from "@netlify/blobs";
import { ALMACENES } from "../../netlify/lib/almacen.mjs";

const { NETLIFY_SITE_ID: siteID, NETLIFY_TOKEN: token, MIGRAR_CLAVE: clave } = process.env;
const DESTINO = String(process.env.DESTINO || "").replace(/\/$/, "");
if (!siteID || !token || !clave || !/^(https:\/\/|http:\/\/127\.0\.0\.1:)/.test(DESTINO)) { console.error("Faltan NETLIFY_SITE_ID, NETLIFY_TOKEN, MIGRAR_CLAVE o DESTINO (https://...)."); process.exit(1); }

const dec = new TextDecoder("utf-8", { fatal: true });
async function mandar(tienda, items) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(DESTINO + "/api/migrar", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + clave }, body: JSON.stringify({ tienda, items }) });
    if (r.ok) return (await r.json()).guardados;
    if (r.status === 401 || r.status === 404) throw new Error("El destino no acepta la migración (" + r.status + "): revisa MIGRAR_CLAVE en Cloudflare.");
    await new Promise((x) => setTimeout(x, 1500 * (i + 1)));
  }
  throw new Error("No se pudo mandar un lote de " + tienda);
}

const resumen = {};
for (const { nombre } of ALMACENES) {
  const s = getStore({ name: nombre, siteID, token, consistency: "strong" });
  let lote = [], total = 0, bytes = 0;
  for await (const pag of s.list({ paginate: true })) for (const { key } of pag.blobs) {
    const x = await s.getWithMetadata(key, { type: "arrayBuffer" }); if (!x) continue;
    const u8 = new Uint8Array(x.data); bytes += u8.length;
    let valor, tipo = "t";
    try { valor = dec.decode(u8); } catch { valor = Buffer.from(u8).toString("base64"); tipo = "b"; }
    lote.push({ clave: key, valor, tipo, meta: x.metadata || {} });
    if (lote.length >= 40 || bytes > 4_000_000) { total += await mandar(nombre, lote); lote = []; bytes = 0; }
  }
  if (lote.length) total += await mandar(nombre, lote);
  resumen[nombre] = total; console.log(nombre.padEnd(20) + total + " registros");
}
const r = await fetch(DESTINO + "/api/migrar", { headers: { Authorization: "Bearer " + clave } }), j = await r.json();
let bien = true;
for (const [t, n] of Object.entries(resumen)) { const m = (j.conteo || {})[t] || 0; if (m < n) { bien = false; console.log("OJO: " + t + " tiene " + m + " en Cloudflare y " + n + " en Netlify"); } }
console.log(bien ? "\nListo: todo quedó copiado en Cloudflare." : "\nRevisa los almacenes marcados con OJO y vuelve a correr la migración.");
process.exit(bien ? 0 : 1);
