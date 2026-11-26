// Acceso único a los datos (Netlify Blobs).
// - El sitio de pruebas (cualquier publicación que no sea la de producción) usa almacenes con el prefijo
//   "pruebas-", así nunca lee ni modifica datos reales.
// - ALMACENES lista todo lo que guarda la app: lo usan los respaldos y la revisión de salud.
import { getStore } from "@netlify/blobs";

export const ALMACENES = [
  { nombre: "cuentas-usuarios", fuerte: true },
  { nombre: "cuentas-sesiones", fuerte: true },
  { nombre: "cuentas-codigos", fuerte: true, efimero: true },
  { nombre: "cuentas-datos", fuerte: true },
  { nombre: "cuentas-limites", fuerte: true, efimero: true },
  { nombre: "pagos", fuerte: false },
  { nombre: "regalos", fuerte: true },   // códigos de regalo de Premium (solo huellas)
  { nombre: "invitaciones", fuerte: true },   // Invita y gana: códigos de invitación y sus premios
  { nombre: "avisos", fuerte: false },
  { nombre: "buzones", fuerte: false },
  { nombre: "bandeja", fuerte: false, efimero: true },
  { nombre: "mudanzas", fuerte: true, efimero: true },
  { nombre: "retos", fuerte: true, efimero: true },   // retos con amigos: apodos y días cumplidos, se borran 30 días después de terminar
  { nombre: "pqr", fuerte: true },   // peticiones, quejas y reclamos con radicado: 3 años desde la última actuación
  { nombre: "salud-app", fuerte: false, efimero: true },
  { nombre: "precios-gente", fuerte: true, efimero: true },   // precios que aporta la gente, anónimos (últimos 14 días)
  { nombre: "precios", fuerte: false, efimero: true },   // precios públicos del DANE (SIPSA): se vuelven a bajar cada día   // errores y métricas anónimas: no hace falta respaldarlos
];
// Donde se guardan los respaldos (no se respalda a sí mismo).
export const ALMACEN_RESPALDOS = "respaldos";

export function esProduccion(context) {
  const c = context && context.deploy && context.deploy.context;
  return !c || c === "production";
}
export function prefijo(context) { return esProduccion(context) ? "" : "pruebas-"; }

export function almacen(nombre, context, fuerte) {
  const def = ALMACENES.find((a) => a.nombre === nombre);
  const strong = fuerte != null ? fuerte : !!(def && def.fuerte);
  return getStore(strong ? { name: prefijo(context) + nombre, consistency: "strong" } : prefijo(context) + nombre);
}

// Límite por ventana de tiempo: vive en atomico.mjs (escritura condicional).
export { limitar } from "./atomico.mjs";
