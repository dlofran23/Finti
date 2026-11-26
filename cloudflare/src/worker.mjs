// Finti en Cloudflare Workers. Sirve la página (carpeta dist/, copia de public/) y corre las MISMAS funciones de
// netlify/functions sin cambiarlas: cada una exporta (req, context) => Response y su config (path o schedule).
// - Datos: Netlify Blobs se reemplaza por D1 (src/blobs-d1.mjs), con la misma interfaz.
// - Correo: nodemailer se reemplaza por un cliente SMTP con sockets de Cloudflare (src/smtp.mjs).
// - Tareas programadas: los "schedule" de Netlify son Cron Triggers (wrangler.jsonc).
// - Variables y llaves: process.env (nodejs_compat), cargadas con "wrangler secret put".
import { usarBaseDeDatos } from "./blobs-d1.mjs";
import { migrar } from "./migrar.mjs";
import * as f0 from "../../netlify/functions/avisos-cron.mjs";
import * as f1 from "../../netlify/functions/avisos.mjs";
import * as f2 from "../../netlify/functions/bandeja.mjs";
import * as f3 from "../../netlify/functions/config.mjs";
import * as f4 from "../../netlify/functions/crear-pago.mjs";
import * as f5 from "../../netlify/functions/cuenta.mjs";
import * as f6 from "../../netlify/functions/datos.mjs";
import * as f7 from "../../netlify/functions/estado.mjs";
import * as f8 from "../../netlify/functions/invita.mjs";
import * as f9 from "../../netlify/functions/licencia.mjs";
import * as f10 from "../../netlify/functions/mudanza.mjs";
import * as f11 from "../../netlify/functions/pqr.mjs";
import * as f12 from "../../netlify/functions/precios.mjs";
import * as f13 from "../../netlify/functions/precios-dane.mjs";
import * as f14 from "../../netlify/functions/regalos.mjs";
import * as f15 from "../../netlify/functions/respaldo-cron.mjs";
import * as f16 from "../../netlify/functions/retos.mjs";
import * as f17 from "../../netlify/functions/salud.mjs";
import * as f18 from "../../netlify/functions/telemetria.mjs";
import * as f19 from "../../netlify/functions/vigia-cron.mjs";
import * as f20 from "../../netlify/functions/wompi-webhook.mjs";

const FUNCIONES = [
  ["avisos-cron", f0],
  ["avisos", f1],
  ["bandeja", f2],
  ["config", f3],
  ["crear-pago", f4],
  ["cuenta", f5],
  ["datos", f6],
  ["estado", f7],
  ["invita", f8],
  ["licencia", f9],
  ["mudanza", f10],
  ["pqr", f11],
  ["precios", f12],
  ["precios-dane", f13],
  ["regalos", f14],
  ["respaldo-cron", f15],
  ["retos", f16],
  ["salud", f17],
  ["telemetria", f18],
  ["vigia-cron", f19],
  ["wompi-webhook", f20]
];

// Rutas exactas a partir de config.path de cada función
const RUTAS = new Map(), PROGRAMADAS = [];
const CRON = { "@hourly": "0 * * * *", "@daily": "0 0 * * *" };
for (const [nombre, m] of FUNCIONES) {
  const c = m.config || {};
  for (const p of [].concat(c.path || [])) RUTAS.set(p, { nombre, m });
  if (c.schedule) PROGRAMADAS.push({ nombre, m, cron: CRON[c.schedule] || c.schedule });
}
export const rutas = () => [...RUTAS.keys()];
export const programadas = () => PROGRAMADAS.map((p) => ({ nombre: p.nombre, cron: p.cron }));

// Lo que Netlify pasaba como context
function contexto(req, env, ctx) {
  const url = new URL(req.url);
  return {
    ip: req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "",
    deploy: { context: env.ENTORNO || "production" },
    site: { url: env.SITE_URL || url.origin },
    geo: { country: { code: (req.cf && req.cf.country) || "" } },
    waitUntil: (p) => ctx.waitUntil(p),
    requestId: req.headers.get("cf-ray") || "",
  };
}
let ORIGEN = "";
function preparar(env, req) {
  usarBaseDeDatos(env.DATOS);
  // Algunas funciones leen process.env.URL (la dirección del sitio en Netlify). Si no hay SITE_URL, se usa la dirección
  // por la que entró la persona (finti.<subdominio>.workers.dev o el dominio propio).
  if (req && !ORIGEN) ORIGEN = new URL(req.url).origin;
  if (typeof process !== "undefined" && process.env) {
    const sitio = env.SITE_URL || ORIGEN;
    if (sitio && !process.env.URL) process.env.URL = sitio;
    if (sitio && !process.env.SITE_URL) process.env.SITE_URL = sitio;
  }
}

// Direcciones cortas y archivos con otro nombre (en Netlify eran [[redirects]]). Cloudflare ya sirve /panel con
// panel.html y quita el .html de las direcciones (/legal/privacidad.html → /legal/privacidad).
const REESCRIBIR = { "/.well-known/assetlinks.json": "/assetlinks.json" };
const MOVER = { "/privacidad": "/legal/privacidad", "/terminos": "/legal/terminos", "/empresas": "/legal/empresas", "/eliminar-cuenta": "/legal/eliminar-cuenta" };

export default {
  async fetch(req, env, ctx) {
    preparar(env, req);
    const url = new URL(req.url);
    // Dirección vieja de workers.dev → dominio propio (si se configura DOMINIO_PRINCIPAL)
    if (env.DOMINIO_PRINCIPAL && url.hostname !== env.DOMINIO_PRINCIPAL && url.hostname.endsWith(".workers.dev") && !url.pathname.startsWith("/api/"))
      return Response.redirect("https://" + env.DOMINIO_PRINCIPAL + url.pathname + url.search, 301);
    const r = RUTAS.get(url.pathname.replace(/\/$/, "") || "/");
    if (r) {
      try { return await r.m.default(req, contexto(req, env, ctx)); }
      catch (e) { console.error(r.nombre, e && e.stack || e); return Response.json({ error: "Error interno" }, { status: 500 }); }
    }
    if (url.pathname === "/api/migrar") return migrar(req, env);
    if (url.pathname.startsWith("/api/")) return Response.json({ error: "No existe" }, { status: 404 });
    if (MOVER[url.pathname]) return Response.redirect(url.origin + MOVER[url.pathname], 301);
    if (REESCRIBIR[url.pathname]) { const u = new URL(REESCRIBIR[url.pathname], url); return env.ASSETS.fetch(new Request(u, req)); }
    return env.ASSETS.fetch(req);
  },
  async scheduled(evento, env, ctx) {
    preparar(env);
    const req = new Request("https://cron.interno/", { method: "POST", body: JSON.stringify({ next_run: null }) });
    for (const p of PROGRAMADAS) if (p.cron === evento.cron) {
      ctx.waitUntil(Promise.resolve().then(() => p.m.default(req, contexto(req, env, ctx))).catch((e) => console.error("cron " + p.nombre, e && e.stack || e)));
    }
  },
};
