const CONS = { v: "1.0", edad: "18+" };   // aceptación de términos y datos (obligatoria para crear cuentas)
import * as C from "../netlify/lib/cuentas.mjs";
import crypto from "node:crypto";
let fallas = 0; const ok = (c, m) => { if (!c) { fallas++; console.log("FALLA:", m); } };
import { memStore } from "./memoria.mjs";
const correos = [];
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
let T = Date.now();
const deps = { env: { LICENSE_SECRET: "s3cr3t", GOOGLE_CLIENT_ID: "cliente.apps.googleusercontent.com", SITE_URL: "https://x" },
  stores: { usuarios: memStore(), sesiones: memStore(), codigos: memStore(), datos: memStore(), limites: memStore() },
  correoListo: true, enviarCorreo: async (m) => { correos.push(m); return true; }, jwks: [jwk], ahora: () => T };
const jwt = (payload, key = privateKey, kid = "k1") => { const h = Buffer.from(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })).toString("base64url"), p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return h + "." + p + "." + crypto.sign("RSA-SHA256", Buffer.from(h + "." + p), key).toString("base64url"); };

// Código por correo
let x = await C.pedirCodigo(deps, { correo: "Laura@Correo.com ", ip: "1.1.1.1" });
ok(x.status === 200 && correos.length === 1, "envía código");
const cod = /(\d{6}) es tu código/.exec(correos[0].subject)[1];
ok(correos[0].to === "laura@correo.com", "normaliza correo");
x = await C.verificarCodigo(deps, { consentimiento: CONS, correo: "laura@correo.com", codigo: "000000" === cod ? "111111" : "000000", ip: "1" });
ok(x.status === 400, "código malo rechazado");
x = await C.verificarCodigo(deps, { consentimiento: CONS, correo: "laura@correo.com", codigo: cod, dispositivo: "Android", ip: "1" });
ok(x.status === 200 && x.body.token && x.body.usuario.correo === "laura@correo.com" && x.body.nuevo, "entra con código");
const tok1 = x.body.token;
x = await C.verificarCodigo(deps, { consentimiento: CONS, correo: "laura@correo.com", codigo: cod, ip: "1" });
ok(x.status === 400, "código no reutilizable");
// Vencimiento
await C.pedirCodigo(deps, { correo: "otro@correo.com", ip: "2" }); const cod2 = /(\d{6})/.exec(correos[1].subject)[1];
T += 11 * 60 * 1000; x = await C.verificarCodigo(deps, { consentimiento: CONS, correo: "otro@correo.com", codigo: cod2, ip: "2" }); ok(x.status === 400 && /venció/.test(x.body.error), "código vence"); T = Date.now();
// 5 intentos
await C.pedirCodigo(deps, { correo: "tres@correo.com", ip: "3" });
for (let i = 0; i < 5; i++) await C.verificarCodigo(deps, { consentimiento: CONS, correo: "tres@correo.com", codigo: "12345" + i, ip: "3" });
x = await C.verificarCodigo(deps, { consentimiento: CONS, correo: "tres@correo.com", codigo: /(\d{6})/.exec(correos[2].subject)[1], ip: "3" });
ok(x.status === 429, "bloquea tras 5 intentos");
// Límite de envíos por correo
let ult; for (let i = 0; i < 6; i++) ult = await C.pedirCodigo(deps, { correo: "spam@correo.com", ip: "9." + i });
ok(ult.status === 429, "límite de códigos por correo");
ok((await C.pedirCodigo(deps, { correo: "malo", ip: "4" })).status === 400, "correo inválido");

