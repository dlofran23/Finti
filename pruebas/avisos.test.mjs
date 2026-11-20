import assert from "node:assert/strict";
import { validarPerfil, planificar, enviar, estadoPago, ahoraLocal, correoHtml, tokenValido } from "../netlify/lib/avisos.mjs";

const base = { id: "a".repeat(20), token: "b".repeat(32), tz: -300, hora: 20, consejos: "semanal", ultimo: "2026-10-26",
  push: { endpoint: "https://fcm.googleapis.com/fcm/send/xyz123456789", keys: { p256dh: "BA".repeat(40), auth: "zz".repeat(8) } },
  pagos: [{ n: "Arriendo", m: 1100000, f: "mensual", d: 5, a: 3, c: "2026-09-01", p: ["2026-09", "2026-10"] },
          { n: "Tarjeta", m: 250000, f: "mensual", d: 28, a: 1, c: "2026-09-01", p: ["2026-09"] },
          { n: "SOAT", m: 950000, f: "anual", fe: "2026-11-10", a: 7, c: "2026-10-01", p: [] }] };
const { perfil } = validarPerfil(base);
assert.ok(perfil && tokenValido(perfil, "b".repeat(32)) && !tokenValido(perfil, "c".repeat(32)));
assert.equal(validarPerfil({ ...base, id: "x" }).error, "Identificador inválido.");
assert.equal(validarPerfil({ ...base, email: "malo" }).error, "Correo inválido.");
assert.equal(validarPerfil({ ...base, pagos: [{ n: "<script>", m: 1 }] }).perfil.pagos[0].n, "script");

// Hora local de Colombia: 13:00 UTC = 8:00 a. m.
const at = (iso) => new Date(iso);
let L = ahoraLocal(at("2026-10-27T13:00:00Z"), -300);
assert.equal(L.fecha, "2026-10-27"); assert.equal(L.hora, 8);

// Estado de pagos
const hoy = L.hoy;
assert.equal(estadoPago(perfil.pagos[0], hoy).pagado, true);                // arriendo de octubre pagado
assert.equal(estadoPago(perfil.pagos[1], hoy).dias, 1);                      // tarjeta vence mañana (28)
assert.equal(estadoPago(perfil.pagos[2], hoy).dias, 14);                     // SOAT el 10 de noviembre

// 8 a. m.: aviso de la tarjeta (1 día antes)
let r = planificar(perfil, at("2026-10-27T13:05:00Z"));
assert.equal(r.mensajes.length, 1); assert.equal(r.mensajes[0].tipo, "pagos"); assert.match(r.mensajes[0].titulo, /Tarjeta vence mañana/);
// SOAT avisa 7 días antes: 3 de noviembre
r = planificar(perfil, at("2026-11-03T13:05:00Z"));
assert.ok(r.mensajes.some((m) => /SOAT/.test(m.cuerpo)));
// Horas de silencio
assert.equal(planificar(perfil, at("2026-10-28T03:00:00Z")).mensajes.length, 0);   // 10 p. m.
// Recordatorio de registro a las 8 p. m. si no registró hoy
r = planificar(perfil, at("2026-10-28T01:05:00Z"));   // 27 oct, 8 p. m. local
assert.equal(r.mensajes[0].tipo, "registro");
assert.equal(planificar({ ...perfil, ultimo: "2026-10-27" }, at("2026-10-28T01:05:00Z")).mensajes.length, 0);
// Quien lleva 30 días sin entrar solo recibe recordatorio los domingos
const dormido = { ...perfil, ultimo: "2026-09-20" };
assert.equal(planificar(dormido, at("2026-10-28T01:05:00Z")).mensajes.length, 0);   // martes
assert.equal(planificar(dormido, at("2026-11-02T01:05:00Z")).mensajes.length, 1);   // domingo 1 nov
// Consejo del domingo a las 10 a. m.
r = planificar(perfil, at("2026-11-01T15:05:00Z"));
assert.equal(r.mensajes[0].tipo, "consejo");
assert.equal(planificar({ ...perfil, consejos: "nunca" }, at("2026-11-01T15:05:00Z")).mensajes.length, 0);

