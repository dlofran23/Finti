// /api/precios-gente: precios que aporta la gente, con su permiso y sin datos personales (ver lib/precios-gente.mjs).
// GET: la lista de productos, cadenas y ciudades, y lo que se pagó en cada cadena (público, igual para todos).
// POST: { ciudad, aportes: [{ p, c, u, v, d }] } desde la app, solo si la persona aceptó compartir sus precios.
import { almacen } from "../lib/almacen.mjs";
import { lista, resumen, aportar } from "../lib/precios-gente.mjs";

let memoria = null;   // el resumen se arma como máximo cada 10 minutos por instancia
const json = (r, cache) => Response.json(r.body, { status: r.status, headers: { "Cache-Control": cache || "no-store" } });

export default async (req, context) => {
  const store = almacen("precios-gente", context);
  if (req.method === "GET") {
    if (!memoria || Date.now() - memoria.t > 6e5) memoria = { t: Date.now(), body: { lista: lista(), ...(await resumen({ store })) } };
    return json({ status: 200, body: memoria.body }, "public, max-age=1800");
  }
  if (req.method !== "POST") return json({ status: 405, body: { error: "Usa GET o POST" } });
  const texto = await req.text();
  if (texto.length > 8000) return json({ status: 413, body: { error: "Demasiado grande." } });
  let body = null; try { body = JSON.parse(texto); } catch { return json({ status: 400, body: { error: "No es JSON." } }); }
  const r = await aportar({ store, limites: almacen("cuentas-limites", context, true), body, ip: context && context.ip, env: process.env });
  if (r.status === 200) memoria = null;
  return json(r);
};
export const config = { path: "/api/precios-gente" };
