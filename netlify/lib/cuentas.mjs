// Cuentas de Finti: inicio con código por correo o con Google, sesiones por dispositivo
// y copia del presupuesto en la nube, cifrada en reposo. Sin dependencias de Netlify para poder probarla.
//
// deps = { stores: { usuarios, sesiones, codigos, datos, limites }, env, enviarCorreo, correoListo, jwks, ahora }
// Toda escritura que lee y luego guarda usa atomico.mjs (condicional con ETag) para no pisar cambios simultáneos.
import crypto from "node:crypto";
import { actualizar, leerConEtag, limitar as limitarEn } from "./atomico.mjs";
import { reservarCorreo } from "./cupo-correo.mjs";

const MIN = 60 * 1000, HORA = 60 * MIN, DIA = 24 * HORA;
export const MAX_DATOS = 1_500_000;          // caracteres del contenido guardado
const MAX_SESIONES = 20;

const sha = (t) => crypto.createHash("sha256").update(String(t), "utf8").digest("hex");
const b64u = (buf) => Buffer.from(buf).toString("base64url");
export const correoValido = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(String(e || "").trim());
const normCorreo = (e) => String(e || "").trim().toLowerCase();
export const idUsuario = (correo) => sha("u:" + normCorreo(correo)).slice(0, 32);
const r = (status, body) => ({ status, body });
const ahoraDe = (deps) => (deps.ahora ? deps.ahora() : Date.now());

function secreto(env) { return env.CUENTAS_SECRET || env.LICENSE_SECRET || ""; }

// ---------- Límites de uso (contra abuso) ----------
const limitar = (deps, clave, max, ventana) => limitarEn(deps.stores.limites, clave, max, ventana, ahoraDe(deps));

// ---------- Cifrado en reposo ----------
function llaveDatos(env) {
  return Buffer.from(crypto.hkdfSync("sha256", Buffer.from(secreto(env)), Buffer.from("fintelligente"), Buffer.from("datos-v1"), 32));
}
export function cifrar(env, texto) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", llaveDatos(env), iv);
  const ct = Buffer.concat([c.update(String(texto), "utf8"), c.final()]);
  return { v: 1, iv: b64u(iv), tag: b64u(c.getAuthTag()), c: b64u(ct) };
}
export function descifrar(env, o) {
  const d = crypto.createDecipheriv("aes-256-gcm", llaveDatos(env), Buffer.from(o.iv, "base64url"));
  d.setAuthTag(Buffer.from(o.tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(o.c, "base64url")), d.final()]).toString("utf8");
}

// ---------- Usuarios y sesiones ----------
export function publico(u) {
  const a = (u.consentimientos || []).at(-1) || null;
  return { id: u.id, correo: u.correo, nombre: u.nombre || "", foto: u.foto || "", google: !!u.google, creado: u.creado, licencia: u.licencia || null,
    acepto: a ? { v: a.v, edad: a.edad, t: a.t } : null };
}

