import * as C from "../lib/cuentas.mjs";
import { depsNetlify, cuerpo, responder } from "../lib/cuentas-deps.mjs";

export default async (req, context) => {
  const deps = depsNetlify(context);
  const ses = await C.sesionDe(deps, req.headers.get("authorization"));
  if (!ses) return responder({ status: 401, body: { error: "Tu sesión terminó. Vuelve a entrar." } });
  if (req.method === "GET") return responder(await C.leerDatos(deps, ses, { meta: new URL(req.url).searchParams.get("meta") === "1" }));
  if (req.method === "PUT") {
    let b; try { b = await cuerpo(req, C.MAX_DATOS + 10_000); } catch { return responder({ status: 413, body: { error: "Tu presupuesto es demasiado grande para la nube." } }); }
    return responder(await C.guardarDatos(deps, ses, b));
  }
  return responder({ status: 405, body: { error: "Método no permitido." } });
};
export const config = { path: "/api/datos" };
