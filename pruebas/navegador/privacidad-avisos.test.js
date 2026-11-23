// Confianza en la lectura de avisos: los códigos de seguridad nunca se guardan, del aviso no queda el texto
// completo, y Conectar bancos explica cómo se cuidan (con enlace a Tu privacidad en la app de Android).
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const lote = (avisos) => Buffer.from(JSON.stringify(avisos)).toString('base64url');
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';
const estado = (p) => p.evaluate(() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.pendientes) return v; } catch (e) {} } return null; });

(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  const avisos = [
    { t: 'Bancolombia: tu clave dinamica para la compra de $50.000 en EXITO es 482913. No la compartas.', a: 'Bancolombia', ts: Date.now() },
    { t: 'Nequi: 739201 es tu codigo para autorizar el pago de $120.000', a: 'Nequi', ts: Date.now() },
    { t: 'Bancolombia: Compraste $45.900 en EXITO con tu T.Deb *1234 desde tu cuenta Nequi. Nunca compartas tus claves.', a: 'Bancolombia', ts: Date.now() }
  ];
  await p.goto(BASE + '/?app=android&lectura=1&v=8#importar-lote=' + lote(avisos), { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  const s = await estado(p), pend = (s && s.pendientes) || [], todo = JSON.stringify(s);
  ok(pend.length === 1 && pend[0].monto === 45900, 'solo entra la compra real; los dos códigos de seguridad se descartan (' + pend.length + ')');
  ok(!/482913|739201/.test(todo), 'ningún código de seguridad queda guardado');
  ok(pend[0] && !('texto' in pend[0]) && !/Nunca compartas|T\.Deb/.test(todo), 'del aviso no se guarda el texto completo');
  ok(pend[0] && /nequi/.test(pend[0].pista || ''), 'solo queda una pista para reconocer la cuenta: "' + (pend[0] && pend[0].pista) + '"');
  ok(await p.evaluate(() => window.FinLector.esCodigoSeguridad('su codigo de verificacion es 5521') && !window.FinLector.esCodigoSeguridad('compra con tarjeta terminada en 4521 por $80.000, no compartas tu clave')), 'el lector distingue un código de los últimos números de una tarjeta');

  // Conectar bancos: cómo cuidamos tus avisos
  await p.evaluate(() => document.getElementById('btn-fuentes-menu').click()); await p.waitForTimeout(400);
  const conf = await p.$('#dlg-fuentes details.confianza');
  ok(!!conf, 'Conectar bancos muestra "¿Cómo cuidamos tus avisos?"');
  const txt = conf ? await conf.textContent() : '';
  ok(/Nunca WhatsApp/.test(txt) && /códigos de seguridad se bloquean/.test(txt) && /Nadie puede mover tu plata/.test(txt) && /pausar la lectura/.test(txt), 'explica chats, códigos, claves y control');
  ok(await p.$eval('#dlg-fuentes details.confianza a.btn', (a) => a.getAttribute('href')).catch(() => '') === 'intent://privacidad#Intent;scheme=fintelligente;package=co.fintelligente.app;end', 'con la app 1.7 ofrece ver lo que ha leído la app');
  await c.close();

  // App vieja (sin pantalla de privacidad): no muestra el botón, pero sí la explicación
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA }); const q = await c2.newPage(); q.on('pageerror', (e) => errs.push(e.message));
  await q.goto(BASE + '/?app=android&lectura=0', { waitUntil: 'networkidle' }); await q.waitForTimeout(600);
  await q.evaluate(() => document.getElementById('btn-fuentes-menu').click()); await q.waitForTimeout(400);
  ok(await q.$eval('#dlg-fuentes details.confianza', (d) => d.open).catch(() => false) && !(await q.$('#dlg-fuentes details.confianza a.btn')), 'antes de activar la lectura, la explicación aparece abierta (sin botón en apps viejas)');
  await c2.close();

  // En el computador también se explica (sin la parte de Android)
  const c3 = await b.newContext({ viewport: { width: 1200, height: 900 } }); const r = await c3.newPage(); r.on('pageerror', (e) => errs.push(e.message));
  await r.goto(BASE, { waitUntil: 'networkidle' }); await r.waitForTimeout(500);
  await r.evaluate(() => document.getElementById('btn-fuentes-menu').click()); await r.waitForTimeout(400);
  const t3 = await r.textContent('#dlg-fuentes details.confianza').catch(() => '');
  ok(/códigos de seguridad se bloquean/.test(t3) && !/WhatsApp/.test(t3), 'en el computador explica lo que aplica');
  await c3.close();

  console.log('errores de página:', errs);
  ok(!errs.length, 'sin errores de JavaScript');
  console.log(fallas ? 'FALLAS: ' + fallas : 'TODO BIEN (privacidad de los avisos)');
  await b.close();
})();
