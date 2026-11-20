// /api/retos: retos con amigos sin montos (crear, unirse, marcar el día, ver, salir).
import { almacen } from "../lib/almacen.mjs";
import * as R from "../lib/retos.mjs";

const json = (r) => Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });

export default async (req, context) => {
  if (req.method !== "POST") return json({ status: 405, body: { error: "Método no permitido." } });
  let b; try { b = await req.json(); } catch { return json({ status: 400, body: { error: "Datos inválidos." } }); }
  if (!b || typeof b !== "object" || JSON.stringify(b).length > 2000) return json({ status: 400, body: { error: "Datos inválidos." } });
  const store = almacen("retos", context), limites = almacen("cuentas-limites", context, true), ip = context && context.ip;
  switch (b.accion) {
    case "crear": return json(await R.crearReto({ store, limites, ip, tipo: b.tipo, apodo: b.apodo, hoy: b.hoy }));
    case "unirse": return json(await R.unirseReto({ store, limites, ip, codigo: b.codigo, apodo: b.apodo, hoy: b.hoy }));
    case "marcar": return json(await R.marcarReto({ store, codigo: b.codigo, pid: b.pid, token: b.token, hoy: b.hoy }));
    case "ver": return json(await R.verReto({ store, codigo: b.codigo, pid: b.pid, token: b.token, hoy: b.hoy }));
    case "salir": return json(await R.salirReto({ store, codigo: b.codigo, pid: b.pid, token: b.token }));
    default: return json({ status: 400, body: { error: "Acción desconocida." } });
  }
};
export const config = { path: "/api/retos" };
