// Precios del DANE (SIPSA): lector por partes, resumen semanal y /api/precios.
import assert from "node:assert/strict";
import { lectorPorPartes, resumir, fechaDe, ciudadDe, sobre, descargar } from "../herramientas/sipsa.mjs";
import { leerPrecios, guardarPrecios, resumenValido, probarDane, puenteDane, SIPSA_URL } from "../netlify/lib/precios.mjs";

const reg = (n, c, f, p) => `<return><artiId>1</artiId><artiNombre>${n}</artiNombre><fuenNombre>${c}</fuenNombre><fechaIni>${f}T00:00:00-05:00</fechaIni><minimoKg>${p - 100}</minimoKg><maximoKg>${p + 100}</maximoKg><promedioKg>${p}</promedioKg></return>`;
const xml = '<?xml version="1.0"?><S:Envelope xmlns:S="http://www.w3.org/2003/05/soap-envelope"><S:Body><ns2:promediosSipsaSemanaMadrResponse xmlns:ns2="http://servicios.sipsa.co.gov.dane/">' +
  reg("Papa capira", "Bogotá, D.C., Corabastos", "2026-11-02", 1500) + reg("Papa capira", "Medellín, Central Mayorista de Antioquia", "2026-11-02", 1700) +
  reg("Papa capira", "Bogotá, D.C., Corabastos", "2026-11-09", 1600) + reg("Papa capira", "Medellín, Central Mayorista de Antioquia", "2026-11-09", 1900) +
  reg("Papa capira", "Bogotá, D.C., Paloquemao", "2026-11-09", 1750) + reg("Tomate chonto", "Cali, Cavasa", "2026-11-09", 3077) + reg("Arroz de primera &amp; más", "Cali, Cavasa", "2026-11-09", 4200) +
  "</ns2:promediosSipsaSemanaMadrResponse></S:Body></S:Envelope>";

// 1. Lector por partes: el resultado no depende de cómo llegan los pedazos
const todos = []; const l1 = lectorPorPartes((x) => todos.push(x)); l1.agregar(xml);
assert.equal(todos.length, 7);
const pedazos = []; const l2 = lectorPorPartes((x) => pedazos.push(x)); for (let i = 0; i < xml.length; i += 37) l2.agregar(xml.slice(i, i + 37));
assert.deepEqual(pedazos, todos);
assert.equal(todos[6].artiNombre, "Arroz de primera & más");
assert.equal(todos[0].promedioKg, "1500");

// 2. Fechas y ciudades
assert.equal(fechaDe("2026-11-09T00:00:00-05:00"), "2026-11-09");
assert.equal(fechaDe("9/11/2026"), "2026-11-09");
assert.equal(ciudadDe("Bogotá, D.C., Corabastos"), "Bogotá");
assert.match(sobre(), /<ns0:promediosSipsaSemanaMadr\/>/);

// 3. Resumen: última semana, cambio contra la anterior, central más barata y precio por ciudad
const r = resumir(todos, new Date("2026-11-12T12:00:00Z"));
assert.equal(r.semana, "2026-11-09"); assert.equal(r.anterior, "2026-11-02");
const papa = r.productos.find((p) => p.n === "Papa capira");
assert.equal(papa.g, 1750);                       // mediana de 1600, 1750 y 1900
assert.equal(papa.v, 9.4);                        // 1750 contra 1600 (mediana de 1500 y 1700)
assert.deepEqual(papa.b, ["Bogotá, D.C., Corabastos", 1600]);
assert.deepEqual(papa.c["Bogotá"], [1675, "Bogotá, D.C., Corabastos", 1600]);
assert.equal(r.productos.find((p) => p.n === "Tomate chonto").v, null);   // sin semana anterior
assert.ok(resumenValido(r));
assert.ok(!resumenValido({ semana: "x", productos: [] }));

