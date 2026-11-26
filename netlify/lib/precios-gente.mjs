// Precios que aporta la gente: lo que pagó cada persona por un producto en una cadena de su ciudad.
// Solo con su permiso (en ¿Dónde compro?). La app manda por cada compra: producto (de una lista cerrada), cadena (de
// una lista cerrada), ciudad, precio por kilo, litro o unidad, y el día. Nada más: ni nombre, ni cuenta, ni total del
// mercado, ni el texto que escribió la persona, ni la sucursal.
// La IP solo se usa para frenar abusos (huella de 24 horas, ver atomico.limitar) y para un código de 4 letras que cambia
// cada día y sirve para contar personas distintas sin poder reconocerlas (65.536 valores posibles: se repiten).
// Un precio se muestra cuando lo reportaron al menos MIN_PERSONAS en los últimos DIAS días.
import crypto from "node:crypto";
import { actualizar, limitar, Conflicto } from "./atomico.mjs";

export const DIAS = 14, MIN_PERSONAS = 3;
const DIA = 864e5, MAX_POR_CELDA = 60, MAX_APORTES = 40;

// Claves como las arma la app (canClave: minúsculas, sin tildes ni palabras vacías, en singular, máximo dos palabras).
export const PRODUCTOS = {
  "papa": "Papa", "papa criolla": "Papa criolla", "tomate": "Tomate", "tomate arbol": "Tomate de árbol", "cebolla": "Cebolla",
  "cebolla cabezona": "Cebolla cabezona", "cebolla junca": "Cebolla junca", "zanahoria": "Zanahoria", "platano": "Plátano",
  "yuca": "Yuca", "arracacha": "Arracacha", "ahuyama": "Ahuyama", "habichuela": "Habichuela", "arveja": "Arveja", "frijol": "Fríjol",
  "lenteja": "Lenteja", "garbanzo": "Garbanzo", "pepino": "Pepino", "pimenton": "Pimentón", "lechuga": "Lechuga", "remolacha": "Remolacha",
  "aguacate": "Aguacate", "banano": "Banano", "limon": "Limón", "naranja": "Naranja", "mandarina": "Mandarina", "mango": "Mango",
  "manzana": "Manzana", "mora": "Mora", "lulo": "Lulo", "maracuya": "Maracuyá", "guayaba": "Guayaba", "granadilla": "Granadilla",
  "papaya": "Papaya", "pina": "Piña", "fresa": "Fresa", "uva": "Uva", "arroz": "Arroz", "azucar": "Azúcar", "panela": "Panela",
  "sal": "Sal", "aceite": "Aceite", "cafe": "Café", "chocolate": "Chocolate", "leche": "Leche", "huevo": "Huevos", "queso": "Queso",
  "mantequilla": "Mantequilla", "pan": "Pan", "arepa": "Arepas", "harina": "Harina", "pasta": "Pasta", "atun": "Atún", "pollo": "Pollo",
  "carne": "Carne de res", "cerdo": "Carne de cerdo", "pescado": "Pescado", "salchicha": "Salchichas", "jamon": "Jamón", "yogur": "Yogur",
  "avena": "Avena", "galleta": "Galletas", "jabon": "Jabón", "detergente": "Detergente", "papel higienico": "Papel higiénico",
  "crema dental": "Crema dental",
};

// Cadenas y cómo reconocerlas en el lugar que escribió la persona (texto ya en minúsculas y sin tildes).
export const CADENAS = [
  ["exito", "Éxito", "\\bexito\\b"], ["carulla", "Carulla", "\\bcarulla\\b"], ["olimpica", "Olímpica", "\\b(olimpica|sao)\\b"],
  ["jumbo", "Jumbo", "\\bjumbo\\b"], ["metro", "Metro", "\\b(almacenes |super(mercado)? )?metro\\b"], ["d1", "D1", "\\bd ?1\\b"],
  ["ara", "Ara", "\\bara\\b"], ["makro", "Makro", "\\bmakro\\b"], ["isimo", "Ísimo", "\\bisimo\\b"], ["surtimax", "Surtimax", "\\bsurtimax\\b"],
  ["superinter", "Super Inter", "\\bsuper ?inter\\b"], ["colsubsidio", "Colsubsidio", "\\bcolsubsidio\\b"],
  ["pricesmart", "PriceSmart", "\\bprice ?smart\\b"], ["mercacentro", "Mercacentro", "\\bmercacentro\\b"],
  ["zapatoca", "Zapatoca", "\\bzapatoca\\b"], ["vaquita", "La Vaquita", "\\bla vaquita\\b"], ["mercaldas", "Mercaldas", "\\bmercaldas\\b"],
];
const NOMBRE_CADENA = Object.fromEntries(CADENAS.map(([id, n]) => [id, n]));

export const CIUDADES = ["Armenia", "Barranquilla", "Bogotá", "Bucaramanga", "Cali", "Cartagena", "Cúcuta", "Florencia", "Ibagué",
  "Manizales", "Medellín", "Montería", "Neiva", "Pasto", "Pereira", "Popayán", "Quibdó", "Riohacha", "Santa Marta", "Sincelejo",
  "Tunja", "Valledupar", "Villavicencio", "Yopal"];
