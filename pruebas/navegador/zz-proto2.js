const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = [];
  for (const [est, tema] of [['vibrante', 'oscuro'], ['editorial', 'claro']]) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    p.on('pageerror', (e) => errs.push(est + ': ' + e.message));
    await p.goto(`file:///home/claude/proto-ver/proto-v2.html?estilo=${est}&tema=${tema}`); await p.waitForTimeout(1500);
    const shot = async (n, st) => { if (st) await p.evaluate((st) => C.setState(st), st); await p.waitForTimeout(800); await p.screenshot({ path: `/home/claude/proto-ver/v2-${est}-${n}.png` }); };
    await shot('1-inicio');
    await p.evaluate(() => { const e = document.querySelector('.scroll'); e && e.scrollBy(0, 640); }); await p.waitForTimeout(400); await p.screenshot({ path: `/home/claude/proto-ver/v2-${est}-2-inicio-abajo.png` });
    await shot('3-movs', { tab: 'movs' }); await shot('4-metas', { tab: 'metas' }); await shot('5-perfil', { tab: 'perfil' });
    await shot('6-confirmar', { pantalla: 'confirmar' }); await shot('7-cat', { pantalla: 'cat', catId: 'comida' });
    await shot('8-hoja', { pantalla: 'tabs', tab: 'inicio', hoja: true }); await shot('9-calendario', { pantalla: 'calendario', hoja: false }); await shot('10-historia', { pantalla: 'historia' });
    await p.close();
  }
  console.log(errs.slice(0, 5)); await b.close(); })();