// ---------- Autorización de datos y términos (Ley 1581) ----------
// Para CREAR una cuenta se exige la aceptación previa: versión de los documentos, rango de edad y, si es
// adolescente (14 a 17), la declaración de que su representante legal lo autorizó. Se guarda como prueba.
export function consentimientoValido(c) {
  if (!c || typeof c !== "object") return null;
  const v = String(c.v || "").replace(/[^0-9.]/g, "").slice(0, 10);
  if (!v || !["18+", "14-17"].includes(c.edad)) return null;
  if (c.edad === "14-17" && c.representante !== true) return null;
  return { v, edad: c.edad, representante: c.edad === "14-17" };
}
const sinConsentimiento = () => r(403, { error: "Para crear tu cuenta, confirma tu edad y acepta los términos y la política de datos.", necesitaConsentimiento: true });
async function faltaConsentimiento(deps, correo, cons) {
  if (cons) return false;
  return !(await deps.stores.usuarios.get(idUsuario(correo), { type: "json" }));   // solo las cuentas nuevas lo exigen aquí
}
function anotarConsentimiento(u, cons, t) {
  if (!cons) return;
  u.consentimientos = (u.consentimientos || []).concat({ ...cons, t }).slice(-10);
}
// Crea la sesión y la anota en el usuario (creándolo si es nuevo). La escritura del usuario es
// condicional: si dos dispositivos entran al mismo tiempo, ninguno borra la sesión del otro.
async function entrar(deps, correo, extra, dispositivo) {
  const id = idUsuario(correo), t = ahoraDe(deps);
  const token = "fs_" + b64u(crypto.randomBytes(32)), h = sha(token);
  await deps.stores.sesiones.setJSON(h, { uid: id, creado: t, ultimo: t, nombre: String(dispositivo || "Dispositivo").slice(0, 60) });
  let nuevo = false, viejas = [], rechazado = false;
  const cons = consentimientoValido(extra.consentimiento);
  const { valor: u } = await actualizar(deps.stores.usuarios, id, (u) => {
    nuevo = !u; viejas = []; rechazado = false;
    if (!u && !cons) { rechazado = true; return undefined; }
    if (!u) u = { id, correo: normCorreo(correo), nombre: "", creado: t, sesiones: [] };
    if (cons && (!u.consentimientos || !u.consentimientos.length || u.consentimientos.at(-1).v !== cons.v)) anotarConsentimiento(u, cons, t);
    if (extra.nombre && !u.nombre) u.nombre = String(extra.nombre).slice(0, 80);
    if (extra.foto) u.foto = String(extra.foto).slice(0, 400);
    if (extra.google) u.google = extra.google;
    u.sesiones = (u.sesiones || []).filter((x) => x !== h).concat(h);
    while (u.sesiones.length > MAX_SESIONES) viejas.push(u.sesiones.shift());
    return u;
  });
  if (rechazado) { await deps.stores.sesiones.delete(h); return sinConsentimiento(); }
  for (const v of viejas) await deps.stores.sesiones.delete(v);
  if (nuevo && deps.alCrearCuenta) { try { await deps.alCrearCuenta(); } catch { /* la métrica nunca impide entrar */ } }
  return r(200, { token, usuario: publico(u), nuevo });
}
export async function sesionDe(deps, autorizacion) {
  const m = /^Bearer\s+(fs_[A-Za-z0-9_-]{30,80})$/.exec(String(autorizacion || ""));
  if (!m) return null;
  const h = sha(m[1]), leido = await leerConEtag(deps.stores.sesiones, h);
  if (!leido) return null;
  const s = leido.data, u = await deps.stores.usuarios.get(s.uid, { type: "json" });
  // Una sesión que ya no está en la lista del usuario fue cerrada: no vale aunque quede el registro.
  if (!u || !(u.sesiones || []).includes(h)) { if (u) await deps.stores.sesiones.delete(h); return null; }
  const t = ahoraDe(deps);
  // Se anota la última actividad solo si nadie cerró la sesión entre medio (así no se revive una sesión cerrada).
  if (t - (s.ultimo || 0) > 10 * MIN) { s.ultimo = t; await deps.stores.sesiones.setJSON(h, s, leido.etag ? { onlyIfMatch: leido.etag } : {}); }
  return { h, s, u };
}

