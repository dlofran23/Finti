// El sol de Finti en 3D (28-nov-2026): en el celular, el punto de la F grande de Inicio es un sol en 3D de día y la
// luna de noche. Si no hay WebGL, queda el sol de CSS. Se carga aparte, después del primer dibujo.
require('./sin-bienvenida.js');
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const esp = (ms) => new Promise((r) => setTimeout(r, ms));
async function abrir(b, hora, extra) {
  const c = await b.newContext(Object.assign({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, extra || {}));
  await c.addInitScript((h) => { const D = Date, f = new D(2026, 10, 28, h, 0).getTime(); Date = class extends D { constructor(...a) { super(...(a.length ? a : [f])); } static now() { return f; } }; }, hora);
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#inicio', { waitUntil: 'networkidle' }); await esp(2500);
  return { c, p, errs };
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  // De día
  let { c, p, errs } = await abrir(b, 10);
  const gl = await p.evaluate(() => { const x = document.createElement('canvas'); return !!(x.getContext('webgl2') || x.getContext('webgl')); });
  if (gl) {
    ok(await p.evaluate(() => document.getElementById('banda').classList.contains('con-3d') && !!document.querySelector('#banda canvas.astro3d')), 'de día, el punto de la F es el sol en 3D');
    ok(await p.evaluate(() => document.getElementById('banda').classList.contains('dia') && /255,\s*190,\s*60/.test(document.querySelector('#banda canvas.astro3d').style.filter)), 'con brillo dorado');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('#banda .astro')).opacity === '0'), 'y el sol de CSS se esconde');
    ok(await p.evaluate(() => { const r = document.querySelector('#banda canvas.astro3d').getBoundingClientRect(); return r.width === 150 && r.right > 390; }), 'está donde va el punto de la F');
  } else ok(await p.evaluate(() => !document.querySelector('#banda canvas.astro3d') && getComputedStyle(document.querySelector('#banda .astro')).opacity !== '0'), 'sin WebGL queda el sol de CSS');
  ok(!errs.length, 'sin errores de día' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await c.close();
  // De noche
  ({ c, p, errs } = await abrir(b, 21));
  if (gl) ok(await p.evaluate(() => document.getElementById('banda').classList.contains('noche') && /170,\s*190,\s*255/.test(document.querySelector('#banda canvas.astro3d').style.filter)), 'de noche es la luna, con brillo azul');
  ok(!errs.length, 'sin errores de noche' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await c.close();
  // En el computador no se carga (la banda no se ve)
  ({ c, p, errs } = await abrir(b, 10, { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false }));
  ok(await p.evaluate(() => !document.querySelector('#banda canvas.astro3d')), 'en el computador no se carga');
  await c.close();
  // Con reducir movimiento, se pinta quieto
  ({ c, p, errs } = await abrir(b, 10, { reducedMotion: 'reduce' }));
  if (gl) ok(await p.evaluate(() => document.getElementById('banda').classList.contains('con-3d')), 'con reducir movimiento también se ve, quieto');
  ok(!errs.length, 'sin errores con reducir movimiento' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await c.close();
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
