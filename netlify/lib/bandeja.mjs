// Buzón cifrado: recibe avisos de bancos (correo, Atajos de iPhone, Android) y los guarda cifrados
// con la llave pública del celular de la persona. El servidor nunca guarda el texto en claro.
import crypto from "node:crypto";
import { actualizar, crearSiNoExiste } from "./atomico.mjs";

const sha = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
const ALFA = "abcdefghijklmnopqrstuvwxyz0123456789";
const azar = (n) => Array.from(crypto.randomBytes(n), (b) => ALFA[b % 36]).join("");
const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
export const MAX_ITEMS = 200, MAX_TEXTO = 4000, MAX_XML = 400000, MAX_TOTAL = 1000000;

export function cifrar(pubJwk, obj) {
  const aes = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", aes, iv);
  const datos = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final(), c.getAuthTag()]);
  const k = crypto.publicEncrypt({ key: crypto.createPublicKey({ key: pubJwk, format: "jwk" }), padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, aes);
  return { k: k.toString("base64"), iv: iv.toString("base64"), c: datos.toString("base64") };
}

function pubValida(j) {
  return j && j.kty === "RSA" && typeof j.n === "string" && j.n.length >= 340 && j.n.length < 1100 && j.e === "AQAB";
}

// stores: { buzones, bandeja } con get/setJSON/delete/list (Netlify Blobs)
export async function registrar({ stores, body }) {
  const token = String(body.token || "");
  if (!/^[a-z0-9]{32}$/.test(token) || !pubValida(body.pub)) return { status: 400, body: { error: "Datos de registro inválidos." } };
  try { cifrar(body.pub, {}); } catch { return { status: 400, body: { error: "La llave del dispositivo no es válida." } }; }
  const clave = azar(24);
  for (let i = 0; i < 3; i++) {   // el nombre del buzón es al azar; si ya existiera, se elige otro (nunca se pisa uno ajeno)
    const buzon = azar(10);
    if (await crearSiNoExiste(stores.buzones, buzon, { tokenHash: sha(token), claveHash: sha(clave), pub: { kty: "RSA", n: body.pub.n, e: body.pub.e }, creado: new Date().toISOString() }))
      return { status: 200, body: { buzon, clave } };
  }
  return { status: 503, body: { error: "No pudimos crear el buzón. Intenta de nuevo." } };
}

// Cambia la llave pública del buzón (al mudar la app a otra dirección, el navegador nuevo crea su propia llave).
// Solo el dueño (con su token) puede hacerlo. El código de conexión del iPhone y del correo no cambia.
export async function cambiarLlave({ stores, body }) {
  const buzon = String(body.buzon || "");
  if (!pubValida(body.pub)) return { status: 400, body: { error: "La llave del dispositivo no es válida." } };
  try { cifrar(body.pub, {}); } catch { return { status: 400, body: { error: "La llave del dispositivo no es válida." } }; }
  if (!(await autorizado(stores, buzon, body.token))) return { status: 403, body: { error: "No autorizado." } };
  await actualizar(stores.buzones, buzon, (reg) => { if (!reg) return undefined; reg.pub = { kty: "RSA", n: body.pub.n, e: body.pub.e }; reg.llaveCambiada = new Date().toISOString(); return reg; });
  return { status: 200, body: { ok: true } };
}

function partesValidas(partes) {
  if (!Array.isArray(partes) || !partes.length || partes.length > 6) return null;
  let total = 0;
  const out = [];
  for (const p of partes) {
    const tipo = ["texto", "xml", "verificacion"].includes(p && p.tipo) ? p.tipo : null;
    if (!tipo) return null;
    const contenido = String(p.contenido || "").slice(0, tipo === "xml" ? MAX_XML : MAX_TEXTO);
    total += contenido.length;
    out.push({ tipo, asunto: String(p.asunto || "").slice(0, 300), de: String(p.de || "").slice(0, 200), contenido });
  }
  return total <= MAX_TOTAL ? out : null;
}

// Desde el trabajador de correo (con secreto compartido) o desde un atajo del celular (con la clave del buzón)
// Código de conexión para el atajo del iPhone: FT-<buzón>-<clave>, un solo dato fácil de pegar.
export function leerCodigo(codigo) {
  const m = /^FT-([a-z0-9]{10})-([A-Za-z0-9]{16,64})$/.exec(String(codigo || "").trim());
  return m ? { buzon: m[1], clave: m[2] } : null;
}

