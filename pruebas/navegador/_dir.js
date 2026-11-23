require('./sin-bienvenida.js');
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const T = require('/tmp/dir/temas.js');
(async () => {
  const b = await chromium.launch();
  for (const [k, t] of Object.entries(T)) for (const modo of ['dark', 'light']) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: modo, deviceScaleFactor: 2 });
    await c.route('**/fx/**', (r) => { const f = '/tmp/fx/node_modules/' + decodeURIComponent(new URL(r.request().url()).pathname.slice(4)); r.fulfill({ body: fs.readFileSync(f), contentType: 'font/woff2' }); });
    const p = await c.newPage();
    await p.goto('http://localhost:18860', { waitUntil: 'networkidle' });
    await p.evaluate(([css, modo]) => { var bt = document.querySelector('#seg-modo [data-modo="' + (modo === 'dark' ? 'oscuro' : 'claro') + '"]'); if (bt) bt.click(); const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }, [t.css, modo]);
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1800);
    await p.evaluate(() => { const e = [...document.querySelectorAll('.panel h2')].find(h => /Pronóstico/.test(h.textContent)); window.scrollTo(0, 0); });
    await p.screenshot({ path: `/tmp/dir/${k}-${modo}-1.png` });
    await p.evaluate(() => window.scrollTo(0, 1350)); await p.waitForTimeout(500);
    await p.screenshot({ path: `/tmp/dir/${k}-${modo}-2.png` });
    await c.close();
  }
  await b.close();
})();
