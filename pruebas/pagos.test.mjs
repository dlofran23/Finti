const ACEPTO = { v: "1.0", mayor: true };   // mayor de edad y condiciones de compra aceptadas
import * as P from "../netlify/lib/pagos.mjs";
const ok = (c, m) => { if (!c) { console.log("FALLA:", m); process.exitCode = 1; } else console.log("ok -", m); };
// Ejemplo oficial de la documentación de eventos de Wompi
const mem = new Map();
const store = { setJSON: async (k, v) => mem.set(k, JSON.parse(JSON.stringify(v))), get: async (k) => mem.has(k) ? JSON.parse(JSON.stringify(mem.get(k))) : null };
const env = { WOMPI_PUBLIC_KEY: "pub_test_ABC", WOMPI_INTEGRITY_SECRET: "test_integrity_X", WOMPI_EVENTS_SECRET: "test_events_Y", PRECIO_COP: "15000", LICENSE_SECRET: "s3cr3t" };
const cfg = P.leerConfig(env);
ok(cfg.api === "https://sandbox.wompi.co/v1" && cfg.montoCentavos === 1500000, "configuración de pruebas");
let r = await P.crearPago({ acepto: ACEPTO, store, cfg, email: "bad", sitio: "https://x.netlify.app" });
ok(r.status === 400, "rechaza correo inválido");
r = await P.crearPago({ acepto: ACEPTO, store, cfg, email: "Ana@Correo.com", sitio: "https://x.netlify.app/" });
const ref = r.body.ref, url = new URL(r.body.url);
ok(r.status === 200 && P.refValida(ref), "crea referencia " + ref);
ok(url.origin + url.pathname === "https://checkout.wompi.co/p/" && url.searchParams.get("amount-in-cents") === "1500000" && url.searchParams.get("redirect-url") === "https://x.netlify.app/", "URL de checkout correcta");
ok(url.searchParams.get("signature:integrity") === P.sha256(ref + "1500000COPtest_integrity_X"), "firma de integridad correcta");
r = await P.consultarLicencia({ store, cfg, ref, email: "ana@correo.com" });
ok(r.body.estado === "PENDIENTE" && !r.body.token, "pendiente antes del pago");
r = await P.consultarLicencia({ store, cfg, ref, email: "otro@correo.com" });
ok(r.status === 403, "correo distinto no recupera");
// Evento firmado de Wompi
const evento = (status, amount) => {
  const data = { transaction: { id: "1234-99-1", amount_in_cents: amount, reference: ref, customer_email: "ana@correo.com", currency: "COP", status } };
  const timestamp = 1761552000;
  const props = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
  const checksum = P.sha256(`1234-99-1${status}${amount}${timestamp}test_events_Y`);
  return { event: "transaction.updated", data, signature: { properties: props, checksum }, timestamp, sent_at: "x" };
};
const falso = evento("APPROVED", 1500000); falso.signature.checksum = "00";
r = await P.procesarEvento({ store, cfg, evento: falso });
ok(r.status === 401, "rechaza evento con firma falsa");
r = await P.procesarEvento({ store, cfg, evento: evento("APPROVED", 100) });
ok(r.status === 200 && mem.get(ref).estado === "MONTO_INVALIDO", "monto alterado no activa");
mem.get(ref).estado = "PENDIENTE";
r = await P.procesarEvento({ store, cfg, evento: evento("APPROVED", 1500000) });
ok(r.status === 200 && mem.get(ref).estado === "APROBADO", "evento válido aprueba el pago");
r = await P.consultarLicencia({ store, cfg, ref, email: "ana@correo.com" });
const token = r.body.token;
ok(r.body.estado === "APROBADO" && token, "entrega la licencia");
r = await P.consultarLicencia({ store, cfg, ref, token });
ok(r.body.valido === true, "token válido");
r = await P.consultarLicencia({ store, cfg, ref, token: (token[0] === "x" ? "y" : "x") + token.slice(1) });
ok(r.body.valido === false, "token alterado no es válido");
// Activación por redirección (sin webhook), consultando la transacción en la API
const r2 = await P.crearPago({ acepto: ACEPTO, store, cfg, email: "luis@correo.com", sitio: "https://x.netlify.app" });
const fetchFn = async (u, o) => ({ ok: true, json: async () => ({ data: { id: "77-1", reference: r2.body.ref, amount_in_cents: 1500000, currency: "COP", status: "APPROVED" } }), _u: u, _o: o });
r = await P.consultarLicencia({ store, cfg, ref: r2.body.ref, id: "77-1", fetchFn });
ok(r.body.estado === "APROBADO" && r.body.token, "activa al volver de Wompi con el id de la transacción");
const fetchOtra = async () => ({ ok: true, json: async () => ({ data: { id: "88-1", reference: "PRE-OTRAREFERENC", amount_in_cents: 1500000, currency: "COP", status: "APPROVED" } }) });
const r3 = await P.crearPago({ acepto: ACEPTO, store, cfg, email: "eva@correo.com", sitio: "https://x" });
r = await P.consultarLicencia({ store, cfg, ref: r3.body.ref, id: "88-1", fetchFn: fetchOtra });
ok(r.body.estado === "PENDIENTE", "no acepta una transacción de otra referencia");
ok((await P.crearPago({ acepto: ACEPTO, store, cfg: P.leerConfig({}), email: "a@b.co", sitio: "x" })).status === 500, "avisa si falta configuración");

// Dos eventos de Wompi al mismo tiempo (aprobado y pendiente): el aprobado nunca se pierde.
{
  const { memStore } = await import("./memoria.mjs");
  for (let i = 0; i < 10; i++) {
    const lento = memStore({ demora: 6 });
    const nuevo = await P.crearPago({ acepto: ACEPTO, store: lento, cfg, email: "par@correo.com", sitio: "https://x" });
    const conRef = (st, monto) => { const e = evento(st, monto); e.data.transaction.reference = nuevo.body.ref;
      e.signature.checksum = P.sha256(`1234-99-1${st}${monto}${e.timestamp}test_events_Y`); return e; };
    await Promise.all([P.procesarEvento({ store: lento, cfg, evento: conRef("PENDING", 1500000) }), P.procesarEvento({ store: lento, cfg, evento: conRef("APPROVED", 1500000) }), P.procesarEvento({ store: lento, cfg, evento: conRef("PENDING", 1500000) })]);
    const fin = await lento.get(nuevo.body.ref);
    if (fin.estado !== "APROBADO") { ok(false, "ronda " + i + ": el pago aprobado quedó como " + fin.estado); break; }
    if (i === 9) ok(true, "eventos simultáneos: el pago aprobado nunca queda pisado (10 rondas)");
  }
}

// Sin la declaración de mayoría de edad y aceptación de las condiciones no se crea el pago.
{
  const sinAcepto = await P.crearPago({ store, cfg, email: "x@correo.com", sitio: "https://x" });
  ok(sinAcepto.status === 400 && /mayor de edad/.test(sinAcepto.body.error), "sin aceptar las condiciones de compra no se crea el pago");
  const conAcepto = await P.crearPago({ acepto: ACEPTO, store, cfg, email: "y@correo.com", sitio: "https://x" });
  const reg = await store.get(conAcepto.body.ref, { type: "json" });
  ok(reg.aceptoCompra && reg.aceptoCompra.mayor && reg.aceptoCompra.v === "1.0" && reg.aceptoCompra.t, "el pago guarda la aceptación como prueba");
}
