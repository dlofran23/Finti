const BASE = process.env.BASE;
const CAPTURAS = require('path').join(__dirname, 'capturas'); require('fs').mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright');
const ok = (c, m) => { if (!c) { console.log('FALLA:', m); process.exitCode = 1; } else console.log('ok -', m); };
const KEY = 'presupuesto-web-sin-cuenta';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } }); await p.addInitScript(() => { try { sessionStorage.setItem('fintelligente-sin-cuenta', '1'); } catch (e) {} }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.addInitScript(() => { const D = Date, fixed = new D(2026, 9, 27, 10, 0).getTime(); Date = class extends D { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } }; });
  await p.goto(BASE + '/'); await p.waitForTimeout(600);
  const pegar = async (t) => { await p.fill('#pegar-texto', t); await p.click('#pegar-leer'); await p.waitForTimeout(150); };
  const st = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  await p.click('#btn-mas'); await p.click('#btn-bandeja-menu'); await p.waitForTimeout(200);
  // 1) Salida en Bancolombia + entrada en Nequi por el mismo monto → un solo traslado
  await pegar('Bancolombia le informa Transferencia por $200.000 desde cta *4521 a cta 0012345678 09:14. 27/10/2026');
  await pegar('Nequi: Recibiste $200.000 de ANA PEREZ. 27/10/2026');
  ok(await p.locator('#bandeja-lista .mov').count() === 1, 'los dos avisos quedan como un solo movimiento');
  const mov = p.locator('#bandeja-lista .mov').first();
  ok((await mov.textContent()).includes('También llegó el aviso de entrada de Nequi'), 'explica que los unió');
  ok(await mov.locator('[data-f="propio"]').isChecked(), '«Es entre mis cuentas» activado');
  ok(await mov.locator('[data-f="desde"]').inputValue() === 'a1' && await mov.locator('[data-f="hacia"]').inputValue() === 'a2', 'de Cuenta de ahorros a Nequi');
  ok(await p.locator('#bandeja-lista [data-f="cat"]').count() === 0, 'sin categoría: no es gasto');
  const s0 = await st(); const gas0 = Object.values(s0.meses)[0].gastos.reduce((a, r) => a + r.real, 0), ing0 = Object.values(s0.meses)[0].ingresos.reduce((a, r) => a + r.real, 0);
  await mov.locator('[data-confirmar]').click(); await p.waitForTimeout(300);
  let s1 = await st();
  ok(s1.cuentas.find(c => c.id === 'a1').saldo === 1850000 - 200000 && s1.cuentas.find(c => c.id === 'a2').saldo === 320000 + 200000, 'saldos: ahorros −200.000, Nequi +200.000');
  ok(Object.values(s1.meses)[0].gastos.reduce((a, r) => a + r.real, 0) === gas0 && Object.values(s1.meses)[0].ingresos.reduce((a, r) => a + r.real, 0) === ing0, 'gastos e ingresos del mes no cambian');
  ok(s1.pendientes.length === 0, 'se fueron los dos avisos');
  ok(s1.propios.includes('cta 0012345678'), 'aprendió la cuenta destino como propia');
  // 2) La próxima transferencia a esa cuenta ya se reconoce sola
  await pegar('Bancolombia le informa Transferencia por $80.000 desde cta *4521 a cta 0012345678 18:02. 27/10/2026');
  ok(await p.locator('#bandeja-lista .mov [data-f="propio"]').first().isChecked(), 'reconoce sola la cuenta aprendida');
  await p.locator('#bandeja-lista .mov [data-descartar]').first().click(); await p.waitForTimeout(150);
  // 3) Unidos por error: al apagar el interruptor se separan y cada uno vuelve a su tipo
  await pegar('Enviaste $60.000 a LUIS GOMEZ. 27/10/2026');
  await pegar('Bancolombia le informa abono de nomina por $60.000 en su cta *4521 27/10/2026');
  ok(await p.locator('#bandeja-lista .mov').count() === 1, 'monto igual el mismo día: se unen');
  await p.locator('#bandeja-lista .mov [data-f="propio"]').first().uncheck(); await p.waitForTimeout(200);
  ok(await p.locator('#bandeja-lista .mov').count() === 2, 'al decir que no, vuelven a ser dos');
  const txt = (await p.textContent('#bandeja-lista')).replace(/ /g, ' ');
  ok(txt.includes('−$ 60.000') && txt.includes('+$ 60.000'), 'un gasto y un ingreso');
  // 4) Marcar a mano un envío como propio
  await p.locator('#bandeja-lista .mov', { hasText: 'Luis Gomez' }).locator('[data-descartar]').click();
  await p.locator('#bandeja-lista .mov [data-descartar]').first().click(); await p.waitForTimeout(150);
  await pegar('Enviaste $90.000 a ANA PEREZ. 27/10/2026');
  const ana = p.locator('#bandeja-lista .mov', { hasText: 'Ana Perez' });
  await ana.locator('[data-f="propio"]').check(); await p.waitForTimeout(150);
  await p.locator('#bandeja-lista .mov', { hasText: 'Ana Perez' }).locator('[data-f="desde"]').selectOption('a2');
  await p.locator('#bandeja-lista .mov', { hasText: 'Ana Perez' }).locator('[data-f="hacia"]').selectOption('a1');
  await p.locator('#bandeja-lista .mov', { hasText: 'Ana Perez' }).locator('[data-confirmar]').click(); await p.waitForTimeout(250);
  s1 = await st();
  ok(s1.propios.includes('ana perez'), 'aprendió que Ana Perez eres tú en otro banco');
  ok(s1.cuentas.find(c => c.id === 'a1').saldo === 1650000 + 90000 && s1.cuentas.find(c => c.id === 'a2').saldo === 520000 - 90000, 'de Nequi −90.000 a ahorros +90.000');
  await p.screenshot({ path: CAPTURAS + '/v7-traslado.png' });
  ok(errs.length === 0, 'sin errores ' + JSON.stringify(errs));
  await b.close();
})();
