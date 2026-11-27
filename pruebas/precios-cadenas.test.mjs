// Precios de las tiendas en línea: respeta robots.txt, entiende tamaños, descarta lo que no es el producto y guarda
// solo con la clave.
import assert from "node:assert/strict";
import { leerRobots, tamano, esProducto, precioDe, extraerCadena, BUSQUEDAS, claveDe, busquedasPopulares, hojasDeMercado, agruparDescubiertos, extraerTodo } from "../herramientas/precios-cadenas.mjs";
import { claveNombre } from "../netlify/lib/cadenas.mjs";
import { guardarLinea, leerLinea } from "../netlify/lib/precios-gente.mjs";
import { memStore } from "./memoria.mjs";

// 1. robots.txt
const olimpica = leerRobots("User-agent: *\nDisallow: /secret\nDisallow: /*&\nDisallow: /*%\n\nUser-agent: Googlebot\nAllow: /*\nDisallow: /busca/*\n");
assert.ok(olimpica("/api/catalog_system/pub/products/search?ft=arroz"));
assert.ok(olimpica("/api/catalog_system/pub/products/search?ft=papa+criolla"));
assert.ok(!olimpica("/api/catalog_system/pub/products/search?ft=arroz&_from=0"), "prohíbe &");
assert.ok(!olimpica("/api/catalog_system/pub/products/search?ft=papa%20criolla"), "prohíbe %");
assert.ok(!olimpica("/busca/arroz"), "lo que prohíbe a otro robot tampoco se pide");
// Éxito: "Disallow: /api/" al final, después del grupo de otro robot
const exito = leerRobots("User-agent: *\nAllow: /\n\nUser-agent: Applebot-Extended\nAllow: /\n\n# APIs\nDisallow: /api/\n");
assert.ok(!exito("/api/catalog_system/pub/products/search?ft=arroz")); assert.ok(exito("/frutas"));
assert.ok(leerRobots("User-agent: *\nDisallow: /api/\nAllow: /api/catalog_system/\n")("/api/catalog_system/pub/x"), "la regla más específica gana");
assert.ok(!leerRobots("User-agent: finti\nDisallow: /\n\nUser-agent: *\nAllow: /\n")("/x"), "las reglas para Finti mandan");
assert.ok(leerRobots("")("/api/x"));

// 2. Tamaños
assert.deepEqual(tamano("Arroz Diana 500 G"), { u: "kg", cant: 0.5 });
assert.deepEqual(tamano("Arroz Mi Arroz 3 Kg"), { u: "kg", cant: 3 });
assert.deepEqual(tamano("Limón Tahití 1,5 Kg"), { u: "kg", cant: 1.5 });
assert.deepEqual(tamano("Huevo Acondesa x 12und"), { u: "u", cant: 12 });
assert.deepEqual(tamano("HUEVO X 30 UNDS TIPO A"), { u: "u", cant: 30 });
assert.deepEqual(tamano("LECHE UHT 900ML X6"), { u: "l", cant: 5.4 });
assert.deepEqual(tamano("Avena original 200g x6"), { u: "kg", cant: 1.2 });
assert.deepEqual(tamano("Tomate Chonto X Kg"), { u: "kg", cant: 1 });
assert.deepEqual(tamano("Papa Criolla 2 Lb"), { u: "kg", cant: 1 });
assert.equal(tamano("Papa Pastusa"), null, "sin tamaño no se compara");

// 3. ¿Es el producto?
const b = (k) => BUSQUEDAS.find((x) => x[0] === k);
assert.ok(esProducto("Arroz Diana 500 G", "arroz", b("arroz")[3]));
assert.ok(!esProducto("Crema de leche Alqueria 850g", "leche", b("leche")[3]), "no empieza por leche");
assert.ok(!esProducto("LECHE COCO SELECTO 400ML", "leche", b("leche")[3]), "leche de coco no");
assert.ok(!esProducto("Papas fritas Margarita 115 G", "papa", b("papa")[3]));
assert.ok(esProducto("Papas criollas 1 Kg", "papa criolla", b("papa criolla")[3]), "plural");

// 4. Precio de referencia (cuartil bajo, al menos 2 comparables, solo categorías de mercado, sin ofertas)
const prod = (nombre, precio, cat = "/Supermercado/Despensa/Arroces/") => ({ productName: nombre, categories: [cat], items: [{ sellers: [{ commertialOffer: { Price: precio, AvailableQuantity: 10 } }] }] });
const r = precioDe([prod("Arroz Diana 500 G", 2150), prod("Arroz Mi Arroz 3 Kg", 9650), prod("Arroz Roa 1 Kg", 3900), prod("Arroz Diana 5 Kg", 17680),
  prod("Arroz con leche 200 G", 5000), prod("Arroz Diana 3x2 500 G", 4300), prod("Arroz Premium 1 Kg", 3000, "/Mascotas/Concentrado/"), prod("Arroz Diana sin tamaño", 1000)], b("arroz"));
