// Peticiones, quejas y reclamos (PQR) con número de radicado.
// Ley 1480 de 2011, artículo 50, literal g (modificado por la Ley 2439 de 2024): quien vende por internet debe
// atender en la misma plataforma, dar un número de radicado con la fecha y hora de cada reclamo, y permitir su
// seguimiento. También sirve para las consultas y reclamos de datos personales (Ley 1581 de 2012).
// - POST /api/pqr crea la PQR y devuelve el radicado (PQR-AAAAMMDD-XXXXXX), la fecha y hora, y la fecha límite.
// - GET /api/pqr?radicado=&correo= muestra el estado solo a quien da el mismo correo (no permite adivinar radicados).
// - El panel (PANEL_CLAVE) lista las PQR y responde; cada respuesta llega por correo.
// Se conservan 3 años desde la última actuación (lo dice la política de datos) y luego se borran.
import crypto from "node:crypto";
import { actualizar, crearSiNoExiste, limitar } from "./atomico.mjs";
import { claveValida } from "./telemetria.mjs";

export const TIPOS = {
  peticion: "Petición", queja: "Queja", reclamo: "Reclamo", retracto: "Retracto o devolución",
  datos: "Mis datos personales", sugerencia: "Sugerencia",
};
// Plazos en días hábiles: consultas de datos 10 (Ley 1581, art. 14); lo demás 15 (Ley 1581, art. 15, y Ley 1480).
const PLAZO = { datos: 10 };
export const ESTADOS = ["Recibida", "En trámite", "Respondida", "Cerrada"];
const HORA = 3600 * 1000, DIA = 24 * HORA;
export const CONSERVAR_MS = 3 * 365 * DIA;
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CORREO = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

const limpio = (t, max) => String(t == null ? "" : t).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\r\n?/g, "\n").trim().slice(0, max);
const unaLinea = (t, max) => limpio(t, max).replace(/\s+/g, " ");
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

