// En celulares de 360 a 430 px, ninguna vista ni el inicio guiado se pasa del ancho de la pantalla.
// Lo que está dentro de la barra de abajo (fija y recortada) no ensancha la página, así que no se mide; tampoco lo que va
// dentro de un carrusel que se desliza de lado (como los próximos pagos), si el carrusel mismo cabe.
// Si algo se pasa, el celular achica y corre toda la página (pasó con la barra de arriba y la letra ancha de los títulos).
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const medir = (p, W) => p.evaluate((W) => { const dentroDeCarrusel = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if ((o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') && a.getBoundingClientRect().right <= W + 0.5) return true; } return false; }; let peor = '', m = W; document.querySelectorAll('body *').forEach((e) => { const x = e.getBoundingClientRect(); if (x.width > 0 && x.right > m + 0.5 && getComputedStyle(e).position !== 'fixed' && !e.closest('#barra') && !dentroDeCarrusel(e)) { m = x.right; peor = (e.id || ('' + e.className)).slice(0, 40); } }); return { iw: innerWidth, peor, m: Math.round(m) }; }, W);
(async () => {
  const b = await chromium.launch();
  for (const w of [360, 390, 430]) {
    const c = await b.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true });
    await c.addInitScript(() => { try { localStorage.removeItem('fintelligente-inicio'); } catch (e) {} });
    // Con las letras de verdad (Unbounded es ancha): van dentro de la app, en /fuentes/.
    const p = await c.newPage(); await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
    // Inicio guiado, paso por paso
    if (await p.isVisible('#dlg-inicio')) {
      let r = await medir(p, w); ok(r.iw === w && !r.peor, w + ' px · inicio guiado, saludo' + (r.peor ? ': ' + r.peor : ''));
      await p.evaluate(() => document.getElementById('inicio-empecemos').click()); await p.waitForTimeout(400);
      r = await medir(p, w); ok(r.iw === w && !r.peor, w + ' px · inicio guiado, paso 1' + (r.peor ? ': se pasa ' + r.peor + ' hasta ' + r.m : ''));
      await p.evaluate(() => { document.querySelector('#inicio-rapidos [data-v="2500000"]').click(); document.getElementById('inicio-sig1').click(); }); await p.waitForTimeout(500);
      r = await medir(p, w); ok(r.iw === w && !r.peor, w + ' px · paso 2 (qué quieres lograr)' + (r.peor ? ': ' + r.peor : ''));
      const vis = await p.evaluate(() => { const x = document.getElementById('inicio-sig-meta').getBoundingClientRect(); const e = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2); return e && e.closest('#inicio-sig-meta') && x.bottom <= innerHeight; });
      ok(!!vis, w + ' px · el botón Siguiente se ve y se puede tocar');
      await p.evaluate(() => document.querySelector('#dlg-inicio [data-close]').click()); await p.waitForTimeout(300);
    }
    for (const v of ['inicio', 'movimientos', 'analisis', 'metas', 'cuentas', 'presupuesto']) {
      await p.evaluate((v) => document.querySelector('[data-tab="' + v + '"], [data-goto="' + v + '"]').click(), v); await p.waitForTimeout(400);
      const r = await medir(p, w); ok(r.iw === w && !r.peor, w + ' px · ' + v + (r.peor ? ': se pasa ' + r.peor + ' hasta ' + r.m : ''));
    }
    await c.close();
  }
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
