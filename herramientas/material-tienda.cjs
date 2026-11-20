// Material para Google Play y redes: capturas de la app con datos de muestra, armadas en piezas de 1080 × 1920 con un
// titular, y el gráfico destacado de 1024 × 500. El nombre sale de public/manifest.webmanifest, así que al pasar a Finti
// basta con volver a correrlo.
// Uso: node pruebas/navegador/servidor.mjs 18810 &  luego  BASE=http://localhost:18810 node herramientas/material-tienda.cjs
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const RAIZ = path.join(__dirname, '..'), SAL = path.join(RAIZ, 'material-tienda'), BASE = process.env.BASE || 'http://localhost:18810';
const NOMBRE = JSON.parse(fs.readFileSync(path.join(RAIZ, 'public/manifest.webmanifest'), 'utf8')).short_name;
const FUENTES = process.env.FUENTES ? fs.readFileSync(process.env.FUENTES, 'utf8') : '';
const LOGO = '<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#7c5cff"/><path d="M10 23V9h11M10 16h8" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="23" cy="21" r="2.6" fill="#ffc53d"/></svg>';
const PIEZAS = [
  { id: '1-hoy', t: 'Te digo cuánto puedes gastar hoy', s: 'Y vas viendo tu día en orden, sin enredos.', fondo: ['#7c5cff', '#5b3fd6'] },
  { id: '2-charla', t: 'Cuéntame un gasto y yo lo anoto', s: 'Escríbelo o dilo como le hablas a un amigo.', fondo: ['#ff7a59', '#e8590c'] },
  { id: '3-anillo', t: 'Mira en qué se va tu plata', s: 'Cada categoría con su color y su plan.', fondo: ['#19c3a0', '#0f8f75'] },
  { id: '4-pagos', t: 'Tus pagos, sin sorpresas', s: 'Calendario y avisos antes de que venzan.', fondo: ['#38bdf8', '#1c7ed6'] },
  { id: '5-historias', t: 'Tu mes contado en historias', s: 'Compártelo sin mostrar ni un peso.', fondo: ['#ff5c9a', '#d6336c'] },
  { id: '6-ahorro', t: 'Ahorra con retos y alcancía', s: 'Redondea tus gastos y reta a tus amigos.', fondo: ['#ffc53d', '#e0a420'], tinta: '#14121f' },
];

async function capturas(b) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await c.clock.setFixedTime(new Date('2026-11-27T13:20:00'));
  await c.addInitScript(() => { sessionStorage.setItem('fintelligente-acepto', JSON.stringify({ v: '1.0', edad: '18+', rep: false, ok: true })); localStorage.setItem('fintelligente-inicio', 'hecho'); localStorage.setItem('fintelligente-bienvenida', '1'); sessionStorage.setItem('fintelligente-sin-cuenta', '1'); localStorage.setItem('fintelligente-recordatorio', '2026-11-27');
    localStorage.setItem('fintelligente-retos', JSON.stringify([{ codigo: 'RETO-K7M2QX', pid: 'p1', token: 't'.repeat(32), tipo: 'domicilios', apodo: 'Caro' }])); });
  if (FUENTES) await c.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: FUENTES }));
  await c.route('**/api/retos', (r) => r.fulfill({ json: { tipo: 'domicilios', dias: 7, inicio: '2026-11-23', estado: 'activo', participantes: [{ apodo: 'Caro', cumplidos: 4, hoy: false, yo: true }, { apodo: 'Juan', cumplidos: 5, hoy: true, yo: false }, { apodo: 'Mafe', cumplidos: 3, hoy: true, yo: false }] } }));
  const p = await c.newPage();
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.evaluate(() => { const f = document.getElementById('f-letra'); f.checked = true; f.dispatchEvent(new Event('change')); f.checked = false; f.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    const K = Object.keys(localStorage).find((k) => /sin-cuenta$/.test(k)), S = JSON.parse(localStorage.getItem(K));
    S.ejemplo = false; S.titulo = 'Mi plata';
    const m = S.meses['2026-11']; m.gastos.forEach((g) => { if (!g.dia && g.cat !== 'ahorro') g.real = Math.round(g.plan * 0.78 / 1000) * 1000; });
    S.prefs.redondeo = true; S.prefs.diasPago = [15, 30]; S.alcancia = { '2026-11': { j: 23400, p: 0 } };
    S.porPagar.forEach((b) => { b.creado = '2026-10-01'; });
    S.logros = ['primer', 'racha7', 'ahorro20', 'cuentas2', 'pagos5', 'cero3'];
    const mv = (f, h, cat, c, v, com) => S.movs.push({ id: 'm' + S.movs.length, f, h, t: 'g', cat, c, m: v, com: com || '' });
    mv('2026-11-27', 7, 'transporte', 'Bus al trabajo', 2950); mv('2026-11-27', 9, 'alimentacion', 'Tinto y pandebono', 6500, 'Panadería'); mv('2026-11-27', 13, 'alimentacion', 'Almuerzo', 18000, 'Corrientazo');
    for (let d = 1; d < 27; d++) S.registros.push('2026-11-' + String(d).padStart(2, '0'));
    localStorage.setItem(K, JSON.stringify(S)); localStorage.setItem(K + '-t', String(Date.now() + 60000));
  });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  await p.evaluate(() => { const b = document.getElementById('nudge-cuenta-luego'); if (b && !document.getElementById('nudge-cuenta').hidden) b.click(); }); await p.waitForTimeout(300);
  const foto = async (id) => { await p.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.style.display = 'none'; }); await p.waitForTimeout(250); await p.screenshot({ path: path.join(SAL, 'pantallas', id + '.png') }); };
  fs.mkdirSync(path.join(SAL, 'pantallas'), { recursive: true });
  await p.evaluate(() => scrollTo(0, 0)); await foto('1-hoy');
  await p.evaluate(() => document.getElementById('hoy-registrar').click()); await p.waitForTimeout(400);
  await p.fill('#ch-input', 'almuerzo con Juan 36 mil, pagamos a medias'); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(500); await foto('2-charla');
  await p.evaluate(() => document.querySelector('#dlg-charla [data-close]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => { document.getElementById('h-donut').scrollIntoView({ block: 'start' }); scrollBy(0, -110); }); await p.waitForTimeout(500); await foto('3-anillo');
  await p.evaluate(() => document.querySelector('[data-tab="cuentas"], [data-goto="cuentas"]').click()); await p.waitForTimeout(500);
  await p.evaluate(() => { document.getElementById('h-porpagar').scrollIntoView({ block: 'start' }); scrollBy(0, -110); }); await p.waitForTimeout(400); await foto('4-pagos');
  await p.evaluate(() => document.getElementById('btn-historia-menu').click()); await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('hi-sig').click()); await p.waitForTimeout(2600); await foto('5-historias');
  await p.evaluate(() => document.getElementById('hi-cerrar').click()); await p.waitForTimeout(200);
  await p.evaluate(() => document.getElementById('btn-retos-menu').click()); await p.waitForTimeout(900);
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300); await foto('6-ahorro');
  await c.close();
}

