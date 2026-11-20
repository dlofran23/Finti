// Una sola consulta para saber si hay novedades: la versión de la copia en la nube (si hay sesión)
// y los avisos que esperan en el buzón (si hay buzón). La app la hace al abrirse y al volver a ella,
// en vez de preguntar cada minuto: así se gastan muchas menos invocaciones del servidor.
import * as C from "./cuentas.mjs";
import { listar } from "./bandeja.mjs";

export async function estado({ deps, stores, autorizacion, buzon, token }) {
  const out = {};
  if (autorizacion) {
    const ses = await C.sesionDe(deps, autorizacion);
    out.nube = ses ? { ...(await C.leerDatos(deps, ses, { meta: true })).body, usuario: C.publico(ses.u) } : { sesion: false };
  }
  if (buzon) {
    const r = await listar({ stores, buzon, token });
    out.bandeja = r.status === 200 ? r.body : { error: r.status };
  }
  return { status: 200, body: out };
}
