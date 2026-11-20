// Envía un correo real a un servidor SMTP de prueba local con la librería del sitio.
import { SMTPServer } from "smtp-server";
import { enviarCorreo, correoConfigurado } from "../netlify/lib/correo.mjs";
import assert from "node:assert/strict";

const recibidos = [];
const srv = new SMTPServer({
  secure: false, authOptional: false, disabledCommands: ["STARTTLS"],
  onAuth(auth, _s, cb) { cb(auth.username === "app@gmail.com" && auth.password === "abcdabcdabcdabcd" ? null : new Error("no"), { user: auth.username }); },
  onData(stream, _s, cb) { let t = ""; stream.on("data", (d) => (t += d)); stream.on("end", () => { recibidos.push(t); cb(); }); },
});
await new Promise((r) => srv.listen(2525, "127.0.0.1", r));
const env = { SMTP_USER: "app@gmail.com", SMTP_PASS: "abcd abcd abcd abcd", SMTP_HOST: "127.0.0.1", SMTP_PORT: "2525" };
assert.equal(correoConfigurado(env), true);
assert.equal(await enviarCorreo(env, { to: "laura@correo.com", subject: "123456 es tu código", html: "<b>123456</b>", text: "123456" }), true);
assert.equal(recibidos.length, 1);
assert.match(recibidos[0], /123456_es_tu_c=C3=B3digo/);
assert.match(recibidos[0], /To: laura@correo.com/);
assert.equal(await enviarCorreo({ ...env, SMTP_PASS: "mala" }, { to: "x@y.co", subject: "x", text: "x" }), false, "clave incorrecta no envía");
srv.close();
console.log("correo: todo bien (nodemailer " + (await import("nodemailer/package.json", { with: { type: "json" } })).default.version + ")");
