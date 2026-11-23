  // ===================== Informe del mes (PDF) =====================
  // Arma una página de informe con el resumen del mes y abre el diálogo de impresión del navegador, donde se elige
  // "Guardar como PDF". Todo se hace en el dispositivo.
  function armarInforme() {
    var m = cur(), t = totalsOf(m), p = puntaje(t), k = state.mes, hoy = new Date();
    var filaCat = Object.keys(t.byCat).filter(function (id) { return t.byCat[id].plan || t.byCat[id].real; }).sort(function (a, b) { return t.byCat[b].real - t.byCat[a].real; });
    var kp = addMonths(k, -1), tp = state.meses[kp] ? totalsOf(state.meses[kp]) : null;
    var movsMes = state.movs.filter(function (x) { return x.t === "g" && x.f.slice(0, 7) === k; }), porCom = {};
    movsMes.forEach(function (x) { var c = x.c || "Otros"; porCom[c] = (porCom[c] || 0) + x.m; });
    var topCom = Object.keys(porCom).sort(function (a, b) { return porCom[b] - porCom[a]; }).slice(0, 8);
    var notas = leerNotas(m.notas), dif = function (a, b) { return b ? (a >= b ? "+" : "−") + prPct(Math.abs(a / b - 1)) : ""; };
    var logo = '<svg class="inf-logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#2e5bff"/><path d="M10 23V9h11M10 16h8" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="23" cy="21" r="2.6" fill="#ffc53d"/></svg>';
    var h = '<header class="inf-cab"><div class="inf-id">' + logo + '<div><b class="inf-marca">Finti</b><span>' + esc(state.titulo || "Mi presupuesto") + "</span></div></div><div class=\"inf-mes\"><b>" + esc(monthLabel(k)) + "</b><span>Generado el " + fechaLarga(hoy) + " de " + hoy.getFullYear() + "</span></div></header>";
    h += '<section class="inf-cifras"><div><span>Ingresos</span><b>' + money(t.ingReal) + "</b><small>de " + money(t.ingPlan) + " planeados</small></div>" +
      "<div><span>Gastos</span><b>" + money(t.gasReal) + "</b><small>de " + money(t.gasPlan) + " planeados</small></div>" +
      "<div><span>Saldo</span><b>" + money(t.saldo) + "</b><small>" + (tp ? dif(t.gasReal, tp.gasReal) + " en gastos frente a " + esc(monthLabel(kp).toLowerCase()) : "&nbsp;") + "</small></div>" +
      "<div><span>Ahorro</span><b>" + (t.ingReal ? prPct(t.ahorro / t.ingReal) : "0 %") + "</b><small>" + money(t.ahorro) + "</small></div>" +
      "<div><span>Salud financiera</span><b>" + p.score + " de 100</b><small>" + esc(p.label) + "</small></div></section>";
    // Lo mejor del mes (lo mismo que cuenta Tu mes contado)
    var RM = resumenPeriodo([k]), mejores = [];
    if (RM.estrella) mejores.push("Tu categoría estrella fue <b>" + esc(cap(prCatNombre(RM.estrella.id))) + "</b>: " + (RM.estrella.real < RM.estrella.plan ? "gastaste " + prPct(1 - RM.estrella.real / RM.estrella.plan) + " menos de lo planeado." : "cerraste justo en lo planeado."));
    if (RM.dentroN && RM.conPlan) mejores.push(RM.dentroN + " de " + RM.conPlan + " categorías con plan quedaron dentro de él.");
    if (RM.dias) mejores.push("Anotaste algo " + RM.dias + (RM.dias === 1 ? " día" : " días") + (RM.racha > 1 ? ", con una racha de " + RM.racha + " días seguidos." : "."));
    if (mejores.length) h += '<section class="inf-mejor"><h2>Lo mejor del mes</h2><ul>' + mejores.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></section>";
    // Gráfica: real frente a lo planeado por categoría (barra = real, marca = plan)
    var maxC = Math.max.apply(null, filaCat.map(function (id) { return Math.max(t.byCat[id].plan, t.byCat[id].real); }).concat([1]));
    var barras = filaCat.slice(0, 10).map(function (id, i) {
      var c = t.byCat[id], y = i * 26, w = c.real / maxC * 300, pl = c.plan / maxC * 300, pas = c.plan && c.real > c.plan;
      return '<text x="0" y="' + (y + 15) + '" class="ig-n">' + esc(cap(prCatNombre(id))) + '</text><rect x="150" y="' + (y + 5) + '" width="300" height="14" rx="4" class="ig-fondo"/>' +
        '<rect x="150" y="' + (y + 5) + '" width="' + Math.max(3, w).toFixed(1) + '" height="14" rx="4" fill="' + catColor(id) + '"/>' +
        (c.plan ? '<rect x="' + (150 + pl - 1).toFixed(1) + '" y="' + (y + 2) + '" width="2.5" height="20" rx="1" class="ig-plan"/>' : "") +
        '<text x="460" y="' + (y + 15) + '" class="ig-v' + (pas ? " ig-pasa" : "") + '">' + money(c.real) + "</text>";
    }).join("");
    if (filaCat.length) h += '<h2>¿En qué se fue la plata?</h2><svg class="inf-graf" viewBox="0 0 560 ' + (Math.min(10, filaCat.length) * 26 + 4) + '" role="img" aria-label="Gasto real por categoría frente a lo planeado">' + barras + '</svg><p class="inf-ley"><i class="il-real"></i>Gasto real <i class="il-plan"></i>Lo planeado</p>';
    // Ahorro de los últimos meses
    var ult = monthKeys().filter(function (x) { return x <= k; }).slice(-6);
    if (ult.length > 1) {
      var tas = ult.map(function (x) { var tt = totalsOf(state.meses[x]); return tt.ingReal > 0 ? Math.max(0, tt.ahorro / tt.ingReal) : 0; }), mx = Math.max(0.25, Math.max.apply(null, tas));
      h += '<h2>Tu ahorro, mes a mes</h2><svg class="inf-graf" viewBox="0 0 560 120" role="img" aria-label="Porcentaje de ahorro de los últimos meses">' +
        '<line x1="0" x2="560" y1="' + (96 - 0.2 / mx * 80).toFixed(1) + '" y2="' + (96 - 0.2 / mx * 80).toFixed(1) + '" class="ig-meta"/><text x="556" y="' + (92 - 0.2 / mx * 80).toFixed(1) + '" text-anchor="end" class="ig-n">Meta 20 %</text>' +
        tas.map(function (v, i) { var x = 20 + i * (520 / ult.length), w = 520 / ult.length - 24, hh = Math.max(2, v / mx * 80);
          return '<rect x="' + x.toFixed(1) + '" y="' + (96 - hh).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hh.toFixed(1) + '" rx="4" fill="' + (ult[i] === k ? "#2e5bff" : "#b9c8ff") + '"/>' +
            '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (90 - hh).toFixed(1) + '" text-anchor="middle" class="ig-v">' + prPct(v) + '</text><text x="' + (x + w / 2).toFixed(1) + '" y="114" text-anchor="middle" class="ig-n">' + esc(cap(MESES[parseKey(ult[i]).m - 1].slice(0, 3))) + "</text>"; }).join("") + "</svg>";
    }
    h += '<h2>Gastos por categoría</h2><table class="inf-tabla"><thead><tr><th>Categoría</th><th>Planeado</th><th>Real</th><th>Ejecución</th></tr></thead><tbody>' +
      filaCat.map(function (id) { var c = t.byCat[id]; return "<tr><td>" + esc(cap(prCatNombre(id))) + "</td><td>" + money(c.plan) + "</td><td>" + money(c.real) + "</td><td>" + (c.plan ? prPct(c.real / c.plan) : "–") + "</td></tr>"; }).join("") +
      "</tbody><tfoot><tr><td>Total</td><td>" + money(t.gasPlan) + "</td><td>" + money(t.gasReal) + "</td><td>" + (t.gasPlan ? prPct(t.gasReal / t.gasPlan) : "–") + "</td></tr></tfoot></table>";
    h += '<h2>Ingresos</h2><table class="inf-tabla"><thead><tr><th>Concepto</th><th>Planeado</th><th>Real</th></tr></thead><tbody>' +
      m.ingresos.map(function (r) { return "<tr><td>" + esc(r.concepto) + "</td><td>" + money(r.plan) + "</td><td>" + money(r.real) + "</td></tr>"; }).join("") + "</tbody></table>";
    if (topCom.length) h += '<h2>¿Dónde más gastaste?</h2><table class="inf-tabla"><thead><tr><th>Comercio</th><th>Total</th></tr></thead><tbody>' + topCom.map(function (c) { return "<tr><td>" + esc(c) + "</td><td>" + money(porCom[c]) + "</td></tr>"; }).join("") + "</tbody></table>";
    if (state.metas.length) h += '<h2>Metas de ahorro</h2><table class="inf-tabla"><thead><tr><th>Meta</th><th>Ahorrado</th><th>Objetivo</th><th>Avance</th></tr></thead><tbody>' + state.metas.map(function (g) { return "<tr><td>" + esc(g.nombre) + "</td><td>" + money(g.ahorrado) + "</td><td>" + money(g.objetivo) + "</td><td>" + (g.objetivo ? prPct(g.ahorrado / g.objetivo) : "–") + "</td></tr>"; }).join("") + "</tbody></table>";
    if (state.deudas.length) h += '<h2>Deudas</h2><table class="inf-tabla"><thead><tr><th>Deuda</th><th>Saldo</th><th>Tasa E. A.</th><th>Cuota</th></tr></thead><tbody>' + state.deudas.map(function (d) { return "<tr><td>" + esc(d.nombre) + "</td><td>" + money(d.saldo) + "</td><td>" + String(d.tasa).replace(".", ",") + " %</td><td>" + money(d.cuota) + "</td></tr>"; }).join("") + "</tbody></table>";
    if (p.tips.length) h += "<h2>Para el próximo mes</h2><ul>" + p.tips.map(function (x) { return "<li>" + x.txt + "</li>"; }).join("") + "</ul>";
    if (notas.length) h += "<h2>Notas</h2><ul>" + notas.map(function (x) { return "<li><b>" + esc(TIPOS_NOTA[x.tipo].n) + ":</b> " + esc(x.texto) + "</li>"; }).join("") + "</ul>";
    h += '<footer class="inf-pie">Montos en pesos colombianos. Informe generado en tu dispositivo con Finti.</footer>';
    $("informe").innerHTML = h;
  }
  function imprimirInforme() {
    $("menu-mas").hidden = true;
    armarInforme();
    var titulo = document.title;
    document.title = "Finti - " + monthLabel(state.mes);
    document.body.classList.add("imprimiendo");
    var fin = function () { document.body.classList.remove("imprimiendo"); document.title = titulo; window.removeEventListener("afterprint", fin); };
    window.addEventListener("afterprint", fin);
    metrica("informe", "dia");
    setTimeout(function () { try { window.print(); } catch (e) {} }, 60);
  }
  $("btn-informe").addEventListener("click", imprimirInforme);

  wireTable("tb-ing", "ingresos");
  wireTable("tb-gas", "gastos");
  document.body.classList.add("loading");
  renderAll();
  irA((location.hash || "").slice(1), true);
  setTimeout(function () { metrica("abrir", "dia"); try { if (APP_ANDROID.lectura) metrica("conecto", "una"); } catch (e) {} }, 1500);
  setTimeout(quizaInicioGuiado, 1200);

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden" && saveTimer && mode === "cloud") { clearTimeout(saveTimer); flush(); }
  });

  var FREE_NOTE = "Versión gratis. Montos en pesos colombianos (COP). Tus cifras se guardan solo en este navegador y en este dispositivo: nadie más las ve. Con Premium se guardan en tu cuenta de Claude.";
  function loadConfig(db) {
    db.doc("config/premium").get().then(function (snap) {
      var d = snap.exists ? snap.data() : null;
      if (d) config = { mensaje: String(d.mensaje || "").slice(0, 300), link: safeLink(d.link), precio: String(d.precio || "").slice(0, 40) };
      if (!$("dlg-premium").hidden) renderPremium();
    }, function () {});
  }
  // Configuración incluida en el archivo (para la versión que se publica fuera de Claude)
  try {
    var ec = document.getElementById("app-config");
    if (ec) { var cj = JSON.parse(ec.textContent); config = { mensaje: String(cj.mensaje || "").slice(0, 300), link: safeLink(cj.link), precio: String(cj.precio || "").slice(0, 40) }; }
  } catch (e) {}
  if (FREE) {
    try {
      refCode = localStorage.getItem("presupuesto-referencia") || "";
      if (!/^[A-Z0-9]{6}$/.test(refCode)) {
        var rr = new Uint32Array(6); crypto.getRandomValues(rr);
        refCode = Array.prototype.map.call(rr, function (x) { return CODE_ALPHABET[x % CODE_ALPHABET.length]; }).join("");
        localStorage.setItem("presupuesto-referencia", refCode);
      }
    } catch (e) { refCode = ""; }
  }
  var SIN_CUENTA = "Montos en pesos colombianos (COP). Inicia sesión en Claude para guardar tu presupuesto en tu cuenta; por ahora se guarda en este navegador.";
  if (WEB) {
    precargarLocal().then(function () {
      startLocal("Montos en pesos colombianos (COP). Tus cifras se guardan solo en este dispositivo y nadie más las ve. Haz un respaldo de vez en cuando con Exportar respaldo.");
      webInit();
    });
  } else if (FREE) {
    startLocal(FREE_NOTE);
    if (claudeApi && typeof claudeApi.use === "function") {
      Promise.all([claudeApi.use("db"), claudeApi.use("user")]).then(function (res) {
        var db = res[0], user = res[1];
        try { isOwnerFlag = !!(user && user.isOwner && user.isOwner()); } catch (e) { isOwnerFlag = false; }
        if (db) { dbApi = db; loadConfig(db); }
      }, function () {});
    }
  } else if (!claudeApi || typeof claudeApi.use !== "function") {
    startLocal("Montos en pesos colombianos (COP). Abre esta página desde Claude con tu cuenta para guardar tu presupuesto en ella; por ahora se guarda en este navegador.");
  } else {
    Promise.all([claudeApi.use("db"), claudeApi.use("user")]).then(function (res) {
      var db = res[0], user = res[1];
      if (!db || !user) { startLocal(SIN_CUENTA); return; }
      return Promise.resolve(user.id()).then(function (uid) {
        if (!uid) { startLocal(SIN_CUENTA); return; }
        dbApi = db; viewerId = uid;
        try { isOwnerFlag = !!(user.isOwner && user.isOwner()); } catch (e) { isOwnerFlag = false; }
        sha256("ref:" + uid).then(function (h) { refCode = h.slice(0, 6).toUpperCase(); if (!$("dlg-premium").hidden) renderPremium(); }, function () {});
        db.doc("config/premium").get().then(function (snap) {
          var d = snap.exists ? snap.data() : null;
          if (d) config = { mensaje: String(d.mensaje || "").slice(0, 300), link: safeLink(d.link), precio: String(d.precio || "").slice(0, 40) };
          if (!$("dlg-premium").hidden) renderPremium();
        }, function () {});
        startCloud(db, uid, user);
      });
    }).catch(function () {
      startLocal("Montos en pesos colombianos (COP). No se pudo abrir tu espacio privado ahora; tus cambios se guardan en este navegador.");
    });
  }
})();
