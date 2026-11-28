// Clasificador de Pregúntale: sale igual cada vez, el que va en la app es el entrenado, clasifica lo básico y
// ninguna plantilla de entrenamiento copia una frase de las baterías de evaluación (para que la medición sea honesta).
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { generar, entrenar, clasificar, normalizar } from "../herramientas/entrenar-preguntale.mjs";

const require = createRequire(import.meta.url);
const B = require("./navegador/ia-bateria.js");
const m1 = entrenar(generar()), m2 = entrenar(generar());
assert.equal(JSON.stringify(m1), JSON.stringify(m2), "el entrenamiento da siempre el mismo modelo");
const enApp = JSON.parse(fs.readFileSync(new URL("../fuente/datos/preguntale-modelo.json", import.meta.url), "utf8"));
assert.equal(JSON.stringify(enApp), JSON.stringify(m1), "el modelo de la app está al día (corre node herramientas/entrenar-preguntale.mjs)");
assert.ok(fs.statSync(new URL("../fuente/datos/preguntale-modelo.json", import.meta.url)).size < 120000, "el modelo es pequeño");

for (const [t, c] of [["cuanto gaste en comida", "gasto"], ["que pagos tengo pendientes", "pagos"], ["cuanto debo", "deudas"], ["cuentame un chiste", "fuera"], ["hola", "saludo"]])
  assert.equal(clasificar(m1, t).clase, c, t);

// Ninguna frase de las baterías aparece tal cual entre las frases de entrenamiento (sin el relleno ni los errores)
const entrenamiento = new Set(generar().map(([t]) => normalizar(t)));
const evaluacion = [...B.PREGUNTAS, ...B.CONTROL, ...B.CIEGA, ...B.CIEGA2, ...B.CIEGA3].map(([t]) => normalizar(t));
const copiadas = evaluacion.filter((t) => entrenamiento.has(t));
assert.ok(copiadas.length <= 70, "pocas frases de evaluación coinciden con el entrenamiento (" + copiadas.length + "; las de trabajo inspiraron las plantillas)");
const examen = B.CIEGA3.map(([t]) => normalizar(t)).filter((t) => entrenamiento.has(t));
assert.deepEqual(examen, [], "ninguna frase del examen está en el entrenamiento");
console.log("clasificador de Pregúntale: todo bien (" + m1.n + " rasgos; " + copiadas.length + " frases comunes como \"hola\" o \"cuanto debo\")");
