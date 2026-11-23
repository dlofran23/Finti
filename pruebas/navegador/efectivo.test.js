const CAPTURAS = require('path').join(__dirname, 'capturas'); require('fs').mkdirSync(CAPTURAS, { recursive: true });
const { chromium } = require('playwright');
const BASE = process.env.BASE;
let ok=0,f=0; const c=(n,v)=>{v?ok++:(f++,console.log('FALLA',n))};
const estado=p=>p.evaluate(()=>{for(const k of Object.keys(localStorage)){try{const v=JSON.parse(localStorage.getItem(k));if(v&&v.cuentas)return v}catch(e){}}return null});
(async()=>{ const b=await chromium.launch(); const errs=[];
 // ---- Android: el botón abre la página con #accion=efectivo-gasto ----
 let ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'});
 let p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE+'/?app=android&lectura=1#accion=efectivo-gasto',{waitUntil:'networkidle'}); await p.waitForTimeout(900);
 c('no tapa con la pantalla de entrada', !(await p.isVisible('#dlg-bienvenida')));
 c('abre el registro', await p.isVisible('#dlg-add'));
 const elegido=(await p.textContent('#add-cuentas [aria-pressed="true"]')).trim();
 c('efectivo elegido ('+elegido+')', elegido==='Efectivo');
 await p.screenshot({path: CAPTURAS + '/efectivo-android.png'});
 const efe={id:'a3'}, saldo0=150000;
 await p.fill('#add-monto','15000'); await p.click('#add-items .pick >> nth=0'); await p.waitForTimeout(150);
 await p.click('#add-save'); await p.waitForTimeout(500);
 let st=await estado(p); const efe2=st.cuentas.find(x=>x.id===efe.id);
 c('saldo de efectivo baja 15.000 ('+saldo0+' → '+efe2.saldo+')', efe2.saldo===saldo0-15000);
 // relanzar con la página abierta (TWA cambia solo el #)
 await p.evaluate(()=>{location.hash='accion=efectivo-ingreso'}); await p.waitForTimeout(800);
 c('cambio de # abre ingreso', await p.isVisible('#dlg-add') && (await p.getAttribute('#add-tipo [data-tipo="ingreso"]','aria-pressed'))==='true');
 await ctx.close();
 // ---- iPhone: el atajo envía efectivo y se registra directo ----
 ctx=await b.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'});
 await ctx.addInitScript(()=>{try{sessionStorage.setItem('fintelligente-sin-cuenta','1')}catch(e){}});
 p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(600);
 await p.click((await p.isVisible('#btn-menu')) ? '#btn-menu' : '#barra-mas'); await p.waitForTimeout(300); await p.click('#lateral [data-clic="btn-fuentes-menu"]'); await p.waitForTimeout(500);
 await p.click('#btn-crear-buzon'); await p.waitForTimeout(2500);
 const cod=(await p.textContent('.ios-card .copia code')).trim();
 await p.keyboard.press('Escape');
 const env=async(body)=>(await p.request.post(BASE+'/api/entrada',{data:body})).status();
 c('envío gasto', await env({codigo:cod, texto:'Efectivo: pagaste $5.000 en Tienda de la esquina'})===200);
 c('envío ingreso', await env({codigo:cod, texto:'Efectivo: recibiste $20.000 por Venta de empanadas'})===200);
 // la persona sale de la app para correr el atajo y vuelve
 await p.evaluate(()=>{window.__vis='hidden';Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__vis});document.dispatchEvent(new Event('visibilitychange'))});
 await p.waitForTimeout(3300);
 await p.evaluate(()=>{window.__vis='visible';document.dispatchEvent(new Event('visibilitychange'))}); await p.waitForTimeout(3000);
 st=await estado(p); const e3=st.cuentas.find(x=>x.tipo==='efectivo');
 c('no quedan en Por confirmar', (st.pendientes||[]).length===0);
 c('saldo efectivo +15.000 neto ('+(e3&&e3.saldo)+')', e3 && e3.saldo===165000);
 await p.screenshot({path: CAPTURAS + '/efectivo-iphone.png'});
 console.log('errores',errs); c('sin errores',!errs.length); console.log(ok,'ok',f,'fallas'); await b.close(); })();
