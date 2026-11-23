// Revisión de salud: ¿está todo configurado y funcionando? No devuelve valores secretos, solo sí o no.
import { leerConfig } from "./pagos.mjs";
import { correoConfigurado } from "./correo.mjs";
import { ultimoRespaldo } from "./respaldo.mjs";
import { usoCorreo } from "./cupo-correo.mjs";
import { erroresHoy } from "./telemetria.mjs";

export async function revisar({ env, abrir, ahora = new Date() }) {
  const r = {};
  const cfg = leerConfig(env);
  r.pagos = cfg.faltan.length === 0;
  r.cuentas = !!(env.CUENTAS_SECRET || env.LICENSE_SECRET);
  r.google = !!env.GOOGLE_CLIENT_ID;
  r.correo = correoConfigurado(env);
  r.notificaciones = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  try {
    const st = abrir("cuentas-limites"), marca = String(ahora.getTime());
    await st.set("salud-prueba", marca);
    r.datos = (await st.get("salud-prueba", { type: "text" })) === marca;
  } catch { r.datos = false; }
  // Cupo diario de correos: si pasa del 80 %, avisa (los usuarios tendrán que entrar con Google).
  if (r.correo) {
    try { const c = await usoCorreo(abrir("cuentas-limites"), env, ahora.getTime()); r.correosHoy = c.usados + " de " + c.tope; r.cupoCorreo = c.usados < c.tope * 0.8; }
    catch { r.correosHoy = null; }
  }
  try {
    const u = await ultimoRespaldo(abrir("respaldos"));
    const dias = u ? (ahora - new Date(u.slice(0, 10) + "T00:00:00Z")) / 86400000 : Infinity;
    r.respaldo = dias <= 2;
    r.ultimoRespaldo = u ? u.slice(0, 10) : null;
  } catch { r.respaldo = false; r.ultimoRespaldo = null; }
  // Errores de la app en los teléfonos hoy (informativo: no es una caída).
  try { r.erroresHoy = await erroresHoy(abrir("salud-app"), ahora.getTime()); } catch { r.erroresHoy = null; }
  // Lo indispensable para que la app funcione; correo y respaldo son avisos, no caídas.
  const criticos = ["pagos", "cuentas", "datos"];
  const fallas = Object.keys(r).filter((k) => r[k] === false);
  return { ok: criticos.every((k) => r[k]), fallas, detalle: r, revisado: ahora.toISOString() };
}
