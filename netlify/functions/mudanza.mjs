// /api/mudanza: paquetes cifrados para pasar los datos de una dirección de la app a otra (ver lib/mudanza.mjs).
import { almacen, limitar } from "../lib/almacen.mjs";
import { guardarMudanza, recogerMudanza, MAX_PAQUETE } from "../lib/mudanza.mjs";

const json = (r) => Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });

export default async (req, context) => {
  const store = almacen("mudanzas", context), limites = almacen("cuentas-limites", context, true);
  const ip = (context && context.ip) || "sin-ip";
  if (req.method === "GET") {
    if (!(await limitar(limites, "mudanza-leer|" + ip, 30, 3600_000))) return json({ status: 429, body: { error: "Demasiados intentos. Espera un rato." } });
    return json(await recogerMudanza({ store, id: new URL(req.url).searchParams.get("id") }));
  }
  if (req.method === "POST") {
    if (!(await limitar(limites, "mudanza-crear|" + ip, 10, 3600_000))) return json({ status: 429, body: { error: "Demasiados intentos. Espera un rato." } });
    const t = await req.text();
    if (t.length > MAX_PAQUETE + 1000) return json({ status: 413, body: { error: "Demasiado grande." } });
    let body; try { body = JSON.parse(t); } catch { return json({ status: 400, body: { error: "Datos inválidos." } }); }
    return json(await guardarMudanza({ store, body }));
  }
  return json({ status: 405, body: { error: "Método no permitido." } });
};
export const config = { path: "/api/mudanza" };
