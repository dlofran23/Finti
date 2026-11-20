// Avisos de Finti: pagos por vencer, recordatorio suave de registro y un consejo semanal.
// Lógica pura (sin dependencias de Netlify) para poder probarla: el almacén, el envío de push y el de correo llegan por parámetro.
import crypto from "node:crypto";

export const CONSEJOS = [
  ["Págate primero", "Apenas recibas tu ingreso, pasa tu ahorro a otra cuenta o bolsillo. Lo que no ves, no lo gastas."],
  ["La regla de las 24 horas", "Antes de una compra que no tenías planeada, espera un día. Si al otro día la sigues queriendo, cómprala sin culpa."],
  ["Gastos hormiga", "Un tinto, un domicilio, una app: pequeños, pero juntos pesan. Revisa esta semana cuánto suman los tuyos."],
  ["Fondo de emergencia", "La meta es reunir de 3 a 6 meses de tus gastos básicos. Empieza con algo pequeño, pero empieza."],
  ["Tarjeta de crédito", "Paga el total del mes y no solo el mínimo: el mínimo es la forma más cara de usar la tarjeta."],
  ["Suscripciones", "Revisa qué servicios pagas cada mes y cancela los que no usaste en las últimas semanas."],
  ["Regla 50/30/20", "Una guía sencilla: 50 % para necesidades, 30 % para gustos y 20 % para ahorro o deudas."],
  ["Revisión semanal", "Diez minutos el domingo para mirar tus gastos de la semana valen más que una hora a fin de mes."],
  ["Compras en el mercado", "Haz lista antes de ir y no vayas con hambre: son dos de los trucos más simples para gastar menos."],
  ["Deudas", "Si tienes varias deudas, ataca primero la de tasa más alta (avalancha) o la más pequeña (bola de nieve). Lo importante es tener un orden."],
  ["Metas con nombre", "Una meta llamada Viaje a Santa Marta motiva más que una que solo dice ahorro. Ponle nombre y fecha a cada meta."],
  ["Ingresos extra", "Cuando te llegue una prima o un ingreso extra, decide antes de recibirlo qué parte va a ahorro."]
];

const sha = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
export const hmac = (secret, txt) => crypto.createHmac("sha256", secret).update(String(txt)).digest("base64url");
const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const texto = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n);

// ---------- Validación del perfil que envía la app ----------
export function validarPerfil(b) {
  if (!b || typeof b !== "object") return { error: "Datos inválidos." };
  if (!/^[a-z0-9]{20}$/.test(b.id || "") || !/^[a-z0-9]{32}$/.test(b.token || "")) return { error: "Identificador inválido." };
  let push = null;
  if (b.push && typeof b.push === "object") {
    const ep = String(b.push.endpoint || ""), k = b.push.keys || {};
    if (!/^https:\/\/[^\s]{10,800}$/.test(ep) || typeof k.p256dh !== "string" || typeof k.auth !== "string" || k.p256dh.length > 200 || k.auth.length > 100)
      return { error: "Suscripción de notificaciones inválida." };
    push = { endpoint: ep, keys: { p256dh: k.p256dh, auth: k.auth } };
  }
  const email = String(b.email || "").trim().toLowerCase();
  if (email && !/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email)) return { error: "Correo inválido." };
  const lic = b.licencia && /^PRE-[A-Z2-9]{12}$/.test(b.licencia.ref || "") && typeof b.licencia.token === "string" ? { ref: b.licencia.ref, token: b.licencia.token.slice(0, 100) } : null;
  const pagos = (Array.isArray(b.pagos) ? b.pagos : []).slice(0, 40).map((p) => ({
    n: texto(p && p.n, 60) || "Pago",
    m: Math.max(0, Math.round(Number(p && p.m) || 0)),
    f: ["mensual", "anual", "unica"].includes(p && p.f) ? p.f : "mensual",
    d: Math.min(31, Math.max(1, Math.round(Number(p && p.d) || 1))),
    fe: esFecha(p && p.fe) ? p.fe : "",
    a: Math.min(15, Math.max(0, Math.round(Number(p && p.a) || 0))),
    c: esFecha(p && p.c) ? p.c : "",
    p: (Array.isArray(p && p.p) ? p.p : []).filter((k) => /^(\d{4}(-\d{2})?|u)$/.test(k)).slice(-6),
  }));
  return {
    perfil: {
      id: b.id, tokenHash: sha(b.token), push, email, licencia: lic,
      tz: Math.max(-720, Math.min(840, Math.round(Number(b.tz) || -300))),
      hora: Math.min(20, Math.max(18, Math.round(Number(b.hora) || 20))),
      consejos: b.consejos === "nunca" ? "nunca" : "semanal",
      efectivo: b.efectivo === true,
      manana: b.manana === true,
      // Preguntas pendientes de lo que la persona contó: solo cuántas son, nunca su contenido.
      dudas: Math.min(9, Math.max(0, Math.round(Number(b.dudas) || 0))),
      preguntar: b.preguntar !== false,
      ultimo: esFecha(b.ultimo) ? b.ultimo : "",
      pagos,
    },
  };
}
export const tokenValido = (perfil, token) => !!perfil && perfil.tokenHash === sha(token);

