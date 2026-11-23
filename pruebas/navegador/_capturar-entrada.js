// Herramienta (no es prueba): lo que ve quien abre Finti por primera vez.
const { chromium } = require('playwright'); const BASE = process.env.BASE; const OUT = '/tmp/entrada';
const FAKE_GIS = `window.google={accounts:{id:{initialize:function(){},renderButton:function(el){var b=document.createElement('button');b.type='button';b.textContent='Continuar con Google';b.style.cssText='width:100%;height:44px;border-radius:22px;border:1px solid #dadce0;background:#fff;font:500 15px sans-serif';el.appendChild(b);},prompt:function(){}}}};`;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: process.env.ESQ || 'dark' });
  await c.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }));
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  let n = 0; const foto = async (nombre) => { await p.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}-${nombre}.png` }); };
  await p.goto(BASE, { waitUntil: 'commit' }); await espera(350); await foto('arranque');
  await p.waitForLoadState('networkidle'); await espera(1500); await foto('entrada');
  await p.evaluate(() => window.scrollTo(0, 9999)); await espera(300); await foto('entrada-abajo'); await p.evaluate(() => window.scrollTo(0, 0));
  if (await p.isVisible('#bienv-acepto .nac-btn')) {
    await p.click('#bienv-acepto .nac-btn'); await espera(400); await foto('cumpleanos');
    await p.focus('#bienv-acepto .nac-rueda[data-r="a"]'); await p.keyboard.type(String(new Date().getFullYear() - 30), { delay: 40 }); await espera(200);
    await p.click('#bienv-acepto .nac-listo'); await espera(300);
    const casillas = await p.$$('#bienv-acepto input[type=checkbox]'); for (const x of casillas) { if (await x.isVisible() && !(await x.isChecked())) await x.check().catch(() => {}); }
    await espera(300); await foto('aceptado');
  }
  if (await p.isVisible('#bienv-sin')) { await p.click('#bienv-sin'); await espera(1200); }
  await foto('despues-de-entrar');
  for (let i = 0; i < 8 && await p.isVisible('#dlg-inicio'); i++) {
    const paso = await p.evaluate(() => { const v = [...document.querySelectorAll('#dlg-inicio [data-paso]')].find((x) => x.offsetParent); return v ? v.dataset.paso : '?'; });
    await foto('guiado-paso-' + paso);
    const sig = { '0': '#inicio-empecemos', '1': '#inicio-sig1', '2': '#inicio-sig-meta', '3': '#inicio-sig2', '4': '#inicio-armar' }[paso];
    if (paso === '1') await p.click('#inicio-rapidos [data-v="2500000"]').catch(() => {});
    if (paso === '2') { await p.click('#inicio-metas [data-meta="viaje"]').catch(() => {}); await p.click('#inicio-metas [data-meta="fondo"]').catch(() => {}); await espera(200); await foto('guiado-paso-2-elegido'); }
    if (!sig || !(await p.isVisible(sig))) { const ult = await p.$('#inicio-empezar'); if (ult && await ult.isVisible()) { await foto('guiado-final'); await p.keyboard.press('Escape'); } break; }
    await p.click(sig); await espera(1600);
  }
  await espera(800); await p.keyboard.press('Escape').catch(() => {}); await espera(500);
  await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await espera(400); await foto('inicio-de-la-app');
  console.log('fotos:', n, 'errores:', errs.slice(0, 3));
  await b.close();
})();
