// La página publicada debe enlazar el manifiesto (instalar y atajos), el favicon y el ícono de iPhone, y los íconos deben
// ser los de Finti (azul), no los violetas de antes. Con el cambio de nombre esta cabecera se perdió sin que nada avisara.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const raiz = new URL("../", import.meta.url);
const leer = (p) => readFileSync(new URL(p, raiz));
const html = leer("public/index.html").toString("utf8");
for (const t of ['<link rel="manifest" href="/manifest.webmanifest">', '<link rel="apple-touch-icon" href="/apple-touch-icon.png">', '<link rel="icon" href="/favicon.svg"'])
  assert.ok(html.includes(t), "falta en la cabecera: " + t);
assert.ok(leer("public/favicon.svg").toString("utf8").includes("#2e5bff"), "el favicon debe ser el azul de Finti");
const huella = (p) => createHash("sha1").update(leer(p)).digest("hex");
for (const f of ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "badge-96.png"])
  assert.equal(huella("public/" + f), huella("marca-finti/web/" + f), f + " debe ser el del kit de Finti");
for (const d of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"])
  assert.equal(huella(`android/app/src/main/res/mipmap-${d}/ic_launcher.png`), huella(`marca-finti/android/mipmap-${d}/ic_launcher.png`), "ícono de Android " + d);
const css = leer("public/legal/legal.css").toString("utf8");
assert.ok(css.includes("#09090b") && css.includes("#2e5bff") && !/7c5cff|6a4af0/i.test(css), "las páginas legales llevan la identidad de Finti");
console.log("cabecera e íconos de Finti: bien");
