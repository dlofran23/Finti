// Se carga antes de las pruebas de navegador: marca el inicio guiado como hecho, para que su ventana no tape
// lo que prueban las demás. También da por vista la historia de bienvenida (se prueba en historia.test.js). El inicio guiado se prueba en inicio.test.js, que corre SIN este archivo.
const pw = require('playwright');
const PRUEBAN_RECORDATORIO = /cuentas-por-pagar|almacenamiento/.test(process.argv[1] || '');
const lanzar = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...a) => {
  const b = await lanzar(...a), nuevo = b.newContext.bind(b);
  b.newContext = async (...o) => {
    const c = await nuevo(...o);
    await c.addInitScript(() => { try { if (!localStorage.getItem('fintelligente-inicio')) localStorage.setItem('fintelligente-inicio', 'hecho'); if (!localStorage.getItem('fintelligente-historia')) localStorage.setItem('fintelligente-historia', 'vista'); } catch (e) {} });
    // Desde las 6 p. m. aparece "¿Gastaste algo hoy?" y, como solo se ve un aviso a la vez, deja esperando a los demás:
    // las pruebas que no son de ese recordatorio lo dan por cerrado hoy, para no depender de la hora a la que corren.
    if (!PRUEBAN_RECORDATORIO) await c.addInitScript(() => { try { var d = new Date(), h = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); if (!localStorage.getItem('fintelligente-recordatorio')) localStorage.setItem('fintelligente-recordatorio', h); } catch (e) {} });
    return c;
  };
  b.newPage = async (...x) => (await b.newContext(...x)).newPage();
  return b;
};