assert.equal(r.n, 4); assert.equal(r.u, "kg");
assert.equal(r.precio, 3456, "cuartil bajo de 3.217, 3.536, 3.900 y 4.300");
assert.equal(r.ejemplo, "Arroz Diana 5 Kg", "el más cercano a ese precio");
assert.equal(precioDe([prod("Arroz Diana 500 G", 2150)], b("arroz")), null, "con uno solo no se publica");
assert.equal(precioDe("no es lista", b("arroz")), null);

// 5. Una cadena completa con fetch simulado: lee robots, va despacio y para si la bloquean
const pedidos = [];
const falso = (robots, respuestas) => async (url) => {
  pedidos.push(url);
  if (url.endsWith("/robots.txt")) return robots;
  return respuestas(url);
};
const ok = { ok: true, status: 200, text: async () => "User-agent: *\nDisallow: /*&\n" };
const json = (d) => ({ ok: true, status: 200, json: async () => d });
const c1 = await extraerCadena({ id: "olimpica", nombre: "Olímpica", base: "https://x.co" }, { pausa: 0, log: () => {}, busquedas: [b("arroz"), b("huevo")],
  fetchImpl: falso(ok, (u) => /ft=arroz/.test(u) ? json([prod("Arroz Diana 500 G", 2150), prod("Arroz Roa 1 Kg", 3900)]) : json([prod("Huevo x 30 unds", 16800, "/Supermercado/Huevos/"), prod("Huevo x 12 unds", 8990, "/Supermercado/Huevos/")])) });
assert.equal(c1.estado, "ok"); assert.deepEqual(Object.keys(c1.productos).sort(), ["arroz|kg", "huevo|u"]);
assert.ok(pedidos.every((u) => !/[&%]/.test(u.split("?")[1] || "")), "nunca pide con & ni %");
const c2 = await extraerCadena({ id: "exito", nombre: "Éxito", base: "https://e.co" }, { pausa: 0, log: () => {}, fetchImpl: falso({ ok: true, status: 200, text: async () => "User-agent: *\nDisallow: /api/\n" }, () => { throw new Error("no debía pedir"); }) });
assert.equal(c2.estado, "no-permite");
const c3 = await extraerCadena({ id: "exito", nombre: "Éxito", base: "https://e.co" }, { pausa: 0, log: () => {}, fetchImpl: falso({ ok: false, status: 403 }, () => { throw new Error("no debía pedir"); }) });
assert.equal(c3.estado, "no-permite", "si bloquea hasta el robots.txt, no se consulta");
let n403 = 0;
const c4 = await extraerCadena({ id: "jumbo", nombre: "Jumbo", base: "https://j.co" }, { pausa: 0, log: () => {}, fetchImpl: falso({ ok: false, status: 404 }, () => { n403++; return { ok: false, status: 403 }; }) });
assert.equal(n403, 1, "con un 403 deja de consultar"); assert.deepEqual(c4.productos, {});
const c5 = await extraerCadena({ id: "metro", nombre: "Metro", base: "https://m.co" }, { pausa: 0, log: () => {}, fetchImpl: async () => { throw new TypeError("fetch failed"); } });
assert.equal(c5.estado, "sin-conexion");

// 6. Guardar (solo con la clave) y leer
const store = memStore(), env = { PRECIOS_CLAVE: "c".repeat(24) }, aut = "Bearer " + env.PRECIOS_CLAVE, AHORA = Date.parse("2026-11-26T15:00:00Z");
const datos = { dia: "2026-11-26", cadenas: { olimpica: { nombre: "Olímpica", productos: { "arroz|kg": [3398, 4, "Arroz <b>Mi</b> Arroz 3 Kg"], "inventado|kg": [1, 1, ""], "huevo|u": [780, 6, "Huevo x 12"] } }, falsa: { productos: { "arroz|kg": [1000, 2, "x"] } } } };
assert.equal((await guardarLinea({ store, env, autorizacion: "Bearer mala", texto: JSON.stringify(datos) })).status, 401);
assert.equal((await guardarLinea({ store, env: {}, autorizacion: aut, texto: "{}" })).status, 503);
assert.equal((await guardarLinea({ store, env, autorizacion: aut, texto: "{}" })).status, 400);
const g = await guardarLinea({ store, env, autorizacion: aut, texto: JSON.stringify(datos), ahora: AHORA });
assert.equal(g.status, 200); assert.equal(g.body.precios, 2, "descarta productos y cadenas que no están en las listas");
const l = await leerLinea({ store, ahora: AHORA });
assert.deepEqual(l.productos["arroz|kg"], [["Olímpica", 3398, 4, "Arroz bMi/b Arroz 3 Kg"]]);
assert.equal(await leerLinea({ store, ahora: AHORA + 9 * 864e5 }), null, "si el flujo dejó de correr, no se muestran precios viejos");

