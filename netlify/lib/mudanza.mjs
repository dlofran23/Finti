// Mudanza a una dirección nueva (por ejemplo, cuando la app pase de fintelligentx.netlify.app a un dominio propio).
// Cada navegador guarda sus datos por dirección: la dirección nueva no ve lo que quedó en la vieja. Para pasarlos:
//  1) La app en la dirección vieja cifra sus datos con una llave al azar (AES-256-GCM) EN EL NAVEGADOR.
//  2) Sube solo el paquete cifrado aquí y recibe un número de mudanza.
//  3) Abre la dirección nueva con el número y la llave en la parte de la dirección que va después de #,
//     que el navegador nunca envía al servidor. El servidor jamás ve la llave ni los datos.
//  4) La dirección nueva recoge el paquete (una sola vez: se borra al leerlo) y lo abre con la llave.
// Los paquetes vencen a los 30 minutos; los que nadie recoge se borran en la limpieza diaria.
import crypto from "node:crypto";
import { crearSiNoExiste } from "./atomico.mjs";

export const MAX_PAQUETE = 3_000_000, VIGENCIA = 30 * 60 * 1000;
const idValido = (id) => /^[A-Za-z0-9_-]{22}$/.test(String(id || ""));

export async function guardarMudanza({ store, body, ahora = Date.now() }) {
  const p = body && body.paquete;
  if (typeof p !== "string" || !/^[A-Za-z0-9_-]{40,}$/.test(p)) return { status: 400, body: { error: "Paquete inválido." } };
  if (p.length > MAX_PAQUETE) return { status: 413, body: { error: "Tus datos son demasiado grandes para mudarlos así. Usa Exportar respaldo." } };
  for (let i = 0; i < 3; i++) {
    const id = crypto.randomBytes(16).toString("base64url");
    if (await crearSiNoExiste(store, id, { p, expira: ahora + VIGENCIA })) return { status: 200, body: { id } };
  }
  return { status: 503, body: { error: "Intenta de nuevo." } };
}

export async function recogerMudanza({ store, id, ahora = Date.now() }) {
  if (!idValido(id)) return { status: 400, body: { error: "Número de mudanza inválido." } };
  const reg = await store.get(id, { type: "json" });
  if (!reg) return { status: 404, body: { error: "Esta mudanza ya se usó o no existe." } };
  await store.delete(id);                     // una sola vez
  if (reg.expira < ahora) return { status: 410, body: { error: "La mudanza venció. Vuelve a abrir la dirección anterior." } };
  return { status: 200, body: { paquete: reg.p } };
}

export async function limpiarMudanzas(store, ahora = Date.now()) {
  const { blobs } = await store.list();
  let n = 0;
  for (const { key } of blobs) {
    const reg = await store.get(key, { type: "json" });
    if (!reg || reg.expira < ahora) { await store.delete(key); n++; }
  }
  return n;
}

// La dirección a la que se muda la app, si ya se configuró (variable DIRECCION_NUEVA en Netlify).
export function direccionNueva(env) {
  try {
    const u = new URL(String(env.DIRECCION_NUEVA || ""));
    return u.protocol === "https:" && !u.username && !u.password ? u.origin : "";
  } catch { return ""; }
}
