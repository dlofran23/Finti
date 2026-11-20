// Reemplazo de "@netlify/blobs" sobre Cloudflare D1 (wrangler.jsonc lo pone en lugar del paquete original).
// Mantiene la misma interfaz que usan netlify/lib/*.mjs, así el código de la app no cambia:
//   get(clave, { type: "json" | "text" | "arrayBuffer" }), getWithMetadata, getMetadata,
//   set / setJSON(clave, valor, { metadata, onlyIfNew, onlyIfMatch }) → { modified, etag },
//   delete(clave), list({ prefix, paginate }).
// Las escrituras condicionales (onlyIfNew, onlyIfMatch) son atómicas: D1 es SQLite con un solo primario.
const PARTE = 1_500_000;   // D1 admite filas de hasta 2 MB

let BD = null;
export function usarBaseDeDatos(d1) { BD = d1; }
function bd() { if (!BD) throw new Error("blobs-d1: falta la base de datos (binding DATOS)"); return BD; }

const etiqueta = () => crypto.randomUUID().replace(/-/g, "");
const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const deB64 = (t) => { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };

function aTexto(valor) {
  if (typeof valor === "string") return { texto: valor, tipo: "t" };
  if (valor instanceof ArrayBuffer) return { texto: b64(new Uint8Array(valor)), tipo: "b" };
  if (ArrayBuffer.isView(valor)) return { texto: b64(new Uint8Array(valor.buffer, valor.byteOffset, valor.byteLength)), tipo: "b" };
  throw new Error("blobs-d1: valor no admitido (usa texto, ArrayBuffer o Uint8Array)");
}
function convertir(texto, tipo, como) {
  if (texto == null) return null;
  const bin = tipo === "b";
  if (como === "json") return JSON.parse(bin ? new TextDecoder().decode(deB64(texto)) : texto);
  if (como === "arrayBuffer") return bin ? deB64(texto).buffer : new TextEncoder().encode(texto).buffer;
  if (como === "blob") return new Blob([bin ? deB64(texto) : texto]);
  return bin ? new TextDecoder().decode(deB64(texto)) : texto;
}

