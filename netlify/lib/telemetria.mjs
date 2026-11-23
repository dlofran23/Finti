// Salud técnica sin datos personales.
// - Errores: cuando la app falla en el teléfono de alguien, llega el mensaje del error (sin números, correos ni
//   direcciones), la versión, el tipo de dispositivo y la pantalla. Se agrupan por huella y se cuentan por día.
// - Métricas: contadores por día de unos pocos eventos (abrir la app, registrar el primer movimiento, ver Premium…),
//   por tipo de dispositivo. No se guarda quién, ni la dirección IP, ni ningún identificador.
// La IP solo se usa unos minutos, en forma de huella, para frenar abusos (ver atomico.limitar).
import crypto from "node:crypto";
import { actualizar, limitar, Conflicto } from "./atomico.mjs";

export const EVENTOS = ["abrir", "inicio", "inicio_omitido", "registro", "aviso_auto", "conecto", "vio_premium", "inicio_pago", "asesor", "extracto", "pregunta", "guia", "guia_completa", "cuenta", "premium_aprobado", "regalo", "pin", "informe", "cobro", "negocio", "invita", "referido"];
const SOLO_SERVIDOR = ["cuenta", "premium_aprobado", "regalo", "invita", "referido"];
export const PLATAFORMAS = ["android-app", "android", "iphone", "pc", "servidor", "otro"];
const MAX_HUELLAS_DIA = 100;
const HORA = 3600_000, DIA = 24 * HORA;

// Día en hora de Colombia (UTC−5, sin horario de verano).
export const diaCol = (t) => new Date(t - 5 * HORA).toISOString().slice(0, 10);
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

