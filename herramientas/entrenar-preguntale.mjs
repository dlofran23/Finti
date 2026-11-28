// Entrena el clasificador de Pregúntale: un modelo pequeño (bayesiano ingenuo) que corre dentro del teléfono, sin
// servidor ni IA externa. Se usa cuando ninguna regla de Pregúntale entiende la pregunta.
//
// Las frases de entrenamiento se generan con plantillas: cada intención con muchas formas de decirla, con relleno
// ("oye", "parce", "porfa"), periodos, categorías, montos y errores de dedo al azar. Hay una clase "fuera" con preguntas
// que no son de plata, para que el modelo aprenda a no inventar. Ninguna frase sale de las baterías de evaluación
// (pruebas/navegador/ia-bateria.js): así la medición sigue siendo honesta.
//
// Uso: node herramientas/entrenar-preguntale.mjs   → escribe fuente/datos/preguntale-modelo.json
// Después: python3 herramientas/construir.py
import fs from "node:fs";
import path from "node:path";

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const SALIDA = path.join(AQUI, "..", "fuente", "datos", "preguntale-modelo.json");

// Generador al azar con semilla fija: el modelo sale igual cada vez que se entrena
let semilla = 20261128;
const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
const uno = (l) => l[Math.floor(azar() * l.length)];

// ---------- Piezas ----------
const PER = ["", "", "", "este mes", "en el mes", "la semana pasada", "esta semana", "el mes pasado", "en octubre", "en noviembre", "este año", "hoy", "ayer", "en lo que va del mes", "en los ultimos 30 dias"];
const CAT = ["comida", "mercado", "transporte", "taxis", "uber", "gasolina", "arriendo", "servicios", "luz", "internet", "salud", "droga", "colegio", "rumba", "salidas", "restaurantes", "domicilios", "ropa", "netflix", "el gimnasio", "el carro", "la moto", "mascotas", "el perro", "cafe", "almuerzos", "regalos"];
const COSA = ["unos tenis", "un celular", "un viaje", "una nevera", "un computador", "unos audifonos", "una bicicleta", "un regalo", "una salida", "un curso", "una moto", "ropa nueva"];
const MONTO = ["50 mil", "80 mil", "120 mil", "200 lucas", "300 mil", "500 mil", "1 millon", "2 millones", "un palo", "medio millon", "1.200.000", "450.000"];
const CUENTA = ["nequi", "daviplata", "bancolombia", "el banco", "efectivo", "la cuenta de ahorros", "davivienda", "nu", "la tarjeta debito"];
const PERSONA = ["juan", "mi hermano", "mi primo", "la vecina", "mi amigo", "carlos", "mi mama", "un compañero"];
const RELLENO_ANTES = ["", "", "", "", "oye ", "finti ", "parce ", "porfa ", "dime ", "quiero saber ", "necesito saber ", "me dices ", "sera que ", "me podrias decir ", "una pregunta ", "ey ", "mira "];
const RELLENO_DESPUES = ["", "", "", "", " porfa", " por favor", " gracias", " ya", " parce", " pues"];

