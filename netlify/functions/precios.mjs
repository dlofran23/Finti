// /api/precios: precios de referencia del DANE (SIPSA) para Dónde comprar y Pregúntale.
// GET lo pide la app (público, en caché una hora: los precios cambian cada día de mercado). POST lo manda GitHub Actions con PRECIOS_CLAVE.
import { almacen } from "../lib/almacen.mjs";
import { leerPrecios, guardarPrecios } from "../lib/precios.mjs";

export default async (req, context) => {
  const store = almacen("precios", context);
  if (req.method === "GET") {
    const r = await leerPrecios(store);
    return Response.json(r.body, { status: r.status, headers: { "Cache-Control": r.status === 200 ? "public, max-age=3600" : "no-store" } });
  }
  if (req.method !== "POST") return Response.json({ error: "Usa GET o POST" }, { status: 405 });
  const r = await guardarPrecios({ store, env: process.env, autorizacion: req.headers.get("authorization"), texto: await req.text() });
  return Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
};
export const config = { path: "/api/precios" };
