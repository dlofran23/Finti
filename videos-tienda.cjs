// Videos cortos verticales (1080 × 1920, 30 cuadros por segundo) para redes: se filma la app con datos de muestra
// y se arma con titular, celular y cierre con el logo. Igual que material-tienda.cjs, toma el nombre del manifiesto.
// Uso: servidor de pruebas en BASE y luego  BASE=… FUENTES=… node herramientas/videos-tienda.cjs
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..'), SAL = path.join(RAIZ, 'material-tienda'), TMP = '/tmp/videos-tienda', BASE = process.env.BASE || 'http://localhost:18810';
const NOMBRE = JSON.parse(fs.readFileSync(path.join(RAIZ, 'public/manifest.webmanifest'), 'utf8')).short_name;
const FUENTES = process.env.FUENTES ? fs.readFileSync(process.env.FUENTES, 'utf8') : '';
const LOGO = '<svg viewBox="0 0 32 32"><defs><radialGradient id="lg" cx="20%" cy="10%" r="120%"><stop offset="0" stop-color="#5c84ff"/><stop offset=".45" stop-color="#2e5bff"/><stop offset="1" stop-color="#1630b8"/></radialGradient></defs><rect width="32" height="32" rx="9" fill="url(#lg)"/><path d="M10 23V9h11M10 16h8" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="23" cy="21" r="2.6" fill="#ffc53d"/></svg>';
const PANT = { x: 168, y: 628, w: 744, h: 1610 };   // dónde va la pantalla dentro del cuadro

async function preparar(b) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true, locale: 'es-CO', timezoneId: 'America/Bogota' });
  await c.clock.setFixedTime(new Date('2026-11-27T13:20:00'));
  await c.addInitScript(() => { sessionStorage.setItem('fintelligente-acepto', JSON.stringify({ v: '1.2', edad: '18+', rep: false, ok: true })); localStorage.setItem('fintelligente-inicio', 'hecho'); localStorage.setItem('fintelligente-bienvenida', '1'); sessionStorage.setItem('fintelligente-sin-cuenta', '1'); localStorage.setItem('fintelligente-recordatorio', '2026-11-27'); });
  if (FUENTES) await c.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: FUENTES }));
  const p = await c.newPage();
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.evaluate(() => { const f = document.getElementById('f-letra'); f.checked = true; f.dispatchEvent(new Event('change')); f.checked = false; f.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    const K = Object.keys(localStorage).find((k) => /sin-cuenta$/.test(k)), S = JSON.parse(localStorage.getItem(K));
    S.ejemplo = false; S.titulo = 'Mi plata';
    S.meses['2026-11'].gastos.forEach((g) => { if (!g.dia && g.cat !== 'ahorro') g.real = Math.round(g.plan * 0.78 / 1000) * 1000; });
    S.porPagar.forEach((x) => { x.creado = '2026-10-01'; }); S.prefs.diasPago = [15, 30];
    S.movs.push({ id: 'a1', f: '2026-11-27', h: 7, t: 'g', cat: 'transporte', c: 'Bus al trabajo', m: 2950, com: '' });
    for (let d = 1; d < 27; d++) S.registros.push('2026-11-' + String(d).padStart(2, '0'));
    localStorage.setItem(K, JSON.stringify(S)); localStorage.setItem(K + '-t', String(Date.now() + 60000));
  });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1000);
  await p.evaluate(() => { const b = document.getElementById('nudge-cuenta-luego'); if (b && !document.getElementById('nudge-cuenta').hidden) b.click(); const t = document.getElementById('toasts'); if (t) t.style.visibility = 'hidden'; });
  await p.waitForTimeout(400);
  return p;
}