// ---------- Fechas en la hora local de la persona (como días UTC para no depender del servidor) ----------
const DIA = 864e5;
export function ahoraLocal(now, tz) {
  const t = new Date(now.getTime() + tz * 60000);
  const fecha = t.toISOString().slice(0, 10);
  const hoy = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  const jan = Date.UTC(t.getUTCFullYear(), 0, 1);
  return { fecha, hora: t.getUTCHours(), dow: t.getUTCDay(), hoy, semana: t.getUTCFullYear() * 100 + Math.floor((hoy - jan) / (7 * DIA)), diaNum: Math.floor(hoy / DIA) };
}
const fd = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
function occ(p, k) {
  if (p.f === "mensual") { const y = +k.slice(0, 4), m = +k.slice(5, 7); return Date.UTC(y, m - 1, Math.min(p.d, dim(y, m))); }
  const f = p.fe ? new Date(fd(p.fe)) : null;
  if (!f) return null;
  if (p.f === "anual") return Date.UTC(+k, f.getUTCMonth(), Math.min(f.getUTCDate(), dim(+k, f.getUTCMonth() + 1)));
  return f.getTime();
}
function keyDe(p, t) { const d = new Date(t); return p.f === "mensual" ? d.toISOString().slice(0, 7) : p.f === "anual" ? String(d.getUTCFullYear()) : "u"; }
function sigKey(p, k, n) {
  if (p.f === "mensual") { const y = +k.slice(0, 4), m = +k.slice(5, 7) - 1 + n; const d = new Date(Date.UTC(y, m, 1)); return d.toISOString().slice(0, 7); }
  if (p.f === "anual") return String(+k + n);
  return null;
}
// Mismo criterio que la app: el ciclo pendiente más antiguo (el anterior solo si existía la cuenta).
export function estadoPago(p, hoy) {
  const pagados = new Set(p.p), creado = p.c ? fd(p.c) : hoy;
  let k = keyDe(p, hoy);
  if (p.f !== "unica") {
    const kp = sigKey(p, k, -1), dp = occ(p, kp);
    if (dp != null && !pagados.has(kp) && dp >= creado) return { key: kp, due: dp, pagado: false, dias: Math.round((dp - hoy) / DIA) };
  }
  let due = occ(p, k);
  if (due == null) return null;
  if (p.f !== "unica" && !pagados.has(k) && due < creado) { k = sigKey(p, k, 1); due = occ(p, k); }
  if (pagados.has(k)) return { key: k, due, pagado: true, dias: null };
  return { key: k, due, pagado: false, dias: Math.round((due - hoy) / DIA) };
}

const pesos = (n) => "$ " + Math.round(n).toLocaleString("es-CO");
const cuando = (d) => (d < 0 ? "venció " + (d === -1 ? "ayer" : "hace " + -d + " días") : d === 0 ? "vence hoy" : d === 1 ? "vence mañana" : "vence en " + d + " días");

