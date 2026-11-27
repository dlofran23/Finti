// Servidor local que imita Netlify: sirve public/ y responde /api/* con la misma lógica, con Wompi simulado.
import http from "node:http"; import fs from "node:fs";
import * as P from "../../netlify/lib/pagos.mjs";
import * as A from "../../netlify/lib/avisos.mjs";
export const avisos = new Map(), salida = [];
import * as B from "../../netlify/lib/bandeja.mjs";
import * as CU from "../../netlify/lib/cuentas.mjs";
import cryptoN from "node:crypto";
export const correosCuenta = [];
const llamadas = [];
const gkeys = cryptoN.generateKeyPairSync("rsa", { modulusLength: 2048 });
const gjwk = { ...gkeys.publicKey.export({ format: "jwk" }), kid: "prueba", alg: "RS256" };
import { extraer } from "../../correo-worker/src/index.js";
import { memStore } from "../memoria.mjs";
import { estado } from "../../netlify/lib/estado.mjs";
import * as MU from "../../netlify/lib/mudanza.mjs";
import * as TE from "../../netlify/lib/telemetria.mjs";
import * as RG from "../../netlify/lib/regalos.mjs";
import * as RF from "../../netlify/lib/referidos.mjs";
import * as PQ from "../../netlify/lib/pqr.mjs";
import * as PG from "../../netlify/lib/precios-gente.mjs";
const gente = memStore(), genteLimites = memStore();   // precios que aporta la gente (en Cloudflare: almacén precios-gente)
const pqrs = memStore(), pqrLimites = memStore();
export const correosPqr = [];
const invitaciones = memStore();
const regalos = memStore(), regalosLimites = memStore();
const salud = memStore(), saludLimites = memStore();   // errores y métricas (en Netlify: almacén salud-app)
const mudanzas = memStore();
let mudarA = "";   // dirección nueva simulada (en Netlify: variable DIRECCION_NUEVA)
const bstores = { buzones: memStore(), bandeja: memStore() }, SECRETO = "secreto-de-prueba-0123456789";
const mem = new Map();
const store = { setJSON: async (k, v) => mem.set(k, JSON.parse(JSON.stringify(v))), get: async (k) => mem.has(k) ? JSON.parse(JSON.stringify(mem.get(k))) : null };
const env = { WOMPI_PUBLIC_KEY: "pub_test_ABC", WOMPI_INTEGRITY_SECRET: "test_integrity_X", WOMPI_EVENTS_SECRET: "test_events_Y", PRECIO_COP: "15000", LICENSE_SECRET: "s3cr3t" };
const cfg = P.leerConfig(env);
const cuentasDeps = { env: { LICENSE_SECRET: "s3cr3t", GOOGLE_CLIENT_ID: "cliente-prueba" }, jwks: [gjwk], correoListo: true,
  stores: { usuarios: memStore(), sesiones: memStore(), codigos: memStore(), datos: memStore(), limites: memStore() },
  enviarCorreo: async (m) => { correosCuenta.push(m); return true; } };
function tokenGoogle(email, name) { const t = Math.floor(Date.now() / 1000);
  const h = Buffer.from(JSON.stringify({ alg: "RS256", kid: "prueba" })).toString("base64url");
  const p = Buffer.from(JSON.stringify({ iss: "accounts.google.com", aud: "cliente-prueba", sub: "g-" + email, email, email_verified: true, name, exp: t + 600, iat: t })).toString("base64url");
  return h + "." + p + "." + cryptoN.sign("RSA-SHA256", Buffer.from(h + "." + p), gkeys.privateKey).toString("base64url"); }