// 7. Productos que pidió la gente: clave corta, sin repetir los fijos, con la unidad que más se repite
assert.equal(claveDe("Jabón Rey x3"), "jabon rey"); assert.equal(claveDe("shampoos savital 400"), "shampoo savital");
assert.deepEqual(busquedasPopulares(["jabon rey 3", "shampoo savital", "shampoo savital", "x1"]), [["shampoo savital", "shampoo savital", "auto", []]]);
const k = BUSQUEDAS.map((x) => x[0]); assert.equal(new Set(k).size, k.length, "sin productos repetidos"); assert.ok(k.length >= 150);
const auto = precioDe([prod("Shampoo Savital 550 ml", 19900, "/Cuidado personal/"), prod("Shampoo Savital 1000 ml", 30000, "/Cuidado personal/"), prod("Shampoo Savital Sachet 25 g", 900, "/Cuidado personal/")], ["shampoo savital", "shampoo savital", "auto", []]);
assert.equal(auto.u, "l", "la unidad que más se repite"); assert.equal(auto.n, 2);

// 8. Descubrir productos en las categorías
assert.equal(claveNombre("Arroz Diana x 500 G"), "arroz diana"); assert.equal(claveNombre("Caldo de Gallina Maggi 10 Und"), "caldo gallina");
const arbol = [{ id: 1, name: "Despensa", children: [{ id: 16, name: "Caldos", children: [] }, { id: 17, name: "Arroz", children: [] }] },
  { id: 9, name: "Juguetería", children: [{ id: 90, name: "Muñecas", children: [] }] }, { id: 5, name: "Supermercado", children: [{ id: 50, name: "Aseo", children: [{ id: 51, name: "Detergentes" }] }] }];
assert.deepEqual(hojasDeMercado(arbol), ["/1/16/", "/1/17/", "/5/50/51/"], "solo categorías de mercado, hasta la última");
const gd = agruparDescubiertos([prod("Arroz Diana 500 G", 2150), prod("Arroz Diana 1 Kg", 4000), prod("Muñeca sin tamaño", 50000), prod("Arroz Diana 3x2 500 G", 1000)]);
assert.deepEqual(Object.keys(gd), ["arroz diana|kg"]); assert.equal(gd["arroz diana|kg"][1], 2);
// Lo descubierto solo queda si está en 2 cadenas o más; lo de la lista fija siempre
const tienda = (precio) => async (url) => {
  if (url.endsWith("/robots.txt")) return { ok: true, status: 200, text: async () => "User-agent: *\nDisallow: /*&\n" };
  if (url.includes("category/tree")) return { ok: true, status: 200, json: async () => [{ id: 1, name: "Despensa", children: [{ id: 2, name: "Granos" }] }] };
  if (url.includes("fq=C:")) return { ok: true, status: 200, json: async () => [prod("Lenteja Diana 500 G", precio), prod(precio > 3000 ? "Garbanzo Raro 500 G" : "Frijol Raro 500 G", 5000)] };
  return { ok: true, status: 200, json: async () => [prod("Arroz Diana 500 G", 2150), prod("Arroz Roa 1 Kg", 3900)] };
};
const { CADENAS_LINEA } = await import("../netlify/lib/cadenas.mjs");
const cuantas = CADENAS_LINEA.length;
const multi = async (url) => tienda(url.includes(CADENAS_LINEA[0].base) ? 3500 : 2900)(url);
const todo = await extraerTodo({ fetchImpl: multi, pausa: 0, log: () => {}, busquedas: [b("arroz")] });
const c0 = todo.cadenas[CADENAS_LINEA[0].id].productos;
assert.ok(c0["arroz|kg"], "la lista fija queda"); assert.ok(c0["lenteja diana|kg"], "lo que está en varias cadenas queda");
assert.ok(!c0["garbanzo raro|kg"], "lo que está en una sola cadena no"); assert.ok(cuantas >= 10);

console.log("precios de las cadenas: todo bien");
