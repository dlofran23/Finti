require('./sin-bienvenida.js');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const B = 'http://localhost:18890';
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: 'dark' });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(B, { waitUntil: 'networkidle' }); await p.waitForTimeout(2200);
  const s = async (n) => { await p.waitForTimeout(1100); await p.screenshot({ path: `/tmp/vista2/${n}.png` }); };
  await s('1-inicio'); await p.evaluate(() => window.scrollTo(0, 750)); await s('2-inicio-b'); await p.evaluate(() => window.scrollTo(0, 1400)); await s('3-inicio-c');
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.evaluate(() => document.querySelector('#tabs [data-tab="presupuesto"]').click()); await s('4-presupuesto');
  console.log('errores', errs.join(' | '));
  await b.close();
})();
