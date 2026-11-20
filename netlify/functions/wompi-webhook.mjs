import { almacen } from "../lib/almacen.mjs";
import { leerConfig, procesarEvento } from "../lib/pagos.mjs";
import { trasAprobar } from "../lib/referidos.mjs";

// URL de eventos que se configura en el panel de Wompi: https://TU-SITIO/api/wompi-webhook
export default async (req, context) => {
  if (req.method !== "POST") return Response.json({ error: "Usa POST" }, { status: 405 });
  let evento = null;
  try { evento = await req.json(); } catch (e) { return Response.json({ error: "JSON inválido" }, { status: 400 }); }
  const r = await procesarEvento({ store: almacen("pagos", context), cfg: leerConfig(process.env), evento, checksumHeader: req.headers.get("x-event-checksum"),
    alAprobar: trasAprobar({ salud: almacen("salud-app", context), invitaciones: almacen("invitaciones", context), regalos: almacen("regalos", context) }) });
  return Response.json(r.body, { status: r.status });
};
export const config = { path: "/api/wompi-webhook" };
