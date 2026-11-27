// Precios de las tiendas en línea de las cadenas, para ¿Dónde compro? y Pregúntale. Lo corre GitHub Actions cada día.
//
// Solo consulta las cadenas que lo permiten: antes de cada una lee su robots.txt y no pide nada que esté prohibido
// para todos los robots (Éxito y Carulla, por ejemplo, prohíben /api/). Va despacio (una consulta cada 1,5 segundos)
// y se identifica como Finti. Las cadenas con tienda VTEX tienen una búsqueda pública (catalog_system/pub); se usa la
// forma más simple, "?ft=arroz", sin "&" ni "%", que algunas cadenas prohíben.
//
// Por producto toma los resultados de mercado (por su categoría) cuyo nombre empieza por el producto y dice su tamaño
// ("Arroz Diana 500 G", "Huevo x 30 Unds"), calcula el precio por kilo, litro o unidad y guarda el precio de
// referencia: el que deja por debajo al 25 % más barato (así no lo mueven los productos importados o especiales), con
// el nombre del producto más cercano a ese precio como ejemplo. Se necesitan al menos 2 productos comparables. Sin tamaño no se puede comparar
// (una "Papa Pastusa" a $ 6.900 no dice si es el kilo o la bolsa), así que se omite.
//
// Uso:
//   node herramientas/precios-cadenas.mjs --salida cadenas.json
//   node herramientas/precios-cadenas.mjs --solo olimpica --salida c.json
//
// No envía nada de nadie: solo descarga precios públicos.
import fs from "node:fs";

import { AGENTE, CADENAS_LINEA, leerRobots, tamano, esProducto, precioDe } from "../netlify/lib/cadenas.mjs";
export { AGENTE, CADENAS_LINEA, leerRobots, tamano, esProducto, precioDe };

