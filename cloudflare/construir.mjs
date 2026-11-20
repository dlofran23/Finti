// Arma dist/: copia de public/ más el archivo _headers de Cloudflare, sacado de los [[headers]] de netlify.toml
// (así los encabezados de seguridad, la CSP y la caché quedan iguales en los dos lados). Uso: node construir.mjs
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

if (import.meta.url === "file://" + process.argv[1]) {
  fs.rmSync(DESTINO, { recursive: true, force: true });
  fs.cpSync(ORIGEN, DESTINO, { recursive: true });
  for (const f of ["_headers", "_redirects"]) fs.rmSync(path.join(DESTINO, f), { force: true });
  fs.writeFileSync(path.join(DESTINO, "_headers"), encabezados(fs.readFileSync(path.join(RAIZ, "netlify.toml"), "utf8")));
  // Los archivos que Cloudflare no debe servir
  for (const f of ["descargas/LEEME.txt"]) fs.rmSync(path.join(DESTINO, f), { force: true });
  let n = 0; (function contar(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? contar(path.join(d, e.name)) : n++; })(DESTINO);
  console.log("dist/ lista: " + n + " archivos y _headers con " + (fs.readFileSync(path.join(DESTINO, "_headers"), "utf8").match(/^\//gm) || []).length + " rutas.");
}
