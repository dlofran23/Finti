// Respaldo cifrado de todos los datos de la app.
// Formato: gzip(JSON) cifrado con AES-256-GCM. Llave = HKDF(RESPALDO_SECRET o LICENSE_SECRET).
// Sin la llave, el archivo no sirve: se puede copiar fuera de Netlify sin exponer datos.
import crypto from "node:crypto";
import zlib from "node:zlib";
import { ALMACENES } from "./almacen.mjs";

export const DIAS_A_GUARDAR = 30;

export function secretoRespaldo(env) { return env.RESPALDO_SECRET || env.CUENTAS_SECRET || env.LICENSE_SECRET || ""; }
function llave(secreto) {
  if (!secreto) throw new Error("Falta RESPALDO_SECRET o LICENSE_SECRET");
  return Buffer.from(crypto.hkdfSync("sha256", Buffer.from(secreto), Buffer.from("fintelligente"), Buffer.from("respaldo-v1"), 32));
}
export function empacar(obj, secreto) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", llave(secreto), iv);
  const ct = Buffer.concat([c.update(zlib.gzipSync(Buffer.from(JSON.stringify(obj)))), c.final()]);
  return Buffer.concat([Buffer.from("FTR1"), iv, c.getAuthTag(), ct]);
}
export function desempacar(buf, secreto) {
  buf = Buffer.from(buf);
  if (buf.subarray(0, 4).toString() !== "FTR1") throw new Error("No es un respaldo de Finti");
  const iv = buf.subarray(4, 16), tag = buf.subarray(16, 32), d = crypto.createDecipheriv("aes-256-gcm", llave(secreto), iv);
  d.setAuthTag(tag);
  return JSON.parse(zlib.gunzipSync(Buffer.concat([d.update(buf.subarray(32)), d.final()])).toString());
}

async function todasLasClaves(store) {
  const claves = [];
  for await (const pag of store.list({ paginate: true })) for (const b of pag.blobs) claves.push(b.key);
  return claves;
}

// abrir(nombre) devuelve el almacén; destino es el almacén "respaldos".
export async function hacerRespaldo({ abrir, destino, secreto, ahora = new Date() }) {
  const foto = { v: 1, fecha: ahora.toISOString(), almacenes: {} }, conteo = {};
  for (const a of ALMACENES) {
    if (a.efimero) continue;                       // códigos, límites y avisos ya entregados no hacen falta
    const st = abrir(a.nombre), datos = {};
    for (const k of await todasLasClaves(st)) { const v = await st.get(k, { type: "text" }); if (v != null) datos[k] = v; }
    foto.almacenes[a.nombre] = datos; conteo[a.nombre] = Object.keys(datos).length;
  }
  const nombre = ahora.toISOString().slice(0, 10) + ".ftr";
  const bin = empacar(foto, secreto);
  await destino.set(nombre, bin, { metadata: { fecha: foto.fecha, conteo, bytes: bin.length } });
  // Conserva los últimos DIAS_A_GUARDAR
  const lista = (await todasLasClaves(destino)).filter((k) => /^\d{4}-\d{2}-\d{2}\.ftr$/.test(k)).sort();
  for (const viejo of lista.slice(0, Math.max(0, lista.length - DIAS_A_GUARDAR))) await destino.delete(viejo);
  return { nombre, conteo, bytes: bin.length };
}

export async function restaurar({ foto, abrir, soloAlmacenes }) {
  const hechos = {};
  for (const [nombre, datos] of Object.entries(foto.almacenes || {})) {
    if (soloAlmacenes && !soloAlmacenes.includes(nombre)) continue;
    const st = abrir(nombre);
    for (const [k, v] of Object.entries(datos)) await st.set(k, v);
    hechos[nombre] = Object.keys(datos).length;
  }
  return hechos;
}

export async function ultimoRespaldo(destino) {
  const lista = (await todasLasClaves(destino)).filter((k) => /^\d{4}-\d{2}-\d{2}\.ftr$/.test(k)).sort();
  return lista.length ? lista[lista.length - 1] : null;
}