// Fecha y hora de Colombia (UTC-5, sin horario de verano), para el radicado y los correos.
export function fechaCol(ms) { return new Date(ms - 5 * HORA); }
export function textoFecha(ms) {
  const d = fechaCol(ms), dos = (n) => String(n).padStart(2, "0");
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  let h = d.getUTCHours(); const m = h < 12 ? "a. m." : "p. m."; h = h % 12 || 12;
  return `${d.getUTCDate()} de ${meses[d.getUTCMonth()]} de ${d.getUTCFullYear()}, ${h}:${dos(d.getUTCMinutes())} ${m}`;
}
// Suma días hábiles (lunes a viernes). No descuenta festivos: la fecha que se muestra es la más exigente.
export function sumarHabiles(ms, dias) {
  let d = fechaCol(ms), n = 0;
  while (n < dias) { d = new Date(d.getTime() + DIA); const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return d.getTime() + 5 * HORA;
}
export function nuevoRadicado(ms) {
  const d = fechaCol(ms), dos = (n) => String(n).padStart(2, "0");
  let s = ""; for (const x of crypto.randomBytes(6)) s += ALFABETO[x % ALFABETO.length];
  return `PQR-${d.getUTCFullYear()}${dos(d.getUTCMonth() + 1)}${dos(d.getUTCDate())}-${s}`;
}
export function normalizarRadicado(r) {
  const s = String(r || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = /^(?:PQR)?(\d{8})([A-HJ-NP-Z2-9]{6})$/.exec(s);
  return m ? `PQR-${m[1]}-${m[2]}` : "";
}
const clave = (radicado) => "pqr/" + radicado;

// Lo que ve la persona: nunca el correo completo ni notas internas.
function vista(x) {
  return {
    radicado: x.radicado, tipo: x.tipo, tipoNombre: TIPOS[x.tipo] || x.tipo, estado: x.estado,
    recibido: x.recibido, recibidoTexto: textoFecha(x.recibido), vence: x.vence, venceTexto: textoFecha(x.vence).replace(/,.*$/, ""),
    respuestas: (x.respuestas || []).map((r) => ({ t: r.t, tTexto: textoFecha(r.t), texto: r.texto })),
  };
}

function correoRecibo(x) {
  const lineas = [
    `Hola, ${x.nombre}. Recibimos tu solicitud.`,
    `Radicado: ${x.radicado}`, `Tipo: ${TIPOS[x.tipo]}`, `Recibida: ${textoFecha(x.recibido)} (hora de Colombia)`,
    `Te respondemos a más tardar el ${textoFecha(x.vence).replace(/,.*$/, "")}.`,
    "Puedes consultar el estado en la app, en el menú, Ayuda y PQR, con este radicado y tu correo.",
    "", "Lo que nos escribiste:", x.mensaje,
  ];
  return {
    subject: `Recibimos tu solicitud ${x.radicado}`,
    text: lineas.join("\n"),
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#14121f">` +
      `<p>Hola, ${esc(x.nombre)}. Recibimos tu solicitud.</p>` +
      `<p><b>Radicado:</b> ${esc(x.radicado)}<br><b>Tipo:</b> ${esc(TIPOS[x.tipo])}<br><b>Recibida:</b> ${esc(textoFecha(x.recibido))} (hora de Colombia)</p>` +
      `<p>Te respondemos a más tardar el <b>${esc(textoFecha(x.vence).replace(/,.*$/, ""))}</b>. Puedes consultar el estado en la app, en el menú, <i>Ayuda y PQR</i>, con este radicado y tu correo.</p>` +
      `<p style="color:#5b576b">Lo que nos escribiste:</p><blockquote style="margin:0;padding:8px 12px;border-left:3px solid #2e5bff;white-space:pre-wrap">${esc(x.mensaje)}</blockquote></div>`,
  };
}
function esc(t) { return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

export async function crearPqr({ store, limites, body, ip, enviarCorreo, avisarA, ahora = Date.now() }) {
  const b = body || {};
  if (b.web) return { status: 200, body: { ok: true } };   // trampa para robots: un campo oculto que nadie llena
  const tipo = String(b.tipo || "");
  const nombre = unaLinea(b.nombre, 80), correo = unaLinea(b.correo, 254).toLowerCase(), mensaje = limpio(b.mensaje, 3000), ref = unaLinea(b.ref, 40);
  if (!TIPOS[tipo]) return { status: 400, body: { error: "Elige el tipo de solicitud." } };
  if (nombre.length < 2) return { status: 400, body: { error: "Escribe tu nombre." } };
  if (!CORREO.test(correo)) return { status: 400, body: { error: "Escribe un correo válido: ahí te llega el radicado y la respuesta." } };
  if (mensaje.length < 10) return { status: 400, body: { error: "Cuéntanos un poco más (mínimo 10 caracteres)." } };
  if (!b.acepto) return { status: 400, body: { error: "Para atenderte necesitamos tu autorización para usar estos datos." } };
  if (limites && !(await limitar(limites, "pqr:" + (ip || "?"), 5, HORA, ahora))) return { status: 429, body: { error: "Ya enviaste varias solicitudes. Intenta de nuevo en una hora." } };
  const vence = sumarHabiles(ahora, PLAZO[tipo] || 15);
  let x = null;
  for (let i = 0; i < 5 && !x; i++) {
    const r = nuevoRadicado(ahora);
    const reg = { radicado: r, tipo, nombre, correo, mensaje, ref, recibido: ahora, vence, estado: "Recibida",
      historial: [{ t: ahora, estado: "Recibida" }], respuestas: [], actualizado: ahora };
    if (await crearSiNoExiste(store, clave(r), reg)) x = reg;
  }
  if (!x) return { status: 503, body: { error: "No pudimos radicar tu solicitud. Intenta de nuevo." } };
  let correoEnviado = false;
  if (enviarCorreo) {
    try { correoEnviado = !!(await enviarCorreo({ to: correo, ...correoRecibo(x) })); } catch { /* el radicado ya existe */ }
    if (avisarA) {
      try { await enviarCorreo({ to: avisarA, subject: `Nueva ${TIPOS[tipo].toLowerCase()} ${x.radicado}`, text: `${x.radicado}\n${TIPOS[tipo]}\n${nombre} <${correo}>\nReferencia: ${ref || "(ninguna)"}\nVence: ${textoFecha(vence)}\n\n${mensaje}`, html: "" }); } catch { /* aviso interno */ }
    }
  }
  return { status: 200, body: { ...vista(x), correoEnviado } };
}

export async function consultarPqr({ store, limites, radicado, correo, ip, ahora = Date.now() }) {
  if (limites && !(await limitar(limites, "pqr-ver:" + (ip || "?"), 30, HORA, ahora))) return { status: 429, body: { error: "Demasiadas consultas. Intenta más tarde." } };
  const r = normalizarRadicado(radicado), c = String(correo || "").trim().toLowerCase();
  const x = r ? await store.get(clave(r), { type: "json" }) : null;
  const igual = x && crypto.timingSafeEqual(Buffer.from(sha(x.correo)), Buffer.from(sha(c)));
  if (!igual) return { status: 404, body: { error: "No encontramos una solicitud con ese radicado y ese correo." } };
  return { status: 200, body: vista(x) };
}

async function autorizar({ env, autorizacion, limites, ip, ahora }) {
  const ok = claveValida(env, String(autorizacion || "").replace(/^Bearer\s+/i, ""));
  if (ok === null) return { status: 503, body: { error: "Falta configurar PANEL_CLAVE (mínimo 16 caracteres) en las llaves del servidor." } };
  if (!ok) { if (limites) await limitar(limites, "panel:" + (ip || "?"), 10, HORA, ahora); return { status: 401, body: { error: "Clave incorrecta." } }; }
  return null;
}

// Panel: todas las PQR, las abiertas primero y por fecha límite.
export async function listarPqr({ store, limites, env, autorizacion, ip, ahora = Date.now() }) {
  const no = await autorizar({ env, autorizacion, limites, ip, ahora }); if (no) return no;
  const lista = [];
  for (const { key } of (await store.list({ prefix: "pqr/" })).blobs) {
    const x = await store.get(key, { type: "json" });
    if (x) lista.push({ ...vista(x), nombre: x.nombre, correo: x.correo, ref: x.ref, mensaje: x.mensaje, vencida: x.estado !== "Respondida" && x.estado !== "Cerrada" && x.vence < ahora });
  }
  const abierta = (x) => (x.estado === "Respondida" || x.estado === "Cerrada" ? 1 : 0);
  lista.sort((a, b) => abierta(a) - abierta(b) || a.vence - b.vence);
  return { status: 200, body: { pqr: lista } };
}

// Panel: cambiar el estado y, si hay texto, responder (la respuesta llega por correo y queda en el seguimiento).
export async function responderPqr({ store, limites, env, autorizacion, ip, radicado, estado, texto, enviarCorreo, ahora = Date.now() }) {
  const no = await autorizar({ env, autorizacion, limites, ip, ahora }); if (no) return no;
  const r = normalizarRadicado(radicado), t = limpio(texto, 4000);
  if (!r) return { status: 400, body: { error: "Radicado inválido." } };
  if (estado && !ESTADOS.includes(estado)) return { status: 400, body: { error: "Estado inválido." } };
  if (!estado && !t) return { status: 400, body: { error: "Escribe la respuesta o elige un estado." } };
  const { valor } = await actualizar(store, clave(r), (x) => {
    if (!x) return undefined;
    if (t) x.respuestas.push({ t: ahora, texto: t });
    const nuevo = estado || (t ? "Respondida" : x.estado);
    if (nuevo !== x.estado) { x.estado = nuevo; x.historial.push({ t: ahora, estado: nuevo }); }
    x.actualizado = ahora;
    return x;
  });
  if (!valor || valor.radicado !== r) return { status: 404, body: { error: "No existe ese radicado." } };
  let correoEnviado = false;
  if (t && enviarCorreo) {
    try {
      correoEnviado = !!(await enviarCorreo({ to: valor.correo, subject: `Respuesta a tu solicitud ${r}`,
        text: `Hola, ${valor.nombre}.\n\n${t}\n\nRadicado: ${r}. Estado: ${valor.estado}.\nSi no quedas satisfecho, puedes responder este correo o acudir a la Superintendencia de Industria y Comercio (www.sic.gov.co).`,
        html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#14121f"><p>Hola, ${esc(valor.nombre)}.</p><p style="white-space:pre-wrap">${esc(t)}</p><p style="color:#5b576b">Radicado: ${esc(r)}. Estado: ${esc(valor.estado)}.<br>Si no quedas satisfecho, puedes responder este correo o acudir a la Superintendencia de Industria y Comercio (www.sic.gov.co).</p></div>` }));
    } catch { /* la respuesta ya quedó guardada */ }
  }
  return { status: 200, body: { ...vista(valor), correoEnviado } };
}

// Limpieza: borra las PQR sin actuaciones en 3 años.
export async function limpiarPqr(store, ahora = Date.now()) {
  let n = 0;
  for (const { key } of (await store.list({ prefix: "pqr/" })).blobs) {
    const x = await store.get(key, { type: "json" });
    if (!x || ahora - (x.actualizado || x.recibido || 0) > CONSERVAR_MS) { await store.delete(key); n++; }
  }
  return n;
}
