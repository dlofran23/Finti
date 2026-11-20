import { almacen, limitar } from "../lib/almacen.mjs";
import { registrar, recibir, listar, borrar, cambiarLlave } from "../lib/bandeja.mjs";

const json = (r) => Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });

export default async (req, context) => {
  const stores = { buzones: almacen("buzones", context), bandeja: almacen("bandeja", context) };
  const ip = (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || "sin-ip";
  const limites = almacen("cuentas-limites", context, true);
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname === "/api/bandeja")
    return json(await listar({ stores, buzon: url.searchParams.get("buzon"), token: url.searchParams.get("token") }));
  const raw = await req.text();
  if (raw.length > 1200000) return json({ status: 413, body: { error: "Demasiado grande." } });
  let body; try { body = JSON.parse(raw || "{}"); } catch { return json({ status: 400, body: { error: "Datos inválidos." } }); }
  if (req.method === "POST" && url.pathname === "/api/bandeja/registro") {
    if (!(await limitar(limites, "registro|" + ip, 10, 3600_000))) return json({ status: 429, body: { error: "Demasiados intentos. Intenta más tarde." } });
    return json(await registrar({ stores, body }));
  }
  if (req.method === "POST" && url.pathname === "/api/entrada") {
    // Avisos desde atajos del celular: máximo 30 por minuto por dirección IP (el correo del banco usa su propio secreto).
    if (!req.headers.get("x-entrada-secreto") && !(await limitar(limites, "entrada|" + ip, 30, 60_000)))
      return json({ status: 429, body: { error: "Demasiados avisos seguidos. Espera un minuto." } });
    return json(await recibir({ stores, body, secretoHeader: req.headers.get("x-entrada-secreto"), secretoEntrada: process.env.ENTRADA_SECRET || "" }));
  }
  if (req.method === "DELETE" && url.pathname === "/api/bandeja") return json(await borrar({ stores, body }));
  if (req.method === "PUT" && url.pathname === "/api/bandeja/llave") {
    if (!(await limitar(limites, "llave|" + ip, 10, 3600_000))) return json({ status: 429, body: { error: "Demasiados intentos. Intenta más tarde." } });
    return json(await cambiarLlave({ stores, body }));
  }
  return json({ status: 405, body: { error: "Método no permitido." } });
};
export const config = { path: ["/api/bandeja", "/api/bandeja/registro", "/api/bandeja/llave", "/api/entrada"] };
