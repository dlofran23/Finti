// Códigos de regalo de Premium.
// - Los crea el dueño desde el panel (/panel, con PANEL_CLAVE). Cada código se ve UNA sola vez al crearlo: el servidor
//   guarda solo su huella (sha256), los últimos 4 caracteres para reconocerlo y la nota que le pongas.
// - Quien lo recibe lo escribe en la ventana de Premium con su correo. Al canjearlo se crea un registro en el almacén
//   de pagos (estado APROBADO, origen "regalo", valor 0) y se entrega la misma licencia que un pago: así funcionan igual
//   la revisión diaria, guardar Premium en la cuenta y activarlo en otro dispositivo con la referencia y el correo.
// - Cada código sirve una vez. El dueño puede anular los que no se han usado.
import crypto from "node:crypto";
import { actualizar, crearSiNoExiste, limitar } from "./atomico.mjs";
import { claveValida } from "./telemetria.mjs";
import { tokenLicencia, nuevaReferencia, correoValido } from "./pagos.mjs";

const HORA = 3600 * 1000;
export const MAX_LOTE = 200;   // por lote: alcanza para el equipo de una empresa sin pasar el tiempo máximo de la función
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // sin O, 0, I ni 1, que se confunden
const sha = (t) => crypto.createHash("sha256").update(t, "utf8").digest("hex");
const huella = (codigo) => sha("regalo:" + codigo);

export function nuevoCodigo() {
  const b = crypto.randomBytes(10);
  let s = "";
  for (const x of b) s += ALFABETO[x % ALFABETO.length];
  return "FIN-" + s.slice(0, 5) + "-" + s.slice(5);
}

// "fin-abcde-fghjk", "FIN ABCDE FGHJK" o "ABCDEFGHJK" → "FIN-ABCDE-FGHJK"
export function normalizarCodigo(c) {
  let s = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.startsWith("FIN") && s.length === 13) s = s.slice(3);
  if (!/^[A-HJ-NP-Z2-9]{10}$/.test(s)) return "";
  return "FIN-" + s.slice(0, 5) + "-" + s.slice(5);
}

async function autorizar({ env, autorizacion, limites, ip, ahora }) {
  const ok = claveValida(env, String(autorizacion || "").replace(/^Bearer\s+/i, ""));
  if (ok === null) return { status: 503, body: { error: "Falta configurar PANEL_CLAVE (mínimo 16 caracteres) en las llaves del servidor." } };
  if (!ok) {
    if (limites) await limitar(limites, "panel:" + (ip || "?"), 10, HORA, ahora);
    return { status: 401, body: { error: "Clave incorrecta." } };
  }
  if (limites && !(await limitar(limites, "panel-ok:" + (ip || "?"), 120, HORA, ahora))) return { status: 429, body: { error: "Demasiadas consultas." } };
  return null;
}

