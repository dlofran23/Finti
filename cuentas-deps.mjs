// Conecta la lógica de cuentas con Netlify Blobs y el correo.
import { almacen } from "./almacen.mjs";
import { correoConfigurado, enviarCorreo } from "./correo.mjs";
import { contarEnServidor } from "./telemetria.mjs";

export function depsNetlify(context) {
  const env = process.env, s = (name) => almacen(name, context, true);
  return {
    env,
    stores: { usuarios: s("cuentas-usuarios"), sesiones: s("cuentas-sesiones"), codigos: s("cuentas-codigos"), datos: s("cuentas-datos"), limites: s("cuentas-limites") },
    correoListo: correoConfigurado(env),
    enviarCorreo: (m) => enviarCorreo(env, m),
    alCrearCuenta: () => contarEnServidor(almacen("salud-app", context), "cuenta"),
  };
}
export async function cuerpo(req, max = 2_000_000) {
  const t = await req.text();
  if (t.length > max) throw new Error("grande");
  return t ? JSON.parse(t) : {};
}
export const responder = (x) => Response.json(x.body, { status: x.status, headers: { "Cache-Control": "no-store" } });
