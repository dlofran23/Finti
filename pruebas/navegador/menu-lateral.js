// Para pruebas viejas en celular: el menú ⋮ vive en el menú lateral, que se abre con Más en la barra de abajo.
require('./sin-bienvenida.js');
const pw = require('playwright'); const orig = pw.chromium.launch.bind(pw.chromium);
const MENU = ['btn-bandeja-menu','btn-fuentes-menu','btn-avisos-menu','btn-copy','btn-xlsx','btn-export'];
pw.chromium.launch = async (...a) => {
  const b = await orig(...a), nc = b.newContext.bind(b);
  b.newContext = async (...x) => { const c = await nc(...x); const np = c.newPage.bind(c);
    c.newPage = async () => { const p = await np(); const click = p.click.bind(p);
      const movil = () => (p.viewportSize() || {width: 1280}).width <= 760;
      const abrir = async () => { if (!(await p.$eval('#lateral', e => e.classList.contains('abierta')))) { await click((await p.isVisible('#btn-menu')) ? '#btn-menu' : '#barra-mas'); await p.waitForTimeout(300); } };
      p.click = async (sel, o) => {
        const id0 = sel.replace(/^#/, '');
        if (['btn-bandeja-menu','btn-fuentes-menu','btn-avisos-menu'].includes(id0) && !movil()) return click('#lateral [data-clic="' + id0 + '"]', o);
        if (movil()) {
          if (sel === '#btn-mas') return;
          if (sel === '#fab-add') return click('#barra-registrar', o);
          if (sel === '#btn-menu' || sel === '#btn-registrar-top') return click(sel === '#btn-menu' ? '#barra-mas' : '#barra-registrar', o);
          if (sel === '#btn-crear-buzon') await p.evaluate(() => { const d = document.getElementById('mas-formas'); if (d) d.open = true; });
          if (sel.startsWith('#tabs')) { await abrir(); return click(sel, o); }
          const id = sel.replace(/^#/, '');
          if (MENU.includes(id)) { await abrir(); await p.evaluate(() => { const d = document.getElementById('lat-mas'); if (d) d.open = true; }); return click('#lateral [data-clic="' + id + '"]', o); }
        }
        return click(sel, o);
      };
      return p; };
    return c; };
  b.newPage = async (...x) => (await b.newContext(...x)).newPage();
  return b;
};
