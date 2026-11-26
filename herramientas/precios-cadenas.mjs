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

export const AGENTE = "Finti/1.0 (precios de referencia; +https://finti.francisco-jzx14.workers.dev)";
export const CADENAS_LINEA = [
  { id: "olimpica", nombre: "Olímpica", base: "https://www.olimpica.com" },
  { id: "jumbo", nombre: "Jumbo", base: "https://www.tiendasjumbo.co" },
  { id: "metro", nombre: "Metro", base: "https://www.tiendasmetro.co" },
  { id: "exito", nombre: "Éxito", base: "https://www.exito.com" },
  { id: "carulla", nombre: "Carulla", base: "https://www.carulla.com" },
];
// Productos que se buscan: clave (la de precios-gente), palabras con que empieza el nombre, unidad y palabras que lo
// descartan (para que "leche" no traiga leche de coco ni "arroz" traiga arroz con leche).
export const BUSQUEDAS = [
  ["arroz", "arroz", "kg", ["leche", "chino", "mezcla", "listo", "galleta"]],
  ["huevo", "huevo", "u", ["codorniz", "arepa", "chocolate", "pascua"]],
  ["leche", "leche", "l", ["coco", "polvo", "crema", "condensada", "almendra", "soya", "avena", "arroz", "chocolate", "malteada", "saborizada", "fresa", "vainilla"]],
  ["azucar", "azucar", "kg", ["glass", "pulverizada", "morena light", "edulcorante"]],
  ["panela", "panela", "kg", ["limon", "pulverizada", "bebida"]],
  ["aceite", "aceite", "l", ["oliva", "spray", "coco", "aguacate", "motor", "moto", "bebe", "corporal", "almendra", "masaje"]],
  ["sal", "sal", "kg", ["galleta", "salsa", "salchicha", "salmon", "salado", "rosada", "parrilla"]],
  ["cafe", "cafe", "kg", ["capsula", "galleta", "dulce", "crema", "bebida", "taza", "molino", "cafetera"]],
  ["lenteja", "lenteja", "kg", ["sopa", "lista"]],
  ["frijol", "frijol", "kg", ["sopa", "lata", "listo", "antioqueno"]],
  ["garbanzo", "garbanzo", "kg", ["lata", "listo"]],
  ["pasta", "pasta", "kg", ["dental", "tomate", "lista", "sopa"]],
  ["harina", "harina", "kg", ["pancake", "torta", "bunuelo", "natilla", "lista", "almendra", "coco", "garbanzo", "gluten", "keto"]],
  ["avena", "avena", "kg", ["bebida", "galleta", "lista", "leche", "gluten"]],
  ["atun", "atun", "kg", ["galleta", "ensalada", "pate", "dip"]],
  ["mantequilla", "mantequilla", "kg", ["mani", "galleta", "ghee"]],
  ["papa", "papa", "kg", ["frita", "fosforito", "congelada", "francesa", "casquito", "mccain", "rapi", "chip", "paquete", "pure"]],
  ["papa criolla", "papa criolla", "kg", ["frita", "congelada", "precocida"]],
  ["tomate", "tomate", "kg", ["arbol", "salsa", "pasta", "cherry", "lata", "polpa", "diced", "seco", "tamarillo"]],
  ["cebolla", "cebolla", "kg", ["polvo", "frita", "encurtida"]],
  ["zanahoria", "zanahoria", "kg", ["baby", "rallada"]],
  ["platano", "platano", "kg", ["chip", "frito", "patacon", "tostada"]],
  ["banano", "banano", "kg", ["deshidratado", "chip", "compota"]],
  ["limon", "limon", "kg", ["jugo", "bebida", "te", "panela"]],
  ["papel higienico", "papel higienico", "u", ["humedo", "cocina"]],
];

const quitar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const singular = (w) => (/[nrldzj]es$/.test(w) && w.length > 4 ? w.slice(0, -2) : /s$/.test(w) && w.length > 3 ? w.slice(0, -1) : w);
const palabras = (s) => quitar(s).replace(/[^a-z0-9.,]+/g, " ").trim().split(" ").filter(Boolean);
const num = (s) => Number(String(s).replace(",", "."));
const cuartil = (l) => { const s = l.slice().sort((a, b) => a - b), i = (s.length - 1) * 0.25, a = Math.floor(i); return s.length ? s[a] + (s[Math.min(a + 1, s.length - 1)] - s[a]) * (i - a) : 0; };
// Categorías de mercado (las de VTEX vienen como "/Supermercado/Despensa/Arroces/")
const MERCADO = /supermercado|mercado|despensa|aliment|fruta|verdura|lacteo|desayuno|aseo|granos|huevo|abarrote|viveres|basico/;
// Ofertas y paquetes que no sirven para comparar el precio por unidad
const PROMO = /\b(oferta|promo|promocion|combo|kit|regalo|gratis|lleve|pague)\b|\b\d\s*x\s*\d\b(?!\s*(g|gr|kg|ml|l)\b)/;