class Tienda {
  constructor(nombre) { this.nombre = nombre; }
  async _fila(clave) {
    const f = await bd().prepare("SELECT valor, tipo, partes, meta, etag FROM blobs WHERE tienda = ?1 AND clave = ?2").bind(this.nombre, clave).first();
    if (!f) return null;
    if (f.partes > 0) {
      const { results } = await bd().prepare("SELECT valor FROM partes WHERE tienda = ?1 AND clave = ?2 ORDER BY n").bind(this.nombre, clave).all();
      f.valor = results.map((r) => r.valor).join("");
    }
    return f;
  }
  async get(clave, opc = {}) { const f = await this._fila(clave); return f ? convertir(f.valor, f.tipo, opc.type) : null; }
  async getWithMetadata(clave, opc = {}) {
    const f = await this._fila(clave); if (!f) return null;
    return { data: convertir(f.valor, f.tipo, opc.type), etag: f.etag, metadata: f.meta ? JSON.parse(f.meta) : {} };
  }
  async getMetadata(clave) {
    const f = await bd().prepare("SELECT meta, etag FROM blobs WHERE tienda = ?1 AND clave = ?2").bind(this.nombre, clave).first();
    return f ? { etag: f.etag, metadata: f.meta ? JSON.parse(f.meta) : {} } : null;
  }
  async setJSON(clave, valor, opc) { return this.set(clave, JSON.stringify(valor), opc); }
  async set(clave, valor, opc = {}) {
    const { texto, tipo } = aTexto(valor), etag = etiqueta(), meta = opc.metadata ? JSON.stringify(opc.metadata) : null, ahora = Date.now();
    const grande = texto.length > PARTE, n = grande ? Math.ceil(texto.length / PARTE) : 0, principal = grande ? null : texto;
    const T = this.nombre, d = bd();
    let fila;
    if (opc.onlyIfNew) fila = d.prepare("INSERT INTO blobs (tienda, clave, valor, tipo, partes, meta, etag, cambiado) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT (tienda, clave) DO NOTHING").bind(T, clave, principal, tipo, n, meta, etag, ahora);
    else if (opc.onlyIfMatch) fila = d.prepare("UPDATE blobs SET valor = ?3, tipo = ?4, partes = ?5, meta = ?6, etag = ?7, cambiado = ?8 WHERE tienda = ?1 AND clave = ?2 AND etag = ?9").bind(T, clave, principal, tipo, n, meta, etag, ahora, opc.onlyIfMatch);
    else fila = d.prepare("INSERT INTO blobs (tienda, clave, valor, tipo, partes, meta, etag, cambiado) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT (tienda, clave) DO UPDATE SET valor = excluded.valor, tipo = excluded.tipo, partes = excluded.partes, meta = excluded.meta, etag = excluded.etag, cambiado = excluded.cambiado").bind(T, clave, principal, tipo, n, meta, etag, ahora);
    if (!grande) {
      const [r] = await d.batch([fila, d.prepare("DELETE FROM partes WHERE tienda = ?1 AND clave = ?2").bind(T, clave)]);
      const hecho = r.meta.changes > 0;
      return { modified: hecho, etag: hecho ? etag : undefined };
    }
    // Valor grande: la fila principal y sus partes en una sola transacción. Si la condición no se cumple, se deshace todo.
    const [r] = await d.batch([fila]);
    if (!(r.meta.changes > 0)) return { modified: false };
    const ops = [d.prepare("DELETE FROM partes WHERE tienda = ?1 AND clave = ?2").bind(T, clave)];
    for (let i = 0; i < n; i++) ops.push(d.prepare("INSERT INTO partes (tienda, clave, n, valor) VALUES (?1, ?2, ?3, ?4)").bind(T, clave, i, texto.slice(i * PARTE, (i + 1) * PARTE)));
    await d.batch(ops);
    return { modified: true, etag };
  }
  async delete(clave) {
    await bd().batch([bd().prepare("DELETE FROM blobs WHERE tienda = ?1 AND clave = ?2").bind(this.nombre, clave), bd().prepare("DELETE FROM partes WHERE tienda = ?1 AND clave = ?2").bind(this.nombre, clave)]);
  }
  async _pagina(prefijo, desde, max) {
    const { results } = await bd().prepare("SELECT clave, etag FROM blobs WHERE tienda = ?1 AND clave >= ?2 AND clave > ?3 AND substr(clave, 1, length(?2)) = ?2 ORDER BY clave LIMIT ?4")
      .bind(this.nombre, prefijo, desde, max).all();
    return results.map((r) => ({ key: r.clave, etag: r.etag }));
  }
  list(opc = {}) {
    const prefijo = opc.prefix || "", yo = this;
    if (opc.paginate) {
      return { async *[Symbol.asyncIterator]() { let desde = ""; for (;;) { const b = await yo._pagina(prefijo, desde, 1000); if (!b.length) return; yo; desde = b[b.length - 1].key; yield { blobs: b, directories: [] }; if (b.length < 1000) return; } } };
    }
    return (async () => { const todo = []; let desde = ""; for (;;) { const b = await yo._pagina(prefijo, desde, 1000); todo.push(...b); if (b.length < 1000) break; desde = b[b.length - 1].key; } return { blobs: todo, directories: [] }; })();
  }
}

export function getStore(o) { const nombre = typeof o === "string" ? o : o && o.name; if (!nombre) throw new Error("getStore: falta el nombre"); return new Tienda(nombre); }
export function getDeployStore(o) { return getStore(o || "deploy"); }
export async function listStores() {
  const { results } = await bd().prepare("SELECT DISTINCT tienda FROM blobs ORDER BY tienda").all();
  return { stores: results.map((r) => r.tienda) };
}