// Filma la página con el screencast de Chrome (JPEG 92) y arma un video de la pantalla a 30 cuadros por segundo
async function filmar(p, nombre, guion) {
  const dir = path.join(TMP, nombre); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cdp = await p.context().newCDPSession(p), cuadros = [];
  cdp.on('Page.screencastFrame', async (f) => { const n = cuadros.length; fs.writeFileSync(path.join(dir, String(n).padStart(5, '0') + '.jpg'), Buffer.from(f.data, 'base64')); cuadros.push(f.metadata.timestamp); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 975, maxHeight: 2110, everyNthFrame: 1 });
  await p.waitForTimeout(400); await guion(p); await p.waitForTimeout(300);
  await cdp.send('Page.stopScreencast'); await p.waitForTimeout(200);
  let lista = 'ffconcat version 1.0\n';
  cuadros.forEach((t, i) => { const d = i < cuadros.length - 1 ? Math.max(0.001, cuadros[i + 1] - t) : 0.5; lista += `file ${String(i).padStart(5, '0')}.jpg\nduration ${d.toFixed(4)}\n`; });
  lista += `file ${String(cuadros.length - 1).padStart(5, '0')}.jpg\n`;
  fs.writeFileSync(path.join(dir, 'lista.txt'), lista);
  const sal = path.join(TMP, nombre + '-pantalla.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'lista.txt'), '-vf', `scale=${PANT.w}:${PANT.h}:flags=lanczos,fps=30,format=yuv420p`, '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', sal]);
  return { sal, dur: cuadros[cuadros.length - 1] - cuadros[0] + 0.5 };
}

async function piezas(b, nombre, titulo, sub, fondo) {
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const css = `${FUENTES} body{margin:0;width:1080px;height:1920px;overflow:hidden;font-family:Manrope,sans-serif;color:#fff;background:radial-gradient(120% 80% at 15% 0%,${fondo[0]},${fondo[1]})}`;
  await p.setContent(`<html><head><style>${css}
    .marca{position:absolute;top:84px;left:90px;display:flex;align-items:center;gap:18px;font:700 40px Unbounded,sans-serif}.marca svg{width:64px;height:64px}
    .cab{position:absolute;top:190px;left:90px;right:90px;display:grid;gap:22px}h1{margin:0;font:700 74px/1.08 Unbounded,sans-serif;letter-spacing:-.02em}p{margin:0;font:600 38px/1.35 Manrope,sans-serif;opacity:.92}
    .tel{position:absolute;left:${PANT.x - 18}px;top:${PANT.y - 18}px;width:${PANT.w + 36}px;height:1688px;border-radius:84px;background:#09090b;box-shadow:0 40px 90px -30px rgba(0,0,0,.55)}
  </style></head><body><div class="marca">${LOGO}<span>${NOMBRE}</span></div><div class="cab"><h1>${titulo}</h1><p>${sub}</p></div><div class="tel"></div></body></html>`);
  await p.waitForTimeout(200); await p.screenshot({ path: path.join(TMP, nombre + '-fondo.png') });
  // Máscara de esquinas redondeadas para la pantalla
  await p.setViewportSize({ width: PANT.w, height: PANT.h });
  await p.setContent(`<html><body style="margin:0;background:#000"><div style="width:${PANT.w}px;height:${PANT.h}px;border-radius:68px;background:#fff"></div></body></html>`);
  await p.screenshot({ path: path.join(TMP, 'mascara.png') });
  // Cierre
  await p.setViewportSize({ width: 1080, height: 1920 });
  await p.setContent(`<html><head><style>${css} body{display:grid;place-items:center;text-align:center;background:radial-gradient(120% 80% at 50% 20%,#4a74ff,#2e5bff 50%,#1838b8)}
    .c{display:grid;gap:34px;justify-items:center}.c svg{width:260px;height:260px;filter:drop-shadow(0 30px 50px rgba(0,0,0,.3))}b{font:700 96px Unbounded,sans-serif}span{font:600 44px/1.35 Manrope,sans-serif;max-width:820px;opacity:.95}
  </style></head><body><div class="c">${LOGO}<b>${NOMBRE}</b><span>Tu plata en orden, sin enredos. Gratis para Android y en la web.</span></div></body></html>`);
  await p.waitForTimeout(200); await p.screenshot({ path: path.join(TMP, 'cierre.png') });
  await p.close();
}

function armar(nombre, dur) {
  const tmp = path.join(SAL, nombre + '.tmp.mp4'), fin = path.join(SAL, nombre + '.mp4'), CIERRE = 2.6, FUNDIDO = 0.5;
  const filtro = `[1:v][2:v]alphamerge[pa];[0:v][pa]overlay=${PANT.x}:${PANT.y}:shortest=1,fps=30,format=yuv420p,setsar=1[a];` +
    `[3:v]format=yuv420p,loop=-1:1,trim=duration=${CIERRE},fps=30,setsar=1[c];[a][c]xfade=transition=fade:duration=${FUNDIDO}:offset=${(dur - FUNDIDO).toFixed(2)},format=yuv420p[v]`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', String(dur), '-i', path.join(TMP, nombre + '-fondo.png'),
    '-i', path.join(TMP, nombre + '-pantalla.mp4'), '-loop', '1', '-framerate', '30', '-t', String(dur), '-i', path.join(TMP, 'mascara.png'), '-framerate', '30', '-i', path.join(TMP, 'cierre.png'),
    '-filter_complex', filtro, '-map', '[v]', '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmp]);
  fs.renameSync(tmp, fin); return fin;
}

const escribir = async (p, sel, txt) => { for (const ch of txt) { await p.type(sel, ch); await p.waitForTimeout(55); } };
const VIDEOS = [
  { id: 'video-cuentame-un-gasto', t: 'Cuéntame un gasto y yo lo anoto', s: 'Así de fácil, sin llenar formularios.', fondo: ['#1c1c22', '#09090b'],
    guion: async (p) => {
      await p.waitForTimeout(1200);
      await p.evaluate(() => document.getElementById('hoy-registrar').click()); await p.waitForTimeout(1300);
      await escribir(p, '#ch-input', 'almuerzo 18 mil'); await p.waitForTimeout(500);
      await p.press('#ch-input', 'Enter'); await p.waitForTimeout(1800);
      // Elegir con qué se pagó ya lo anota (un solo toque)
      await p.click('#ch-chips [data-ch^="cuenta"]'); await p.waitForTimeout(2200);
      await p.evaluate(() => document.querySelector('#dlg-charla [data-close]').click()); await p.waitForTimeout(2600);
    } },
  { id: 'video-tu-mes-contado', t: 'Tu mes contado en historias', s: 'Y lo compartes sin mostrar ni un peso.', fondo: ['#4a74ff', '#1838b8'],
    guion: async (p) => {
      await p.evaluate(() => document.getElementById('btn-historia-menu').click()); await p.waitForTimeout(2300);
      for (let i = 0; i < 5; i++) { await p.evaluate(() => document.getElementById('hi-sig').click()); await p.waitForTimeout(2300); }
    } },
];

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const b = await chromium.launch();
  for (const v of VIDEOS) {
    const p = await preparar(b);
    const r = await filmar(p, v.id, v.guion);
    await p.context().close();
    await piezas(b, v.id, v.t, v.s, v.fondo);
    console.log(armar(v.id, r.dur), Math.round(r.dur) + ' s');
  }
  await b.close();
})();
