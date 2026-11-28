  // ===================== Meses =====================
  function renderHeader() {
    $("f-titulo").value = state.titulo;
    var ks = monthKeys().slice().reverse();
    $("f-mes").innerHTML = ks.map(function (k) { return '<option value="' + k + '"' + (k === state.mes ? " selected" : "") + ">" + esc(monthLabel(k)) + "</option>"; }).join("");
    $("example-notice").hidden = !state.ejemplo;
  }
  var MESES_GRATIS = 3;
  function switchMonth(k) {
    if (!state.meses[k] || k === state.mes) return;
    state.mes = k; changed(); renderAll();
  }
  $("f-titulo").addEventListener("input", function () { state.titulo = this.value.slice(0, 80); changed(); });
  $("f-mes").addEventListener("change", function () { switchMonth(this.value); });
  $("btn-nuevo-mes").addEventListener("click", function () {
    var ks = monthKeys();
    var next = addMonths(ks[ks.length - 1], 1);
    $("f-nuevo-mes").value = next;
    $("mes-free-warn").hidden = hasPremium();
    if (!hasPremium()) $("mes-free-warn").textContent = ks.length >= MESES_GRATIS ?
      "En la versión gratis se guardan tus últimos " + MESES_GRATIS + " meses: al crear este, se borra " + monthLabel(ks[0]).toLowerCase() + ". Con Premium guardas todo tu historial." :
      "En la versión gratis guardas hasta " + MESES_GRATIS + " meses. Te " + (MESES_GRATIS - ks.length === 1 ? "queda 1 mes libre." : "quedan " + (MESES_GRATIS - ks.length) + " meses libres.") + " Con Premium guardas todo tu historial.";
    $("mes-status").textContent = "";
    $("btn-borrar-mes").hidden = ks.length < 2;
    $("btn-borrar-mes").textContent = "Eliminar " + monthLabel(state.mes).toLowerCase();
    borrarArmed = false;
    openDlg("dlg-mes", "#f-nuevo-mes");
  });
  $("btn-crear-mes").addEventListener("click", function () {
    var k = $("f-nuevo-mes").value;
    if (!validKey(k)) { $("mes-status").textContent = "Elige un mes válido."; return; }
    if (state.meses[k]) { $("mes-status").textContent = "Ese mes ya existe. Elígelo en el selector de meses."; return; }
    var src = cur(), m = { ingresos: [], gastos: [] };
    if ($("f-copiar").checked) {
      m.ingresos = src.ingresos.map(function (r) { return { id: rid("i"), concepto: r.concepto, plan: r.plan, real: 0 }; });
      m.gastos = src.gastos.map(function (r) { return { id: rid("g"), concepto: r.concepto, cat: r.cat, dia: r.dia, plan: r.plan, real: 0 }; });
    }
    state.meses[k] = m; state.mes = k;
    if (!hasPremium()) {   // la versión gratis conserva los últimos meses
      var todas = monthKeys().filter(function (x) { return x !== k; });
      while (todas.length >= MESES_GRATIS) delete state.meses[todas.shift()];
    }
    changed(); closeDlg("dlg-mes"); renderAll();
  });
  var borrarArmed = false;
  $("btn-borrar-mes").addEventListener("click", function () {
    var ks = monthKeys(); if (ks.length < 2) return;
    if (!borrarArmed) { borrarArmed = true; this.textContent = "¿Seguro? Se borra " + monthLabel(state.mes).toLowerCase() + ". Toca otra vez"; return; }
    delete state.meses[state.mes];
    ks = monthKeys(); state.mes = ks[ks.length - 1];
    changed(); closeDlg("dlg-mes"); renderAll();
  });

  // Poner en cero, con confirmación en dos clics
  var zeroBtn = $("btn-zero"), zeroArmed = false, zeroTimer;
  zeroBtn.addEventListener("click", function () {
    if (!zeroArmed) {
      zeroArmed = true; zeroBtn.textContent = "¿Seguro? Toca otra vez";
      zeroTimer = setTimeout(function () { zeroArmed = false; zeroBtn.textContent = "Poner montos en cero"; }, 4000);
      return;
    }
    clearTimeout(zeroTimer);
    cur().ingresos.forEach(function (r) { r.plan = 0; r.real = 0; });
    cur().gastos.forEach(function (r) { r.plan = 0; r.real = 0; });
    state.cuentas.forEach(function (c) { c.saldo = 0; c.cupo = 0; });
    state.porPagar.forEach(function (b) { b.monto = 0; b.pagos = {}; });
    state.ejemplo = false;
    renderAll(); changed();
  });

