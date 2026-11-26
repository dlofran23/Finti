// Precios de referencia del DANE (SIPSA): GitHub Actions los descarga una vez al día y los manda aquí
// (POST con la clave PRECIOS_CLAVE, que solo existe en los secretos del trabajador de Cloudflare y de GitHub). La app los
// pide con GET: es una tabla pública, igual para todos, y la petición no lleva nada de la persona.
import crypto from "node:crypto";

// Revisa que un resumen tenga la forma esperada (lo usan /api/precios y herramientas/sipsa.mjs).
export function resumenValido(d) {
  if (!d || typeof d !== "object" || !/^\d{4}-\d{2}-\d{2}$/.test(d.semana || "") || !Array.isArray(d.productos)) return false;
  if (d.productos.length < 1 || d.productos.length > 2000) return false;
  return d.productos.every((p) => p && typeof p.n === "string" && p.n.length <= 120 && Number.isFinite(p.g) && p.g > 0 && Array.isArray(p.b) && p.c && typeof p.c === "object");
}

const MAX = 3_000_000;
const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

// null si la clave PRECIOS_CLAVE es correcta; si no, la respuesta de error (la usan también los precios de las cadenas)
export function revisarClave(env, autorizacion) {
  const clave = String((env && env.PRECIOS_CLAVE) || "");
  if (clave.length < 16) return { status: 503, body: { error: "Falta configurar PRECIOS_CLAVE (mínimo 16 caracteres) en las llaves del servidor." } };
  if (!igual(String(autorizacion || "").replace(/^Bearer\s+/i, ""), clave)) return { status: 401, body: { error: "Clave incorrecta." } };
  return null;
}

export async function leerPrecios(store) {
  const d = await store.get("sipsa", { type: "json" });
  if (!d) return { status: 404, body: { error: "Todavía no hay precios del DANE." } };
  return { status: 200, body: d };
}

export async function guardarPrecios({ store, env, autorizacion, texto }) {
  const mal = revisarClave(env, autorizacion);
  if (mal) return mal;
  if (!texto || texto.length > MAX) return { status: 413, body: { error: "El resumen es demasiado grande." } };
  let d; try { d = JSON.parse(texto); } catch { return { status: 400, body: { error: "No es JSON." } }; }
  if (!resumenValido(d)) return { status: 400, body: { error: "El resumen no tiene la forma esperada." } };
  const previo = await store.get("sipsa", { type: "json" });
  if (previo && previo.semana > d.semana) return { status: 409, body: { error: "Ya hay una semana más reciente." } };
  await store.setJSON("sipsa", { ...d, recibido: new Date().toISOString() });
  return { status: 200, body: { ok: true, semana: d.semana, productos: d.productos.length } };
}
