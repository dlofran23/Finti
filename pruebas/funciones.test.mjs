// Prueba las funciones reales del servidor contra un Netlify Blobs local.
const CONS = { v: "1.0", edad: "18+" };   // aceptación de términos y datos (obligatoria para crear cuentas)
import { BlobsLocal as BlobsServer } from "./blobs-local.mjs";
import { setEnvironmentContext } from "@netlify/blobs";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { webcrypto } from "node:crypto";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blobs-")), token = "token-prueba", port = 8970 + Math.floor(Math.random() * 20);
const srv = new BlobsServer({ directory: dir, port, token, logger: () => {} });
await srv.start();
setEnvironmentContext({ siteID: "sitio-prueba", token, edgeURL: `http://localhost:${port}`, uncachedEdgeURL: `http://localhost:${port}` });
Object.assign(process.env, { LICENSE_SECRET: "secreto-de-prueba-123", PRECIO_COP: "19000", SITE_URL: "https://fintelligentx.netlify.app",
  WOMPI_PUBLIC_KEY: "pub_test_x", WOMPI_INTEGRITY_SECRET: "test_integrity_x", WOMPI_EVENTS_SECRET: "test_events_x", ALERTAS_CORREO: "dueno@correo.com" });

const prod = (ip = "1.1.1.1") => ({ ip, deploy: { context: "production" } }), pruebas = { ip: "9.9.9.9", deploy: { context: "branch-deploy" } };
const B = "https://fintelligentx.netlify.app";
const llamar = async (mod, metodo, ruta, cuerpo, ctx = prod(), headers = {}) => {
  const r = await (await import(mod)).default(new Request(B + ruta, { method: metodo, headers: { "content-type": "application/json", ...headers }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }), ctx);
  return r ? [r.status, await r.json().catch(() => null)] : [0, null];
};
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// --- Buzón: registro, envío con código, límites y aislamiento del sitio de pruebas ---
const kp = await webcrypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
const pub = await webcrypto.subtle.exportKey("jwk", kp.publicKey);
const tokenB = "a".repeat(32);
let [st, j] = await llamar("../netlify/functions/bandeja.mjs", "POST", "/api/bandeja/registro", { token: tokenB, pub });
ok(st === 200 && j.buzon, "registro de buzón");
const codigo = `FT-${j.buzon}-${j.clave}`;
[st] = await llamar("../netlify/functions/bandeja.mjs", "POST", "/api/entrada", { codigo, texto: "Compraste $1.000 en Prueba con Apple Pay." }, prod("2.2.2.2"));
ok(st === 200, "aviso con código de conexión");
[st] = await llamar("../netlify/functions/bandeja.mjs", "POST", "/api/entrada", { codigo, monto: "12.500,00", comercio: "JUAN VALDEZ" }, prod("2.2.2.2"));
ok(st === 200, "Apple Pay con campos");
[st, j] = await llamar("../netlify/functions/bandeja.mjs", "GET", `/api/bandeja?buzon=${codigo.split("-")[1]}&token=${tokenB}`);
ok(st === 200 && j.items.length === 2, "el dueño ve 2 avisos cifrados");
let bloqueado = 0;
for (let i = 0; i < 32; i++) { const [s] = await llamar("../netlify/functions/bandeja.mjs", "POST", "/api/entrada", { codigo, texto: "x $1" }, prod("3.3.3.3")); if (s === 429) bloqueado++; }
ok(bloqueado === 2, "límite de 30 avisos por minuto por IP (bloqueó " + bloqueado + ")");
[st] = await llamar("../netlify/functions/bandeja.mjs", "POST", "/api/entrada", { codigo, texto: "Compraste $2.000 en Otra." }, prod("4.4.4.4"));
ok(st === 200, "otra IP no se ve afectada");
[st] = await llamar("../netlify/functions/bandeja.mjs", "POST", "/api/entrada", { codigo, texto: "x" }, pruebas);
ok(st === 404, "el sitio de pruebas no ve los buzones reales");
let regs = 0; for (let i = 0; i < 11; i++) { const [s] = await llamar("../netlify/functions/bandeja.mjs", "POST", "/api/bandeja/registro", { token: "b".repeat(32), pub }, prod("5.5.5.5")); if (s === 429) regs++; }
ok(regs === 1, "límite de 10 buzones nuevos por hora por IP");