// Google: mismo correo => misma cuenta
const ahoraS = Math.floor(Date.now() / 1000);
const base = { iss: "https://accounts.google.com", aud: deps.env.GOOGLE_CLIENT_ID, sub: "123", email: "laura@correo.com", email_verified: true, name: "Laura Gómez", exp: ahoraS + 3600, iat: ahoraS };
x = await C.entrarConGoogle(deps, { consentimiento: CONS, credencial: jwt(base), dispositivo: "Computador", ip: "5" });
ok(x.status === 200 && x.body.usuario.nombre === "Laura Gómez" && !x.body.nuevo && x.body.usuario.google, "Google entra a la misma cuenta");
const tok2 = x.body.token;
ok((await C.entrarConGoogle(deps, { consentimiento: CONS, credencial: jwt({ ...base, aud: "otro" }), ip: "5" })).status === 401, "Google aud incorrecto");
ok((await C.entrarConGoogle(deps, { consentimiento: CONS, credencial: jwt({ ...base, exp: ahoraS - 600 }), ip: "5" })).status === 401, "Google vencido");
ok((await C.entrarConGoogle(deps, { consentimiento: CONS, credencial: jwt({ ...base, email_verified: false }), ip: "5" })).status === 401, "Google correo sin verificar");
const otra = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
ok((await C.entrarConGoogle(deps, { consentimiento: CONS, credencial: jwt(base, otra), ip: "5" })).status === 401, "Google firma falsa");

// Sesiones y cuenta
let s1 = await C.sesionDe(deps, "Bearer " + tok1), s2 = await C.sesionDe(deps, "Bearer " + tok2);
ok(s1 && s2 && s1.u.id === s2.u.id, "dos sesiones, una cuenta");
ok(!(await C.sesionDe(deps, "Bearer fs_falso_falso_falso_falso_falso_falso")), "token falso");
x = await C.verCuenta(deps, s1); ok(x.body.dispositivos.length === 2 && x.body.dispositivos.some((d) => d.actual), "lista dispositivos");

// Datos: cifrados en reposo, versiones y conflicto
x = await C.guardarDatos(deps, s1, { base: 0, contenido: '{"state":{"titulo":"Mi plata"}}', dispositivo: "Android" });
ok(x.status === 200 && x.body.version === 1, "guarda v1");
const crudo = deps.stores.datos._m.get(s1.u.id).v; ok(!crudo.includes("Mi plata"), "cifrado en reposo");
x = await C.leerDatos(deps, s2); ok(x.body.contenido.includes("Mi plata") && x.body.version === 1, "otro dispositivo lee");
x = await C.guardarDatos(deps, s2, { base: 0, contenido: "{}" }); ok(x.status === 409 && x.body.version === 1, "conflicto si la base es vieja");
x = await C.leerDatos(deps, s1, { meta: true }); ok(x.body.version === 1 && !("contenido" in x.body), "meta sin contenido");
ok((await C.guardarDatos(deps, s1, { base: 1, contenido: "x".repeat(C.MAX_DATOS + 1) })).status === 413, "límite de tamaño");

// Licencia
x = await C.guardarLicenciaCuenta(deps, s1, { ref: "PRE-ABCDEFGHJKLM", token: "t" }, () => true); ok(x.status === 200, "licencia guardada");
s2 = await C.sesionDe(deps, "Bearer " + tok2); x = await C.verCuenta(deps, s2); ok(x.body.usuario.licencia && x.body.usuario.licencia.ref === "PRE-ABCDEFGHJKLM", "licencia viaja con la cuenta");
ok((await C.guardarLicenciaCuenta(deps, s1, { ref: "PRE-ABCDEFGHJKLM", token: "t" }, () => false)).status === 400, "licencia falsa");

// Cerrar sesión de otro dispositivo y borrar cuenta
const otroId = (await C.verCuenta(deps, s1)).body.dispositivos.find((d) => !d.actual).id;
ok((await C.salir(deps, s1, { dispositivo: otroId })).status === 200, "cierra otro dispositivo");
ok(!(await C.sesionDe(deps, "Bearer " + tok2)), "sesión cerrada ya no sirve");
s1 = await C.sesionDe(deps, "Bearer " + tok1);
ok((await C.borrarCuenta(deps, s1, {})).status === 400, "pide confirmación");
ok((await C.borrarCuenta(deps, s1, { confirmar: "BORRAR" })).status === 200, "borra cuenta");
ok(!(await C.sesionDe(deps, "Bearer " + tok1)) && !deps.stores.datos._m.has(s1.u.id), "todo borrado");


