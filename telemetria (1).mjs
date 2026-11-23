// /api/errores y /api/metrica: la app reporta fallas y eventos de uso, sin datos personales.
// /api/panel: resumen para los dueños (requiere la clave PANEL_CLAVE, configurada solo en Netlify).
import { almacen } from "../lib/almacen.mjs";
import { registrarError, registrarMetrica, panel } from "../lib/telemetria.mjs";

const json = (r) => Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });

export default async (req, context) => {
  const ruta = new URL(req.url).pathname, ip = context && context.ip;
  const store = almacen("salud-app", context), limites = almacen("cuentas-limites", context, true);
  if (ruta === "/api/panel") {
    if (req.method !== "GET") return json({ status: 405, body: { error: "Usa GET" } });
    return json(await panel({ store, limites, env: process.env, autorizacion: req.headers.get("authorization"), ip }));
  }
  if (req.method !== "POST") return json({ status: 405, body: { error: "Usa POST" } });
  const texto = await req.text();
  if (texto.length > 4000) return json({ status: 413, body: { ok: false } });
  let body = null; try { body = JSON.parse(texto); } catch { return json({ status: 400, body: { ok: false } }); }
  if (ruta === "/api/errores") return json(await registrarError({ store, limites, body, ip }));
  if (ruta === "/api/metrica") return json(await registrarMetrica({ store, limites, body, ip }));
  return json({ status: 404, body: { ok: false } });
};
export const config = { path: ["/api/errores", "/api/metrica", "/api/panel"] };
