  // ===================== Asesor predictivo =====================
  // Simula 1.000 futuros posibles con las cifras de la persona (en su dispositivo, sin enviar nada):
  // ritmo de gasto del mes, historial, inflación, temporadas de Colombia, imprevistos, deudas con sus tasas
  // y las condiciones que la persona quiera probar. El "escenario más real" es la mediana de esos futuros.
  var SUPUESTOS = {
    inflacion: 0.0629, inflacionFuente: "IPC anual del DANE a septiembre de 2026",
    usura: 0.2834, usuraFuente: "tasa de usura de consumo certificada para noviembre de 2026",
    sims: 1000, imprevistoProb: 0.12,
    temporada: { 1: 1.08, 2: 1.03, 6: 1.04, 12: 1.18 }   // enero (útiles, matrículas), febrero, junio (vacaciones), diciembre (fiestas)
  };
  var aseCond = { recorte: 0, abono: null, extra: 0, prima: false, horizonte: 12 }, aseTimer = null;
  function aleatorio(semilla) {   // generador repetible: el mismo presupuesto da los mismos resultados
    var a = semilla >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function gauss(r) { var u = r() || 1e-9, v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function percentil(arr, p) { var s = arr.slice().sort(function (a, b) { return a - b; }); return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))] : 0; }
  function promPesos(xs) { var w = 0, s = 0; xs.forEach(function (x, i) { s += x * (i + 1); w += i + 1; }); return w ? s / w : 0; }   // los meses recientes pesan más
  function cvDe(xs, def) { if (xs.length < 3) return def; var m = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length; if (!m) return def; var v = xs.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (xs.length - 1); return Math.min(0.35, Math.max(def / 2, Math.sqrt(v) / m)); }
  function mesCorto(y, m) { return MESES_C[m - 1] + " " + String(y).slice(2); }

  // 1. Cómo cierra el mes que se está viendo (ritmo de gasto, pagos fijos pendientes, ingresos por llegar)
  function cierreMes(r) {
    var m = cur(), hoy = new Date(), p = parseKey(state.mes), D = new Date(p.y, p.m, 0).getDate();
    var actual = !state.ejemplo && hoy.getFullYear() === p.y && hoy.getMonth() + 1 === p.m, pasado = state.ejemplo || p.y * 12 + p.m < hoy.getFullYear() * 12 + hoy.getMonth() + 1;
    var d = actual ? hoy.getDate() : pasado ? D : 0, frac = d / D;
    var ing = 0, ingSd = 0, gas = 0, gasSd2 = 0, variableReal = 0, gusEst = 0, gusReal = 0;
    m.ingresos.forEach(function (x) {
      var pend = Math.max(0, x.plan - x.real) * (frac >= 1 ? 0 : 1);
      ing += x.real + pend * 0.92; ingSd += pend * 0.25;
    });
    m.gastos.forEach(function (x) {
      var est, sd;
      if (x.dia > 0) { est = Math.max(x.real, frac >= 1 ? x.real : x.plan); sd = x.real >= x.plan ? 0 : x.plan * 0.03; }
      else {
        // Ritmo del mes mezclado con el plan: al principio pesa más el plan, al final pesa más lo real.
        // Si ya se pasó del plan (por ejemplo, el mercado del mes de una vez), se espera solo un poco más.
        variableReal += x.real;
        var basePlan = x.plan > 0 ? x.plan : x.real / Math.max(frac, 0.25), ritmo = frac > 0 ? x.real / Math.max(frac, 0.08) : basePlan, w = Math.min(1, frac * 1.2);
        if (frac >= 1) est = x.real;
        else if (x.real >= basePlan) est = x.real + (1 - frac) * basePlan * 0.3;
        else est = Math.max(x.real, Math.min(w * ritmo + (1 - w) * basePlan, basePlan * 1.5));
        sd = (est - x.real) * 0.3 + basePlan * 0.04 * (1 - frac);
      }
      gas += est; gasSd2 += sd * sd;
      if (x.dia <= 0 && (catById(x.cat) || { group: "gus" }).group === "gus") { gusEst += est; gusReal += x.real; }
    });
    var sd = Math.sqrt(gasSd2 + ingSd * ingSd), res = [];
    for (var i = 0; i < 400; i++) res.push(ing - gas + gauss(r) * sd);
    return { dia: d, dias: D, actual: actual, ing: ing, gas: gas, p10: percentil(res, 0.1), p50: ing - gas, p90: percentil(res, 0.9),
      rojo: res.filter(function (x) { return x < 0; }).length / res.length, diario: d ? variableReal / d : 0, gusEst: gusEst, gusReal: gusReal };
  }

  // 2. Base mensual a partir del historial (y del cierre esperado de este mes)
  function baseMensual(cierre) {
    var ks = monthKeys().filter(function (k) { return k < state.mes; }).slice(-12), hI = [], hC = [], hG = [];
    // Las cuotas de las deudas registradas se simulan aparte (con su saldo y su tasa): se quitan del gasto base.
    var conDeudas = state.deudas.some(function (d) { return d.saldo > 0; });
    var cuotasDe = function (t, campo) { var c = t.byCat.deudas; return conDeudas && c ? c[campo] : 0; };
    ks.forEach(function (k) { var t = totalsOf(state.meses[k]); if (t.ingReal || t.gasReal) { hI.push(t.ingReal); hC.push(t.byGroup.nec + t.byGroup.gus - cuotasDe(t, "real")); hG.push(t.byGroup.gus); } });
    var t = totalsOf(cur()), esc = t.gasReal ? cierre.gas / t.gasReal : 1, planG = { nec: 0, gus: 0, aho: 0 };
    cur().gastos.forEach(function (x) { if (!(conDeudas && x.cat === "deudas")) planG[(catById(x.cat) || { group: "gus" }).group] += x.plan; });
    if (t.gasReal) { hC.push(Math.max(0, t.byGroup.nec + t.byGroup.gus - cuotasDe(t, "real")) * esc); hG.push(t.byGroup.gus * esc); } else { hC.push(planG.nec + planG.gus); hG.push(planG.gus); }
    hI.push(cierre.ing);
    var n = hC.length, tend = 0;
    if (n >= 4) {   // tendencia (regresión lineal), amortiguada a la mitad y limitada a ±2 % mensual
      var mx = (n - 1) / 2, my = hC.reduce(function (a, b) { return a + b; }, 0) / n, sxy = 0, sxx = 0;
      hC.forEach(function (y, i) { sxy += (i - mx) * (y - my); sxx += (i - mx) * (i - mx); });
      tend = my ? Math.max(-0.02, Math.min(0.02, (sxy / sxx) / my * 0.5)) : 0;
    }
    var C = promPesos(hC);
    return { ing: promPesos(hI), cons: C, gus: Math.min(C, promPesos(hG)), cvI: cvDe(hI, 0.05), cvC: cvDe(hC, 0.08), tend: tend, meses: n,
      nec: Math.max(1, C - promPesos(hG)) };
  }

  // 3. Monte Carlo: H meses hacia adelante con las condiciones elegidas
  function simular(base, cond, semilla) {
    var H = cond.horizonte, N = SUPUESTOS.sims, r = aleatorio(semilla), p = parseKey(state.mes);
    var inflM = Math.pow(1 + SUPUESTOS.inflacion, 1 / 12) - 1, iUsura = Math.pow(1 + SUPUESTOS.usura, 1 / 12) - 1;
    var liquido0 = state.cuentas.filter(function (c) { return c.tipo !== "tarjeta"; }).reduce(function (a, c) { return a + c.saldo; }, 0);
    var deudas0 = state.deudas.filter(function (d) { return d.saldo > 0; }).map(function (d) { return { nombre: d.nombre, saldo: d.saldo, i: Math.pow(1 + (d.tasa || 0) / 100, 1 / 12) - 1, cuota: d.cuota || 0 }; });
    var metas = state.metas.filter(function (g) { return g.objetivo > g.ahorrado; }).slice().sort(function (a, b) { return (a.fecha || "9999").localeCompare(b.fecha || "9999"); });
    var abono = cond.abono == null ? (state.deudaExtra || 0) : cond.abono, bola = state.deudaMetodo === "bola";
    var porMes = []; for (var t = 0; t < H; t++) porMes.push([]);
    var libre = deudas0.map(function () { return []; }), intereses = [], prestamo = 0, metaMes = metas.map(function () { return []; }), finLiquido = [];
    for (var s = 0; s < N; s++) {
      var liq = liquido0, ds = deudas0.map(function (d) { return { saldo: d.saldo, i: d.i, cuota: d.cuota, fin: -1 }; }), nueva = 0, int = 0, ahorrado = 0, pidio = false;
      var metaFin = metas.map(function () { return -1; }), ing0 = base.ing;
      for (t = 0; t < H; t++) {
        var mesCal = ((p.m + t) % 12) + 1;
        if (mesCal === 1 && t > 0) ing0 *= 1 + SUPUESTOS.inflacion;               // ajuste de ingresos en enero
        var ing = ing0 * (1 + gauss(r) * base.cvI) + cond.extra;
        if (cond.prima && (mesCal === 6 || mesCal === 12)) ing += ing0 / 2;     // prima de servicios: 15 días de salario
        var cons = (base.cons - base.gus * cond.recorte) * Math.pow(1 + base.tend + inflM, t + 1) * (SUPUESTOS.temporada[mesCal] || 1) * (1 + gauss(r) * base.cvC);
        if (r() < SUPUESTOS.imprevistoProb) cons += base.cons * (0.1 + r() * 0.4);   // un daño, una cita médica, un viaje urgente
        ds.forEach(function (d) {                                                // cuota de cada deuda: interés del mes + abono a capital
          if (d.saldo <= 0) return;                                              // ya saldada: esa cuota queda libre
          var interes = d.saldo * d.i, pago = Math.min(d.cuota, d.saldo + interes);
          int += interes; d.saldo = d.saldo + interes - pago; cons += pago;
          if (d.saldo <= 1) { d.saldo = 0; if (d.fin < 0) d.fin = t; }
        });
        var sobra = ing - cons, extra = 0, vivas = ds.filter(function (d) { return d.saldo > 0; });
        if (vivas.length && abono > 0 && sobra > 0) {
          extra = Math.min(abono, sobra);
          var obj = vivas.sort(function (a, b) { return bola ? a.saldo - b.saldo : b.i - a.i; })[0];
          var pago = Math.min(extra, obj.saldo); obj.saldo -= pago; extra = pago;
          if (obj.saldo <= 1) { obj.saldo = 0; if (obj.fin < 0) obj.fin = t; }
        }
        if (nueva > 0) { var intN = nueva * iUsura; int += intN; nueva += intN; }
        var neto = sobra - extra;
        if (neto > 0 && nueva > 0) { var pagaN = Math.min(neto, nueva); nueva -= pagaN; neto -= pagaN; }
        liq += neto;
        if (liq < 0) { nueva += -liq; liq = 0; pidio = true; }                     // el faltante se cubre con crédito (a tasa de usura)
        if (neto > 0) ahorrado += neto;
        var acum = 0;
        metas.forEach(function (g, j) { acum += g.objetivo - g.ahorrado; if (metaFin[j] < 0 && ahorrado >= acum) metaFin[j] = t; });
        porMes[t].push(liq - nueva - ds.reduce(function (a, d) { return a + d.saldo; }, 0));
      }
      ds.forEach(function (d, j) { libre[j].push(d.fin); });
      metaFin.forEach(function (f, j) { metaMes[j].push(f); });
      intereses.push(int); if (pidio) prestamo++; finLiquido.push(liq);
    }
    function mesDe(t) { var k = p.m + t, y = p.y + Math.floor(k / 12), m = (k % 12) + 1; return { y: y, m: m }; }
    return {
      meses: porMes.map(function (xs, t) { var md = mesDe(t); return { etiqueta: mesCorto(md.y, md.m), p10: percentil(xs, 0.1), p50: percentil(xs, 0.5), p90: percentil(xs, 0.9) }; }),
      neto0: liquido0 - deudas0.reduce(function (a, d) { return a + d.saldo; }, 0),
      deudas: deudas0.map(function (d, j) {
        var fines = libre[j].filter(function (f) { return f >= 0; }), prob = fines.length / N, med = prob >= 0.5 ? percentil(fines, 0.5 * N / fines.length) : -1;
        return { nombre: d.nombre, prob: prob, cuando: med >= 0 ? mesDe(med) : null };
      }),
      metas: metas.map(function (g, j) {
        var fines = metaMes[j], ok = 0, lim = g.fecha ? (parseKey(g.fecha).y - p.y) * 12 + parseKey(g.fecha).m - p.m - 1 : H;
        fines.forEach(function (f) { if (f >= 0 && f <= lim) ok++; });
        var llegan = fines.filter(function (f) { return f >= 0; });
        return { nombre: g.nombre, fecha: g.fecha, prob: ok / N, probable: llegan.length >= N / 2 ? mesDe(percentil(llegan, 0.5 * N / llegan.length)) : null };
      }),
      intereses: percentil(intereses, 0.5), credito: prestamo / N, colchon: percentil(finLiquido, 0.5)
    };
  }
  function semillaEstado() { var t = totalsOf(cur()); return Math.round(t.ingReal + 7 * t.gasReal + 13 * state.deudas.length) ^ parseInt(state.mes.replace("-", ""), 10); }
  function nombreMes(o) { return o ? MESES[o.m - 1] + " de " + o.y : ""; }

  function graficaAbanico(res) {
    var W = 600, Hh = 210, pl = 84, pr = 24, pt = 14, pb = 28, ms = res.meses, n = ms.length;
    var ys = [res.neto0, 0]; ms.forEach(function (x) { ys.push(x.p10, x.p90); });
    var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys); if (hi - lo < 1) { hi += 1; lo -= 1; }
    var pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    var X = function (i) { return pl + (W - pl - pr) * i / n; }, Y = function (v) { return pt + (Hh - pt - pb) * (hi - v) / (hi - lo); };
    var arriba = ms.map(function (x, i) { return X(i + 1) + "," + Y(x.p90); }), abajo = ms.map(function (x, i) { return X(i + 1) + "," + Y(x.p10); }).reverse();
    var banda = "M" + X(0) + "," + Y(res.neto0) + " L" + arriba.join(" L") + " L" + abajo.join(" L") + " Z";
    var linea = "M" + X(0) + "," + Y(res.neto0) + ms.map(function (x, i) { return " L" + X(i + 1) + "," + Y(x.p50); }).join("");
    var corto = function (v) { var a = Math.abs(v), s = v < 0 ? "−" : ""; return a < 500 ? "$ 0" : s + (a >= 1e6 ? "$ " + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",") + " mill." : money(Math.round(a / 1e3) * 1e3)); };   // "mill." es la abreviatura de millones (RAE)
    var marcas = [hi - pad, (hi + lo) / 2, lo + pad].map(function (v) { return '<text x="' + (pl - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" class="ase-eje">' + corto(v) + "</text>"; }).join("");
    var cada = n > 12 ? 4 : n > 6 ? 2 : 1, et = ms.map(function (x, i) { return (i + 1) % cada ? "" : '<text x="' + X(i + 1) + '" y="' + (Hh - 8) + '" text-anchor="' + (i === n - 1 ? "end" : "middle") + '" class="ase-eje">' + x.etiqueta + "</text>"; }).join("");
    var cero = lo < 0 && hi > 0 ? '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" class="ase-cero"/>' : "";
    var fin = ms[n - 1];
    return '<svg class="ase-graf" viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Proyección de tu patrimonio: en ' + n + " meses, lo más probable es " + money(fin.p50) + '">' +
      cero + '<path d="' + banda + '" class="ase-banda"/><path d="' + linea + '" class="ase-linea"/>' +
      '<circle cx="' + X(n) + '" cy="' + Y(fin.p50) + '" r="4.5" class="ase-punto"/>' + marcas + et + "</svg>";
  }

  function renderIA() {
    var body = $("ia-body");
    if (!hasPremium()) { body.innerHTML = lockCard("Tu asesor aprende cómo manejas tu plata, te dice cuánto puedes disfrutar sin culpa y simula miles de escenarios para mostrarte cómo cierras el mes, cuándo saldas tus deudas y si llegas a tus metas."); return; }
    var r0 = analizarMes();
    if (r0.vacio) { body.innerHTML = '<p class="ase-diag">' + esc(r0.diag[0]) + '</p><ol class="ase-lista"><li><b>' + esc(r0.recs[0].titulo) + "</b><span>" + esc(r0.recs[0].texto) + "</span></li></ol>"; return; }
    if (!body.dataset.escucha) { body.dataset.escucha = "1"; body.addEventListener("click", clicAsesor); }
    if (!body.querySelector("#ase-res")) {
      var dmax = Math.max(500000, Math.round(state.deudas.reduce(function (a, d) { return a + d.cuota; }, 0) / 50000) * 50000);
      body.innerHTML = '<div id="ase-res"></div>' +
        '<details class="ase-cond" id="ase-cond"><summary>Prueba tus condiciones: ¿y si…?</summary>' +
        '<label class="ase-ctl"><span>Recorto mis gustos <b id="ase-v-recorte"></b></span><input type="range" min="0" max="50" step="5" id="ase-recorte"></label>' +
        '<label class="ase-ctl"><span>Abono extra a deudas cada mes <b id="ase-v-abono"></b></span><input type="range" min="0" max="' + dmax + '" step="10000" id="ase-abono"></label>' +
        '<label class="ase-ctl"><span>Ingreso extra cada mes <b id="ase-v-extra"></b></span><input type="range" min="0" max="3000000" step="50000" id="ase-extra"></label>' +
        '<label class="acepto-chk"><input type="checkbox" id="ase-prima"><span>Recibo prima en junio y diciembre (empleo formal)</span></label>' +
        '<div class="ase-hor" role="radiogroup" aria-label="Horizonte">' + [6, 12, 24].map(function (h) { return '<button type="button" class="chip-btn" data-h="' + h + '">' + h + " meses</button>"; }).join("") + "</div></details>" +
        '<details class="ase-como"><summary>¿Cómo calculamos?</summary><div id="ase-como"></div></details>' +
        '<p class="hint">Proyección estadística calculada en tu dispositivo con tus cifras; no se envían a nadie. Es una estimación, no una promesa, y no es asesoría financiera profesional.</p>';
      body.querySelector("#ase-cond").addEventListener("input", function (e) {
        var t = e.target;
        if (t.id === "ase-recorte") aseCond.recorte = +t.value / 100;
        else if (t.id === "ase-abono") aseCond.abono = +t.value;
        else if (t.id === "ase-extra") aseCond.extra = +t.value;
        else if (t.id === "ase-prima") aseCond.prima = t.checked;
        pintarCond(); clearTimeout(aseTimer); aseTimer = setTimeout(calcularAsesor, 60);
      });
      body.querySelector("#ase-cond").addEventListener("click", function (e) {
        var h = e.target.closest("[data-h]"); if (!h) return;
        aseCond.horizonte = +h.dataset.h; pintarCond(); calcularAsesor();
      });
    }
    pintarCond(); clearTimeout(aseTimer); aseTimer = setTimeout(calcularAsesor, 30);
  }
  function pintarCond() {
    var ab = aseCond.abono == null ? (state.deudaExtra || 0) : aseCond.abono;
    if (!$("ase-recorte")) return;
    $("ase-recorte").value = Math.round(aseCond.recorte * 100); $("ase-v-recorte").textContent = Math.round(aseCond.recorte * 100) + " %";
    $("ase-abono").value = ab; $("ase-v-abono").textContent = money(ab);
    $("ase-extra").value = aseCond.extra; $("ase-v-extra").textContent = money(aseCond.extra);
    $("ase-prima").checked = aseCond.prima;
    [].forEach.call(document.querySelectorAll("#ase-cond [data-h]"), function (b) { b.classList.toggle("on", +b.dataset.h === aseCond.horizonte); b.setAttribute("aria-pressed", String(+b.dataset.h === aseCond.horizonte)); });
  }
  function calcularAsesor() {
    var out = $("ase-res"); if (!out) return;
    if (!state.ejemplo) metrica("asesor", "dia");
    var m$ = function (v) { return money(Math.round(v / 1000) * 1000); };   // proyecciones redondeadas a miles: sin falsa precisión
    var semilla = semillaEstado(), r = aleatorio(semilla), cierre = cierreMes(r), base = baseMensual(cierre);
    var res = simular(base, aseCond, semilla), H = aseCond.horizonte, fin = res.meses[H - 1];
    var r0 = analizarMes(), recs = [];
    // Impacto medido: cada idea se simula con los mismos escenarios
    var ab = aseCond.abono == null ? (state.deudaExtra || 0) : aseCond.abono;
    if (base.gus > 0 && aseCond.recorte < 0.15) {
      var c1 = simular(base, Object.assign({}, aseCond, { recorte: 0.15 }), semilla), d1 = c1.meses[H - 1].p50 - fin.p50;
      if (d1 > 0) recs.push({ peso: 70, clave: "sim-recorte", titulo: "Con un 15 % menos en gustos tendrías " + m$(d1) + " más en " + H + " meses",
        texto: "Son unos " + m$(base.gus * 0.15) + " al mes, y sigues disfrutando el otro 85 %. Terminarías con " + m$(c1.meses[H - 1].p50) + " en vez de " + m$(fin.p50) + "." });
    }
    if (res.deudas.length) {
      var c2 = simular(base, Object.assign({}, aseCond, { abono: ab + 100000 }), semilla), ganan = res.intereses - c2.intereses;
      if (ganan > 1000) {
        var antes = res.deudas.filter(function (d) { return d.cuando; }), mejor = c2.deudas.filter(function (d) { return d.cuando; });
        recs.push({ peso: 78, clave: "sim-abono", titulo: "Con " + m$(100000) + " extra al mes, tus deudas se van antes",
          texto: "Te ahorras cerca de " + m$(ganan) + " en intereses en " + H + " meses" + (mejor.length > antes.length ? " y sales de " + plural(mejor.length - antes.length, "deuda") + " más dentro de ese plazo." : ".") });
      }
    }
    if (res.credito > 0.15) recs.push({ peso: 95, clave: "sim-colchon", titulo: "Un colchón te daría tranquilidad",
      texto: "En " + Math.round(res.credito * 10) + " de cada 10 escenarios algún mes queda justo y tocaría usar crédito, que hoy cobra hasta el " + (SUPUESTOS.usura * 100).toFixed(1).replace(".", ",") + " % E. A. Ir armando unos " + m$(base.nec) + ", aunque sea de a poco, te protege de eso." });
    r0.recs.forEach(function (x) { if (x.clave !== "bien") recs.push({ peso: (x.peso || 50) - 10, clave: x.clave, titulo: x.titulo, texto: x.texto, accion: x.accion }); });
    recs = recs.filter(function (x) { return state.asesor.no.indexOf(x.clave) < 0; })
      .map(function (x) { if (state.asesor.si.indexOf(x.clave) > -1) x.peso += 15; return x; });
    recs.sort(function (a, b) { return b.peso - a.peso; }); recs = recs.slice(0, 5);
    var pat = aprenderPatrones(), disf = cierre.actual && cierre.ing > 0 ? paraDisfrutar(cierre) : null, mesNom = esc(monthLabel(state.mes).toLowerCase());
    var mejora = fin.p50 - res.neto0;
    var frase = "Si sigues como vas, en " + H + " meses tu patrimonio (lo que tienes menos lo que debes) pasaría de " + m$(res.neto0) + " a " + m$(fin.p50) +
      (mejora >= 0 ? ", " + m$(mejora) + " más que hoy." : ". Las condiciones de abajo te muestran cómo darle la vuelta.") + " En 8 de cada 10 escenarios quedaría entre " + m$(fin.p10) + " y " + m$(fin.p90) + ".";
    var pred = [];
    res.deudas.forEach(function (d) { pred.push(d.cuando ? "<b>" + esc(d.nombre) + ":</b> lo más probable es que quede saldada en " + nombreMes(d.cuando) + "." : "<b>" + esc(d.nombre) + ":</b> a este ritmo toma más de " + H + " meses (" + Math.round(d.prob * 100) + " % de los escenarios la saldan antes)."); });
    if (res.deudas.length) pred.push("<b>Intereses:</b> pagarías cerca de " + m$(res.intereses) + " en " + H + " meses.");
    res.metas.forEach(function (g) { pred.push("<b>" + esc(g.nombre) + ":</b> " + (g.fecha ? Math.round(g.prob * 100) + " % de probabilidad de lograrla para " + monthLabel(g.fecha).toLowerCase() + "." : "") + (g.probable ? " Fecha más probable: " + nombreMes(g.probable) + "." : " A este ritmo tomaría más de " + H + " meses; abajo puedes probar qué la acerca.")); });
    pred.push("<b>Colchón:</b> al final tendrías unos " + m$(res.colchon) + " disponibles" + (base.nec ? ", " + (res.colchon / base.nec).toFixed(1).replace(".", ",") + " meses de gastos necesarios." : "."));
    function fb(clave) {
      var si = state.asesor.si.indexOf(clave) > -1;
      return '<div class="ase-fb"><button type="button" data-fb="si" aria-pressed="' + si + '"' + (si ? ' class="on"' : "") + '>' + (si ? "Te sirvió" : "Me sirve") + '</button><button type="button" data-fb="no">No es para mí</button></div>';
    }
    var h = "";
    // 1. Lo que va bien, siempre primero
    var buenas = r0.logros || [];
    if (buenas.length) h += '<div class="ase-logros"><span class="ase-pi" aria-hidden="true"><svg class="ic"><use href="#i-star"/></svg></span><div><b>Lo que va bien</b><ul>' + buenas.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div></div>";
    // 2. Para disfrutar sin culpa
    if (disf) h += '<div class="ase-disf"><span class="ase-k">Para disfrutar sin culpa</span>' + (disf.libre > 0
      ? "<b>" + m$(disf.diario) + " al día</b><span>o unos " + m$(disf.semana) + " esta semana, en lo que quieras. Tus gastos necesarios, tus pagos y tu ahorro del mes ya están cubiertos.</span>"
      : "<b>Este mes, planes sencillos</b><span>El espacio para gustos de " + mesNom + " ya se usó. No pasa nada: lo que queda va para lo necesario y el próximo mes arrancas de cero.</span>") + "</div>";
    // 3. Así cierras el mes
    h += '<div class="ase-cierre' + (cierre.p50 < 0 ? " ojo" : "") + '"><span class="ase-k">Así cierras ' + mesNom + "</span><b>" + m$(cierre.p50) + "</b>" +
      "<span>" + (cierre.actual ? "Vas en el día " + cierre.dia + " de " + cierre.dias + ". " : "") + "Lo más probable es que quede entre " + m$(cierre.p10) + " y " + m$(cierre.p90) + ". " +
      (cierre.rojo >= 0.05 ? "Hay un " + Math.round(cierre.rojo * 100) + " % de probabilidad de que cierre justo; un ajuste pequeño lo evita." : "Todo indica que cierras en orden.") +
      (cierre.actual && cierre.diario ? " Tu promedio en gastos variables es de " + m$(cierre.diario) + " al día." : "") + "</span></div>";
    // 4. Lo que aprendí de ti
    h += '<h3 class="ase-h">Lo que aprendí de ti</h3>';
    pat.items.sort(function (a, b) { return (state.asesor.si.indexOf(b.clave) > -1) - (state.asesor.si.indexOf(a.clave) > -1); });
    if (pat.items.length) h += '<ul class="ase-pat">' + pat.items.map(function (x, i) {
      return '<li data-clave="' + esc(x.clave) + '"' + (i >= 3 ? " hidden" : "") + '><span class="ase-pi" aria-hidden="true"><svg class="ic"><use href="#' + x.ic + '"/></svg></span><div><b>' + esc(x.titulo) + "</b><span>" + esc(x.texto) + "</span>" +
        (x.accion ? '<button type="button" class="btn ase-acc" data-plan="' + esc(x.accion.cat) + '">' + esc(x.accion.texto) + "</button>" : "") + fb(x.clave) + "</div></li>";
    }).join("") + "</ul>" + (pat.items.length > 3 ? '<button type="button" class="link-btn" data-ase-mas>Ver ' + (pat.items.length - 3) + " más de lo que aprendí</button>" : "");
    if (!pat.suficiente) h += '<div class="ase-apr"><span>' + (state.movs.length ? "Sigo conociéndote. Con " + plural(Math.max(1, pat.faltan), "movimiento") + " más" + (pat.dias < 14 ? " y un par de semanas" : "") + " te muestro en qué días y horas gastas más, tus pagos que se repiten y tus gastos pequeños."
      : "Cada gasto que registres me ayuda a conocerte: en qué días y horas gastas más, qué pagos se repiten y qué disfrutas. Todo se queda en tu dispositivo.") + '</span><span class="ase-barra"><i style="width:' + Math.min(100, Math.round(pat.movimientos / 12 * 100)) + '%"></i></span></div>';
    // 5. Ideas para ti
    h += '<h3 class="ase-h">Ideas para ti</h3>';
    if (recs.length) h += '<ol class="ase-lista">' + recs.map(function (x) {
      return '<li data-clave="' + esc(x.clave) + '"><b>' + esc(x.titulo) + "</b><span>" + esc(x.texto) + "</span>" +
        (x.accion ? '<button type="button" class="btn ase-acc" data-plan="' + esc(x.accion.cat) + '">' + esc(x.accion.texto) + "</button>" : "") + fb(x.clave) + "</li>";
    }).join("") + "</ol>";
    else h += '<p class="ase-diag">Vas muy bien. Si al final del mes te sobra, llévalo a tu meta más cercana.</p>';
    if (state.asesor.no.length) h += '<button type="button" class="link-btn" data-ase-reset>Volver a mostrar las ideas que ocultaste (' + state.asesor.no.length + ")</button>";
    // 6. Tu camino
    h += '<h3 class="ase-h">Tu camino a ' + H + " meses</h3>" + '<p class="ase-diag">' + esc(frase) + "</p>" + graficaAbanico(res) +
      '<p class="ase-ley"><span class="ase-ley-l"></span>Escenario más probable <span class="ase-ley-b"></span>8 de cada 10 escenarios</p>' +
      '<ul class="ase-pred">' + pred.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>";
    out.innerHTML = h;
    $("ase-como").innerHTML = "<ul>" +
      "<li>Simulamos " + SUPUESTOS.sims.toLocaleString("es-CO") + " futuros posibles con tus cifras. El escenario más probable es el del medio.</li>" +
      "<li>Este mes: tus gastos variables siguen tu ritmo diario; los fijos se toman de tu plan; los ingresos que faltan, como planeados.</li>" +
      "<li>Para disfrutar sin culpa: lo que entra este mes menos tus gastos necesarios y pagos, tu ahorro planeado y lo que ya gastaste en gustos, repartido en los días que quedan.</li>" +
      "<li>Lo que aprendí de ti: tus movimientos de los últimos 120 días (día de la semana, hora, días de pago, pagos que se repiten, compras pequeñas) y tus últimos meses. Las ideas que marcas como útiles aparecen primero y las que no son para ti no vuelven a salir.</li>" +
      "<li>Base mensual: " + (base.meses > 1 ? "promedio de tus últimos " + base.meses + " meses (los recientes pesan más)" : "este mes, porque aún no hay más historial") + ", con su variación real" + (base.tend ? " y tu tendencia (" + (base.tend * 100).toFixed(1).replace(".", ",") + " % al mes)" : "") + ".</li>" +
      "<li>Inflación de " + (SUPUESTOS.inflacion * 100).toFixed(2).replace(".", ",") + " % al año (" + SUPUESTOS.inflacionFuente + "). Los ingresos se ajustan en enero.</li>" +
      "<li>Temporadas: diciembre más caro (+18 %), enero (+8 %), febrero (+3 %) y junio (+4 %).</li>" +
      "<li>Imprevistos: 1 de cada 8 meses aparece un gasto inesperado de entre el 10 % y el 50 % de tu gasto mensual.</li>" +
      "<li>Deudas: interés mensual según su tasa E. A., tu cuota y el abono extra por el método " + (state.deudaMetodo === "bola" ? "bola de nieve" : "avalancha") + ". Al saldar una, su cuota queda libre. Si un mes falta plata, se cubre con crédito a la " + SUPUESTOS.usuraFuente + " (" + (SUPUESTOS.usura * 100).toFixed(2).replace(".", ",") + " %).</li>" +
      "<li>Patrimonio: saldo de tus cuentas (sin tarjetas de crédito) menos tus deudas registradas.</li></ul>";
  }
  // Lo que la persona le enseña al asesor: qué le sirve, qué no y ajustes de plan en un toque.
  function anotarAsesor(lista, clave, quitar) {
    var a = state.asesor[lista], i = a.indexOf(clave);
    if (quitar) { if (i > -1) a.splice(i, 1); } else if (i < 0) { a.push(clave); if (a.length > 80) a.shift(); }
  }
  function ajustarPlanCat(cat) {
    var filas = cur().gastos.filter(function (x) { return x.cat === cat; }); if (!filas.length) return;
    var real = filas.reduce(function (a, x) { return a + x.real; }, 0), plan = filas.reduce(function (a, x) { return a + x.plan; }, 0);
    var ks = monthKeys().filter(function (k) { return k <= state.mes; }).slice(-3), vals = ks.map(function (k) { var c = totalsOf(state.meses[k]).byCat[cat]; return c ? c.real : 0; }).filter(Boolean).sort(function (a, b) { return a - b; });
    var meta = Math.ceil(Math.max(real, vals.length >= 2 ? vals[Math.floor(vals.length / 2)] : 0) / 10000) * 10000; if (meta <= plan) return;
    var antes = filas.map(function (x) { return x.plan; }), mayor = filas.slice().sort(function (a, b) { return b.real - a.real; })[0];
    mayor.plan += meta - plan; changed(); renderAll();
    toast("Listo: " + esc((catById(cat) || { name: "Otros" }).name.toLowerCase()) + " queda en <b>" + money(meta) + "</b>. Un plan realista se cumple más fácil.", { action: "Deshacer", onAction: function () { filas.forEach(function (x, i) { x.plan = antes[i]; }); changed(); renderAll(); } });
  }
  function clicAsesor(e) {
    var b = e.target.closest("[data-fb],[data-plan],[data-ase-reset],[data-ase-mas]"); if (!b) return;
    if (b.hasAttribute("data-ase-mas")) { [].forEach.call(b.parentNode.querySelectorAll(".ase-pat li[hidden]"), function (li) { li.hidden = false; }); b.remove(); return; }
    if (b.hasAttribute("data-ase-reset")) { state.asesor.no = []; changed(); calcularAsesor(); return; }
    if (b.dataset.plan) { ajustarPlanCat(b.dataset.plan); return; }
    var li = b.closest("[data-clave]"), clave = li && li.dataset.clave; if (!clave) return;
    if (b.dataset.fb === "si") {
      var ya = state.asesor.si.indexOf(clave) > -1;
      anotarAsesor("si", clave, ya); changed();
      b.classList.toggle("on", !ya); b.setAttribute("aria-pressed", String(!ya)); b.textContent = ya ? "Me sirve" : "Te sirvió";
      if (!ya) toast("Anotado. Te mostraré primero ideas como esta.");
    } else {
      anotarAsesor("no", clave); anotarAsesor("si", clave, true); changed();
      li.classList.add("ase-fuera"); setTimeout(calcularAsesor, reduceMotion ? 0 : 220);
      toast("Listo, no te la vuelvo a mostrar.", { action: "Deshacer", onAction: function () { anotarAsesor("no", clave, true); changed(); calcularAsesor(); } });
    }
  }

