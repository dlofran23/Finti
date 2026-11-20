// Corre todas las pruebas. Uso: npm test  (o: node pruebas/correr.mjs servidor | navegador)
// - Servidor: lógica de pagos, cuentas, buzón, avisos, correo y las funciones reales con Netlify Blobs local.
// - Navegador: la app completa en Chromium (Playwright) contra un servidor de prueba, con la CSP de producción.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs"; import path from "node:path"; import net from "node:net";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const solo = process.argv[2];
const FALLA = /FALLA|not ok|\b[1-9]\d* fallas\b|FALLAS:|bloqueos CSP: \[/;
const CON_MENU = new Set(["pagos.test.js", "cuentas-por-pagar.test.js", "bandeja.test.js", "traslados.test.js"]);

function correr(cmd, args, env = {}, max = 240000) {
  return new Promise((res) => {
    const p = spawn(cmd, args, { cwd: DIR, env: { ...process.env, ...env } });
    let out = ""; p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
    const t = setTimeout(() => { p.kill(); out += "\n[tiempo agotado]"; }, max);
    p.on("close", (code) => { clearTimeout(t); res({ code, out }); });
  });
}
const puertoLibre = () => new Promise((r) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
async function servidor() {
  const port = await puertoLibre();
  const p = spawn(process.execPath, [path.join(DIR, "navegador", "servidor.mjs"), String(port)], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) { try { await fetch(`http://localhost:${port}/api/config`); return { p, base: `http://localhost:${port}` }; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  throw new Error("no arrancó el servidor de prueba");
}

let fallas = 0;
const informe = (nombre, r) => {
  const mal = r.code !== 0 || FALLA.test(r.out);
  if (mal) fallas++;
  const ultima = r.out.trim().split("\n").filter(Boolean).pop() || "";
  console.log((mal ? "✗ " : "✓ ") + nombre.padEnd(34) + (mal ? "\n" + r.out.trim().split("\n").slice(-15).join("\n") : ultima.slice(0, 90)));
};

if (solo !== "navegador") {
  console.log("— Textos —");
  informe("ortografia.py", await correr("python3", [path.join(DIR, "..", "herramientas", "ortografia.py")]));
  console.log("— Servidor —");
  for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith(".test.mjs")).sort()) informe(f, await correr(process.execPath, [f]));
}
if (solo !== "navegador" && solo !== "servidor") {
  // Finti en Cloudflare: el mismo servidor en el motor real de Workers (solo si wrangler está instalado en cloudflare/)
  if (fs.existsSync(path.join(DIR, "..", "cloudflare", "node_modules", ".bin", "wrangler"))) {
    console.log("— Cloudflare —");
    const r = await new Promise((res) => { const q = spawn(process.execPath, ["pruebas/humo.mjs"], { cwd: path.join(DIR, "..", "cloudflare") }); let o = ""; q.stdout.on("data", (d) => (o += d)); q.stderr.on("data", (d) => (o += d)); q.on("close", (code) => res({ code, out: o })); });
    informe("cloudflare/humo.mjs", r);
  } else console.log("— Cloudflare — (omitido: corre npm install en cloudflare/)");
}
if (solo !== "servidor") {
  let playwright = true; try { createRequire(import.meta.url).resolve("playwright"); } catch { playwright = false; }
  if (!playwright) console.log("— Navegador — (omitido: falta Playwright. Instala con: npm ci && npx playwright install chromium)");
  else {
    console.log("— Navegador —");
    for (const f of fs.readdirSync(path.join(DIR, "navegador")).filter((f) => f.endsWith(".test.js")).sort()) {
      const s = await servidor();      // servidor nuevo para cada prueba: sin estado compartido
      const previos = (f === "acepto.test.js" ? [] : ["-r", "./navegador/acepto-previo.js"]).concat(f === "inicio.test.js" ? [] : ["-r", "./navegador/inicio-visto.js"]).concat(CON_MENU.has(f) ? ["-r", "./navegador/menu-lateral.js"] : []);
      const args = previos.concat("navegador/" + f);
      informe(f, await correr(process.execPath, args, { BASE: s.base }));
      s.p.kill();
    }
  }
}
console.log(fallas ? `\n${fallas} prueba(s) con fallas` : "\nTodas las pruebas pasaron");
process.exit(fallas ? 1 : 0);
