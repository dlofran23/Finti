// /api/migrar: recibe los datos que manda herramientas/migrar-datos.mjs desde Netlify, una sola vez, durante la mudanza.
// Solo funciona si existe la llave MIGRAR_CLAVE (16 caracteres o más). Después de la mudanza se borra esa llave
// en Cloudflare y la ruta queda apagada.
import { getStore, listStores } from "./blobs-d1.mjs";

const NOMBRE = /^[a-z0-9-]{2,40}$/;
function igual(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const deB64 = (t) => { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };

export async function migrar(req, env) {
  const clave = String(env.MIGRAR_CLAVE || "");
  if (clave.length < 16) return Response.json({ error: "La migración está apagada." }, { status: 404 });
  if (!igual(String(req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""), clave)) return Response.json({ error: "Clave incorrecta." }, { status: 401 });
  if (req.method === "GET") {
    const { stores } = await listStores(), conteo = {};
    for (const t of stores) conteo[t] = (await getStore(t).list()).blobs.length;
    return Response.json({ ok: true, conteo });
  }
  if (req.method !== "POST") return Response.json({ error: "Usa GET o POST" }, { status: 405 });
  let d; try { d = await req.json(); } catch { return Response.json({ error: "No es JSON." }, { status: 400 }); }
  if (!NOMBRE.test(d.tienda || "") || !Array.isArray(d.items) || d.items.length > 100) return Response.json({ error: "Lote inválido." }, { status: 400 });
  const t = getStore(d.tienda); let n = 0;
  for (const it of d.items) {
    if (typeof it.clave !== "string" || !it.clave || it.clave.length > 512 || typeof it.valor !== "string") continue;
    await t.set(it.clave, it.tipo === "b" ? deB64(it.valor) : it.valor, it.meta && Object.keys(it.meta).length ? { metadata: it.meta } : {});
    n++;
  }
  return Response.json({ ok: true, guardados: n });
}