// ---------- Plantillas por intención ----------
const P = {
  saldos: ["cuanta plata tengo", "cuanto dinero tengo", "cuanto hay en mis cuentas", "cual es mi saldo", "mis saldos", "dime el saldo de {cuenta}", "cuanto tengo en {cuenta}",
    "cuanta plata hay en {cuenta}", "cuanto me queda en {cuenta}", "cuanto efectivo tengo", "como estan mis cuentas de plata",
    "cuanta plata tengo en total", "cuanto dinero hay disponible en mis cuentas", "que saldo hay en {cuenta}", "muestrame cuanto tengo", "plata que tengo ahora", "cuanto billete tengo en {cuenta}",
    "cuanta plata cargo encima", "consulta mi saldo"],
  disponible: ["cuanto me queda {per}", "cuanto puedo gastar {per}", "cuanto me queda libre", "cuanto me sobra del presupuesto", "que me queda del mes", "me queda plata para el resto del mes",
    "cuanto tengo disponible", "cuanto me resta del presupuesto", "todavia me queda plata", "que tanto puedo gastar todavia",
    "de cuanto dispongo este mes", "cuanto margen me queda", "cuanto me queda para gastar en lo que queda del mes", "me queda algo"],
  hoy: ["cuanto puedo gastar hoy", "que me puedo gastar hoy", "cuanto tengo para hoy", "de cuanto dispongo hoy", "hoy cuanto me puedo gastar",
    "cuanta plata puedo usar hoy", "cuanto me toca hoy", "presupuesto de hoy", "cuanto es lo maximo para hoy"],
  quincena: ["cuanto me queda hasta la quincena", "me alcanza hasta la quincena", "cuanto tengo hasta que me paguen", "como llego a fin de quincena", "llego al 30", "cuanto tengo para llegar a la quincena", "aguanto hasta que me paguen", "cuanto me queda hasta el dia de pago"],
  gasto: ["cuanto gaste en {cat} {per}", "cuanto he gastado en {cat}", "cuanto llevo en {cat}", "cuanto se me ha ido en {cat} {per}", "cuanto me costo {cat} {per}", "gastos de {cat} {per}", "cuanto pague de {cat}", "cuanto se fue en {cat}", "cuanto me gaste en {cat}", "mis gastos en {cat}",
    "cuanto llevo gastado {per}", "cuanto gaste {per}", "cuanta plata se me fue en {cat}", "cuanto me ha salido {cat}", "cuanto invierto en {cat}", "cuanto se me va en {cat} al mes",
    "suma de lo gastado en {cat}", "que tanto gaste en {cat}", "cuanto pagamos de {cat}", "cuanto llevamos en {cat} {per}"],
  top: ["en que gasto mas", "en que se me va la plata", "donde se me va el dinero", "cuales son mis mayores gastos", "en que se me fue el sueldo", "que es lo que mas plata me quita", "en que estoy botando la plata", "cual es la categoria mas cara", "que se lleva mi sueldo",
    "en que se me esta yendo el dinero {per}", "cuales son mis gastos mas grandes {per}", "donde estoy gastando mas"],
  mayor: ["cual fue mi gasto mas grande", "la compra mas cara {per}", "lo mas caro que he comprado", "el pago mas grande que hice {per}", "mi mayor gasto {per}",
    "que fue lo mas costoso que pague"],
  promedio: ["cuanto gasto al dia", "cuanto gasto en promedio", "cuanto gasto por dia", "promedio de gastos diarios", "cuanto se me va cada dia", "cuanto gasto diariamente"],
  hormiga: ["cuanto se me va en gastos hormiga", "los gastos pequeños", "cuanto se me va en antojos", "cuanto gasto en tintos y mecato", "en que gasto de a poquito", "gastos pequeños del mes"],
  habitos: ["que dia gasto mas", "a que hora gasto mas", "mis habitos de gasto", "tengo patrones de gasto", "en que dias de la semana se me va la plata", "cuando gasto mas plata",
    "que costumbres de gasto tengo"],
  comparar: ["gaste mas que el mes pasado", "comparame con el mes anterior", "voy mejor o peor que el mes pasado", "gasto mas o menos que antes", "como voy frente al mes pasado", "estoy gastando mucho", "mi gasto subio", "compara mis gastos con el mes pasado"],
  cierre: ["como cierro el mes", "como voy a terminar el mes", "voy a quedar en rojo", "como quedo a fin de mes","termino el mes en positivo", "proyeccion del mes", "como me va a ir este mes"],
  salud: ["como esta mi salud financiera", "como estan mis finanzas", "que tan sanas estan mis finanzas", "como estoy de plata en general", "mi situacion financiera",
    "que puntaje tengo", "estoy bien financieramente"],
  estado: ["como voy", "voy bien", "como va el mes", "como vamos", "voy mal este mes", "como voy este mes"],
  ingresos: ["cuanto gano", "cuanto me ha entrado {per}", "cuanto recibi {per}", "cuanto me pagaron", "cual es mi sueldo", "mis ingresos {per}", "cuanto me pagan al mes"],
  ahorro: ["cuanto he ahorrado", "cuanto estoy ahorrando", "cuanto ahorro al mes", "cuanto llevo ahorrado", "cuanto he guardado", "mi ahorro {per}", "cuanto tengo ahorrado"],
  metas: ["como van mis metas", "cuanto me falta para mi meta", "cuando llego a mi meta", "como va la meta del viaje", "cuanto me falta para completar la meta",
    "cuando completo lo de la moto", "avance de mis metas"],
  alcanza: ["me alcanza para {cosa} de {monto}", "puedo comprar {cosa} de {monto}", "puedo darme un gusto de {monto}", "me da para {cosa}", "si compro {cosa} de {monto} como quedo",
    "puedo gastarme {monto} en {cosa}", "tengo plata para {cosa}", "me puedo permitir {cosa} de {monto}"],
  pagos: ["que tengo que pagar {per}", "que pagos tengo pendientes", "cuando vence la tarjeta", "que me toca pagar esta semana", "que cuentas tengo por pagar","proximos pagos", "cuando pago el arriendo", "que recibos se vencen", "tengo algo pendiente por pagar"],
  deudas: ["cuanto debo", "cuanto debo en total", "mis deudas", "que deuda pago primero", "cuanto le debo al banco", "como salgo de deudas",
    "cuanto me falta para pagar el credito", "a quien le debo plata", "cuanta deuda tengo"],
  medeben: ["cuanto me deben", "quien me debe plata", "cuanto me debe {persona}", "cuanto me falta por cobrar", "quienes me deben", "lo que me deben"],
  consejo: ["que me recomiendas", "dame un consejo", "como puedo ahorrar mas", "como gasto menos", "en que puedo recortar", "tips para ahorrar", "como hago para que me rinda la plata","ayudame a gastar menos", "como bajo mis gastos", "que hago para ahorrar", "como organizo mi plata"],
  productos: ["que productos compro", "lo que mas compro en el mercado", "mis compras mas repetidas", "que compro siempre", "que productos he comprado mas", "cuales son los productos que mas llevo", "que es lo que mas compro", "que compro mas seguido", "mis productos", "subio el mercado", "como estan los precios del mercado", "la canasta"],
  saludo: ["hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "quiubo", "que mas", "hola finti", "hey"],
  gracias: ["gracias", "muchas gracias", "mil gracias", "listo gracias", "gracias finti", "super gracias", "vale gracias"],
  ayuda: ["que puedo preguntarte", "que sabes hacer", "como funcionas", "que preguntas te puedo hacer", "como te uso", "ayuda", "que haces"],
  fuera: ["cual es la capital de {pais}", "cuentame un chiste", "quien gano el partido", "que hora es", "como esta el clima", "recomiendame una pelicula", "como se hace {plato}",
    "que dia es hoy", "ponme musica", "cuantos años tienes", "como te llamas",
    "cual es tu color favorito", "dime una receta", "quien es el presidente", "cuanto es 2 mas 2", "donde queda {lugar}", "que significa {palabra}", "cuentame una historia",
    "como se llama mi perro", "que pelicula veo", "juguemos algo", "hazme reir", "que libro me recomiendas", "como esta el trafico", "a que hora juega {equipo}"],
};
const SLOT = {
  per: PER, cat: CAT, cosa: COSA, monto: MONTO, cuenta: CUENTA, persona: PERSONA,
  pais: ["francia", "japon", "brasil", "alemania"], plato: ["una arepa", "un sancocho", "una torta", "el arroz con pollo"], famoso: ["shakira", "maluma", "el papa"],
  palabra: ["casa", "amor", "perro", "libertad"], lugar: ["el everest", "cartagena", "la luna", "el mar"], equipo: ["nacional", "millonarios", "el america", "colombia"],
};

// Errores de dedo al azar: letra cruzada, letra repetida o letra que falta (en palabras de 5 o más letras)
function conErrores(t) {
  return t.split(" ").map((w) => {
    if (w.length < 5 || azar() > 0.12) return w;
    const i = 1 + Math.floor(azar() * (w.length - 2)), k = azar();
    if (k < 0.34) return w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2);
    if (k < 0.67) return w.slice(0, i) + w[i] + w.slice(i);
    return w.slice(0, i) + w.slice(i + 1);
  }).join(" ");
}
function llenar(p) { return p.replace(/\{(\w+)\}/g, (_, k) => uno(SLOT[k])).replace(/\s+/g, " ").trim(); }

