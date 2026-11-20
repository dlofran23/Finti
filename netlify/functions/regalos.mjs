// /api/regalo: canjear un código de regalo de Premium (público, con límite de intentos).
// /api/regalos: crear y ver los códigos (solo el dueño, con PANEL_CLAVE). /api/regalos/anular: anular uno sin usar.
import { almacen } from "../lib/almacen.mjs";
import { leerConfig } from "../lib/pagos.mjs";
import { contarEnServidor } from "../lib/telemetria.mjs";
import { canjearRegalo, crearRegalos, listarRegalos, anularRegalo } from "../lib/regalos.mjs";

const json = (r) => Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });

export default async (req, context) => {
  const ruta = new URL(req.url).pathname, ip = context && context.ip;
  const store = almacen("regalos", context), limites = almacen("cuentas-limites", context, true);
  const autorizacion = req.headers.get("authorization");
  if (ruta === "/api/regalos" && req.method === "GET") return json(await listarRegalos({ store, limites, env: process.env, autorizacion, ip }));
  if (req.method !== "POST") return json({ status: 405, body: { error: "Método no permitido." } });
  const texto = await req.text();
  if (texto.length > 2000) return json({ status: 413, body: { error: "Solicitud muy grande." } });
  let b = {}; try { b = texto ? JSON.parse(texto) : {}; } catch { return json({ status: 400, body: { error: "Solicitud inválida." } }); }
  if (ruta === "/api/regalo") return json(await canjearRegalo({
    store, pagos: almacen("pagos", context), limites, cfg: leerConfig(process.env), codigo: b.codigo, email: b.email, ip,
    alCanjear: () => contarEnServidor(almacen("salud-app", context), "regalo"),
  }));
  if (ruta === "/api/regalos") return json(await crearRegalos({ store, limites, env: process.env, autorizacion, ip, n: b.n, nota: b.nota }));
  if (ruta === "/api/regalos/anular") return json(await anularRegalo({ store, limites, env: process.env, autorizacion, ip, id: b.id }));
  return json({ status: 404, body: { error: "No encontrado." } });
};
export const config = { path: ["/api/regalo", "/api/regalos", "/api/regalos/anular"] };
