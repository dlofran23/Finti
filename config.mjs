import { leerConfig } from "../lib/pagos.mjs";
import { leerCanales } from "../lib/canales.mjs";
import { correoConfigurado } from "../lib/correo.mjs";
import { direccionNueva } from "../lib/mudanza.mjs";

export default async () => {
  const c = leerConfig(process.env), k = leerCanales(process.env);
  return Response.json({ precioCOP: c.precioCOP, pruebas: c.pruebas, listo: c.faltan.length === 0, vapidPublicKey: k.push ? k.vapidPublicKey : "", correo: k.correo,
      entradaDominio: process.env.ENTRADA_SECRET && process.env.ENTRADA_DOMINIO ? process.env.ENTRADA_DOMINIO : "", sitio: k.sitio,
      atajoIos: /^https:\/\/www\.icloud\.com\/shortcuts\/[A-Za-z0-9]+$/.test(process.env.ATAJO_IOS_URL || "") ? process.env.ATAJO_IOS_URL : "",
      cuentas: !!(process.env.CUENTAS_SECRET || process.env.LICENSE_SECRET), googleClientId: process.env.GOOGLE_CLIENT_ID || "", correoLogin: correoConfigurado(process.env),
      mudarA: direccionNueva(process.env) },
    { headers: { "Cache-Control": "no-store" } });
};
export const config = { path: "/api/config" };