// ---------- Rasgos: los mismos que calcula la app (prRasgos en fuente/logica/43-…) ----------
export function normalizar(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[¿?¡!.,;:()"]/g, " ").replace(/\s+/g, " ").trim();
}
const VACIAS = new Set("a al el la los las lo un una unos unas de del y o en con por para mi mis tu tus su sus me te se le que es ya pues porfa favor oye finti parce dime ey mira".split(" "));
export function rasgos(t) {
  const w = normalizar(t).split(" ").filter((x) => x && !VACIAS.has(x)), out = new Set();
  w.forEach((x, i) => {
    out.add("w:" + x);
    if (x.length >= 5) out.add("s:" + x.slice(0, 4));
    if (i > 0) out.add("b:" + w[i - 1] + "_" + x);
  });
  return [...out];
}

// ---------- Entrenar ----------
export function generar({ porPlantilla = 14 } = {}) {
  semilla = 20261128;   // siempre desde la misma semilla: el modelo sale igual cada vez
  const datos = [];
  for (const [clase, ps] of Object.entries(P)) for (const p of ps) {
    const n = /\{/.test(p) ? porPlantilla : Math.max(4, Math.round(porPlantilla / 2));
    for (let i = 0; i < n; i++) {
      let t = llenar(p);
      if (clase !== "saludo" && clase !== "gracias") t = uno(RELLENO_ANTES) + t + uno(RELLENO_DESPUES);
      if (azar() < 0.5) t = conErrores(t);
      datos.push([t.trim(), clase]);
    }
  }
  return datos;
}
export function entrenar(datos, { minimo = 2 } = {}) {
  const clases = {}, cuenta = {};
  for (const [t, c] of datos) {
    clases[c] = (clases[c] || 0) + 1;
    for (const r of rasgos(t)) { (cuenta[r] = cuenta[r] || {}); cuenta[r][c] = (cuenta[r][c] || 0) + 1; }
  }
  const rasgosOk = {};
  for (const [r, cs] of Object.entries(cuenta)) { const tot = Object.values(cs).reduce((a, b) => a + b, 0); if (tot >= minimo) rasgosOk[r] = cs; }
  const totales = {};
  for (const cs of Object.values(rasgosOk)) for (const [c, n] of Object.entries(cs)) totales[c] = (totales[c] || 0) + n;
  return { v: 1, clases, totales, rasgos: rasgosOk, n: Object.keys(rasgosOk).length };
}
// Clasificar con el modelo (lo mismo que hace la app en prClasificar)
export function clasificar(m, t) {
  const rs = rasgos(t).filter((r) => m.rasgos[r]); if (!rs.length) return null;
  const N = Object.values(m.clases).reduce((a, b) => a + b, 0), V = m.n, punt = [];
  for (const c of Object.keys(m.clases)) {
    let s = Math.log(m.clases[c] / N);
    for (const r of rs) s += Math.log(((m.rasgos[r][c] || 0) + 0.5) / (m.totales[c] + 0.5 * V));
    punt.push([c, s]);
  }
  punt.sort((a, b) => b[1] - a[1]);
  const max = punt[0][1], z = punt.reduce((a, x) => a + Math.exp(x[1] - max), 0);
  return { clase: punt[0][0], p: 1 / z, segunda: punt[1][0], conocidos: rs.length };
}

if (import.meta.url === "file://" + process.argv[1]) {
  const datos = generar();
  const m = entrenar(datos);
  fs.writeFileSync(SALIDA, JSON.stringify(m));
  console.log("Frases de entrenamiento: " + datos.length + "; clases: " + Object.keys(m.clases).length + "; rasgos: " + m.n + "; tamaño: " + Math.round(fs.statSync(SALIDA).size / 1024) + " KB.");
}
