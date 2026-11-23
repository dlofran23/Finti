// En Cloudflare la CSP no lleva 'unsafe-inline' en script-src: cada script en línea va autorizado por su huella.
// Si alguien agrega un script en línea nuevo, construir.mjs calcula su huella sola; esta prueba revisa que así sea.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { encabezados, huellasScripts, firmarCSP } from "../cloudflare/construir.mjs";
const raiz = new URL("../", import.meta.url), leer = (p) => readFileSync(new URL(p, raiz), "utf8");
const paginas = ["public/index.html", "public/panel.html"].map(leer);
const huellas = huellasScripts(paginas);
assert.ok(huellas.length >= 2, "hay huellas para los scripts en línea: " + huellas.length);
const h = firmarCSP(encabezados(leer("netlify.toml")), huellas);
const src = /script-src ([^;]*)/.exec(h)[1];
assert.ok(!src.includes("'unsafe-inline'"), "script-src sin 'unsafe-inline'");
for (const x of huellas) assert.ok(src.includes(x), "la CSP incluye " + x);
assert.ok(/style-src [^;]*'unsafe-inline'/.test(h), "los estilos en línea siguen permitidos");
console.log("CSP de Cloudflare con huellas: bien (" + huellas.length + " scripts)");
