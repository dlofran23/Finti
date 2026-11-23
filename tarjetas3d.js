// Cierre de la entrada: cuatro tarjetas en abanico con los colores de las categorías más conocidas
// (clásica azul, oro, platino y negra). Sin logos ni nombres de franquicias ni bancos: solo el color.
// Un toque pasa la tarjeta de adelante al fondo; el dedo inclina el abanico; el nombre se escribe en vivo.
import * as THREE from './three.module.min.js';

const W = 2.0, H = W / 1.586, RAD = 0.13;          // horizontal, proporción real de una tarjeta
const TIPOS = [
  { id: 'clasica', nombre: 'Clásica', g: ['#2a4bf0', '#1434cb', '#0b1a6e'], texto: '#ffffff', suave: 'rgba(255,255,255,.7)', canto: 0x9fb0ff, metal: 0.15, rugo: 0.42, brillo: 0.5 },
  { id: 'oro', nombre: 'Oro', g: ['#f8dc8e', '#d9a944', '#8f6316'], texto: '#2a1c00', suave: 'rgba(42,28,0,.65)', canto: 0xe2b453, metal: 0.55, rugo: 0.32, brillo: 0.38 },
  { id: 'platino', nombre: 'Platino', g: ['#f2f4f7', '#bcc3cd', '#7f8896'], texto: '#151a24', suave: 'rgba(21,26,36,.62)', canto: 0xd5dae2, metal: 0.6, rugo: 0.28, brillo: 0.36, iris: 0.35 },
  { id: 'negra', nombre: 'Black', g: ['#2b2c33', '#141418', '#050507'], texto: '#ffffff', suave: 'rgba(255,255,255,.6)', canto: 0x3a3b44, metal: 0.3, rugo: 0.55, brillo: 0.45 },
];

function rectRedondo(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function uvPlano(geo) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + W / 2) / W, (p.getY(i) + H / 2) / H);
  uv.needsUpdate = true; return geo;
}
function grano(g, w, h, alfa) {
  const d = g.getImageData(0, 0, w, h), a = d.data;
  for (let i = 0; i < a.length; i += 4) { const n = (Math.random() - 0.5) * 255 * alfa; a[i] += n; a[i + 1] += n; a[i + 2] += n; }
  g.putImageData(d, 0, 0);
}
// Chip genérico de contacto
function chip(g, x, y) {
  const w = 132, h = 100, gr = g.createLinearGradient(x, y, x + w, y + h);
  gr.addColorStop(0, '#f6e2a6'); gr.addColorStop(0.5, '#cfa64a'); gr.addColorStop(1, '#f2d98f');
  g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, w, h, 18); g.fill();
  g.strokeStyle = 'rgba(90,60,0,.45)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(x, y + h / 3); g.lineTo(x + w * .35, y + h / 3); g.moveTo(x, y + h * 2 / 3); g.lineTo(x + w * .35, y + h * 2 / 3);
  g.moveTo(x + w, y + h / 3); g.lineTo(x + w * .65, y + h / 3); g.moveTo(x + w, y + h * 2 / 3); g.lineTo(x + w * .65, y + h * 2 / 3);
  g.roundRect(x + w * .35, y + h * .2, w * .3, h * .6, 10); g.stroke();
}

