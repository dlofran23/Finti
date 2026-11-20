  // ===================== Cálculos =====================
  function totalsOf(m) {
    var t = { ingPlan: 0, ingReal: 0, gasPlan: 0, gasReal: 0, byCat: {}, byGroup: { nec: 0, gus: 0, aho: 0 } };
    m.ingresos.forEach(function (r) { t.ingPlan += r.plan; t.ingReal += r.real; });
    m.gastos.forEach(function (r) {
      t.gasPlan += r.plan; t.gasReal += r.real;
      var c = t.byCat[r.cat] || (t.byCat[r.cat] = { plan: 0, real: 0 });
      c.plan += r.plan; c.real += r.real;
      t.byGroup[(catById(r.cat) || { group: "gus" }).group] += r.real;
    });
    t.saldo = t.ingReal - t.gasReal;
    t.ahorro = t.byGroup.aho + Math.max(t.saldo, 0);
    return t;
  }
  function prevKey() {
    var ks = monthKeys(), i = ks.indexOf(state.mes);
    return i > 0 ? ks[i - 1] : null;
  }

  function recompute() {
    var t = totalsOf(cur());
    var pk = hasPremium() ? prevKey() : null, pt = pk ? totalsOf(state.meses[pk]) : null;
    $("s-ing").textContent = money(t.ingReal);
    $("s-ing-sub").textContent = "Planeado " + money(t.ingPlan);
    $("s-gas").textContent = money(t.gasReal);
    if (pt && pt.gasReal > 0) {
      var ch = t.gasReal / pt.gasReal - 1;
      $("s-gas-sub").innerHTML = '<span class="cmp ' + (ch > 0 ? "neg" : "pos") + '">' + (ch > 0 ? "▲ " : "▼ ") + pctf(Math.abs(ch)) + "</span> vs " + esc(monthLabel(pk).toLowerCase());
    } else {
      $("s-gas-sub").textContent = t.ingReal > 0 ? pctf(t.gasReal / t.ingReal) + " de tus ingresos" : "Planeado " + money(t.gasPlan);
    }
    $("s-saldo").textContent = money(t.saldo);
    $("s-saldo-sub").textContent = "Planeado " + money(t.ingPlan - t.gasPlan);
    $("t-saldo").classList.toggle("neg", t.saldo < 0);
    $("s-ahorro").textContent = t.ingReal > 0 ? pctf(t.ahorro / t.ingReal) : "–";
    $("s-ahorro-sub").textContent = money(t.ahorro) + " (ahorro + saldo libre)";

    $("ft-ing-plan").textContent = money(t.ingPlan);
    $("ft-ing-real").textContent = money(t.ingReal);
    $("ft-ing-diff").innerHTML = diffHtml(t.ingReal - t.ingPlan);
    $("ft-gas-plan").textContent = money(t.gasPlan);
    $("ft-gas-real").textContent = money(t.gasReal);
    $("ft-gas-diff").innerHTML = diffHtml(t.gasPlan - t.gasReal);

    // Categorías
    var seen = {}, list = [];
    cats().concat(state.categorias).forEach(function (c) { if (!seen[c.id]) { seen[c.id] = 1; list.push(c); } });
    var html = list.filter(function (c) { var x = t.byCat[c.id]; return x && (x.plan || x.real); }).map(function (c) {
      var x = t.byCat[c.id];
      var ratio = x.plan > 0 ? x.real / x.plan : (x.real > 0 ? Infinity : 0);
      var cls, chip;
      if (x.plan === 0) { cls = "bad"; chip = '<span class="chip none">Sin plan</span>'; }
      else if (c.group === "aho") { cls = ratio >= 1 ? "" : "warn"; chip = '<span class="chip ' + (ratio >= 1 ? "ok" : "warn") + '">' + pctf(ratio) + "</span>"; }
      else if (ratio > 1) { cls = "bad"; chip = '<span class="chip bad">Excedido ' + pctf(ratio - 1) + "</span>"; }
      else if (ratio >= 0.9) { cls = "warn"; chip = '<span class="chip warn">' + pctf(ratio) + "</span>"; }
      else { cls = ""; chip = '<span class="chip ok">' + pctf(ratio) + "</span>"; }
      var w = Math.min(isFinite(ratio) ? ratio : 1, 1) * 100;
      if (cls === "warn") cls = "";   // el color de la categoría se mantiene; el porcentaje en ámbar avisa
      return '<div class="cat" role="button" tabindex="0" data-cat="' + esc(c.id) + '" style="--c:' + catColor(c.id) + '"><div class="cat-top">' + catIcon(c.id) + '<span class="cat-name">' + esc(c.name) + "</span>" + chip + "</div>" +
        '<div class="bar" role="img" aria-label="' + esc(c.name) + ": " + money(x.real) + " de " + money(x.plan) + '"><div class="fill ' + cls + '" style="width:' + w.toFixed(1) + '%"></div></div>' +
        '<div class="cat-nums">' + money(x.real) + " de " + money(x.plan) + "</div></div>";
    }).join("");
    $("cat-list").innerHTML = html || '<p class="empty">Agrega gastos para ver la ejecución por categoría.</p>';

    // 50/30/20
    var base = t.ingReal || t.ingPlan;
    $("rule").innerHTML = [
      { name: "Necesidades", val: t.byGroup.nec, target: 0.5, over: true },
      { name: "Gustos", val: t.byGroup.gus, target: 0.3, over: true },
      { name: "Ahorro", val: t.ahorro, target: 0.2, over: false }
    ].map(function (r) {
      var share = base > 0 ? r.val / base : 0;
      var ok = r.over ? share <= r.target : share >= r.target;
      var chip = base > 0 ? '<span class="chip ' + (ok ? "ok" : "warn") + '">' + (ok ? "En meta" : (r.over ? "Por encima" : "Por debajo")) + "</span>" : "";
      return '<div class="rule-row"><div class="rule-top"><b>' + r.name + " " + chip + "</b><span>" + pctf(share) + " · meta " + pctf(r.target) + "</span></div>" +
        '<div class="rule-bar" role="img" aria-label="' + r.name + ": " + pctf(share) + " de los ingresos, meta " + pctf(r.target) + '">' +
        '<div class="fill" style="width:' + Math.min(share * 100, 100).toFixed(1) + '%"></div><div class="target" style="left:calc(' + (r.target * 100) + '% - 1px)"></div></div>' +
        '<div class="cat-nums">' + money(r.val) + "</div></div>";
    }).join("");
    var names = { nec: [], gus: [], aho: [] };
    list.forEach(function (c) { names[c.group].push(c.name.toLowerCase()); });
    $("rule-legend").textContent = "Necesidades: " + names.nec.join(", ") + ". Gustos: " + names.gus.join(", ") + ". Ahorro: " + names.aho.join(", ") + ", más el saldo que quede libre.";

    renderPagos();
    renderHist();
    renderInicio(t);
  }

