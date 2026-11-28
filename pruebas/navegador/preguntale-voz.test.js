// Pregúntale también escucha (28-nov-2026): el micrófono al lado de la pregunta entiende la voz dentro del teléfono,
// pregunta y responde; sin voz del navegador se dicta con el teclado; si falta el español, ofrece descargarlo; lo
// dicho con el micrófono de la app de Android vuelve a Pregúntale.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const esp = (ms) => new Promise((r) => setTimeout(r, ms));
const ultima = (p) => p.evaluate(() => { const m = document.querySelectorAll('#pr-log .pr-msg.app'); return m.length ? m[m.length - 1].textContent : ''; });
async function abrir(p) { await p.goto(BASE, { waitUntil: 'networkidle' }); await esp(800); await p.evaluate(() => document.getElementById('btn-preguntas-menu').click()); await esp(500); }
(async () => {
  const b = await chromium.launch(); const errs = [];

  // 1. Con la voz del navegador (dentro del dispositivo)
  const c1 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c1.addInitScript(() => {
    class SR {
      static available(o) { window.__srOpciones = o; return Promise.resolve('available'); }
      start() { window.__local = this.processLocally; const x = [{ transcript: 'cuánto gasté en comida este mes' }]; x.isFinal = true; setTimeout(() => this.onresult({ results: [x] }), 150); }
      stop() { this.onend && this.onend(); } abort() { this.abortado = true; window.__abortado = true; }
    }
    window.SpeechRecognition = SR;
  });
  const p = await c1.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await abrir(p);
  ok(await p.isVisible('#pr-form #pr-voz') && /dime/i.test(await p.getAttribute('#pr-input', 'placeholder')), 'Pregúntale tiene micrófono al lado de la pregunta');
  await p.click('#pr-voz'); await esp(300);
  ok((await p.getAttribute('#pr-voz', 'aria-pressed')) === 'true', 'mientras escucha, el micrófono se ve encendido');
  ok(await p.evaluate(() => window.__local === true && window.__srOpciones && window.__srOpciones.processLocally === true), 'la voz se entiende dentro del teléfono (processLocally)');
  await esp(3000);
  const yo = await p.evaluate(() => { const m = document.querySelectorAll('#pr-log .pr-msg.yo, #pr-log .pr-msg.user, #pr-log .pr-msg:not(.app)'); return m.length ? m[m.length - 1].textContent : ''; });
  ok(/cuánto gasté en comida este mes/i.test(yo), 'lo dicho queda como pregunta: ' + yo);
  ok(/Este mes llevas \$/.test(await ultima(p)), 'y Finti responde con los números');
  ok((await p.getAttribute('#pr-voz', 'aria-pressed')) === 'false' && (await p.inputValue('#pr-input')) === '', 'al terminar, el micrófono se apaga y la caja queda limpia');
  await c1.close();

  // 2. Sin voz del navegador: se dicta con el micrófono del teclado
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c2.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
  const q = await c2.newPage(); q.on('pageerror', (e) => errs.push(e.message));
  await abrir(q);
  ok(await q.isVisible('#pr-voz'), 'el micrófono se ve aunque el navegador no entienda voz');
  await q.click('#pr-voz'); await esp(400);
  ok(/micrófono de tu teclado/.test(await ultima(q)) && await q.evaluate(() => document.activeElement && document.activeElement.id === 'pr-input'), 'sin voz del navegador, explica cómo dictar con el teclado y deja lista la caja');
  await c2.close();

  // 3. Falta el español: ofrece descargarlo una vez
  const c3 = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c3.addInitScript(() => {
    class SR { static available() { return Promise.resolve(window.__instalado ? 'available' : 'downloadable'); } static install() { window.__instalado = true; return Promise.resolve(true); } start() {} stop() {} }
    window.SpeechRecognition = SR;
  });
  const r = await c3.newPage(); r.on('pageerror', (e) => errs.push(e.message));
  await abrir(r);
  await r.click('#pr-voz'); await esp(400);
  ok(/descargar el español una sola vez/.test(await ultima(r)) && await r.isVisible('#pr-log [data-pr-voz-instalar]'), 'si falta el español, ofrece descargarlo');
  await r.click('#pr-log [data-pr-voz-instalar]'); await esp(400);
  ok(/Listo\. Toca el micrófono y pregúntame/.test(await ultima(r)), 'y avisa cuando ya puede escuchar');
  await c3.close();

  // 4. Lo dicho con el micrófono de la app de Android vuelve a Pregúntale
  const c4 = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c4.addInitScript(() => { try { sessionStorage.setItem('fintelligente-voz-para', 'preguntas'); } catch (e) {} });
  const s = await c4.newPage(); s.on('pageerror', (e) => errs.push(e.message));
  const dicho = Buffer.from('cuánto debo', 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await s.goto(BASE + '/#accion=charla&dicho=' + dicho, { waitUntil: 'networkidle' }); await esp(1500);
  ok(await s.isVisible('#dlg-preguntas') && !(await s.isVisible('#dlg-charla')), 'lo dicho con la app de Android abre Pregúntale, no Cuéntame un gasto');
  ok(/debes|deuda|No tienes deudas|Debes/i.test(await ultima(s)), 'y responde la pregunta dicha: ' + (await ultima(s)).slice(0, 80));
  ok(await s.evaluate(() => !sessionStorage.getItem('fintelligente-voz-para')), 'la marca se borra después de usarla');
  await c4.close();

  // 5. Cerrar Pregúntale mientras escucha apaga el micrófono
  const c5 = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c5.addInitScript(() => { class SR { static available() { return Promise.resolve('available'); } start() {} stop() {} abort() { window.__abortado = true; } } window.SpeechRecognition = SR; });
  const t = await c5.newPage(); t.on('pageerror', (e) => errs.push(e.message));
  await abrir(t); await t.click('#pr-voz'); await esp(200);
  await t.click('#dlg-preguntas [data-close]'); await esp(400);
  ok(await t.evaluate(() => window.__abortado === true), 'al cerrar Pregúntale, deja de escuchar');
  await c5.close();

  ok(!errs.length, 'sin errores de página' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
