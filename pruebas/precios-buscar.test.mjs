// Búsqueda en vivo en las tiendas en línea: limpia la consulta, respeta robots.txt, guarda la respuesta y limita abusos.
import assert from "node:assert/strict";
import { consultaLimpia, itemsDe, buscar, limpiarBusquedas, populares } from "../netlify/lib/precios-buscar.mjs";
import { productoValido } from "../netlify/lib/precios-gente.mjs";
import { memStore } from "./memoria.mjs";

// 1. La consulta: sin tildes, sin símbolos, corta
assert.equal(consultaLimpia("Jabón Rey!"), "jabon rey");
assert.equal(consultaLimpia("  Coca-Cola 1,5 L "), "coca cola 1 5 l");
assert.equal(consultaLimpia("x"), ""); assert.equal(consultaLimpia("123"), "");
assert.equal(consultaLimpia("a b c d e f"), "", "más de 5 palabras no");
assert.equal(consultaLimpia("x".repeat(41)), "");

// 2. Resultados: precio, tamaño y precio por unidad; sin agotados; máximo 5
const prod = (n, p, disp = 5) => ({ productName: n, items: [{ sellers: [{ commertialOffer: { Price: p, AvailableQuantity: disp } }] }] });
assert.deepEqual(itemsDe([prod("Jabón Rey <b>300 g</b>", 3300), prod("Agotado 1 Kg", 100, 0), prod("Sin tamaño", 500)]),
  [{ n: "Jabón Rey b300 g/b", p: 3300, u: "kg", pu: 11000 }, { n: "Sin tamaño", p: 500 }]);
assert.equal(itemsDe(Array.from({ length: 9 }, (_, i) => prod("P " + i, 100 + i))).length, 5);

// 3. Busca solo en las cadenas cuyo robots.txt lo permite, con guion entre palabras y sin & ni %
const pedidos = [];
const falso = async (url) => {
  pedidos.push(url);
  if (url.endsWith("/robots.txt")) {
    if (url.includes("exito")) return { ok: true, status: 200, text: async () => "User-agent: *\nAllow: /\n\nUser-agent: Otro\nAllow: /\n# APIs\nDisallow: /api/\n" };
    if (url.includes("carulla")) return { ok: false, status: 403 };
    if (url.includes("jumbo") || url.includes("metro")) throw new TypeError("fetch failed");
    if (!url.includes("olimpica")) return { ok: true, status: 200, text: async () => "User-agent: *\nDisallow: /api/\n" };
    return { ok: true, status: 200, text: async () => "User-agent: *\nDisallow: /*&\nDisallow: /*%\n" };
  }
  return { ok: true, status: 200, json: async () => [prod("Jabón Rey 300 g x3", 9990), prod("Jabón Rey 250 g", 3200)] };
};
const store = memStore(), limites = memStore(), AHORA = Date.parse("2026-11-27T15:00:00Z");
const r = await buscar({ store, limites, q: "Jabón Rey", ip: "1.1.1.1", fetchImpl: falso, ahora: AHORA });
assert.equal(r.status, 200); assert.equal(r.body.q, "jabon rey");
assert.deepEqual(r.body.cadenas.map((c) => c.c), ["Olímpica"], "solo la cadena que lo permite");
assert.equal(r.body.cadenas[0].items[0].pu, 11100);
const consultas = pedidos.filter((u) => !u.endsWith("/robots.txt"));
assert.deepEqual(consultas, ["https://www.olimpica.com/api/catalog_system/pub/products/search?ft=jabon-rey"]);
assert.ok(consultas.every((u) => !/[&%]/.test(u.split("?")[1])));

// 4. Guarda la respuesta 12 horas y las reglas de robots.txt un día
const antes = pedidos.length;
await buscar({ store, limites, q: "jabon  REY", ip: "1.1.1.1", fetchImpl: falso, ahora: AHORA + 3600e3 });
assert.equal(pedidos.length, antes, "la misma búsqueda no vuelve a consultar");
await buscar({ store, limites, q: "arroz", ip: "1.1.1.1", fetchImpl: falso, ahora: AHORA + 3600e3 });
import { CADENAS_LINEA } from "../netlify/lib/cadenas.mjs";
assert.equal(pedidos.filter((u) => u.endsWith("/robots.txt")).length, CADENAS_LINEA.length, "robots.txt se lee una vez al día");
assert.equal((await buscar({ store, limites, q: "", ip: "1.1.1.1", fetchImpl: falso })).status, 400);

// 5. Límite: 40 búsquedas nuevas por hora por IP
let ultimo;
for (let i = 0; i < 41; i++) ultimo = await buscar({ store, limites, q: "producto " + i, ip: "9.9.9.9", fetchImpl: falso, ahora: AHORA });
assert.equal(ultimo.status, 429);

// 6. Limpieza: borra las búsquedas de hace más de 2 días, no las reglas de robots.txt
const borradas = await limpiarBusquedas(store, AHORA + 3 * 864e5);
assert.ok(borradas >= 40); assert.ok(store._m.has("robots-olimpica")); assert.ok(![...store._m.keys()].some((k) => k.startsWith("b-")));

// 7. Cualquier nombre corto de producto vale; texto largo o raro no
assert.ok(productoValido("jabon rey")); assert.ok(productoValido("shampoo")); assert.ok(productoValido("coca cola"));
assert.ok(!productoValido("mi cuñado juan")); assert.ok(!productoValido("constructor")); assert.ok(!productoValido("1234")); assert.ok(!productoValido("a"));
// 8. Los más buscados (al menos 3 veces) entran al flujo diario
const st2 = memStore();
for (let i = 0; i < 3; i++) await buscar({ store: st2, q: "Jabón Rey", ip: "1.1.1." + i, fetchImpl: falso, ahora: AHORA + i });
await buscar({ store: st2, q: "arepas", ip: "1.1.1.9", fetchImpl: falso, ahora: AHORA });
await new Promise((r) => setTimeout(r, 20));
assert.deepEqual(await populares(st2), ["jabon rey"], "solo lo que se buscó 3 veces o más");
console.log("búsqueda en las tiendas en línea: todo bien");