// --- Configuración ---
[st, j] = await llamar("../netlify/functions/config.mjs", "GET", "/api/config");
ok(st === 200 && j.cuentas === true && "atajoIos" in j, "config responde");

// --- Respaldo, retención y restauración ---
const { almacen, limitar } = await import("../netlify/lib/almacen.mjs");
const { hacerRespaldo, desempacar, restaurar, secretoRespaldo } = await import("../netlify/lib/respaldo.mjs");
await almacen("cuentas-datos", prod()).set("u1", JSON.stringify({ v: 3, contenido: "cifrado" }));
await (await import("../netlify/functions/respaldo-cron.mjs")).default(new Request(B), prod());
const dest = almacen("respaldos", prod()), hoy = new Date().toISOString().slice(0, 10) + ".ftr";
const bin = await dest.get(hoy, { type: "arrayBuffer" });
ok(bin && bin.byteLength > 50, "respaldo del día guardado");
const foto = desempacar(bin, secretoRespaldo(process.env));
ok(foto.almacenes["cuentas-datos"].u1 && Object.keys(foto.almacenes.buzones).length >= 1, "el respaldo contiene cuentas y buzones");
ok(!JSON.stringify([...Buffer.from(bin).subarray(0, 400)]).includes("cifrado"), "el archivo está cifrado");
assert.throws(() => desempacar(bin, "otra-llave"), "con otra llave no abre"); n++;
for (let d = 1; d <= 33; d++) await hacerRespaldo({ abrir: (x) => almacen(x, prod()), destino: dest, secreto: secretoRespaldo(process.env), ahora: new Date(Date.UTC(2026, 0, d)) });
ok((await dest.list()).blobs.length === 30, "conserva solo los últimos 30 días");
await almacen("cuentas-datos", prod()).delete("u1");
await restaurar({ foto, abrir: (x) => almacen(x, prod()), soloAlmacenes: ["cuentas-datos"] });
ok(JSON.parse(await almacen("cuentas-datos", prod()).get("u1")).v === 3, "restaurar devuelve el dato borrado");

// --- Salud y alertas ---
[st, j] = await llamar("../netlify/functions/salud.mjs", "GET", "/api/salud");
ok(st === 200 && j.ok && j.fallas.includes("correo") && !j.fallas.includes("respaldo"), "salud: ok, avisa que falta el correo " + JSON.stringify(j));
const { vigilar } = await import("../netlify/functions/vigia-cron.mjs");
const enviados = [], enviar = async (m) => (enviados.push(m), true);
const envMal = { ...process.env, WOMPI_PUBLIC_KEY: "" };
let v = await vigilar({ env: envMal, abrir: (x) => almacen(x, prod()), enviar });
ok(v.aviso && enviados.length === 1 && /pagos con Wompi/.test(enviados[0].text), "alerta por correo si fallan los pagos");
v = await vigilar({ env: envMal, abrir: (x) => almacen(x, prod()), enviar });
ok(!v.aviso && v.silenciado && enviados.length === 1, "no repite la alerta antes de 6 horas");
v = await vigilar({ env: process.env, abrir: (x) => almacen(x, prod()), enviar });
ok(!v.aviso, "sin fallas no envía nada");


