// Salud técnica: errores y métricas sin datos personales, panel con clave, aviso por correo de errores nuevos,
// limpieza, y conteo desde el servidor de cuentas nuevas y compras aprobadas.
import * as TE from "../netlify/lib/telemetria.mjs";
import * as P from "../netlify/lib/pagos.mjs";
import * as C from "../netlify/lib/cuentas.mjs";
import { vigilarErrores } from "../netlify/functions/vigia-cron.mjs";
import { memStore } from "./memoria.mjs";
let fallas = 0; const ok = (c, m) => { if (!c) { fallas++; console.log("FALLA:", m); } else console.log("ok -", m); };
const DIA = 86400000, T0 = Date.UTC(2026, 10, 8, 15, 0);   // 8 nov. 2026, 10:00 a. m. en Colombia

// ---------- Errores ----------
const store = memStore(), limites = memStore();
let r = await TE.registrarError({ store, limites, ip: "1.1.1.1", ahora: T0, body: {
  m: "TypeError: no se pudo leer saldo 1234567 de ana.perez@correo.com", s: "at pintar (https://fintelligentx.netlify.app/?ref=PRE-ABC123456#x:120:5)\nat renderAll", d: "/:5120:7", v: "2026.11.08", p: "android", t: "inicio" } });
ok(r.status === 200, "recibe un error");
let dia = await store.get("errores/2026-11-08", { type: "json" }), e = Object.values(dia)[0];
ok(!/1234567|ana\.perez|correo\.com|PRE-ABC/.test(JSON.stringify(dia)), "borra números, correos y lo que va después de ? en las direcciones: " + e.m);
ok(e.n === 1 && e.plat.android === 1 && e.pant.inicio === 1 && e.v === "2026.11.08", "guarda versión, tipo de dispositivo y pantalla");
await TE.registrarError({ store, limites, ip: "2.2.2.2", ahora: T0 + 1000, body: { m: "TypeError: no se pudo leer saldo 99999 de otra@persona.co", s: "at pintar (https://fintelligentx.netlify.app/:120:5)", p: "iphone" } });
dia = await store.get("errores/2026-11-08", { type: "json" });
ok(Object.keys(dia).length === 1 && Object.values(dia)[0].n === 2 && Object.values(dia)[0].plat.iphone === 1, "el mismo error de dos personas se agrupa en una huella");
ok((await TE.registrarError({ store, limites, ip: "1", body: {} })).status === 400, "rechaza un error vacío");
let bloqueado = 0;
for (let i = 0; i < 32; i++) if ((await TE.registrarError({ store, limites, ip: "9.9.9.9", ahora: T0, body: { m: "x" + "abcdefghijklmnopqrstuvwxyzABCDEFGHIJ"[i] } })).status === 429) bloqueado++;
ok(bloqueado === 2, "frena a quien manda demasiados errores (" + bloqueado + ")");

// ---------- Métricas ----------
r = await TE.registrarMetrica({ store, limites, ip: "1", ahora: T0, body: { e: "abrir", p: "android-app" } });
await TE.registrarMetrica({ store, limites, ip: "2", ahora: T0, body: { e: "abrir", p: "pc" } });
await TE.registrarMetrica({ store, limites, ip: "2", ahora: T0, body: { e: "vio_premium", p: "pc" } });
ok(r.status === 200, "recibe una métrica");
ok((await TE.registrarMetrica({ store, limites, ip: "1", body: { e: "lo-que-sea" } })).status === 400, "solo acepta eventos conocidos");
ok((await TE.registrarMetrica({ store, limites, ip: "1", body: { e: "premium_aprobado", p: "pc" } })).status === 400, "las compras solo las cuenta el servidor (nadie las infla desde afuera)");
await TE.contarEnServidor(store, "premium_aprobado", T0);
const met = await store.get("metricas/2026-11-08", { type: "json" });
ok(met.abrir["android-app"] === 1 && met.abrir.pc === 1 && met.vio_premium.pc === 1 && met.premium_aprobado.servidor === 1, "cuenta por evento y tipo de dispositivo: " + JSON.stringify(met));
ok(!/1\.1\.1\.1|2\.2\.2\.2|"ip"/.test(JSON.stringify(met) + JSON.stringify(await store.get("errores/2026-11-08", { type: "json" }))), "no guarda ninguna dirección IP");

// ---------- Panel ----------
const env = { PANEL_CLAVE: "una-clave-larga-del-panel" };
ok((await TE.panel({ store, limites, env: {}, autorizacion: "Bearer x", ahora: T0 })).status === 503, "sin PANEL_CLAVE el panel no abre");
ok((await TE.panel({ store, limites, env: { PANEL_CLAVE: "corta" }, autorizacion: "Bearer corta", ahora: T0 })).status === 503, "una clave de menos de 16 caracteres no sirve");
ok((await TE.panel({ store, limites, env, autorizacion: "Bearer otra", ip: "5", ahora: T0 })).status === 401, "clave incorrecta: 401");
r = await TE.panel({ store, limites, env, autorizacion: "Bearer una-clave-larga-del-panel", ip: "5", ahora: T0 });
ok(r.status === 200 && r.body.metricas.length === 30 && r.body.metricas.at(-1).dia === "2026-11-08" && r.body.metricas.at(-1).eventos.abrir.pc === 1, "el panel trae 30 días de métricas");
ok(r.body.errores[0].n === 2 && r.body.errores.length >= 2, "y los errores de la semana, del más frecuente al menos");

