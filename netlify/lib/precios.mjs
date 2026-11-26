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

// Servicio web del DANE (SIPSA) y la única consulta que hace Finti.
export const SIPSA_URL = "https://appweb.dane.gov.co/sipsaWS/SrvSipsaUpraBeanService";
export const OPERACION = "promediosSipsaSemanaMadr";   // promedios semanales por central mayorista, unos 350 productos
export function sobre(op = OPERACION) {
  return '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap-env:Envelope xmlns:soap-env="http://www.w3.org/2003/05/soap-envelope" xmlns:ns0="http://servicios.sipsa.co.gov.dane/">' +
    "<soap-env:Body><ns0:" + op + "/></soap-env:Body></soap-env:Envelope>";
}
export const ENCABEZADOS_SIPSA = { "Content-Type": "application/soap+xml; charset=utf-8", "User-Agent": "Finti/1.0 (precios de referencia)" };

// null si la clave es correcta; si no, la respuesta de error.
function revisarClave(env, autorizacion) {
  const clave = String((env && env.PRECIOS_CLAVE) || "");
  if (clave.length < 16) return { status: 503, body: { error: "Falta configurar PRECIOS_CLAVE (mínimo 16 caracteres) en las llaves del servidor." } };
  if (!igual(String(autorizacion || "").replace(/^Bearer\s+/i, ""), clave)) return { status: 401, body: { error: "Clave incorrecta." } };
  return null;
}

// El DANE corta las conexiones que llegan desde GitHub Actions. Esta prueba dice si el trabajador de Cloudflare sí
// llega. Es pública pero no lleva nada de nadie, y guarda el resultado 10 minutos para no llamar al DANE en cada visita.
const DIEZ_MIN = 10 * 60 * 1000;
export async function probarDane({ store, fetchImpl = fetch, ahora = Date.now() }) {
  const previo = await store.get("dane-prueba", { type: "json" });
  if (previo && ahora - previo.t < DIEZ_MIN) return previo;
  const t0 = Date.now();
  let r;
  try {
    const resp = await fetchImpl(SIPSA_URL + "?wsdl", { headers: { "User-Agent": ENCABEZADOS_SIPSA["User-Agent"] }, signal: AbortSignal.timeout(20000) });
    r = { alcanza: true, estado: resp.status };
    try { if (resp.body && resp.body.cancel) await resp.body.cancel(); } catch {}
  } catch (e) {
    const causa = (e && e.cause && (e.cause.code || e.cause.message)) || (e && e.message) || String(e);
    r = { alcanza: false, error: String(causa).slice(0, 200) };
  }
  r.ms = Date.now() - t0; r.t = ahora; r.revisado = new Date(ahora).toISOString();
  await store.setJSON("dane-prueba", r);
  return r;
}

// Puente para GitHub Actions: con PRECIOS_CLAVE, el trabajador hace la consulta fija de SIPSA y devuelve la respuesta
// tal cual, por partes. No la lee (no gasta CPU) y no acepta otra dirección ni otro cuerpo: no es un proxy abierto.
export async function puenteDane({ env, autorizacion, fetchImpl = fetch }) {
  const mal = revisarClave(env, autorizacion);
  if (mal) return mal;
  let resp;
  try { resp = await fetchImpl(SIPSA_URL, { method: "POST", headers: ENCABEZADOS_SIPSA, body: sobre() }); }
  catch (e) { return { status: 502, body: { error: "El DANE no respondió: " + String((e && e.cause && e.cause.code) || (e && e.message) || e).slice(0, 200) } }; }
  return { respuesta: new Response(resp.body, { status: resp.status, headers: { "Content-Type": resp.headers.get("content-type") || "application/soap+xml", "Cache-Control": "no-store" } }) };
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
