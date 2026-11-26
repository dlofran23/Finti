// Prueba de humo de Finti en Cloudflare, con el motor real de Workers (workerd, "wrangler dev --local"):
// página y encabezados, cuentas con código por correo (SMTP por sockets de Cloudflare), datos en D1 con escrituras
// condicionales, buzón cifrado (RSA-OAEP y AES-GCM), precios del DANE, mudanza, errores, tareas programadas y migración.
// Uso: node pruebas/humo.mjs   (desde la carpeta cloudflare; necesita npm install en web-pro y en cloudflare)
import { spawn, execFileSync } from "node:child_process"; import { createRequire } from "node:module";
import crypto from "node:crypto"; import fs from "node:fs"; import net from "node:net"; import path from "node:path";
const AQUI = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const require = createRequire(path.join(AQUI, "..", "package.json"));
const { SMTPServer } = require("smtp-server"); const webpush = require("web-push");
let fallas = 0; const ok = (c, m) => { console.log((c ? "ok  " : "FALLA ") + m); if (!c) fallas++; };
const libre = () => new Promise((r) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const esp = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Correo local que pide usuario y clave (como Gmail, pero sin TLS)
const correos = []; const PS = await libre();
const smtp = new SMTPServer({ authOptional: false, allowInsecureAuth: true, disabledCommands: ["STARTTLS"], authMethods: ["LOGIN", "PLAIN"],
  onAuth(a, s, cb) { cb(a.username === "prueba@finti.co" && a.password === "clavedeprueba"  /* correo.mjs quita los espacios, como en las contraseñas de aplicación de Gmail */ ? null : new Error("auth"), { user: a.username }); },
  onData(st, s, cb) { let t = ""; st.on("data", (d) => (t += d)); st.on("end", () => { correos.push(t); cb(); }); } });
await new Promise((r) => smtp.listen(PS, "127.0.0.1", r));

// 2. Trabajador local con base D1 nueva
const PW = await libre(), estado = fs.mkdtempSync("/tmp/finti-cf-");
const v = webpush.generateVAPIDKeys();
const vars = { LICENSE_SECRET: "s3cr3t-de-prueba-1234567890", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(PS), SMTP_USER: "prueba@finti.co", SMTP_PASS: "clave de prueba",
  AVISOS_REMITENTE: "Finti <prueba@finti.co>", PRECIOS_CLAVE: "precios-de-prueba-123456", MIGRAR_CLAVE: "migrar-de-prueba-123456", PANEL_CLAVE: "panel-de-prueba-123456",
  ENTRADA_SECRET: "entrada-de-prueba-123456", VAPID_PUBLIC_KEY: v.publicKey, VAPID_PRIVATE_KEY: v.privateKey, VAPID_SUBJECT: "mailto:prueba@finti.co", RESPALDO_CLAVE: "respaldo-de-prueba-0123456789abcdef" };
const vf = path.join(estado, "vars"); fs.writeFileSync(vf, Object.entries(vars).map(([k, x]) => k + "=" + JSON.stringify(x)).join("\n"));
const W = path.join(AQUI, "node_modules", ".bin", "wrangler"), ENV = { ...process.env, WRANGLER_SEND_METRICS: "false" };
execFileSync("node", ["construir.mjs"], { cwd: AQUI });
execFileSync(W, ["d1", "execute", "finti", "--local", "--persist-to", estado, "--file", "esquema.sql"], { cwd: AQUI, env: ENV, stdio: "ignore" });
const dev = spawn(W, ["dev", "--local", "--port", String(PW), "--ip", "127.0.0.1", "--persist-to", estado, "--test-scheduled", "--env-file", vf, "--var", "SITE_URL:http://127.0.0.1:" + PW], { cwd: AQUI, env: ENV });
let log = ""; dev.stdout.on("data", (d) => (log += d)); dev.stderr.on("data", (d) => (log += d));
const B = "http://127.0.0.1:" + PW;
for (let i = 0; i < 120 && !/Ready on/.test(log); i++) await esp(250);
const api = async (ruta, o = {}) => { const r = await fetch(B + ruta, { ...o, headers: { "Content-Type": "application/json", ...(o.headers || {}) }, body: o.body && typeof o.body !== "string" ? JSON.stringify(o.body) : o.body, redirect: "manual" }); let j = null; try { j = await r.clone().json(); } catch {} return { r, j }; };

try {
  // Página y encabezados
  let { r } = await api("/");
  ok(r.status === 200 && /Content-Security-Policy/i.test([...r.headers.keys()].join(" ")) || r.headers.get("content-security-policy"), "la página sale con la CSP de seguridad");
  ok((r.headers.get("content-security-policy") || "").includes("frame-ancestors 'none'") && r.headers.get("x-frame-options") === "DENY", "mismos encabezados que en Netlify");
  ({ r } = await api("/app.js")); ok(r.status === 200 && /immutable/.test(r.headers.get("cache-control") || ""), "app.js con caché de un año");
  ({ r } = await api("/privacidad")); ok(r.status === 301 && /\/legal\/privacidad$/.test(r.headers.get("location") || ""), "/privacidad lleva a la política");
  ({ r } = await api("/.well-known/assetlinks.json")); ok(r.status === 200 && /co\.fintelligente\.app/.test(await r.text()), "assetlinks para la app de Android");
  ({ r } = await api("/panel")); ok(r.status === 200 && /noindex/.test(r.headers.get("x-robots-tag") || ""), "el panel abre, sin indexar: " + r.status);
  ({ r } = await api("/api/no-existe")); ok(r.status === 404, "una ruta de API que no existe da 404");
  let { j } = await api("/api/config"); ok(j && j.correo === true && j.cuentas === true && j.vapidPublicKey === v.publicKey, "configuración: correo, cuentas y avisos listos");

  // Cuenta con código por correo
  const correo = "persona@ejemplo.co";
  ({ r, j } = await api("/api/cuenta/codigo", { method: "POST", body: { correo } }));
  ok(r.status === 200, "pedir código: " + r.status + " " + JSON.stringify(j));
  for (let i = 0; i < 40 && !correos.length; i++) await esp(100);
  const crudo = correos.join("\n"); const html = (crudo.match(/Content-Type: text\/html[\s\S]*?\r?\n\r?\n([A-Za-z0-9+/=\r\n]+)/) || [])[1] || "";
  const cuerpo = Buffer.from(html.replace(/\s+/g, ""), "base64").toString("utf8");
  const codigo = (cuerpo.match(/\b\d{6}\b/) || [])[0];
  ok(!!codigo && /^Subject: =\?UTF-8\?B\?/m.test(crudo) || !!codigo, "el código llegó por correo SMTP desde el trabajador (" + (codigo || "sin código") + ")");
  ({ r, j } = await api("/api/cuenta/verificar", { method: "POST", body: { correo, codigo, dispositivo: "Prueba", consentimiento: { v: "1.0", edad: "18+" } } }));
  const token = j && (j.token || j.sesion); ok(r.status === 200 && !!token, "entrar con el código");
  const aut = { authorization: "Bearer " + token };
  ({ r, j } = await api("/api/datos", { method: "PUT", headers: aut, body: { base: 0, contenido: JSON.stringify({ ingresos: [{ n: "Sueldo", m: 2500000 }] }), dispositivo: "Prueba" } }));
  ok(r.status === 200, "guardar el presupuesto en la nube: " + r.status + " " + JSON.stringify(j).slice(0, 120));
  ({ r, j } = await api("/api/datos", { headers: aut })); ok(r.status === 200 && JSON.stringify(j).includes("Sueldo"), "leer el presupuesto (cifrado AES-GCM en D1)");
  // Cinco celulares guardan a la vez sobre la misma versión: solo uno gana y los demás reciben 409 (escritura condicional real)
  const varias = await Promise.all([1, 2, 3, 4, 5].map((n) => api("/api/datos", { method: "PUT", headers: aut, body: { base: 1, contenido: JSON.stringify({ n }), dispositivo: "Cel " + n } })));
  const est = varias.map((x) => x.r.status);
  ok(est.filter((x) => x === 200).length === 1 && est.filter((x) => x === 409).length === 4, "cinco guardados a la vez: uno gana y cuatro esperan (" + est.join(",") + ")");

  // Buzón cifrado
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }), pub = publicKey.export({ format: "jwk" });
  const tok = crypto.randomBytes(16).toString("hex");
  ({ r, j } = await api("/api/bandeja/registro", { method: "POST", body: { token: tok, pub: { kty: "RSA", n: pub.n, e: pub.e } } }));
  ok(r.status === 200 && j && j.buzon, "registrar el buzón del celular (RSA-OAEP en Workers)");
  if (j && j.buzon) {
    const cod = j.codigo || ("FT-" + j.buzon + "-" + j.clave);
    ({ r } = await api("/api/entrada", { method: "POST", body: { codigo: cod, texto: "Compraste $ 18.000 en Juan Valdez con tu tarjeta *1234" } }));
    ok(r.status === 200, "un aviso del atajo entra al buzón");
    ({ r, j } = await api("/api/bandeja?buzon=" + (j.buzon || "") + "&token=" + tok));
    const it = j && (j.items || j.avisos || [])[0];
    let claro = "";
    if (it) { const k = crypto.privateDecrypt({ key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(it.k || it.cifrado.k, "base64"));
      const c = Buffer.from(it.c || it.cifrado.c, "base64"), d = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(it.iv || it.cifrado.iv, "base64")); d.setAuthTag(c.subarray(-16)); claro = Buffer.concat([d.update(c.subarray(0, -16)), d.final()]).toString(); }
    ok(/Juan Valdez/.test(claro), "el celular descifra el aviso");
  }

  // Precios del DANE, mudanza y errores
  const sipsa = { fuente: "DANE, SIPSA", semana: "2026-11-09", productos: [{ n: "Papa capira", g: 1750, v: 9.4, b: ["Bogotá, D.C., Corabastos", 1600], c: { "Bogotá": [1675, "x", 1600] } }] };
  ({ r } = await api("/api/precios", { method: "POST", headers: { authorization: "Bearer " + vars.PRECIOS_CLAVE }, body: sipsa }));
  ({ r, j } = await api("/api/precios")); ok(r.status === 200 && j.semana === "2026-11-09", "precios del DANE: se guardan y se leen");
  const grande = { ...sipsa, productos: Array.from({ length: 1900 }, (_, i) => ({ n: "Producto " + i + " " + "x".repeat(60), g: 1000 + i, v: 1, b: ["Central " + "y".repeat(400), 900], c: { [("Ciudad" + "z".repeat(300))]: [1, "w".repeat(200), 1] } })), semana: "2026-11-16" };
  ({ r, j } = await api("/api/precios", { method: "POST", headers: { authorization: "Bearer " + vars.PRECIOS_CLAVE }, body: grande }));
  const tam = JSON.stringify(grande).length;
  ({ r, j } = await api("/api/precios")); ok(r.status === 200 && j.productos.length === 1900, "un valor de " + (tam / 1e6).toFixed(1) + " MB se parte en D1 y se lee completo");
  ({ r, j } = await api("/api/mudanza", { method: "POST", body: { datos: "x".repeat(1000) } })); ok(r.status === 200 || r.status === 400, "mudanza responde: " + r.status);
  ({ r } = await api("/api/errores", { method: "POST", body: { m: "prueba", v: "1" } })); ok(r.status < 500, "registrar un error de la app: " + r.status);

  // Tareas programadas
  for (const c of ["17 8 * * *", "0 * * * *", "5 * * * *"]) { const x = await fetch(B + "/__scheduled?cron=" + encodeURIComponent(c)); ok(x.status === 200, "tarea programada " + c); }
  await esp(1500);
  ({ r, j } = await api("/api/salud")); ok(j && j.ultimoRespaldo, "el respaldo diario corrió y quedó guardado (zlib y AES en Workers): " + JSON.stringify(j && j.ultimoRespaldo));

  // Migración
  ({ r } = await api("/api/migrar", { method: "POST", headers: { authorization: "Bearer mala" }, body: {} })); ok(r.status === 401, "migrar sin la clave: 401");
  ({ r, j } = await api("/api/migrar", { method: "POST", headers: { authorization: "Bearer " + vars.MIGRAR_CLAVE }, body: { tienda: "pagos", items: [{ clave: "ref-1", valor: JSON.stringify({ ok: 1 }) }, { clave: "foto", valor: Buffer.from([1, 2, 3]).toString("base64"), tipo: "b", meta: { a: 1 } }] } }));
  ok(r.status === 200 && j.guardados === 2, "migrar un lote");
  ({ r, j } = await api("/api/migrar", { headers: { authorization: "Bearer " + vars.MIGRAR_CLAVE } })); ok(j && j.conteo && j.conteo.pagos === 2, "contar lo migrado por almacén: " + JSON.stringify(j && j.conteo));

  if (process.env.VER_LOG) console.log(log.split("\n").filter((l) => /correo|smtp|SMTP|Error/i.test(l)).slice(0, 20).join("\n"));
  // La herramienta de migración, con un Netlify Blobs de mentira
  const mig = spawn(process.execPath, ["--import", "./pruebas/cargador-falso.mjs", "herramientas/migrar-datos.mjs"], { cwd: AQUI, env: { ...process.env, NETLIFY_SITE_ID: "x", NETLIFY_TOKEN: "y", MIGRAR_CLAVE: vars.MIGRAR_CLAVE, DESTINO: B } });
  let mo = ""; mig.stdout.on("data", (d) => (mo += d)); mig.stderr.on("data", (d) => (mo += d)); const cod = await new Promise((r) => mig.on("close", r));
  ok(cod === 0 && /Listo: todo quedó copiado/.test(mo), "la herramienta de migración copia y verifica" + (cod ? ": " + mo.slice(-300) : ""));
  ({ r, j } = await api("/api/migrar", { headers: { authorization: "Bearer " + vars.MIGRAR_CLAVE } }));
  ok(j.conteo["cuentas-usuarios"] >= 3 && j.conteo["salud-app"] >= 1, "lo migrado se cuenta en Cloudflare");
  ok(!/Uncaught|TypeError|ReferenceError|is not a function|No such module/.test(log), "sin errores en el registro del trabajador");
  if (/Uncaught|TypeError|ReferenceError|is not a function|No such module/.test(log)) console.log(log.split("\n").filter((l) => /Error|Uncaught|at /.test(l)).slice(0, 20).join("\n"));
} finally {
  dev.kill(); smtp.close(); fs.rmSync(estado, { recursive: true, force: true });
}
console.log(fallas ? fallas + " fallas" : "todo bien"); process.exit(fallas ? 1 : 0);