const UNIDADES = ["kg", "l", "u"];
const claveCiudad = (c) => "c-" + c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, "-");
const diaDe = (t) => new Date(t - 5 * 36e5).toISOString().slice(0, 10);   // día en Colombia
const mediana = (l) => { const s = l.slice().sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };

export function lista() {
  return { productos: PRODUCTOS, cadenas: CADENAS.map(([id, nombre, patron]) => ({ id, nombre, patron })), ciudades: CIUDADES, dias: DIAS, min: MIN_PERSONAS };
}

// Revisa un aporte; devuelve el aporte limpio o null
export function aporteValido(a, ahora = Date.now()) {
  if (!a || typeof a !== "object") return null;
  const p = String(a.p || ""), c = String(a.c || ""), u = String(a.u || ""), v = Number(a.v), d = String(a.d || "");
  if (!Object.prototype.hasOwnProperty.call(PRODUCTOS, p) || !NOMBRE_CADENA[c] || !UNIDADES.includes(u)) return null;
  if (!Number.isFinite(v) || v < 50 || v > 2e6) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > diaDe(ahora + DIA) || d < diaDe(ahora - DIAS * DIA)) return null;
  return { p, c, u, v: Math.round(v), d };
}

export async function aportar({ store, limites, body, ip, env = {}, ahora = Date.now() }) {
  const ciudad = String((body && body.ciudad) || "");
  if (!CIUDADES.includes(ciudad)) return { status: 400, body: { error: "Ciudad no válida." } };
  const lista = Array.isArray(body && body.aportes) ? body.aportes.slice(0, MAX_APORTES).map((a) => aporteValido(a, ahora)).filter(Boolean) : [];
  if (!lista.length) return { status: 400, body: { error: "No hay precios válidos." } };
  if (limites && !(await limitar(limites, "gente:" + (ip || "?"), 12, DIA, ahora))) return { status: 429, body: { error: "Ya recibimos tus precios de hoy." } };
  const sal = String(env.CUENTAS_SECRET || env.LICENSE_SECRET || "finti-precios");
  const o = crypto.createHmac("sha256", sal).update(diaDe(ahora) + "|" + (ip || "?")).digest("hex").slice(0, 4);
  const desde = diaDe(ahora - DIAS * DIA);
  try {
    await actualizar(store, claveCiudad(ciudad), (reg) => {
      const a = (reg && reg.a) || {};
      for (const x of lista) {
        const celda = (a[x.p + "|" + x.u] = a[x.p + "|" + x.u] || {});
        // La misma persona (mismo código del día) cuenta una vez por producto, cadena y día de compra
        const l = (celda[x.c] || []).filter((e) => e[0] >= desde && !(e[0] === x.d && e[2] === o));
        l.push([x.d, x.v, o]);
        celda[x.c] = l.slice(-MAX_POR_CELDA);
      }
      return { v: 1, a };
    });
  } catch (e) { if (e && e.conflicto) return { status: 503, body: { error: "Intenta más tarde." } }; throw e; }
  return { status: 200, body: { ok: true, guardados: lista.length } };
}

// Resumen de una celda: sin precios extremos (menos de un tercio o más del triple de la mediana), solo los recientes.
export function resumirCelda(entradas, desde) {
  const l = (entradas || []).filter((e) => e[0] >= desde);
  if (!l.length) return null;
  const m0 = mediana(l.map((e) => e[1])), buenos = l.filter((e) => e[1] >= m0 / 3 && e[1] <= m0 * 3);
  const personas = new Set(buenos.map((e) => e[0] + e[2])).size;
  if (personas < MIN_PERSONAS) return null;
  return { precio: Math.round(mediana(buenos.map((e) => e[1]))), personas, hasta: buenos.reduce((a, e) => (e[0] > a ? e[0] : a), "") };
}

// { ciudad: { "papa criolla|kg": [[cadena, precio, personas, último día], ...] (de la más barata a la más cara) } }
export async function resumen({ store, ahora = Date.now() }) {
  const desde = diaDe(ahora - DIAS * DIA), ciudades = {};
  for (const ciudad of CIUDADES) {
    const reg = await store.get(claveCiudad(ciudad), { type: "json" });
    if (!reg || !reg.a) continue;
    const out = {};
    for (const [k, celdas] of Object.entries(reg.a)) {
      const filas = [];
      for (const [cadena, entradas] of Object.entries(celdas)) {
        const r = NOMBRE_CADENA[cadena] && resumirCelda(entradas, desde);
        if (r) filas.push([NOMBRE_CADENA[cadena], r.precio, r.personas, r.hasta]);
      }
      if (filas.length) out[k] = filas.sort((a, b) => a[1] - b[1]);
    }
    if (Object.keys(out).length) ciudades[ciudad] = out;
  }
  return { generado: new Date(ahora).toISOString(), dias: DIAS, ciudades };
}