async function armar(b) {
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const x of PIEZAS) {
    const img = 'data:image/png;base64,' + fs.readFileSync(path.join(SAL, 'pantallas', x.id + '.png')).toString('base64');
    await p.setContent(`<html><head><style>${FUENTES}
      body{margin:0;width:1080px;height:1920px;overflow:hidden;background:radial-gradient(120% 80% at 15% 0%,${x.fondo[0]},${x.fondo[1]});font-family:Manrope,sans-serif;color:${x.tinta || '#fff'}}
      .marca{position:absolute;top:84px;left:90px;display:flex;align-items:center;gap:18px;font:700 40px Unbounded,sans-serif}.marca svg{width:64px;height:64px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.2))}
      .cab{position:absolute;top:190px;left:90px;right:90px;display:grid;gap:22px}
      h1{margin:0;font:700 74px/1.08 Unbounded,sans-serif;letter-spacing:-.02em}
      p{margin:0;font:600 38px/1.35 Manrope,sans-serif;opacity:.92}
      .tel{position:absolute;left:150px;top:610px;width:780px;height:1688px;border-radius:84px;background:#14121f;padding:18px;box-sizing:border-box;box-shadow:0 40px 90px -30px rgba(0,0,0,.55)}
      .tel img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:68px;display:block}
    </style></head><body><div class="marca">${LOGO}<span>${NOMBRE}</span></div><div class="cab"><h1>${x.t}</h1><p>${x.s}</p></div><div class="tel"><img src="${img}"></div></body></html>`);
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(SAL, 'play-' + x.id + '.png') });
  }
  // Gráfico destacado (1024 × 500)
  const img = 'data:image/png;base64,' + fs.readFileSync(path.join(SAL, 'pantallas', '1-hoy.png')).toString('base64');
  await p.setViewportSize({ width: 1024, height: 500 });
  await p.setContent(`<html><head><style>${FUENTES}
    body{margin:0;width:1024px;height:500px;overflow:hidden;background:radial-gradient(120% 120% at 0% 0%,#9b82ff,#7c5cff 45%,#5b3fd6);font-family:Manrope,sans-serif;color:#fff;position:relative}
    .t{position:absolute;left:64px;top:118px;width:520px}.m{display:flex;align-items:center;gap:16px;font:700 44px Unbounded,sans-serif}.m svg{width:72px;height:72px;filter:drop-shadow(0 8px 16px rgba(0,0,0,.25))}
    h1{margin:26px 0 12px;font:700 40px/1.15 Unbounded,sans-serif;letter-spacing:-.01em}p{margin:0;font:600 22px/1.4 Manrope,sans-serif;opacity:.92}
    .tel{position:absolute;right:70px;top:46px;width:300px;height:650px;border-radius:40px;background:#14121f;padding:9px;box-sizing:border-box;transform:rotate(6deg);box-shadow:0 30px 60px -20px rgba(0,0,0,.5)}
    .tel img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:32px}
    .mon{position:absolute;width:56px;height:56px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3c4,#ffc53d 55%,#e0a420)}
  </style></head><body><div class="t"><div class="m">${LOGO}<span>${NOMBRE}</span></div><h1>Tu plata en orden, sin enredos</h1><p>Hoy puedes gastar, Cuéntame un gasto, pagos y metas. Tus cifras se quedan en tu celular.</p></div>
  <div class="mon" style="left:600px;top:60px"></div><div class="mon" style="left:560px;top:380px;width:36px;height:36px"></div><div class="tel"><img src="${img}"></div></body></html>`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(SAL, 'play-grafico-destacado-1024x500.png') });
  await p.close();
}

(async () => {
  const b = await chromium.launch();
  await capturas(b); await armar(b);
  await b.close(); console.log('listo:', NOMBRE, '→', SAL);
})();