// ---------- Código por correo ----------
function htmlCodigo(codigo, sitio) {
  return `<div style="font-family:Arial,sans-serif;max-width:460px;margin:auto;padding:24px;color:#14121f">
  <p style="font-size:20px;font-weight:800;margin:0 0 6px"><span style="display:inline-block;width:26px;height:26px;border-radius:8px;background:#2e5bff;color:#fff;text-align:center;line-height:26px;font-size:16px;vertical-align:-4px;margin-right:8px">F</span>Finti</p>
  <p style="font-size:15px;color:#5b576b;margin:0 0 20px">Tu código para entrar y guardar tu presupuesto:</p>
  <p style="font-size:34px;font-weight:800;letter-spacing:8px;background:#eef2ff;color:#2e5bff;border-radius:14px;padding:16px;text-align:center;margin:0 0 20px">${codigo}</p>
  <p style="font-size:13px;color:#5b576b;margin:0">Vence en 10 minutos. Si no lo pediste, ignora este correo: nadie puede entrar sin este código.</p>
  ${sitio ? `<p style="font-size:12px;color:#8a8a84;margin:18px 0 0">${sitio}</p>` : ""}</div>`;
}
export async function pedirCodigo(deps, { correo, ip }) {
  if (!secreto(deps.env)) return r(503, { error: "Las cuentas aún no están activas en este sitio." });
  if (!deps.correoListo) return r(503, { error: "El inicio con correo aún no está activo. Usa Google por ahora." });
  if (!correoValido(correo)) return r(400, { error: "Escribe un correo válido." });
  const c = normCorreo(correo);
  if (!(await limitar(deps, "ip-codigo:" + (ip || "?"), 15, HORA))) return r(429, { error: "Demasiados intentos. Espera un rato y vuelve a intentarlo." });
  if (!(await limitar(deps, "correo-codigo:" + c, 5, HORA))) return r(429, { error: "Ya te enviamos varios códigos. Revisa tu correo (y la carpeta de spam) o espera unos minutos." });
  const cupo = await reservarCorreo(deps.stores.limites, deps.env, { ahora: ahoraDe(deps) });
  if (!cupo.ok) return r(429, { error: "Hoy ya enviamos muchos códigos por correo. Entra con Google, o vuelve a intentarlo mañana.", usarGoogle: true });
  const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await deps.stores.codigos.setJSON(sha("c:" + c), { h: sha(secreto(deps.env) + "|" + c + "|" + codigo), expira: ahoraDe(deps) + 10 * MIN, intentos: 0 });
  const ok = await deps.enviarCorreo({ to: c, subject: `${codigo} es tu código de Finti`, html: htmlCodigo(codigo, deps.env.SITE_URL || ""),
    text: `Tu código de Finti es ${codigo}. Vence en 10 minutos.` });
  if (!ok) return r(502, { error: "No pudimos enviar el correo ahora. Intenta de nuevo en un momento o entra con Google.", usarGoogle: !!deps.env.GOOGLE_CLIENT_ID });
  return r(200, { ok: true });
}
export async function verificarCodigo(deps, { correo, codigo, dispositivo, ip, consentimiento }) {
  if (!secreto(deps.env)) return r(503, { error: "Las cuentas aún no están activas en este sitio." });
  const c = normCorreo(correo), cod = String(codigo || "").replace(/\D/g, "");
  if (!correoValido(c) || cod.length !== 6) return r(400, { error: "Escribe los 6 números del código." });
  if (!(await limitar(deps, "ip-verificar:" + (ip || "?"), 40, HORA))) return r(429, { error: "Demasiados intentos. Espera un rato." });
  if (await faltaConsentimiento(deps, c, consentimientoValido(consentimiento))) return sinConsentimiento();   // antes de gastar el código
  // El intento se cuenta ANTES de comparar y con escritura condicional: cien intentos al mismo tiempo
  // no pueden saltarse el máximo de 5 por código.
  const k = sha("c:" + c);
  let estado = "";
  const { valor: reg } = await actualizar(deps.stores.codigos, k, (reg) => {
    if (!reg || reg.expira < ahoraDe(deps)) { estado = "vencido"; return undefined; }
    if (reg.intentos >= 5) { estado = "agotado"; return null; }
    estado = "ok"; reg.intentos = (reg.intentos || 0) + 1; return reg;
  });
  if (estado === "vencido") return r(400, { error: "El código venció. Pide uno nuevo." });
  if (estado === "agotado") return r(429, { error: "Demasiados intentos con ese código. Pide uno nuevo." });
  const esperado = Buffer.from(reg.h), dado = Buffer.from(sha(secreto(deps.env) + "|" + c + "|" + cod));
  if (!crypto.timingSafeEqual(esperado, dado)) return r(400, { error: "Ese código no coincide. Revísalo e intenta de nuevo." });
  await deps.stores.codigos.delete(k);
  return entrar(deps, c, { consentimiento }, dispositivo);
}

