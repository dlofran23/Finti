// Cada hora revisa la salud del servicio y, si algo falla, avisa por correo a ALERTAS_CORREO (máximo una vez cada 6 horas).
import { almacen } from "../lib/almacen.mjs";
import { revisar } from "../lib/salud.mjs";
import { enviarCorreo, correoConfigurado } from "../lib/correo.mjs";
import { erroresNuevos } from "../lib/telemetria.mjs";

const SEIS_HORAS = 6 * 3600 * 1000;

// Errores nuevos de la app (que nunca habían aparecido): un correo como máximo cada 6 horas, con los 5 más frecuentes.
export async function vigilarErrores({ env, abrir, enviar, ahora = new Date() }) {
  const st = abrir("cuentas-limites"), prev = (await st.get("vigia-errores", { type: "json" })) || {};
  if (prev.t && ahora - prev.t < SEIS_HORAS) return { aviso: false, silenciado: true };
  const desde = prev.t || ahora.getTime() - 2 * 3600 * 1000;
  const nuevos = await erroresNuevos(abrir("salud-app"), desde, ahora.getTime());
  if (!nuevos.length) return { aviso: false, nuevos };
  if (!env.ALERTAS_CORREO || !enviar) return { aviso: false, nuevos, sinCorreo: true };
  const filas = nuevos.slice(0, 5).map((e) => e.n + (e.n === 1 ? " vez: " : " veces: ") + e.m + (e.v ? " (versión " + e.v + ")" : ""));
  const esc = (x) => String(x).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const ok = await enviar({ to: env.ALERTAS_CORREO, subject: "Finti: " + (nuevos.length === 1 ? "un error nuevo" : nuevos.length + " errores nuevos") + " en la app",
    text: "Estos errores aparecieron por primera vez en los teléfonos de los usuarios:\n" + filas.join("\n") + "\nEl detalle está en el panel: /panel",
    html: "<p>Estos errores aparecieron por primera vez en los teléfonos de los usuarios:</p><ul>" + filas.map((f) => "<li>" + esc(f) + "</li>").join("") + "</ul><p>El detalle está en el panel (/panel).</p>" });
  if (ok) await st.setJSON("vigia-errores", { t: ahora.getTime() });
  return { aviso: ok, nuevos };
}

export async function vigilar({ env, abrir, enviar, ahora = new Date() }) {
  const r = await revisar({ env, abrir, ahora });
  const importantes = r.fallas.filter((f) => ["pagos", "cuentas", "datos", "respaldo", "cupoCorreo"].includes(f));
  if (!importantes.length) return { aviso: false, r };
  const st = abrir("cuentas-limites"), prev = (await st.get("vigia-ultimo-aviso", { type: "json" })) || {};
  if (prev.t && ahora - prev.t < SEIS_HORAS && prev.fallas === importantes.join(",")) return { aviso: false, r, silenciado: true };
  if (!env.ALERTAS_CORREO || !enviar) return { aviso: false, r, sinCorreo: true };
  const nombres = { pagos: "pagos con Wompi", cuentas: "cuentas de usuario", datos: "almacenamiento de datos", respaldo: "respaldo diario", cupoCorreo: "cupo diario de correos (" + r.detalle.correosHoy + "): los usuarios nuevos deberán entrar con Google" };
  const ok = await enviar({ to: env.ALERTAS_CORREO, subject: "Finti: revisa el servicio",
    text: "La revisión automática encontró fallas en: " + importantes.map((f) => nombres[f]).join(", ") + ".\nÚltimo respaldo: " + (r.detalle.ultimoRespaldo || "ninguno") + ".\nRevisa los registros de funciones en Netlify.",
    html: "<p>La revisión automática encontró fallas en: <b>" + importantes.map((f) => nombres[f]).join(", ") + "</b>.</p><p>Último respaldo: " + (r.detalle.ultimoRespaldo || "ninguno") + ".</p><p>Revisa los registros de funciones en Netlify.</p>" });
  if (ok) await st.setJSON("vigia-ultimo-aviso", { t: ahora.getTime(), fallas: importantes.join(",") });
  return { aviso: ok, r };
}

export default async (req, context) => {
  const env = process.env;
  const abrir = (n) => almacen(n, context), enviar = correoConfigurado(env) ? (m) => enviarCorreo(env, m) : null;
  const out = await vigilar({ env, abrir, enviar });
  const err = await vigilarErrores({ env, abrir, enviar }).catch((e) => ({ aviso: false, fallo: e && e.message }));
  if (err.nuevos && err.nuevos.length) console.log("vigía: errores nuevos en la app:", err.nuevos.length, err.aviso ? "(avisado por correo)" : "");
  console.log("vigía:", out.r.ok ? "todo bien" : "fallas: " + out.r.fallas.join(", "), out.aviso ? "(avisado por correo)" : "");
};
export const config = { schedule: "@hourly" };
