// Se carga antes de las pruebas de navegador (node -r ./navegador/acepto-previo.js ...).
// Simula que la persona ya confirmó su edad y aceptó los términos, para que las demás pruebas se
// concentren en lo suyo. La aceptación en sí se prueba en acepto.test.js, que corre SIN este archivo.
const pw = require('playwright');
const lanzar = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...a) => {
  const b = await lanzar(...a), nuevo = b.newContext.bind(b);
  b.newContext = async (...o) => {
    const c = await nuevo(...o);
    await c.addInitScript(() => {
      try { if (!localStorage.getItem('fintelligente-historia')) localStorage.setItem('fintelligente-historia', 'vista'); } catch (e) {}
      try { sessionStorage.setItem('fintelligente-acepto', JSON.stringify({ v: '1.3', edad: '18+', rep: false, ok: true })); } catch (e) {}
      try { document.cookie = 'ft_acepto=1.1~18~0; path=/'; } catch (e) {}
    });
    return c;
  };
  return b;
};
