// Invita y gana: crear el enlace, llegar con él, comprar Premium y que quien invitó vea su premio y lo active.
require('./sin-bienvenida.js');
const path = require('path'), fs = require('fs');
const CAPTURAS = path.join(__dirname, 'capturas'); fs.mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
const T = async (p, sel) => ((await p.textContent(sel)) || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const estado = (p) => p.evaluate(() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.meses) return v; } catch (e) {} } return null; });
const salud = () => fetch(BASE + '/__salud').then((r) => r.json()).catch(() => ({}));

(async () => {
  const b = await chromium.launch(); const errs = [];
  const nueva = async () => {
    const c = await b.newContext({ viewport: { width: 420, height: 880 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.route('https://checkout.wompi.co/**', (r) => { const u = new URL(r.request().url()); p.__checkout = u; r.fulfill({ status: 302, headers: { Location: `${BASE}/__simular?ref=${u.searchParams.get('reference')}&monto=${u.searchParams.get('amount-in-cents')}&estado=APPROVED` } }); });
    return p;
  };
  // 1) Ana crea su enlace
  const ana = await nueva();
  await ana.goto(BASE, { waitUntil: 'networkidle' }); await ana.waitForTimeout(1200);
  await ana.keyboard.press('Escape');
  ok(!(await ana.evaluate(() => document.getElementById('btn-invita-menu').hidden)), 'en la web aparece "Invita y gana Premium"');
  await ana.evaluate(() => document.getElementById('btn-invita-menu').click()); await ana.waitForTimeout(300);
  ok(await ana.isVisible('#inv-crear') && !(await ana.isVisible('#inv-mio')), 'primero ofrece crear el enlace');
  await ana.click('#inv-crear'); await ana.waitForTimeout(800);
  const enlace = await ana.inputValue('#inv-enlace');
  ok(/\/#invita=AMIGO-[A-HJ-NP-Z2-9]{6}$/.test(enlace), 'crea el enlace: ' + enlace);
  ok(/Aún no tienes premios/.test(await T(ana, '#inv-premios')), 'sin premios todavía');
  const s = await estado(ana);
  ok(s.invita && s.invita.codigo && s.invita.llave && enlace.endsWith(s.invita.codigo), 'el código y su llave quedan en el presupuesto');
  await ana.click('#inv-copiar'); await ana.waitForTimeout(200);
  ok(/Copiado/.test(await T(ana, '#inv-copiar')), 'copia el enlace');
  await ana.screenshot({ path: path.join(CAPTURAS, 'invita.png') });
  await ana.keyboard.press('Escape');
  await ana.evaluate(() => document.getElementById('btn-invita-menu').click()); await ana.waitForTimeout(500);
  ok((await ana.inputValue('#inv-enlace')) === enlace, 'al volver, es el mismo enlace');
  await ana.keyboard.press('Escape');

  // 2) Bea llega con el enlace y compra
  const s0 = await salud();
  const bea = await nueva();
  await bea.goto(enlace.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: 'networkidle' }); await bea.waitForTimeout(1000);
  ok(!/invita=/.test(bea.url()) && (await bea.evaluate(() => window.FinInvita.invitadoPor())) === s.invita.codigo, 'guarda la invitación y limpia la dirección');
  await bea.keyboard.press('Escape');
  await bea.click('#btn-premium'); await bea.waitForTimeout(300);
  ok(await bea.isVisible('#inv-de'), 'en Premium le cuenta que llegó invitada');
  await bea.fill('#f-email', 'bea@correo.com'); await bea.check('#f-acepto-compra');
  await Promise.all([bea.waitForURL(/\?id=|\/$/), bea.click('#btn-pagar')]);
  await bea.waitForTimeout(2000);
  ok(!!(await bea.evaluate(() => localStorage.getItem('presupuesto-licencia'))), 'Bea queda con Premium');
  const s1 = await salud();
  ok(JSON.stringify(s1).split('referido').length > JSON.stringify(s0).split('referido').length || /referido/.test(JSON.stringify(s1)), 'se cuenta el referido');

  // 3) Ana ve su premio y lo activa para sí
  await ana.evaluate(() => document.getElementById('btn-invita-menu').click()); await ana.waitForTimeout(800);
  ok(/Una persona compró Premium con tu enlace/.test(await T(ana, '#inv-cuenta')) && /FIN-[A-Z2-9]{5}-[A-Z2-9]{5}/.test(await T(ana, '#inv-premios')), 'Ana ve su premio: ' + await T(ana, '#inv-premios'));
  const premio = (/FIN-[A-Z2-9]{5}-[A-Z2-9]{5}/.exec(await T(ana, '#inv-premios')) || [])[0];
  await ana.screenshot({ path: path.join(CAPTURAS, 'invita-premio.png') });
  await ana.click('[data-activar]'); await ana.waitForTimeout(600);
  ok(await ana.isVisible('#dlg-premium') && (await ana.inputValue('#f-regalo')) === premio, '"Activar para mí" lleva el código a Premium');
  await ana.fill('#f-regalo-email', 'ana@correo.com'); await ana.click('#btn-regalo'); await ana.waitForTimeout(1200);
  ok(/Ya tienes Premium/.test(await T(ana, '#web-status')), 'Ana activa Premium con su premio');
  await ana.keyboard.press('Escape'); await ana.waitForTimeout(300);
  await ana.evaluate(() => document.getElementById('btn-invita-menu').click()); await ana.waitForTimeout(800);
  ok(/Ya se usó/.test(await T(ana, '#inv-premios')) && !(await ana.$('[data-activar]')), 'y el premio aparece como usado');

  ok(!errs.length, 'sin errores en la página ' + errs.join(' | '));
  await b.close();
  if (fallas) { console.log(fallas + ' falla(s)'); process.exit(1); }
  console.log('invita y gana: todo bien');
})().catch((e) => { console.error(e); process.exit(1); });
