// PQR con radicado (Ley 1480, art. 50, literal g, modificado por la Ley 2439 de 2024): radicar, consultar con el
// mismo correo, responder desde el panel, plazos en días hábiles, límites y limpieza a los 3 años.
import * as PQ from "../netlify/lib/pqr.mjs";
import { memStore } from "./memoria.mjs";
let fallas = 0; const ok = (c, m) => { if (!c) { fallas++; console.log("FALLA:", m); } else console.log("ok -", m); };
const store = memStore(), limites = memStore(), correos = [];
const mandar = async (m) => { correos.push(m); return true; };
const env = { PANEL_CLAVE: "clave-de-prueba-del-panel" };
// Lunes 16 de noviembre de 2026, 3:20 p. m. de Colombia (20:20 UTC)
const lunes = Date.UTC(2026, 10, 16, 20, 20);

ok(PQ.normalizarRadicado("pqr 20261116 abcd23") === "PQR-20261116-ABCD23" && PQ.normalizarRadicado("PQR-2026-X") === "", "normaliza el radicado y rechaza formatos que no son");
ok(/^PQR-20261116-[A-HJ-NP-Z2-9]{6}$/.test(PQ.nuevoRadicado(lunes)), "el radicado lleva la fecha de Colombia");
ok(PQ.nuevoRadicado(Date.UTC(2026, 10, 17, 3, 0)).startsWith("PQR-20261116-"), "a las 10 p. m. de Colombia sigue siendo el mismo día (no el de UTC)");
ok(PQ.textoFecha(lunes) === "16 de noviembre de 2026, 3:20 p. m.", "fecha y hora en español, hora de Colombia: " + PQ.textoFecha(lunes));
const v15 = PQ.sumarHabiles(lunes, 15);
ok(PQ.textoFecha(v15).startsWith("7 de diciembre de 2026"), "15 días hábiles desde el lunes 16 de noviembre: lunes 7 de diciembre (" + PQ.textoFecha(v15) + ")");
ok(PQ.textoFecha(PQ.sumarHabiles(Date.UTC(2026, 10, 20, 20, 0), 1)).startsWith("23 de noviembre"), "un día hábil desde un viernes cae el lunes");

const base = { store, limites, ip: "1.1.1.1", enviarCorreo: mandar, avisarA: "duenos@finti.co", ahora: lunes };
let r = await PQ.crearPqr({ ...base, body: { tipo: "otro", nombre: "Ana", correo: "ana@correo.com", mensaje: "Hola, tengo una duda", acepto: true } });
ok(r.status === 400, "rechaza un tipo desconocido");
r = await PQ.crearPqr({ ...base, body: { tipo: "reclamo", nombre: "Ana", correo: "ana@correo", mensaje: "Hola, tengo una duda", acepto: true } });
ok(r.status === 400 && /correo/.test(r.body.error), "pide un correo válido");
r = await PQ.crearPqr({ ...base, body: { tipo: "reclamo", nombre: "Ana", correo: "ana@correo.com", mensaje: "corto", acepto: true } });
ok(r.status === 400, "pide un mensaje de al menos 10 caracteres");
r = await PQ.crearPqr({ ...base, body: { tipo: "reclamo", nombre: "Ana", correo: "ana@correo.com", mensaje: "Me cobraron dos veces Premium", acepto: false } });
ok(r.status === 400 && /autorización/.test(r.body.error), "sin autorización de datos no radica");
r = await PQ.crearPqr({ ...base, body: { tipo: "reclamo", nombre: "Ana", correo: "ana@correo.com", mensaje: "Me cobraron dos veces Premium", acepto: true, web: "http://spam" } });
ok(r.status === 200 && !r.body.radicado && store._m.size === 0, "la trampa para robots no crea nada");

