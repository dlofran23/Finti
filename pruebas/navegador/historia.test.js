// Historia de bienvenida: se ve la primera vez antes de la puerta, avanza al tocar, termina con las
// cuatro tarjetas en 3D y, al tocar Empezar o Saltar, deja la puerta de siempre y no vuelve a salir.
const BASE = process.env.BASE;
const CAPTURAS = require('path').join(__dirname, 'capturas'); require('fs').mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright');
let ok = 0, f = 0; const c = (n, v) => { v ? ok++ : (f++, console.log('FALLA', n)); };
// Los ayudantes de prueba dan la historia por vista; aquí se borra esa marca solo en la primera carga.
// El botón de Google de verdad pide un client ID real: en las pruebas se reemplaza por uno falso, como en las demás.
const FAKE_GIS = `window.google={accounts:{id:{initialize:function(){},renderButton:function(){}}}};`;
const gis = (c) => c.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }));
const primeraVez = () => { try { if (!sessionStorage.getItem('h-prueba')) { localStorage.removeItem('fintelligente-historia'); sessionStorage.setItem('h-prueba', '1'); } } catch (e) {} };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] }); const errs = [];
  let ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true }); await gis(ctx);
  await ctx.addInitScript(primeraVez);
  let p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|net::ERR_/.test(m.text())) errs.push(m.text()); });
  await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  c('historia aparece la primera vez', await p.isVisible('#finti-historia #empezar'));
  c('la puerta queda debajo', !(await p.$eval('#dlg-bienvenida', (d) => d.hidden)));
  c('se puede saltar', await p.isVisible('#finti-historia #saltar'));
  await p.screenshot({ path: CAPTURAS + '/historia-inicio.png' });
  await p.click('#finti-historia #empezar'); await p.waitForTimeout(700);
  c('escena 1 al compás', await p.$eval('#finti-historia', (h) => h.shadowRoot.querySelector('#e1').classList.contains('ver')));
  for (let i = 0; i < 3; i++) { await p.mouse.click(360, 500); await p.waitForTimeout(450); }
  c('llega a las tarjetas', await p.$eval('#finti-historia', (h) => h.shadowRoot.querySelector('#e4').classList.contains('ver')));
  await p.waitForTimeout(2500);
  c('tarjetas en 3D', (await p.$$('#finti-historia #f3d canvas')).length === 1);
  await p.fill('#finti-historia #nombre', 'Ana'); await p.waitForTimeout(1200);
  await p.mouse.click(195, 250); await p.waitForTimeout(1500);
  await p.screenshot({ path: CAPTURAS + '/historia-tarjetas.png' });
  await p.click('#finti-historia #abrirHoja'); await p.waitForTimeout(900);
  c('empezar cierra la historia', !(await p.$('#finti-historia')));
  c('queda la puerta con lo legal', await p.isVisible('#dlg-bienvenida') && await p.isVisible('#bienv-sin'));
  c('marca vista', (await p.evaluate(() => localStorage.getItem('fintelligente-historia'))) === 'vista');
  c('nombre solo en el dispositivo', (await p.evaluate(() => localStorage.getItem('fintelligente-nombre'))) === 'Ana');
  c('foco en la puerta', (await p.evaluate(() => document.activeElement && document.activeElement.id)) === 'bienv-t');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  c('no vuelve a salir', !(await p.$('#finti-historia')));
  await ctx.close();

  // Saltar desde el primer momento
  ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await gis(ctx);
  await ctx.addInitScript(primeraVez);
  p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  c('pc: historia', await p.isVisible('#finti-historia #empezar'));
  await p.screenshot({ path: CAPTURAS + '/historia-pc.png' });
  await p.click('#finti-historia #saltar'); await p.waitForTimeout(900);
  c('saltar cierra', !(await p.$('#finti-historia')));
  c('marca saltada', (await p.evaluate(() => localStorage.getItem('fintelligente-historia'))) === 'saltada');
  c('pc: puerta visible', await p.isVisible('#dlg-bienvenida'));
  await ctx.close();

  // Escape también la cierra
  ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await gis(ctx);
  await ctx.addInitScript(primeraVez);
  p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  await p.keyboard.press('Escape'); await p.waitForTimeout(900);
  c('escape cierra', !(await p.$('#finti-historia')));
  await ctx.close();

  c('sin errores: ' + errs.slice(0, 3).join(' | '), errs.length === 0);
  await b.close();
  console.log(`historia: ${ok} bien, ${f} fallas`); process.exit(f ? 1 : 0);
})();
