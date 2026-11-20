// Reemplazo mínimo de "nodemailer" para Cloudflare Workers (wrangler.jsonc lo pone en lugar del paquete original).
// Habla SMTP por un socket TCP de Cloudflare (cloudflare:sockets): TLS directo en el puerto 465 (Gmail) o STARTTLS en 587.
// Solo lo que usa netlify/lib/correo.mjs: createTransport({ host, port, secure, auth }).sendMail({ from, to, subject, html, text }).
import { connect } from "cloudflare:sockets";

const b64 = (t) => { const u = new TextEncoder().encode(t); let s = ""; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
const envolver = (t) => t.replace(/.{1,76}/g, "$&\r\n");
const cabecera = (t) => (/^[\x20-\x7e]*$/.test(t) ? t : "=?UTF-8?B?" + b64(t) + "?=");
const direccion = (t) => { const m = /<([^>]+)>/.exec(String(t)); return (m ? m[1] : String(t)).trim(); };
function deQuien(t) { const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(String(t)); return m && m[1] ? cabecera(m[1].replace(/^"|"$/g, "")) + " <" + m[2] + ">" : String(t); }

class Linea {
  constructor(socket) { this.r = socket.readable.getReader(); this.buf = ""; this.dec = new TextDecoder(); }
  async respuesta() {
    // Respuesta SMTP: una o varias líneas "250-..." que terminan en "250 ..."
    const lineas = [];
    for (;;) {
      let i;
      while ((i = this.buf.indexOf("\r\n")) < 0) {
        const { value, done } = await this.r.read();
        if (done) throw new Error("SMTP: el servidor cerró la conexión");
        this.buf += this.dec.decode(value, { stream: true });
      }
      const l = this.buf.slice(0, i); this.buf = this.buf.slice(i + 2); lineas.push(l);
      if (/^\d{3} /.test(l) || /^\d{3}$/.test(l)) return { codigo: +l.slice(0, 3), texto: lineas.join("\n") };
    }
  }
  soltar() { try { this.r.releaseLock(); } catch {} }
}

export function mensaje({ from, to, subject, html, text }) {
  const limite = "finti-" + crypto.randomUUID();
  const partes = [];
  if (text) partes.push("--" + limite, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", envolver(b64(text)));
  if (html) partes.push("--" + limite, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", envolver(b64(html)));
  partes.push("--" + limite + "--", "");
  return ["From: " + deQuien(from), "To: " + (Array.isArray(to) ? to.join(", ") : to), "Subject: " + cabecera(subject || ""),
    "Date: " + new Date().toUTCString(), "Message-ID: <" + crypto.randomUUID() + "@finti>", "MIME-Version: 1.0",
    "Content-Type: multipart/alternative; boundary=\"" + limite + "\"", "", ...partes].join("\r\n");
}

export function createTransport({ host, port = 465, secure = true, auth = {} }) {
  return {
    async sendMail(m) {
      let socket = connect({ hostname: host, port }, { secureTransport: secure ? "on" : (port === 587 ? "starttls" : "off"), allowHalfOpen: false });
      let w = socket.writable.getWriter(), l = new Linea(socket);
      const enc = new TextEncoder();
      const decir = async (t) => { await w.write(enc.encode(t + "\r\n")); };
      const esperar = async (ok, paso) => { const r = await l.respuesta(); if (!ok.includes(r.codigo)) throw new Error("SMTP " + paso + ": " + r.texto.slice(0, 200)); return r; };
      try {
        await esperar([220], "saludo");
        await decir("EHLO finti"); const ehlo = await esperar([250], "EHLO");
        if (!secure && port === 587 && /STARTTLS/i.test(ehlo.texto)) {
          await decir("STARTTLS"); await esperar([220], "STARTTLS");
          w.releaseLock(); l.soltar(); socket = socket.startTls(); w = socket.writable.getWriter(); l = new Linea(socket);
          await decir("EHLO finti"); await esperar([250], "EHLO");
        }
        if (auth.user) {
          await decir("AUTH LOGIN"); await esperar([334], "AUTH");
          await decir(b64(auth.user)); await esperar([334], "usuario");
          await decir(b64(auth.pass || "")); await esperar([235], "clave");
        }
        await decir("MAIL FROM:<" + direccion(m.from) + ">"); await esperar([250], "MAIL FROM");
        for (const d of [].concat(m.to)) { await decir("RCPT TO:<" + direccion(d) + ">"); await esperar([250, 251], "RCPT TO"); }
        await decir("DATA"); await esperar([354], "DATA");
        const cuerpo = mensaje(m).split("\r\n").map((x) => (x.startsWith(".") ? "." + x : x)).join("\r\n");
        await w.write(enc.encode(cuerpo + "\r\n.\r\n")); await esperar([250], "envío");
        try { await decir("QUIT"); } catch {}
        return { accepted: [].concat(m.to), messageId: "finti" };
      } finally { try { w.releaseLock(); l.soltar(); await socket.close(); } catch {} }
    },
  };
}
export default { createTransport };
