// Canales reales de envío: Web Push (VAPID) y correo (Gmail/SMTP o Resend). Se configuran con variables de entorno.
import webpush from "web-push";
import { leerConfig, tokenLicencia } from "./pagos.mjs";
import { correoConfigurado, enviarCorreo as enviar } from "./correo.mjs";
import { reservarCorreo, RESERVA_CODIGOS } from "./cupo-correo.mjs";

// limites: almacén donde se lleva el cupo diario de correos (compartido con los códigos de entrada).
export function leerCanales(env, { limites } = {}) {
  const push = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  if (push) webpush.setVapidDetails(env.VAPID_SUBJECT || "mailto:avisos@example.com", env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const correo = correoConfigurado(env);
  const cfg = leerConfig(env);
  const secreto = env.AVISOS_SECRET || env.LICENSE_SECRET || "";
  return {
    push, correo, vapidPublicKey: env.VAPID_PUBLIC_KEY || "", secreto,
    sitio: String(env.SITE_URL || env.URL || "").replace(/\/$/, ""),
    async enviarPush(sub, payload) {
      if (!push) return { status: 503 };
      try { const r = await webpush.sendNotification(sub, payload, { TTL: 12 * 3600, urgency: "normal" }); return { status: r.statusCode }; }
      catch (e) { return { status: e.statusCode || 500 }; }
    },
    async enviarCorreo({ to, subject, html }) {
      if (!correo) return false;
      // Los avisos dejan libre una parte del cupo diario para que los códigos de entrada siempre lleguen.
      if (limites && !(await reservarCorreo(limites, env, { reserva: RESERVA_CODIGOS })).ok) return false;
      return enviar(env, { to, subject, html });
    },
    premiumValido(lic) { return !!(lic && cfg.licenseSecret && tokenLicencia(lic.ref, cfg.licenseSecret) === lic.token); },
  };
}