// Quita lo que podría identificar a alguien: correos, números largos y lo que va después de ? o # en una dirección.
export function limpiarTexto(s, max) {
  return String(s == null ? "" : s)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "@")
    .replace(/(https?:\/\/[^\s)'"?#]+)[^\s)'"]*/g, "$1")
    .replace(/\d{3,}/g, "#")
    .replace(/\s+\n/g, "\n")
    .slice(0, max);
}

function plataforma(p) { return PLATAFORMAS.includes(p) ? p : "otro"; }

async function contar(store, clave, cambiar) {
  try { await actualizar(store, clave, cambiar); return true; }
  catch (e) { if (e && e.conflicto) return false; throw e; }   // mucha competencia: se pierde un conteo, no pasa nada
}

export async function registrarError({ store, limites, body, ip, ahora = Date.now() }) {
  if (!body || typeof body.m !== "string" || !body.m.trim()) return { status: 400, body: { ok: false } };
  if (limites && !(await limitar(limites, "err:" + (ip || "?"), 30, HORA, ahora))) return { status: 429, body: { ok: false } };
  const m = limpiarTexto(body.m, 300).trim(), s = limpiarTexto(body.s, 600), d = limpiarTexto(body.d, 120);
  const v = String(body.v || "").replace(/[^\w.\-]/g, "").slice(0, 20), p = plataforma(body.p), pant = String(body.t || "").replace(/[^\w\-]/g, "").slice(0, 20);
  // La huella usa el mensaje y la función donde ocurrió (sin direcciones ni números de línea), para agrupar el mismo error.
  const primera = (s.split("\n").find((x) => x.trim()) || d).replace(/\(.*?\)|https?:\/\/\S+|[:#\d]+/g, "").trim();
  const huella = sha(m + "|" + primera).slice(0, 12);
  await contar(store, "errores/" + diaCol(ahora), (x) => {
    x = x || {};
    let e = x[huella];
    if (!e) { if (Object.keys(x).length >= MAX_HUELLAS_DIA) return undefined; e = x[huella] = { m, s, d, v, n: 0, plat: {}, pant: {}, primera: ahora }; }
    e.n++; e.ultima = ahora; if (v) e.v = v;
    e.plat[p] = (e.plat[p] || 0) + 1;
    if (pant) e.pant[pant] = (e.pant[pant] || 0) + 1;
    return x;
  });
  return { status: 200, body: { ok: true } };
}

export async function registrarMetrica({ store, limites, body, ip, ahora = Date.now(), interno = false }) {
  const e = body && body.e;
  if (!EVENTOS.includes(e) || (!interno && SOLO_SERVIDOR.includes(e))) return { status: 400, body: { ok: false } };
  if (!interno && limites && !(await limitar(limites, "met:" + (ip || "?"), 60, HORA, ahora))) return { status: 429, body: { ok: false } };
  const p = interno ? "servidor" : plataforma(body.p);
  await contar(store, "metricas/" + diaCol(ahora), (x) => {
    x = x || {};
    x[e] = x[e] || {};
    x[e][p] = (x[e][p] || 0) + 1;
    return x;
  });
  return { status: 200, body: { ok: true } };
}

// Para el servidor (cuentas nuevas, pagos aprobados): nunca rompe el proceso que lo llama.
export async function contarEnServidor(store, e, ahora = Date.now()) {
  try { await registrarMetrica({ store, body: { e }, interno: true, ahora }); } catch (err) { console.warn("métrica no guardada:", e, err && err.message); }
}

// Panel: métricas de los últimos días y errores de la última semana. Requiere la clave del panel.
export function claveValida(env, dada) {
  const k = String((env && env.PANEL_CLAVE) || "");
  if (k.length < 16) return null;   // sin clave configurada (o muy corta): el panel no abre
  const a = Buffer.from(sha(k)), b = Buffer.from(sha(String(dada || "")));
  return crypto.timingSafeEqual(a, b);
}

export async function panel({ store, limites, env, autorizacion, ip, dias = 30, ahora = Date.now() }) {
  const ok = claveValida(env, String(autorizacion || "").replace(/^Bearer\s+/i, ""));
  if (ok === null) return { status: 503, body: { error: "Falta configurar PANEL_CLAVE (mínimo 16 caracteres) en las llaves del servidor." } };
  if (!ok) {
    if (limites) await limitar(limites, "panel:" + (ip || "?"), 10, HORA, ahora);
    return { status: 401, body: { error: "Clave incorrecta." } };
  }
  if (limites && !(await limitar(limites, "panel-ok:" + (ip || "?"), 120, HORA, ahora))) return { status: 429, body: { error: "Demasiadas consultas." } };
  const metricas = [], errores = {};
  for (let i = dias - 1; i >= 0; i--) {
    const d = diaCol(ahora - i * DIA);
    metricas.push({ dia: d, eventos: (await store.get("metricas/" + d, { type: "json" })) || {} });
    if (i < 7) {
      const x = (await store.get("errores/" + d, { type: "json" })) || {};
      for (const [h, e] of Object.entries(x)) {
        const t = errores[h] || (errores[h] = { m: e.m, s: e.s, d: e.d, v: e.v, n: 0, plat: {}, pant: {}, primera: e.primera, ultima: e.ultima });
        t.n += e.n; t.ultima = Math.max(t.ultima || 0, e.ultima || 0); t.primera = Math.min(t.primera || Infinity, e.primera || Infinity); t.v = e.v || t.v;
        for (const [k, n] of Object.entries(e.plat || {})) t.plat[k] = (t.plat[k] || 0) + n;
        for (const [k, n] of Object.entries(e.pant || {})) t.pant[k] = (t.pant[k] || 0) + n;
      }
    }
  }
  const lista = Object.entries(errores).map(([huella, e]) => ({ huella, ...e })).sort((a, b) => b.n - a.n).slice(0, 50);
  return { status: 200, body: { generado: new Date(ahora).toISOString(), metricas, errores: lista } };
}

// Errores que aparecieron por primera vez después de "desde" (para el aviso por correo).
export async function erroresNuevos(store, desde, ahora = Date.now()) {
  const out = [];
  for (const d of [diaCol(ahora - DIA), diaCol(ahora)]) {
    const x = (await store.get("errores/" + d, { type: "json" })) || {};
    for (const [huella, e] of Object.entries(x)) if ((e.primera || 0) > desde && !out.some((o) => o.huella === huella)) out.push({ huella, m: e.m, n: e.n, v: e.v });
  }
  return out.sort((a, b) => b.n - a.n);
}

export async function erroresHoy(store, ahora = Date.now()) {
  const x = (await store.get("errores/" + diaCol(ahora), { type: "json" })) || {};
  return Object.values(x).reduce((a, e) => a + (e.n || 0), 0);
}

// Limpieza: errores de más de 30 días y métricas de más de 400 días.
export async function limpiarTelemetria(store, ahora = Date.now()) {
  let borrados = 0;
  for (const [prefijo, dias] of [["errores/", 30], ["metricas/", 400]]) {
    const limite = diaCol(ahora - dias * DIA);
    const { blobs } = await store.list({ prefix: prefijo });
    for (const b of blobs) if (b.key.slice(prefijo.length) < limite) { await store.delete(b.key); borrados++; }
  }
  return borrados;
}

export { Conflicto };