// ---------- Qué mensajes tocan ahora ----------
// Reglas contra el cansancio: Nada entre 9 p. m. y 7 a. m., máximo 2 notificaciones al día,
// el recordatorio de registro solo si no registró nada hoy y se espacia si la persona lleva días sin entrar.
export const HORA_PAGOS = 8, HORA_CONSEJO = 10, MAX_DIA = 2;
// Aviso de la mañana: el servidor solo dice "es hora"; la cifra la calcula el service worker en el celular.
export const HORA_MANANA = 7;
// Preguntas pendientes: a mediodía, como mucho una vez cada dos días y solo si ese día la persona no ha abierto la app.
// El texto de la pregunta lo arma el service worker en el celular; el servidor solo sabe que hay alguna.
export const HORA_DUDAS = 13;
export function planificar(perfil, now) {
  const L = ahoraLocal(now, perfil.tz), out = [];
  if (L.hora < 7 || L.hora >= 21) return { L, mensajes: out };
  const env = perfil.enviados || {};
  if (L.hora === HORA_PAGOS) {
    const due = [];
    for (const p of perfil.pagos) {
      const e = estadoPago(p, L.hoy);
      if (!e || e.pagado) continue;
      if (e.dias === 0 || e.dias === -1 || (p.a > 0 && e.dias === p.a)) {
        const clave = "pago:" + sha(p.n).slice(0, 10) + ":" + e.key + ":" + e.dias;
        if (!env[clave]) due.push({ p, e, clave });
      }
    }
    if (due.length) {
      due.sort((a, b) => a.e.dias - b.e.dias);
      const x = due[0];
      out.push({
        tipo: "pagos", claves: due.map((d) => d.clave), url: "/#cuentas",
        titulo: due.length === 1 ? `${x.p.n} ${cuando(x.e.dias)}` : `Tienes ${due.length} pagos cerca`,
        cuerpo: due.map((d) => `${d.p.n}: ${pesos(d.p.m)}, ${cuando(d.e.dias)}.`).join(" "),
        lista: due.map((d) => ({ n: d.p.n, m: d.p.m, txt: cuando(d.e.dias) })),
      });
    }
  }
  if (perfil.manana && perfil.push && L.hora === HORA_MANANA && !env["manana:" + L.fecha]) {
    out.push({
      tipo: "manana", claves: ["manana:" + L.fecha], url: "/#inicio", push: true,
      titulo: "Tu día empieza",
      cuerpo: "Toca aquí para ver cuánto puedes gastar hoy.",
    });
  }
  if (perfil.preguntar && perfil.dudas > 0 && perfil.push && L.hora === HORA_DUDAS && perfil.ultimo !== L.fecha) {
    const ayer = new Date(L.hoy - DIA).toISOString().slice(0, 10);
    if (!env["dudas:" + L.fecha] && !env["dudas:" + ayer]) out.push({
      tipo: "dudas", claves: ["dudas:" + L.fecha], url: "/#accion=dudas", push: true,
      titulo: "Me quedó una duda",
      cuerpo: perfil.dudas === 1 ? "¿Me ayudas con un dato de lo que me contaste? Es un momento." : "Tengo " + perfil.dudas + " preguntas cortas de lo que me contaste. ¿Me ayudas?",
    });
  }
  // Pregunta de cada noche por el efectivo (la persona la pidió): todos los días a su hora, abre Cuéntame un gasto.
  // Reemplaza el recordatorio general de registro.
  if (perfil.efectivo && L.hora === perfil.hora && !env["efectivo:" + L.fecha]) {
    out.push({
      tipo: "efectivo", claves: ["efectivo:" + L.fecha], url: "/#accion=charla", push: true,
      titulo: "¿Gastaste algo en efectivo hoy?",
      cuerpo: perfil.ultimo === L.fecha ? "Si pagaste algo en efectivo, dímelo o escríbelo y lo anoto en un momento." : "Toca aquí y cuéntamelo: un taxi, un tinto, lo que sea. Si no gastaste nada, también vale.",
    });
  }
  if (!perfil.efectivo && L.hora === perfil.hora && perfil.ultimo !== L.fecha && !env["nudge:" + L.fecha]) {
    const sin = perfil.ultimo ? Math.round((L.hoy - fd(perfil.ultimo)) / DIA) : 99;
    const toca = sin <= 3 || (sin <= 14 ? L.diaNum % 2 === 0 : L.dow === 0);
    if (toca) out.push({
      tipo: "registro", claves: ["nudge:" + L.fecha], url: "/#inicio", push: true,
      titulo: sin <= 1 ? "¿Gastaste algo hoy?" : "Tu plata te extraña un poquito",
      cuerpo: sin <= 1 ? "Anótalo en 5 segundos y mantén tu racha. Si no gastaste nada, márcalo como día en cero." : "Abre Finti y anota lo de estos días. Sin culpa: un minuto basta.",
    });
  }
  if (perfil.consejos === "semanal" && L.dow === 0 && L.hora === HORA_CONSEJO && !env["tip:" + L.semana]) {
    const [t, c] = CONSEJOS[L.semana % CONSEJOS.length];
    out.push({ tipo: "consejo", claves: ["tip:" + L.semana], url: "/#inicio", titulo: t, cuerpo: c });
  }
  return { L, mensajes: out };
}