// --- Escrituras seguras con el Netlify Blobs real (etiquetas y escrituras condicionales de verdad) ---
{
  const C = await import("../netlify/lib/cuentas.mjs");
  const enviados = [], st = (nombre) => almacen(nombre, prod(), true);
  const deps = { env: process.env, correoListo: true, enviarCorreo: async (m) => { enviados.push(m); return true; },
    stores: { usuarios: st("cuentas-usuarios"), sesiones: st("cuentas-sesiones"), codigos: st("cuentas-codigos"), datos: st("cuentas-datos"), limites: st("cuentas-limites") } };
  const tokens = [];
  for (let i = 0; i < 3; i++) {
    await C.pedirCodigo(deps, { correo: "dos@correo.com", ip: "20.0.0." + i });
    const cod = /(\d{6})/.exec(enviados.at(-1).subject)[1];
    tokens.push((await C.verificarCodigo(deps, { consentimiento: CONS, correo: "dos@correo.com", codigo: cod, dispositivo: "Equipo " + i, ip: "20.0.0." + i })).body.token);
  }
  const ses = await Promise.all(tokens.map((t) => C.sesionDe(deps, "Bearer " + t)));
  ok(ses.every(Boolean) && ses[0].u.sesiones.length === 3, "tres dispositivos con sesión en Blobs");
  let bien = true;
  for (let ronda = 0; ronda < 4; ronda++) {
    const v = (await C.leerDatos(deps, ses[0], { meta: true })).body.version;
    const res = await Promise.all(ses.map((s, i) => C.guardarDatos(deps, s, { base: v, contenido: "E" + i + "-" + ronda })));
    const gana = res.findIndex((x) => x.status === 200);
    const fin = (await C.leerDatos(deps, ses[0])).body;
    if (res.filter((x) => x.status === 200).length !== 1 || res.filter((x) => x.status === 409).length !== 2 || fin.contenido !== "E" + gana + "-" + ronda || fin.version !== v + 1) bien = false;
  }
  ok(bien, "con Blobs real: al guardar a la vez, uno gana y los demás reciben conflicto (4 rondas)");
  const lim = st("cuentas-limites"), res = await Promise.all(Array.from({ length: 20 }, () => limitar(lim, "rafaga", 10, 60000)));
  const pasan = res.filter(Boolean).length;
  ok(pasan >= 1 && pasan <= 10, "límite con 20 solicitudes simultáneas: pasan " + pasan + " de máximo 10");
}

// --- Consulta única de novedades (nube + buzón) ---
{
  const C = await import("../netlify/lib/cuentas.mjs");
  const enviados = [], abrir = (nombre) => almacen(nombre, prod(), true);
  const deps = { env: process.env, correoListo: true, enviarCorreo: async (m) => { enviados.push(m); return true; },
    stores: { usuarios: abrir("cuentas-usuarios"), sesiones: abrir("cuentas-sesiones"), codigos: abrir("cuentas-codigos"), datos: abrir("cuentas-datos"), limites: abrir("cuentas-limites") } };
  await C.pedirCodigo(deps, { correo: "estado@correo.com", ip: "21.0.0.1" });
  const tok = (await C.verificarCodigo(deps, { consentimiento: CONS, correo: "estado@correo.com", codigo: /(\d{6})/.exec(enviados.at(-1).subject)[1], ip: "21.0.0.1" })).body.token;
  const b = codigo.split("-")[1];
  [st, j] = await llamar("../netlify/functions/estado.mjs", "GET", `/api/estado?buzon=${b}&token=${tokenB}`, null, prod(), { authorization: "Bearer " + tok });
  ok(st === 200 && j.nube && j.nube.version === 0 && j.bandeja && Array.isArray(j.bandeja.items), "estado: nube y buzón en una sola llamada");
  [st, j] = await llamar("../netlify/functions/estado.mjs", "GET", `/api/estado?buzon=${b}&token=malo`, null, prod(), { authorization: "Bearer fs_" + "x".repeat(40) });
  ok(st === 200 && j.nube.sesion === false && j.bandeja.error === 403, "estado: sesión vencida y buzón ajeno se reportan sin datos");
}

