// Genera CH_REALES: las palabras reales del español que se parecen a una palabra del vocabulario de Finti
// ("tanto" y "tinto", "tenia" y "tenis"). El corrector de escritura nunca las cambia.
// Uso (con la app sirviéndose en BASE):
//   npm i --no-save an-array-of-spanish-words
//   BASE=http://localhost:4610 node herramientas/palabras-reales.cjs
// Reescribe la línea "var CH_REALES" en el archivo de fuente/ que la contiene. Después: python3 herramientas/construir.py
// La lista de palabras es de an-array-of-spanish-words (licencia MIT, Zeke Sikelianos).
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const dic = require('an-array-of-spanish-words');
const nrm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function dist(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = []; for (let i = 0; i <= a.length; i++) d[i] = [i]; for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let f = max + 1;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1; d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      if (d[i][j] < f) f = d[i][j];
    }
    if (f > max) return max + 1;
  }
  return d[a.length][b.length];
}
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.goto(process.env.BASE, { waitUntil: 'networkidle' });
  const voc = await p.evaluate(() => window.FinVocabulario()); await b.close();
  const V = new Set(voc), porLetra = {};
  voc.filter((w) => w.length >= 5).forEach((w) => (porLetra[w[0]] = porLetra[w[0]] || []).push(w));
  const out = new Set();
  for (const w0 of dic) {
    const w = nrm(w0);
    if (w.length < 5 || !/^[a-zñ]+$/.test(w) || V.has(w) || V.has(w.replace(/s$/, '')) || V.has(w.replace(/es$/, ''))) continue;
    const max = w.length >= 8 ? 2 : 1;
    for (const v of porLetra[w[0]] || []) { if (max === 2 && v[1] !== w[1]) continue; if (dist(w, v, max) <= max) { out.add(w); break; } }
  }
  const lista = [...out].sort().join(' ');
  const raiz = path.join(__dirname, '..', 'fuente');
  const archivos = []; (function rec(d) { for (const f of fs.readdirSync(d)) { const x = path.join(d, f); if (fs.statSync(x).isDirectory()) rec(x); else if (/\.(js|html)$/.test(f)) archivos.push(x); } })(raiz);
  const destino = archivos.find((f) => /var CH_REALES = "/.test(fs.readFileSync(f, 'utf8')));
  if (!destino) { console.error('No encontré "var CH_REALES" en fuente/.'); process.exit(1); }
  fs.writeFileSync(destino, fs.readFileSync(destino, 'utf8').replace(/var CH_REALES = " [^"]* ";/, 'var CH_REALES = " ' + lista + ' ";'));
  console.log(out.size + ' palabras en ' + path.relative(process.cwd(), destino));
})();
