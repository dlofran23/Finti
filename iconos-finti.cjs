// Genera los íconos de Finti (azul eléctrico con la moneda amarilla) en marca-finti/.
// Uso: node herramientas/iconos-finti.cjs   (desde web-pro; necesita Playwright)
const { chromium } = require('playwright');
const path = require('path');
const DIR = path.join(__dirname, '..', 'marca-finti');
const svg = (rx, pad) => `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 32 32">
<defs><radialGradient id="g" cx="20%" cy="10%" r="120%"><stop offset="0" stop-color="#5c84ff"/><stop offset=".45" stop-color="#2e5bff"/><stop offset="1" stop-color="#1630b8"/></radialGradient>
<radialGradient id="m" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#ffe59a"/><stop offset=".55" stop-color="#ffc53d"/><stop offset="1" stop-color="#d99a00"/></radialGradient></defs>
<rect width="32" height="32" rx="${rx}" fill="url(#g)"/>
<g transform="translate(${pad} ${pad}) scale(${(32 - 2 * pad) / 32})"><path d="M10 23V9h11M10 16h8" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="23" cy="21" r="2.6" fill="url(#m)"/></g></svg>`;
const lista = [
  ['web/icon-192.png', 192, 9, 0], ['web/icon-512.png', 512, 9, 0], ['web/icon-maskable-512.png', 512, 0, 3.2], ['web/apple-touch-icon.png', 180, 0, 0],
  ['android/play-icono-512.png', 512, 0, 0],
  ['android/mipmap-mdpi/ic_launcher.png', 48, 9, 0], ['android/mipmap-hdpi/ic_launcher.png', 72, 9, 0], ['android/mipmap-xhdpi/ic_launcher.png', 96, 9, 0],
  ['android/mipmap-xxhdpi/ic_launcher.png', 144, 9, 0], ['android/mipmap-xxxhdpi/ic_launcher.png', 192, 9, 0]
];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  for (const [f, size, rx, pad] of lista) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent;width:${size}px;height:${size}px">${svg(rx, pad)}</body></html>`);
    await p.screenshot({ path: path.join(DIR, f), omitBackground: rx > 0, clip: { x: 0, y: 0, width: size, height: size } });
  }
  require('fs').writeFileSync(path.join(DIR, 'web/favicon.svg'), svg(9, 0).replace('width="100%" height="100%"', 'width="32" height="32"').replace(/\n/g, ''));
  await b.close(); console.log('íconos de Finti listos:', lista.length + 1);
})();
