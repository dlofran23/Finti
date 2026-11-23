const CAPTURAS = require('path').join(__dirname, 'capturas'); require('fs').mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright'); const fs = require('fs');
const BASE = process.env.BASE;
async function nuevaPagina(b, estado) {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage(); p.__errs = []; p.on('pageerror', e => p.__errs.push(e.message));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.route('https://checkout.wompi.co/**', r => { const u = new URL(r.request().url()); p.__checkout = u; r.fulfill({ status: 302, headers: { Location: `${BASE}/__simular?ref=${u.searchParams.get('reference')}&monto=${u.searchParams.get('amount-in-cents')}&estado=${estado}` } }); });
  return p;
}
const ok2 = (c, m) => console.log((c ? 'ok - ' : 'FALLA - ') + m);
(async () => {
  const b = await chromium.launch();
  // 1) Compra aprobada
  const p = await nuevaPagina(b, 'APPROVED');
  await p.goto(BASE); await p.waitForTimeout(400);
  console.log('inicio:', await p.textContent('#save-status'), '| bloqueados:', await p.$$eval('.locked', l => l.length), '| IA oculta:', await p.isHidden('#sec-ia'), '| respaldo visible:', await p.isVisible('#backup-row'));
  await p.click('#btn-premium'); await p.waitForTimeout(300);
  console.log('ventana:', await p.textContent('#prem-msg'), '| compra visible:', await p.isVisible('#web-buy'), '| código oculto:', await p.isHidden('#redeem-row'));
  await p.fill('#f-email', 'ana@correo.com');
  // Sin la casilla de mayoría de edad y condiciones de compra no se va a Wompi
  await p.click('#btn-pagar'); await p.waitForTimeout(300);
  const sinCasilla = await p.textContent('#web-status');
  console.log(/mayor de edad/.test(sinCasilla) && !p.__checkout ? 'ok - sin la casilla no se paga' : 'FALLA - sin la casilla igual intentó pagar: ' + sinCasilla);
  await p.check('#f-acepto-compra');
  await Promise.all([p.waitForURL(/\?id=|\/$/), p.click('#btn-pagar')]);
  await p.waitForTimeout(1500);
  console.log('checkout firmado:', !!p.__checkout.searchParams.get('signature:integrity'), '| monto:', p.__checkout.searchParams.get('amount-in-cents'));
  console.log('tras pagar:', await p.textContent('#web-status'), '| botón:', (await p.textContent('#btn-premium')).trim(), '| url limpia:', p.url());
  const lic = await p.evaluate(() => JSON.parse(localStorage.getItem('presupuesto-licencia')));
  await p.click('#dlg-premium [data-close]');
  console.log('bloqueados ahora:', await p.$$eval('.locked', l => l.length));
  // El asesor (Premium) predice con las cifras de la persona, sin Claude
  await p.evaluate(() => { const s = document.getElementById('sec-ia'); let t = s; while (t && t !== document.body) { if (t.hidden) t.hidden = false; t = t.parentElement; } const d = document.getElementById('an-detalle'); if (d && d.getAttribute('aria-expanded') !== 'true') d.click(); });
  await p.waitForSelector('#ase-res .ase-cierre', { timeout: 5000 }).catch(() => {});
  const cierre = await p.textContent('#ase-res .ase-cierre').catch(() => '');
  const graf = await p.getAttribute('#ase-res .ase-graf', 'aria-label').catch(() => '');
  const pred = await p.$$eval('#ase-res .ase-pred li', l => l.map(x => x.textContent));
  const recs = await p.$$eval('#ase-res .ase-lista li', l => l.length);
  console.log(/Así cierras/.test(cierre) && /\$/.test(cierre) && /en 12 meses/.test(graf) && pred.length >= 3 && recs >= 2 ? 'ok - asesor predictivo: ' + graf + ' | ' + pred[0].slice(0, 80) : 'FALLA - asesor predictivo incompleto: ' + cierre.slice(0, 80) + ' | ' + graf + ' | ' + pred.length + ' | ' + recs);
  ok2(pred.some(x => /saldada en|a este ritmo toma más de/.test(x)) && pred.some(x => /probabilidad de lograrla/.test(x)), 'predice cuándo se saldan las deudas y la probabilidad de las metas');
  const antes = graf;
  // Condiciones: recortar gustos 30 % mejora el escenario más probable
  await p.evaluate(() => { document.getElementById('ase-cond').open = true; });
  const valor = (t) => { const m = /lo más probable es (−?\$\s?[\d.]+|-?\$\s?[\d.]+)/.exec(t || ''); return m ? +m[1].replace(/[^\d-−]/g, '').replace('−', '-') : NaN; };
  await p.$eval('#ase-recorte', (e) => { e.value = 30; e.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(400);
  const conRecorte = await p.getAttribute('#ase-res .ase-graf', 'aria-label');
  ok2(valor(conRecorte) > valor(antes), 'recortar gustos 30 % sube el escenario más probable (' + valor(antes) + ' → ' + valor(conRecorte) + ')');
  ok2((await p.textContent('#ase-v-recorte')).trim() === '30 %', 'el control muestra el valor elegido');
  await p.click('#ase-cond [data-h="24"]'); await p.waitForTimeout(400);
  ok2(/en 24 meses/.test(await p.getAttribute('#ase-res .ase-graf', 'aria-label')) && (await p.$$eval('#ase-res .ase-graf .ase-eje', l => l.length)) > 3, 'cambia el horizonte a 24 meses');
  const sinIA = await p.evaluate(() => /Claude|inteligencia artificial/i.test(document.getElementById('ia-body').textContent));
  console.log(sinIA ? 'FALLA - el asesor menciona Claude o IA' : 'ok - el asesor no depende de Claude');
  // El asesor acompaña, no regaña: primero lo que va bien, ideas con "Me sirve / No es para mí" y aprende de eso
  const titulos = await p.$$eval('#ase-res .ase-h', l => l.map(x => x.textContent));
  ok2(titulos.some(t => /Lo que aprendí de ti/.test(t)) && titulos.some(t => /Ideas para ti/.test(t)) && titulos.some(t => /Tu camino a/.test(t)), 'secciones del asesor: ' + titulos.join(' | '));
  ok2(!/te pasaste|excediste|regañ|mal hecho|deberías|irresponsable/i.test(await p.textContent('#ia-body')), 'el tono no regaña');
  ok2(await p.isVisible('#ase-res .ase-apr'), 'sin movimientos todavía: explica qué va a aprender y muestra el avance');
  const clave = await p.getAttribute('#ase-res .ase-lista li[data-clave]', 'data-clave');
  await p.click('#ase-res .ase-lista li[data-clave="' + clave + '"] [data-fb="no"]'); await p.waitForTimeout(600);
  ok2(!(await p.$('#ase-res .ase-lista li[data-clave="' + clave + '"]')) && await p.isVisible('#ase-res [data-ase-reset]'), '"No es para mí" oculta la idea (' + clave + ') y ofrece volver a mostrarla');
  const otra = await p.getAttribute('#ase-res .ase-lista li[data-clave]', 'data-clave');
  await p.click('#ase-res .ase-lista li[data-clave="' + otra + '"] [data-fb="si"]'); await p.waitForTimeout(200);
  ok2((await p.textContent('#ase-res .ase-lista li[data-clave="' + otra + '"] [data-fb="si"]')) === 'Te sirvió', '"Me sirve" queda marcado');
  await p.reload(); await p.waitForTimeout(800);
  await p.evaluate(() => { const s = document.getElementById('sec-ia'); let t = s; while (t && t !== document.body) { if (t.hidden) t.hidden = false; t = t.parentElement; } const d = document.getElementById('an-detalle'); if (d && d.getAttribute('aria-expanded') !== 'true') d.click(); });
  await p.waitForSelector('#ase-res .ase-h', { timeout: 5000 }).catch(() => {});
  ok2(!(await p.$('#ase-res .ase-lista li[data-clave="' + clave + '"]')) && (await p.textContent('#ase-res .ase-lista li[data-clave="' + otra + '"] [data-fb="si"]').catch(() => '')) === 'Te sirvió', 'lo que aprendió se guarda al recargar');
  await p.click('#ase-res [data-ase-reset]'); await p.waitForTimeout(300);
  ok2(!!(await p.$('#ase-res .ase-lista li[data-clave="' + clave + '"]')), 'se pueden volver a mostrar las ideas ocultas');
  // Excel y respaldo
  const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#btn-mas').then(() => p.click('#btn-xlsx'))]);
  await d1.saveAs(require('path').join(CAPTURAS, 'descarga.xlsx')); console.log('excel:', d1.suggestedFilename(), fs.statSync(require('path').join(CAPTURAS, 'descarga.xlsx')).size, 'bytes');
  const [d2] = await Promise.all([p.waitForEvent('download'), p.click('#btn-mas').then(() => p.click('#btn-export'))]);
  await d2.saveAs(require('path').join(CAPTURAS, 'respaldo.json')); console.log('respaldo:', d2.suggestedFilename());
  // recarga: la licencia se revalida con el servidor y sigue activa
  await p.reload(); await p.waitForTimeout(800);
  console.log('tras recargar:', (await p.textContent('#btn-premium')).trim());
  // 2) Otro dispositivo: recuperar con referencia + correo, e importar respaldo
  const q = await nuevaPagina(b, 'APPROVED');
  await q.goto(BASE); await q.waitForTimeout(400);
  await q.setInputFiles('#f-import', require('path').join(CAPTURAS, 'respaldo.json')); await q.waitForTimeout(300);
  console.log('importar:', await q.textContent('#backup-status'));
  await q.click('#btn-premium'); await q.click('#web-restore summary');
  await q.fill('#f-ref', lic.ref); await q.fill('#f-email2', 'otra@correo.com'); await q.click('#btn-restaurar'); await q.waitForTimeout(500);
  console.log('correo equivocado:', await q.textContent('#web-status'));
  await q.fill('#f-email2', 'ANA@correo.com'); await q.click('#btn-restaurar'); await q.waitForTimeout(500);
  console.log('recuperar:', await q.textContent('#web-status'), '|', (await q.textContent('#btn-premium')).trim());
  // Patrones: con un historial de movimientos el asesor aprende días, horas, pagos que se repiten y cuánto se puede disfrutar
  {
    const r0 = JSON.parse(fs.readFileSync(require('path').join(CAPTURAS, 'respaldo.json'), 'utf8')), st = r0.state, hoy = new Date();
    const f = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const k = f(hoy).slice(0, 7), m0 = st.meses[st.mes]; st.ejemplo = false; st.meses = { [k]: m0 }; st.mes = k;
    m0.gastos.forEach(g => { g.real = g.dia > 0 && g.dia <= hoy.getDate() ? g.plan : 0; }); m0.ingresos.forEach((x, i) => { x.real = i ? 0 : x.plan; });
    const movs = []; let n = 0;
    for (let i = 70; i >= 0; i--) {
      const d = new Date(hoy); d.setDate(d.getDate() - i); const s = f(d);
      const veces = d.getDay() === 5 ? 4 : (i % 3 === 0 ? 1 : 0);
      for (let j = 0; j < veces; j++) movs.push({ id: 'v' + n++, f: s, h: 21, t: 'g', cat: 'ocio', c: 'Salida', m: 45000 + j * 1000, com: 'Bar ' + j });
      if (d.getDate() === 3) movs.push({ id: 'v' + n++, f: s, h: 9, t: 'g', cat: 'suscripciones', c: 'Spotify', m: 16900, com: 'Spotify' });
    }
    st.movs = movs; fs.writeFileSync(require('path').join(CAPTURAS, 'respaldo-patrones.json'), JSON.stringify(r0));
    await q.click('#dlg-premium [data-close]').catch(() => {});
    await q.setInputFiles('#f-import', require('path').join(CAPTURAS, 'respaldo-patrones.json')); await q.waitForTimeout(500);
    await q.evaluate(() => { const s = document.getElementById('sec-ia'); let t = s; while (t && t !== document.body) { if (t.hidden) t.hidden = false; t = t.parentElement; } const d = document.getElementById('an-detalle'); if (d && d.getAttribute('aria-expanded') !== 'true') d.click(); });
    await q.waitForSelector('#ase-res .ase-pat', { timeout: 5000 }).catch(() => {});
    const pats = await q.$$eval('#ase-res .ase-pat li b', l => l.map(x => x.textContent));
    ok2(pats.some(t => /viernes/.test(t)), 'aprende el día en que más gasta: ' + pats.join(' | '));
    ok2(pats.some(t => /se repite/.test(t)) || (await q.isVisible('#ase-res [data-ase-mas]')), 'detecta pagos que se repiten cada mes');
    if (await q.isVisible('#ase-res [data-ase-mas]')) { await q.click('#ase-res [data-ase-mas]'); await q.waitForTimeout(100); }
    const todos = await q.$$eval('#ase-res .ase-pat li', l => l.filter(x => !x.hidden).map(x => x.textContent));
    ok2(todos.some(t => /Spotify/.test(t)) && todos.some(t => /de noche/.test(t)), 'muestra todo lo aprendido: suscripción y compras de noche');
    const disf = await q.textContent('#ase-res .ase-disf').catch(() => '');
    ok2(/Para disfrutar sin culpa/i.test(disf) && /\$/.test(disf), 'calcula cuánto puede disfrutar sin culpa: ' + disf.replace(/\s+/g, ' ').slice(0, 90));
    ok2(!q.__errs.length, 'sin errores en el asesor con patrones');
  }
  // 3) Pago rechazado
  const r = await nuevaPagina(b, 'DECLINED');
  await r.goto(BASE); await r.waitForTimeout(300); await r.click('#btn-premium'); await r.fill('#f-email', 'leo@correo.com'); await r.check('#f-acepto-compra');
  await Promise.all([r.waitForURL(/\?id=|\/$/), r.click('#btn-pagar')]); await r.waitForTimeout(1500);
  console.log('rechazado:', await r.textContent('#web-status'), '|', (await r.textContent('#btn-premium')).trim());
  // 4) Licencia falsificada se revoca
  const s = await nuevaPagina(b, 'APPROVED');
  await s.goto(BASE); await s.evaluate(r => localStorage.setItem('presupuesto-licencia', JSON.stringify({ ref: r, token: 'falso' })), lic.ref);
  await s.reload(); await s.waitForTimeout(800);
  console.log('licencia falsa:', (await s.textContent('#btn-premium')).trim());
  await s.screenshot({ path: CAPTURAS + '/web-free.png' });
  await p.click('#btn-premium'); await p.waitForTimeout(200); await p.screenshot({ path: CAPTURAS + '/web-premium.png' });
  console.log('errores:', [p, q, r, s].map(x => x.__errs).flat());
  await b.close();
})();