// ---------- Al mismo tiempo (almacén con demoras al azar, como Netlify Blobs) ----------
const lento = () => memStore({ demora: 8 });
const dc = { ...deps, ahora: () => Date.now(), stores: { usuarios: lento(), sesiones: lento(), codigos: lento(), datos: lento(), limites: lento() } };
// Dos dispositivos entran a la vez: ninguno borra la sesión del otro.
const g = (sub) => jwt({ ...base, sub, email: "par@correo.com", exp: Math.floor(Date.now() / 1000) + 600, iat: Math.floor(Date.now() / 1000) });
const entradas = await Promise.all([1, 2, 3, 4].map((i) => C.entrarConGoogle(dc, { consentimiento: CONS, credencial: g("p"), dispositivo: "Equipo " + i, ip: "7." + i })));
const sesiones = await Promise.all(entradas.map((e) => C.sesionDe(dc, "Bearer " + e.body.token)));
ok(sesiones.every(Boolean), "4 dispositivos entran a la vez y las 4 sesiones siguen válidas");
ok(sesiones[0].u.sesiones.length === 4, "el usuario quedó con 4 sesiones (tiene " + sesiones[0].u.sesiones.length + ")");
// Dos dispositivos guardan a la vez sobre la misma versión: uno gana, el otro recibe 409; nada se pisa.
for (let ronda = 0; ronda < 5; ronda++) {
  const v = (await C.leerDatos(dc, sesiones[0], { meta: true })).body.version;
  const res = await Promise.all(sesiones.map((s, i) => C.guardarDatos(dc, s, { base: v, contenido: "equipo " + i + " ronda " + ronda, dispositivo: "E" + i })));
  const ganan = res.filter((x) => x.status === 200), pierden = res.filter((x) => x.status === 409);
  ok(ganan.length === 1 && pierden.length === 3, `ronda ${ronda}: 1 guarda y 3 reciben conflicto (${ganan.length}/${pierden.length})`);
  const final = (await C.leerDatos(dc, sesiones[0])).body;
  ok(final.version === v + 1 && final.contenido === "equipo " + res.indexOf(ganan[0]) + " ronda " + ronda, `ronda ${ronda}: queda exactamente lo del que ganó`);
}
// Fuerza bruta en paralelo: 60 intentos al mismo tiempo no pasan de 5 comparaciones por código.
correos.length = 0;
await C.pedirCodigo(dc, { correo: "bruto@correo.com", ip: "8.8.8.8" });
const real = /(\d{6})/.exec(correos[0].subject)[1];
const malos = Array.from({ length: 60 }, (_, i) => String((+real + 1 + i) % 1e6).padStart(6, "0"));
const rs = await Promise.all(malos.map((c, i) => C.verificarCodigo(dc, { consentimiento: CONS, correo: "bruto@correo.com", codigo: c, ip: "10.0." + i })));
const comparados = rs.filter((x) => /no coincide/.test(x.body.error || "")).length;
ok(comparados <= 5, "en paralelo solo se comparan 5 códigos (" + comparados + ")");
ok((await C.verificarCodigo(dc, { consentimiento: CONS, correo: "bruto@correo.com", codigo: real, ip: "10.1.1.1" })).status !== 200, "después ni el código correcto entra");
// Límite por IP en paralelo: 40 por hora, ni uno más.
const ipRs = await Promise.all(Array.from({ length: 55 }, () => C.verificarCodigo(dc, { consentimiento: CONS, correo: "nadie@correo.com", codigo: "123456", ip: "6.6.6.6" })));
const porLimite = ipRs.filter((x) => x.status === 429 && /Espera un rato/.test(x.body.error)).length;
ok(porLimite >= 15, "el límite por IP aguanta solicitudes simultáneas (" + porLimite + " frenadas de 55)");
// Cerrar sesión mientras ese mismo dispositivo hace una solicitud: la sesión no revive.
T = Date.now() + 20 * 60 * 1000; dc.ahora = () => T;    // ya toca anotar la "última actividad"
const tVict = entradas[3].body.token, idVict = (await C.verCuenta(dc, sesiones[0])).body.dispositivos.find((d) => d.nombre === "Equipo 4").id;
await Promise.all([C.salir(dc, sesiones[0], { dispositivo: idVict }), C.sesionDe(dc, "Bearer " + tVict), C.sesionDe(dc, "Bearer " + tVict)]);
ok(!(await C.sesionDe(dc, "Bearer " + tVict)), "la sesión cerrada no revive con una solicitud simultánea");
T = Date.now(); dc.ahora = () => Date.now();

