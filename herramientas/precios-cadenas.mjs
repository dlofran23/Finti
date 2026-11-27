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

import { AGENTE, CADENAS_LINEA, leerRobots, tamano, esProducto, precioDe, claveNombre, cuartil, quitar, PROMO } from "../netlify/lib/cadenas.mjs";
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
  b("pañitos humedos", "u", [], "panito"), b("enjuague bucal", "l"), b("crema corporal", "l"), b("protector solar", "l"), b("talco", "kg"),
  // Más despensa
  b("arroz integral", "kg"), b("quinua", "kg"), b("maiz", "kg", ["pira", "tostado", "dulce", "harina"]), b("fideo", "kg", ["sopa"]),
  b("macarron", "kg"), b("lasagna", "kg"), b("salsa soya", "l"), b("salsa bbq", "kg"), b("salsa rosada", "kg"), b("aceite oliva", "l"),
  b("manteca", "kg"), b("polvo hornear", "kg"), b("canela", "kg"), b("comino", "kg"), b("color", "kg", [], "color"), b("pimienta", "kg"),
  b("cubo caldo", "kg", [], "caldo"), b("sopa", "kg", ["fideo"]), b("crema maiz", "kg"), b("frijol lata", "kg", [], "frijol"),
  b("maiz dulce", "kg"), b("palmito", "kg"), b("champiñon", "kg", [], "champinon"), b("leche almendra", "l"), b("bebida soya", "l"),
  b("cafe instantaneo", "kg"), b("aromatica", "u"), b("milo", "kg"), b("chocolisto", "kg"), b("azucar morena", "kg"), b("endulzante", "u"),
  // Snacks y dulces
  b("papas fritas", "kg", [], "papa"), b("chitos", "kg"), b("mani", "kg", ["mantequilla"]), b("chocolatina", "u"), b("bombon", "u"),
  b("chicle", "u"), b("barra cereal", "u"), b("galleta soda", "kg"), b("ponque", "kg"), b("arequipe", "kg"), b("helado", "l"),
  // Congelados, panadería y lácteos
  b("pan", "kg", ["tajado", "rallado", "queso", "perro", "hamburguesa"]), b("pan hamburguesa", "u"), b("pan perro", "u"), b("tostada", "kg"),
  b("almojabana", "u"), b("pandebono", "u"), b("nugget", "kg"), b("papa congelada", "kg", [], "papa"), b("queso campesino", "kg"),
  b("queso mozzarella", "kg"), b("queso crema", "kg"), b("avena bebida", "l", [], "avena"), b("crema agria", "kg"),
  // Bebidas
  b("agua con gas", "l", [], "agua"), b("bebida hidratante", "l"), b("energizante", "l"), b("te frio", "l", [], "te"), b("vino", "l"),
  b("aguardiente", "l"), b("ron", "l"),
  // Bebé
  b("leche formula", "kg"), b("compota", "kg"), b("toallita humeda", "u"),
];

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const PIDE = { headers: { "User-Agent": AGENTE, Accept: "application/json" } };

