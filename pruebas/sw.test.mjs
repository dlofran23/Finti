// Service worker: el aviso de la mañana calcula la cifra en el celular, y solo la muestra si la persona lo pidió.
import fs from "node:fs"; import vm from "node:vm";
let fallas = 0; const ok = (c, m) => { if (!c) { fallas++; console.log("FALLA:", m); } else console.log("ok -", m); };
const codigo = fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const oyentes = {}, mostradas = [];
const ctx = { self: { addEventListener: (t, f) => { oyentes[t] = f; }, registration: { showNotification: async (t, o) => { mostradas.push({ t, ...o }); } }, location: { origin: "https://x" }, clients: {} },
  caches: {}, fetch: () => {}, URL, Promise, Math, Date, JSON, Object, String, Number, console, indexedDB: null };
vm.createContext(ctx); vm.runInContext(codigo + "\nthis.cupoDeHoy = cupoDeHoy;", ctx);
const d = new Date(2026, 10, 21, 7);   // 21 de noviembre: quedan 10 días
ok(ctx.cupoDeHoy({ mes: "2026-11", P: 600000, R: 250000 }, d) === 35000, "reparte lo que queda del día a día en los días que faltan");
ok(ctx.cupoDeHoy({ mes: "2026-10", P: 600000, R: 250000 }, d) === null, "si los datos son de otro mes, no inventa cifra");
ok(ctx.cupoDeHoy({ mes: "2026-11", P: 600000, R: 700000 }, d) === 0, "si ya se usó todo, dice cero");
ok(!/fetch\([^)]*cupo/.test(codigo), "la cifra nunca se manda a ningún lado");
// Sin IndexedDB disponible, el aviso sale con el texto genérico del servidor
await new Promise((res) => { oyentes.push({ data: { json: () => ({ title: "Tu día empieza", body: "Toca aquí para ver cuánto puedes gastar hoy.", tag: "manana" }) }, waitUntil: (p) => p.then(res, res) }); });
ok(mostradas.length === 1 && !/\$/.test(mostradas[0].t + mostradas[0].body), "sin datos guardados, el aviso no muestra cifra");
// Preguntas pendientes: sin datos guardados, sale el texto genérico del servidor; nunca se pide nada a la red
await new Promise((res) => { oyentes.push({ data: { json: () => ({ title: "Me quedó una duda", body: "¿Me ayudas con un dato de lo que me contaste? Es un momento.", tag: "dudas", url: "/#accion=dudas" }) }, waitUntil: (p) => p.then(res, res) }); });
ok(mostradas.length === 2 && mostradas[1].t === "Me quedó una duda" && mostradas[1].data.url === "/#accion=dudas", "el aviso de preguntas abre la charla en las preguntas");
ok(/leerClave\("dudas"\)/.test(codigo) && !/fetch\([^)]*dudas/.test(codigo), "la pregunta se lee en el celular, no del servidor");
console.log(fallas ? fallas + " fallas" : "todo bien"); process.exit(fallas ? 1 : 0);