// ---------- Correo ----------
const escH = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function correoHtml({ titulo, cuerpo, lista, sitio, baja }) {
  const filas = (lista || []).map((x) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e3e7f0"><b>${escH(x.n)}</b><br><span style="color:#5b6478">${escH(x.txt)}</span></td><td style="padding:8px 0;border-bottom:1px solid #e3e7f0;text-align:right;font-weight:700">${escH(pesos(x.m))}</td></tr>`).join("");
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f6f4fa;font-family:Arial,Helvetica,sans-serif;color:#14121f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#6a4af0;color:#fff;padding:18px 22px;font-size:13px;font-weight:700;letter-spacing:.06em">FINTI</td></tr>
<tr><td style="padding:22px"><h1 style="font-size:20px;margin:0 0 10px">${escH(titulo)}</h1><p style="margin:0 0 14px;line-height:1.5;color:#5b576b">${escH(cuerpo)}</p>
${filas ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:16px">${filas}</table>` : ""}
<a href="${escH(sitio)}" style="display:inline-block;background:#6a4af0;color:#fff;text-decoration:none;padding:11px 18px;border-radius:999px;font-weight:700">Abrir Finti</a></td></tr>
<tr><td style="padding:14px 22px;font-size:12px;color:#6e6a80;border-top:1px solid #ece8f5">Recibes este correo porque activaste los avisos en Finti. <a href="${escH(baja)}" style="color:#6e6a80">Dejar de recibir correos</a>.</td></tr>
</table></td></tr></table></body></html>`;
}

// ---------- Envío ----------
// deps: { enviarPush(sub, payloadJSON) -> Promise<{status}>, enviarCorreo({to, subject, html}) -> Promise<bool>, premiumValido(licencia) -> bool, sitio, secreto }
export async function enviar(perfil, mensajes, L, deps) {
  perfil.enviados = Object.fromEntries(Object.entries(perfil.enviados || {}).filter(([, f]) => f >= new Date(L.hoy - 40 * DIA).toISOString().slice(0, 10)));
  const cuenta = perfil.hoyEnviados && perfil.hoyEnviados.fecha === L.fecha ? perfil.hoyEnviados.n : 0;
  let n = cuenta, cambios = false;
  for (const m of mensajes) {
    if (n >= MAX_DIA && m.tipo !== "pagos" && m.tipo !== "manana") continue;   // el aviso de la mañana lo pidió la persona: no gasta el cupo del día
    let ok = false;
    if (perfil.push) {
      const r = await deps.enviarPush(perfil.push, JSON.stringify({ title: m.titulo, body: m.cuerpo, url: m.url, tag: m.tipo }));
      if (r && (r.status === 404 || r.status === 410)) { perfil.push = null; cambios = true; }
      else if (r && r.status < 300) ok = true;
    }
    if (perfil.email && m.tipo !== "registro" && m.tipo !== "efectivo" && m.tipo !== "manana" && m.tipo !== "dudas" && deps.premiumValido(perfil.licencia)) {
      const baja = `${deps.sitio}/api/avisos?baja=${perfil.id}&t=${hmac(deps.secreto, perfil.id)}`;
      ok = (await deps.enviarCorreo({ to: perfil.email, subject: m.titulo, html: correoHtml({ ...m, sitio: deps.sitio + (m.url || "/"), baja }) })) || ok;
    }
    if (ok) { n++; for (const c of m.claves) perfil.enviados[c] = L.fecha; cambios = true; }
  }
  if (n !== cuenta) perfil.hoyEnviados = { fecha: L.fecha, n };
  return cambios;
}
