// Tiendas en línea de las cadenas: lectura de robots.txt, tamaño y precio por unidad. Lo usan el flujo diario
// (herramientas/precios-cadenas.mjs, desde GitHub) y la búsqueda en vivo de ¿Dónde compro? (/api/precios-buscar).
// Solo se consulta lo que cada cadena permite en su robots.txt, con la forma "?ft=arroz" (sin "&" ni "%").
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

export const quitar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const singular = (w) => (/[nrldzj]es$/.test(w) && w.length > 4 ? w.slice(0, -2) : /s$/.test(w) && w.length > 3 ? w.slice(0, -1) : w);
export const palabras = (s) => quitar(s).replace(/[^a-z0-9.,]+/g, " ").trim().split(" ").filter(Boolean);
const num = (s) => Number(String(s).replace(",", "."));
const cuartil = (l) => { const s = l.slice().sort((a, b) => a - b), i = (s.length - 1) * 0.25, a = Math.floor(i); return s.length ? s[a] + (s[Math.min(a + 1, s.length - 1)] - s[a]) * (i - a) : 0; };
// Categorías de mercado (las de VTEX vienen como "/Supermercado/Despensa/Arroces/")
export const MERCADO = /supermercado|mercado|despensa|aliment|fruta|verdura|lacteo|desayuno|aseo|granos|huevo|abarrote|viveres|basico|bebida|cuidado personal|limpieza|carne|pollo|pescado|congelado|enlatado|panaderia|charcuteria|pasabocas|snack|bebe/;
// Ofertas y paquetes que no sirven para comparar el precio por unidad
export const PROMO = /\b(oferta|promo|promocion|combo|kit|regalo|gratis|lleve|pague)\b|\b\d\s*x\s*\d\b(?!\s*(g|gr|kg|ml|l)\b)/;

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

