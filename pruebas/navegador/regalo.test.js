// Códigos de regalo (panel → enlace → Premium activo) y notas a la vista en Inicio.
require('./sin-bienvenida.js');
const path = require('path'), fs = require('fs');
const CAPTURAS = path.join(__dirname, 'capturas'); fs.mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright');
const BASE = process.env.BASE, CLAVE = 'clave-de-prueba-del-panel';
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const T = async (p, sel) => ((await p.textContent(sel)) || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const estado = (p) => p.evaluate(() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.meses) return { k, v }; } catch (e) {} } return null; });

(async () => {
  const b = await chromium.launch(); const errs = [];
  const nueva = async (vp) => { const c = await b.newContext({ viewport: vp || { width: 1200, height: 900 } }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };

  // ---------- Panel: crear códigos ----------
  const pan = await nueva();
  await pan.goto(BASE + '/panel', { waitUntil: 'networkidle' });
  await pan.fill('#clave', CLAVE); await pan.click('#f-clave button'); await pan.waitForTimeout(600);
  ok(/Todavía no has creado códigos/.test(await T(pan, '#regalos-tabla')), 'el panel muestra la sección de regalos vacía');
  await pan.fill('#regalo-n', '10'); await pan.fill('#regalo-nota', 'Familia'); await pan.click('#f-regalos button'); await pan.waitForTimeout(600);
  const codigos = (await pan.$$eval('#regalos-lista-nuevos div', (d) => d.map((x) => x.textContent)));
  ok(codigos.length === 10 && codigos.every((c) => /^FIN-[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(c)), 'crea 10 códigos y los muestra una vez');
  ok(/Cópialos ahora/.test(await T(pan, '#regalos-nuevos')) && /10 libres · 0 usados · 0 anulados/.test(await T(pan, '#regalos-resumen')), 'avisa que no se vuelven a mostrar y resume');
  ok((await pan.$$('#regalos-tabla tr')).length === 11 && !(await T(pan, '#regalos-tabla')).includes(codigos[0]), 'la tabla solo muestra los últimos 4 caracteres');
  await pan.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await pan.click('[data-copiar="enlaces"]'); await pan.waitForTimeout(200);
  const copiado = await pan.evaluate(() => navigator.clipboard.readText());
  ok(copiado.split('\n').length === 10 && copiado.startsWith(BASE + '/#regalo=FIN-'), 'copia los 10 enlaces de regalo');
  await pan.screenshot({ path: path.join(CAPTURAS, 'regalos-panel.png'), fullPage: true });

  // ---------- Canjear con el enlace ----------
  const p = await nueva({ width: 390, height: 844 });
  await p.goto(BASE + '/#regalo=' + codigos[0].toLowerCase(), { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  ok(await p.isVisible('#dlg-premium') && await p.evaluate(() => document.getElementById('web-regalo').open), 'el enlace abre Premium con el código listo');
  ok((await p.inputValue('#f-regalo')) === codigos[0] && !/regalo/.test(await p.evaluate(() => location.hash)), 'pone el código y lo quita de la dirección');
  ok(!(await p.isVisible('#dlg-inicio')), 'el inicio guiado no tapa el regalo');
  await p.click('#btn-regalo'); await p.waitForTimeout(200);
  ok(/Escribe tu correo/.test(await T(p, '#web-status')), 'pide el correo');
  await p.fill('#f-regalo-email', 'ana@correo.com'); await p.click('#btn-regalo'); await p.waitForTimeout(700);
  ok(/Ya tienes Premium/.test(await T(p, '#web-status')) && /PRE-[A-Z2-9]{12}/.test(await T(p, '#prem-msg')), 'activa Premium y muestra la referencia: ' + await T(p, '#prem-msg'));
  const lic = await p.evaluate(() => JSON.parse(localStorage.getItem('presupuesto-licencia') || 'null'));
  ok(lic && /^PRE-/.test(lic.ref) && lic.token, 'la licencia queda guardada como la de un pago');
  ok(await p.isHidden('#web-regalo') && await p.isHidden('#web-buy'), 'ya no ofrece comprar ni canjear');
  await p.screenshot({ path: path.join(CAPTURAS, 'regalo-activo.png') });

  // El mismo código en otro dispositivo
  const q = await nueva();
  await q.goto(BASE + '/#regalo=' + codigos[0], { waitUntil: 'networkidle' }); await q.waitForTimeout(1000);
  await q.fill('#f-regalo-email', 'otra@correo.com'); await q.click('#btn-regalo'); await q.waitForTimeout(600);
  ok(/ya se usó/.test(await T(q, '#web-status')), 'un código usado no sirve otra vez');
  await q.fill('#f-regalo', 'FIN-ABC'); await q.click('#btn-regalo'); await q.waitForTimeout(200);
  ok(/formato FIN-XXXXX-XXXXX/.test(await T(q, '#web-status')), 'avisa si el código está mal escrito');

  // Panel: ve el uso y anula uno libre
  await pan.click('#actualizar'); await pan.waitForTimeout(700);
  ok(/9 libres · 1 usado · 0 anulados/.test(await T(pan, '#regalos-resumen')) && /Usado el/.test(await T(pan, '#regalos-tabla')), 'el panel muestra el código usado');
  const anular = await pan.$('#regalos-tabla [data-anular]');
  await anular.click(); ok((await anular.textContent()) === '¿Seguro?', 'anular pide confirmación');
  await anular.click(); await pan.waitForTimeout(600);
  ok(/8 libres · 1 usado · 1 anulado/.test(await T(pan, '#regalos-resumen')), 'anula el código');

  // ---------- Notas a la vista ----------
  const n = await nueva({ width: 390, height: 844 });
  await n.goto(BASE, { waitUntil: 'networkidle' }); await n.waitForTimeout(1200);
  await n.evaluate(() => document.querySelector('#tabs [data-tab="analisis"]').click()); await n.waitForTimeout(300);
  ok(await n.isHidden('#notas-vista'), 'sin notas no aparece la tarjeta');
  for (const [tipo, txt] of [['logro', 'No pedí domicilios en la semana'], ['idea', 'Llevar almuerzo los lunes'], ['alerta', 'El arriendo sube en enero'], ['recordatorio', 'Pagar el SOAT el 20']]) {
    await n.click(`#nota-tipos [data-tipo-nota="${tipo}"]`); await n.fill('#f-nota-nueva', txt); await n.click('#btn-nota');
  }
  await n.waitForTimeout(200);
  ok(await n.isVisible('#notas-vista'), 'con notas aparece arriba en Análisis');
  const tipos = await n.$$eval('#nv-lista li', (l) => l.map((x) => x.dataset.tipo));
  ok(tipos.join() === 'alerta,recordatorio,idea', 'muestra 3: primero la alerta y el recordatorio (' + tipos + ')');
  ok(/^Tus notas de [a-z]+/.test(await T(n, '#h-notas-vista')) && (await T(n, '#nv-todas')) === 'Ver las 4 notas', 'título del mes y enlace a todas');
  const yVista = await n.evaluate(() => document.getElementById('notas-vista').getBoundingClientRect().top + scrollY);
  const yDona = await n.evaluate(() => document.getElementById('h-notas').getBoundingClientRect().top + scrollY);
  ok(yVista < yDona, 'queda antes de la lista de notas');
  await n.evaluate(() => document.getElementById('notas-vista').scrollIntoView({ block: 'center' })); await n.waitForTimeout(200);
  await n.screenshot({ path: path.join(CAPTURAS, 'notas-vista.png') });
  await n.click('#nv-agregar'); await n.waitForTimeout(800);
  ok(await n.evaluate(() => document.activeElement.id === 'f-nota-nueva'), '"+ Nota" lleva al campo para escribir');

  // Recordatorios del mes pasado
  const e = await estado(n), k = e.v.mes, d = new Date(+k.slice(0, 4), +k.slice(5) - 2, 1), pk = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
  await n.evaluate(({ k, v, pk }) => {
    v.meses[pk] = JSON.parse(JSON.stringify(v.meses[v.mes]));
    v.meses[pk].notas = 'Recordatorio: Renovar la tarjeta de transporte\nIdea: Vender la bicicleta vieja\nLogro: Ahorré el 10 %\nRecordatorio: Pagar el SOAT el 20';
    localStorage.setItem(k, JSON.stringify(v));
  }, { k: e.k, v: e.v, pk });
  await n.reload({ waitUntil: 'networkidle' }); await n.waitForTimeout(1200);
  const pas = await T(n, '#nv-pasado');
  ok(/Del mes pasado/.test(pas) && /Renovar la tarjeta/.test(pas) && /Vender la bicicleta/.test(pas), 'ofrece los recordatorios e ideas del mes pasado');
  ok(!/Ahorré/.test(pas) && !/SOAT/.test(pas), 'no repite logros ni lo que ya está en este mes');
  await n.click('#nv-pasado [data-nv-traer="0"]'); await n.waitForTimeout(200);
  ok(/Renovar la tarjeta/.test(await T(n, '#notas-lista')) && !/Renovar/.test(await T(n, '#nv-pasado')), 'Traer la pasa a este mes');
  await n.click('#nv-pasado [data-nv-quitar="0"]'); await n.waitForTimeout(200);
  ok(await n.isHidden('#nv-pasado'), '× la descarta');
  await n.reload({ waitUntil: 'networkidle' }); await n.waitForTimeout(1000);
  ok(await n.isHidden('#nv-pasado'), 'lo descartado no vuelve');

  ok(!errs.length, 'sin errores en la página ' + errs.join(' | '));
  await b.close();
  if (fallas) { console.log(fallas + ' falla(s)'); process.exit(1); }
  console.log('regalos y notas: todo bien');
})().catch((e) => { console.error(e); process.exit(1); });
