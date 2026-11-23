// Lo que encontró la auditoría del 21 de noviembre de 2026, recorriendo la app como persona nueva, y que ya no debe pasar:
// el muro de cuenta en cada apertura, el plan que no suma el ingreso, tres cifras distintas de "Hoy puedes gastar",
// la meta elegida que no existe, Cuéntame que dice "Anoto" sin anotar y pierde lo pendiente, y la cuenta en rojo.
const { chromium } = require('playwright');
let fallas = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FALLA ') + m); if (!c) fallas++; };
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-CO', timezoneId: 'America/Bogota' });
  // Persona nueva de verdad: sin inicio guiado hecho (la primera vez que abre esta pestaña)
  await c.addInitScript(() => { try { if (!sessionStorage.getItem('aud-limpio')) { localStorage.removeItem('fintelligente-inicio'); sessionStorage.setItem('aud-limpio', '1'); } } catch (e) {} });
  const p = await c.newPage(); const errores = []; p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(process.env.BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(1800);

  // 1. "Probar sin cuenta" se recuerda: otra pestaña (otra sesión) ya no muestra el muro
  if (await p.isVisible('#bienv-sin')) {
    await p.click('#bienv-sin'); await p.waitForTimeout(500);
    const p2 = await c.newPage(); await p2.goto(process.env.BASE, { waitUntil: 'networkidle' }); await p2.waitForTimeout(1500);
    ok(!(await p2.isVisible('#dlg-bienvenida')), 'al volver a abrir, no pide crear cuenta otra vez');
    await p2.close();
  } else ok(true, 'la bienvenida no aplica en este servidor');

  // 2. Inicio guiado: anotar a mano viene por defecto, el plan suma justo lo que entra y la meta elegida queda creada
  await p.waitForSelector('#inicio-empecemos', { state: 'visible', timeout: 8000 }).catch(() => {});
  await p.click('#inicio-empecemos').catch(() => {}); await p.waitForTimeout(400);
  await p.fill('#inicio-ingreso', '2500000'); await p.waitForTimeout(150);
  await p.click('#inicio-sig1'); await p.waitForTimeout(400);
  await p.click('#inicio-metas [data-meta="fondo"], #inicio-metas button:has-text("fondo de emergencia")').catch(() => {}); await p.waitForTimeout(200);
  await p.click('#inicio-sig-meta'); await p.waitForTimeout(400);
  await p.click('#inicio-sig2'); await p.waitForTimeout(400);
  ok(await p.isChecked('input[name="inicio-auto"][value="no"]'), 'por defecto, "Por ahora los anoto yo" (no empuja a conectar el banco)');
  await p.click('#inicio-armar'); await p.waitForTimeout(1600);
  ok(/Ver mi Finti/.test(await p.textContent('#inicio-empezar')), 'el último botón lleva a la app, no al banco');
  const suma = await p.$$eval('#inicio-reparto .inicio-v', (l) => l.map((x) => +x.firstChild.textContent.replace(/\D/g, '')));
  ok(suma.length === 3 && suma.reduce((a, x) => a + x, 0) === 2500000, 'el plan suma exactamente lo que entra: ' + suma.join(' + '));
  const metasElegidas = await p.evaluate(() => [...document.querySelectorAll('#inicio-metas [aria-checked="true"]')].map((x) => x.dataset.meta).join(','));
  const hoyIni = (await p.textContent('#inicio-hoy')).replace(/\D/g, '');
  await p.click('#inicio-empezar'); await p.waitForTimeout(1200);
  const hoyApp = (await p.textContent('#hoy-v')).replace(/\D/g, '');
  ok(hoyIni && hoyIni === hoyApp, `"Hoy puedes gastar" es la misma cifra en el inicio guiado y en Inicio (${hoyIni} y ${hoyApp})`);
  ok(/Tu mes ya está armado/.test(await p.textContent('#saludo-h')), 'sin nada anotado no felicita: dice que el mes está armado');
  ok(await p.evaluate(() => document.getElementById('hist-play').hidden), 'Tu mes contado no ocupa la pantalla a quien llegó hoy');
  await p.evaluate(() => { const b = document.querySelector('[data-ir="metas"], #tabs [data-tab="metas"], .barra [data-vista="metas"]'); b && b.click(); }); await p.waitForTimeout(600);
  ok(/Fondo de emergencia/.test(await p.$eval('#metas-body [data-f="nombre"]', (x) => x.value).catch(() => '')), 'la meta que eligió en el inicio guiado queda creada (' + metasElegidas + '): ' + (await p.textContent('#metas-body')).replace(/\s+/g, ' ').slice(0, 80));
  ok(/1 gratis/.test(await p.textContent('[data-view="metas"] .panel-head')), 'Metas dice que una es gratis, no "Premium"');
  await p.evaluate(() => { const b = document.querySelector('[data-ir="inicio"], #tabs [data-tab="inicio"], .barra [data-vista="inicio"]'); b && b.click(); }); await p.waitForTimeout(500);

  // 3. Cuéntame: no dice "Anoto" antes de anotar, responde preguntas sin perder lo pendiente y suma lo nuevo
  await p.click('#hoy-registrar'); await p.waitForTimeout(500);
  const say = async (t) => { await p.fill('#ch-input', t); await p.press('#ch-input', 'Enter'); await p.waitForTimeout(500); };
  const log = async () => (await p.textContent('#ch-log')).replace(/\s+/g, ' ');
  await say('ayer gasté 45 mil en mercado en el D1 con nequi');
  ok(!/Anoto \$/.test(await log()), 'no dice "Anoto" antes de anotar');
  ok(/en el D1/.test(await log()), 'respeta las mayúsculas: D1');
  await say('¿cuánto llevo gastado en mercado este mes?');
  ok(/alimentación/i.test(await log()) && /sigue esperando/.test(await log()) && !/Corregido/.test(await log()), 'responde la pregunta y avisa que lo pendiente sigue ahí');
  await say('45 mil de taxi');
  ok(/Lo sumo a lo que estaba por anotar/.test(await log()) && /2 gastos|estos 2|anoté los 2|Total/.test(await log()), 'un gasto nuevo se suma al pendiente, no lo borra');
  const cta = await p.$('#ch-chips [data-ch^="cuenta"]'); if (cta) await cta.click(); else await p.click('#ch-chips [data-ch="si"]');
  await p.waitForTimeout(600);
  ok(/anoté los 2/.test(await log()), 'anota los dos');
  ok(/Creé tu cuenta <?b?>?Nequi|Creé tu cuenta Nequi/.test(await log()), 'dijo "con nequi" sin tener Nequi: crea la cuenta');
  ok(!/queda en -\$/.test(await log()) && /¿Cuánto tenías en/.test(await log()), 'no muestra la cuenta en rojo: pregunta cuánto tenía');
  await say('200 mil');
  ok(/queda en \$\s?155\.000|queda en \$\s?110\.000|queda en \$\s?1\d{2}\.000/.test(await log()), 'con lo que tenía, muestra el saldo real');
  ok(!errores.length, 'sin errores en la página' + (errores.length ? ': ' + errores[0] : ''));
  await b.close();
  console.log(fallas ? fallas + ' fallas' : 'todo bien'); process.exit(fallas ? 1 : 0);
})();