// Compras con Apple Pay: el atajo puede mandar monto y comercio por separado.
export function textoApplePay(body) {
  const monto = String(body.monto || "").replace(/\s+/g, " ").trim().slice(0, 40);
  const comercio = String(body.comercio || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!monto) return "";
  const conSigno = /[$€]|COP|USD/i.test(monto) ? monto : "$" + monto;
  return "Compraste " + conSigno + (comercio ? " en " + comercio : "") + " con Apple Pay" + (body.tarjeta ? " (" + String(body.tarjeta).slice(0, 40) + ")" : "") + ".";
}

export async function recibir({ stores, body, secretoHeader, secretoEntrada }) {
  if (body && body.codigo && !body.buzon) { const c = leerCodigo(body.codigo); if (!c) return { status: 400, body: { error: "Código de conexión inválido." } }; body = { ...body, ...c }; }
  const buzon = String(body.buzon || "").toLowerCase();
  if (!/^[a-z0-9]{10}$/.test(buzon)) return { status: 400, body: { error: "Buzón inválido." } };
  const reg = await stores.buzones.get(buzon, { type: "json" });
  if (!reg) return { status: 404, body: { error: "Ese buzón no existe." } };
  let origen, partes;
  if (secretoHeader) {
    if (!secretoEntrada || !igual(secretoHeader, secretoEntrada)) return { status: 403, body: { error: "No autorizado." } };
    origen = "correo"; partes = partesValidas(body.partes);
  } else {
    if (!igual(sha(body.clave || ""), reg.claveHash)) return { status: 403, body: { error: "Clave incorrecta." } };
    origen = "atajo";
    const texto = (String(body.texto || "").trim() || textoApplePay(body)).trim();
    if (!texto) return { status: 400, body: { error: "Falta el texto del aviso." } };
    partes = [{ tipo: "texto", asunto: String(body.titulo || "").slice(0, 200), de: String(body.app || "").slice(0, 100), contenido: texto.slice(0, MAX_TEXTO) }];
  }
  if (!partes) return { status: 400, body: { error: "Contenido inválido." } };
  const { blobs } = await stores.bandeja.list({ prefix: buzon + "/" });
  if (blobs.length >= MAX_ITEMS) return { status: 429, body: { error: "El buzón está lleno. Abre la app para recibir los movimientos." } };
  const id = Date.now().toString(36) + azar(6);
  await stores.bandeja.setJSON(`${buzon}/${id}`, cifrar(reg.pub, { origen, recibido: new Date().toISOString(), partes }));
  return { status: 200, body: { ok: true } };
}

async function autorizado(stores, buzon, token) {
  if (!/^[a-z0-9]{10}$/.test(String(buzon || ""))) return null;
  const reg = await stores.buzones.get(buzon, { type: "json" });
  return reg && igual(sha(token || ""), reg.tokenHash) ? reg : null;
}
export async function listar({ stores, buzon, token }) {
  if (!(await autorizado(stores, buzon, token))) return { status: 403, body: { error: "No autorizado." } };
  const { blobs } = await stores.bandeja.list({ prefix: buzon + "/" });
  const items = [];
  for (const b of blobs.slice(0, 50)) {
    const x = await stores.bandeja.get(b.key, { type: "json" });
    if (x) items.push({ id: b.key.slice(buzon.length + 1), ...x });
  }
  return { status: 200, body: { items } };
}
export async function borrar({ stores, body }) {
  const buzon = String(body.buzon || "");
  if (!(await autorizado(stores, buzon, body.token))) return { status: 403, body: { error: "No autorizado." } };
  if (body.todo) {
    const { blobs } = await stores.bandeja.list({ prefix: buzon + "/" });
    for (const b of blobs) await stores.bandeja.delete(b.key);
    await stores.buzones.delete(buzon);
    return { status: 200, body: { ok: true } };
  }
  for (const id of (Array.isArray(body.ids) ? body.ids : []).slice(0, 100)) {
    if (/^[a-z0-9]{6,30}$/.test(String(id))) await stores.bandeja.delete(`${buzon}/${id}`);
  }
  return { status: 200, body: { ok: true } };
}
