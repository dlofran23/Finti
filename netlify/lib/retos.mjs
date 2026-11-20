// Retos con amigos.
// - Quien crea un reto elige uno de una lista fija (sin texto libre) y un apodo. Recibe el código RETO-XXXXXX
//   para compartir y una llave propia (token) que solo guarda su app.
// - Cada participante solo marca "hoy cumplí". El servidor guarda apodos, la fecha de inicio y los días marcados:
//   nunca montos, correos ni nada del presupuesto.
// - Máximo 12 participantes. El reto se borra solo 30 días después de terminar (ver limpiarRetos).
import crypto from "node:crypto";
import { actualizar, crearSiNoExiste, limitar } from "./atomico.mjs";

export const TIPOS = { domicilios: 7, anotar: 14, antojos: 7, cafe: 10 };
export const MAX_GENTE = 12, DIAS_BORRAR = 30;
const HORA = 3600 * 1000, DIA = 864e5;
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const sha = (t) => crypto.createHash("sha256").update(String(t)).digest("base64url");
const azar = (n) => { let s = ""; for (const x of crypto.randomBytes(n)) s += ALFABETO[x % ALFABETO.length]; return s; };
const err = (status, error) => ({ status, body: { error } });

export function normalizarReto(c) {
  let s = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.startsWith("RETO")) s = s.slice(4);
  return /^[A-HJ-NP-Z2-9]{6}$/.test(s) ? "RETO-" + s : "";
}
export function limpiarApodo(a) {
  const s = String(a || "").normalize("NFC").replace(/[^\p{L}\p{N} ._-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 20);
  return s.length >= 2 ? s : "";
}
const diaUTC = (f) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));
const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f || "") && !isNaN(diaUTC(f));
// La fecha que manda la app (su día local) solo vale si está a un día o menos de la del servidor.
function hoyValido(hoy, ahora) {
  if (!esFecha(hoy)) return "";
  return Math.abs(diaUTC(hoy) - Date.UTC(new Date(ahora).getUTCFullYear(), new Date(ahora).getUTCMonth(), new Date(ahora).getUTCDate())) <= DIA ? hoy : "";
}
function vista(r, pid, hoy) {
  const ini = diaUTC(r.inicio), d = hoy ? Math.floor((diaUTC(hoy) - ini) / DIA) : 0;
  return {
    tipo: r.tipo, dias: r.dias, inicio: r.inicio,
    estado: d < 0 ? "antes" : d >= r.dias ? "fin" : "activo",
    participantes: r.gente.map((p) => ({ apodo: p.apodo, cumplidos: p.marcas.length, hoy: !!hoy && p.marcas.includes(hoy), yo: p.id === pid })),
  };
}
function participante(r, pid, token) {
  const p = r && r.gente.find((x) => x.id === pid);
  if (!p) return null;
  const a = Buffer.from(p.th), b = Buffer.from(sha(token || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? p : null;
}

export async function crearReto({ store, limites, ip, tipo, apodo, hoy, ahora = Date.now() }) {
  if (!TIPOS[tipo]) return err(400, "Ese reto no existe.");
  const ap = limpiarApodo(apodo); if (!ap) return err(400, "Escribe un apodo de al menos 2 letras.");
  const h = hoyValido(hoy, ahora); if (!h) return err(400, "Revisa la fecha de tu celular.");
  if (limites && !(await limitar(limites, "reto:" + (ip || "?"), 10, HORA, ahora))) return err(429, "Creaste muchos retos seguidos. Espera una hora.");
  const pid = azar(8), token = crypto.randomBytes(24).toString("base64url");
  for (let i = 0; i < 5; i++) {
    const codigo = "RETO-" + azar(6);
    const reg = { tipo, dias: TIPOS[tipo], inicio: h, creado: new Date(ahora).toISOString(), gente: [{ id: pid, apodo: ap, th: sha(token), marcas: [] }] };
    if (await crearSiNoExiste(store, "r/" + codigo, reg)) return { status: 200, body: { codigo, pid, token, ...vista(reg, pid, h) } };
  }
  return err(503, "No pudimos crear el reto. Intenta de nuevo.");
}

export async function unirseReto({ store, limites, ip, codigo, apodo, hoy, ahora = Date.now() }) {
  const c = normalizarReto(codigo); if (!c) return err(400, "El código tiene la forma RETO-ABC234.");
  const ap = limpiarApodo(apodo); if (!ap) return err(400, "Escribe un apodo de al menos 2 letras.");
  const h = hoyValido(hoy, ahora); if (!h) return err(400, "Revisa la fecha de tu celular.");
  if (limites && !(await limitar(limites, "reto-unirse:" + (ip || "?"), 20, HORA, ahora))) return err(429, "Muchos intentos seguidos. Espera una hora.");
  const pid = azar(8), token = crypto.randomBytes(24).toString("base64url");
  let res = err(404, "Ese reto no existe o ya terminó hace tiempo.");
  try {
    await actualizar(store, "r/" + c, (r) => {
      if (!r) return undefined;
      if (Math.floor((diaUTC(h) - diaUTC(r.inicio)) / DIA) >= r.dias) { res = err(409, "Ese reto ya terminó."); return undefined; }
      if (r.gente.length >= MAX_GENTE) { res = err(409, "Ese reto ya está lleno (máximo " + MAX_GENTE + " personas)."); return undefined; }
      const apodoFinal = r.gente.some((p) => p.apodo.toLowerCase() === ap.toLowerCase()) ? (ap.slice(0, 17) + " " + (r.gente.length + 1)) : ap;
      r.gente.push({ id: pid, apodo: apodoFinal, th: sha(token), marcas: [] });
      res = { status: 200, body: { codigo: c, pid, token, ...vista(r, pid, h) } };
      return r;
    });
  } catch (e) { if (e && e.conflicto) return err(503, "Hay mucha gente uniéndose. Intenta en un momento."); throw e; }
  return res;
}

export async function marcarReto({ store, codigo, pid, token, hoy, ahora = Date.now() }) {
  const c = normalizarReto(codigo), h = hoyValido(hoy, ahora);
  if (!c || !h) return err(400, "Datos incompletos.");
  let res = err(404, "Ese reto no existe o ya terminó hace tiempo.");
  try {
    await actualizar(store, "r/" + c, (r) => {
      if (!r) return undefined;
      const p = participante(r, pid, token); if (!p) { res = err(403, "No pudimos verificar que estás en este reto."); return undefined; }
      const d = Math.floor((diaUTC(h) - diaUTC(r.inicio)) / DIA);
      if (d < 0 || d >= r.dias) { res = err(409, d < 0 ? "El reto todavía no empieza." : "El reto ya terminó."); return undefined; }
      if (!p.marcas.includes(h)) p.marcas.push(h);
      p.marcas = p.marcas.slice(-r.dias);
      res = { status: 200, body: vista(r, pid, h) };
      return r;
    });
  } catch (e) { if (e && e.conflicto) return err(503, "Intenta de nuevo en un momento."); throw e; }
  return res;
}

export async function verReto({ store, codigo, pid, token, hoy, ahora = Date.now() }) {
  const c = normalizarReto(codigo); if (!c) return err(400, "Datos incompletos.");
  const r = await store.get("r/" + c, { type: "json" });
  if (!r) return err(404, "Ese reto no existe o ya terminó hace tiempo.");
  if (!participante(r, pid, token)) return err(403, "No pudimos verificar que estás en este reto.");
  return { status: 200, body: vista(r, pid, hoyValido(hoy, ahora)) };
}

export async function salirReto({ store, codigo, pid, token }) {
  const c = normalizarReto(codigo); if (!c) return err(400, "Datos incompletos.");
  let res = { status: 200, body: { ok: true } };
  try {
    await actualizar(store, "r/" + c, (r) => {
      if (!r) return undefined;
      if (!participante(r, pid, token)) { res = err(403, "No pudimos verificar que estás en este reto."); return undefined; }
      r.gente = r.gente.filter((p) => p.id !== pid);
      return r;
    });
  } catch (e) { if (e && e.conflicto) return err(503, "Intenta de nuevo en un momento."); throw e; }
  return res;
}

// Borra los retos que terminaron hace más de DIAS_BORRAR días y los que se quedaron sin gente.
export async function limpiarRetos({ store, ahora = Date.now() }) {
  let n = 0;
  const { blobs } = await store.list({ prefix: "r/" });
  for (const b of blobs) {
    const r = await store.get(b.key, { type: "json" });
    if (!r || !r.gente.length || ahora - (diaUTC(r.inicio) + r.dias * DIA) > DIAS_BORRAR * DIA) { await store.delete(b.key); n++; }
  }
  return n;
}