export const transacciones = new Map(); // id -> transacción simulada de Wompi
const fetchFn = async (u) => { const id = decodeURIComponent(u.split("/").pop()); const t = transacciones.get(id); return { ok: !!t, json: async () => ({ data: t }) }; };
const port = +process.argv[2] || 8787;
const PUBLICO = decodeURIComponent(new URL("../../public", import.meta.url).pathname);
// Encabezados de seguridad de netlify.toml (bloque for = "/*"), para probar con la misma CSP de producción.
const ENCABEZADOS = (() => { const t = fs.readFileSync(new URL("../../netlify.toml", import.meta.url), "utf8"); const b = t.split('for = "/*"')[1].split("[[")[0]; const o = {}; for (const m of b.matchAll(/^\s{4}([A-Za-z-]+) = "(.*)"$/gm)) if (m[1] !== "Strict-Transport-Security") o[m[1]] = m[2].replace(/; upgrade-insecure-requests/, ""); return o; })();
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost:" + port}`);
  const send = (r) => { res.writeHead(r.status, { "Content-Type": "application/json" }); res.end(JSON.stringify(r.body)); };
  let body = ""; for await (const ch of req) body += ch;
  if (url.pathname === "/__mudanza") { mudarA = url.searchParams.get("a") || ""; return send({ status: 200, body: { mudarA } }); }
  if (url.pathname === "/__cupo") { cuentasDeps.env.CORREO_TOPE_DIA = url.searchParams.get("tope") || ""; return send({ status: 200, body: { ok: true } }); }
  if (url.pathname === "/__mudanzas") return send({ status: 200, body: { guardadas: mudanzas._m.size } });
  if (url.pathname === "/__llamadas") return send({ status: 200, body: llamadas });
  if (url.pathname.startsWith("/api/")) llamadas.push({ ruta: url.pathname, metodo: req.method, t: Date.now() });
  if (url.pathname === "/api/estado") return send(await estado({ deps: cuentasDeps, stores: bstores, autorizacion: req.headers.authorization, buzon: url.searchParams.get("buzon"), token: url.searchParams.get("token") }));
  if (url.pathname === "/api/mudanza") return send(req.method === "POST" ? await MU.guardarMudanza({ store: mudanzas, body: JSON.parse(body || "{}") }) : await MU.recogerMudanza({ store: mudanzas, id: url.searchParams.get("id") }));
  if (url.pathname === "/__salud") return send({ status: 200, body: Object.fromEntries([...salud._m.entries()].map(([k, v]) => [k, JSON.parse(v.v)])) });
  if (url.pathname === "/api/precios-gente") return send(req.method === "POST" ? await PG.aportar({ store: gente, limites: genteLimites, body: JSON.parse(body || "{}"), ip: "127.0.0.1" }) : { status: 200, body: { lista: PG.lista(), ...(await PG.resumen({ store: gente })), linea: await PG.leerLinea({ store: gente }) } });
  if (url.pathname === "/api/precios-buscar") return send({ status: 200, body: { q: url.searchParams.get("q") || "", t: Date.now(), cadenas: [] } });   // sin internet en las pruebas: cada prueba simula la respuesta
  if (url.pathname === "/api/precios-linea" && req.method === "POST") return send(await PG.guardarLinea({ store: gente, env: { PRECIOS_CLAVE: "clave-de-prueba-de-precios-01" }, autorizacion: req.headers.authorization, texto: body }));
  if (url.pathname === "/__gente") return send({ status: 200, body: Object.fromEntries([...gente._m.entries()].map(([k, v]) => [k, JSON.parse(v.v)])) });
  if (url.pathname === "/api/errores" && req.method === "POST") return send(await TE.registrarError({ store: salud, limites: saludLimites, body: JSON.parse(body || "{}"), ip: "127.0.0.1" }));
  if (url.pathname === "/api/metrica" && req.method === "POST") return send(await TE.registrarMetrica({ store: salud, limites: saludLimites, body: JSON.parse(body || "{}"), ip: "127.0.0.1" }));
  if (url.pathname === "/api/panel") return send(await TE.panel({ store: salud, limites: saludLimites, env: { PANEL_CLAVE: "clave-de-prueba-del-panel" }, autorizacion: req.headers.authorization, ip: "127.0.0.1" }));
  if (url.pathname.startsWith("/api/regalo")) {
    const b = JSON.parse(body || "{}"), base = { store: regalos, limites: regalosLimites, env: { PANEL_CLAVE: "clave-de-prueba-del-panel" }, autorizacion: req.headers.authorization, ip: "127.0.0.1" };
    if (url.pathname === "/api/regalo") return send(await RG.canjearRegalo({ store: regalos, pagos: store, limites: regalosLimites, cfg, codigo: b.codigo, email: b.email, ip: "127.0.0.1", alCanjear: () => TE.contarEnServidor(salud, "regalo") }));
    if (url.pathname === "/api/regalos" && req.method === "GET") return send(await RG.listarRegalos(base));
    if (url.pathname === "/api/regalos") return send(await RG.crearRegalos({ ...base, n: b.n, nota: b.nota }));
    if (url.pathname === "/api/regalos/anular") return send(await RG.anularRegalo({ ...base, id: b.id }));
  }
  if (url.pathname === "/__pqr-correos") return send({ status: 200, body: correosPqr });
  if (url.pathname.startsWith("/api/pqr")) {
    const envPq = { PANEL_CLAVE: "clave-de-prueba-del-panel" }, mandar = async (m) => { correosPqr.push(m); return true; };
    if (url.pathname === "/api/pqr/panel") return send(req.method === "GET" ? await PQ.listarPqr({ store: pqrs, limites: pqrLimites, env: envPq, autorizacion: req.headers.authorization, ip: "127.0.0.1" })
      : await PQ.responderPqr({ store: pqrs, limites: pqrLimites, env: envPq, autorizacion: req.headers.authorization, ip: "127.0.0.1", ...JSON.parse(body || "{}"), enviarCorreo: mandar }));
    if (req.method === "GET") return send(await PQ.consultarPqr({ store: pqrs, limites: pqrLimites, radicado: url.searchParams.get("radicado"), correo: url.searchParams.get("correo"), ip: "127.0.0.1" }));
    return send(await PQ.crearPqr({ store: pqrs, limites: pqrLimites, body: JSON.parse(body || "{}"), ip: "127.0.0.1", enviarCorreo: mandar, avisarA: "duenos@prueba.co" }));
  }
  if (url.pathname === "/panel") url.pathname = "/panel.html";
  if (url.pathname === "/api/bandeja/llave") return send(await B.cambiarLlave({ stores: bstores, body: JSON.parse(body || "{}") }));
  if (url.pathname === "/api/config") return send({ status: 200, body: { mudarA, precioCOP: cfg.precioCOP, pruebas: cfg.pruebas, listo: true, entradaDominio: "entrada.fintelligente.co", atajoIos: "https://www.icloud.com/shortcuts/prueba123abc", sitio: `http://localhost:${port}`, vapidPublicKey: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U", correo: true, cuentas: true, googleClientId: "cliente-prueba", correoLogin: true } });
  if (url.pathname === "/__correos") return send({ status: 200, body: correosCuenta });
  if (url.pathname === "/__google-token") return send({ status: 200, body: { credential: tokenGoogle(url.searchParams.get("email"), url.searchParams.get("nombre") || "") } });
  if (url.pathname === "/api/cuenta/google-redirect" && req.method === "POST") {
    const f = new URLSearchParams(body), g = /(?:^|;\s*)g_csrf_token=([^;]+)/.exec(req.headers.cookie || "");
    const x = await CU.entrarConGoogleRedireccion(cuentasDeps, { credencial: f.get("credential"), csrfCuerpo: f.get("g_csrf_token"), csrfCookie: g && decodeURIComponent(g[1]), dispositivo: "iPhone", ip: "127.0.0.1", consentimiento: CU.consentimientoDeCookie(req.headers.cookie) });
    res.writeHead(x.status, { Location: x.location }); return res.end();
  }
  if (url.pathname.startsWith("/api/cuenta") || url.pathname === "/api/datos") {
    const b = body ? JSON.parse(body) : {}, ip = "127.0.0.1", rta = url.pathname;
    if (rta === "/api/cuenta/codigo") return send(await CU.pedirCodigo(cuentasDeps, { correo: b.correo, ip }));
    if (rta === "/api/cuenta/verificar") return send(await CU.verificarCodigo(cuentasDeps, { ...b, ip }));
    if (rta === "/api/cuenta/google") return send(await CU.entrarConGoogle(cuentasDeps, { ...b, ip }));
    if (rta === "/api/cuenta/canjear") return send(await CU.canjear(cuentasDeps, b));
    const ses = await CU.sesionDe(cuentasDeps, req.headers.authorization);
    if (!ses) return send({ status: 401, body: { error: "Tu sesión terminó." } });
    if (rta === "/api/datos") return send(req.method === "GET" ? await CU.leerDatos(cuentasDeps, ses, { meta: url.searchParams.get("meta") === "1" }) : await CU.guardarDatos(cuentasDeps, ses, b));
    if (rta === "/api/cuenta" && req.method === "GET") return send(await CU.verCuenta(cuentasDeps, ses));
    if (rta === "/api/cuenta" && req.method === "DELETE") return send(await CU.borrarCuenta(cuentasDeps, ses, b));
    if (rta === "/api/cuenta/salir") return send(await CU.salir(cuentasDeps, ses, b));
    if (rta === "/api/cuenta/acepto") return send(await CU.aceptarTerminos(cuentasDeps, ses, b));
    if (rta === "/api/cuenta/licencia") return send(await CU.guardarLicenciaCuenta(cuentasDeps, ses, b, (ref, tok) => P.tokenLicencia(ref, env.LICENSE_SECRET) === tok));
  }
  if (url.pathname === "/api/bandeja/registro") return send(await B.registrar({ stores: bstores, body: JSON.parse(body || "{}") }));
  if (url.pathname === "/api/bandeja" && req.method === "GET") return send(await B.listar({ stores: bstores, buzon: url.searchParams.get("buzon"), token: url.searchParams.get("token") }));
  if (url.pathname === "/api/bandeja" && req.method === "DELETE") return send(await B.borrar({ stores: bstores, body: JSON.parse(body || "{}") }));
  if (url.pathname === "/api/entrada") return send(await B.recibir({ stores: bstores, body: JSON.parse(body || "{}"), secretoHeader: req.headers["x-entrada-secreto"], secretoEntrada: SECRETO }));
  if (url.pathname === "/__correo") { const partes = await extraer(new TextEncoder().encode(body).buffer); return send(await B.recibir({ stores: bstores, body: { buzon: url.searchParams.get("buzon"), partes }, secretoHeader: SECRETO, secretoEntrada: SECRETO })); }
  if (url.pathname === "/__avisos") return send({ status: 200, body: { perfiles: [...avisos.values()], salida } });
  if (url.pathname === "/api/avisos") {
    const j = JSON.parse(body || "{}");
    if (req.method === "DELETE") { const prev = avisos.get(j.id); if (prev && !A.tokenValido(prev, j.token)) return send({ status: 403, body: { error: "No autorizado." } }); avisos.delete(j.id); return send({ status: 200, body: { ok: true } }); }
    const v = A.validarPerfil(j); if (v.error) return send({ status: 400, body: { error: v.error } });
    const prev = avisos.get(v.perfil.id); if (prev && prev.tokenHash !== v.perfil.tokenHash) return send({ status: 403, body: { error: "No autorizado." } });
    if (v.perfil.email && !(v.perfil.licencia && P.tokenLicencia(v.perfil.licencia.ref, env.LICENSE_SECRET) === v.perfil.licencia.token)) return send({ status: 403, body: { error: "Los avisos por correo son parte de Premium." } });
    if (v.perfil.push && (!prev || !prev.push)) salida.push({ canal: "push", titulo: "¡Avisos activados! 🔔" });
    if (v.perfil.email && (!prev || prev.email !== v.perfil.email)) salida.push({ canal: "correo", to: v.perfil.email });
    avisos.set(v.perfil.id, v.perfil); return send({ status: 200, body: { ok: true } });
  }
  if (url.pathname === "/api/crear-pago") { const j = JSON.parse(body || "{}"); const invita = j.invita ? await RF.invitaExiste({ store: invitaciones, codigo: j.invita }) : ""; return send(await P.crearPago({ store, cfg, email: j.email, acepto: j.acepto, invita, sitio: `http://localhost:${port}` })); }
  if (url.pathname === "/api/licencia") { const q = url.searchParams; return send(await P.consultarLicencia({ store, cfg, fetchFn, ref: q.get("ref"), id: q.get("id"), email: q.get("email"), token: q.get("token"), alAprobar: RF.trasAprobar({ salud, invitaciones, regalos }) })); }
  if (url.pathname === "/api/invita" && req.method === "GET") { const q = url.searchParams; return send(await RF.verPremios({ store: invitaciones, regalos, cfg, codigo: q.get("codigo"), llave: q.get("llave") })); }
  if (url.pathname === "/api/invita") return send(await RF.crearInvitacion({ store: invitaciones, limites: regalosLimites, cfg, ip: "127.0.0.1" }));
  if (url.pathname === "/__simular") { const q = url.searchParams; const ref = q.get("ref"); const id = "T-" + Math.random().toString(36).slice(2, 8); transacciones.set(id, { id, reference: ref, amount_in_cents: +q.get("monto"), currency: "COP", status: q.get("estado") }); res.writeHead(302, { Location: `/?id=${id}&env=test` }); return res.end(); }
  const f = PUBLICO + (url.pathname === "/" ? "/index.html" : url.pathname);
  if (fs.existsSync(f)) { res.writeHead(200, { ...ENCABEZADOS, "Content-Type": f.endsWith(".html") ? "text/html; charset=utf-8" : f.endsWith(".js") ? "text/javascript" : f.endsWith(".png") ? "image/png" : f.endsWith(".css") ? "text/css; charset=utf-8" : f.endsWith(".svg") ? "image/svg+xml" : f.endsWith(".json") ? "application/json" : f.endsWith(".webmanifest") ? "application/manifest+json" : f.endsWith(".wasm") ? "application/wasm" : "application/octet-stream" }); return res.end(fs.readFileSync(f)); }
  res.writeHead(404); res.end();
}).listen(port, () => console.log("listo", port));
