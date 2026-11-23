const { chromium } = require('/home/claude/web-pro/node_modules/playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
 for (const k of (process.argv[2]||'libreta,rotulo,editorial').split(',')) { await p.goto('file:///tmp/lam/' + (process.argv[3]||'lamina.html') + '#' + k); await p.reload(); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/lam/lamina-' + k + '.png', fullPage: true }); }
 await b.close(); })();
