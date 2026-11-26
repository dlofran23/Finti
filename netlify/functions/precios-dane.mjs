// /api/precios-dane: el servicio SIPSA del DANE corta las conexiones que llegan desde GitHub Actions, así que el
// flujo "Precios del DANE" puede pedir la consulta a través del trabajador de Cloudflare.
// GET: prueba pública que solo dice si el trabajador llega al DANE (guardada 10 minutos).
// POST con PRECIOS_CLAVE: devuelve la respuesta del DANE tal cual (ver puenteDane en lib/precios.mjs).
import { almacen } from "../lib/almacen.mjs";
import { probarDane, puenteDane } from "../lib/precios.mjs";

export default async (req, context) => {
  const sinCache = { "Cache-Control": "no-store" };
  if (req.method === "GET") return Response.json(await probarDane({ store: almacen("precios", context) }), { headers: sinCache });
  if (req.method !== "POST") return Response.json({ error: "Usa GET o POST" }, { status: 405 });
  const r = await puenteDane({ env: process.env, autorizacion: req.headers.get("authorization") });
  return r.respuesta || Response.json(r.body, { status: r.status, headers: sinCache });
};
export const config = { path: "/api/precios-dane" };
