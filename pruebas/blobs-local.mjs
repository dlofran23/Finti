// Netlify Blobs local para pruebas, con dos ajustes para que se comporte como el de producción:
// - Al leer, devuelve la etiqueta (ETag) del registro. El emulador oficial no la manda; Netlify sí.
// - Las escrituras se atienden de una en una (en producción la comparación de etiqueta y la escritura
//   son una sola operación), y cada una deja una etiqueta distinta.
import { BlobsServer } from "@netlify/blobs/server";

export class BlobsLocal extends BlobsServer {
  constructor(o) { super(o); this._fila = Promise.resolve(); }
  async get(req) {
    const url = this.parseAPIRequest(req)?.url ?? new URL(req.url ?? "", this.address);
    const { dataPath, key } = this.getLocalPaths(url);
    if (!dataPath || !key || this.parseAPIRequest(req)?.useSignedURL) return super.get(req);   // listados y enlaces firmados
    for (;;) {   // la etiqueta tiene que ser la del mismo contenido que se lee
      const antes = await BlobsServer.generateETag(dataPath);
      const r = await super.get(req.clone());
      if (r.status !== 200) return r;
      if (!antes) continue;          // se creó justo mientras se leía
      const despues = await BlobsServer.generateETag(dataPath);
      if (antes !== despues) continue;
      const h = new Headers(r.headers); h.set("etag", antes);
      return new Response(await r.arrayBuffer(), { status: r.status, headers: h });
    }
  }
  put(req) {
    const turno = this._fila.then(() => super.put(req)).then(async (r) => { await new Promise((s) => setTimeout(s, 3)); return r; });
    this._fila = turno.catch(() => {});
    return turno;
  }
}