function cara(tipo, nombre) {
  const w = 1024, h = Math.round(1024 / 1.586), c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, tipo.g[0]); gr.addColorStop(0.5, tipo.g[1]); gr.addColorStop(1, tipo.g[2]);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // Guilloché: arcos finos como en las tarjetas de lujo
  g.lineWidth = 2;
  const claro = tipo.texto === '#ffffff';
  for (let i = 0; i < 40; i++) { g.strokeStyle = claro ? `rgba(255,255,255,${i % 3 ? 0.04 : 0.07})` : `rgba(0,0,0,${i % 3 ? 0.04 : 0.07})`; g.beginPath(); g.arc(w * 1.02, h * 1.1, 90 + i * 20, Math.PI, Math.PI * 1.5); g.stroke(); }
  // Banda de luz diagonal
  const b = g.createLinearGradient(0, 0, w, h);
  b.addColorStop(0.25, 'rgba(255,255,255,0)'); b.addColorStop(0.42, 'rgba(255,255,255,0.14)'); b.addColorStop(0.58, 'rgba(255,255,255,0)');
  g.fillStyle = b; g.fillRect(0, 0, w, h);
  grano(g, w, h, tipo.id === 'negra' ? 0.08 : 0.04);
  chip(g, 80, 200);
  g.fillStyle = tipo.texto; g.textAlign = 'right'; g.font = '800 54px "Plus Jakarta Sans", sans-serif';
  g.fillText(tipo.nombre, w - 72, 110);
  g.textAlign = 'left';
  const n = ((nombre || '').trim() || 'Tu nombre').toUpperCase();
  let tam = 52; g.font = `700 ${tam}px "Plus Jakarta Sans", sans-serif`;
  while (g.measureText(n).width > w - 160 && tam > 30) { tam -= 2; g.font = `700 ${tam}px "Plus Jakarta Sans", sans-serif`; }
  g.globalAlpha = (nombre || '').trim() ? 1 : 0.6; g.fillText(n, 80, h - 80); g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function estudio(render) {
  const e = new THREE.Scene(); e.background = new THREE.Color(0x03050d);
  const caja = (w, h, color, f, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(f), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); e.add(m); };
  caja(14, 5, 0xffffff, 4.0, 0, 9, 4); caja(3, 12, 0x9fb4ff, 3, -10, 1, 3); caja(3, 10, 0xffe0a8, 2.2, 10, -1, 4); caja(10, 3, 0xffffff, 1.3, 0, -2, 12); caja(16, 6, 0x2e5bff, 1.0, 0, -8, -2);
  const pm = new THREE.PMREMGenerator(render), tex = pm.fromScene(e, 0.02).texture; pm.dispose(); return tex;
}

