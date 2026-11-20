// Bre-B: los avisos de pagos inmediatos entran con su medio y el nombre enmascarado de quien envía o recibe;
// los mensajes falsos que piden confirmar una plata por un enlace no se registran y se avisa a la persona.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const lote = (avisos) => Buffer.from(JSON.stringify(avisos)).toString('base64url');
const estado = (p) => p.evaluate(() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.pendientes) return v; } catch (e) {} } return null; });

(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const leer = (t, a) => p.evaluate(([t, a]) => window.FinLector.leerAviso(t, { remitente: a || '' }), [t, a]);

  // Lector
  let r = await leer('Bancolombia: Enviaste $50.000 por Bre-B a la llave 3001234567 (JUA*** PER***) el 07/11/2026 15:32.');
  ok(r.ok && r.tipo === 'gasto' && r.monto === 50000 && r.medio === 'Bre-B' && r.comercio === 'JUA*** PER***', 'envío por llave: gasto, Bre-B, a JUA*** PER***');
  r = await leer('Recibiste $120.000 por Bre-B de MAR*** GOM*** desde Bancolombia.', 'Nequi');
  ok(r.ok && r.tipo === 'ingreso' && r.comercio === 'MAR*** GOM***' && r.banco === 'Nequi', 'recibido por Bre-B: ingreso de MAR*** GOM***, en Nequi (' + r.banco + ')');
  r = await leer('Banco de Bogotá: Recibiste por llave desde Davivienda $80.000 el 07/11/2026');
  ok(r.ok && r.tipo === 'ingreso' && r.comercio === 'Bre-B desde Davivienda' && /Bogot/.test(r.banco), 'quien avisa es el banco ("' + r.banco + '"); el otro es el origen ("' + r.comercio + '")');
  r = await leer('BBVA: Enviaste por llave $200.000 a @juanp el 07/11/2026');
  ok(r.ok && r.comercio === '@juanp' && r.medio === 'Bre-B', 'llave alfanumérica: @juanp');
  r = await leer('Davivienda: Transferencia llave 0012345678 - Nequi por $45.000');
  ok(r.ok && r.comercio === 'Llave 0012345678', 'llave de comercio: ' + r.comercio);
  r = await leer('Pagaste $12.000 con QR Bre-B en PANADERIA EL TRIGAL');
  ok(r.ok && r.medio === 'Bre-B' && /PANADERIA EL TRIGAL/i.test(r.comercio), 'pago con QR Bre-B en un comercio');

  // Estafas
  const falsos = [
    'Recibiste una transferencia por $847.000 en tu cuenta Bre-B. Para más información, haz clic en el enlace https://bre-b-pagos.co/x',
    'Bre-B: tienes un pago pendiente por $500.000. Confírmalo antes de 24 horas en bit.ly/abc123',
    'Bancolombia: tu transferencia por $300.000 está pendiente, confírmala en bancolombia-seguro.com',
    'Te enviaron $150.000 por Bre-B. Acéptalo aquí: www.breb-colombia.com/recibir'
  ];
  for (const t of falsos) { r = await leer(t); ok(!r.ok && r.motivo === 'estafa', 'estafa frenada: ' + t.slice(0, 50)); }
  const reales = [
    'Bancolombia: Pagaste $50.000 en EXITO. Si no fuiste tú, bloquea tu tarjeta en bancolombia.com/personas',
    'Bancolombia: Compra aprobada por $45.900 en AMAZON.COM con tu T.Cred *4321',
    'Nequi: Recibiste $20.000 de ANA*** RUI***. Conoce más en nequi.com.co'
  ];
  for (const t of reales) { r = await leer(t); ok(r.ok, 'aviso real con enlace oficial o comercio .com: ' + t.slice(0, 50)); }

  // Desde la app de Android: entran los reales y se avisa de la estafa
  await p.goto(BASE + '/?app=android&lectura=1&v=9#importar-lote=' + lote([
    { t: falsos[0], a: 'Mensajes', ts: Date.now() },
    { t: 'Recibiste $120.000 por Bre-B de MAR*** GOM*** desde Bancolombia.', a: 'Nequi', ts: Date.now() }
  ]), { waitUntil: 'networkidle' });
  await p.waitForTimeout(5200);
  const s = await estado(p), pend = (s && s.pendientes) || [];
  ok(pend.length === 1 && pend[0].monto === 120000 && pend[0].medio === 'Bre-B', 'solo entra el aviso real de Bre-B');
  ok(!JSON.stringify(s).includes('847'), 'la estafa no queda guardada');
  const toasts = await p.$$eval('#toasts .toast', (l) => l.map((x) => x.textContent)).catch(() => []);
  ok(toasts.some((x) => /parece(n)? estafa/.test(x) && /enlace/.test(x)), 'avisa que llegó un mensaje que parece estafa');

  // Pegar un aviso falso
  await p.evaluate(() => { const d = document.getElementById('pegar-box'); if (d) d.open = true; });
  if (await p.$('#pegar-texto')) {
    await p.evaluate(() => { const d = document.getElementById('pegar-box'); let t = d; while (t && t !== document.body) { if (t.hidden) t.hidden = false; if (t.tagName === 'DIALOG' && !t.open) t.setAttribute('open', ''); t = t.parentElement; } });
    await p.fill('#pegar-texto', falsos[1]); await p.click('#pegar-leer'); await p.waitForTimeout(200);
    ok(/parece una estafa/.test(await p.textContent('#pegar-msg')), 'al pegarlo, explica que parece estafa');
  }
  console.log('errores de página:', errs);
  ok(!errs.length, 'sin errores de JavaScript');
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO BIEN (Bre-B)');
  await b.close();
})();
