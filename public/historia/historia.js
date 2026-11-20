// Historia de bienvenida de Finti: se ve una sola vez, antes de la puerta de entrada.
// Escenas al compás (estilo historias), sonido hecho en el teléfono, vibración y, al final,
// cuatro tarjetas en 3D con los colores de las categorías más conocidas (sin logos ni nombres de marcas).
// Todo vive dentro de un Shadow DOM para no tocar los estilos de la app. Al terminar avisa con
// el evento "finti-historia-fin" y la app sigue con su puerta de siempre (fecha, términos, Google, correo, sin cuenta).
const CLAVE = 'fintelligente-historia', CLAVE_NOMBRE = 'fintelligente-nombre';
const host = document.createElement('div');
host.id = 'finti-historia';
host.style.cssText = 'position:fixed;inset:0;z-index:2147483000';
const raiz = host.attachShadow({ mode: 'open' });
raiz.innerHTML = '<style>' + "\n\n:host{color-scheme:dark;--azul:#2E5BFF;--azul2:#1630B8;--moneda:#FFC53D;--noche:#050714;--blanco:#FFFFFF;--px:0;--py:0}\n*{box-sizing:border-box;min-width:0;-webkit-tap-highlight-color:transparent}\n#marco{color:#fff;font:16px/1.5 \"Plus Jakarta Sans\",system-ui,sans-serif;overflow:hidden}\n#marco{position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(80% 60% at 50% 40%,#0b1440,#000)}\n#escenario{position:relative;width:100%;height:100%;overflow:hidden;background:var(--noche);touch-action:manipulation;user-select:none}\n@media(min-width:600px){#escenario{width:420px;height:min(880px,96dvh);border-radius:44px;box-shadow:0 40px 120px -30px rgba(46,91,255,.55),0 0 0 10px #0d0f18,0 0 0 11px #262a36}}\n.escena{position:absolute;inset:0;opacity:0;visibility:hidden;transition:opacity .45s ease,visibility 0s .45s}\n.escena.ver{opacity:1;visibility:visible;transition:opacity .45s ease}\n.capa{position:absolute;transform:translate3d(calc(var(--px)*var(--z,0)*1px),calc(var(--py)*var(--z,0)*1px),0);transition:transform .35s cubic-bezier(.2,.9,.25,1)}\n/* Barras de historia */\n#barras{position:absolute;left:14px;right:14px;top:max(14px,env(safe-area-inset-top));display:flex;gap:5px;z-index:20;opacity:0;transition:opacity .4s}\n#barras i{flex:1;height:3.5px;border-radius:2px;background:rgba(255,255,255,.28);overflow:hidden}\n#barras i b{display:block;height:100%;width:0;background:#fff}\n#sonido{position:absolute;right:12px;top:calc(max(14px,env(safe-area-inset-top)) + 14px);z-index:21;width:44px;height:44px;border-radius:22px;border:0;background:rgba(5,7,20,.28);color:#fff;display:grid;place-items:center;cursor:pointer;backdrop-filter:blur(10px)}\n#sonido svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}\nbutton:focus-visible{outline:3px solid var(--moneda);outline-offset:3px}\n/* Palabras gigantes que caen al ritmo */\n.grande{position:absolute;left:24px;right:20px;margin:0;font-weight:800;letter-spacing:-.055em;line-height:.9;font-size:clamp(64px,21vw,92px)}\n.pal{display:block;opacity:0;transform:translateY(40px) scale(1.25);filter:blur(8px)}\n.pal.on{animation:golpe .5s cubic-bezier(.2,1.4,.3,1) forwards}\n@keyframes golpe{to{opacity:1;transform:none;filter:none}}\n.sub{position:absolute;left:24px;right:24px;font-size:17px;font-weight:600;line-height:1.4;opacity:0;transform:translateY(16px);transition:opacity .5s,transform .5s cubic-bezier(.2,.9,.25,1)}\n.sub.on{opacity:.95;transform:none}\n/* Escena 0: empezar */\n#e0{background:radial-gradient(70% 50% at 50% 45%,#13207a 0%,var(--noche) 70%)}\n.orbe{left:50%;top:44%;width:220px;height:220px;margin:-110px 0 0 -110px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#7d98ff,#2E5BFF 45%,#0d1c80 100%);box-shadow:0 0 90px 10px rgba(46,91,255,.55),inset 0 -20px 40px rgba(0,0,0,.35);animation:late 2.2s ease-in-out infinite}\n@keyframes late{50%{transform:translate3d(calc(var(--px)*var(--z,0)*1px),calc(var(--py)*var(--z,0)*1px),0) scale(1.06)}}\n.aro{left:50%;top:44%;width:220px;height:220px;margin:-110px 0 0 -110px;border-radius:50%;border:2px solid rgba(125,152,255,.6);animation:aro 2.2s ease-out infinite}\n.aro.b{animation-delay:1.1s}\n@keyframes aro{from{transform:scale(1);opacity:.9}to{transform:scale(2.3);opacity:0}}\n#empezar{position:absolute;left:50%;bottom:calc(64px + env(safe-area-inset-bottom));transform:translateX(-50%);min-height:58px;padding:0 30px;border-radius:29px;border:0;background:#fff;color:var(--noche);font:800 17px \"Plus Jakarta Sans\",sans-serif;display:flex;align-items:center;gap:10px;cursor:pointer;white-space:nowrap;box-shadow:0 18px 40px -12px rgba(46,91,255,.8)}\n.marca{font-family:\"Unbounded\",\"Plus Jakarta Sans\",sans-serif;font-weight:700}\n#e0 .marca{position:absolute;left:0;right:0;top:calc(44% + 140px);text-align:center;font-size:40px}\n#e0 .lema{position:absolute;left:0;right:0;top:calc(44% + 196px);text-align:center;font-size:13px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;opacity:.75}\n/* Escena 1: azul */\n#e1{background:var(--azul)}\n#e1 .grande{top:22%;color:#fff}\n.disco{border-radius:50%}\n#e1 .moneda{right:-90px;bottom:-60px;width:330px;height:330px;background:radial-gradient(circle at 35% 30%,#FFE9A8,#FFC53D 45%,#D99A00 100%);box-shadow:inset -18px -24px 40px rgba(150,90,0,.45),inset 10px 12px 30px rgba(255,255,255,.45),0 30px 60px -20px rgba(0,0,0,.4)}\n#e1 .moneda::after{content:\"\";position:absolute;inset:34px;border-radius:50%;border:10px solid rgba(255,255,255,.35)}\n.anillos{left:50%;top:60%;width:10px;height:10px}\n.anillos span{position:absolute;left:50%;top:50%;border-radius:50%;border:2px solid rgba(255,255,255,.35);transform:translate(-50%,-50%) scale(var(--k,1));transition:transform .15s}\n#e1 .sub{top:calc(22% + 3 * 0.9 * clamp(64px,21vw,92px) + 22px);right:28%}\n/* Escena 2: moneda */\n#e2{background:var(--moneda);color:var(--noche)}\n#e2 .grande{top:16%;font-size:clamp(50px,15vw,68px);letter-spacing:-.05em}\n#cifra{position:absolute;left:22px;right:22px;top:58%;font-weight:800;font-size:clamp(66px,20vw,88px);letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap}\n#ecual{left:0;right:0;bottom:0;height:120px;display:flex;align-items:flex-end;gap:6px;padding:0 18px}\n#ecual i{flex:1;background:var(--noche);border-radius:8px 8px 0 0;height:20%;transition:height .18s cubic-bezier(.3,1.4,.5,1)}\n#e2 .sub{top:calc(58% + 96px)}\n/* Escena 3: noche con vidrio */\n#e3{background:radial-gradient(90% 60% at 70% 20%,#1c3bd6 0%,#0a1140 45%,var(--noche) 80%)}\n#e3 .grande{top:20%;color:#fff;font-size:clamp(56px,17vw,78px)}\n.vidrio{border-radius:28px;background:linear-gradient(135deg,rgba(255,255,255,.22),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.35);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 30px 60px -30px rgba(0,0,0,.6)}\n.haz{left:-40%;top:-10%;width:180%;height:120px;background:linear-gradient(90deg,transparent,rgba(125,152,255,.35),transparent);transform:rotate(-24deg);animation:haz 4s ease-in-out infinite;filter:blur(6px)}\n@keyframes haz{0%,100%{translate:-30% 0}50%{translate:30% 260px}}\n#e3 .sub{bottom:calc(70px + env(safe-area-inset-bottom))}\n/* Escena 4: las tarjetas en 3D */\n#e4{background:radial-gradient(80% 55% at 50% 38%,#1838d8 0%,#0b1660 42%,var(--noche) 78%)}\n#f3d{position:absolute;left:0;right:0;top:7%;height:46%;cursor:grab;touch-action:none}\n#nombre{position:absolute;left:50%;top:calc(53% + 26px);translate:-50% 0;width:min(78%,300px);min-height:48px;border-radius:24px;border:1.5px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;font:700 16px \"Plus Jakarta Sans\",sans-serif;text-align:center;padding:0 16px;outline:none;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}\n#nombre:focus{border-color:var(--moneda)}\n#nombre::placeholder{color:rgba(255,255,255,.55)}\n#f3d:active{cursor:grabbing}\n#f3d canvas{width:100%!important;height:100%!important;display:block}\n.giro-pista{position:absolute;left:0;right:0;top:53%;text-align:center;font-size:13px;font-weight:600;opacity:.6}\n#e4 .hola{position:absolute;left:24px;right:24px;top:calc(53% + 96px);margin:0;font-size:clamp(38px,11vw,48px);font-weight:800;letter-spacing:-.04em;line-height:1}\n#e4 .p{position:absolute;left:24px;right:24px;top:calc(53% + 150px);margin:0;font-size:17px;line-height:1.45;opacity:.85}\n.acciones{position:absolute;left:20px;right:20px;bottom:calc(26px + env(safe-area-inset-bottom));display:grid;gap:8px}\n.btn{min-height:58px;border-radius:29px;border:0;font:800 17px \"Plus Jakarta Sans\",sans-serif;cursor:pointer;transition:transform .3s cubic-bezier(.34,1.56,.64,1)}\n.btn:active{transform:scale(.96)}\n.btn.azul{background:var(--azul);color:#fff;box-shadow:0 16px 34px -14px rgba(46,91,255,.95)}\n.btn.blanco{background:#fff;color:var(--noche)}\n.btn.claro{background:transparent;color:#fff;min-height:46px;font-size:15px;font-weight:700;opacity:.85}\n.toque-onda{position:absolute;width:24px;height:24px;margin:-12px;border-radius:50%;border:2px solid rgba(255,255,255,.8);pointer-events:none;z-index:25;animation:onda .6s ease-out forwards}\n@keyframes onda{to{transform:scale(5);opacity:0}}\n@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.pal{opacity:1;transform:none;filter:none}.sub{opacity:.95;transform:none}}\n\n#saltar{position:absolute;left:12px;top:calc(max(14px,env(safe-area-inset-top)) + 14px);z-index:21;min-height:44px;padding:0 16px;border-radius:22px;border:0;background:rgba(5,7,20,.28);color:#fff;font:700 14px \"Plus Jakarta Sans\",sans-serif;cursor:pointer;backdrop-filter:blur(10px)}\n#marco{transition:opacity .45s ease}#marco.fuera{opacity:0}\n*{box-sizing:border-box}" + '</style>' + "<div id=\"marco\"><main id=\"escenario\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Bienvenida a Finti\">\n  <div id=\"barras\" aria-hidden=\"true\"><i><b></b></i><i><b></b></i><i><b></b></i><i><b></b></i></div>\n  <button id=\"saltar\" type=\"button\">Saltar</button>\n  <button id=\"sonido\" type=\"button\" aria-label=\"Silenciar\" aria-pressed=\"false\"><svg viewBox=\"0 0 24 24\"><path d=\"M4 9v6h4l5 4V5L8 9H4z\"/><path id=\"ondas\" d=\"M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11\"/></svg></button>\n\n  <section class=\"escena ver\" id=\"e0\" aria-label=\"Inicio\">\n    <div class=\"capa aro\" style=\"--z:6\"></div><div class=\"capa aro b\" style=\"--z:6\"></div>\n    <div class=\"capa orbe\" style=\"--z:14\"><svg viewBox=\"0 0 32 32\" aria-hidden=\"true\" style=\"position:absolute;inset:48px;width:124px;height:124px\"><path d=\"M10 23V9h11M10 16h8\" fill=\"none\" stroke=\"#fff\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"23\" cy=\"21\" r=\"2.6\" fill=\"#FFC53D\"/></svg></div>\n    <div class=\"marca\">Finti</div><div class=\"lema\">Tu amigo financiero</div>\n    <button id=\"empezar\" type=\"button\">Toca para empezar <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M9 5l7 7-7 7\"/></svg></button>\n  </section>\n\n  <section class=\"escena\" id=\"e1\" aria-label=\"Tu plata, por fin clara\">\n    <div class=\"capa anillos\" id=\"anillos\" style=\"--z:10\"></div>\n    <div class=\"capa disco moneda\" style=\"--z:28\"></div>\n    <h1 class=\"grande capa\" style=\"--z:-8\"><span class=\"pal\" data-b=\"1\">Tu plata,</span><span class=\"pal\" data-b=\"2\">por fin</span><span class=\"pal\" data-b=\"3\">clara.</span></h1>\n    <p class=\"sub\" data-b=\"5\">Te muestro en qué se va y cuánto te queda, sin hojas de cálculo.</p>\n  </section>\n\n  <section class=\"escena\" id=\"e2\" aria-label=\"Cada día te digo cuánto puedes gastar\">\n    <h1 class=\"grande capa\" style=\"--z:-6\"><span class=\"pal\" data-b=\"1\">Cada día</span><span class=\"pal\" data-b=\"2\">te digo</span><span class=\"pal\" data-b=\"3\">cuánto puedes</span><span class=\"pal\" data-b=\"4\">gastar.</span></h1>\n    <div id=\"cifra\" class=\"capa\" style=\"--z:12\" aria-live=\"off\">$ 0</div>\n    <p class=\"sub\" data-b=\"7\">Hoy puedes gastar, sin culpa.</p>\n    <div class=\"capa\" id=\"ecual\" style=\"--z:4\" aria-hidden=\"true\"></div>\n  </section>\n\n  <section class=\"escena\" id=\"e3\" aria-label=\"Sin claves del banco, sin regaños\">\n    <div class=\"capa haz\" style=\"--z:4\"></div>\n    <div class=\"capa vidrio\" style=\"--z:30;right:-40px;top:52%;width:240px;height:150px;rotate:-12deg\"></div>\n    <div class=\"capa vidrio\" style=\"--z:18;left:-30px;top:64%;width:200px;height:130px;rotate:9deg\"></div>\n    <div class=\"capa disco\" style=\"--z:40;right:60px;top:60%;width:70px;height:70px;background:radial-gradient(circle at 35% 30%,#FFE9A8,#FFC53D 45%,#D99A00);box-shadow:0 20px 40px -10px rgba(0,0,0,.6)\"></div>\n    <h1 class=\"grande capa\" style=\"--z:-6\"><span class=\"pal\" data-b=\"1\">Sin claves</span><span class=\"pal\" data-b=\"2\">del banco.</span><span class=\"pal\" data-b=\"4\">Sin regaños.</span></h1>\n    <p class=\"sub\" data-b=\"5\">Tus números se quedan contigo. Yo te propongo, tú decides.</p>\n  </section>\n\n  <section class=\"escena\" id=\"e4\" aria-label=\"Hola, soy Finti\">\n    <div id=\"f3d\" aria-label=\"Cuatro tarjetas en abanico: clásica, oro, platino y negra. Toca para pasar de tarjeta; arrastra para inclinarlas.\" role=\"img\"></div>\n        <div class=\"giro-pista\" aria-hidden=\"true\">Toca para pasar de tarjeta</div>\n    <input id=\"nombre\" type=\"text\" maxlength=\"22\" autocomplete=\"given-name\" placeholder=\"¿Cómo te llamas?\" aria-label=\"Tu nombre para las tarjetas\">\n    <h1 class=\"hola\">Hola, soy Finti.</h1>\n    <p class=\"p\">Todas tus tarjetas, claras en un solo lugar.</p>\n    <div class=\"acciones\"><button class=\"btn azul\" id=\"abrirHoja\" type=\"button\">Empezar</button><button class=\"btn claro\" id=\"otraVez\" type=\"button\">Ver de nuevo</button></div>\n  </section>\n\n</main></div>\n\n";
document.body.appendChild(host);
let cerrada = false;
function terminar(como) {
  if (cerrada) return; cerrada = true;
  const nombre = (raiz.querySelector('#nombre') || {}).value || '';
  try { localStorage.setItem(CLAVE, como === 'empezar' ? 'vista' : 'saltada'); if (nombre.trim()) localStorage.setItem(CLAVE_NOMBRE, nombre.trim().slice(0, 22)); } catch (e) {}
  try { if (api3D && api3D.detener) api3D.detener(); } catch (e) {}
  raiz.querySelector('#marco').classList.add('fuera');
  setTimeout(() => { try { if (ctx) ctx.close(); } catch (e) {} host.remove(); window.dispatchEvent(new CustomEvent('finti-historia-fin', { detail: { como } })); }, 460);
}

