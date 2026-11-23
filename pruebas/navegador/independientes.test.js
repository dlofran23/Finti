// Plantillas del presupuesto según la situación (estudiante, familia, independiente…) y las herramientas para
// independientes: sueldo fijo, seguridad social y cuenta de cobro.
require('./sin-bienvenida.js');
const path = require('path'), fs = require('fs');
const CAPTURAS = path.join(__dirname, 'capturas'); fs.mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const T = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
const estado = (p) => p.evaluate(() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.meses) return v; } catch (e) {} } return null; });
const mesDe = (s) => s.meses[s.mes];

(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 400, height: 860 }, isMobile: true, hasTouch: true });
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(1600);

  // ---------- Plantillas ----------
  if (!(await p.isVisible('#dlg-inicio'))) { await p.evaluate(() => document.getElementById('btn-plantilla-menu').click()); await p.waitForTimeout(300); }
  if (await p.isVisible('#inicio-empecemos')) await p.click('#inicio-empecemos');
  ok(await p.isVisible('#dlg-inicio') && await p.isVisible('#inicio-perfil'), 'el inicio guiado pregunta para quién es el presupuesto');
  await p.click('[data-perfil="familia"]');
  await p.fill('#inicio-ingreso', '4000000'); await p.click('#inicio-sig1'); await p.click('#inicio-sig-meta');
  await p.fill('#inicio-vivienda', '1000000'); await p.fill('#inicio-servicios', '300000'); await p.click('#inicio-sig2');
  await p.check('input[name="inicio-auto"][value="no"]'); await p.click('#inicio-armar'); await p.waitForTimeout(300);
  let s = await estado(p), m = mesDe(s), conceptos = m.gastos.map((g) => g.concepto);
  ok(conceptos.includes('Colegio, útiles y pensión') && conceptos.includes('Planes en familia') && s.prefs.perfil === 'familia', 'la plantilla Familia trae colegio y planes en familia');
  const total = m.gastos.reduce((a, g) => a + g.plan, 0);
  ok(Math.abs(total - 4000000) <= 10000, 'el presupuesto suma lo que entra (' + total + ')');
  await p.click('#inicio-empezar'); await p.waitForTimeout(1200);
  if (await p.isVisible('.toast')) await p.keyboard.press('Escape');

  // Un gasto real que se debe conservar al rehacer
  await p.evaluate(() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.meses) { const g = v.meses[v.mes].gastos.find((x) => x.cat === 'alimentacion'); g.real = 321000; localStorage.setItem(k, JSON.stringify(v)); } } catch (e) {} } });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  await p.evaluate(() => document.getElementById('btn-plantilla-menu').click()); await p.waitForTimeout(300);
  ok(await p.isVisible('#dlg-inicio') && (await T(p, '#inicio-omitir')) === 'Cerrar' && /Rehagamos/.test(await T(p, '#inicio-t')) && await p.isVisible('#inicio-ingreso'), '"Rehacer mi presupuesto" abre el inicio directo en la cifra, con Cerrar');
  ok((await p.getAttribute('[data-perfil="familia"]', 'aria-checked')) === 'true', 'recuerda la plantilla elegida');
  await p.click('[data-perfil="independiente"]');
  await p.fill('#inicio-ingreso', '3000000'); await p.click('#inicio-sig1'); await p.click('#inicio-sig-meta');
  await p.fill('#inicio-vivienda', '900000'); await p.fill('#inicio-servicios', '200000'); await p.click('#inicio-sig2');
  await p.click('#inicio-armar'); await p.waitForTimeout(300);
  ok(/colchón/i.test(await T(p, '#inicio-reparto')), 'para independientes, el ahorro es el colchón de los meses flojos');
  await p.click('#inicio-empezar'); await p.waitForTimeout(900);
  s = await estado(p); m = mesDe(s); conceptos = m.gastos.map((g) => g.concepto);
  const alim = m.gastos.filter((g) => g.cat === 'alimentacion').reduce((a, g) => a + g.real, 0);
  ok(conceptos.includes('Seguridad social (salud y pensión)') && !conceptos.includes('Planes en familia'), 'cambia a la plantilla Independiente');
  ok(alim === 321000 && !s.ejemplo, 'conserva lo que ya había gastado (' + alim + ')');

  // ---------- Sueldo fijo ----------
  await p.evaluate(() => {
    for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.meses) {
      const [y, mm] = v.mes.split('-').map(Number), reales = [3000000, 1800000, 2500000, 1200000];
      reales.forEach((r, i) => { const d = new Date(y, mm - 2 - i, 1), kk = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        v.meses[kk] = { ingresos: [{ id: 'i1', concepto: 'Lo que me entra', plan: 2000000, real: r }], gastos: [], notas: '' }; });
      v.meses[v.mes].ingresos[0].real = 2700000;
      localStorage.setItem(k, JSON.stringify(v)); } } catch (e) {} }
  });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  await p.evaluate(() => document.getElementById('btn-indep-menu').click()); await p.waitForTimeout(300);
  const su = await T(p, '#ind-sueldo-res');
  ok(await p.isVisible('#dlg-indep') && /\$ 1\.500\.000/.test(su), 'propone un sueldo fijo con los meses flojos: ' + su.slice(0, 60));
  ok(/de \$ 1\.200\.000 a \$ 3\.000\.000/.test(su) && /aparta \$ 1\.200\.000 al colchón/.test(su), 'este mes entró más: dice cuánto apartar al colchón');
  await p.screenshot({ path: path.join(CAPTURAS, 'indep-sueldo.png') });

  // ---------- Seguridad social ----------
  ok((await p.evaluate(() => window.FinIndep.seguridad(5000000, true).total)) === 580500, 'cálculo con $ 5.000.000 (IBC $ 2.000.000): salud, pensión y ARL');
  const bajo = await p.evaluate(() => window.FinIndep.seguridad(1000000, false));
  ok(bajo.ibc === 1750905 && bajo.bajo, 'el IBC nunca baja de un salario mínimo');
  const alto = await p.evaluate(() => window.FinIndep.seguridad(20000000, false));
  ok(alto.fsp === 80000, 'con IBC desde 4 salarios suma el fondo de solidaridad');
  await p.click('#ind-tabs [data-tab="ss"]');
  await p.fill('#ind-ss-ing', ''); await p.type('#ind-ss-ing', '5000000'); await p.waitForTimeout(150);
  const ss = await T(p, '#ind-ss-res');
  ok(/Aparta al mes ?\$ 580\.500/.test(ss) && /Salud \(12,5 %\) ?\$ 250\.000/.test(ss), 'la pestaña muestra cuánto apartar: ' + ss.slice(0, 50));
  await p.uncheck('#ind-ss-arl'); await p.waitForTimeout(100);
  ok(/\$ 570\.000/.test(await T(p, '#ind-ss-res')) && !/ARL, riesgo/.test(await T(p, '#ind-ss-res')), 'sin ARL baja el total');
  await p.screenshot({ path: path.join(CAPTURAS, 'indep-seguridad.png') });

  // ---------- Cuenta de cobro ----------
  const L = (n) => p.evaluate((n) => window.FinIndep.letras(n), n);
  ok((await L(1250000)) === 'un millón doscientos cincuenta mil pesos', 'en letras: 1.250.000');
  ok((await L(21000000)) === 'veintiún millones de pesos', 'en letras: 21.000.000 → ' + await L(21000000));
  ok((await L(101500)) === 'ciento un mil quinientos pesos', 'en letras: 101.500 → ' + await L(101500));
  ok((await L(3000000)) === 'tres millones de pesos', 'en letras: 3.000.000');
  await p.click('#ind-tabs [data-tab="cobro"]');
  await p.click('#cc-form button[type="submit"]'); await p.waitForTimeout(150);
  ok(/./.test(await T(p, '#cc-msg')), 'sin datos, pide completarlos: ' + await T(p, '#cc-msg'));
  await p.fill('#cc-nombre', 'Ana Pérez'); await p.fill('#cc-doc', '1020304050'); await p.fill('#cc-ciudad', 'Medellín');
  await p.fill('#cc-cliente', 'Estudio Gráfico S. A. S.'); await p.fill('#cc-clienteDoc', '900123456-7');
  await p.fill('#cc-concepto', 'Diseño del logo'); await p.type('#cc-valor', '1250000');
  ok(/Un millón doscientos cincuenta mil pesos/.test(await T(p, '#cc-letras')), 'muestra el valor en letras mientras escribe');
  await p.evaluate(() => { window.__impreso = 0; window.print = () => { window.__impreso++; }; });
  await p.click('#cc-form button[type="submit"]'); await p.waitForTimeout(400);
  const cc = await T(p, '#informe');
  ok((await p.evaluate(() => window.__impreso)) === 1 && /Cuenta de cobro n\.º 1/.test(cc) && /Estudio Gráfico/.test(cc) && /Debe a:/.test(cc) && /\$ 1\.250\.000/.test(cc), 'arma la cuenta de cobro y abre la impresión');
  await p.emulateMedia({ media: 'print' }); await p.screenshot({ path: path.join(CAPTURAS, 'cuenta-cobro.png'), fullPage: true }); await p.emulateMedia({ media: 'screen' });
  const guard = JSON.parse(await p.evaluate(() => localStorage.getItem('fintelligente-cobro')));
  ok(guard.nombre === 'Ana Pérez' && guard.num === 1, 'guarda tus datos en este dispositivo');
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => document.getElementById('btn-indep-menu').click()); await p.waitForTimeout(300);
  ok((await p.inputValue('#cc-nombre')) === 'Ana Pérez' && (await p.inputValue('#cc-num')) === '2', 'la próxima vez trae tus datos y el siguiente número');

  ok(!errs.length, 'sin errores en la página ' + errs.join(' | '));
  await b.close();
  if (fallas) { console.log(fallas + ' falla(s)'); process.exit(1); }
  console.log('plantillas e independientes: todo bien');
})().catch((e) => { console.error(e); process.exit(1); });