// Productos que se buscan cada mañana: clave (como la arma la app), palabras con que empieza el nombre, unidad para
// comparar y palabras que lo descartan (para que "leche" no traiga leche de coco ni "arroz" traiga arroz con leche).
// La búsqueda en vivo de ¿Dónde compro? cubre cualquier otro producto.
const b = (clave, unidad, excluir = [], inicio = clave) => [clave, inicio, unidad, excluir];
export const BUSQUEDAS = [
  // Despensa
  b("arroz", "kg", ["leche", "chino", "mezcla", "listo", "galleta", "integral"]),
  b("frijol", "kg", ["sopa", "lata", "listo", "antioqueno"]), b("lenteja", "kg", ["sopa", "lista"]), b("garbanzo", "kg", ["lata", "listo"]),
  b("arveja seca", "kg", [], "arveja"), b("maiz pira", "kg", ["microondas"]),
  b("azucar", "kg", ["glass", "pulverizada", "light", "edulcorante"]), b("panela", "kg", ["limon", "pulverizada", "bebida"]),
  b("sal", "kg", ["galleta", "salsa", "salchicha", "salmon", "salado", "rosada", "parrilla"]),
  b("aceite", "l", ["oliva", "spray", "coco", "aguacate", "motor", "moto", "bebe", "corporal", "almendra", "masaje"]),
  b("cafe", "kg", ["capsula", "galleta", "dulce", "crema", "bebida", "taza", "molino", "cafetera"]),
  b("chocolate", "kg", ["chocolatina", "leche", "bebida", "galleta", "cobertura", "relleno", "barra"]),
  b("harina", "kg", ["pancake", "torta", "bunuelo", "natilla", "lista", "almendra", "coco", "garbanzo", "gluten", "keto"]),
  b("harina pan", "kg"), b("pasta", "kg", ["dental", "tomate", "lista", "sopa"]), b("spaghetti", "kg"),
  b("avena", "kg", ["bebida", "galleta", "lista", "leche", "gluten"]),
  b("atun", "kg", ["galleta", "ensalada", "pate", "dip"]), b("sardina", "kg"),
  b("salsa tomate", "kg"), b("mayonesa", "kg"), b("mostaza", "kg"), b("vinagre", "l"),
  b("margarina", "kg"), b("mantequilla", "kg", ["mani", "galleta", "ghee"]),
  b("galleta", "kg", ["perro", "gato"]), b("pan tajado", "kg"), b("arepa", "u", ["huevo", "mezcla"]),
  b("cereal", "kg", ["barra", "bebe"]), b("granola", "kg", ["barra"]), b("gelatina", "kg"),
  b("leche polvo", "kg", [], "leche polvo"), b("leche condensada", "kg"), b("crema leche", "kg"),
  b("miel", "kg"), b("mermelada", "kg"), b("bocadillo", "kg"), b("caldo", "kg", ["pollo listo"]),
  // Lácteos y huevos
  b("leche", "l", ["coco", "polvo", "crema", "condensada", "almendra", "soya", "avena", "arroz", "chocolate", "malteada", "saborizada", "fresa", "vainilla"]),
  b("yogur", "kg", ["griego bebible"]), b("kumis", "l"), b("queso", "kg", ["crema", "untable", "galleta"]), b("huevo", "u", ["codorniz", "arepa", "chocolate", "pascua"]),
  // Carnes
  b("pollo", "kg", ["caldo", "salchicha", "nugget", "apanado", "sopa", "consome", "molipollo", "congelado", "jamon", "mortadela"]), b("pechuga", "kg"), b("carne molida", "kg"),
  b("carne res", "kg", [], "carne"), b("cerdo", "kg"), b("chorizo", "kg"), b("salchicha", "kg"), b("jamon", "kg"), b("mortadela", "kg"),
  b("tocineta", "kg"), b("tilapia", "kg"), b("camaron", "kg"),
  // Frutas y verduras (solo las que dicen el tamaño)
  b("papa", "kg", ["frita", "fosforito", "congelada", "francesa", "casquito", "mccain", "rapi", "chip", "paquete", "pure"]),
  b("papa criolla", "kg", ["frita", "congelada", "precocida"]),
  b("tomate", "kg", ["arbol", "salsa", "pasta", "cherry", "lata", "polpa", "diced", "seco", "tamarillo"]), b("tomate arbol", "kg", [], "tomate de arbol"),
  b("cebolla", "kg", ["polvo", "frita", "encurtida"]), b("cebolla cabezona", "kg"), b("zanahoria", "kg", ["baby", "rallada"]),
  b("platano", "kg", ["chip", "frito", "patacon", "tostada"]), b("banano", "kg", ["deshidratado", "chip", "compota"]),
  b("limon", "kg", ["jugo", "bebida", "te", "panela"]), b("aguacate", "kg"), b("mango", "kg", ["jugo", "deshidratado"]),
  b("manzana", "kg", ["jugo", "compota", "vinagre"]), b("naranja", "kg", ["jugo"]), b("mandarina", "kg"), b("fresa", "kg", ["yogur", "mermelada"]),
  b("uva", "kg", ["pasa"]), b("mora", "kg", ["mermelada", "jugo"]), b("lulo", "kg"), b("maracuya", "kg", ["jugo"]), b("guayaba", "kg", ["jugo", "bocadillo"]),
  b("papaya", "kg"), b("pepino", "kg"), b("pimenton", "kg"), b("remolacha", "kg"), b("ahuyama", "kg"), b("habichuela", "kg"), b("ajo", "kg", ["polvo", "sal"]),
  b("yuca", "kg", ["frita", "congelada", "mccain", "palito", "rapi", "precocida"]), b("arracacha", "kg"),
  // Bebidas
  b("gaseosa", "l"), b("coca cola", "l", [], "gaseosa coca cola"), b("agua", "l", ["oxigenada", "micelar", "colonia", "coco", "termal"]),
  b("jugo", "l", ["polvo", "sobre"]), b("cerveza", "l"), b("malta", "l"), b("te", "kg", ["frio", "bebida"]),
  // Aseo del hogar
  b("detergente", "kg", ["liquido"]), b("detergente liquido", "l"), b("jabon rey", "kg"), b("lavaloza", "kg"), b("suavizante", "l"),
  b("blanqueador", "l"), b("limpiador", "l"), b("desinfectante", "l"), b("papel higienico", "u", ["humedo", "cocina"]),
  b("servilleta", "u"), b("toalla cocina", "u"), b("bolsa basura", "u"), b("esponja", "u"),
  // Cuidado personal
  b("crema dental", "kg"), b("shampoo", "l"), b("acondicionador", "l"), b("jabon tocador", "kg", [], "jabon"),
  b("toalla higienica", "u"), b("panal", "u", ["humedo", "toallita"]), b("cepillo dental", "u"), b("desodorante", "kg"),
];

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const PIDE = { headers: { "User-Agent": AGENTE, Accept: "application/json" } };