export async function extraerCadena(cadena, { fetchImpl = fetch, pausa = 1500, busquedas = BUSQUEDAS, log = console.log, descubrir = true } = {}) {
  let robots;
  try {
    const r = await fetchImpl(cadena.base + "/robots.txt", PIDE);
    if (r.status >= 500 || r.status === 429) throw new Error("robots.txt respondió " + r.status);
    // 401 o 403: la cadena no deja entrar a los robots, ni siquiera a leer sus reglas. Se respeta como "no".
    robots = r.ok ? leerRobots(await r.text()) : r.status === 401 || r.status === 403 ? () => false : () => true;
  } catch (e) { log(cadena.nombre + ": no respondió (" + (e.cause && e.cause.code || e.message) + "); se omite."); return { id: cadena.id, estado: "sin-conexion", productos: {} }; }
  const productos = {}; let permitidas = 0, bloqueada = false;
  for (const b of busquedas) {
    const ruta = "/api/catalog_system/pub/products/search?ft=" + b[1].replace(/ /g, "-");
    if (!robots(ruta)) continue;
    permitidas++;
    try {
      const r = await fetchImpl(cadena.base + ruta, PIDE);
      if (r.ok) { const p = precioDe(await r.json(), b); if (p) productos[p.clave + "|" + p.u] = [p.precio, p.n, p.ejemplo]; }
      else if (r.status === 403 || r.status === 429) { log(cadena.nombre + ": respondió " + r.status + "; se deja de consultar."); bloqueada = true; break; }
    } catch (e) { /* una búsqueda fallida no detiene las demás */ }
    await espera(pausa);
  }
  if (!permitidas) { log(cadena.nombre + ": su robots.txt no permite estas consultas; se omite."); return { id: cadena.id, estado: "no-permite", productos: {} }; }
  const fijos = Object.keys(productos).length;
  const desc = descubrir && !bloqueada ? await descubrirCadena(cadena, { fetchImpl, pausa, robots, log }) : {};
  for (const [k, v] of Object.entries(desc)) if (!productos[k]) productos[k] = v;
  log(cadena.nombre + ": " + fijos + " de la lista y " + (Object.keys(productos).length - fijos) + " descubiertos en sus categorías.");
  return { id: cadena.id, estado: "ok", productos, descubiertos: Object.keys(desc) };
}

// ---------- Descubrir productos en las categorías de la tienda ----------
// El árbol de categorías (/api/catalog_system/pub/category/tree/3) se recorre hasta las categorías finales de mercado,
// aseo, bebidas y cuidado personal; de cada una salen hasta 10 productos (?fq=C:/1/16/). Cada producto queda con su
// nombre corto ("arroz diana") y su precio por kilo, litro o unidad. Así aparecen productos que nadie escribió.
const RAIZ_MERCADO = /despensa|abarrote|mercado|supermercado|lacteo|huevo|bebida|licor|vino|carne|pollo|pescado|fruta|verdura|panaderia|reposteria|aseo|limpieza|cuidado personal|higiene|bebe|congelado|refrigerado|delicatessen|carnes frias|pasabocas|dulce|snack|desayuno|cafe|enlatado|grano|belleza|cuidado/;
export function hojasDeMercado(arbol, max = 160) {
  const out = [];
  const ir = (nodos, ruta, ok) => {
    for (const c of nodos || []) {
      if (out.length >= max) return;
      const r = ruta.concat(c.id), dentro = ok || RAIZ_MERCADO.test(quitar(c.name));
      if (c.children && c.children.length) ir(c.children, r, dentro);
      else if (dentro) out.push("/" + r.join("/") + "/");
    }
  };
  ir(arbol, [], false);
  return out;
}
export function agruparDescubiertos(lista) {
  const g = {};
  for (const p of lista) {
    const item = p && p.items && p.items[0], o = item && item.sellers && item.sellers[0] && item.sellers[0].commertialOffer;
    if (!p || !p.productName || !o || !(o.Price > 0) || o.AvailableQuantity === 0 || PROMO.test(quitar(p.productName))) continue;
    const k = claveNombre(p.productName), t = tamano(p.productName);
    if (!k || k.length < 3 || !t || !(t.cant > 0)) continue;
    const pu = o.Price / t.cant; if (!(pu >= 20 && pu <= 500000)) continue;
    (g[k + "|" + t.u] = g[k + "|" + t.u] || []).push({ pu, n: p.productName });
  }
  const out = {};
  for (const [k, l] of Object.entries(g)) {
    const ref = cuartil(l.map((x) => x.pu)), ej = l.reduce((a, x) => (Math.abs(x.pu - ref) < Math.abs(a.pu - ref) ? x : a), l[0]);
    out[k] = [Math.round(ref), l.length, ej.n.replace(/\s+/g, " ").trim().slice(0, 80)];
  }
  return out;
}
export async function descubrirCadena(cadena, { fetchImpl = fetch, pausa = 1500, robots = () => true, log = console.log, maxHojas = 160 } = {}) {
  const rutaArbol = "/api/catalog_system/pub/category/tree/3";
  if (!robots(rutaArbol)) return {};
  let hojas = [];
  try { const r = await fetchImpl(cadena.base + rutaArbol, PIDE); if (r.ok) hojas = hojasDeMercado(await r.json(), maxHojas); } catch { return {}; }
  const todos = [];
  for (const h of hojas) {
    const ruta = "/api/catalog_system/pub/products/search?fq=C:" + h;
    if (!robots(ruta)) continue;
    try {
      const r = await fetchImpl(cadena.base + ruta, PIDE);
      if (r.ok) { const l = await r.json(); if (Array.isArray(l)) todos.push(...l); }
      else if (r.status === 403 || r.status === 429) { log(cadena.nombre + ": respondió " + r.status + " en las categorías; se deja de consultar."); break; }
    } catch { /* sigue con la siguiente */ }
    await espera(pausa);
  }
  return agruparDescubiertos(todos);
}

