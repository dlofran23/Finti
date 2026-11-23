// Respaldo diario cifrado de todos los datos (se guardan los últimos 30 días).
import { almacen } from "../lib/almacen.mjs";
import { hacerRespaldo, secretoRespaldo } from "../lib/respaldo.mjs";
import { limpiarMudanzas } from "../lib/mudanza.mjs";
import { limpiarTemporales } from "../lib/limpieza.mjs";
import { limpiarTelemetria } from "../lib/telemetria.mjs";
import { limpiarRetos } from "../lib/retos.mjs";
import { limpiarPqr } from "../lib/pqr.mjs";

export default async (req, context) => {
  const r = await hacerRespaldo({ abrir: (n) => almacen(n, context), destino: almacen("respaldos", context), secreto: secretoRespaldo(process.env) });
  console.log("respaldo:", r.nombre, JSON.stringify(r.conteo), r.bytes, "bytes");
  const n = await limpiarMudanzas(almacen("mudanzas", context)).catch(() => 0);   // paquetes de mudanza que nadie recogió
  if (n) console.log("mudanzas vencidas borradas:", n);
  const tel = await limpiarTelemetria(almacen("salud-app", context)).catch(() => 0);   // errores de más de 30 días y métricas de más de 400
  if (tel) console.log("registros de salud viejos borrados:", tel);
  const t = await limpiarTemporales({ limites: almacen("cuentas-limites", context, true), codigos: almacen("cuentas-codigos", context, true) }).catch(() => 0);
  if (t) console.log("registros temporales borrados:", t);
  const rt = await limpiarRetos({ store: almacen("retos", context) }).catch(() => 0);   // retos que terminaron hace más de 30 días
  if (rt) console.log("retos viejos borrados:", rt);
  const pq = await limpiarPqr(almacen("pqr", context)).catch(() => 0);   // PQR sin actuaciones en 3 años
  if (pq) console.log("PQR viejas borradas:", pq);
};
export const config = { schedule: "17 8 * * *" };   // todos los días, 3:17 a. m. de Colombia
