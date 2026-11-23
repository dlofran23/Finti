  // ===================== Excel =====================
  function sheetRows() {
    var rows = [["Tipo", "Concepto", "Categoría", "Día de pago", "Planeado", "Real", "Diferencia"]];
    cur().ingresos.forEach(function (r) { rows.push(["Ingreso", r.concepto, "", "", r.plan, r.real, r.real - r.plan]); });
    cur().gastos.forEach(function (r) { rows.push(["Gasto", r.concepto, (catById(r.cat) || {}).name || "", r.dia || "", r.plan, r.real, r.plan - r.real]); });
    return rows;
  }
  $("btn-copy").addEventListener("click", function () {
    var btn = this, lbl = btn.querySelector("span") || btn, text = sheetRows().map(function (r) { return r.join("\t"); }).join("\n");
    function done(msg) { lbl.textContent = msg; setTimeout(function () { lbl.textContent = "Copiar para Excel"; }, 2200); }
    try { navigator.clipboard.writeText(text).then(function () { done("Copiado ✓"); }, function () { done("No se pudo copiar"); }); }
    catch (e) { done("No se pudo copiar"); }
  });
