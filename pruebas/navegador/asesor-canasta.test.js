// El asesor aprovecha lo que la persona cuenta producto por producto: recuerda precios y lugares, avisa al guardar si
// algo subió o bajó, responde en Pregúntale por un producto, por el mercado y con consejos, y las frases que Finti no
// entiende se guardan en el teléfono (solo salen si la persona las comparte).
require('./sin-bienvenida.js');
const { chromium } = require('playwright'); const pagarCon = require('./_pagar-con.js');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const estado = () => p.evaluate(() => { const K = Object.keys(localStorage).find((k) => /sin-cuenta$/.test(k)); return JSON.parse(localStorage.getItem(K)); });
  const ultimo = () => p.evaluate(() => { const l = document.querySelectorAll('#ch-log .ch-msg.app, #ch-log .pr-msg.app, #ch-log > div'); return l.length ? l[l.length - 1].textContent : ''; });
  async function contar(txt) {
    await p.click('#hoy-registrar'); await p.waitForTimeout(400);
    await p.fill('#ch-input', txt); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(500);
    await pagarCon(p); await p.click('#ch-chips [data-ch="si"]'); await p.waitForTimeout(500);
    const t = await ultimo();
    await p.click('#ch-chips [data-ch="cerrar"]'); await p.waitForTimeout(300);
    return t;
  }

  // ---------- Memoria de precios al guardar ----------
  await contar('ayer en el Ara compré leche de 3.900, arroz de 4.200 y pan de 3.000');
  let t = await contar('hoy en el D1 compré leche de 4.600, arroz de 4.200 y huevos de 13 mil');
  ok(/Leche subió: te salió a \$\s?4\.600 y la vez pasada en Ara estaba a \$\s?3\.900/.test(t), 'al guardar avisa que la leche subió frente a la compra en Ara (' + t.slice(0, 160) + ')');
  t = await contar('en el Ara compré leche de 3.800 y pan de 3.000');
  ok(/¡Buena compra! Leche te salió a \$\s?3\.800, \$\s?800 menos que la vez pasada en D1/.test(t), 'y celebra cuando sale más barata');
  ok((await p.evaluate(() => window.FinIdeas())).includes('canasta-lugar:leche'), 'el asesor propone comprar la leche donde sale más barata');

  // ---------- "No me entendiste" en la charla ----------
  await p.click('#hoy-registrar'); await p.waitForTimeout(400);
  await p.fill('#ch-input', 'blablá cosas raras sin plata'); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(400);
  await p.click('#ch-chips [data-ch="noent"]'); await p.waitForTimeout(400);
  ok((await estado()).noEntendi.some((x) => x.t === 'blablá cosas raras sin plata' && x.de === 'charla'), 'la frase que no entendió queda guardada en el teléfono');
  await p.fill('#ch-input', 'taxi de 12'); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(400);
  ok(await p.$('#ch-chips [data-ch="noent"]') !== null && /12\.000/.test(await ultimo()), 'en la tarjeta también se puede decir "No me entendiste" (y "taxi de 12" son $ 12.000)');
  await p.click('#ch-chips [data-ch="no"]'); await p.waitForTimeout(200);
  await p.click('#ch-chips [data-ch="cerrar"]').catch(() => p.keyboard.press('Escape')); await p.waitForTimeout(300);

  // ---------- Pregúntale como asesor ----------
  await p.evaluate(() => document.getElementById('btn-preguntas-menu').click()); await p.waitForTimeout(400);
  async function preguntar(q) {
    await p.fill('#pr-input', q); await p.press('#pr-input', 'Enter'); await p.waitForTimeout(800);
    return p.evaluate(() => { const l = document.querySelectorAll('#pr-log .pr-msg.app'); return l[l.length - 1].textContent; });
  }
  t = await preguntar('¿Dónde me sale más barata la leche?');
  ok(/Donde te ha salido más barato: Ara/.test(t) && /D1/.test(t), 'dice dónde le sale más barata la leche (' + t.slice(0, 120) + ')');
  t = await preguntar('¿Qué es lo que más compro?');
  ok(/Leche/.test(t) && /Huevos/.test(t), 'lista lo que más compra');
  t = await preguntar('¿Cómo puedo ahorrar en el mercado?');
  ok(/más barato en Ara/.test(t) && /lista/.test(t), 'consejos del mercado con sus números');
  t = await preguntar('¿Debería sacar un crédito?');
  ok(/30 %/.test(t) && /no una asesoría financiera profesional/.test(t), 'el consejo de crédito usa la regla del 30 % y aclara que es una guía');
  t = await preguntar('¿Cuánto debería ahorrar al mes?');
  ok(/entre el 10 % y el 20 %/.test(t), 'cuánto ahorrar: entre el 10 % y el 20 %');
  t = await preguntar('¿Qué me recomiendas?');
  ok(await p.evaluate(() => { const l = document.querySelectorAll('#pr-log .pr-msg.app'); return l[l.length - 1].querySelectorAll('li').length >= 1; }), 'qué me recomiendas: ideas del asesor');
  await preguntar('zzz qwerty asdf');
  await p.click('#pr-chips [data-no-entendi]'); await p.waitForTimeout(300);
  ok((await estado()).noEntendi.some((x) => x.de === 'pregunta' && x.t === 'zzz qwerty asdf'), 'la pregunta que no entendió también se puede guardar');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  // ---------- Las frases guardadas: verlas, borrarlas, compartirlas ----------
  await p.evaluate(() => document.getElementById('btn-aprendidas-menu').click()); await p.waitForTimeout(400);
  ok(!(await p.$eval('#ne-sec', (e) => e.hidden)) && (await p.$$('#ne-lista li')).length === 2, 'en Palabras que aprendí se ven las 2 frases que no entendió');
  await p.click('#ne-lista [data-ne-borrar]'); await p.waitForTimeout(300);
  ok((await estado()).noEntendi.length === 1, 'se puede borrar una frase');

  if (errs.length) ok(false, 'errores en la página: ' + errs.join(' | '));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien');
  process.exit(fallas ? 1 : 0);
})();
