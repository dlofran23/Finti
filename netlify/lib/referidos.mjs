// Invita y gana.
// - Cada persona puede pedir su código de invitación (AMIGO-XXXXXX). El servidor le entrega también una llave
//   (HMAC del código con LICENSE_SECRET) que solo ella guarda: con esa llave ve sus premios. No se pide correo
//   ni ningún dato personal para invitar.
// - Quien llega con el enlace /#invita=AMIGO-XXXXXX y compra Premium deja el código en su pago. Cuando el pago
//   queda APROBADO, quien invitó recibe un código de regalo de Premium (FIN-XXXXX-XXXXX): si aún no tiene Premium,
//   lo canjea para sí; si ya lo tiene, lo regala a quien quiera.
// - Un mismo pago solo premia una vez (se guarda su referencia) y cada código da como máximo MAX_PREMIOS premios.
import crypto from "node:crypto";
import { actualizar, crearSiNoExiste, limitar } from "./atomico.mjs";
import { crearRegaloInterno, anularRegaloInterno, estadoRegalo } from "./regalos.mjs";
import { contarEnServidor } from "./telemetria.mjs";

export const MAX_PREMIOS = 20;
const HORA = 3600 * 1000;
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function nuevoInvita() {
  const b = crypto.randomBytes(6);
  let s = "";
  for (const x of b) s += ALFABETO[x % ALFABETO.length];
  return "AMIGO-" + s;
}
// "amigo-abc234", "AMIGO ABC234" o "ABC234" → "AMIGO-ABC234"
export function normalizarInvita(c) {
  let s = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.startsWith("AMIGO")) s = s.slice(5);
  return /^[A-HJ-NP-Z2-9]{6}$/.test(s) ? "AMIGO-" + s : "";
}
const llave = (codigo, secreto) => crypto.createHmac("sha256", secreto).update("invita:" + codigo).digest("base64url");
function igualSeguro(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function crearInvitacion({ store, limites, cfg, ip, ahora = Date.now() }) {
  if (!cfg.licenseSecret) return { status: 503, body: { error: "Las invitaciones no están disponibles en este momento." } };
  if (limites && !(await limitar(limites, "invita:" + (ip || "?"), 5, HORA, ahora)))
    return { status: 429, body: { error: "Pediste muchos códigos seguidos. Espera una hora." } };
  for (let i = 0; i < 5; i++) {
    const codigo = nuevoInvita();
    if (await crearSiNoExiste(store, "i/" + codigo, { creado: new Date(ahora).toISOString(), ventas: 0, refs: [], premios: [] }))
      return { status: 200, body: { codigo, llave: llave(codigo, cfg.licenseSecret) } };
  }
  return { status: 503, body: { error: "No pudimos crear tu código. Intenta de nuevo." } };
}

export async function verPremios({ store, regalos, cfg, codigo, llave: k }) {
  const c = normalizarInvita(codigo);
  if (!c || !cfg.licenseSecret || !igualSeguro(k || "", llave(c, cfg.licenseSecret))) return { status: 403, body: { error: "No pudimos verificar tu código de invitación." } };
  const x = await store.get("i/" + c, { type: "json" });
  if (!x) return { status: 404, body: { error: "No encontramos tu código de invitación." } };
  const premios = [];
  for (const p of x.premios || []) premios.push({ codigo: p.codigo, creado: p.creado, estado: (await estadoRegalo({ store: regalos, codigo: p.codigo })) || "libre" });
  return { status: 200, body: { codigo: c, ventas: x.ventas || 0, premios, max: MAX_PREMIOS } };
}

// ¿Existe el código? Se usa al crear el pago, para no guardar códigos inventados.
export async function invitaExiste({ store, codigo }) {
  const c = normalizarInvita(codigo);
  if (!c) return "";
  return (await store.get("i/" + c, { type: "json" })) ? c : "";
}

// Se llama cuando un pago con código de invitación queda APROBADO. Devuelve true si entregó un premio.
export async function premiarInvitacion({ store, regalos, codigo, ref, ahora = Date.now() }) {
  const c = normalizarInvita(codigo);
  if (!c || !ref) return false;
  const actual = await store.get("i/" + c, { type: "json" });
  if (!actual || (actual.refs || []).includes(ref)) return false;
  const tope = (actual.premios || []).length >= MAX_PREMIOS;
  const regalo = tope ? "" : await crearRegaloInterno({ store: regalos, nota: "Premio por invitar " + c.slice(-6), origen: "invita", ahora });
  let entregado = false;
  await actualizar(store, "i/" + c, (x) => {
    entregado = false;
    if (!x) return undefined;
    x.refs = x.refs || []; x.premios = x.premios || [];
    if (x.refs.includes(ref)) return undefined;
    x.refs.push(ref); x.refs = x.refs.slice(-500); x.ventas = (x.ventas || 0) + 1;
    if (regalo && x.premios.length < MAX_PREMIOS) { x.premios.push({ codigo: regalo, creado: new Date(ahora).toISOString(), ref }); entregado = true; }
    return x;
  });
  if (regalo && !entregado) await anularRegaloInterno({ store: regalos, codigo: regalo, ahora });
  return entregado;
}

// Lo que pasa cuando un pago queda aprobado (webhook de Wompi o consulta de la licencia): se cuenta y, si el pago
// traía código de invitación, se premia a quien invitó. Nada de esto puede afectar el pago.
export function trasAprobar({ salud, invitaciones, regalos }) {
  return async (reg, ref) => {
    try { await contarEnServidor(salud, "premium_aprobado"); } catch { /* solo métrica */ }
    if (reg && reg.invita) {
      try { if (await premiarInvitacion({ store: invitaciones, regalos, codigo: reg.invita, ref })) await contarEnServidor(salud, "referido"); }
      catch (e) { console.error("referidos: no se pudo entregar el premio", e && e.message); }
    }
  };
}
