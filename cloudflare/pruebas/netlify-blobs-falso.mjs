// Netlify Blobs de mentira para probar herramientas/migrar-datos.mjs sin tocar Netlify
const DATOS = {
  "cuentas-usuarios": { "u/abc": { t: JSON.stringify({ id: "abc", correo: "a@b.co" }) }, "u/def": { t: JSON.stringify({ id: "def" }) } },
  "pagos": { "ref-9": { t: JSON.stringify({ estado: "APPROVED" }) } },
  "respaldos": {},
  "salud-app": { "foto": { b: new Uint8Array([0, 255, 1, 2, 200]), m: { fecha: "2026-11-19" } } },
};
export function getStore({ name }) {
  const d = DATOS[name] || {};
  return {
    list() { return { async *[Symbol.asyncIterator]() { yield { blobs: Object.keys(d).map((key) => ({ key })) }; } }; },
    async getWithMetadata(k) { const x = d[k]; if (!x) return null; const u = x.b || new TextEncoder().encode(x.t); return { data: u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength), metadata: x.m || {} }; },
  };
}
