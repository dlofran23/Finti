// Lógica de pagos con Wompi para activar Premium automáticamente.
// Sin dependencias de Netlify: recibe el almacén (store) y fetch por parámetro, para poder probarla.
import crypto from "node:crypto";
import { actualizar, crearSiNoExiste } from "./atomico.mjs";

export const MONEDA = "COP";

export function leerConfig(env) {
  const faltan = ["WOMPI_PUBLIC_KEY", "WOMPI_INTEGRITY_SECRET", "WOMPI_EVENTS_SECRET", "PRECIO_COP", "LICENSE_SECRET"].filter((k) => !env[k]);
  const precio = Math.round(Number(env.PRECIO_COP));
  return {
    faltan,
    publicKey: env.WOMPI_PUBLIC_KEY || "",
    integrity: env.WOMPI_INTEGRITY_SECRET || "",
    events: env.WOMPI_EVENTS_SECRET || "",
    licenseSecret: env.LICENSE_SECRET || "",
    precioCOP: Number.isFinite(precio) && precio > 0 ? precio : 0,
    montoCentavos: Number.isFinite(precio) && precio > 0 ? precio * 100 : 0,
    pruebas: String(env.WOMPI_PUBLIC_KEY || "").startsWith("pub_test_"),
    get api() { return this.pruebas ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1"; },
  };
}

export const sha256 = (txt) => crypto.createHash("sha256").update(txt, "utf8").digest("hex");
export const firmaIntegridad = (ref, centavos, integrity) => sha256(`${ref}${centavos}${MONEDA}${integrity}`);
export const tokenLicencia = (ref, secret) => crypto.createHmac("sha256", secret).update(ref).digest("base64url");

function igualSeguro(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function nuevaReferencia() {
  const bytes = crypto.randomBytes(12);
  let s = "";
  for (const b of bytes) s += ALFABETO[b % ALFABETO.length];
  return `PRE-${s}`;
}
export const refValida = (r) => /^PRE-[A-Z2-9]{12}$/.test(String(r || ""));
export const correoValido = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(String(e || "").trim());

// 1) Crear el pago: referencia única + firma de integridad + enlace al Web Checkout de Wompi.
// acepto: { v, mayor: true }. Quien compra declara ser mayor de edad y acepta las condiciones de compra
// (términos, numeral 9). Se guarda con el pago como prueba.
export async function crearPago({ store, cfg, email, sitio, acepto, invita }) {
  if (cfg.faltan.length) return { status: 500, body: { error: "Falta configurar el servidor: " + cfg.faltan.join(", ") } };
  email = String(email || "").trim().toLowerCase();
  if (!correoValido(email)) return { status: 400, body: { error: "Escribe un correo válido." } };
  const v = acepto && acepto.mayor === true ? String(acepto.v || "").replace(/[^0-9.]/g, "").slice(0, 10) : "";
  if (!v) return { status: 400, body: { error: "Para pagar, confirma que eres mayor de edad y que aceptas las condiciones de compra." } };
  const ref = nuevaReferencia(), creado = new Date().toISOString();
  if (!(await crearSiNoExiste(store, ref, { estado: "PENDIENTE", email, monto: cfg.montoCentavos, creado, aceptoCompra: { v, mayor: true, t: creado }, ...(invita ? { invita } : {}) })))
    return { status: 503, body: { error: "No pudimos crear el pago. Intenta de nuevo." } };
  const q = new URLSearchParams({
    "public-key": cfg.publicKey,
    currency: MONEDA,
    "amount-in-cents": String(cfg.montoCentavos),
    reference: ref,
    "signature:integrity": firmaIntegridad(ref, cfg.montoCentavos, cfg.integrity),
    "redirect-url": `${sitio.replace(/\/$/, "")}/`,
    "customer-data:email": email,
  });
  return { status: 200, body: { ref, url: `https://checkout.wompi.co/p/?${q.toString()}` } };
}

function valorEn(obj, ruta) { return ruta.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj); }

// 2) Webhook de Wompi: verificar el checksum del evento y marcar el pago.
export async function procesarEvento({ store, cfg, evento, checksumHeader, alAprobar }) {
  const sig = evento && evento.signature;
  if (!sig || !Array.isArray(sig.properties) || !sig.checksum || evento.timestamp == null) return { status: 400, body: { error: "Evento sin firma" } };
  const cadena = sig.properties.map((p) => String(valorEn(evento.data, p) ?? "")).join("") + String(evento.timestamp) + cfg.events;
  const esperado = sha256(cadena).toUpperCase();
  const recibido = String(checksumHeader || sig.checksum).toUpperCase();
  if (!igualSeguro(esperado, recibido)) return { status: 401, body: { error: "Checksum inválido" } };
  if (evento.event !== "transaction.updated") return { status: 200, body: { ok: true, ignorado: evento.event } };
  const tx = evento.data && evento.data.transaction;
  if (!tx || !refValida(tx.reference)) return { status: 200, body: { ok: true, ignorado: "referencia ajena" } };
  await registrarTransaccion({ store, cfg, tx, alAprobar });
  return { status: 200, body: { ok: true } };
}

// Escritura condicional: si llegan dos eventos de Wompi al mismo tiempo (por ejemplo PENDIENTE y APROBADO),
// el aprobado nunca queda pisado por el otro.
async function registrarTransaccion({ store, cfg, tx, alAprobar }) {
  const montoOk = Number(tx.amount_in_cents) === cfg.montoCentavos && tx.currency === MONEDA;
  let aprobadoAhora = false;
  const { valor, escrito } = await actualizar(store, tx.reference, (actual) => {
    aprobadoAhora = false;
    actual = actual || { email: String(tx.customer_email || "").toLowerCase(), monto: cfg.montoCentavos, creado: new Date().toISOString() };
    if (actual.estado === "APROBADO") return undefined;
    if (tx.status === "APPROVED" && montoOk) {
      Object.assign(actual, { estado: "APROBADO", transaccion: tx.id, aprobado: new Date().toISOString() });
      aprobadoAhora = true;
    } else if (tx.status === "APPROVED" && !montoOk) {
      Object.assign(actual, { estado: "MONTO_INVALIDO", transaccion: tx.id });
    } else if (["DECLINED", "VOIDED", "ERROR"].includes(tx.status)) {
      Object.assign(actual, { estado: tx.status, transaccion: tx.id });
    } else {
      Object.assign(actual, { estado: "PENDIENTE", transaccion: tx.id });
    }
    return actual;
  });
  if (escrito && aprobadoAhora && alAprobar) { try { await alAprobar(valor, tx.reference); } catch { /* la métrica nunca afecta el pago */ } }
  return valor;
}

// 3) Licencia: consultar el estado, activar con el id que devuelve Wompi, recuperar con el correo o validar un token.
export async function consultarLicencia({ store, cfg, ref, id, email, token, fetchFn, alAprobar }) {
  if (!refValida(ref)) return { status: 400, body: { error: "Referencia no válida." } };
  let reg = await store.get(ref, { type: "json" });
  if (token) {
    const ok = !!reg && reg.estado === "APROBADO" && igualSeguro(token, tokenLicencia(ref, cfg.licenseSecret));
    return { status: 200, body: { valido: ok } };
  }
  if (!reg) return { status: 404, body: { estado: "NO_ENCONTRADO", error: "No encontramos esa referencia." } };
  if (!id && !email) return { status: 400, body: { error: "Falta el correo de la compra." } };
  if (email && String(email).trim().toLowerCase() !== reg.email) return { status: 403, body: { error: "El correo no coincide con el de la compra." } };
  if (reg.estado !== "APROBADO" && id && /^[\w-]{4,80}$/.test(id)) {
    try {
      const r = await fetchFn(`${cfg.api}/transactions/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${cfg.publicKey}` } });
      if (r.ok) {
        const tx = (await r.json()).data;
        if (tx && tx.reference === ref) reg = await registrarTransaccion({ store, cfg, tx, alAprobar });
      }
    } catch (e) { /* si Wompi no responde, se queda como está y el webhook lo resolverá */ }
  }
  const body = { estado: reg.estado };
  if (reg.estado === "APROBADO") body.token = tokenLicencia(ref, cfg.licenseSecret);
  return { status: 200, body };
}