// 4. Descarga simulada (por partes, solo las últimas 3 semanas)
const viejo = reg("Papa capira", "Cali, Cavasa", "2026-01-05", 900);
const cuerpo = xml.replace("</ns2:", viejo + "</ns2:");
const fetchFalso = async (url, o) => {
  assert.match(url, /^https:\/\/appweb\.dane\.gov\.co\/sipsaWS\//); assert.match(o.headers["Content-Type"], /soap\+xml/);
  const enc = new TextEncoder().encode(cuerpo);
  return { ok: true, status: 200, body: (async function* () { for (let i = 0; i < enc.length; i += 50) yield enc.slice(i, i + 50); })() };
};
const d = await descargar({ fetchImpl: fetchFalso, ahora: new Date("2026-11-12T12:00:00Z") });
assert.equal(d.total, 8); assert.equal(d.registros.length, 7);

// 5. /api/precios
const m = new Map(); const store = { setJSON: async (k, v) => m.set(k, JSON.stringify(v)), get: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : null) };
assert.equal((await leerPrecios(store)).status, 404);
const env = { PRECIOS_CLAVE: "c".repeat(24) };
assert.equal((await guardarPrecios({ store, env: {}, autorizacion: "", texto: "{}" })).status, 503);
assert.equal((await guardarPrecios({ store, env, autorizacion: "Bearer malo", texto: JSON.stringify(r) })).status, 401);
assert.equal((await guardarPrecios({ store, env, autorizacion: "Bearer " + env.PRECIOS_CLAVE, texto: '{"semana":"2026-11-09","productos":[{"n":"x"}]}' })).status, 400);
const ok = await guardarPrecios({ store, env, autorizacion: "Bearer " + env.PRECIOS_CLAVE, texto: JSON.stringify(r) });
assert.equal(ok.status, 200); assert.equal(ok.body.productos, 3);
const viejaSemana = { ...r, semana: "2026-11-02" };
assert.equal((await guardarPrecios({ store, env, autorizacion: "Bearer " + env.PRECIOS_CLAVE, texto: JSON.stringify(viejaSemana) })).status, 409);
const leido = await leerPrecios(store); assert.equal(leido.status, 200); assert.equal(leido.body.semana, "2026-11-09");

// 6. Descarga a través del puente de Cloudflare (lleva la clave y va a la dirección del puente)
const viaFalsa = async (url, o) => {
  assert.equal(url, "https://finti.ejemplo/api/precios-dane"); assert.equal(o.headers.Authorization, "Bearer " + env.PRECIOS_CLAVE);
  return fetchFalso(SIPSA_URL, o);
};
const dv = await descargar({ fetchImpl: viaFalsa, ahora: new Date("2026-11-12T12:00:00Z"), via: "https://finti.ejemplo/api/precios-dane", clave: env.PRECIOS_CLAVE });
assert.equal(dv.registros.length, 7);
await assert.rejects(descargar({ fetchImpl: async () => ({ ok: false, status: 401 }), via: "https://finti.ejemplo/x", clave: "m" }), /Finti respondió 401/);

// 7. /api/precios-dane: prueba de conexión (guardada 10 minutos) y puente con clave
let llamadas = 0;
const alcanza = async (url) => { llamadas++; assert.equal(url, SIPSA_URL + "?wsdl"); return { status: 200, body: { cancel: async () => {} } }; };
const m2 = new Map(); const st2 = { setJSON: async (k, v) => m2.set(k, JSON.stringify(v)), get: async (k) => (m2.has(k) ? JSON.parse(m2.get(k)) : null) };
const p1 = await probarDane({ store: st2, fetchImpl: alcanza, ahora: 1e12 });
assert.equal(p1.alcanza, true); assert.equal(p1.estado, 200);
await probarDane({ store: st2, fetchImpl: alcanza, ahora: 1e12 + 60000 }); assert.equal(llamadas, 1);   // guardada
const corta = async () => { const e = new TypeError("fetch failed"); e.cause = { code: "ECONNRESET" }; throw e; };
const p2 = await probarDane({ store: st2, fetchImpl: corta, ahora: 1e12 + 11 * 60000 });
assert.equal(p2.alcanza, false); assert.equal(p2.error, "ECONNRESET");
assert.equal((await puenteDane({ env: {}, autorizacion: "", fetchImpl: alcanza })).status, 503);
assert.equal((await puenteDane({ env, autorizacion: "Bearer malo", fetchImpl: alcanza })).status, 401);
assert.equal((await puenteDane({ env, autorizacion: "Bearer " + env.PRECIOS_CLAVE, fetchImpl: corta })).status, 502);
let pedido;
const dane = async (url, o) => { pedido = { url, o }; return new Response("<xml/>", { status: 200, headers: { "content-type": "application/soap+xml" } }); };
const pu = await puenteDane({ env, autorizacion: "Bearer " + env.PRECIOS_CLAVE, fetchImpl: dane });
assert.equal(pedido.url, SIPSA_URL); assert.equal(pedido.o.method, "POST"); assert.match(pedido.o.body, /promediosSipsaSemanaMadr/);
assert.ok(!pedido.o.headers.Authorization);                     // la clave no sale hacia el DANE
assert.equal(pu.respuesta.status, 200); assert.equal(await pu.respuesta.text(), "<xml/>");

console.log("precios: todo bien");