r = await PQ.crearPqr({ ...base, body: { tipo: "reclamo", nombre: " Ana  Pérez ", correo: "Ana@Correo.com", mensaje: "Me cobraron dos veces Premium.\nReferencia FIN-123", ref: "FT-ABC", acepto: true } });
const rad = r.body.radicado;
ok(r.status === 200 && /^PQR-20261116-/.test(rad) && r.body.estado === "Recibida" && r.body.recibidoTexto === "16 de noviembre de 2026, 3:20 p. m.", "radica con número, fecha y hora: " + rad);
ok(r.body.venceTexto === "7 de diciembre de 2026" && r.body.correoEnviado === true, "informa la fecha límite y envía el correo de recibo");
const recibo = correos.find((m) => m.to === "ana@correo.com");
ok(recibo && recibo.subject.includes(rad) && recibo.text.includes("Recibida: 16 de noviembre de 2026, 3:20 p. m.") && recibo.html.includes("Ana Pérez"), "el correo de recibo trae el radicado, la fecha y la hora");
ok(correos.some((m) => m.to === "duenos@finti.co" && m.subject.includes(rad)), "avisa a los dueños");
ok(!JSON.stringify(r.body).includes("ana@correo.com"), "la respuesta no devuelve el correo");
const datos = await PQ.crearPqr({ ...base, ip: "2.2.2.2", body: { tipo: "datos", nombre: "Leo", correo: "leo@correo.com", mensaje: "¿Qué datos míos tienen guardados?", acepto: true } });
ok(datos.body.venceTexto === "30 de noviembre de 2026", "las consultas de datos personales vencen en 10 días hábiles (" + datos.body.venceTexto + ")");

let c = await PQ.consultarPqr({ store, limites, radicado: rad.toLowerCase(), correo: "ANA@correo.com ", ip: "3.3.3.3" });
ok(c.status === 200 && c.body.estado === "Recibida" && c.body.radicado === rad, "se consulta con el radicado y el mismo correo (sin importar mayúsculas)");
c = await PQ.consultarPqr({ store, limites, radicado: rad, correo: "otra@correo.com", ip: "3.3.3.3" });
ok(c.status === 404, "con otro correo no muestra nada");

let p = await PQ.listarPqr({ store, limites, env, autorizacion: "Bearer mala", ip: "4.4.4.4" });
ok(p.status === 401, "el panel pide la clave");
p = await PQ.listarPqr({ store, limites, env, autorizacion: "Bearer clave-de-prueba-del-panel", ip: "4.4.4.4", ahora: lunes });
ok(p.status === 200 && p.body.pqr.length === 2 && p.body.pqr[0].tipo === "datos", "el panel lista las PQR, primero la que vence antes");
p = await PQ.responderPqr({ store, limites, env, autorizacion: "Bearer clave-de-prueba-del-panel", ip: "4.4.4.4", radicado: rad, texto: "Ya revisamos: te devolvimos el segundo cobro.", enviarCorreo: mandar, ahora: lunes + 3600e3 });
ok(p.status === 200 && p.body.estado === "Respondida" && p.body.respuestas.length === 1 && p.body.correoEnviado, "responder cambia el estado a Respondida y envía la respuesta por correo");
c = await PQ.consultarPqr({ store, limites, radicado: rad, correo: "ana@correo.com", ip: "3.3.3.3" });
ok(c.body.respuestas[0].texto.includes("segundo cobro"), "la persona ve la respuesta en el seguimiento");
p = await PQ.listarPqr({ store, limites, env, autorizacion: "Bearer clave-de-prueba-del-panel", ip: "4.4.4.4", ahora: Date.UTC(2026, 11, 2) });
ok(p.body.pqr.find((x) => x.tipo === "datos").vencida === true && p.body.pqr.find((x) => x.radicado === rad).vencida === false, "el panel marca las vencidas sin respuesta");

let n = 0; for (let i = 0; i < 6; i++) { const x = await PQ.crearPqr({ ...base, ip: "9.9.9.9", body: { tipo: "peticion", nombre: "Bot", correo: "b@c.co", mensaje: "mensaje de prueba repetido", acepto: true } }); if (x.status === 429) n++; }
ok(n === 1, "máximo 5 PQR por hora desde la misma conexión");

const borradas = await PQ.limpiarPqr(store, lunes + PQ.CONSERVAR_MS + 7200e3);
ok(borradas >= 2 && store._m.size === 0, "a los 3 años sin actuaciones se borran (" + borradas + ")");

console.log(fallas ? fallas + " fallas" : "todo bien"); process.exit(fallas ? 1 : 0);
