// Para las pruebas anteriores a las cuentas: marca la bienvenida como vista en cada contexto nuevo.
const pw = require('playwright'); const orig = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...a) => {
  const b = await orig(...a), nc = b.newContext.bind(b);
  b.newContext = async (...x) => { const c = await nc(...x); await c.addInitScript(() => { try { localStorage.setItem('fintelligente-bienvenida', '1'); if (!localStorage.getItem('fintelligente-historia')) localStorage.setItem('fintelligente-historia', 'vista'); sessionStorage.setItem('fintelligente-sin-cuenta', '1'); } catch (e) {} }); return c; };
  b.newPage = async (...x) => (await b.newContext(...x)).newPage();
  return b;
};
