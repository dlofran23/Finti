const BASE = process.env.BASE;
const CAPTURAS = require('path').join(__dirname, 'capturas'); require('fs').mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const errs=[];
 const url=BASE + '/?app=android&lectura=1#importar-lote=W3sidCI6IkJhbmNvbG9tYmlhOiBDb21wcmFzdGUgJDQ1LjkwMCwwMCBlbiBFWElUTyBjb24gdHUgVC5EZWIgKjEyMzQiLCJhIjoiQmFuY29sb21iaWEiLCJ0cyI6MX1d';
 for (const u of [url, url.replace('importar-lote=','importar-lote%3D')]) {
  const c=await b.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'}); const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto(u,{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
  const pend=await p.evaluate(()=>{for(const k of Object.keys(localStorage)){try{const v=JSON.parse(localStorage.getItem(k));if(v&&v.pendientes)return v.pendientes}catch(e){}}return []});
  console.log(u.includes('%3D')?'con %3D':'con =', '→ pendientes:', pend.length, pend[0]&&(pend[0].comercio+' '+pend[0].monto), '| puerta visible:', await p.isVisible('#dlg-bienvenida'), '| bandeja abierta:', await p.isVisible('#dlg-bandeja'));
  await p.screenshot({path: CAPTURAS + '/ida-vuelta.png'}); await c.close();
 }
 console.log('errores', errs); await b.close(); })();
