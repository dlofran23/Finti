// Reemplazo de "web-push" con WebCrypto (funciona en Cloudflare Workers y en Node 20+).
// Avisos del navegador con VAPID (RFC 8292) y cifrado aes128gcm (RFC 8291). Misma interfaz que usa netlify/lib/canales.mjs:
//   setVapidDetails(subject, publicKey, privateKey) y sendNotification(sub, payload, { TTL, urgency }) → { statusCode }.
const enc = new TextEncoder();
const b64u = (u8) => { let s = ""; for (const x of u8) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const deB64u = (t) => { t = String(t).replace(/-/g, "+").replace(/_/g, "/"); const s = atob(t + "===".slice((t.length + 3) % 4)), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
const unir = (...l) => { const u = new Uint8Array(l.reduce((a, x) => a + x.length, 0)); let o = 0; for (const x of l) { u.set(x, o); o += x.length; } return u; };

let VAPID = null;
export function setVapidDetails(subject, publicKey, privateKey) {
  const pub = deB64u(publicKey), d = deB64u(privateKey);
  if (pub.length !== 65 || d.length !== 32) throw new Error("web-push: llaves VAPID inválidas");
  VAPID = { subject, publicKey, jwk: { kty: "EC", crv: "P-256", x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: b64u(d), ext: true } };
}

async function firmaVapid(audiencia) {
  const llave = await crypto.subtle.importKey("jwk", VAPID.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const cab = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const cue = b64u(enc.encode(JSON.stringify({ aud: audiencia, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID.subject })));
  const firma = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, llave, enc.encode(cab + "." + cue)));
  return cab + "." + cue + "." + b64u(firma);
}

async function hkdf(sal, ikm, info, largo) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: sal, info }, k, largo * 8));
}

export async function cifrar(sub, payload) {
  const uaPub = deB64u(sub.keys.p256dh), auth = deB64u(sub.keys.auth);
  const par = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const ua = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secreto = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: ua }, par.privateKey, 256));
  const ikm = await hkdf(auth, secreto, unir(enc.encode("WebPush: info\0"), uaPub, asPub), 32);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sal, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const llave = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const texto = unir(typeof payload === "string" ? enc.encode(payload) : new Uint8Array(payload || []), new Uint8Array([2]));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, llave, texto));
  const rs = new Uint8Array([0, 0, 16, 0]);   // tamaño de registro 4096
  return unir(sal, rs, new Uint8Array([asPub.length]), asPub, cifrado);
}

export async function sendNotification(sub, payload, opc = {}) {
  if (!VAPID) throw Object.assign(new Error("web-push: faltan las llaves VAPID"), { statusCode: 500 });
  const destino = new URL(sub.endpoint);
  const cuerpo = payload != null && payload !== "" ? await cifrar(sub, payload) : null;
  const headers = { TTL: String(opc.TTL != null ? opc.TTL : 2419200), Authorization: "vapid t=" + (await firmaVapid(destino.origin)) + ", k=" + VAPID.publicKey };
  if (opc.urgency) headers.Urgency = opc.urgency;
  if (cuerpo) { headers["Content-Encoding"] = "aes128gcm"; headers["Content-Type"] = "application/octet-stream"; }
  const r = await fetch(sub.endpoint, { method: "POST", headers, body: cuerpo });
  if (r.status < 200 || r.status > 299) throw Object.assign(new Error("web-push: " + r.status), { statusCode: r.status, body: await r.text().catch(() => "") });
  return { statusCode: r.status, body: await r.text().catch(() => ""), headers: {} };
}
export function generateVAPIDKeys() { throw new Error("Genera las llaves VAPID con: npx web-push generate-vapid-keys"); }
export default { setVapidDetails, sendNotification, generateVAPIDKeys };
