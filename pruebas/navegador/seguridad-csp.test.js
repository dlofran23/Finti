const BASE = process.env.BASE;
// Recorre la app con la CSP de producción y falla si el navegador bloquea algo.
const { chromium } = require('playwright');
const FAKE_GIS = `window.google={accounts:{id:{initialize:function(o){window.__gcb=o.callback;},renderButton:function(el){var b=document.createElement('button');b.type='button';b.textContent='Continuar con Google';el.appendChild(b);},prompt:function(){},disableAutoSelect:function(){}}}};`;
(async()=>{ const b=await chromium.launch(); const errs=[], bloqueos=[];
 for (const [nombre, dev] of [['celular',{viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'}],['computador',{viewport:{width:1280,height:850},acceptDownloads:true}]]) {
  const ctx=await b.newContext(dev); await ctx.route('https://accounts.google.com/gsi/client', r=>r.fulfill({contentType:'text/javascript',body:FAKE_GIS}));
  await ctx.route('https://fonts.googleapis.com/**', r=>r.fulfill({contentType:'text/css',body:''}));
  const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push(nombre+': '+e.message));
  p.on('console',m=>{ if(/Content Security Policy|Refused to/i.test(m.text())) bloqueos.push(nombre+': '+m.text().slice(0,200)); });
  await p.addInitScript(()=>{ document.addEventListener('securitypolicyviolation', e=>console.log('Refused to (CSP) '+e.violatedDirective+' '+e.blockedURI)); });
  await p.goto(BASE + '/',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
  const gis = await p.isVisible('#bienv-google button'); console.log(nombre, 'botón de Google:', gis);
  await p.click('#bienv-sin'); await p.waitForTimeout(300);
  if (nombre==='computador') {
    const jz = await p.evaluate(() => window.__buildWorkbook().then(w => 'ok ' + typeof window.JSZip + ' ' + (w && w.constructor && w.constructor.name), e => 'error ' + e.message));
    const desde = await p.evaluate(() => [...document.scripts].map(s => s.src).filter(Boolean).join(' '));
    console.log(nombre, 'librería de Excel:', jz, '|', desde);
    await p.click('#lateral [data-clic="btn-fuentes-menu"]'); await p.waitForTimeout(500);
  } else {
    await p.click((await p.isVisible('#btn-menu')) ? '#btn-menu' : '#barra-mas'); await p.waitForTimeout(300); await p.click('#lateral [data-clic="btn-fuentes-menu"]'); await p.waitForTimeout(500);
  }
  await p.keyboard.press('Escape'); await p.click('#btn-premium').catch(()=>{}); await p.waitForTimeout(500);
  await ctx.close();
 }
 console.log('errores js:', errs); console.log('bloqueos CSP:', bloqueos.length ? bloqueos : 'ninguno'); await b.close();
 process.exit(errs.length||bloqueos.length?1:0); })();
