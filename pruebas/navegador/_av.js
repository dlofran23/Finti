require('./sin-bienvenida.js');
const { chromium } = require('playwright'); const casos = require('/tmp/avisos-corpus.json');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://localhost:18902', { waitUntil: 'networkidle' }); await p.waitForTimeout(1000);
  const res = await p.evaluate((casos) => casos.map(([t, tipo, monto, com]) => { const r = window.FinLector.leerAviso(t, { hoy: new Date(2026, 10, 16) }); const cat = window.FinLector.sugerirCategoria(r, {}); return { t, tipo, monto, com, r: { ok: r.ok, tipo: r.tipo, monto: r.monto, comercio: r.comercio, fecha: r.fecha, medio: r.medio, banco: r.banco, motivo: r.motivo, cat: cat.cat } }; }), casos);
  let malos = 0;
  res.forEach((x) => { const bien = (x.tipo === '' ? !x.r.ok : (x.r.ok && x.r.tipo === x.tipo && x.r.monto === x.monto && (!x.com || (x.r.comercio || '').toLowerCase().replace(/\s+/g, ' ') === x.com.toLowerCase()))); if (!bien) { malos++; console.log('✗ ' + x.t.slice(0, 95) + '\n    esperado: ' + [x.tipo, x.monto, x.com].join(' | ') + '\n    leído:    ' + [x.r.tipo || x.r.motivo, x.r.monto, x.r.comercio, x.r.fecha, x.r.medio, x.r.banco, x.r.cat].join(' | ')); } });
  console.log(malos + ' de ' + res.length + ' con algo distinto'); await b.close(); })();