export async function extraerCadena(cadena, { fetchImpl = fetch, pausa = 1500, busquedas = BUSQUEDAS, log = console.log } = {}) {
  let robots;
  try {
    const r = await fetchImpl(cadena.base + "/robots.txt", PIDE);
    if (r.status >= 500 || r.status === 429) throw new Error("robots.txt respondió " + r.status);
    // 401 o 403: la cadena no deja entrar a los robots, ni siquiera a leer sus reglas. Se respeta como "no".
    robots = r.ok ? leerRobots(await r.text()) : r.status === 401 || r.status === 403 ? () => false : () => true;
  } catch (e) { log(cadena.nombre + ": no respondió (" + (e.cause && e.cause.code || e.message) + "); se omite."); return { id: cadena.id, estado: "sin-conexion", productos: {} }; }
  const productos = {}; let permitidas = 0;
  for (const b of busquedas) {
    const ruta = "/api/catalog_system/pub/products/search?ft=" + b[1].replace(/ /g, "-");
    if (!robots(ruta)) continue;
    permitidas++;
    try {
      const r = await fetchImpl(cadena.base + ruta, PIDE);
      if (r.ok) { const p = precioDe(await r.json(), b); if (p) productos[p.clave + "|" + p.u] = [p.precio, p.n, p.ejemplo]; }
      else if (r.status === 403 || r.status === 429) { log(cadena.nombre + ": respondió " + r.status + "; se deja de consultar."); break; }
    } catch (e) { /* una búsqueda fallida no detiene las demás */ }
    await espera(pausa);
  }
  if (!permitidas) { log(cadena.nombre + ": su robots.txt no permite estas consultas; se omite."); return { id: cadena.id, estado: "no-permite", productos: {} }; }
  log(cadena.nombre + ": " + Object.keys(productos).length + " productos con precio.");
  return { id: cadena.id, estado: "ok", productos };
}

// { dia, generado, cadenas: { olimpica: { nombre, productos: { "arroz|kg": [precio, n, ejemplo] } } }, estados }
export async function extraerTodo({ fetchImpl = fetch, pausa = 1500, solo = "", ahora = new Date(), log = console.log } = {}) {
  const cadenas = {}, estados = {};
  for (const c of CADENAS_LINEA) {
    if (solo && c.id !== solo) continue;
    const r = await extraerCadena(c, { fetchImpl, pausa, log }); estados[c.id] = r.estado;
    if (Object.keys(r.productos).length) cadenas[c.id] = { nombre: c.nombre, productos: r.productos };
  }
  return { dia: new Date(ahora.getTime() - 5 * 36e5).toISOString().slice(0, 10), generado: ahora.toISOString(), cadenas, estados };
}

// ---------- Línea de comandos ----------
if (import.meta.url === "file://" + process.argv[1]) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ""; };
  const r = await extraerTodo({ solo: arg("--solo") });
  const n = Object.values(r.cadenas).reduce((a, c) => a + Object.keys(c.productos).length, 0);
  if (!n) { console.error("Ninguna cadena dio precios (" + JSON.stringify(r.estados) + ")."); process.exit(1); }
  fs.writeFileSync(arg("--salida") || "cadenas.json", JSON.stringify(r));
  console.log("Listo: " + n + " precios de " + Object.keys(r.cadenas).length + " cadenas.");
}
