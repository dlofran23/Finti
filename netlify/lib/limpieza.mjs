// Limpieza diaria de registros temporales, para cumplir lo que dice la política de datos:
// - límites de uso (guardan huellas de IP y de correo): se borran si no tienen actividad en 24 horas;
// - códigos para entrar y códigos de canje vencidos.
const DIA = 24 * 60 * 60 * 1000;

export async function limpiarTemporales({ limites, codigos }, ahora = Date.now()) {
  let n = 0;
  if (limites) for (const { key } of (await limites.list()).blobs) {
    const reg = await limites.get(key, { type: "json" });
    const ultimo = Math.max(0, ...((reg && reg.t) || []));
    if (ahora - ultimo > DIA) { await limites.delete(key); n++; }
  }
  if (codigos) for (const { key } of (await codigos.list()).blobs) {
    const reg = await codigos.get(key, { type: "json" });
    if (!reg || !reg.expira || reg.expira < ahora) { await codigos.delete(key); n++; }
  }
  return n;
}
