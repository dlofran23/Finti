// /api/precios-gente: precios que aporta la gente, con su permiso y sin datos personales (ver lib/precios-gente.mjs).
// GET: la lista de productos, cadenas y ciudades, y lo que se pagó en cada cadena (público, igual para todos).
// POST: { ciudad, aportes: [{ p, c, u, v, d }] } desde la app, solo si la persona aceptó compartir sus precios.
// /api/precios-linea (POST con PRECIOS_CLAVE): los precios de las tiendas en línea que baja GitHub Actions cada día.
// /api/precios-buscar?q=jabon+rey (GET): busca en vivo cualquier producto en las tiendas en línea que lo permiten.
import { almacen } from "../lib/almacen.mjs";
import { lista, resumen, aportar, guardarLinea, leerLinea } from "../lib/precios-gente.mjs";
import { buscar } from "../lib/precios-buscar.mjs";

let memoria = null;   // el resumen se arma como máximo cada 10 minutos por instancia
const json = (r, cache) => Response.json(r.body, { status: r.status, headers: { "Cache-Control": cache || "no-store" } });

export default async (req, context) => {
  const store = almacen("precios-gente", context);
  const url = new URL(req.url);
  if (url.pathname === "/api/precios-buscar") {
    if (req.method !== "GET") return json({ status: 405, body: { error: "Usa GET" } });
    const r = await buscar({ store, limites: almacen("cuentas-limites", context, true), q: url.searchParams.get("q") || "", ip: context && context.ip });
    return json(r, r.status === 200 ? "public, max-age=3600" : "no-store");
  }
  if (url.pathname === "/api/precios-linea") {
    if (req.method !== "POST") return json({ status: 405, body: { error: "Usa POST" } });
    const r = await guardarLinea({ store, env: process.env, autorizacion: req.headers.get("authorization"), texto: await req.text() });
    if (r.status === 200) memoria = null;
    return json(r);
  }
  if (req.method === "GET") {
    if (!memoria || Date.now() - memoria.t > 6e5) memoria = { t: Date.now(), body: { lista: lista(), ...(await resumen({ store })), linea: await leerLinea({ store }) } };
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
export const config = { path: ["/api/precios-gente", "/api/precios-linea", "/api/precios-buscar"] };
