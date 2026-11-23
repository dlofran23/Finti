// Genera las pantallas de arranque del iPhone (public/inicio-ios/) con el último cuadro de la pantalla de carga:
// fondo azul de Finti, la F blanca con su punto dorado y el nombre. Uso: node herramientas/arranque-ios.cjs
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const RAIZ = path.join(__dirname, '..', 'public');
const TAM = [[1320, 2868, 3], [1290, 2796, 3], [1284, 2778, 3], [1260, 2736, 3], [1242, 2688, 3], [1206, 2622, 3], [1179, 2556, 3], [1170, 2532, 3], [1125, 2436, 3], [828, 1792, 2], [750, 1334, 2]];
const unb = 'data:font/woff2;base64,' + fs.readFileSync(path.join(RAIZ, 'fuentes', 'unbounded.woff2')).toString('base64');
const html = `<!DOCTYPE html><html><head><style>@font-face{font-family:U;src:url(${unb})}
html,body{margin:0;height:100%}body{display:grid;place-items:center;align-content:center;gap:14px;background:radial-gradient(120% 80% at 50% 40%,#5C84FF 0%,#2E5BFF 42%,#1630B8 78%,#0d1d78 100%)}
svg{width:120px;height:120px;overflow:visible}path{fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
circle{fill:#FFC53D;filter:drop-shadow(0 0 1.4px rgba(255,214,120,.95))}b{font:700 28px U,sans-serif;color:#fff}</style></head>
<body><svg viewBox="0 0 32 32"><path d="M10 23V9h11M10 16h8"/><circle cx="23" cy="21" r="2.6"/></svg><b>Finti</b></body></html>`;
(async () => {
  const b = await chromium.launch();
  for (const [w, h, d] of TAM) {
    const p = await b.newPage({ viewport: { width: w / d, height: h / d }, deviceScaleFactor: d });
    await p.setContent(html); await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(RAIZ, 'inicio-ios', `finti-${w}x${h}.png`) }); await p.close();
  }
  await b.close(); console.log('listo:', TAM.length, 'pantallas');
})();
