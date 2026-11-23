// Arma dist/: copia de public/ más el archivo _headers de Cloudflare, sacado de los [[headers]] de netlify.toml
// (así los encabezados de seguridad, la CSP y la caché quedan iguales en los dos lados). Uso: node construir.mjs
import { createHash } from "node:crypto";
import fs from "node:fs"; import path from "node:path";
const AQUI = path.dirname(new URL(import.meta.url).pathname), RAIZ = path.join(AQUI, "..");
const ORIGEN = path.join(RAIZ, "public"), DESTINO = path.join(AQUI, "dist");

export function encabezados(toml) {
  const bloques = toml.split(/^\[\[headers\]\]\s*$/m).slice(1), salida = [];
  for (const b of bloques) {
    const ruta = (/^\s*for\s*=\s*"([^"]+)"/m.exec(b) || [])[1]; if (!ruta) continue;
    const valores = b.split(/^\s*\[headers\.values\]\s*$/m)[1] || "";
    const lineas = [];
    for (const l of valores.split("\n")) {
      if (/^\s*\[/.test(l)) break;
      const m = /^\s*([A-Za-z0-9-]+)\s*=\s*"(.*)"\s*$/.exec(l); if (m) lineas.push("  " + m[1] + ": " + m[2].replace(/\\"/g, '"'));
    }
    if (lineas.length) salida.push(ruta, ...lineas);
  }
  return salida.join("\n") + "\n";
}

// En Cloudflare ya no hay marca de Netlify que inyecte código, así que los scripts en línea se autorizan por su huella
// (sha256) y se quita 'unsafe-inline' de script-src: si algo se colara en un texto, el navegador no lo ejecutaría.
// Las huellas salen de las páginas tal como se publican, así que cambian solas en cada versión.
export function huellasScripts(htmls) {
  const set = new Set();
  for (const h of htmls) for (const m of h.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/type="(?:text\/plain|application\/json)"/.test(m[1])) continue;
    set.add("'sha256-" + createHash("sha256").update(m[2], "utf8").digest("base64") + "'");
  }
  return [...set];
}
export function firmarCSP(headers, huellas) {
  return headers.replace(/(Content-Security-Policy: [^\n]*script-src )([^;]*)/g, (t, pre, src) => pre + src.split(/\s+/).filter((x) => x && x !== "'unsafe-inline'").concat(huellas).join(" "));
}

if (import.meta.url === "file://" + process.argv[1]) {
  fs.rmSync(DESTINO, { recursive: true, force: true });
  fs.cpSync(ORIGEN, DESTINO, { recursive: true });
  for (const f of ["_headers", "_redirects"]) fs.rmSync(path.join(DESTINO, f), { force: true });
  const paginas = ["index.html", "panel.html"].filter((f) => fs.existsSync(path.join(DESTINO, f))).map((f) => fs.readFileSync(path.join(DESTINO, f), "utf8"));
  fs.writeFileSync(path.join(DESTINO, "_headers"), firmarCSP(encabezados(fs.readFileSync(path.join(RAIZ, "netlify.toml"), "utf8")), huellasScripts(paginas)));
  // Los archivos que Cloudflare no debe servir
  for (const f of ["descargas/LEEME.txt"]) fs.rmSync(path.join(DESTINO, f), { force: true });
  let n = 0; (function contar(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? contar(path.join(d, e.name)) : n++; })(DESTINO);
  console.log("dist/ lista: " + n + " archivos y _headers con " + (fs.readFileSync(path.join(DESTINO, "_headers"), "utf8").match(/^\//gm) || []).length + " rutas.");
}