// Envío: no repite, respeta el máximo diario y borra suscripciones vencidas
const sent = [];
const deps = { enviarPush: async (s, p) => { sent.push(JSON.parse(p)); return { status: 201 }; }, enviarCorreo: async () => true, premiumValido: () => false, sitio: "https://x.co", secreto: "s" };
let P = structuredClone(perfil);
r = planificar(P, at("2026-10-27T13:05:00Z")); await enviar(P, r.mensajes, r.L, deps);
r = planificar(P, at("2026-10-27T13:30:00Z")); assert.equal(r.mensajes.length, 0, "no repite el aviso del mismo pago");
r = planificar(P, at("2026-10-28T01:05:00Z")); await enviar(P, r.mensajes, r.L, deps);
assert.equal(sent.length, 2); assert.equal(P.hoyEnviados.n, 2);
const gone = { ...deps, enviarPush: async () => ({ status: 410 }) };
P = structuredClone(perfil); r = planificar(P, at("2026-10-27T13:05:00Z")); await enviar(P, r.mensajes, r.L, gone);
assert.equal(P.push, null);
// Correo solo con Premium, nunca para el recordatorio de registro
const mails = [];
P = structuredClone({ ...perfil, email: "a@b.co" }); r = planificar(P, at("2026-10-28T01:05:00Z"));
await enviar(P, r.mensajes, r.L, { ...deps, premiumValido: () => true, enviarCorreo: async (m) => { mails.push(m); return true; } });
assert.equal(mails.length, 0);
P = structuredClone({ ...perfil, email: "a@b.co" }); r = planificar(P, at("2026-10-27T13:05:00Z"));
await enviar(P, r.mensajes, r.L, { ...deps, premiumValido: () => true, enviarCorreo: async (m) => { mails.push(m); return true; } });
assert.equal(mails.length, 1); assert.match(mails[0].html, /Dejar de recibir correos/);
assert.ok(!/<script/.test(correoHtml({ titulo: "<script>", cuerpo: "x", sitio: "/", baja: "/" })));
// Pregunta de cada noche por el efectivo: a su hora, todos los días (aunque ya haya registrado), abre la charla, nunca por correo
{
  const E = { ...perfil, efectivo: true, ultimo: "2026-10-27", email: "a@b.co" };
  let q = planificar(E, at("2026-10-28T01:05:00Z"));   // 27 oct, 8 p. m. local
  const ef = q.mensajes.find((x) => x.tipo === "efectivo");
  assert.ok(ef, "llega la pregunta de efectivo");
  assert.equal(ef.url, "/#accion=charla");
  assert.match(ef.titulo, /efectivo/);
  assert.ok(!q.mensajes.some((x) => x.tipo === "registro"), "reemplaza el recordatorio general");
  const correos = [], pushes = [];
  await enviar(E, q.mensajes, q.L, { ...deps, enviarPush: async (s, j) => { pushes.push(JSON.parse(j)); return { status: 201 }; }, premiumValido: () => true, enviarCorreo: async (m) => { correos.push(m); return true; } });
  assert.equal(correos.length, 0); assert.ok(pushes.some((x) => x.url === "/#accion=charla"));
  assert.equal(planificar(E, at("2026-10-28T01:05:00Z")).mensajes.filter((x) => x.tipo === "efectivo").length, 0, "una sola vez al día");
  assert.equal(validarPerfil({ ...base, efectivo: "si" }).perfil.efectivo, false);
  assert.equal(validarPerfil({ ...base, efectivo: true }).perfil.efectivo, true);
}
// Aviso de la mañana: a las 7 a. m. locales, sin cifra (la calcula el celular), nunca por correo y sin gastar el cupo del día
{
  const M = { ...perfil, manana: true, email: "a@b.co", push: perfil.push || { endpoint: "https://x" } };
  const q = planificar(M, at("2026-10-28T12:05:00Z"));   // 28 oct, 7 a. m. local
  const mm = q.mensajes.find((x) => x.tipo === "manana");
  assert.ok(mm, "llega el aviso de la mañana");
  assert.ok(!/\$|\d{3}/.test(mm.titulo + mm.cuerpo), "el servidor no manda ninguna cifra");
  const correos = [], pushes = [];
  await enviar(M, q.mensajes, q.L, { ...deps, enviarPush: async (s, j) => { pushes.push(JSON.parse(j)); return { status: 201 }; }, premiumValido: () => true, enviarCorreo: async (m) => { correos.push(m); return true; } });
  assert.equal(correos.length, 0); assert.ok(pushes.some((x) => x.tag === "manana"));
  assert.equal(planificar(M, at("2026-10-28T12:30:00Z")).mensajes.filter((x) => x.tipo === "manana").length, 0, "una sola vez al día");
  assert.equal(planificar({ ...M, manana: false }, at("2026-10-29T12:05:00Z")).mensajes.filter((x) => x.tipo === "manana").length, 0, "solo si la persona lo pidió");
  assert.equal(validarPerfil({ ...base, manana: true }).perfil.manana, true);
}

