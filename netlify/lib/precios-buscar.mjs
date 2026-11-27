// Búsqueda en vivo en las tiendas en línea de las cadenas, para cualquier producto que alguien escriba en
// ¿Dónde compro? (GET /api/precios-buscar?q=jabon+rey). A la cadena solo le llega el nombre del producto: la petición
// sale del servidor de Finti, sin nada de la persona. Solo se consultan las cadenas cuyo robots.txt lo permite (se lee
// una vez al día), con la forma "?ft=jabon-rey" (palabras unidas con guion; sin "&" ni "%"). El resultado se guarda 12 horas por producto, para no
// repetir la consulta; las búsquedas de hace más de 2 días se borran (limpiarBusquedas, una vez al día).
import { CADENAS_LINEA, AGENTE, leerRobots, tamano, quitar } from "./cadenas.mjs";
import { limitar } from "./atomico.mjs";

const HORA = 36e5, GUARDA = 12 * HORA, ROBOTS = 24 * HORA, MAX_ITEMS = 5;
const PIDE = { headers: { "User-Agent": AGENTE, Accept: "application/json" } };

// "Jabón Rey x3!" → "jabon rey x3"; "" si no sirve (muy corta, muy larga o con más de 5 palabras)
export function consultaLimpia(q) {
  const t = quitar(q).replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
  return t.length >= 2 && t.length <= 40 && t.split(" ").length <= 5 && /[a-zñ]{2}/.test(t) ? t : "";
}

// Reglas de robots.txt de una cadena, guardadas un día. Devuelve la función que dice si una ruta se puede pedir.
async function robotsDe(store, cadena, fetchImpl, ahora) {
  const k = "robots-" + cadena.id, g = await store.get(k, { type: "json" });
  let reg = g && ahora - g.t < ROBOTS ? g : null;
  if (!reg) {
    try {
      const r = await fetchImpl(cadena.base + "/robots.txt", { ...PIDE, signal: AbortSignal.timeout(5000) });
      reg = r.ok ? { t: ahora, texto: (await r.text()).slice(0, 50000) } : { t: ahora, estado: r.status };
    } catch { reg = { t: ahora, estado: 0 }; }
    await store.setJSON(k, reg);
  }
  if (reg.texto != null) return leerRobots(reg.texto);
  // 401/403: no deja entrar a robots; 5xx o sin conexión: no se consulta hasta el día siguiente; 404: sin reglas
  return reg.estado === 404 || reg.estado === 410 ? () => true : () => false;
}

// Los primeros resultados de una cadena, con precio y, si el nombre dice el tamaño, precio por kilo, litro o unidad
export function itemsDe(resultados) {
  const out = [];
  for (const p of Array.isArray(resultados) ? resultados : []) {
    const item = p && p.items && p.items[0], o = item && item.sellers && item.sellers[0] && item.sellers[0].commertialOffer;
    if (!p || !p.productName || !o || !(o.Price > 0) || o.AvailableQuantity === 0) continue;
    const n = String(p.productName).replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80), t = tamano(n);
    out.push({ n, p: Math.round(o.Price), ...(t ? { u: t.u, pu: Math.round(o.Price / t.cant) } : {}) });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

export async function buscar({ store, limites, q, ip, fetchImpl = fetch, ahora = Date.now() }) {
  const c = consultaLimpia(q);
  if (!c) return { status: 400, body: { error: "Escribe un producto (por ejemplo: jabón rey)." } };
  const k = "b-" + c, g = await store.get(k, { type: "json" });
  if (g && ahora - g.t < GUARDA) return { status: 200, body: g };
  if (limites && !(await limitar(limites, "buscar:" + (ip || "?"), 40, HORA, ahora))) return { status: 429, body: { error: "Muchas búsquedas seguidas. Intenta en un rato." } };
  const ruta = "/api/catalog_system/pub/products/search?ft=" + c.replace(/ /g, "-");   // con "+" la tienda no responde; con guion sí
  const cadenas = (await Promise.all(CADENAS_LINEA.map(async (cad) => {
    try {
      if (!(await robotsDe(store, cad, fetchImpl, ahora))(ruta)) return null;
      const r = await fetchImpl(cad.base + ruta, { ...PIDE, signal: AbortSignal.timeout(6000) });
      if (!r.ok) return null;
      const items = itemsDe(await r.json());
      return items.length ? { c: cad.nombre, items } : null;
    } catch { return null; }
  }))).filter(Boolean);
  const body = { q: c, t: ahora, cadenas };
  await store.setJSON(k, body);
  return { status: 200, body };
}

export async function limpiarBusquedas(store, ahora = Date.now()) {
  if (typeof store.list !== "function") return 0;
  const { blobs } = await store.list({ prefix: "b-" }); let n = 0;
  for (const b of blobs || []) {
    const g = await store.get(b.key, { type: "json" });
    if (!g || ahora - (g.t || 0) > 48 * HORA) { await store.delete(b.key); n++; }
  }
  return n;
}
