// Para las pruebas de la charla: Finti ya no supone efectivo y pregunta con qué se pagó.
// Si la pregunta está a la vista, toca la cuenta pedida (por defecto Efectivo). Devuelve si respondió.
module.exports = async function pagarCon(p, nombre) {
  const sel = '#ch-chips [data-ch^="cuenta"]' + (nombre === undefined ? ':has-text("Efectivo")' : nombre ? ':has-text("' + nombre + '")' : '');
  let b = await p.$(sel); if (!b && nombre === undefined) b = await p.$('#ch-chips [data-ch^="cuenta"]');
  if (!b) return false;
  await b.click(); await p.waitForTimeout(300); return true;
};