// ---------- Google ----------
let cacheJwks = { t: 0, keys: [] };
async function llavesGoogle(deps, kid) {
  if (deps.jwks) return deps.jwks;
  const fresca = Date.now() - cacheJwks.t < 6 * HORA && cacheJwks.keys.length;
  // Google rota sus llaves: si llega una que no conocemos, se vuelven a pedir (máximo una vez por minuto).
  const desconocida = kid && !cacheJwks.keys.some((k) => k.kid === kid) && Date.now() - cacheJwks.t > MIN;
  if (fresca && !desconocida) return cacheJwks.keys;
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  const j = await res.json();
  cacheJwks = { t: Date.now(), keys: j.keys || [] };
  return cacheJwks.keys;
}
export async function verificarTokenGoogle(deps, credencial) {
  const partes = String(credencial || "").split(".");
  if (partes.length !== 3) return null;
  let cab, datos;
  try { cab = JSON.parse(Buffer.from(partes[0], "base64url").toString()); datos = JSON.parse(Buffer.from(partes[1], "base64url").toString()); } catch { return null; }
  if (cab.alg !== "RS256" || !cab.kid) return null;
  const jwk = (await llavesGoogle(deps, cab.kid)).find((k) => k.kid === cab.kid);
  if (!jwk) return null;
  const valida = crypto.verify("RSA-SHA256", Buffer.from(partes[0] + "." + partes[1]), crypto.createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(partes[2], "base64url"));
  if (!valida) return null;
  const t = ahoraDe(deps) / 1000;
  if (datos.aud !== deps.env.GOOGLE_CLIENT_ID) return null;
  if (datos.iss !== "accounts.google.com" && datos.iss !== "https://accounts.google.com") return null;
  if (!(datos.exp > t - 60) || (datos.iat && datos.iat > t + 300)) return null;
  if (!datos.email || datos.email_verified !== true && datos.email_verified !== "true") return null;
  return datos;
}
export async function entrarConGoogle(deps, { credencial, dispositivo, ip, consentimiento }) {
  if (!secreto(deps.env)) return r(503, { error: "Las cuentas aún no están activas en este sitio." });
  if (!deps.env.GOOGLE_CLIENT_ID) return r(503, { error: "El inicio con Google aún no está activo." });
  if (!(await limitar(deps, "ip-google:" + (ip || "?"), 40, HORA))) return r(429, { error: "Demasiados intentos. Espera un rato." });
  let d = null;
  try { d = await verificarTokenGoogle(deps, credencial); } catch { d = null; }
  if (!d) return r(401, { error: "No pudimos confirmar tu cuenta de Google. Intenta de nuevo." });
  return entrar(deps, d.email, { nombre: d.name || d.given_name || "", foto: d.picture || "", google: String(d.sub), consentimiento }, dispositivo);
}


// Entrada con Google por redirección (iPhone con la app en la pantalla de inicio, donde la ventana emergente
// de Google no puede volver a la app). Google envía el formulario a /api/cuenta/google-redirect con
// "credential" y "g_csrf_token"; la misma marca llega en una cookie y deben coincidir (protección CSRF).
// La sesión no viaja en la dirección: se entrega un código de un solo uso que la app canjea por la sesión.
// consentimiento: llega en una cookie que la app deja justo antes de ir a Google.
export async function entrarConGoogleRedireccion(deps, { credencial, csrfCuerpo, csrfCookie, dispositivo, ip, consentimiento }) {
  const volver = (frag) => ({ status: 303, location: "/#" + frag });
  if (!csrfCuerpo || !csrfCookie || csrfCuerpo !== csrfCookie) return volver("entrar-error=csrf");
  const x = await entrarConGoogle(deps, { credencial, dispositivo, ip, consentimiento });
  if (x.status !== 200) return volver("entrar-error=" + (x.status === 429 ? "limite" : x.status === 403 ? "consentimiento" : "google"));
  const canje = b64u(crypto.randomBytes(24));
  await deps.stores.codigos.setJSON("canje:" + sha(canje), { ...x.body, expira: ahoraDe(deps) + 2 * MIN });
  return volver("entrar=" + canje);
}
export async function canjear(deps, { codigo }) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(String(codigo || ""))) return r(400, { error: "Código de entrada inválido." });
  let reg = null;
  await actualizar(deps.stores.codigos, "canje:" + sha(codigo), (x) => { reg = x; return x ? null : undefined; });   // se borra al usarlo
  if (!reg || reg.expira < ahoraDe(deps)) return r(400, { error: "Ese enlace para entrar ya se usó o venció. Vuelve a tocar Continuar con Google." });
  return r(200, { token: reg.token, usuario: reg.usuario, nuevo: reg.nuevo });
}

// La persona acepta (o vuelve a aceptar) los documentos legales desde la app ya con su sesión.
export async function aceptarTerminos(deps, ses, body) {
  const cons = consentimientoValido(body);
  if (!cons) return r(400, { error: "Confirma tu edad y acepta los términos y la política de datos." });
  const { valor } = await actualizar(deps.stores.usuarios, ses.u.id, (u) => { if (!u) return undefined; anotarConsentimiento(u, cons, ahoraDe(deps)); return u; });
  return r(200, { ok: true, usuario: publico(valor || ses.u) });
}
// Cookie que deja la app antes del inicio con Google por redirección: "version~edad~representante".
export function consentimientoDeCookie(texto) {
  const m = /(?:^|;\s*)ft_acepto=([0-9.]{1,10})~(18|14)~([01])/.exec(String(texto || ""));
  return m ? { v: m[1], edad: m[2] === "18" ? "18+" : "14-17", representante: m[3] === "1" } : null;
}

