import assert from "node:assert/strict";
import { webcrypto as wc } from "node:crypto";
import { zipSync, strToU8 } from "../correo-worker/node_modules/fflate/esm/index.mjs";
import { extraer } from "../correo-worker/src/index.js";
import { registrar, recibir, listar, borrar } from "../netlify/lib/bandeja.mjs";

// Almacén en memoria con la misma interfaz de Netlify Blobs
export function memStore() { const m = new Map(); return {
  setJSON: async (k, v) => m.set(k, JSON.stringify(v)), get: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : null),
  delete: async (k) => m.delete(k), list: async ({ prefix = "" } = {}) => ({ blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }), _m: m }; }
const stores = { buzones: memStore(), bandeja: memStore() };

// Celular: par de llaves como en el navegador
const kp = await wc.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, false, ["encrypt", "decrypt"]);
const pub = await wc.subtle.exportKey("jwk", kp.publicKey);
const token = "t".repeat(32);
const reg = await registrar({ stores, body: { token, pub } });
assert.equal(reg.status, 200); const { buzon, clave } = reg.body;
assert.match(buzon, /^[a-z0-9]{10}$/); assert.equal(clave.length, 24);
assert.equal((await registrar({ stores, body: { token: "x", pub } })).status, 400);

const b64d = (s) => Uint8Array.from(Buffer.from(s, "base64"));
async function descifrar(it) {
  const raw = await wc.subtle.decrypt({ name: "RSA-OAEP" }, kp.privateKey, b64d(it.k));
  const aes = await wc.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  return JSON.parse(new TextDecoder().decode(await wc.subtle.decrypt({ name: "AES-GCM", iv: b64d(it.iv) }, aes, b64d(it.c))));
}
const mime = (headers, body) => new TextEncoder().encode(headers.join("\r\n") + "\r\n\r\n" + body).buffer;

// 1) Alerta de Bancolombia en HTML
const alerta = mime(["From: Alertas y Notificaciones <alertasynotificaciones@an.notificacionesbancolombia.com>", "To: " + buzon + "@entrada.fintelligente.co", "Subject: Alertas y Notificaciones", "MIME-Version: 1.0", "Content-Type: text/html; charset=utf-8"],
  "<html><body><p>Servicio de Alertas y Notificaciones Bancolombia.</p><table><tr><td>Bancolombia le informa Compra por $45.900,00 en EXITO LAURELES 12:05. 21/10/2026 T.Deb *1234.</td></tr></table><img src='x.png'><p>&iquest;Sabes cu&aacute;nto gastas?</p></body></html>");
let partes = await extraer(alerta);
assert.equal(partes.length, 1); assert.equal(partes[0].tipo, "texto"); assert.match(partes[0].contenido, /Compra por \$45\.900,00 en EXITO LAURELES/);

// 2) Factura electrónica: .zip con AttachedDocument + PDF (el PDF se descarta)
const xml = `<?xml version="1.0"?><AttachedDocument xmlns:cbc="x" xmlns:cac="y"><cac:Attachment><cac:ExternalReference><cbc:Description><![CDATA[<Invoice xmlns:cbc="x" xmlns:cac="y"><cbc:ID>FE99</cbc:ID><cbc:IssueDate>2026-10-26</cbc:IssueDate><cac:AccountingSupplierParty><cac:Party><cac:PartyTaxScheme><cbc:RegistrationName>TIENDAS D1 S.A.S.</cbc:RegistrationName><cbc:CompanyID>900276962</cbc:CompanyID></cac:PartyTaxScheme></cac:Party></cac:AccountingSupplierParty><cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="COP">87650.00</cbc:PayableAmount></cac:LegalMonetaryTotal></Invoice>]]></cbc:Description></cac:ExternalReference></cac:Attachment></AttachedDocument>`;
const zip = zipSync({ "ad09002769620002600000099.xml": strToU8(xml), "factura.pdf": new Uint8Array([37, 80, 68, 70]) });
const b64zip = Buffer.from(zip).toString("base64").replace(/.{76}/g, "$&\r\n");
const factura = mime(["From: facturacion@d1.com.co", "To: " + buzon + "@entrada.fintelligente.co", "Subject: 900276962;TIENDAS D1 S.A.S.;FE99;01;D1;", "MIME-Version: 1.0", 'Content-Type: multipart/mixed; boundary="B"'],
  "--B\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nAdjuntamos su factura electrónica.\r\n--B\r\nContent-Type: application/zip; name=\"fe.zip\"\r\nContent-Disposition: attachment; filename=\"fe.zip\"\r\nContent-Transfer-Encoding: base64\r\n\r\n" + b64zip + "\r\n--B--\r\n");
partes = await extraer(factura);
assert.equal(partes.length, 1); assert.equal(partes[0].tipo, "xml"); assert.match(partes[0].contenido, /TIENDAS D1/); assert.match(partes[0].asunto, /;01;D1;/);

// 3) Confirmación de reenvío de Gmail
const verif = mime(["From: Gmail Team <forwarding-noreply@google.com>", "To: " + buzon + "@entrada.fintelligente.co", "Subject: (#123456789) Confirmación de reenvío de Gmail", "Content-Type: text/plain; charset=utf-8"],
  "ana@gmail.com ha solicitado reenviar automáticamente el correo a tu dirección. Código de confirmación: 123456789");
partes = await extraer(verif);
assert.equal(partes[0].tipo, "verificacion"); assert.match(partes[0].contenido, /123456789/);

// Entrega al servidor: con secreto del trabajador y con la clave del atajo
const SECRETO = "s".repeat(40);
assert.equal((await recibir({ stores, body: { buzon, partes: await extraer(alerta) }, secretoHeader: "malo", secretoEntrada: SECRETO })).status, 403);
assert.equal((await recibir({ stores, body: { buzon, partes: await extraer(alerta) }, secretoHeader: SECRETO, secretoEntrada: SECRETO })).status, 200);
assert.equal((await recibir({ stores, body: { buzon, partes: await extraer(factura) }, secretoHeader: SECRETO, secretoEntrada: SECRETO })).status, 200);
assert.equal((await recibir({ stores, body: { buzon, clave: "mala", texto: "x" } })).status, 403);
assert.equal((await recibir({ stores, body: { buzon, clave, texto: "Enviaste $35.000 a CAMILA RODRIGUEZ", app: "Nequi" } })).status, 200);
assert.equal((await recibir({ stores, body: { buzon: "zzzzzzzzzz", clave, texto: "x" } })).status, 404);

// En el servidor solo hay datos cifrados
for (const v of stores.bandeja._m.values()) assert.ok(!/EXITO LAURELES|TIENDAS D1|CAMILA RODRIGUEZ/.test(v), "nada en claro en el servidor");

// El celular lista, descifra y confirma la recepción
assert.equal((await listar({ stores, buzon, token: "y".repeat(32) })).status, 403);
const l = await listar({ stores, buzon, token });
assert.equal(l.body.items.length, 3);
const datos = await Promise.all(l.body.items.map(descifrar));
assert.deepEqual(datos.map((d) => d.origen).sort(), ["atajo", "correo", "correo"]);
assert.ok(datos.some((d) => d.partes[0].tipo === "xml"));
await borrar({ stores, body: { buzon, token, ids: l.body.items.map((i) => i.id) } });
assert.equal((await listar({ stores, buzon, token })).body.items.length, 0);
await borrar({ stores, body: { buzon, token, todo: true } });
assert.equal(await stores.buzones.get(buzon), null);
console.log("bandeja: todo bien (correo, factura, verificación de Gmail, atajo, cifrado de extremo a extremo)");
