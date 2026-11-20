// Corre cada hora: revisa a quién le toca un aviso según su hora local y lo envía.
import { almacen } from "../lib/almacen.mjs";
import { planificar, enviar } from "../lib/avisos.mjs";
import { leerCanales } from "../lib/canales.mjs";
import { actualizar } from "../lib/atomico.mjs";

export default async (req, context) => {
  const store = almacen("avisos", context), c = leerCanales(process.env, { limites: almacen("cuentas-limites", context, true) }), now = new Date();
  if (!c.push && !c.correo) return;
  const { blobs } = await store.list();
  let enviados = 0;
  for (const { key } of blobs) {
    const perfil = await store.get(key, { type: "json" });
    if (!perfil) continue;
    const { L, mensajes } = planificar(perfil, now);
    perfil._pushAntes = perfil.push;
    if (!mensajes.length) continue;
    if (await enviar(perfil, mensajes, L, c)) {
      // Solo se anota lo enviado, sobre la versión más reciente del perfil: si la persona cambió algo
      // mientras tanto (por ejemplo, se dio de baja del correo), ese cambio se respeta.
      await actualizar(store, key, (act) => {
        if (!act) return undefined;
        act.enviados = perfil.enviados; act.hoyEnviados = perfil.hoyEnviados;
        if (perfil.push === null && act.push && act.push.endpoint === (perfil._pushAntes || {}).endpoint) act.push = null;
        return act;
      });
      enviados++;
    }
  }
  console.log(`avisos: ${blobs.length} perfiles, ${enviados} con envíos`);
};
export const config = { schedule: "5 * * * *" };