// ---------- Aviso de errores nuevos ----------
const abrir = (n) => n === "salud-app" ? store : limites, enviados = [];
const enviar = async (m) => { enviados.push(m); return true; };
let v = await vigilarErrores({ env: { ALERTAS_CORREO: "duenos@correo.co" }, abrir, enviar, ahora: new Date(T0 + 60000) });
ok(v.aviso && enviados.length === 1 && /errores nuevos|error nuevo/.test(enviados[0].subject) && /2 veces: TypeError/.test(enviados[0].text) && !/vezes/.test(enviados[0].text), "avisa por correo los errores nuevos: " + (enviados[0] && enviados[0].subject));
v = await vigilarErrores({ env: { ALERTAS_CORREO: "duenos@correo.co" }, abrir, enviar, ahora: new Date(T0 + 3600000) });
ok(!v.aviso && enviados.length === 1, "no vuelve a avisar en menos de 6 horas");
v = await vigilarErrores({ env: { ALERTAS_CORREO: "duenos@correo.co" }, abrir, enviar, ahora: new Date(T0 + 7 * 3600000) });
ok(!v.aviso && enviados.length === 1, "si no hay errores nuevos, no escribe");
ok(await TE.erroresHoy(store, T0) >= 2, "cuenta los errores de hoy para /api/salud");

// ---------- Limpieza ----------
await store.setJSON("errores/2026-09-01", { a: { m: "viejo", n: 1 } });
await store.setJSON("metricas/2025-08-01", { abrir: { pc: 1 } });
await store.setJSON("metricas/2026-01-01", { abrir: { pc: 1 } });
const borrados = await TE.limpiarTelemetria(store, T0);
ok(borrados === 2 && !(await store.get("errores/2026-09-01")) && (await store.get("metricas/2026-01-01")), "borra errores de más de 30 días y métricas de más de 400");

// ---------- Desde el servidor: compras aprobadas y cuentas nuevas ----------
const pstore = memStore(), cfg = P.leerConfig({ WOMPI_PUBLIC_KEY: "pub_test_ABC", WOMPI_INTEGRITY_SECRET: "test_integrity_X", WOMPI_EVENTS_SECRET: "test_events_Y", PRECIO_COP: "15000", LICENSE_SECRET: "s3cr3t" });
const pago = await P.crearPago({ acepto: { v: "1.0", mayor: true }, store: pstore, cfg, email: "ana@correo.com", sitio: "https://x.netlify.app" });
const evento = (status) => { const ts = 1761552000, data = { transaction: { id: "1-1", amount_in_cents: 1500000, reference: pago.body.ref, customer_email: "ana@correo.com", currency: "COP", status } };
  return { event: "transaction.updated", data, signature: { properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"], checksum: P.sha256("1-1" + status + "1500000" + ts + "test_events_Y") }, timestamp: ts }; };
let aprobados = 0;
await P.procesarEvento({ store: pstore, cfg, evento: evento("PENDING"), alAprobar: () => aprobados++ });
await P.procesarEvento({ store: pstore, cfg, evento: evento("APPROVED"), alAprobar: () => aprobados++ });
await P.procesarEvento({ store: pstore, cfg, evento: evento("APPROVED"), alAprobar: () => aprobados++ });
ok(aprobados === 1, "una compra aprobada se cuenta una sola vez, aunque Wompi avise dos veces (" + aprobados + ")");
await P.procesarEvento({ store: pstore, cfg, evento: evento("APPROVED"), alAprobar: () => { throw new Error("falla la métrica"); } });
ok((await pstore.get(pago.body.ref, { type: "json" })).estado === "APROBADO", "si la métrica falla, el pago no se afecta");
let cuentas = 0, correo = [];
const deps = { env: { LICENSE_SECRET: "s3cr3t" }, stores: { usuarios: memStore(), sesiones: memStore(), codigos: memStore(), datos: memStore(), limites: memStore() },
  correoListo: true, enviarCorreo: async (m) => { correo.push(m); return true; }, alCrearCuenta: async () => { cuentas++; throw new Error("ni así impide entrar"); } };
await C.pedirCodigo(deps, { correo: "luis@correo.com", ip: "1" });
let cod = /(\d{6})/.exec(correo[0].subject)[1];
const x1 = await C.verificarCodigo(deps, { correo: "luis@correo.com", codigo: cod, consentimiento: { v: "1.0", edad: "18+" }, ip: "1" });
await C.pedirCodigo(deps, { correo: "luis@correo.com", ip: "1" });
cod = /(\d{6})/.exec(correo[1].subject)[1];
const x2 = await C.verificarCodigo(deps, { correo: "luis@correo.com", codigo: cod, consentimiento: { v: "1.0", edad: "18+" }, ip: "1" });
ok(x1.status === 200 && x2.status === 200 && cuentas === 1, "cuenta nueva: se cuenta una vez; volver a entrar no cuenta, y la métrica nunca impide entrar");

console.log(fallas ? "FALLAS: " + fallas : "TODO BIEN (telemetría)");
process.exitCode = fallas ? 1 : 0;
