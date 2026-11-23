// Mi negocio: ventas y gastos del negocio aparte de los personales, la ganancia del mes y un sueldo que pasa
// al presupuesto personal.
require('./sin-bienvenida.js');
const path = require('path'), fs = require('fs');
const CAPTURAS = path.join(__dirname, 'capturas'); fs.mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const T = async (p, sel) => ((await p.textContent(sel)) || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const estado = (p) => p.evaluate(() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.meses) return v; } catch (e) {} } return null; });

(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 400, height: 860 }, isMobile: true, hasTouch: true });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(1600);

  // Arma su presupuesto con la plantilla "Tengo un negocio"
  if (!(await p.isVisible('#dlg-inicio'))) { await p.evaluate(() => document.getElementById('btn-plantilla-menu').click()); await p.waitForTimeout(300); }
  if (await p.isVisible('#inicio-empecemos')) await p.click('#inicio-empecemos');
  await p.click('[data-perfil="negocio"]');
  await p.fill('#inicio-ingreso', '3000000'); await p.click('#inicio-sig1'); await p.click('#inicio-sig-meta'); await p.click('#inicio-sig2');
  await p.check('input[name="inicio-auto"][value="no"]'); await p.click('#inicio-armar'); await p.waitForTimeout(300);
  await p.click('#inicio-empezar'); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelector('#tabs [data-tab="analisis"]').click()); await p.waitForTimeout(300);
  ok(await p.isVisible('#trabajo-card') && /Mi negocio en/.test(await T(p, '#h-trabajo')), 'en Análisis aparece la tarjeta de Mi negocio');
  await p.click('#trabajo-btn'); await p.waitForTimeout(300);
  ok(await p.isVisible('#dlg-negocio') && (await T(p, '#neg-ganancia')) === '$ 0', 'se abre Mi negocio, en ceros');

  await p.click('#neg-form button[type="submit"]'); await p.waitForTimeout(100);
  ok(/Escribe el valor/.test(await T(p, '#neg-msg')), 'sin valor no anota');
  await p.type('#neg-valor', '850000'); await p.fill('#neg-concepto', 'Pedido de Laura'); await p.click('#neg-form button[type="submit"]'); await p.waitForTimeout(150);
  await p.type('#neg-valor', '1200000'); await p.click('#neg-form button[type="submit"]'); await p.waitForTimeout(150);
  await p.click('#neg-tipo [data-t="g"]');
  ok(await p.isVisible('#neg-cat'), 'los gastos piden categoría del negocio');
  await p.type('#neg-valor', '600000'); await p.selectOption('#neg-cat', 'mercancia'); await p.click('#neg-form button[type="submit"]'); await p.waitForTimeout(150);
  await p.type('#neg-valor', '250000'); await p.selectOption('#neg-cat', 'local'); await p.click('#neg-form button[type="submit"]'); await p.waitForTimeout(150);
  ok((await T(p, '#neg-ventas')) === '$ 2.050.000' && (await T(p, '#neg-gastos')) === '$ 850.000' && (await T(p, '#neg-ganancia')) === '$ 1.200.000', 'suma ventas, gastos y ganancia');
  ok(/Mercancía e insumos \(\$ 600\.000\)/.test(await T(p, '#neg-cats')), 'dice en qué gasta más el negocio');
  ok((await p.$$('#neg-lista li')).length === 4 && /Pedido de Laura/.test(await T(p, '#neg-lista')), 'lista los movimientos del mes');
  let s = await estado(p);
  const gastosPersonales = s.meses[s.mes].gastos.reduce((a, g) => a + g.real, 0);
  ok(s.negocio.movs.length === 4 && gastosPersonales === 0, 'no se mezcla con los gastos personales');

  // Borrar y deshacer
  await p.click('#neg-lista [data-borrar]'); await p.waitForTimeout(150);
  ok((await p.$$('#neg-lista li')).length === 3, 'se puede borrar un movimiento');
  await p.click('.toast:has-text("Se borró") button'); await p.waitForTimeout(150);
  ok((await p.$$('#neg-lista li')).length === 4, 'y deshacer');

  // Sueldo
  await p.fill('#neg-sueldo', ''); await p.type('#neg-sueldo', '900000'); await p.dispatchEvent('#neg-sueldo', 'change');
  await p.click('#neg-pasar'); await p.waitForTimeout(300);
  ok(/\$ 900\.000 entraron a tu presupuesto/.test(await T(p, '#neg-msg')), 'pasa el sueldo al presupuesto personal');
  s = await estado(p);
  const ing = s.meses[s.mes].ingresos.find((x) => x.id === 'neg-sueldo');
  ok(ing && ing.real === 900000 && ing.concepto === 'Sueldo de mi negocio' && s.negocio.sueldo === 900000, 'queda como ingreso "Sueldo de mi negocio"');
  await p.fill('#neg-sueldo', ''); await p.type('#neg-sueldo', '1000000'); await p.click('#neg-pasar'); await p.waitForTimeout(300);
  s = await estado(p);
  ok(s.meses[s.mes].ingresos.filter((x) => x.id === 'neg-sueldo').length === 1 && s.meses[s.mes].ingresos.find((x) => x.id === 'neg-sueldo').real === 1000000, 'al actualizarlo no se duplica');
  await p.screenshot({ path: path.join(CAPTURAS, 'negocio.png'), fullPage: true });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(/Vendiste \$ 2\.050\.000/.test(await T(p, '#trabajo-txt')) && /ganancia de \$ 1\.200\.000/.test(await T(p, '#trabajo-txt')), 'la tarjeta de Análisis resume el mes: ' + await T(p, '#trabajo-txt'));

  // Sugerido con meses anteriores y comparación
  await p.evaluate(() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.meses) {
    const [y, m] = v.mes.split('-').map(Number), f = (i, d) => { const x = new Date(y, m - 1 - i, d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); };
    v.negocio.sueldo = 0;
    [[1, 2000000, 800000], [2, 1500000, 900000], [3, 3000000, 1000000]].forEach(([i, ve, ga]) => { v.negocio.movs.push({ id: 'x' + i, f: f(i, 5), t: 'v', m: ve }, { id: 'y' + i, f: f(i, 6), t: 'g', cat: 'otros', m: ga }); });
    localStorage.setItem(k, JSON.stringify(v)); } } catch (e) {} } });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  ok((await p.evaluate(() => window.FinNegocio.sugerido(document.getElementById('f-mes').value || ''))) >= 0, 'calcula el sugerido');
  await p.evaluate(() => document.getElementById('btn-negocio-menu').click()); await p.waitForTimeout(300);
  ok(/Sugerido: \$ 900\.000/.test(await T(p, '#neg-sueldo-n')), 'sugiere el sueldo con los meses flojos: ' + await T(p, '#neg-sueldo-n'));
  ok(/Ganaste \$ 0 más|Igual que el mes pasado|Ganaste \$ [\d.]+ (más|menos) que el mes pasado/.test(await T(p, '#neg-comp')), 'compara con el mes pasado: ' + await T(p, '#neg-comp'));

  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const preg = async (q) => { await p.fill('#pr-input', q); await p.press('#pr-input', 'Enter'); await p.waitForTimeout(600); return p.evaluate(() => [...document.querySelectorAll('#pr-log .pr-msg.app')].pop().textContent.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ')); };
  await p.evaluate(() => document.getElementById('btn-preguntas-menu').click()); await p.waitForTimeout(300);
  let a = await preg('¿Cuánto vendí este mes?');
  ok(/vendió \$ 2\.050\.000/.test(a) && /ganancia de \$ 1\.200\.000/.test(a), 'Pregúntale responde por el negocio: ' + a.slice(0, 90));
  a = await preg('¿Cuánto pago de seguridad social si gano 5 millones?');
  ok(/aparta unos \$ 580\.500/.test(a), 'y por la seguridad social: ' + a.slice(0, 90));
  a = await preg('¿Cómo hago una cuenta de cobro?');
  ok(/Para independientes/.test(a) && await p.isVisible('#pr-chips [data-guia="trabajo"]'), 'explica cómo hacer una cuenta de cobro y ofrece la guía');
  await p.click('#pr-chips [data-guia="trabajo"]'); await p.waitForTimeout(500);
  ok(await p.isVisible('#guia-globo') && /Tu sueldo fijo/.test(await T(p, '#guia-globo')), 'la guía empieza en el sueldo fijo');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(!errs.length, 'sin errores en la página ' + errs.join(' | '));
  await b.close();
  if (fallas) { console.log(fallas + ' falla(s)'); process.exit(1); }
  console.log('mi negocio: todo bien');
})().catch((e) => { console.error(e); process.exit(1); });
