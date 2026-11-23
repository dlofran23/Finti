  // ===================== Historial =====================
  function renderHist() {
    var body = $("hist-body");
    if (!hasPremium()) { body.innerHTML = lockCard("Guarda todos tus meses, compáralos y mira en una gráfica cómo evolucionan tus ingresos y gastos."); return; }
    var ks = monthKeys().slice(-12);
    var data = ks.map(function (k) { var t = totalsOf(state.meses[k]); return { k: k, ing: t.ingReal, gas: t.gasReal, saldo: t.saldo, tasa: t.ingReal > 0 ? t.ahorro / t.ingReal : null }; });
    var max = Math.max.apply(null, data.map(function (d) { return Math.max(d.ing, d.gas); }).concat([1]));
    var mag = Math.pow(10, Math.floor(Math.log10(max))), nice = Math.ceil(max / mag * 2) / 2 * mag;
    var W = 340, H = 170, L = 44, R = 6, T = 8, B = 22, cw = (W - L - R) / data.length, bw = Math.min(16, cw * 0.32);
    var y = function (v) { return T + (H - T - B) * (1 - v / nice); };
    var svg = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Ingresos y gastos reales por mes">';
    [0, 0.5, 1].forEach(function (f) {
      var yy = y(nice * f);
      svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--line)" stroke-width="1"/>';
      svg += '<text x="' + (L - 6) + '" y="' + (yy + 3) + '" text-anchor="end">$ ' + esc(compact.format(nice * f)) + "</text>";
    });
    data.forEach(function (d, i) {
      var cx = L + cw * i + cw / 2, sel = d.k === state.mes;
      svg += '<rect x="' + (cx - bw - 1) + '" y="' + y(d.ing) + '" width="' + bw + '" height="' + Math.max(0, H - B - y(d.ing)) + '" rx="2" fill="color-mix(in srgb, var(--accent) 35%, var(--surface))"><title>Ingresos ' + esc(monthLabel(d.k)) + ": " + money(d.ing) + "</title></rect>";
      svg += '<rect x="' + (cx + 1) + '" y="' + y(d.gas) + '" width="' + bw + '" height="' + Math.max(0, H - B - y(d.gas)) + '" rx="2" fill="var(--accent)"><title>Gastos ' + esc(monthLabel(d.k)) + ": " + money(d.gas) + "</title></rect>";
      svg += '<text x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle"' + (sel ? ' style="fill:var(--ink);font-weight:700"' : "") + ">" + esc(monthShort(d.k)) + "</text>";
    });
    svg += "</svg>";
    var table = '<div class="table-scroll"><table class="hist-table"><thead><tr><th>Mes</th><th class="num">Gastos</th><th class="num">Saldo</th><th class="num">Ahorro</th></tr></thead><tbody>' +
      data.slice().reverse().map(function (d) {
        return '<tr data-mes="' + d.k + '"' + (d.k === state.mes ? ' class="sel"' : "") + ' tabindex="0"><td>' + esc(monthLabel(d.k)) + '</td><td class="num">' + money(d.gas) +
          '</td><td class="num ' + (d.saldo < 0 ? "neg" : "") + '">' + money(d.saldo) + '</td><td class="num">' + (d.tasa == null ? "–" : pctf(d.tasa)) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    body.innerHTML = '<div class="chart-wrap"><div class="legend"><span><i style="background:color-mix(in srgb, var(--accent) 35%, var(--surface))"></i>Ingresos</span><span><i style="background:var(--accent)"></i>Gastos</span></div>' + svg + "</div>" +
      (data.length < 2 ? '<p class="empty">Crea tu siguiente mes con <b>+ Nuevo mes</b> y aquí verás la comparación.</p>' : "") + table;
  }
  $("hist-body").addEventListener("click", function (e) { var tr = e.target.closest("tr[data-mes]"); if (tr) switchMonth(tr.dataset.mes); });
  $("hist-body").addEventListener("keydown", function (e) { var tr = e.target.closest("tr[data-mes]"); if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); switchMonth(tr.dataset.mes); } });

