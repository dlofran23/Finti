// Códigos de regalo de Premium: los crea el dueño con la clave del panel, se ven una sola vez, cada uno sirve una vez
// y quien lo canjea recibe la misma licencia que con un pago.
import * as RG from "../netlify/lib/regalos.mjs";
import * as P from "../netlify/lib/pagos.mjs";
import * as TE from "../netlify/lib/telemetria.mjs";
import { memStore } from "./memoria.mjs";
let fallas = 0; const ok = (c, m) => { if (!c) { fallas++; console.log("FALLA:", m); } else console.log("ok -", m); };
const env = { PANEL_CLAVE: "clave-de-prueba-del-panel" }, AUT = "Bearer clave-de-prueba-del-panel";
const cfg = P.leerConfig({ LICENSE_SECRET: "s3cr3t" });
const store = memStore(), pagos = memStore(), limites = memStore(), salud = memStore();
const base = { store, limites, env, ip: "1.1.1.1" };

ok(RG.normalizarCodigo(" fin abcde-fghjk ") === "FIN-ABCDE-FGHJK" && RG.normalizarCodigo("ABCDEFGHJK") === "FIN-ABCDE-FGHJK", "acepta el código en minúsculas, con espacios o sin FIN");
ok(RG.normalizarCodigo("FIN-ABCDE-FGHJ0") === "" && RG.normalizarCodigo("FIN-1234") === "", "rechaza formatos que no son");
ok(/^FIN-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/.test(RG.nuevoCodigo()), "formato FIN-XXXXX-XXXXX sin letras que se confunden");

// Crear: solo con la clave
ok((await RG.crearRegalos({ ...base, autorizacion: "Bearer otra", n: 10 })).status === 401, "sin la clave no se crean");
ok((await RG.crearRegalos({ ...base, env: {}, autorizacion: AUT, n: 10 })).status === 503, "sin PANEL_CLAVE configurada no se crean");
ok((await RG.crearRegalos({ ...base, autorizacion: AUT, n: 201 })).status === 400, "máximo 200 a la vez");
let r = await RG.crearRegalos({ ...base, autorizacion: AUT, n: 10, nota: "Familia <b>navidad</b>" });
const codigos = r.body.codigos;
ok(r.status === 200 && codigos.length === 10 && new Set(codigos).size === 10, "crea 10 códigos distintos");
const guardado = JSON.stringify([...store._m.values()]);
ok(!codigos.some((c) => guardado.includes(c)), "el servidor no guarda los códigos, solo su huella");
r = await RG.listarRegalos({ ...base, autorizacion: AUT });
ok(r.body.libres === 10 && r.body.regalos.every((x) => x.estado === "libre" && x.nota === "Familia b navidad /b"), "lista: 10 libres, con la nota limpia");
ok(r.body.regalos.some((x) => x.pista === codigos[0].slice(-4)), "cada uno se reconoce por sus últimos 4 caracteres");

// Canjear
let c = await RG.canjearRegalo({ store, pagos, limites, cfg, codigo: codigos[0].toLowerCase(), email: "Ana@Correo.com", ip: "2.2.2.2", alCanjear: () => TE.contarEnServidor(salud, "regalo") });
ok(c.status === 200 && P.refValida(c.body.ref) && c.body.token === P.tokenLicencia(c.body.ref, "s3cr3t"), "canjear entrega una licencia válida");
const pago = await pagos.get(c.body.ref, { type: "json" });
ok(pago.estado === "APROBADO" && pago.origen === "regalo" && pago.monto === 0 && pago.email === "ana@correo.com", "queda como pago aprobado de origen regalo, valor 0");
const lic = await P.consultarLicencia({ store: pagos, cfg, ref: c.body.ref, token: c.body.token });
ok(lic.body.valido === true, "la revisión diaria de la licencia la acepta");
const otra = await P.consultarLicencia({ store: pagos, cfg, ref: c.body.ref, email: "ana@correo.com" });
ok(otra.body.estado === "APROBADO" && otra.body.token === c.body.token, "se puede activar en otro dispositivo con la referencia y el correo");
ok(Object.values(Object.values(Object.fromEntries([...salud._m.entries()].map(([k, v]) => [k, JSON.parse(v.v)])))[0].regalo || {}).reduce((a, b) => a + b, 0) === 1, "se cuenta en las métricas");
ok((await RG.canjearRegalo({ store, pagos, limites, cfg, codigo: codigos[0], email: "otro@correo.com", ip: "3.3.3.3" })).status === 409, "un código sirve una sola vez");
ok((await RG.canjearRegalo({ store, pagos, limites, cfg, codigo: "FIN-ZZZZZ-ZZZZZ", email: "a@b.co", ip: "3.3.3.3" })).status === 404, "un código que no existe");
ok((await RG.canjearRegalo({ store, pagos, limites, cfg, codigo: codigos[1], email: "sin-correo", ip: "3.3.3.3" })).status === 400, "pide un correo válido");
ok((await RG.canjearRegalo({ store, pagos, limites, cfg: P.leerConfig({}), codigo: codigos[1], email: "a@b.co", ip: "3.3.3.3" })).status === 503, "sin LICENSE_SECRET no canjea");

// Anular
r = await RG.listarRegalos({ ...base, autorizacion: AUT });
const usado = r.body.regalos.find((x) => x.estado === "usado"), libre = r.body.regalos.find((x) => x.pista === codigos[2].slice(-4));
ok(usado && usado.usado && r.body.usados === 1 && r.body.libres === 9, "la lista muestra cuál se usó y cuándo");
ok((await RG.anularRegalo({ ...base, autorizacion: AUT, id: usado.id })).status === 409, "uno usado no se puede anular");
ok((await RG.anularRegalo({ ...base, autorizacion: "Bearer x", id: libre.id })).status === 401, "anular pide la clave");
ok((await RG.anularRegalo({ ...base, autorizacion: AUT, id: libre.id })).status === 200, "anula uno libre");
ok((await RG.canjearRegalo({ store, pagos, limites, cfg, codigo: codigos[2], email: "a@b.co", ip: "4.4.4.4" })).status === 410, "un código anulado ya no sirve");

// Fuerza bruta
let frenado = 0;
for (let i = 0; i < 12; i++) if ((await RG.canjearRegalo({ store, pagos, limites, cfg, codigo: RG.nuevoCodigo(), email: "a@b.co", ip: "6.6.6.6" })).status === 429) frenado++;
ok(frenado === 2, "frena a quien prueba muchos códigos (" + frenado + ")");
ok((await TE.registrarMetrica({ store: salud, limites, body: { e: "regalo", p: "pc" }, ip: "7.7.7.7" })).status === 400, "la página no puede contar regalos por su cuenta");

console.log(fallas ? "FALLAS: " + fallas : "TODO BIEN (regalos)");
process.exitCode = fallas ? 1 : 0;