// ---------- Preguntas pendientes: a mediodía, máximo una vez cada dos días, sin contenido ----------
{
  const conDudas = validarPerfil({ ...base, dudas: 2, ultimo: "2026-11-09" }).perfil;
  assert.equal(conDudas.dudas, 2); assert.equal(conDudas.preguntar, true);
  assert.equal(validarPerfil({ ...base, dudas: 99 }).perfil.dudas, 9, "nunca más de 9");
  assert.equal(validarPerfil({ ...base, dudas: "<b>" }).perfil.dudas, 0);
  const mediodia = at("2026-11-10T18:05:00Z");   // 1:05 p. m. en Colombia
  let r = planificar(conDudas, mediodia);
  const d = r.mensajes.find((m) => m.tipo === "dudas");
  assert.ok(d && d.url === "/#accion=dudas" && /2 preguntas/.test(d.cuerpo), "aviso de preguntas a mediodía");
  assert.ok(!/aguacate|precio|\$/.test(d.titulo + d.cuerpo), "el servidor no sabe qué se pregunta");
  assert.ok(!planificar(conDudas, at("2026-11-10T15:05:00Z")).mensajes.some((m) => m.tipo === "dudas"), "solo a mediodía");
  assert.ok(!planificar({ ...conDudas, ultimo: "2026-11-10" }, mediodia).mensajes.some((m) => m.tipo === "dudas"), "si ya abrió la app hoy, no se le pregunta");
  assert.ok(!planificar({ ...conDudas, preguntar: false }, mediodia).mensajes.some((m) => m.tipo === "dudas"), "la persona lo puede apagar");
  assert.ok(!planificar({ ...conDudas, dudas: 0 }, mediodia).mensajes.some((m) => m.tipo === "dudas"), "sin preguntas, nada");
  assert.ok(!planificar({ ...conDudas, enviados: { "dudas:2026-11-09": "2026-11-09" } }, mediodia).mensajes.some((m) => m.tipo === "dudas"), "nunca dos días seguidos");
  assert.ok(planificar({ ...conDudas, enviados: { "dudas:2026-11-08": "2026-11-08" } }, mediodia).mensajes.some((m) => m.tipo === "dudas"), "dos días después, sí");
  const P2 = { ...conDudas, email: "x@y.co", licencia: { ref: "PRE-ABCDEFGHJKLM", token: "t" } }, enviados = [];
  r = planificar(P2, mediodia);
  await enviar(P2, r.mensajes.filter((m) => m.tipo === "dudas"), r.L, { enviarPush: async () => ({ status: 201 }), enviarCorreo: async (c) => { enviados.push(c); return true; }, premiumValido: () => true, sitio: "https://x", secreto: "s" });
  assert.equal(enviados.length, 0, "las preguntas nunca van por correo");
  assert.ok(P2.enviados["dudas:2026-11-10"], "queda marcado para no repetir");
}
console.log("test-avisos: todo bien");
