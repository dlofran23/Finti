// Precios que aporta la gente: validación, personas distintas, mínimo para mostrar, precios extremos y límites.
import assert from "node:assert/strict";
import { memStore } from "./memoria.mjs";
import { aporteValido, aportar, resumen, resumirCelda, lista, PRODUCTOS, CADENAS, CIUDADES, MIN_PERSONAS } from "../netlify/lib/precios-gente.mjs";

const AHORA = Date.parse("2026-11-26T18:00:00Z"), HOY = "2026-11-26";
const a = (x = {}) => ({ p: "papa criolla", c: "d1", u: "kg", v: 3900, d: HOY, ...x });

// 1. Solo productos, cadenas, unidades, precios y fechas válidos; nada de texto libre
assert.deepEqual(aporteValido(a(), AHORA), { p: "papa criolla", c: "d1", u: "kg", v: 3900, d: HOY });
assert.equal(aporteValido(a({ p: "mi cuñado juan" }), AHORA), null);
assert.equal(aporteValido(a({ p: "constructor" }), AHORA), null);           // no se cuela por el prototipo
assert.equal(aporteValido(a({ c: "tienda de doña rosa" }), AHORA), null);
assert.equal(aporteValido(a({ u: "lb" }), AHORA), null);
assert.equal(aporteValido(a({ v: 10 }), AHORA), null); assert.equal(aporteValido(a({ v: "x" }), AHORA), null);
assert.equal(aporteValido(a({ d: "2026-10-01" }), AHORA), null);            // más de 14 días
assert.equal(aporteValido(a({ d: "2026-12-30" }), AHORA), null);            // futuro
assert.equal(aporteValido(a({ v: 3900.7, extra: "algo" }), AHORA).v, 3901);
assert.ok(!("extra" in aporteValido(a({ extra: "x" }), AHORA)));

// 2. Lista pública: productos, cadenas con patrón y ciudades
const l = lista();
assert.ok(l.productos["papa criolla"] && l.ciudades.includes("Cali") && l.cadenas.find((c) => c.id === "d1"));
const cad = (txt) => (l.cadenas.find((c) => new RegExp(c.patron).test(txt)) || {}).id;
assert.equal(cad("d1 de la 80"), "d1"); assert.equal(cad("el exito de unicentro"), "exito"); assert.equal(cad("tiendas ara"), "ara");
assert.equal(cad("para la casa"), undefined); assert.equal(cad("olimpica"), "olimpica"); assert.equal(cad("super inter"), "superinter");

// 3. Aportes: ciudad válida, máximo 40 por envío, la misma persona cuenta una vez por día
const store = memStore(), limites = memStore();
assert.equal((await aportar({ store, limites, body: { ciudad: "Gotham", aportes: [a()] }, ip: "1.1.1.1", ahora: AHORA })).status, 400);
assert.equal((await aportar({ store, limites, body: { ciudad: "Bogotá", aportes: [a({ p: "nada" })] }, ip: "1.1.1.1", ahora: AHORA })).status, 400);
let r = await aportar({ store, limites, body: { ciudad: "Bogotá", aportes: [a(), a({ v: 4000 })] }, ip: "1.1.1.1", ahora: AHORA });
assert.equal(r.status, 200);
let res = await resumen({ store, ahora: AHORA });
assert.deepEqual(res.ciudades, {}, "con una sola persona no se muestra nada");
const guardado = JSON.parse(store._m.get("c-bogota").v);
assert.equal(guardado.a["papa criolla|kg"].d1.length, 1, "la misma persona, mismo día y producto: cuenta una vez (queda el último)");
assert.equal(guardado.a["papa criolla|kg"].d1[0][2].length, 4, "solo un código corto, sin IP");
assert.ok(!JSON.stringify(guardado).includes("1.1.1.1"));

// 4. Con tres personas se muestra la mediana; un precio absurdo no la mueve
await aportar({ store, limites, body: { ciudad: "Bogotá", aportes: [a({ v: 3800 }), a({ c: "exito", v: 4800 })] }, ip: "2.2.2.2", ahora: AHORA });
await aportar({ store, limites, body: { ciudad: "Bogotá", aportes: [a({ v: 4100 }), a({ c: "exito", v: 5000 })] }, ip: "3.3.3.3", ahora: AHORA });
await aportar({ store, limites, body: { ciudad: "Bogotá", aportes: [a({ v: 99000 })] }, ip: "4.4.4.4", ahora: AHORA });
res = await resumen({ store, ahora: AHORA });
assert.deepEqual(res.ciudades["Bogotá"]["papa criolla|kg"], [["D1", 4000, 3, HOY]], "mediana de 3.800, 4.000 y 4.100; el de 99.000 se descarta; Éxito tiene solo 2 personas");
assert.equal(MIN_PERSONAS, 3);
// 5. Después de 14 días ya no cuenta
assert.deepEqual((await resumen({ store, ahora: AHORA + 16 * 864e5 })).ciudades, {});
assert.equal(resumirCelda([["2026-11-20", 100, "aaaa"]], "2026-11-25"), null);

// 6. Límite por IP: 12 envíos al día
let ultimo;
for (let i = 0; i < 13; i++) ultimo = await aportar({ store, limites, body: { ciudad: "Cali", aportes: [a({ p: "arroz" })] }, ip: "9.9.9.9", ahora: AHORA });
assert.equal(ultimo.status, 429);

// 7. La lista de productos usa las claves que arma la app (minúsculas, sin tildes)
for (const k of Object.keys(PRODUCTOS)) assert.match(k, /^[a-zñ]+( [a-zñ]+)?$/, k);
assert.ok(CADENAS.length >= 15 && CIUDADES.length >= 20);
console.log("precios de la gente: todo bien");
