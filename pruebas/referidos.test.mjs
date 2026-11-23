// Invita y gana: cada persona tiene un código de invitación; si alguien compra Premium con él, quien invitó
// recibe un código de regalo de Premium. Un pago premia una sola vez.
import * as RF from "../netlify/lib/referidos.mjs";
import * as RG from "../netlify/lib/regalos.mjs";
import * as P from "../netlify/lib/pagos.mjs";
import { memStore } from "./memoria.mjs";
let fallas = 0; const ok = (c, m) => { if (!c) { fallas++; console.log("FALLA:", m); } else console.log("ok -", m); };
const cfg = P.leerConfig({ WOMPI_PUBLIC_KEY: "pub_test_A", WOMPI_INTEGRITY_SECRET: "i", WOMPI_EVENTS_SECRET: "e", PRECIO_COP: "15000", LICENSE_SECRET: "s3cr3t" });
const inv = memStore(), regalos = memStore(), pagos = memStore(), limites = memStore(), salud = memStore();

ok(RF.normalizarInvita(" amigo abc234 ") === "AMIGO-ABC234" && RF.normalizarInvita("abc234") === "AMIGO-ABC234", "acepta el código en minúsculas o sin AMIGO");
ok(RF.normalizarInvita("AMIGO-ABC230") === "" && RF.normalizarInvita("<script>") === "", "rechaza formatos que no son");
ok((await RF.crearInvitacion({ store: inv, limites, cfg: P.leerConfig({}), ip: "1" })).status === 503, "sin LICENSE_SECRET no se crean");

let r = await RF.crearInvitacion({ store: inv, limites, cfg, ip: "1.1.1.1" });
const { codigo, llave } = r.body;
ok(r.status === 200 && /^AMIGO-[A-HJ-NP-Z2-9]{6}$/.test(codigo) && llave.length > 20, "crea el código y su llave");
for (let i = 0; i < 5; i++) await RF.crearInvitacion({ store: inv, limites, cfg, ip: "9.9.9.9" });
ok((await RF.crearInvitacion({ store: inv, limites, cfg, ip: "9.9.9.9" })).status === 429, "máximo 5 códigos por hora desde la misma conexión");

ok((await RF.verPremios({ store: inv, regalos, cfg, codigo, llave: "otra" })).status === 403, "sin la llave nadie ve tus premios");
r = await RF.verPremios({ store: inv, regalos, cfg, codigo, llave });
ok(r.status === 200 && r.body.ventas === 0 && r.body.premios.length === 0, "al comienzo, sin premios");

ok((await RF.invitaExiste({ store: inv, codigo: codigo.toLowerCase() })) === codigo && (await RF.invitaExiste({ store: inv, codigo: "AMIGO-ZZZZZZ" })) === "", "solo se aceptan códigos que existen");

// Pago con el código
const pago = await P.crearPago({ store: pagos, cfg, email: "bea@correo.com", sitio: "https://x", acepto: { v: "1.0", mayor: true }, invita: codigo });
ok(pago.status === 200 && (await pagos.get(pago.body.ref, { type: "json" })).invita === codigo, "el pago guarda el código de quien invitó");
const alAprobar = RF.trasAprobar({ salud, invitaciones: inv, regalos });
const evento = (estado) => {
  const data = { transaction: { id: "T1", reference: pago.body.ref, amount_in_cents: 1500000, currency: "COP", status: estado } };
  const ts = 1700000000, props = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
  const cadena = "T1" + estado + "1500000" + ts + "e";
  return { event: "transaction.updated", data, timestamp: ts, signature: { properties: props, checksum: P.sha256(cadena) } };
};
await P.procesarEvento({ store: pagos, cfg, evento: evento("APPROVED"), alAprobar });
r = await RF.verPremios({ store: inv, regalos, cfg, codigo, llave });
ok(r.body.ventas === 1 && r.body.premios.length === 1 && /^FIN-/.test(r.body.premios[0].codigo) && r.body.premios[0].estado === "libre", "al aprobarse el pago, quien invitó recibe un código de Premium");
await P.procesarEvento({ store: pagos, cfg, evento: evento("APPROVED"), alAprobar });
ok((await RF.premiarInvitacion({ store: inv, regalos, codigo, ref: pago.body.ref })) === false, "el mismo pago no premia dos veces");
r = await RF.verPremios({ store: inv, regalos, cfg, codigo, llave });
ok(r.body.premios.length === 1, "sigue con un solo premio");

// El premio se canjea como cualquier regalo
const premio = r.body.premios[0].codigo;
const c = await RG.canjearRegalo({ store: regalos, pagos, limites, cfg, codigo: premio, email: "ana@correo.com", ip: "5.5.5.5" });
ok(c.status === 200 && c.body.token === P.tokenLicencia(c.body.ref, "s3cr3t"), "el premio activa Premium al canjearlo");
r = await RF.verPremios({ store: inv, regalos, cfg, codigo, llave });
ok(r.body.premios[0].estado === "usado", "y en tus premios aparece como usado");
const metricas = JSON.stringify([...salud._m.values()]);
ok(/referido/.test(metricas) && /premium_aprobado/.test(metricas), "se cuentan la venta y el referido");

// Un pago sin código no premia a nadie
const otro = await P.crearPago({ store: pagos, cfg, email: "c@correo.com", sitio: "https://x", acepto: { v: "1.0", mayor: true } });
ok(!("invita" in (await pagos.get(otro.body.ref, { type: "json" }))), "sin código, el pago no lleva invitación");

// Tope de premios
const x = await inv.get("i/" + codigo, { type: "json" });
x.premios = Array.from({ length: RF.MAX_PREMIOS }, (_, i) => ({ codigo: "FIN-AAAAA-AAAA" + "BCDEFGHJKLMNPQRSTUVWXYZ"[i], creado: "", ref: "r" + i }));
await inv.setJSON("i/" + codigo, x);
const antes = regalos._m.size;
ok((await RF.premiarInvitacion({ store: inv, regalos, codigo, ref: "PRE-OTRAREF2345" })) === false && regalos._m.size === antes, "llegado el tope, cuenta la venta pero no crea más códigos");

if (fallas) { console.log(fallas + " falla(s)"); process.exit(1); }
console.log("invita y gana: todo bien");
