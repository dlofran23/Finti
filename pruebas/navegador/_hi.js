require('./sin-bienvenida.js');
const { chromium } = require('playwright'); const casos = require('/tmp/hi-casos.json');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:18900', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); console.log(await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /sin-cuenta$/.test(k)))||'{}').cuentas||[])));
  for (const t of casos) { const r = await p.evaluate((t) => { try { return window.FinHistoria(t); } catch (e) { return 'ERROR ' + e.message + e.stack.split('\n')[1]; } }, t);
    console.log('\n### ' + t.slice(0, 90));
    if (!r || typeof r === 'string') { console.log(r); continue; }
    r.movs.forEach(m => console.log(`  ${m.c} | ${m.cat} | ${m.m} | cuenta ${m.cuenta} | f ${m.f}` + (m.conflicto ? ' | CONFLICTO ' + JSON.stringify(m.conflicto) : '') + (m.aportes && m.aportes.length ? ' | aportes ' + JSON.stringify(m.aportes) : '') + (m.comp ? ' | comp ' + JSON.stringify(m.comp) : '') + (m.dio ? ' | dio ' + m.dio + ' vueltas ' + m.vueltas : '') + '\n      ' + m.det.map(d => `${d.q} ${d.n}=${d.m}${d.falta ? '(falta)' : ''}${d.deducido ? '(deducido)' : ''}`).join('; ')));
  }
  console.log('errores', errs); await b.close(); })();
