// /api/salud: estado del servicio para un monitor externo (por ejemplo UptimeRobot). Sin datos sensibles.
import { almacen } from "../lib/almacen.mjs";
import { revisar } from "../lib/salud.mjs";

export default async (req, context) => {
  const r = await revisar({ env: process.env, abrir: (n) => almacen(n, context) });
  return Response.json({ ok: r.ok, fallas: r.fallas, ultimoRespaldo: r.detalle.ultimoRespaldo, correosHoy: r.detalle.correosHoy || null, erroresHoy: r.detalle.erroresHoy, revisado: r.revisado },
    { status: r.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
};
export const config = { path: "/api/salud" };