// ---------- robots.txt ----------
// Reglas para "*" y para "finti" (la más específica gana; empate: Allow). Además, por prudencia, una ruta que cualquier
// grupo del archivo prohíbe tampoco se pide: hay archivos que ponen "Disallow: /api/" al final, después del grupo de
// otro robot, con la clara intención de que valga para todos. Devuelve una función que dice si una ruta se puede pedir.
export function leerRobots(texto) {
  const grupos = []; let actual = null, enAgentes = false;
  for (const crudo of String(texto || "").split(/\r?\n/)) {
    const l = crudo.replace(/#.*/, "").trim(); if (!l) continue;
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(l); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "user-agent") { if (!enAgentes) { actual = { agentes: [], reglas: [] }; grupos.push(actual); } actual.agentes.push(v.toLowerCase()); enAgentes = true; continue; }
    enAgentes = false;
    if (actual && (k === "allow" || k === "disallow")) actual.reglas.push({ permitir: k === "allow", patron: v });
  }
  const propios = grupos.filter((g) => g.agentes.some((a) => a !== "*" && "finti".includes(a)));
  const reglas = (propios.length ? propios : grupos.filter((g) => g.agentes.includes("*"))).flatMap((g) => g.reglas);
  const aRegex = (p) => new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
  const preparar = (rs) => rs.filter((r) => r.patron).map((r) => ({ ...r, re: aRegex(r.patron), largo: r.patron.length }));
  const decide = (lista, ruta) => {
    let mejor = null;
    for (const r of lista) if (r.re.test(ruta) && (!mejor || r.largo > mejor.largo || (r.largo === mejor.largo && r.permitir))) mejor = r;
    return !mejor || mejor.permitir;
  };
  const nuestras = preparar(reglas), otros = grupos.map((g) => preparar(g.reglas));
  return (ruta) => decide(nuestras, ruta) && otros.every((l) => decide(l, ruta));
}

// ---------- Tamaño y precio por unidad ----------
// "Arroz Diana 500 G" → { u: "kg", cant: 0.5 }; "Huevo x 30 Unds" → { u: "u", cant: 30 }; "Leche 900ML X6" → { u: "l", cant: 5.4 }
export function tamano(nombre) {
  const t0 = tamanoCrudo(nombre);
  return t0 && { u: t0.u, cant: Math.round(t0.cant * 1e6) / 1e6 };
}
function tamanoCrudo(nombre) {
  const t = quitar(nombre).replace(/(\d),(\d)/g, "$1.$2");
  const por = /\b(?:x|por|pack|paca)\s*(\d{1,3})\b(?!\s*(?:g|gr|grs|gramos|kg|ml|l|lt|cc)\b)/.exec(t);
  const veces = por ? +por[1] : 1;
  const m = /(\d+(?:\.\d+)?)\s*(kg|kilos?|kilogramos?|g|gr|grs|gramos?|lb|libras?|ml|cc|l|lt|lts|litros?)\b/.exec(t);
  if (m) {
    const n = num(m[1]), u = m[2];
    if (/^(kg|kilo)/.test(u)) return { u: "kg", cant: n * veces };
    if (/^(g|gr)/.test(u)) return { u: "kg", cant: (n / 1000) * veces };
    if (/^(lb|libra)/.test(u)) return { u: "kg", cant: n * 0.5 * veces };
    if (/^(ml|cc)/.test(u)) return { u: "l", cant: (n / 1000) * veces };
    return { u: "l", cant: n * veces };
  }
  const und = /(\d{1,3})\s*(?:und|unds|unid|unidades|u|rollos?|huevos?)\b/.exec(t) || /\bx\s*(\d{1,3})\b/.exec(t);
  if (und) return { u: "u", cant: +und[1] };
  if (/\b(x|por|el|1)\s*kg\b|\bkilo\b/.test(t)) return { u: "kg", cant: 1 };
  return null;
}

// ¿El nombre es de este producto? Empieza por sus palabras (en singular) y no trae ninguna que lo descarte.
export function esProducto(nombre, inicio, excluir) {
  const w = palabras(nombre).map(singular), q = palabras(inicio).map(singular);
  if (!q.every((x, i) => w[i] === x)) return false;
  const resto = " " + w.slice(q.length).join(" ") + " ";
  return !excluir.some((x) => resto.includes(" " + singular(x) + " ") || resto.includes(" " + x + " "));
}

// Resultados de la búsqueda VTEX → precio mediano por unidad, o null
export function precioDe(resultados, [clave, inicio, unidad, excluir]) {
  const vistos = [];
  for (const p of Array.isArray(resultados) ? resultados : []) {
    const nombre = p && p.productName, item = p && p.items && p.items[0], oferta = item && item.sellers && item.sellers[0] && item.sellers[0].commertialOffer;
    if (!nombre || !oferta || !(oferta.Price > 0) || oferta.AvailableQuantity === 0) continue;
    if (!esProducto(nombre, inicio, excluir) || PROMO.test(quitar(nombre))) continue;
    const cats = quitar((p.categories || []).join(" ")); if (cats && !MERCADO.test(cats)) continue;
    const t = tamano(nombre); if (!t || t.u !== unidad || !(t.cant > 0)) continue;
    const pu = oferta.Price / t.cant;
    if (pu >= 20 && pu <= 500000) vistos.push({ nombre, pu });
  }
  if (vistos.length < 2) return null;
  const ref = cuartil(vistos.map((x) => x.pu)), ej = vistos.reduce((a, x) => (Math.abs(x.pu - ref) < Math.abs(a.pu - ref) ? x : a), vistos[0]);
  return { clave, u: unidad, precio: Math.round(ref), n: vistos.length, ejemplo: ej.nombre.replace(/\s+/g, " ").trim().slice(0, 80) };
}

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
    const ruta = "/api/catalog_system/pub/products/search?ft=" + b[1].replace(/ /g, "+");
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
