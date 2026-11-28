// El sol de Finti en 3D (28 de noviembre de 2026): el punto de la F grande de Inicio hecho astro.
// De día es un sol que respira con sus rayos; de noche, la luna con su brillo azul. Lo decide la banda
// (clases .dia y .noche, que pone fuente/logica/30-…). Se inclina con el teléfono y se detiene cuando no se ve.
// Lo carga fuente/logica/62-el-sol-de-finti-en-3d.js; si algo falla, queda el sol de siempre (CSS).
import * as THREE from './three.module.min.js';

export function iniciar(lienzo, banda) {
  const W = lienzo.clientWidth || 150, H = lienzo.clientHeight || 150;
  const r = new THREE.WebGLRenderer({ canvas: lienzo, alpha: true, antialias: true, powerPreference: 'low-power' });
  r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(W, H, false); r.outputColorSpace = THREE.SRGBColorSpace;
  const escena = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, W / H, .1, 50); cam.position.set(0, 0, 12);
  const textura = (dibuja, w = 512, h = 256) => { const c = document.createElement('canvas'); c.width = w; c.height = h; dibuja(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  // Semilla fija: el sol se ve igual cada vez
  let semilla = 7; const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
  const piel = textura((g, w, h) => { g.fillStyle = '#FFB21F'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 2600; k++) { const x = azar() * w, y = azar() * h, rr = 2 + azar() * 9, gr = g.createRadialGradient(x, y, 0, x, y, rr), cl = azar() < .5 ? '255,236,150' : '232,120,10';
      gr.addColorStop(0, `rgba(${cl},.55)`); gr.addColorStop(1, `rgba(${cl},0)`); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); } });
  const lunaPiel = textura((g, w, h) => { g.fillStyle = '#C9D2E8'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 90; k++) { const x = azar() * w, y = azar() * h, rr = 4 + azar() * 18; g.fillStyle = 'rgba(90,100,140,.28)'; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.arc(x - rr * .25, y - rr * .25, rr * .7, 0, 7); g.fill(); } });
  const rayoTex = textura((g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,210,90,.95)'); gr.addColorStop(1, 'rgba(255,170,40,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(w * .2, h); g.quadraticCurveTo(w / 2, 0, w * .8, h); g.fill(); }, 64, 256);

  const sol = new THREE.Group(); escena.add(sol);
  const bola = new THREE.Mesh(new THREE.SphereGeometry(1.15, 48, 32), new THREE.MeshBasicMaterial({ map: piel })); sol.add(bola);
  const rayos = new THREE.Group(); sol.add(rayos);
  for (let k = 0; k < 12; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.55, 1.4), new THREE.MeshBasicMaterial({ map: rayoTex, transparent: true, depthWrite: false }));
    const a = k / 12 * Math.PI * 2; m.position.set(Math.cos(a) * 1.75, Math.sin(a) * 1.75, -.1); m.rotation.z = a - Math.PI / 2; m.userData.f = k; rayos.add(m);
  }
  const noche = new THREE.Group(); escena.add(noche);
  const luna = new THREE.Mesh(new THREE.SphereGeometry(1.05, 48, 32), new THREE.MeshStandardMaterial({ map: lunaPiel, roughness: .9, metalness: 0 })); noche.add(luna);
  const luz = new THREE.DirectionalLight(0xffffff, 3.2); luz.position.set(-3, 2, 4); escena.add(luz); escena.add(new THREE.AmbientLight(0x3a4a90, 1.4));

  const esNoche = () => banda.classList.contains('noche');
  let mezcla = esNoche() ? 1 : 0;
  const brillo = () => { lienzo.style.filter = esNoche() ? 'drop-shadow(0 0 14px rgba(170,190,255,.55)) drop-shadow(0 0 34px rgba(110,140,255,.3))' : 'drop-shadow(0 0 14px rgba(255,190,60,.6)) drop-shadow(0 0 36px rgba(255,150,40,.32))'; };
  brillo(); new MutationObserver(brillo).observe(banda, { attributes: true, attributeFilter: ['class'] });

  // Inclinación con el teléfono (Android la da sin permiso; si no hay, se mueve solo y suave)
  let ox = 0, oy = 0, tx = 0, ty = 0;
  addEventListener('deviceorientation', (e) => { if (e.gamma != null) { ox = Math.max(-1, Math.min(1, e.gamma / 30)); oy = Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 30)); } }, { passive: true });

  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = true, corriendo = false, t0 = performance.now();
  const pintar = (t) => {
    const s = quieto ? 2 : (t - t0) / 1000;
    tx += (ox - tx) * .06; ty += (oy - ty) * .06;
    mezcla += ((esNoche() ? 1 : 0) - mezcla) * (quieto ? 1 : .05);
    const dia = 1 - mezcla, e = 1 - Math.pow(1 - Math.min(1, s / 1.2), 3);
    sol.scale.setScalar(Math.max(.001, dia * (.6 + .4 * e) * (1 + Math.sin(s * 1.6) * .03)));
    sol.position.y = -mezcla * 3 + (1 - e) * -1.2;
    bola.rotation.y = s * .15; rayos.rotation.z = s * .12;
    rayos.children.forEach((m) => m.scale.set(1, 1 + Math.sin(s * 2.2 + m.userData.f * 1.3) * .18, 1));
    noche.scale.setScalar(Math.max(.001, mezcla)); noche.position.y = (1 - mezcla) * 3; luna.rotation.y = s * .08;
    escena.rotation.y = tx * .35 + Math.sin(s * .4) * .06; escena.rotation.x = ty * .25;
    r.render(escena, cam);
  };
  const bucle = (t) => { if (!visible || document.hidden || quieto) { corriendo = false; return; } pintar(t); requestAnimationFrame(bucle); };
  const seguir = () => { if (!corriendo && visible && !document.hidden && !quieto) { corriendo = true; requestAnimationFrame(bucle); } };
  try { new IntersectionObserver((l) => { visible = l[0].isIntersecting; seguir(); }).observe(lienzo); } catch (e) {}
  document.addEventListener('visibilitychange', seguir);
  if (quieto) { pintar(performance.now()); new MutationObserver(() => pintar(performance.now())).observe(banda, { attributes: true, attributeFilter: ['class'] }); }
  pintar(performance.now()); seguir();
  return { pintar };
}
