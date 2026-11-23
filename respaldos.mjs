// Herramienta de respaldos (se usa desde tu computador, no desde el sitio).
// Necesita estas variables de entorno:
//   NETLIFY_SITE_ID     ID del proyecto (Netlify: Project configuration > General > Project ID)
//   NETLIFY_AUTH_TOKEN  token personal (Netlify: User settings > Applications > Personal access tokens)
//   RESPALDO_SECRET     el mismo valor que en Netlify (o LICENSE_SECRET si no creaste RESPALDO_SECRET)
//
// Uso:
//   node herramientas/respaldos.mjs listar
//   node herramientas/respaldos.mjs descargar [AAAA-MM-DD]        guarda una copia fuera de Netlify
//   node herramientas/respaldos.mjs ver archivo.ftr               muestra qué contiene (sin mostrar datos)
//   node herramientas/respaldos.mjs restaurar archivo.ftr --confirmar [--solo cuentas-datos,pagos]
import fs from "node:fs";
import { getStore } from "@netlify/blobs";
import { desempacar, restaurar } from "../netlify/lib/respaldo.mjs";

const [cmd, arg, ...resto] = process.argv.slice(2);
const env = process.env, secreto = env.RESPALDO_SECRET || env.CUENTAS_SECRET || env.LICENSE_SECRET;
const abrir = (name) => {
  if (!env.NETLIFY_SITE_ID || !env.NETLIFY_AUTH_TOKEN) { console.error("Faltan NETLIFY_SITE_ID y NETLIFY_AUTH_TOKEN."); process.exit(1); }
  return getStore({ name, siteID: env.NETLIFY_SITE_ID, token: env.NETLIFY_AUTH_TOKEN, consistency: "strong" });
};

if (cmd === "listar") {
  const { blobs } = await abrir("respaldos").list();
  for (const b of blobs.sort((a, b) => a.key.localeCompare(b.key))) console.log(b.key);
} else if (cmd === "descargar") {
  const st = abrir("respaldos"), { blobs } = await st.list();
  const nombre = arg ? arg.replace(/\.ftr$/, "") + ".ftr" : blobs.map((b) => b.key).sort().pop();
  if (!nombre) { console.error("No hay respaldos todavía."); process.exit(1); }
  const buf = Buffer.from(await st.get(nombre, { type: "arrayBuffer" }));
  fs.writeFileSync(nombre, buf); console.log("Guardado", nombre, buf.length, "bytes");
} else if (cmd === "ver" || cmd === "restaurar") {
  if (!secreto) { console.error("Falta RESPALDO_SECRET (o LICENSE_SECRET)."); process.exit(1); }
  const foto = desempacar(fs.readFileSync(arg), secreto);
  console.log("Respaldo del", foto.fecha);
  for (const [n, d] of Object.entries(foto.almacenes)) console.log("  ", n.padEnd(18), Object.keys(d).length, "registros");
  if (cmd === "restaurar") {
    if (!resto.includes("--confirmar")) { console.log("\nPara restaurar de verdad agrega --confirmar. Esto sobrescribe los registros con los del respaldo."); process.exit(0); }
    const i = resto.indexOf("--solo"), solo = i > -1 ? resto[i + 1].split(",") : null;
    console.log("Restaurado:", await restaurar({ foto, abrir, soloAlmacenes: solo }));
  }
} else {
  console.log("Uso: listar | descargar [fecha] | ver archivo.ftr | restaurar archivo.ftr --confirmar [--solo almacen1,almacen2]");
}
