  // ===================== Buscar movimientos =====================
  // Busca en el historial con fecha: concepto, comercio, categoría, valor ("18 mil", "18.000") y mes ("octubre").
  var bsTipo = "todo";
  function buscarMovs(q, tipo) {
    var n = nrm(q).trim(), monto = 0, mes = -1, palabras = [];
    if (n) {
      monto = prMonto(n) || (/^\$?\s*[\d.]+$/.test(q.trim()) ? +q.replace(/\D/g, "") : 0);
      n.split(/\s+/).forEach(function (w) {
        var i = MESES.map(nrm).indexOf(w); if (i > -1) { mes = i; return; }
        if (/^(de|del|en|la|el|los|las|y|mil|lucas?|pesos|\$)$/.test(w) || /^\d[\d.,]*$/.test(w)) return;
        palabras.push(w);
      });
    }
    var res = state.movs.filter(function (x) {
      if (tipo !== "todo" && x.t !== tipo) return false;
      if (mes > -1 && +x.f.slice(5, 7) - 1 !== mes) return false;
      if (monto && Math.abs(x.m - monto) > Math.max(500, monto * 0.02)) return false;
      if (!palabras.length) return !!(monto || mes > -1);
      var hay = nrm([x.c, x.com, (catById(x.cat) || { name: x.t === "i" ? "ingreso" : "" }).name].join(" "));
      return palabras.every(function (w) { return hay.indexOf(w) > -1; });
    });
    return res.sort(function (a, b) { return a.f < b.f ? 1 : a.f > b.f ? -1 : (b.h || 0) - (a.h || 0); });
  }
  function renderBuscar() {
    var q = $("bs-q").value, l = buscarMovs(q, bsTipo), box = $("bs-lista");
    if (!q.trim()) { $("bs-res").textContent = state.movs.length ? "Escribe lo que buscas." : "Aquí aparecen los gastos e ingresos que anotas."; box.innerHTML = ""; return; }
    var gas = 0, ing = 0; l.forEach(function (x) { if (x.t === "g") gas += x.m; else ing += x.m; });
    $("bs-res").textContent = l.length ? pl2(l.length, "movimiento", "movimientos") + (gas ? " · gastos por " + money(gas) : "") + (ing ? " · ingresos por " + money(ing) : "") : "No encontré movimientos con eso.";
    var dia = "", html = "";
    l.slice(0, 120).forEach(function (x) {
      if (x.f !== dia) { dia = x.f; html += '<h3 class="bs-dia">' + esc(cap(fechaLarga(parseD(x.f), true))) + "</h3>"; }
      var ing2 = x.t === "i", nom = x.c || (catById(x.cat) || { name: ing2 ? "Ingreso" : "Gasto" }).name;
      html += '<div class="bs-item" style="--c:' + (ing2 ? "var(--good)" : catColor(x.cat)) + '">' + (ing2 ? '<span class="cat-ic" style="--c:var(--good)"><svg class="ic"><use href="#i-coins"/></svg></span>' : catIcon(x.cat)) +
        '<span class="bs-n"><b>' + esc(nom) + "</b><small>" + esc([(catById(x.cat) || { name: ing2 ? "Ingreso" : "" }).name, x.com && x.com !== x.c ? x.com : "", horaTxt(x.h)].filter(Boolean).join(" · ")) + "</small></span>" +
        '<b class="cifra' + (ing2 ? " pos" : "") + '">' + (ing2 ? "+" : "−") + money(x.m) + "</b></div>";
    });
    if (l.length > 120) html += '<p class="hint">Muestro los 120 más recientes.</p>';
    box.innerHTML = html;
  }
  // Movimientos: lo anotado este mes, agrupado por día, con el total de cada día
  var pdDias = 7;
  function nombreDia(f) {
    var d = parseD(f), h = parseD(hoyStr()); if (!d || !h) return f;
    var dif = Math.round((h - d) / 864e5);
    if (dif === 0) return "Hoy"; if (dif === 1) return "Ayer";
    return cap(["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][d.getDay()] + " " + fechaLarga(d));
  }
  var pdFiltro = "todas";
  function renderPorDia() {
    var box = $("pd-lista"); if (!box) return;
    var delMes = state.movs.filter(function (x) { return (x.f || "").slice(0, 7) === state.mes; });
    // Filtros: Todas, Ingresos y las categorías que tienen movimientos este mes
    var cats = [], vistos = {}, hayIng = false;
    delMes.forEach(function (x) { if (x.t !== "g") { hayIng = true; return; } var k = x.cat || "otros"; if (!vistos[k]) { vistos[k] = 1; cats.push(k); } });
    if (pdFiltro !== "todas" && pdFiltro !== "ing" && !vistos[pdFiltro]) pdFiltro = "todas";
    if (pdFiltro === "ing" && !hayIng) pdFiltro = "todas";
    var fil = [{ k: "todas", n: "Todas", c: "var(--ink)" }].concat(hayIng ? [{ k: "ing", n: "Ingresos", c: "var(--good)" }] : [], cats.map(function (k) { return { k: k, n: (catById(k) || { name: "Otros" }).name, c: catColor(k) }; }));
    $("mv-filtros").hidden = fil.length <= 2;
    $("mv-filtros").innerHTML = fil.map(function (f) { return '<button type="button" class="mv-fil" data-mv-fil="' + esc(f.k) + '" aria-pressed="' + (pdFiltro === f.k) + '" style="--c:' + f.c + '">' + (f.k !== "todas" ? '<i aria-hidden="true"></i>' : "") + esc(f.n) + "</button>"; }).join("");
    var l = delMes.filter(function (x) { return pdFiltro === "todas" || (pdFiltro === "ing" ? x.t !== "g" : x.t === "g" && (x.cat || "otros") === pdFiltro); }).sort(function (a, b) { return a.f < b.f ? 1 : a.f > b.f ? -1 : (b.h || 0) - (a.h || 0); });
    var dias = []; l.forEach(function (x) { var u = dias[dias.length - 1]; if (!u || u.f !== x.f) dias.push(u = { f: x.f, l: [], g: 0, i: 0 }); u.l.push(x); if (x.t === "g") u.g += x.m; else u.i += x.m; });
    var gas = 0; l.forEach(function (x) { if (x.t === "g") gas += x.m; });
    $("pd-total").textContent = l.length ? pl2(l.length, "movimiento", "movimientos") + " · " + money(gas) + " en gastos" : "";
    var ingF = 0; l.forEach(function (x) { if (x.t !== "g") ingF += x.m; });
    $("mv-resumen").textContent = l.length ? pl2(l.length, "movimiento", "movimientos") + " · " + money(pdFiltro === "ing" ? ingF : gas) + (pdFiltro === "ing" ? " recibidos" : " en gastos") : "Lo que anotas en " + monthLabel(state.mes).toLowerCase() + ", día por día.";
    $("pd-mas").hidden = dias.length <= pdDias;
    if (!l.length) {
      box.innerHTML = '<p class="empty">Aún no anotas movimientos en ' + esc(monthLabel(state.mes).toLowerCase()) + '. Cuéntame un gasto o conecta tu banco y aquí los verás, día por día.</p><button class="btn primary pd-anotar" type="button" data-clic-reg>Cuéntame un gasto</button>';
      return;
    }
    box.innerHTML = dias.slice(0, pdDias).map(function (d, k) {
      return '<div class="pd-dia" style="--i:' + k + '"><h3 class="pd-cab"><span>' + esc(nombreDia(d.f)) + '</span><span class="pd-suma">' + (d.g ? "−" + money(d.g) : "") + (d.g && d.i ? " · " : "") + (d.i ? '<span class="pos">+' + money(d.i) + "</span>" : "") + "</span></h3>" +
        d.l.map(function (x) {
          var ing = x.t === "i", nom = x.c || (catById(x.cat) || { name: ing ? "Ingreso" : "Gasto" }).name;
          var acc = x.cu ? cuentaById(x.cu) : null;
          return '<div class="bs-item pd-item" style="--c:' + (ing ? "var(--good)" : catColor(x.cat)) + '">' + (ing ? ingIcon() : catIcon(x.cat)) +
            '<span class="bs-n"><b>' + esc(nom) + "</b><small>" + esc([(catById(x.cat) || { name: ing ? "Ingreso" : "" }).name, x.com && x.com !== x.c ? x.com : "", horaTxt(x.h)].filter(Boolean).join(" · ")) +
            (acc ? '<span class="mv-cta"><i style="--m:' + marcaCuenta(acc).c + '" aria-hidden="true"></i>' + esc(acc.nombre) + "</span>" : "") + "</small></span>" +
            '<b class="cifra' + (ing ? " pos" : "") + '">' + (ing ? "+" : "−") + money(x.m) + "</b></div>";
        }).join("") + "</div>";
    }).join("");
  }
  $("pd-mas").addEventListener("click", function () { pdDias += 14; renderPorDia(); });
  $("mv-filtros").addEventListener("click", function (e) { var b = e.target.closest("[data-mv-fil]"); if (!b) return; pdFiltro = b.dataset.mvFil; vibrar(8); renderPorDia(); });
  document.addEventListener("click", function (e) { if (e.target.closest("[data-clic-reg]")) $("fab-add").click(); });
  function abrirBuscar() { $("bs-q").value = ""; renderBuscar(); openDlg("dlg-buscar", "#bs-q"); metrica("buscar", "dia"); }
  $("bs-q").addEventListener("input", renderBuscar);
  document.querySelector(".bs-filtros").addEventListener("click", function (e) { var b = e.target.closest("[data-bs]"); if (!b) return; bsTipo = b.dataset.bs; [].forEach.call(this.children, function (x) { x.setAttribute("aria-pressed", String(x === b)); }); renderBuscar(); });
  $("btn-buscar-menu").addEventListener("click", function () { cerrarMenu(); abrirBuscar(); });
  $("bs-entrada").addEventListener("click", abrirBuscar);
  window.FinBuscar = function (q, t) { return buscarMovs(q, t || "todo").length; };

