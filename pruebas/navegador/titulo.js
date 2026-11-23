// El título del presupuesto solo se ve en Tu presupuesto. Para escribirlo, la prueba pasa un momento
// a esa sección, lo escribe y vuelve a la pestaña donde estaba.
module.exports = async function escribirTitulo(p, texto) {
  const vista = await p.evaluate(() => document.body.dataset.vista || '');
  const ir = (v) => p.evaluate((v) => { const t = document.querySelector('[data-tab="' + v + '"], [data-goto="' + v + '"]'); if (t) t.click(); }, v);
  if (vista !== 'presupuesto') await ir('presupuesto');
  await p.fill('#f-titulo', texto); await p.press('#f-titulo', 'Tab');
  if (vista !== 'presupuesto') await ir(vista || 'inicio');
};
