import { almacen } from "../lib/almacen.mjs";
import { leerConfig, crearPago } from "../lib/pagos.mjs";
import { invitaExiste } from "../lib/referidos.mjs";

export default async (req, context) => {
  if (req.method !== "POST") return Response.json({ error: "Usa POST" }, { status: 405 });
  let datos = {};
  try { datos = await req.json(); } catch (e) {}
  const sitio = process.env.SITE_URL || (context.site && context.site.url) || new URL(req.url).origin;
  // Código de invitación: si no existe se ignora; nunca impide pagar.
  let invita = "";
  try { if (datos.invita) invita = await invitaExiste({ store: almacen("invitaciones", context), codigo: datos.invita }); } catch (e) { invita = ""; }
  const r = await crearPago({ store: almacen("pagos", context), cfg: leerConfig(process.env), email: datos.email, sitio, acepto: datos.acepto, invita });
  return Response.json(r.body, { status: r.status });
};
export const config = { path: "/api/crear-pago" };
