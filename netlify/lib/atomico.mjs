// Escrituras seguras en Netlify Blobs: leer, cambiar y guardar sin pisar lo que otro proceso guardó entre medio.
// Usa la etiqueta (ETag) del registro: si cambió desde que lo leímos, se vuelve a leer y se reintenta.
//
//   const r = await actualizar(store, clave, (actual) => nuevoValor | undefined)
//   - Si la función devuelve undefined, no se escribe nada (r.escrito = false).
//   - Si devuelve null, se borra el registro.
//   - r.valor es lo que quedó guardado (o lo que había, si no se escribió).

import crypto from "node:crypto";

export class Conflicto extends Error {
  constructor(clave) { super("Otro proceso cambió el registro al mismo tiempo: " + clave); this.conflicto = true; }
}

const espera = (i) => new Promise((r) => setTimeout(r, Math.floor(Math.random() * 15 * (i + 1))));

// Lee el registro con su etiqueta. Si el almacén no sabe dar etiquetas (pruebas antiguas), devuelve etag null.
let avisoSinEtag = false;
export async function leerConEtag(store, clave) {
  if (typeof store.getWithMetadata === "function") {
    for (let i = 0; i < 3; i++) {
      const r = await store.getWithMetadata(clave, { type: "json" });
      if (!r) return null;
      if (r.etag) return { data: r.data, etag: r.etag };
    }
    // Netlify siempre manda la etiqueta; si algún día no llega, se guarda igual pero queda registrado.
    if (!avisoSinEtag) { avisoSinEtag = true; console.warn("atomico: el almacén no devolvió etiqueta; escritura sin condición en", clave); }
    const r = await store.getWithMetadata(clave, { type: "json" });
    return r ? { data: r.data, etag: null } : null;
  }
  const data = await store.get(clave, { type: "json" });
  return data == null ? null : { data, etag: null };
}

export async function actualizar(store, clave, cambiar, intentos = 8) {
  for (let i = 0; i < intentos; i++) {
    const act = await leerConEtag(store, clave);
    const previo = act ? act.data : null;
    const nuevo = await cambiar(previo == null ? null : JSON.parse(JSON.stringify(previo)));
    if (nuevo === undefined) return { escrito: false, valor: previo };
    if (nuevo === null) { if (act) await store.delete(clave); return { escrito: true, valor: null }; }
    const opc = !act ? { onlyIfNew: true } : act.etag ? { onlyIfMatch: act.etag } : {};
    const res = await store.setJSON(clave, nuevo, opc);
    if (!res || res.modified !== false) return { escrito: true, valor: nuevo };
    await espera(i);
  }
  throw new Conflicto(clave);
}

// Crea un registro solo si la clave no existe. Devuelve true si lo creó.
export async function crearSiNoExiste(store, clave, valor) {
  const res = await store.setJSON(clave, valor, { onlyIfNew: true });
  return !res || res.modified !== false;
}

// Límite por ventana de tiempo (contra abuso). Guarda solo una huella de la clave, nunca la clave.
// Dos solicitudes al mismo tiempo no se cuentan como una sola.
export async function limitar(store, clave, max, ventanaMs, ahora = Date.now()) {
  const k = crypto.createHash("sha256").update(String(clave)).digest("hex").slice(0, 40);
  let permitido = false;
  try {
    await actualizar(store, k, (reg) => {
      const recientes = ((reg && reg.t) || []).filter((x) => ahora - x < ventanaMs);
      if (recientes.length >= max) { permitido = false; return undefined; }
      permitido = true; recientes.push(ahora);
      return { t: recientes.slice(-max) };
    });
  } catch (e) { if (e && e.conflicto) return false; throw e; }   // demasiada competencia por la misma clave: se trata como abuso
  return permitido;
}
