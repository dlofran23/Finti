// Almacén en memoria que se comporta como Netlify Blobs: etiquetas (ETag), escrituras condicionales
// (onlyIfMatch / onlyIfNew) y, si se pide, demoras al azar para que las operaciones se crucen como en la vida real.
export function memStore({ demora = 0 } = {}) {
  const m = new Map(); let n = 0;
  const pausa = () => (demora ? new Promise((r) => setTimeout(r, Math.random() * demora)) : Promise.resolve());
  const copia = (t) => JSON.parse(t);
  return {
    _m: m,
    async get(k) { await pausa(); return m.has(k) ? copia(m.get(k).v) : null; },
    async getWithMetadata(k) { await pausa(); const x = m.get(k); return x ? { data: copia(x.v), etag: x.etag, metadata: {} } : null; },
    async setJSON(k, v, o = {}) {
      await pausa();
      const x = m.get(k);
      if (o.onlyIfNew && x) return { modified: false };
      if (o.onlyIfMatch && (!x || x.etag !== o.onlyIfMatch)) return { modified: false };
      const etag = '"' + ++n + '"';
      m.set(k, { v: JSON.stringify(v), etag });
      return { modified: true, etag };
    },
    async set(k, v, o = {}) { return this.setJSON(k, String(v), o); },
    async delete(k) { await pausa(); m.delete(k); },
    async list({ prefix = "" } = {}) { await pausa(); return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
  };
}