const $ = (s) => raiz.querySelector(s), E = $('#escenario');
const BPM = 112, PULSO = 60 / BPM;
const DUR = [0, 7, 10, 8];            // pulsos por escena (1 a 3); la 4 se queda
let escena = 0, t0 = 0, pausa = false, tPausa = 0, mudo = false, ctx = null, maestro = null, sigPulso = 0;
const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Sonido: todo sintetizado en el teléfono, sin archivos ---------- */
function audio() {
  if (ctx) return; try { ctx = new (window.AudioContext || window.webkitAudioContext)(); maestro = ctx.createGain(); maestro.gain.value = .55; maestro.connect(ctx.destination); } catch (e) { ctx = null; }
}
const ruido = () => { const b = ctx.createBuffer(1, ctx.sampleRate * .5, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
let bufRuido = null;
function bombo(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + .18); g.gain.setValueAtTime(.9, t); g.gain.exponentialRampToValueAtTime(.001, t + .32); o.connect(g).connect(maestro); o.start(t); o.stop(t + .35); }
function plato(t, v) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = bufRuido; f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .06); s.connect(f).connect(g).connect(maestro); s.start(t); s.stop(t + .08); }
function nota(t, fr, dur, v, tipo) { const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = tipo || 'triangle'; o.frequency.value = fr; f.type = 'lowpass'; f.frequency.value = 1800; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .04); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(f).connect(g).connect(maestro); o.start(t); o.stop(t + dur + .05); }
function moneda(t) { nota(t, 1318, .5, .22, 'sine'); nota(t + .07, 1975, .6, .16, 'sine'); }
function soplo(t) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = bufRuido; f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3500, t + .35); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.35, t + .15); g.gain.exponentialRampToValueAtTime(.001, t + .4); s.connect(f).connect(g).connect(maestro); s.start(t); s.stop(t + .45); }
const ACORDES = [[174.6, 220, 261.6, 392], [196, 246.9, 293.7, 440], [146.8, 220, 261.6, 349.2], [174.6, 220, 261.6, 392]];
function sonar(k, t) {
  if (!ctx || mudo) return;
  bombo(t); plato(t + PULSO / 2, .12);
  if (k % 4 === 0) ACORDES[escena % 4].forEach((fr) => nota(t, fr, PULSO * 3.6, .05));
}
const vibrar = (ms) => { try { if (!mudo && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

/* ---------- Historia: escenas que avanzan al compás ---------- */
const ahora = () => (ctx ? ctx.currentTime : performance.now() / 1000);
function ir(n) {
  escena = Math.max(1, Math.min(4, n)); t0 = ahora() + .05; sigPulso = 0;
  raiz.querySelectorAll('.escena').forEach((s, i) => s.classList.toggle('ver', i === escena));
  raiz.querySelectorAll('.pal,.sub').forEach((p) => p.classList.remove('on'));
  if (ctx && !mudo) soplo(ahora());
  if (escena === 2) $('#cifra').textContent = '$ 0';
  if (escena === 4) { $('#barras').style.opacity = '.0'; arrancar3D(); } else $('#barras').style.opacity = '1';
  pintarBarras(0);
}
function pintarBarras(frac) {
  raiz.querySelectorAll('#barras b').forEach((b, i) => { const n = i + 1; b.style.width = (n < escena ? 100 : n === escena ? Math.min(100, frac * 100) : 0) + '%'; });
}
const ecual = $('#ecual'); for (let i = 0; i < 14; i++) ecual.appendChild(document.createElement('i'));
const anillos = $('#anillos'); for (let i = 1; i <= 5; i++) { const s = document.createElement('span'); s.style.width = s.style.height = i * 120 + 'px'; anillos.appendChild(s); }
function alPulso(k) {
  const sec = raiz.querySelectorAll('.escena')[escena];
  sec.querySelectorAll('[data-b="' + k + '"]').forEach((p) => { p.classList.add('on'); vibrar(12); });
  anillos.querySelectorAll('span').forEach((s, i) => { s.style.setProperty('--k', 1.08); setTimeout(() => s.style.setProperty('--k', 1), 120 + i * 30); });
  ecual.querySelectorAll('i').forEach((b) => (b.style.height = 15 + Math.random() * 85 + '%'));
  if (escena === 2 && k === 5) contar(53000);
  if (escena === 2 && k === 5 && ctx && !mudo) moneda(ahora());
}
function contar(fin) {
  const ini = performance.now(), d = reducir ? 1 : 900;
  const paso = (t) => { const p = Math.min(1, (t - ini) / d), v = Math.round(fin * (1 - Math.pow(1 - p, 3)) / 100) * 100; $('#cifra').textContent = '$ ' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); if (p < 1) requestAnimationFrame(paso); };
  requestAnimationFrame(paso);
}
function bucle() {
  if (cerrada) return;
  if (escena >= 1 && escena <= 3 && !pausa) {
    const t = ahora() - t0, k = Math.floor(t / PULSO);
    while (sigPulso <= k) { alPulso(sigPulso); if (ctx) sonar(sigPulso, t0 + sigPulso * PULSO + .02); sigPulso++; }
    pintarBarras(t / (DUR[escena] * PULSO));
    if (t > DUR[escena] * PULSO) ir(escena + 1);
  }
  requestAnimationFrame(bucle);
}
requestAnimationFrame(bucle);

/* ---------- Toques: avanzar, volver, mantener para pausar, y capas con profundidad ---------- */
let abajo = 0;
E.addEventListener('pointermove', (e) => { const r = E.getBoundingClientRect(); E.style.setProperty('--px', ((e.clientX - r.left) / r.width - .5) * 2); E.style.setProperty('--py', ((e.clientY - r.top) / r.height - .5) * 2); });
E.addEventListener('pointerleave', () => { E.style.setProperty('--px', 0); E.style.setProperty('--py', 0); });
E.addEventListener('pointerdown', (e) => { abajo = performance.now(); if (escena >= 1 && escena <= 3 && !e.target.closest('button')) { pausa = true; tPausa = ahora(); } });
E.addEventListener('pointerup', (e) => {
  if (escena < 1 || escena > 3 || e.target.closest('button')) return;
  const largo = performance.now() - abajo > 350; if (pausa) { t0 += ahora() - tPausa; pausa = false; }
  const r = E.getBoundingClientRect(), o = document.createElement('span'); o.className = 'toque-onda'; o.style.left = e.clientX - r.left + 'px'; o.style.top = e.clientY - r.top + 'px'; E.appendChild(o); setTimeout(() => o.remove(), 650);
  if (largo) return; vibrar(8);
  if (e.clientX - r.left < r.width / 3) ir(escena - 1); else ir(escena + 1);
});
$('#empezar').addEventListener('click', () => { audio(); if (ctx) { bufRuido = ruido(); ctx.resume && ctx.resume(); moneda(ctx.currentTime); } vibrar(20); ir(1); });
$('#sonido').addEventListener('click', (e) => { e.stopPropagation(); mudo = !mudo; $('#sonido').setAttribute('aria-pressed', String(mudo)); $('#sonido').setAttribute('aria-label', mudo ? 'Activar sonido' : 'Silenciar'); $('#ondas').style.display = mudo ? 'none' : ''; });
$('#otraVez').addEventListener('click', () => ir(1));
$('#abrirHoja').addEventListener('click', () => terminar('empezar'));
$('#saltar').addEventListener('click', () => terminar('saltar'));
E.addEventListener('keydown', (e) => { if (e.key === 'Escape') terminar('saltar'); });

/* ---------- Las tarjetas en 3D (three.js) ---------- */
let listo3D = false;
let api3D = null;
function arrancar3D() {
  if (listo3D) { if (api3D) api3D.entrar(); return; }
  listo3D = true;
  document.fonts.ready.then(() => import(new URL('./tarjetas3d.js', import.meta.url).href)).then((m) => {
    api3D = m.montar($('#f3d'), {
      // Cada tarjeta que sale suena un poco más agudo, como un abanico que se abre
      carta(n) { if (ctx && !mudo) { nota(ahora(), 392 * Math.pow(1.26, n - 1), .35, .09, 'sine'); if (n === 1) soplo(ahora()); } vibrar(10); },
      barajar() { if (ctx && !mudo) { soplo(ahora()); nota(ahora() + .05, 784, .25, .06, 'sine'); } vibrar(14); },
    });
    const v = $('#nombre').value; if (v) api3D.nombre(v);
  }).catch(() => {});
}
let tNombre = 0;
$('#nombre').addEventListener('input', (e) => { const v = e.target.value; clearTimeout(tNombre); tNombre = setTimeout(() => api3D && api3D.nombre(v), 80); });   // el valor se lee ya: dentro de un Shadow DOM, después del evento e.target pasa a ser el contenedor

setTimeout(() => { try { $('#empezar').focus(); } catch (e) {} }, 50);