// ---------- Cupo diario de correos (Gmail: unos 500 por día) ----------
const cupoDeps = { ...deps, env: { ...deps.env, CORREO_TOPE_DIA: "3" }, ahora: () => Date.now(), stores: { ...deps.stores, limites: memStore() } };
correos.length = 0;
const cupo = [];
for (let i = 0; i < 4; i++) cupo.push(await C.pedirCodigo(cupoDeps, { correo: "cupo" + i + "@correo.com", ip: "11.0.0." + i }));
ok(cupo.slice(0, 3).every((x) => x.status === 200) && correos.length === 3, "los primeros 3 correos del día salen");
ok(cupo[3].status === 429 && cupo[3].body.usarGoogle && /Google/.test(cupo[3].body.error), "al llegar al tope pide entrar con Google y no envía");
const { reservarCorreo } = await import("../netlify/lib/cupo-correo.mjs");
const cupoAvisos = await reservarCorreo(memStore(), { CORREO_TOPE_DIA: "150" }, { reserva: 100 });
ok(cupoAvisos.ok, "los avisos usan el cupo");
const st50 = memStore(); for (let i = 0; i < 50; i++) await reservarCorreo(st50, { CORREO_TOPE_DIA: "150" }, { reserva: 100 });
ok(!(await reservarCorreo(st50, { CORREO_TOPE_DIA: "150" }, { reserva: 100 })).ok && (await reservarCorreo(st50, { CORREO_TOPE_DIA: "150" })).ok, "los avisos dejan libre la reserva para los códigos");

// ---------- Google por redirección (iPhone con la app en la pantalla de inicio) ----------
{
  const ahoraG = Math.floor(Date.now() / 1000), cred = jwt({ ...base, email: "redir@correo.com", sub: "r1", exp: ahoraG + 600, iat: ahoraG });
  let y = await C.entrarConGoogleRedireccion(deps, { consentimiento: CONS, credencial: cred, csrfCuerpo: "abc", csrfCookie: "xyz", ip: "12.0.0.1" });
  ok(y.status === 303 && y.location === "/#entrar-error=csrf", "redirección: rechaza si la marca CSRF no coincide");
  y = await C.entrarConGoogleRedireccion(deps, { consentimiento: CONS, credencial: cred, csrfCuerpo: "abc", csrfCookie: "abc", dispositivo: "iPhone", ip: "12.0.0.1" });
  const canje = /^\/#entrar=([A-Za-z0-9_-]{32})$/.exec(y.location);
  ok(y.status === 303 && canje && !y.location.includes("fs_"), "redirección: vuelve con un código de un solo uso, no con la sesión");
  const c1 = await C.canjear(deps, { codigo: canje[1] });
  ok(c1.status === 200 && /^fs_/.test(c1.body.token) && c1.body.usuario.correo === "redir@correo.com", "el código se canjea por la sesión");
  ok(!!(await C.sesionDe(deps, "Bearer " + c1.body.token)), "la sesión canjeada sirve");
  ok((await C.canjear(deps, { codigo: canje[1] })).status === 400, "el código no se puede canjear dos veces");
  y = await C.entrarConGoogleRedireccion(deps, { consentimiento: CONS, credencial: jwt({ ...base, aud: "otro" }), csrfCuerpo: "a", csrfCookie: "a", ip: "12.0.0.1" });
  ok(y.location === "/#entrar-error=google", "redirección: token de Google inválido vuelve con error");
}

