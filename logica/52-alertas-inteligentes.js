  // ===================== Alertas inteligentes =====================
  // Se calculan en el dispositivo con el historial de movimientos: suscripciones que subieron de precio, posibles
  // cobros duplicados, categorías que se dispararon frente al mes pasado, suscripciones nuevas y gastos fuera de lo
  // normal. La persona las descarta con "Entendido" y no vuelven.
  var ALV_KEY = "fintelligente-alertas-vistas";
  function alertasVistas() { try { return JSON.parse(localStorage.getItem(ALV_KEY) || "[]"); } catch (e) { return []; } }
  function claveCom(c) { return nrm(c || "").replace(/[^a-z0-9 ]/g, "").split(" ").filter(function (w) { return w.length > 2; }).slice(0, 2).join(" "); }
  function fechaCorta(f) { var p = f.split("-"); return +p[2] + " de " + MESES[+p[1] - 1]; }
  // Cobros que se repiten cada mes por un valor parecido
  function recurrentes() {
    var g = {};
    state.movs.forEach(function (x) { if (x.t !== "g" || !x.c) return; var k = claveCom(x.c); if (!k) return; (g[k] = g[k] || { nombre: x.c, lista: [] }).lista.push(x); });
    return Object.keys(g).map(function (k) {
      var l = g[k].lista.slice().sort(function (a, b) { return a.f < b.f ? -1 : 1; }), meses = {};
      l.forEach(function (x) { (meses[x.f.slice(0, 7)] = meses[x.f.slice(0, 7)] || []).push(x); });
      var ks = Object.keys(meses).sort();
      if (ks.length < 2 || ks.some(function (m) { return meses[m].length > 2; })) return null;
      var montos = ks.map(function (m) { return meses[m][meses[m].length - 1].m; }), min = Math.min.apply(null, montos), max = Math.max.apply(null, montos);
      if (max > min * 1.6) return null;
      var dias = ks.map(function (m) { return +meses[m][0].f.slice(8, 10); }), spread = Math.max.apply(null, dias) - Math.min.apply(null, dias);
      if (spread > 9) return null;
      return { clave: k, nombre: g[k].nombre, montos: montos, meses: ks, ultimo: l[l.length - 1], cat: l[l.length - 1].cat, dia: dias[dias.length - 1] };
    }).filter(Boolean);
  }
  function calcularAlertas() {
    var out = [], hoy = d0(), hoyS = hoyStr(hoy), hace = function (n) { var d = new Date(hoy); d.setDate(d.getDate() - n); return hoyStr(d); };
    if (!state.movs.length || state.ejemplo) return out;
    // 1. Suscripción o cobro fijo que subió de precio
    recurrentes().forEach(function (r) {
      var n = r.montos.length, a = r.montos[n - 2], b = r.montos[n - 1];
      if (b > a * 1.03 && b - a >= 1000 && r.ultimo.f >= hace(40))
        out.push({ id: "sube|" + r.clave + "|" + r.meses[n - 1], tipo: "sube", ic: "i-trend", t: esc(r.nombre) + " te cobró " + money(b) + ", antes " + money(a) + " (+" + prPct(b / a - 1) + ").", d: "Si es una suscripción, revisa si el nuevo precio te sigue sirviendo." });
    });
    // 2. Posible cobro duplicado: mismo comercio, mismo valor, el mismo día
    var vistos = {};
    state.movs.forEach(function (x) {
      if (x.t !== "g" || x.f < hace(14) || !x.c) return;
      var k = claveCom(x.c) + "|" + x.m + "|" + x.f;
      if (vistos[k]) { if (vistos[k] === 1) out.push({ id: "dup|" + k, tipo: "dup", ic: "i-alert", t: esc(x.c) + " te cobró " + money(x.m) + " dos veces el " + fechaCorta(x.f) + ".", d: "Puede ser normal (dos compras iguales) o un cobro repetido. Revísalo en la app de tu banco." }); vistos[k]++; }
      else vistos[k] = 1;
    });
    // 3. Una categoría variable que va muy por encima del mes pasado a la misma altura
    var k = keyOf(hoy), kp = addMonths(k, -1), dd = ("0" + hoy.getDate()).slice(-2), a = {}, b = {};
    state.movs.forEach(function (x) {
      if (x.t !== "g") return;
      if (x.f >= k + "-01" && x.f <= hoyS) a[x.cat] = (a[x.cat] || 0) + x.m;
      else if (x.f >= kp + "-01" && x.f <= kp + "-" + dd) b[x.cat] = (b[x.cat] || 0) + x.m;
    });
    Object.keys(a).forEach(function (c) {
      var g = (catById(c) || {}).group;
      if (g !== "gus" && c !== "alimentacion" && c !== "transporte") return;
      if (b[c] > 0 && a[c] >= b[c] * 1.5 && a[c] - b[c] >= 50000)
        out.push({ id: "sube-cat|" + c + "|" + k, tipo: "cat", ic: "i-chart", t: "Llevas " + money(a[c]) + " en " + esc(prCatNombre(c)) + ", " + (a[c] >= b[c] * 1.95 ? "el doble" : "un " + prPct(a[c] / b[c] - 1) + " más") + " que el mes pasado a esta altura.", d: "Si fue algo puntual, no pasa nada. Si no, todavía estás a tiempo de ajustar." });
    });
    // 4. Suscripción nueva: un cobro mensual que empezó en los últimos dos meses
    recurrentes().forEach(function (r) {
      var primero = state.movs.filter(function (x) { return x.t === "g" && claveCom(x.c) === r.clave; }).reduce(function (m, x) { return x.f < m ? x.f : m; }, "9999");
      var hayHistoria = state.movs.some(function (x) { return x.f < addMonths(k, -3) + "-01"; });
      if (hayHistoria && primero >= addMonths(k, -1) + "-01" && r.meses.length === 2 && (catById(r.cat) || {}).group !== "nec")
        out.push({ id: "nueva|" + r.clave, tipo: "nueva", ic: "i-bell", t: "Parece un cobro mensual nuevo: " + esc(r.nombre) + ", " + money(r.montos[r.montos.length - 1]) + " al mes.", d: "Son " + money(r.montos[r.montos.length - 1] * 12) + " al año. Si no lo reconoces o ya no lo usas, cancélalo." });
    });
    // 5. Un gasto mucho más alto de lo normal en su categoría (últimos 7 días)
    var porCat = {};
    state.movs.forEach(function (x) { if (x.t === "g" && x.f < hace(7)) (porCat[x.cat] = porCat[x.cat] || []).push(x.m); });
    state.movs.forEach(function (x) {
      if (x.t !== "g" || x.f < hace(7) || x.m < 200000) return;
      var l = (porCat[x.cat] || []).slice().sort(function (p, q) { return p - q; }); if (l.length < 6) return;
      var med = l[Math.floor(l.length / 2)];
      if (x.m >= med * 4) out.push({ id: "grande|" + x.id, tipo: "grande", ic: "i-alert", t: "Gasto grande: " + money(x.m) + " en " + esc(x.c || prCatNombre(x.cat)) + " el " + fechaCorta(x.f) + ".", d: "Es varias veces lo que sueles gastar en " + esc(prCatNombre(x.cat)) + ". Si lo reconoces, todo bien." });
    });
    var fuera = alertasVistas();
    return out.filter(function (x) { return fuera.indexOf(x.id) < 0; });
  }
  function renderAlertas() {
    var box = $("alertas-card"); if (!box) return;
    var l = calcularAlertas();
    box.hidden = !l.length;
    if (!l.length) return;
    $("alertas-lista").innerHTML = l.slice(0, 3).map(function (x) {
      return '<li data-tipo="' + x.tipo + '"><span class="al-ic" aria-hidden="true"><svg class="ic"><use href="#' + x.ic + '"/></svg></span><span class="al-tx"><b>' + x.t + "</b><span>" + x.d + '</span></span><button class="link-btn" type="button" data-alerta="' + esc(x.id) + '">Entendido</button></li>';
    }).join("");
    $("alertas-mas").hidden = l.length <= 3;
    $("alertas-mas").textContent = l.length > 3 ? "Ver las " + l.length + " alertas" : "";
  }
  $("alertas-lista").addEventListener("click", function (e) {
    var b = e.target.closest("[data-alerta]"); if (!b) return;
    var v = alertasVistas(); v.push(b.dataset.alerta);
    try { localStorage.setItem(ALV_KEY, JSON.stringify(v.slice(-300))); } catch (er) {}
    renderAlertas();
  });
  $("alertas-mas").addEventListener("click", function () { abrirPreguntas("¿Hay algo raro en mis gastos?"); });
  PR_R.alertas = function () {
    PR.ctx = { intent: "alertas" };
    var l = calcularAlertas();
    if (!state.movs.length || state.ejemplo) return { html: "<p>Para avisarte de cobros raros necesito tu historial de movimientos. Conecta tu banco o importa el extracto y empiezo a vigilar.</p>", chips: ["¿Cómo conecto mi banco?", "¿Cómo importo el extracto?"] };
    if (!l.length) return { html: "<p>No veo nada raro: ni cobros repetidos, ni suscripciones que subieron, ni gastos fuera de lo normal. ¡Todo en orden!</p>", chips: ["¿Qué suscripciones tengo?", "¿En qué gasto más?"] };
    return { html: "<p>Encontré " + plural(l.length, "cosa") + " para revisar:</p><ul class=\"pr-lista\">" + l.map(function (x) { return "<li><b>" + x.t + "</b> " + x.d + "</li>"; }).join("") + "</ul>", chips: ["¿Qué suscripciones tengo?", "¿Cuánto se me va en gastos hormiga?"] };
  };
  PR_R.suscripciones = function () {
    PR.ctx = { intent: "suscripciones" };
    var r = recurrentes().filter(function (x) { return x.ultimo.f >= addMonths(keyOf(d0()), -1) + "-01"; });
    if (!r.length) return { html: "<p>No encuentro cobros que se repitan cada mes en tu historial" + (state.movs.length ? "" : " (todavía no tengo movimientos tuyos)") + ".</p>", chips: ["¿En qué gasto más?"] };
    var tot = r.reduce(function (a, x) { return a + x.montos[x.montos.length - 1]; }, 0);
    return { html: "<p>Estos cobros se repiten cada mes, por unos <b>" + money(tot) + "</b> en total (" + money(tot * 12) + " al año):</p><ul class=\"pr-lista\">" + r.sort(function (a, b) { return b.montos[b.montos.length - 1] - a.montos[a.montos.length - 1]; }).map(function (x) { return "<li><b>" + esc(x.nombre) + ":</b> " + money(x.montos[x.montos.length - 1]) + ", hacia el día " + x.dia + "</li>"; }).join("") + "</ul><p>¿Hay alguno que ya no uses? Cancelarlo es plata que te queda todos los meses.</p>", chips: ["¿Hay algo raro en mis gastos?", "¿Cuánto me queda este mes?"] };
  };
  PR_INT.splice(1, 0, ["alertas", /algo raro|alertas?|cobros? (raro|raros|duplicad|repetid|doble)|me cobraron (dos veces|doble)|cobro extrano/], ["suscripciones", /suscripcion|cobros? (fijos|mensuales|recurrentes)|que me cobran cada mes|pagos? automaticos/]);
  PR_EJ.push("¿Hay algo raro en mis gastos?", "¿Qué suscripciones tengo?");

