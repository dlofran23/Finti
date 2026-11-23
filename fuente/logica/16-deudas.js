  // ===================== Deudas =====================
  function simulate(debts, extra, method, rollover) {
    var ds = debts.filter(function (d) { return d.saldo > 0; }).map(function (d) {
      return { id: d.id, nombre: d.nombre, b: d.saldo, r: Math.pow(1 + d.tasa / 100, 1 / 12) - 1, cuota: d.cuota, paid: 0 };
    });
    var res = { ok: true, months: 0, interest: 0, order: [] };
    if (!ds.length) return res;
    var budget = ds.reduce(function (s, d) { return s + d.cuota; }, 0) + extra;
    for (var m = 1; m <= 600; m++) {
      var active = ds.filter(function (d) { return d.b > 0.5; });
      if (!active.length) break;
      active.forEach(function (d) { var i = d.b * d.r; d.b += i; res.interest += i; });
      var avail = rollover ? budget : active.reduce(function (s, d) { return s + d.cuota; }, 0) + extra;
      active.forEach(function (d) { var p = Math.min(d.cuota, d.b, avail); d.b -= p; avail -= p; });
      active.filter(function (d) { return d.b > 0.5; })
        .sort(method === "bola" ? function (a, b) { return a.b - b.b; } : function (a, b) { return b.r - a.r || a.b - b.b; })
        .forEach(function (d) { if (avail <= 0) return; var p = Math.min(avail, d.b); d.b -= p; avail -= p; });
      active.forEach(function (d) { if (d.b <= 0.5 && !d.paid) d.paid = m; });
    }
    res.ok = ds.every(function (d) { return d.paid > 0; });
    res.months = res.ok ? Math.max.apply(null, ds.map(function (d) { return d.paid; })) : 600;
    res.order = ds.slice().sort(function (a, b) { return (a.paid || 9999) - (b.paid || 9999); });
    return res;
  }

  function renderDeudas() {
    var body = $("deudas-body");
    if (!hasPremium()) { body.innerHTML = lockCard("Anota tus tarjetas y créditos, y te mostramos en qué orden pagarlos, cuántos intereses te ahorras y en qué mes quedas libre de deudas."); return; }
    var rows = state.deudas.map(function (d) {
      return '<tr data-id="' + esc(d.id) + '"><td class="c-concept" data-label="Deuda"><input class="concept" data-f="nombre" value="' + esc(d.nombre) + '" aria-label="Deuda"></td>' +
        '<td class="num" data-label="Saldo">' + moneyInput("deu-s-" + esc(d.id), "saldo", d.saldo, "Saldo") + "</td>" +
 '<td class="num" data-label="Tasa E. A. %"><input class="day-input" data-f="tasa" type="number" inputmode="decimal" step="0.1" min="0" value="' + d.tasa + '" aria-label="Tasa efectiva anual" style="width:70px"></td>' +
        '<td class="num" data-label="Cuota mínima">' + moneyInput("deu-c-" + esc(d.id), "cuota", d.cuota, "Cuota mínima") + '</td><td class="c-del">' + delBtn(d.nombre) + "</td></tr>";
    }).join("");
    body.innerHTML =
      '<div class="table-scroll"><table class="rows"><thead><tr><th>Deuda</th><th class="num">Saldo</th><th class="num">Tasa E. A. %</th><th class="num">Cuota mínima</th><th aria-label="Eliminar"></th></tr></thead><tbody id="tb-deu">' +
      (rows || '<tr><td colspan="5" class="empty">Agrega tus tarjetas de crédito y préstamos.</td></tr>') + "</tbody></table></div>" +
      '<button class="add-btn" type="button" id="add-deuda">+ Agregar deuda</button>' +
      '<div class="debt-extra"><label>Pago extra al mes<input class="field" id="f-extra" type="number" inputmode="numeric" step="10000" min="0" value="' + state.deudaExtra + '"></label>' +
      '<div class="seg" role="group" aria-label="Método"><button type="button" data-metodo="avalancha" aria-pressed="' + (state.deudaMetodo === "avalancha") + '">Avalancha</button><button type="button" data-metodo="bola" aria-pressed="' + (state.deudaMetodo === "bola") + '">Bola de nieve</button></div></div>' +
      '<p class="hint">' + (state.deudaMetodo === "avalancha" ? "Avalancha: primero la deuda con la tasa más alta. Es la que menos intereses te cobra en total." : "Bola de nieve: primero la deuda más pequeña. Te da victorias rápidas que motivan a seguir.") +
      " Cuando terminas una deuda, su cuota pasa a la siguiente.</p>" +
      '<div id="deu-res"></div>';
    renderDebtResults();
  }
  function renderDebtResults() {
    var box = $("deu-res"); if (!box) return;
    var valid = state.deudas.filter(function (d) { return d.saldo > 0; });
    if (!valid.length) { box.innerHTML = ""; return; }
    var plan = simulate(valid, state.deudaExtra, state.deudaMetodo, true);
    var minOnly = simulate(valid, 0, state.deudaMetodo, false);
    var warn = valid.filter(function (d) { return d.cuota <= d.saldo * (Math.pow(1 + d.tasa / 100, 1 / 12) - 1); });
    var html = warn.length ? '<p class="warn-box">La cuota de ' + warn.map(function (d) { return "<b>" + esc(d.nombre) + "</b>"; }).join(", ") + " no alcanza a cubrir los intereses del mes: así la deuda no baja. Revisa la cuota o súmale un pago extra.</p>" : "";
    if (!plan.ok) { box.innerHTML = html + '<p class="warn-box">Con estos pagos, las deudas no terminan de pagarse en 50 años. Aumenta el pago extra o las cuotas.</p>'; return; }
    var fin = addMonths(nowKey(), plan.months);
    var ahorroInt = minOnly.ok ? minOnly.interest - plan.interest : null;
    html += '<div class="results">' +
      '<div class="result"><span class="label">Libre de deudas en</span><span class="value">' + plan.months + (plan.months === 1 ? " mes" : " meses") + '</span><span class="sub">' + esc(monthLabel(fin)) + "</span></div>" +
      '<div class="result"><span class="label">Intereses totales</span><span class="value">' + money(plan.interest) + '</span><span class="sub">con este plan</span></div>' +
      '<div class="result"><span class="label">Frente a pagar solo mínimos</span><span class="value">' + (minOnly.ok ? money(Math.max(ahorroInt, 0)) : "—") + '</span><span class="sub">' +
      (minOnly.ok ? "menos intereses y " + Math.max(minOnly.months - plan.months, 0) + " meses antes" : "solo con mínimos no terminarías") + "</span></div></div>" +
      '<ol class="order">' + plan.order.map(function (d) { return "<li>" + esc(d.nombre || "Deuda") + " <span>· pagada en " + esc(monthLabel(addMonths(nowKey(), d.paid)).toLowerCase()) + "</span></li>"; }).join("") + "</ol>";
    box.innerHTML = html;
  }
  $("deudas-body").addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "f-extra") { state.deudaExtra = Math.max(0, num(t.value)); changed(); renderDebtResults(); return; }
    var tr = t.closest("tr[data-id]"); if (!tr || !t.dataset.f) return;
    var d = state.deudas.find(function (x) { return x.id === tr.dataset.id; }); if (!d) return;
    var f = t.dataset.f;
    if (f === "nombre") d.nombre = t.value.slice(0, 60);
    else if (f === "tasa") d.tasa = clamp(num(t.value), 0, 400);
    else d[f] = Math.max(0, num(t.value));
    changed(); renderDebtResults();
  });
  $("deudas-body").addEventListener("click", function (e) {
    var m = e.target.closest("[data-metodo]");
    if (m) { state.deudaMetodo = m.dataset.metodo; changed(); renderDeudas(); return; }
    if (e.target.closest("#add-deuda")) {
      var d = { id: rid("d"), nombre: "Nueva deuda", saldo: 0, tasa: 0, cuota: 0 };
      state.deudas.push(d); changed(); renderDeudas();
      var el = $("deudas-body").querySelector('tr[data-id="' + d.id + '"] [data-f="nombre"]'); if (el) { el.focus(); el.select(); }
      return;
    }
    var b = e.target.closest("[data-del]"); if (!b) return;
    var id = b.closest("tr").dataset.id;
    state.deudas = state.deudas.filter(function (x) { return x.id !== id; }); changed(); renderDeudas();
  });

