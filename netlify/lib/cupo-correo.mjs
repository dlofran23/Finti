// Cupo diario de correos. Gmail deja enviar unos 500 por día desde una cuenta normal; si se pasa,
// bloquea el envío por 24 horas. Aquí se cuentan todos los correos que manda la app (códigos y avisos)
// y se frena antes del límite. Los avisos dejan una reserva libre para que los códigos de entrada
// sigan llegando aunque ese día haya muchos avisos.
import { actualizar } from "./atomico.mjs";

const DIA = 24 * 60 * 60 * 1000, CLAVE = "cupo-correo-dia";
export const RESERVA_CODIGOS = 100;

export function topeCorreo(env) {
  const n = parseInt(env.CORREO_TOPE_DIA, 10);
  if (n > 0) return n;
  return env.SMTP_USER && env.SMTP_PASS ? 450 : 2500;
}

// Cuenta un envío si hay cupo. reserva = cuántos del tope se dejan libres para otros usos.
export async function reservarCorreo(store, env, { reserva = 0, ahora = Date.now() } = {}) {
  const tope = topeCorreo(env);
  let ok = false, usados = 0;
  try {
    await actualizar(store, CLAVE, (reg) => {
      const t = ((reg && reg.t) || []).filter((x) => ahora - x < DIA);
      usados = t.length;
      if (t.length >= Math.max(0, tope - reserva)) { ok = false; return undefined; }
      ok = true; t.push(ahora); usados = t.length;
      return { t: t.slice(-tope) };
    });
  } catch (e) { if (!(e && e.conflicto)) throw e; ok = false; }
  return { ok, usados, tope };
}

export async function usoCorreo(store, env, ahora = Date.now()) {
  const reg = await store.get(CLAVE, { type: "json" });
  const usados = ((reg && reg.t) || []).filter((x) => ahora - x < DIA).length;
  return { usados, tope: topeCorreo(env) };
}
