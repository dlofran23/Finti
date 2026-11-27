// Mide la batería (ia-bateria.js) en la app: aciertos, "no entendí" y respuestas equivocadas.
// Uso: BASE=http://localhost:PUERTO node pruebas/navegador/ia-medir.js [--detalle]
const { chromium } = require('playwright');
const { PREGUNTAS, CHARLA, CONTROL, CIEGA, CIEGA2 } = require('./ia-bateria.js');
async function medir(base) {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
  await p.addInitScript(() => { try { localStorage.setItem('fintelligente-historia', '1'); sessionStorage.setItem('fintelligente-sin-cuenta', '1'); } catch (e) {} });
  await p.goto(base, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const pr = await p.evaluate((l) => l.map(([t]) => window.FinPreguntas.entender(t)), PREGUNTAS);
  const co = await p.evaluate((l) => l.map(([t]) => window.FinPreguntas.entender(t)), CONTROL);
  const ci = await p.evaluate((l) => l.map(([t]) => window.FinPreguntas.entender(t)), CIEGA);
  const c2 = await p.evaluate((l) => l.map(([t]) => window.FinPreguntas.entender(t)), CIEGA2);
  const ch = await p.evaluate((l) => l.map(([t]) => window.FinEntender(t)), CHARLA);
  await b.close();
  const res = { ciega2: { bien: 0, nose: 0, mal: 0, total: CIEGA2.length, errores: [] }, ciega: { bien: 0, nose: 0, mal: 0, total: CIEGA.length, errores: [] }, control: { bien: 0, nose: 0, mal: 0, total: CONTROL.length, errores: [] }, pregunta: { bien: 0, nose: 0, mal: 0, total: PREGUNTAS.length, errores: [] }, charla: { bien: 0, monto: 0, cat: 0, total: CHARLA.length, errores: [] } };
  PREGUNTAS.forEach(([t, esp], i) => {
    const ok = [].concat(esp), got = pr[i].intent || "";
    if (ok.includes(got) || (ok.includes("producto") && got === "accion")) res.pregunta.bien++;
    else if (!got) { res.pregunta.nose++; res.pregunta.errores.push("NO ENTENDIÓ  " + t + "  (esperaba " + ok.join("/") + ")"); }
    else { res.pregunta.mal++; res.pregunta.errores.push("EQUIVOCADA   " + t + "  → " + got + " (esperaba " + (ok.join("/") || "nada") + ")"); }
  });
  CONTROL.forEach(([t, esp], i) => {
    const ok = [].concat(esp), got = co[i].intent || "";
    if (ok.includes(got) || (ok.includes("producto") && got === "accion")) res.control.bien++;
    else if (!got) { res.control.nose++; res.control.errores.push("NO ENTENDIÓ  " + t); }
    else { res.control.mal++; res.control.errores.push("EQUIVOCADA   " + t + "  → " + got + " (esperaba " + (ok.join("/") || "nada") + ")"); }
  });
  CIEGA2.forEach(([t, esp], i) => {
    const ok = [].concat(esp), got = c2[i].intent || "";
    if (ok.includes(got) || (ok.includes("producto") && got === "accion")) res.ciega2.bien++;
    else if (!got) { res.ciega2.nose++; res.ciega2.errores.push("NO ENTENDIÓ  " + t + "  (esperaba " + ok.join("/") + ")"); }
    else { res.ciega2.mal++; res.ciega2.errores.push("EQUIVOCADA   " + t + "  → " + got + " (esperaba " + (ok.join("/") || "nada") + ")"); }
  });
  CIEGA.forEach(([t, esp], i) => {
    const ok = [].concat(esp), got = ci[i].intent || "";
    if (ok.includes(got) || (ok.includes("producto") && got === "accion")) res.ciega.bien++;
    else if (!got) { res.ciega.nose++; res.ciega.errores.push("NO ENTENDIÓ  " + t + "  (esperaba " + ok.join("/") + ")"); }
    else { res.ciega.mal++; res.ciega.errores.push("EQUIVOCADA   " + t + "  → " + got + " (esperaba " + (ok.join("/") || "nada") + ")"); }
  });
  CHARLA.forEach(([t, monto, cat, tipo], i) => {
    const x = (ch[i] || [])[0] || {}, mOk = x.m === monto, cOk = !cat || [].concat(cat).includes(x.cat), tOk = (tipo || "g") === x.t;
    if (mOk) res.charla.monto++; if (cOk && tOk) res.charla.cat++;
    if (mOk && cOk && tOk) res.charla.bien++;
    else res.charla.errores.push(t + "  → $" + x.m + " " + x.t + " " + x.cat + "  (esperaba $" + monto + " " + (tipo || "g") + " " + [].concat(cat || "-").join("/") + ")");
  });
  return res;
}
module.exports = { medir };
if (require.main === module) medir(process.env.BASE).then((r) => {
  const pc = (a, b) => Math.round((a / b) * 100) + " %";
  console.log("Pregúntale: " + r.pregunta.bien + "/" + r.pregunta.total + " bien (" + pc(r.pregunta.bien, r.pregunta.total) + "), " + r.pregunta.nose + " no entendió, " + r.pregunta.mal + " equivocadas");
  console.log("Cuéntame un gasto: " + r.charla.bien + "/" + r.charla.total + " bien (" + pc(r.charla.bien, r.charla.total) + "); monto " + pc(r.charla.monto, r.charla.total) + ", categoría y tipo " + pc(r.charla.cat, r.charla.total));
  console.log("Control (frases nuevas): " + r.control.bien + "/" + r.control.total + " bien (" + pc(r.control.bien, r.control.total) + "), " + r.control.nose + " no entendió, " + r.control.mal + " equivocadas");
  console.log("Ciega (escrita después, sin ajustar): " + r.ciega.bien + "/" + r.ciega.total + " bien (" + pc(r.ciega.bien, r.ciega.total) + "), " + r.ciega.nose + " no entendió, " + r.ciega.mal + " equivocadas");
  if (process.argv.includes("--control")) console.log(r.control.errores.join("\n"));
  console.log("Ciega 2 (medida una sola vez): " + r.ciega2.bien + "/" + r.ciega2.total + " bien (" + pc(r.ciega2.bien, r.ciega2.total) + "), " + r.ciega2.nose + " no entendió, " + r.ciega2.mal + " equivocadas");
  if (process.argv.includes("--ciega")) console.log(r.ciega.errores.join("\n"));
  if (process.argv.includes("--ciega2")) console.log(r.ciega2.errores.join("\n"));
  if (process.argv.includes("--detalle")) { console.log("\n" + r.pregunta.errores.join("\n")); console.log("\n" + r.charla.errores.join("\n")); }
});
