// /api/pqr: radicar (POST) y consultar (GET ?radicado=&correo=) peticiones, quejas y reclamos.
// /api/pqr/panel: listar (GET) y responder (POST) las PQR; solo el dueño, con PANEL_CLAVE.
import { almacen } from "../lib/almacen.mjs";
import { enviarCorreo, correoConfigurado } from "../lib/correo.mjs";
import { crearPqr, consultarPqr, listarPqr, responderPqr } from "../lib/pqr.mjs";

const json = (r) => Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });

export default async (req, context) => {
  const url = new URL(req.url), ip = context && context.ip;
  const store = almacen("pqr", context), limites = almacen("cuentas-limites", context, true);
  const env = process.env, autorizacion = req.headers.get("authorization");
  const correo = correoConfigurado(env) ? (m) => enviarCorreo(env, m) : null;
  if (url.pathname === "/api/pqr/panel") {
    if (req.method === "GET") return json(await listarPqr({ store, limites, env, autorizacion, ip }));
    if (req.method !== "POST") return json({ status: 405, body: { error: "Método no permitido." } });
  }
  if (req.method === "GET") return json(await consultarPqr({ store, limites, radicado: url.searchParams.get("radicado"), correo: url.searchParams.get("correo"), ip }));
  if (req.method !== "POST") return json({ status: 405, body: { error: "Método no permitido." } });
  const texto = await req.text();
  if (texto.length > 12000) return json({ status: 413, body: { error: "El mensaje es muy largo." } });
  let b = {}; try { b = texto ? JSON.parse(texto) : {}; } catch { return json({ status: 400, body: { error: "Solicitud inválida." } }); }
  if (url.pathname === "/api/pqr/panel") return json(await responderPqr({ store, limites, env, autorizacion, ip, radicado: b.radicado, estado: b.estado, texto: b.texto, enviarCorreo: correo }));
  return json(await crearPqr({ store, limites, body: b, ip, enviarCorreo: correo, avisarA: env.PQR_AVISO || env.SMTP_USER || "" }));
};
export const config = { path: ["/api/pqr", "/api/pqr/panel"] };