// { dia, generado, cadenas: { olimpica: { nombre, productos: { "arroz|kg": [precio, n, ejemplo] } } }, estados }
export async function extraerTodo({ fetchImpl = fetch, pausa = 1500, solo = "", ahora = new Date(), log = console.log, busquedas = BUSQUEDAS, descubrir = true, maxDescubiertos = 1500 } = {}) {
  // Las cadenas van en paralelo (cada una a su ritmo de una consulta cada 1,5 s): con 10 cadenas una tras otra no
  // alcanzaría el tiempo del flujo, y a cada tienda le llegan las mismas consultas que antes.
  const cadenas = {}, estados = {};
  const res = await Promise.all(CADENAS_LINEA.filter((c) => !solo || c.id === solo).map((c) => extraerCadena(c, { fetchImpl, pausa, log, busquedas, descubrir }).then((r) => [c, r])));
  // De lo descubierto solo quedan los productos que están en al menos 2 cadenas (para comparar), los más repetidos primero
  const veces = {};
  for (const [, r] of res) for (const k of r.descubiertos || []) veces[k] = (veces[k] || 0) + 1;
  const quedan = new Set(Object.keys(veces).filter((k) => veces[k] >= 2).sort((a, b) => veces[b] - veces[a]).slice(0, maxDescubiertos));
  for (const [c, r] of res) {
    estados[c.id] = r.estado;
    const desc = new Set(r.descubiertos || []);
    for (const k of Object.keys(r.productos)) if (desc.has(k) && !quedan.has(k)) delete r.productos[k];
    if (Object.keys(r.productos).length) cadenas[c.id] = { nombre: c.nombre, productos: r.productos };
  }
  return { dia: new Date(ahora.getTime() - 5 * 36e5).toISOString().slice(0, 10), generado: ahora.toISOString(), cadenas, estados };
}

// Productos que pidió la gente (los más buscados en ¿Dónde compro?): "jabon rey 3x" → clave "jabon rey", unidad automática
export function claveDe(termino) { return claveNombre(termino); }
export function busquedasPopulares(terminos, fijas = BUSQUEDAS) {
  const ya = new Set(fijas.map((x) => x[0])), out = [];
  for (const t of terminos || []) { const k = claveDe(t); if (k.length >= 3 && !ya.has(k)) { ya.add(k); out.push([k, k, "auto", []]); } }
  return out;
}

// ---------- Línea de comandos ----------
if (import.meta.url === "file://" + process.argv[1]) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ""; };
  // --populares URL: los productos más buscados por la gente se suman a la lista fija
  let busquedas = BUSQUEDAS;
  if (arg("--populares")) {
    try { const j = await (await fetch(arg("--populares"))).json(); const extra = busquedasPopulares(j.populares); busquedas = BUSQUEDAS.concat(extra); console.log("Productos pedidos por la gente: " + extra.length + "."); }
    catch (e) { console.log("No pude leer los productos más buscados (" + e.message + "); sigo con la lista fija."); }
  }
  const r = await extraerTodo({ solo: arg("--solo"), busquedas });
  const n = Object.values(r.cadenas).reduce((a, c) => a + Object.keys(c.productos).length, 0);
  if (!n) { console.error("Ninguna cadena dio precios (" + JSON.stringify(r.estados) + ")."); process.exit(1); }
  fs.writeFileSync(arg("--salida") || "cadenas.json", JSON.stringify(r));
  console.log("Listo: " + n + " precios de " + Object.keys(r.cadenas).length + " cadenas.");
}
