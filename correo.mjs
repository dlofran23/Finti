// Envío de correos. Dos opciones, la que esté configurada:
//  1) Gmail (o cualquier SMTP) con una contraseña de aplicación: SMTP_USER + SMTP_PASS (gratis, sin dominio propio).
//  2) Resend: RESEND_API_KEY + AVISOS_REMITENTE (requiere un dominio verificado para escribirle a cualquiera).
import nodemailer from "nodemailer";
import { createHash } from "node:crypto";

let transporte = null, claveTransporte = "";

export function correoConfigurado(env) {
  return !!((env.SMTP_USER && env.SMTP_PASS) || (env.RESEND_API_KEY && env.AVISOS_REMITENTE));
}

export async function enviarCorreo(env, { to, subject, html, text }) {
  if (env.SMTP_USER && env.SMTP_PASS) {
    const host = env.SMTP_HOST || "smtp.gmail.com", port = +(env.SMTP_PORT || 465);
    // Si cambia la contraseña en Netlify, se crea una conexión nueva (no se reutiliza la vieja).
    const clave = [host, port, env.SMTP_USER, createHash("sha256").update(String(env.SMTP_PASS)).digest("hex")].join("|");
    if (!transporte || claveTransporte !== clave) {
      transporte = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: env.SMTP_USER, pass: String(env.SMTP_PASS).replace(/\s+/g, "") } });
      claveTransporte = clave;
    }
    const from = env.AVISOS_REMITENTE || `Finti <${env.SMTP_USER}>`;
    try { await transporte.sendMail({ from, to, subject, html, text }); return true; } catch (e) { console.log("correo smtp:", e && e.message); return false; }
  }
  if (env.RESEND_API_KEY && env.AVISOS_REMITENTE) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.AVISOS_REMITENTE, to: [to], subject, html, text }),
      });
      return r.ok;
    } catch { return false; }
  }
  return false;
}
