// Accesibilidad (WCAG 2.1 A y AA) con axe-core: vistas principales y ventanas nuevas, en modo claro y oscuro.
require('./sin-bienvenida.js');
const { chromium } = require('playwright'); const fs = require('fs');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch();
  for (const modo of ['light', 'dark']) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', colorScheme: modo });
    await c.clock.setFixedTime(new Date('2026-12-13T19:10:00'));
    const p = await c.newPage();
    await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(700);
    const revisar = async (nombre, prep) => {
      if (prep) { await p.evaluate(prep); await p.waitForTimeout(350); }
      await p.evaluate(AXE);
      const r = await p.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }));
      ok(!r.violations.length, (modo === 'dark' ? 'oscuro · ' : 'claro · ') + nombre + (r.violations.length ? ': ' + r.violations.map((v) => v.id + ' en ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')).join(' | ') : ''));
    };
    const ir = (v) => "document.querySelector('[data-tab=\"" + v + "\"], [data-goto=\"" + v + "\"]').click()";
    await revisar('Inicio');
    for (const v of ['movimientos', 'analisis', 'metas', 'cuentas', 'presupuesto']) await revisar(v, ir(v));
    await revisar('Tu mes contado', "document.getElementById('btn-historia-menu').click()");
    await revisar('¿Y si…?', "document.getElementById('hi-cerrar').click();document.getElementById('btn-ysi-menu').click()");
    await revisar('Buscar', "document.querySelector('#dlg-ysi [data-close]').click();document.getElementById('btn-buscar-menu').click();var q=document.getElementById('bs-q');q.value='mercado';q.dispatchEvent(new Event('input'))");
    await revisar('Retos', "document.querySelector('#dlg-buscar [data-close]').click();document.getElementById('ra-nuevo').click()");
    await revisar('Escanear recibo', "document.querySelector('#dlg-reto [data-close]').click();document.querySelector('[data-escanear-recibo]').click()");
    await revisar('Colores', "document.querySelector('#dlg-recibo [data-close]').click();document.getElementById('btn-colores').click()");
    await c.close();
  }
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
