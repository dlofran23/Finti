// Leer ofertas con foto (28-nov-2026): Pregúntale y ¿Y si…? leen la foto de una oferta dentro del teléfono y dicen el
// precio, cuánto se ahorra, las promociones (2x1), las cuotas, el precio por kilo y cómo queda el día. El lector
// (Tesseract) se simula: se prueba lo que la app entiende del texto leído.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const esp = (ms) => new Promise((r) => setTimeout(r, ms));
// Un PNG de 1x1 para el campo de archivo
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const foto = { name: 'oferta.png', mimeType: 'image/png', buffer: PNG };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c.addInitScript(() => {
    window.Tesseract = { createWorker: async () => ({ recognize: async () => ({ data: { text: window.__texto || '' } }) }) };
  });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#inicio', { waitUntil: 'networkidle' }); await esp(1000);
  if (await p.isVisible('#dlg-inicio')) { await p.keyboard.press('Escape'); await esp(300); }
  await p.evaluate(() => document.getElementById('btn-preguntas-menu').click()); await esp(500);
  ok(await p.isVisible('#pr-cam'), 'Pregúntale tiene cámara para leer ofertas');
  const ultima = () => p.evaluate(() => { const m = document.querySelectorAll('#pr-log .pr-msg.app'); return m.length ? m[m.length - 1].textContent : ''; });
  async function leer(texto) { await p.evaluate((t) => { window.__texto = t; }, texto); await p.setInputFiles('#pr-foto', foto); await esp(900); return ultima(); }

  // Antes y ahora, con tamaño
  let r = await leer('SUPER OFERTA\nArroz Diana 5 kg\nAntes $ 22.500\nAhora $ 18.900');
  ok(/Arroz Diana 5 kg/.test(r) && /\$\s18\.900/.test(r), 'lee el producto y el precio de ahora: ' + r.slice(0, 70));
  ok(/te ahorras \$\s3\.600 \(16 %\)/.test(r), 'dice cuánto se ahorra y el porcentaje');
  ok(/\$\s3\.800 el kilo/.test(r), 'y cuánto sale el kilo');
  ok(/Si la compras hoy|Hoy tienes/.test(r), 'y cómo queda el día');
  ok((await p.$$eval('#pr-chips .pr-chip', (x) => x.map((e) => e.textContent))).includes('¿Y si la compro?'), 'ofrece ¿Y si la compro?');

  // 2x1
  r = await leer('Gaseosa Postobón 1,5 L\n2x1\n$ 5.200');
  ok(/2x1/.test(r) && /pagas \$\s5\.200 por 2/.test(r) && /\$\s2\.600/.test(r), 'entiende el 2x1: cada una sale a la mitad');

  // Descuento en porcentaje sin precio de antes
  r = await leer('Detergente Ariel 3 kg\n-30%\nHoy $ 35.000');
  ok(/Antes costaba \$\s50\.000/.test(r) && /30 %/.test(r), 'con -30 % calcula el precio de antes');

  // Cuotas
  r = await leer('Televisor Samsung 55"\n$ 1.899.900\n12 cuotas de $ 189.990');
  ok(/12 cuotas de \$\s189\.990 suman \$\s2\.279\.880/.test(r) && /más que de contado/.test(r), 'suma las cuotas y avisa cuánto más se paga');

  // Sin precio legible
  r = await leer('Gran venta de temporada');
  ok(/No alcancé a leer el precio/.test(r), 'si no hay precio, lo dice con amabilidad');

  // ¿Y si la compro? abre ¿Y si…? con el precio
  await leer('Arroz Diana 5 kg\nAntes $ 22.500\nAhora $ 18.900');
  await p.locator('#pr-chips .pr-chip', { hasText: '¿Y si la compro?' }).click(); await esp(500);
  ok(await p.isVisible('#dlg-ysi') && (await p.inputValue('#ysi-monto')) === '18900' && /Te alcanza|no alcanza/.test(await p.textContent('#ysi-res-c')), '¿Y si la compro? abre ¿Y si…? con el precio puesto');

  // ¿Y si…? también lee la foto
  ok(await p.isVisible('#ysi-cam'), '¿Y si…? tiene "Leer una oferta con foto"');
  await p.evaluate(() => { window.__texto = 'Licuadora Oster\nAntes $ 249.900\nAhora $ 199.900'; });
  await p.setInputFiles('#ysi-foto', foto); await esp(900);
  ok(/Licuadora Oster/.test(await p.textContent('#ysi-oferta')) && (await p.inputValue('#ysi-monto')) === '199900', 'lee la oferta y pone el precio en ¿Y si…?');

  ok(!errs.length, 'sin errores de página' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