export function montar(caja, op = {}) {
  const render = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  render.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  render.outputColorSpace = THREE.SRGBColorSpace; render.toneMapping = THREE.NeutralToneMapping; render.toneMappingExposure = 1.05;
  caja.appendChild(render.domElement);
  const escena = new THREE.Scene(); escena.environment = estudio(render);
  const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const ajustar = () => {
    const w = caja.clientWidth || 1, h = caja.clientHeight || 1; render.setSize(w, h, false); camara.aspect = w / h;
    const alto = Math.max(3.75 / camara.aspect, 3.4);
    camara.position.set(0, 0.25, alto / (2 * Math.tan(camara.fov * Math.PI / 360))); camara.lookAt(0, 0.05, 0); camara.updateProjectionMatrix();
  };
  new ResizeObserver(ajustar).observe(caja); ajustar();

  const forma = rectRedondo(W, H, RAD);
  const cuerpoGeo = new THREE.ExtrudeGeometry(forma, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 3, curveSegments: 16 });
  cuerpoGeo.translate(0, 0, -0.012);
  const caraGeo = uvPlano(new THREE.ShapeGeometry(forma, 16));

  const abanico = new THREE.Group(); escena.add(abanico);
  const tarjetas = TIPOS.map((tipo) => {
    const tex = cara(tipo, '');
    const mat = new THREE.MeshPhysicalMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: tipo.brillo, metalness: tipo.metal, roughness: tipo.rugo, clearcoat: 0.7, clearcoatRoughness: 0.06, iridescence: tipo.iris || 0, iridescenceThicknessRange: [300, 700], envMapIntensity: 0.8 });
    const atras = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(tipo.g[2]), metalness: tipo.metal, roughness: 0.5 });
    const grupo = new THREE.Group();
    grupo.add(new THREE.Mesh(cuerpoGeo, new THREE.MeshPhysicalMaterial({ color: tipo.canto, metalness: 1, roughness: 0.25 })));
    const f = new THREE.Mesh(caraGeo, mat); f.position.z = 0.0225; grupo.add(f);
    const a = new THREE.Mesh(caraGeo, atras); a.position.z = -0.0225; a.rotation.y = Math.PI; grupo.add(a);
    abanico.add(grupo);
    return { tipo, grupo, mat, pos: new THREE.Vector3(0, -3, 0), rot: 0, salto: 0 };
  });

  // Puestos del abanico: 0 es la de adelante
  const PUESTOS = [
    { x: 0, y: -0.28, z: 0.3, r: 0 },
    { x: -0.5, y: 0.02, z: 0.1, r: 0.13 },
    { x: 0.5, y: 0.14, z: -0.1, r: -0.12 },
    { x: 0, y: 0.42, z: -0.3, r: 0.03 },
  ];
  let orden = [0, 1, 2, 3];   // orden[k] = tarjeta en el puesto k

  // Sombra suave debajo
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const gg = c.getContext('2d'), gr = gg.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,3,20,.6)'); gr.addColorStop(1, 'rgba(0,3,20,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128);
  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.set(0, -1.15, 0); escena.add(sombra);

  // Dedo: arrastrar inclina, tocar baraja
  let offY = 0, velY = 0, offX = 0, velX = 0, arrastra = false, ux = 0, uy = 0, movido = 0;
  caja.addEventListener('pointerdown', (e) => { arrastra = true; movido = 0; ux = e.clientX; uy = e.clientY; caja.setPointerCapture(e.pointerId); });
  caja.addEventListener('pointermove', (e) => {
    if (!arrastra) return; const dx = e.clientX - ux, dy = e.clientY - uy; movido += Math.abs(dx) + Math.abs(dy);
    offY = Math.max(-0.9, Math.min(0.9, offY + dx * 0.008)); offX = Math.max(-0.6, Math.min(0.6, offX + dy * 0.006)); ux = e.clientX; uy = e.clientY;
  });
  const soltar = () => { if (!arrastra) return; arrastra = false; if (movido < 8 && entrada >= 1) barajar(); };
  caja.addEventListener('pointerup', soltar); caja.addEventListener('pointercancel', soltar);
  function barajar() {
    const frente = orden.shift(); orden.push(frente);
    tarjetas[frente].salto = 1;           // la de adelante pasa por encima hacia el fondo
    op.barajar && op.barajar(tarjetas[orden[0]].tipo);
  }

  const reloj = new THREE.Clock(), reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let entrada = 0, sonadas = 0, inicio = 0;   // la entrada va por reloj, no por cuadros: igual en celulares lentos
  render.setAnimationLoop(() => {
    const dt = Math.min(reloj.getDelta(), 0.05), t = reloj.elapsedTime;
    entrada = Math.min(1, (t - inicio) / 1.6);
    // Entrada: las tarjetas salen una por una desde abajo, como de una billetera
    orden.forEach((id, k) => {
      const tj = tarjetas[id], p = PUESTOS[k];
      const turno = 3 - k, listo = entrada * 1.6 - turno * 0.18 > 0;   // primero la del fondo
      if (listo && tj.sono !== true) { tj.sono = true; sonadas++; op.carta && op.carta(sonadas); }
      const meta = listo ? p : { x: 0, y: -3.2, z: p.z, r: 0 };
      const k1 = Math.min(1, dt * (tj.salto > 0 ? 6 : 7));
      tj.pos.x += (meta.x - tj.pos.x) * k1; tj.pos.y += (meta.y - tj.pos.y) * k1; tj.pos.z += (meta.z - tj.pos.z) * k1; tj.rot += (meta.r - tj.rot) * k1;
      tj.salto = Math.max(0, tj.salto - dt * 2.2);
      const arco = Math.sin(tj.salto * Math.PI) * 1.1;
      const flota = reducir ? 0 : Math.sin(t * 1.3 + id) * 0.025;
      tj.grupo.position.set(tj.pos.x, tj.pos.y + arco + flota, tj.pos.z + (tj.salto > 0.5 ? 0.6 : 0));
      tj.grupo.rotation.set(-0.05 - arco * 0.25, 0, tj.rot + Math.sin(tj.salto * Math.PI) * 0.25);
    });
    if (!arrastra) { velY += (-offY * 30 - velY * 7) * dt; offY += velY * dt; velX += (-offX * 30 - velX * 7) * dt; offX += velX * dt; }
    abanico.rotation.set(0.12 + offX + (reducir ? 0 : Math.sin(t * 0.8) * 0.03), -0.18 + offY + (reducir ? 0 : Math.sin(t * 0.55) * 0.12), 0);
    render.render(escena, camara);
  });

  return {
    detener() { render.setAnimationLoop(null); render.dispose(); },
    entrar() { entrada = 0; inicio = reloj.elapsedTime; sonadas = 0; tarjetas.forEach((tj) => { tj.sono = false; tj.pos.set(0, -3.2, 0); tj.salto = 0; }); },
    nombre(n) { tarjetas.forEach((tj) => { const viejo = tj.mat.map; tj.mat.map = tj.mat.emissiveMap = cara(tj.tipo, n); tj.mat.needsUpdate = true; viejo.dispose(); }); },
  };
}
