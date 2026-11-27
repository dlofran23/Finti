// Qué tan bien entiende Finti (Pregúntale y "Cuéntame un gasto"), medido con las baterías de ia-bateria.js.
// No puede bajar del 95 % en ninguna, y nunca debe responder con plata a algo que no es de plata.
// Para ver el detalle: BASE=http://localhost:PUERTO node pruebas/navegador/ia-medir.js --detalle
require('./sin-bienvenida.js');
const { medir } = require('./ia-medir.js');
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
(async () => {
  const r = await medir(process.env.BASE);
  const pc = (x) => Math.round((x.bien / x.total) * 100);
  for (const [nombre, x] of [["Pregúntale", r.pregunta], ["control", r.control], ["ciega", r.ciega], ["ciega 2", r.ciega2]]) {
    ok(pc(x) >= 95, nombre + ": " + pc(x) + " % bien (" + x.bien + "/" + x.total + ")" + (pc(x) < 95 ? "\n  " + x.errores.join("\n  ") : ""));
    const inventa = x.errores.filter((e) => /esperaba nada/.test(e));
    ok(!inventa.length, nombre + ": no responde de plata a lo que no es de plata" + (inventa.length ? ": " + inventa.join(" | ") : ""));
  }
  ok(pc(r.charla) >= 95, "Cuéntame un gasto: " + pc(r.charla) + " % bien (" + r.charla.bien + "/" + r.charla.total + ")" + (pc(r.charla) < 95 ? "\n  " + r.charla.errores.join("\n  ") : ""));
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