// ---------- Cuenta ----------
export async function verCuenta(deps, ses) {
  const disp = [];
  for (const h of ses.u.sesiones || []) {
    const s = await deps.stores.sesiones.get(h, { type: "json" });
    if (s) disp.push({ id: h.slice(0, 12), nombre: s.nombre, ultimo: s.ultimo, creado: s.creado, actual: h === ses.h });
  }
  const d = await deps.stores.datos.get(ses.u.id, { type: "json" });
  return r(200, { usuario: publico(ses.u), dispositivos: disp.sort((a, b) => b.ultimo - a.ultimo),
    datos: d ? { version: d.version, actualizado: d.actualizado, dispositivo: d.dispositivo, e2e: !!d.e2e, tamano: d.tamano } : null });
}
export async function salir(deps, ses, { dispositivo } = {}) {
  const objetivo = dispositivo ? (ses.u.sesiones || []).find((h) => h.slice(0, 12) === String(dispositivo)) : ses.h;
  if (!objetivo) return r(404, { error: "Ese dispositivo ya no está conectado." });
  await actualizar(deps.stores.usuarios, ses.u.id, (u) => {
    if (!u) return undefined;
    u.sesiones = (u.sesiones || []).filter((h) => h !== objetivo);
    return u;
  });
  await deps.stores.sesiones.delete(objetivo);
  return r(200, { ok: true });
}
export async function borrarCuenta(deps, ses, { confirmar } = {}) {
  if (confirmar !== "BORRAR") return r(400, { error: "Confirma el borrado." });
  for (const h of ses.u.sesiones || []) await deps.stores.sesiones.delete(h);
  await deps.stores.datos.delete(ses.u.id);
  await deps.stores.usuarios.delete(ses.u.id);
  return r(200, { ok: true });
}
export async function guardarLicenciaCuenta(deps, ses, { ref, token }, validar) {
  if (!/^PRE-[A-Z2-9]{12}$/.test(String(ref || "")) || !token || !validar(ref, token)) return r(400, { error: "Esa licencia no es válida." });
  await actualizar(deps.stores.usuarios, ses.u.id, (u) => { if (!u) return undefined; u.licencia = { ref, token }; return u; });
  return r(200, { ok: true });
}

// ---------- Datos en la nube ----------
export async function leerDatos(deps, ses, { meta } = {}) {
  const d = await deps.stores.datos.get(ses.u.id, { type: "json" });
  if (!d) return r(200, { version: 0 });
  const base = { version: d.version, actualizado: d.actualizado, dispositivo: d.dispositivo, e2e: !!d.e2e, tamano: d.tamano };
  if (meta) return r(200, base);
  try { return r(200, { ...base, contenido: descifrar(deps.env, d.contenido) }); }
  catch { return r(500, { error: "No pudimos abrir la copia de tu cuenta. Tus datos de este dispositivo siguen intactos." }); }
}
export async function guardarDatos(deps, ses, { base, contenido, e2e, dispositivo }) {
  if (typeof contenido !== "string" || !contenido) return r(400, { error: "No hay datos para guardar." });
  if (contenido.length > MAX_DATOS) return r(413, { error: "Tu presupuesto es demasiado grande para la nube. Borra meses antiguos." });
  if (!(await limitar(deps, "datos:" + ses.u.id, 240, HORA))) return r(429, { error: "Demasiadas copias seguidas. Se intentará de nuevo en unos minutos." });
  // Escritura condicional: si otro dispositivo guardó entre medio, esta copia no lo pisa (responde 409).
  const cifrado = cifrar(deps.env, contenido), t = ahoraDe(deps);
  let choque = null;
  const { escrito, valor } = await actualizar(deps.stores.datos, ses.u.id, (actual) => {
    const v = actual ? actual.version : 0;
    if (Number(base) !== v) { choque = { version: v, actualizado: actual && actual.actualizado, dispositivo: actual && actual.dispositivo }; return undefined; }
    choque = null;
    return { version: v + 1, actualizado: t, dispositivo: String(dispositivo || "").slice(0, 60), e2e: !!e2e, tamano: contenido.length, contenido: cifrado };
  });
  if (!escrito) return r(409, { error: "Hay una versión más nueva en tu cuenta.", ...choque });
  return r(200, { version: valor.version, actualizado: valor.actualizado });
}