const limpiarNota = (n) => String(n || "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

export async function crearRegalos({ store, limites, env, autorizacion, ip, n, nota, ahora = Date.now() }) {
  const no = await autorizar({ env, autorizacion, limites, ip, ahora });
  if (no) return no;
  n = Math.floor(+n);
  if (!(n >= 1 && n <= MAX_LOTE)) return { status: 400, body: { error: "Puedes crear de 1 a " + MAX_LOTE + " códigos a la vez." } };
  const creado = new Date(ahora).toISOString(), codigos = [];
  nota = limpiarNota(nota);
  // En grupos de 20 a la vez para que un lote grande no tarde demasiado.
  while (codigos.length < n) {
    const grupo = Array.from({ length: Math.min(20, n - codigos.length) }, () => nuevoCodigo());
    const hechos = await Promise.all(grupo.map((codigo) => { const h = huella(codigo); return crearSiNoExiste(store, "c/" + h, { id: h.slice(0, 16), pista: codigo.slice(-4), nota, creado, estado: "libre" }); }));
    grupo.forEach((codigo, i) => { if (hechos[i]) codigos.push(codigo); });
  }
  return { status: 200, body: { codigos } };
}

// Para uso interno del servidor (premios por invitar): crea un código sin pasar por el panel.
export async function crearRegaloInterno({ store, nota, origen, ahora = Date.now() }) {
  const creado = new Date(ahora).toISOString();
  for (let i = 0; i < 5; i++) {
    const codigo = nuevoCodigo(), h = huella(codigo);
    if (await crearSiNoExiste(store, "c/" + h, { id: h.slice(0, 16), pista: codigo.slice(-4), nota: limpiarNota(nota), creado, estado: "libre", origen: origen || "" })) return codigo;
  }
  throw new Error("no se pudo crear el código");
}
export async function anularRegaloInterno({ store, codigo, ahora = Date.now() }) {
  const c = normalizarCodigo(codigo); if (!c) return;
  await actualizar(store, "c/" + huella(c), (x) => { if (!x || x.estado !== "libre") return undefined; x.estado = "anulado"; x.anulado = new Date(ahora).toISOString(); return x; });
}
// Estado de un código sin revelar nada más (para "Tus premios"): libre, usado o anulado.
export async function estadoRegalo({ store, codigo }) {
  const c = normalizarCodigo(codigo); if (!c) return "";
  const x = await store.get("c/" + huella(c), { type: "json" });
  return x ? x.estado : "";
}

export async function listarRegalos({ store, limites, env, autorizacion, ip, ahora = Date.now() }) {
  const no = await autorizar({ env, autorizacion, limites, ip, ahora });
  if (no) return no;
  const { blobs } = await store.list({ prefix: "c/" }), regalos = [];
  for (const b of blobs) {
    const x = await store.get(b.key, { type: "json" });
    if (x) regalos.push({ id: x.id, pista: x.pista, nota: x.nota || "", creado: x.creado, estado: x.estado, usado: x.usado ? x.usado.t : null });
  }
  regalos.sort((a, b) => (a.creado < b.creado ? 1 : a.creado > b.creado ? -1 : 0));
  const cuenta = (e) => regalos.filter((r) => r.estado === e).length;
  return { status: 200, body: { regalos, libres: cuenta("libre"), usados: cuenta("usado"), anulados: cuenta("anulado") } };
}

export async function anularRegalo({ store, limites, env, autorizacion, ip, id, ahora = Date.now() }) {
  const no = await autorizar({ env, autorizacion, limites, ip, ahora });
  if (no) return no;
  if (!/^[0-9a-f]{16}$/.test(String(id || ""))) return { status: 400, body: { error: "Código no válido." } };
  const { blobs } = await store.list({ prefix: "c/" + id });
  if (!blobs.length) return { status: 404, body: { error: "No encontramos ese código." } };
  let estado = "";
  await actualizar(store, blobs[0].key, (x) => {
    if (!x) return undefined;
    estado = x.estado;
    if (x.estado !== "libre") return undefined;
    x.estado = "anulado"; x.anulado = new Date(ahora).toISOString();
    return x;
  });
  if (estado === "usado") return { status: 409, body: { error: "Ese código ya se usó: no se puede anular." } };
  return { status: 200, body: { ok: true } };
}

// Canjear: 10 intentos por hora por IP. Los mensajes no dicen si un código existe salvo cuando es el correcto.
export async function canjearRegalo({ store, pagos, limites, cfg, codigo, email, ip, alCanjear, ahora = Date.now() }) {
  if (!cfg.licenseSecret) return { status: 503, body: { error: "Los códigos de regalo no están disponibles en este momento." } };
  if (limites && !(await limitar(limites, "regalo:" + (ip || "?"), 10, HORA, ahora)))
    return { status: 429, body: { error: "Hiciste muchos intentos. Espera una hora y vuelve a intentarlo." } };
  email = String(email || "").trim().toLowerCase();
  if (!correoValido(email)) return { status: 400, body: { error: "Escribe un correo válido. Con él puedes activar Premium en otro dispositivo." } };
  const c = normalizarCodigo(codigo);
  if (!c) return { status: 400, body: { error: "El código tiene el formato FIN-XXXXX-XXXXX. Revisa que esté bien escrito." } };
  const clave = "c/" + huella(c), t = new Date(ahora).toISOString();
  let antes = null, ref = "";
  await actualizar(store, clave, (x) => {
    antes = x ? x.estado : null;
    if (!x || x.estado !== "libre") return undefined;
    ref = nuevaReferencia();
    x.estado = "usado"; x.usado = { t, ref };
    return x;
  });
  if (!antes) return { status: 404, body: { error: "Ese código no existe. Revisa que esté bien escrito." } };
  if (antes === "usado") return { status: 409, body: { error: "Ese código ya se usó. Si fuiste tú, activa Premium con tu referencia y tu correo." } };
  if (antes !== "libre") return { status: 410, body: { error: "Ese código ya no está activo." } };
  try {
    const okPago = await crearSiNoExiste(pagos, ref, { estado: "APROBADO", origen: "regalo", email, monto: 0, creado: t, aprobado: t, regalo: clave.slice(2, 18) });
    if (!okPago) throw new Error("ref repetida");
  } catch (e) {
    await actualizar(store, clave, (x) => { if (!x || !x.usado || x.usado.ref !== ref) return undefined; x.estado = "libre"; delete x.usado; return x; });
    return { status: 503, body: { error: "No pudimos activar el código. Intenta de nuevo en un momento." } };
  }
  if (alCanjear) { try { await alCanjear(); } catch { /* la métrica nunca afecta el canje */ } }
  return { status: 200, body: { ref, token: tokenLicencia(ref, cfg.licenseSecret) } };
}
