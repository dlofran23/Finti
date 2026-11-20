const CAPTURAS = require('path').join(__dirname, 'capturas'); require('fs').mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright');
const BASE = process.env.BASE;
const esp=ms=>new Promise(r=>setTimeout(r,ms));
let ok=0,fail=0; const c=(n,v)=>{ if(v){ok++;} else {fail++; console.log('FALLA',n);} };
(async()=>{
  const b=await chromium.launch(); const errs=[];
  // Celular
  const m=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  m.on('pageerror',e=>errs.push(e.message));
  await m.addInitScript(()=>{try{localStorage.setItem('fintelligente-bienvenida','1');sessionStorage.setItem('fintelligente-sin-cuenta','1')}catch(e){}});
  await m.goto(BASE,{waitUntil:'networkidle'}); await esp(700);
  c('cel: fab oculto', !(await m.isVisible('#fab-add')));
  c('cel: tabs no visibles fuera del menú', !(await m.isVisible('#tabs button[data-tab]')));
  c('cel: barra de abajo con 5 botones', await m.isVisible('#barra') && (await m.$$eval('#barra > button', l => l.length)) === 5);
  c('cel: ☰ y + de arriba ocultos (viven en la barra)', !(await m.isVisible('#btn-menu')) && !(await m.isVisible('#btn-registrar-top')));
  c('cel: la barra no tapa el contenido (queda espacio abajo)', await m.$eval('.wrap', e => parseFloat(getComputedStyle(e).paddingBottom) >= 90));
  await m.screenshot({path: CAPTURAS + '/prev-cel-1.png'});
  await m.click('#barra [data-ir="movimientos"]'); await esp(700);
  c('cel: la barra cambia de vista', await m.isVisible('[data-view="movimientos"]') && (await m.getAttribute('#barra [data-ir="movimientos"]', 'aria-current')) === 'page');
  // Desde el 19-nov-2026 la luz es el punto azul de Finti, que viaja y se estira de una pestaña a otra
  await esp(700);
  const luz = await m.$eval('#barra-luz', e => { const a = e.getBoundingClientRect(), b = document.querySelector('#barra [data-ir="movimientos"]').getBoundingClientRect(); return { d: Math.abs((a.left + a.width / 2) - (b.left + b.width / 2)), w: a.width }; });
  c('cel: el punto azul queda bajo la pestaña elegida (' + luz.d.toFixed(1) + ' px)', luz.d < 3 && luz.w <= 8);
  await m.click('#barra-mas'); await esp(500);
  c('cel: Más abre el menú', await m.$eval('#lateral',e=>e.classList.contains('abierta')));
  c('cel: fondo visible', await m.isVisible('#lat-fondo'));
  await m.screenshot({path: CAPTURAS + '/prev-cel-2.png'});
  await m.click('#lateral #tabs button[data-tab="analisis"]'); await esp(500);
  c('cel: tab del menú cambia y cierra; Más queda marcado', !(await m.$eval('#lateral',e=>e.classList.contains('abierta'))) && (await m.getAttribute('#barra-mas', 'aria-current')) === 'page');
  await m.click('#barra-mas'); await esp(300); await m.keyboard.press('Escape'); await esp(300);
  c('cel: Escape cierra', !(await m.$eval('#lateral',e=>e.classList.contains('abierta'))));
  await m.click('#barra-registrar'); await esp(400);
  const dlgAbierto = await m.evaluate(()=>[...document.querySelectorAll('dialog,[role=dialog],.sheet')].some(d=>d.open || (!d.hidden && d.offsetParent)));
  c('cel: + abre registro', dlgAbierto);
  await m.screenshot({path: CAPTURAS + '/prev-cel-3.png'});
  await m.keyboard.press('Escape'); await esp(300);
  await m.click('#barra-mas'); await esp(300);
  await m.click('#lateral [data-clic="btn-avisos-menu"]'); await esp(400);
  c('cel: avisos abre', await m.evaluate(()=>{const d=document.getElementById('dlg-avisos');return !!d && (d.open||!d.hidden);}));
  // Computador
  const d=await b.newPage({viewport:{width:1280,height:800}});
  d.on('pageerror',e=>errs.push(e.message));
  await d.addInitScript(()=>{try{localStorage.setItem('fintelligente-bienvenida','1');sessionStorage.setItem('fintelligente-sin-cuenta','1')}catch(e){}});
  await d.goto(BASE,{waitUntil:'networkidle'}); await esp(700);
  const box=await d.$eval('#lateral',e=>{const r=e.getBoundingClientRect();return [r.left,r.width,r.height]});
  c('pc: lateral fija', box[0]===0 && box[1]>240 && box[2]>700);
  c('pc: fab oculto', !(await d.isVisible('#fab-add')));
  c('pc: ☰ oculto', !(await d.isVisible('#btn-menu')));
  c('pc: sin barra de abajo', !(await d.isVisible('#barra')));
  c('pc: registrar visible', await d.isVisible('#lat-registrar'));
  const wl=await d.$eval('.wrap',e=>e.getBoundingClientRect().left); c('pc: contenido a la derecha', wl>=252);
  await d.screenshot({path: CAPTURAS + '/prev-pc.png'});
  await d.click('#lat-registrar'); await esp(400);
  await d.screenshot({path: CAPTURAS + '/prev-pc-2.png'});
  // Tabletas y pantallas medianas: nada se sale de lado (antes, de 761 a 1023 px, la lateral fija y la barra de arriba no cabían).
  for (const w of [820, 900, 1024, 1100]) {
    const t=await b.newPage({viewport:{width:w,height:1000}}); t.on('pageerror',e=>errs.push(e.message));
    await t.addInitScript(()=>{try{localStorage.setItem('fintelligente-bienvenida','1');sessionStorage.setItem('fintelligente-sin-cuenta','1')}catch(e){}});
    await t.goto(BASE,{waitUntil:'networkidle'}); await esp(500); await t.keyboard.press('Escape');
    for (const tab of ['inicio','movimientos','analisis']) {
      await t.evaluate((x)=>document.querySelector('[data-tab="'+x+'"]').click(), tab); await esp(250);
      const sw=await t.evaluate(()=>document.documentElement.scrollWidth);
      c(w+' px, '+tab+': sin desborde horizontal ('+sw+')', sw<=w);
    }
    c(w+' px: lateral '+(w>=1024?'fija':'como menú'), w>=1024 ? await t.isVisible('#lat-registrar') : await t.isVisible('#btn-menu'));
    await t.close();
  }
  console.log('errores js:',errs); c('sin errores', errs.length===0);
  console.log(ok,'ok',fail,'fallas'); await b.close();
})();
