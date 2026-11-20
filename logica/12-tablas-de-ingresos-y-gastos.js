  // ===================== Tablas de ingresos y gastos =====================
  function catOptions(sel) {
    var list = cats();
    if (!list.some(function (c) { return c.id === sel; })) { var c0 = catById(sel); if (c0) list = list.concat([c0]); }
    return list.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === sel ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("");
  }
  function diffHtml(d) { var cls = d > 0 ? "pos" : d < 0 ? "neg" : "zero"; return '<span class="' + cls + '">' + signed(d) + "</span>"; }
  // Diferencia y, si hay plan, una barra con lo que va de lo planeado (en el color de la categoría).
  function diffUso(r, gasto) {
    var h = diffHtml(gasto ? r.plan - r.real : r.real - r.plan);
    if (!(r.plan > 0)) return h;
    var x = r.real / r.plan;
    return h + '<span class="uso" aria-hidden="true"><i class="' + (gasto && x > 1 ? "pasado" : "") + '" style="width:' + Math.min(100, x * 100).toFixed(1) + '%"></i></span>';
  }
  function moneyInput(id, f, v, label) {
    // Texto con puntos de miles (3.200.000) para que se lea igual que los totales; se escribe con o sin puntos.
    return '<input class="money" id="' + id + '" data-f="' + f + '" type="text" inputmode="numeric" autocomplete="off" value="' + miles(v) + '" aria-label="' + label + '">';
  }
  function miles(v) { v = Math.max(0, Math.round(+v || 0)); return v ? new Intl.NumberFormat("es-CO").format(v) : "0";
  }
  function delBtn(name) { return '<button class="icon-btn" type="button" data-del="1" aria-label="Eliminar ' + esc(name) + '" title="Eliminar">×</button>'; }

  function renderIngresos() {
    $("tb-ing").innerHTML = cur().ingresos.map(function (r) {
      return '<tr data-id="' + esc(r.id) + '" style="--c:#2fbf71">' +
        '<td class="c-concept" data-label="Concepto"><input class="concept" id="ing-c-' + esc(r.id) + '" data-f="concepto" value="' + esc(r.concepto) + '" aria-label="Concepto"></td>' +
        '<td class="num" data-label="Planeado">' + moneyInput("ing-p-" + esc(r.id), "plan", r.plan, "Planeado") + "</td>" +
        '<td class="num" data-label="Real">' + moneyInput("ing-r-" + esc(r.id), "real", r.real, "Real") + "</td>" +
        '<td class="num diff" data-label="Diferencia">' + diffUso(r, false) + '</td><td class="c-del">' + delBtn(r.concepto) + "</td></tr>";
    }).join("");
  }
  function renderGastos() {
    $("tb-gas").innerHTML = cur().gastos.map(function (r) {
      return '<tr data-id="' + esc(r.id) + '" style="--c:' + catColor(r.cat) + '">' +
        '<td class="c-concept" data-label="Concepto"><input class="concept" id="gas-c-' + esc(r.id) + '" data-f="concepto" value="' + esc(r.concepto) + '" aria-label="Concepto"></td>' +
        '<td class="c-cat" data-label="Categoría"><select id="gas-k-' + esc(r.id) + '" data-f="cat" aria-label="Categoría">' + catOptions(r.cat) + "</select></td>" +
        '<td class="num c-day" data-label="Día"><input class="day-input" id="gas-d-' + esc(r.id) + '" data-f="dia" type="number" inputmode="numeric" min="1" max="31" value="' + (r.dia || "") + '" placeholder="–" aria-label="Día de pago"></td>' +
        '<td class="num" data-label="Planeado">' + moneyInput("gas-p-" + esc(r.id), "plan", r.plan, "Planeado") + "</td>" +
        '<td class="num" data-label="Real">' + moneyInput("gas-r-" + esc(r.id), "real", r.real, "Real") + "</td>" +
        '<td class="num diff" data-label="Diferencia">' + diffUso(r, true) + '</td><td class="c-del">' + delBtn(r.concepto) + "</td></tr>";
    }).join("");
  }
  function wireTable(tbodyId, listName) {
    var tb = $(tbodyId), isGasto = listName === "gastos";
    function rowOf(tr) { return cur()[listName].find(function (r) { return r.id === tr.dataset.id; }); }
    tb.addEventListener("input", function (e) {
      var t = e.target, tr = t.closest("tr"); if (!tr || !t.dataset.f) return;
      var row = rowOf(tr); if (!row) return;
      var f = t.dataset.f;
      if (f === "plan" || f === "real") row[f] = parseMonto(t.value);
      else if (f === "dia") row.dia = clamp(Math.round(num(t.value)), 0, 31);
      else if (f === "concepto") row.concepto = t.value.slice(0, 80);
      if (f === "plan" || f === "real") tr.querySelector(".diff").innerHTML = diffUso(row, isGasto);
      changed(); recompute();
    });
    tb.addEventListener("focusout", function (e) {
      var t = e.target; if (!t.classList || !t.classList.contains("money")) return;
      var row = rowOf(t.closest("tr")); if (row) t.value = miles(row[t.dataset.f]);
    });
    tb.addEventListener("change", function (e) {
      if (e.target.tagName !== "SELECT") return;
      var row = rowOf(e.target.closest("tr")); if (!row) return;
      row.cat = e.target.value; e.target.closest("tr").style.setProperty("--c", catColor(row.cat)); changed(); recompute();
    });
    tb.addEventListener("click", function (e) {
      var b = e.target.closest("[data-del]"); if (!b) return;
      var arr = cur()[listName], id = b.closest("tr").dataset.id;
      var i = arr.findIndex(function (r) { return r.id === id; });
      if (i > -1) arr.splice(i, 1);
      isGasto ? renderGastos() : renderIngresos();
      changed(); recompute();
    });
  }
  $("add-ing").addEventListener("click", function () {
    var r = { id: rid("i"), concepto: "Nuevo ingreso", plan: 0, real: 0 };
    cur().ingresos.push(r); renderIngresos(); recompute(); changed();
    var el = $("ing-c-" + r.id); if (el) { el.focus(); el.select(); }
  });
  $("add-gas").addEventListener("click", function () {
    var r = { id: rid("g"), concepto: "Nuevo gasto", cat: "otros", dia: 0, plan: 0, real: 0 };
    cur().gastos.push(r); renderGastos(); recompute(); changed();
    var el = $("gas-c-" + r.id); if (el) { el.focus(); el.select(); }
  });

