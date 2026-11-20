import { almacen } from "../lib/almacen.mjs";
import { leerConfig, consultarLicencia } from "../lib/pagos.mjs";
import { trasAprobar } from "../lib/referidos.mjs";

export default async (req, context) => {
  const q = new URL(req.url).searchParams;
  const r = await consultarLicencia({
    store: almacen("pagos", context), cfg: leerConfig(process.env), fetchFn: fetch,
    ref: q.get("ref"), id: q.get("id"), email: q.get("email"), token: q.get("token"),
    alAprobar: trasAprobar({ salud: almacen("salud-app", context), invitaciones: almacen("invitaciones", context), regalos: almacen("regalos", context) }),
  });
  return Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
};
export const config = { path: "/api/licencia" };