// ---------- Autorización de datos y términos (obligatoria para crear la cuenta) ----------
{
  const dz = { ...deps, ahora: () => Date.now(), stores: { usuarios: memStore(), sesiones: memStore(), codigos: memStore(), datos: memStore(), limites: memStore() } };
  correos.length = 0;
  await C.pedirCodigo(dz, { correo: "nueva@correo.com", ip: "13.0.0.1" });
  const cod = /(\d{6})/.exec(correos.at(-1).subject)[1];
  let x = await C.verificarCodigo(dz, { correo: "nueva@correo.com", codigo: cod, ip: "13.0.0.1" });
  ok(x.status === 403 && x.body.necesitaConsentimiento, "cuenta nueva sin aceptar términos: no se crea");
  ok(dz.stores.usuarios._m.size === 0 && dz.stores.sesiones._m.size === 0, "y no queda ningún usuario ni sesión guardados");
  x = await C.verificarCodigo(dz, { correo: "nueva@correo.com", codigo: cod, ip: "13.0.0.1", consentimiento: { v: "1.0", edad: "14-17" } });
  ok(x.status === 403, "adolescente sin autorización de su representante: no se crea");
  x = await C.verificarCodigo(dz, { correo: "nueva@correo.com", codigo: cod, ip: "13.0.0.1", consentimiento: { v: "1.0", edad: "14-17", representante: true } });
  ok(x.status === 200 && x.body.usuario.acepto && x.body.usuario.acepto.edad === "14-17" && x.body.usuario.acepto.v === "1.0", "con autorización entra (el código no se gastó en los intentos rechazados) y queda la prueba");
  ok(C.consentimientoValido({ v: "1.0", edad: "13" }) === null && C.consentimientoValido({ v: "1.0", edad: "18+" }).edad === "18+", "solo acepta los rangos de edad permitidos");
  // Una cuenta que ya existe entra aunque no mande la aceptación (la app se la pide después).
  correos.length = 0;
  await C.pedirCodigo(dz, { correo: "nueva@correo.com", ip: "13.0.0.2" });
  x = await C.verificarCodigo(dz, { correo: "nueva@correo.com", codigo: /(\d{6})/.exec(correos.at(-1).subject)[1], ip: "13.0.0.2" });
  ok(x.status === 200, "cuenta existente entra sin volver a mandar la aceptación");
  const ses = await C.sesionDe(dz, "Bearer " + x.body.token);
  const ac = await C.aceptarTerminos(dz, ses, { v: "1.1", edad: "18+" });
  ok(ac.status === 200 && ac.body.usuario.acepto.v === "1.1" && ac.body.usuario.acepto.edad === "18+", "acepta una versión nueva desde la app");
  ok((await C.aceptarTerminos(dz, ses, { v: "1.1" })).status === 400, "sin edad no se acepta");
  const u = await dz.stores.usuarios.get(ses.u.id);
  ok(u.consentimientos.length === 2 && u.consentimientos.every((c) => c.t), "se guarda el historial de aceptaciones con su fecha");
  // Google por redirección: la aceptación llega en una cookie
  ok(JSON.stringify(C.consentimientoDeCookie("a=1; ft_acepto=1.0~14~1; b=2")) === JSON.stringify({ v: "1.0", edad: "14-17", representante: true }), "lee la aceptación de la cookie");
  ok(C.consentimientoDeCookie("ft_acepto=x") === null, "cookie inválida se ignora");
  const ahoraG = Math.floor(Date.now() / 1000);
  const y = await C.entrarConGoogleRedireccion(dz, { credencial: jwt({ ...base, email: "sinacepto@correo.com", sub: "z9", exp: ahoraG + 600, iat: ahoraG }), csrfCuerpo: "q", csrfCookie: "q", ip: "13.0.0.3" });
  ok(y.location === "/#entrar-error=consentimiento", "Google por redirección sin aceptación: vuelve con ese error");
}

// ---------- Limpieza diaria de temporales (huellas de IP y códigos vencidos) ----------
{
  const { limpiarTemporales } = await import("../netlify/lib/limpieza.mjs");
  const lim = memStore(), cods = memStore(), ahora = Date.now();
  await lim.setJSON("viejo", { t: [ahora - 25 * 3600e3] }); await lim.setJSON("nuevo", { t: [ahora - 3600e3] });
  await cods.setJSON("vencido", { expira: ahora - 1 }); await cods.setJSON("vigente", { expira: ahora + 60e3 });
  const n = await limpiarTemporales({ limites: lim, codigos: cods }, ahora);
  ok(n === 2 && !(await lim.get("viejo")) && (await lim.get("nuevo")) && !(await cods.get("vencido")) && (await cods.get("vigente")), "la limpieza diaria borra huellas de más de 24 horas y códigos vencidos");
}

// Sin configuración
const sin = { ...deps, env: {}, correoListo: false };
ok((await C.pedirCodigo(sin, { correo: "a@b.co" })).status === 503, "sin secreto: no activo");
ok((await C.pedirCodigo({ ...deps, correoListo: false }, { correo: "a@b.co" })).status === 503, "sin correo: no activo");
console.log(fallas ? "FALLAS: " + fallas : "TODAS BIEN (cuentas)");