// --- Llave nueva del buzón (al mudarse de dirección) ---
{
  const kp2 = await webcrypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
  const pub2 = await webcrypto.subtle.exportKey("jwk", kp2.publicKey), b = codigo.split("-")[1];
  [st] = await llamar("../netlify/functions/bandeja.mjs", "PUT", "/api/bandeja/llave", { buzon: b, token: "z".repeat(32), pub: pub2 }, prod("30.0.0.1"));
  ok(st === 403, "sin el token del dueño no se cambia la llave");
  [st] = await llamar("../netlify/functions/bandeja.mjs", "PUT", "/api/bandeja/llave", { buzon: b, token: tokenB, pub: pub2 }, prod("30.0.0.1"));
  ok(st === 200, "el dueño cambia la llave del buzón");
  [st] = await llamar("../netlify/functions/bandeja.mjs", "POST", "/api/entrada", { codigo, texto: "Compraste $3.000 en Nueva." }, prod("30.0.0.2"));
  [, j] = await llamar("../netlify/functions/bandeja.mjs", "GET", `/api/bandeja?buzon=${b}&token=${tokenB}`);
  ok(st === 200 && j.items.length >= 1, "el mismo código de conexión sigue funcionando después de cambiar la llave");
}

// --- Mudanza: paquete cifrado, se recoge una sola vez ---
{
  const paquete = Buffer.from(webcrypto.getRandomValues(new Uint8Array(300))).toString("base64url");
  [st, j] = await llamar("../netlify/functions/mudanza.mjs", "POST", "/api/mudanza", { paquete }, prod("40.0.0.1"));
  ok(st === 200 && /^[A-Za-z0-9_-]{22}$/.test(j.id), "mudanza guardada");
  const id = j.id;
  [st, j] = await llamar("../netlify/functions/mudanza.mjs", "GET", "/api/mudanza?id=" + id, null, prod("40.0.0.2"));
  ok(st === 200 && j.paquete === paquete, "la dirección nueva recoge el paquete tal cual");
  [st] = await llamar("../netlify/functions/mudanza.mjs", "GET", "/api/mudanza?id=" + id, null, prod("40.0.0.2"));
  ok(st === 404, "el paquete solo se puede recoger una vez");
  [st] = await llamar("../netlify/functions/mudanza.mjs", "POST", "/api/mudanza", { paquete: "no es base64 {}" }, prod("40.0.0.1"));
  ok(st === 400, "rechaza paquetes que no son datos cifrados");
  const { limpiarMudanzas, direccionNueva } = await import("../netlify/lib/mudanza.mjs");
  await llamar("../netlify/functions/mudanza.mjs", "POST", "/api/mudanza", { paquete }, prod("40.0.0.1"));
  ok((await limpiarMudanzas(almacen("mudanzas", prod()), Date.now() + 31 * 60 * 1000)) === 1, "la limpieza diaria borra paquetes vencidos");
  ok(direccionNueva({ DIRECCION_NUEVA: "https://fintelligente.co/algo" }) === "https://fintelligente.co" && direccionNueva({ DIRECCION_NUEVA: "http://x.co" }) === "" && direccionNueva({}) === "", "solo acepta una dirección nueva https");
}

// --- Google por redirección: sin la cookie CSRF vuelve con error (no llega a consultar a Google) ---
{
  const r = await (await import("../netlify/functions/cuenta.mjs")).default(new Request(B + "/api/cuenta/google-redirect", { method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" }, body: "credential=abc&g_csrf_token=zzz" }), prod("50.0.0.1"));
  ok(r.status === 303 && r.headers.get("location") === "/#entrar-error=csrf", "google-redirect exige la marca CSRF en cookie");
  const [s2, j2] = await llamar("../netlify/functions/cuenta.mjs", "POST", "/api/cuenta/canjear", { codigo: "x".repeat(32) });
  ok(s2 === 400 && /ya se usó o venció/.test(j2.error), "canjear un código inexistente falla con mensaje claro");
}

await srv.stop(); fs.rmSync(dir, { recursive: true, force: true });
console.log(`funciones: ${n} verificaciones bien`);
