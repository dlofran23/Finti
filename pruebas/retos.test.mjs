// Retos con amigos: solo apodos y días cumplidos; cada quien con su llave.
import * as R from "../netlify/lib/retos.mjs";
import { memStore } from "./memoria.mjs";
let fallas = 0; const ok = (c, m) => { if (!c) { fallas++; console.log("FALLA:", m); } else console.log("ok -", m); };
const store = memStore(), limites = memStore();
const T0 = Date.UTC(2026, 11, 1, 15), DIA = 864e5, f = (t) => new Date(t).toISOString().slice(0, 10);

ok(R.normalizarReto("reto abc234") === "RETO-ABC234" && R.normalizarReto("RETO-ABC230") === "", "normaliza el código y rechaza formatos raros");
ok(R.limpiarApodo("  <b>Caro</b> ") === "bCarob" && R.limpiarApodo("x") === "", "limpia el apodo y exige 2 letras");
ok((await R.crearReto({ store, limites, ip: "1", tipo: "inventado", apodo: "Caro", hoy: f(T0), ahora: T0 })).status === 400, "solo retos de la lista");
ok((await R.crearReto({ store, limites, ip: "1", tipo: "domicilios", apodo: "Caro", hoy: "2020-01-01", ahora: T0 })).status === 400, "no acepta una fecha muy distinta a la del servidor");

let r = await R.crearReto({ store, limites, ip: "1", tipo: "domicilios", apodo: "Caro", hoy: f(T0), ahora: T0 });
const A = r.body;
ok(r.status === 200 && /^RETO-[A-HJ-NP-Z2-9]{6}$/.test(A.codigo) && A.dias === 7 && A.estado === "activo" && A.participantes.length === 1 && A.participantes[0].yo, "crea el reto con su código");
const guardado = JSON.stringify(await store.get("r/" + A.codigo));
ok(!guardado.includes(A.token) && !/monto|email|\$/.test(guardado), "el servidor no guarda la llave en claro ni montos");

r = await R.unirseReto({ store, limites, ip: "2", codigo: A.codigo.toLowerCase(), apodo: "Juan", hoy: f(T0), ahora: T0 });
const B = r.body;
ok(r.status === 200 && B.participantes.length === 2 && B.participantes[1].yo && !B.participantes[0].yo, "un amigo se une con el código");
ok((await R.unirseReto({ store, limites, ip: "2", codigo: "RETO-ZZZZZZ", apodo: "Ana", hoy: f(T0), ahora: T0 })).status === 404, "código que no existe");
r = await R.unirseReto({ store, limites, ip: "3", codigo: A.codigo, apodo: "caro", hoy: f(T0), ahora: T0 });
ok(r.status === 200 && r.body.participantes[2].apodo === "caro 3", "apodos repetidos se distinguen");

ok((await R.marcarReto({ store, codigo: A.codigo, pid: A.pid, token: "otra", hoy: f(T0), ahora: T0 })).status === 403, "sin la llave nadie marca por otro");
r = await R.marcarReto({ store, codigo: A.codigo, pid: A.pid, token: A.token, hoy: f(T0), ahora: T0 });
await R.marcarReto({ store, codigo: A.codigo, pid: A.pid, token: A.token, hoy: f(T0), ahora: T0 });
ok(r.status === 200 && r.body.participantes[0].cumplidos === 1 && r.body.participantes[0].hoy, "marcar hoy cuenta una sola vez");
r = await R.verReto({ store, codigo: A.codigo, pid: B.pid, token: B.token, hoy: f(T0), ahora: T0 });
ok(r.status === 200 && r.body.participantes[0].cumplidos === 1 && r.body.participantes[1].cumplidos === 0 && !("marcas" in r.body.participantes[0]), "cada quien ve el avance de todos, sin fechas sueltas");
ok((await R.verReto({ store, codigo: A.codigo, pid: B.pid, token: "x", hoy: f(T0), ahora: T0 })).status === 403, "solo los participantes ven el reto");

const T8 = T0 + 8 * DIA;
ok((await R.marcarReto({ store, codigo: A.codigo, pid: A.pid, token: A.token, hoy: f(T8), ahora: T8 })).status === 409, "después del último día ya no se marca");
ok((await R.verReto({ store, codigo: A.codigo, pid: A.pid, token: A.token, hoy: f(T8), ahora: T8 })).body.estado === "fin", "el reto termina");
ok((await R.unirseReto({ store, limites, ip: "4", codigo: A.codigo, apodo: "Tarde", hoy: f(T8), ahora: T8 })).status === 409, "no se une nadie a un reto terminado");

ok((await R.salirReto({ store, codigo: A.codigo, pid: B.pid, token: B.token })).status === 200, "se puede salir");
ok((await R.verReto({ store, codigo: A.codigo, pid: A.pid, token: A.token, hoy: f(T0), ahora: T0 })).body.participantes.length === 2, "al salir desaparece de la lista");

// Lleno
r = await R.crearReto({ store, limites, ip: "5", tipo: "cafe", apodo: "Lia", hoy: f(T0), ahora: T0 });
for (let i = 0; i < 11; i++) await R.unirseReto({ store, limites: null, ip: "6", codigo: r.body.codigo, apodo: "Amigo" + i, hoy: f(T0), ahora: T0 });
ok((await R.unirseReto({ store, limites: null, ip: "6", codigo: r.body.codigo, apodo: "Uno más", hoy: f(T0), ahora: T0 })).status === 409, "máximo 12 personas");

for (let i = 0; i < 10; i++) await R.crearReto({ store, limites, ip: "7", tipo: "anotar", apodo: "Spam", hoy: f(T0), ahora: T0 });
ok((await R.crearReto({ store, limites, ip: "7", tipo: "anotar", apodo: "Spam", hoy: f(T0), ahora: T0 })).status === 429, "máximo 10 retos por hora desde la misma conexión");

const antes = (await store.list({ prefix: "r/" })).blobs.length;
const borrados = await R.limpiarRetos({ store, ahora: T0 + 46 * DIA });
ok(borrados === antes && (await store.list({ prefix: "r/" })).blobs.length === 0, "a los 30 días de terminar se borran solos");

console.log(fallas ? fallas + " fallas" : "todo bien"); process.exit(fallas ? 1 : 0);
