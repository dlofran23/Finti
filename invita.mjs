// /api/invita: POST crea tu código de invitación (con su llave). GET ?codigo=&llave= muestra tus premios.
import { almacen } from "../lib/almacen.mjs";
import { leerConfig } from "../lib/pagos.mjs";
import { crearInvitacion, verPremios } from "../lib/referidos.mjs";
import { contarEnServidor } from "../lib/telemetria.mjs";

const json = (r) => Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });

export default async (req, context) => {
  const cfg = leerConfig(process.env), store = almacen("invitaciones", context);
  if (req.method === "GET") {
    const q = new URL(req.url).searchParams;
    return json(await verPremios({ store, regalos: almacen("regalos", context), cfg, codigo: q.get("codigo"), llave: q.get("llave") }));
  }
  if (req.method !== "POST") return json({ status: 405, body: { error: "Método no permitido." } });
  const r = await crearInvitacion({ store, limites: almacen("cuentas-limites", context, true), cfg, ip: context && context.ip });
  if (r.status === 200) { try { await contarEnServidor(almacen("salud-app", context), "invita"); } catch { /* solo métrica */ } }
  return json(r);
};
export const config = { path: "/api/invita" };
