  // ===================== Mi negocio =====================
  // Cuentas del negocio aparte de las personales: ventas, gastos del negocio y la ganancia del mes. De la ganancia
  // sale un sueldo fijo que pasa al presupuesto personal como ingreso; así no se mezcla la plata del negocio con la tuya.
  var NEG_CATS = [["mercancia", "Mercancía e insumos"], ["local", "Arriendo del local"], ["servicios", "Servicios e internet"], ["empleados", "Empleados y ayudantes"],
    ["domicilios", "Transporte y domicilios"], ["publicidad", "Publicidad y redes"], ["impuestos", "Impuestos y trámites"], ["otros", "Otros del negocio"]];
  var NEG_NOMBRE = {}; NEG_CATS.forEach(function (c) { NEG_NOMBRE[c[0]] = c[1]; });
  var negTipo = "v";
  function negDelMes(k) { return state.negocio.movs.filter(function (x) { return x.f.slice(0, 7) === k; }); }
  function negResumen(k) {
    var l = negDelMes(k), v = 0, g = 0, porCat = {};
    l.forEach(function (x) { if (x.t === "v") v += x.m; else { g += x.m; porCat[x.cat] = (porCat[x.cat] || 0) + x.m; } });
    return { ventas: v, gastos: g, ganancia: v - g, n: l.length, porCat: porCat, lista: l };
  }
  function mesAnterior(k) { var o = parseKey(k), d = new Date(o.y, o.m - 2, 1); return keyOf(d); }
  function pintarNegocio() {
    var k = state.mes, r = negResumen(k), ant = negResumen(mesAnterior(k));
    $("neg-mes").textContent = nombreMes(parseKey(k));
    $("neg-ventas").textContent = money(r.ventas); $("neg-gastos").textContent = money(r.gastos);
    $("neg-ganancia").textContent = money(r.ganancia); $("neg-ganancia").classList.toggle("neg-rojo", r.ganancia < 0);
    var comp = "";
    if (ant.n && r.n) { var d = r.ganancia - ant.ganancia; comp = d === 0 ? "Igual que el mes pasado." : (d > 0 ? "Ganaste " + money(d) + " más" : "Ganaste " + money(-d) + " menos") + " que el mes pasado."; }
    else if (r.ganancia < 0) comp = "Este mes los gastos van por encima de las ventas.";
    $("neg-comp").textContent = comp;
    var top = Object.keys(r.porCat).sort(function (a, b) { return r.porCat[b] - r.porCat[a]; }).slice(0, 3);
    $("neg-cats").innerHTML = top.length ? "En lo que más gasta tu negocio: " + top.map(function (c) { return esc(NEG_NOMBRE[c] || "Otros") + " (" + money(r.porCat[c]) + ")"; }).join(", ") + "." : "";
    // Sueldo: el que la persona fijó o, si no, lo que sugiere la ganancia de los meses anteriores.
    var sug = negSugerido(k), s = state.negocio.sueldo || sug;
    if (!$("neg-sueldo").matches(":focus")) $("neg-sueldo").value = s ? "$ " + fmtMiles(s) : "";
    $("neg-sueldo-n").textContent = sug ? "Sugerido: " + money(sug) + ", el promedio de lo que ganó tu negocio en sus meses más flojos." : "Escribe cuánto te vas a pagar cada mes. Lo que quede se queda en el negocio.";
    var ya = cur().ingresos.filter(function (x) { return x.id === "neg-sueldo"; })[0];
    $("neg-pasar").textContent = ya ? "Actualizar mi sueldo en el presupuesto" : "Pasar mi sueldo a mi presupuesto";
    var l = r.lista.slice().sort(function (a, b) { return a.f < b.f ? 1 : a.f > b.f ? -1 : 0; });
    $("neg-lista").innerHTML = l.length ? l.slice(0, 60).map(function (x) {
      return '<li><span class="neg-dot ' + (x.t === "v" ? "v" : "g") + '" aria-hidden="true"></span><div><b>' + esc(x.c || (x.t === "v" ? "Venta" : NEG_NOMBRE[x.cat] || "Gasto")) + "</b><small>" + esc(x.f.slice(8) + " de " + MESES[+x.f.slice(5, 7) - 1]) + (x.t === "g" && x.c ? " · " + esc(NEG_NOMBRE[x.cat] || "Otros") : "") + "</small></div>" +
        '<span class="neg-m">' + (x.t === "v" ? "+" : "−") + money(x.m).replace(/^-/, "") + '</span><button type="button" class="icon-btn" data-borrar="' + esc(x.id) + '" aria-label="Borrar">×</button></li>';
    }).join("") : '<li class="empty">Aún no hay ventas ni gastos del negocio este mes.</li>';
  }
  function negSugerido(k) {
    var vals = [];
    for (var i = 1, kk = k; i <= 6; i++) { kk = mesAnterior(kk); var r = negResumen(kk); if (r.n) vals.push(Math.max(0, r.ganancia)); }
    if (!vals.length) return 0;
    vals.sort(function (a, b) { return a - b; });
    var bajos = vals.slice(0, Math.max(1, Math.ceil(vals.length / 2)));
    return Math.floor(bajos.reduce(function (a, b) { return a + b; }, 0) / bajos.length / 10000) * 10000;
  }
  function negSetTipo(t) {
    negTipo = t;
    [].forEach.call(document.querySelectorAll("#neg-tipo [data-t]"), function (b) { b.setAttribute("aria-pressed", b.dataset.t === t ? "true" : "false"); });
    $("neg-cat-l").hidden = t === "v";
    $("neg-concepto").placeholder = t === "v" ? "Venta de mostrador, pedido de Laura…" : "Compra de mercancía, pago del local…";
  }
  function abrirNegocio() {
    $("menu-mas").hidden = true;
    $("neg-fecha").value = hoyStr(); $("neg-msg").textContent = "";
    negSetTipo("v"); pintarNegocio();
    openDlg("dlg-negocio", "#neg-valor");
  }
  $("neg-cat").innerHTML = NEG_CATS.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + "</option>"; }).join("");
  $("neg-tipo").addEventListener("click", function (e) { var b = e.target.closest("[data-t]"); if (b) negSetTipo(b.dataset.t); });
  ["neg-valor", "neg-sueldo"].forEach(function (id) { $(id).addEventListener("input", function () { var v = parseMonto(this.value); this.value = v ? "$ " + fmtMiles(v) : ""; }); });
  $("neg-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var m = parseMonto($("neg-valor").value), f = $("neg-fecha").value || hoyStr(), msg = $("neg-msg");
    if (!m) { msg.textContent = "Escribe el valor."; msg.className = "msg err"; $("neg-valor").focus(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) f = hoyStr();
    state.negocio.movs.push({ id: rid("n"), f: f, t: negTipo, cat: negTipo === "g" ? $("neg-cat").value : "", c: $("neg-concepto").value.trim().slice(0, 80), m: m });
    if (f.slice(0, 7) !== state.mes) msg.textContent = "Listo. Quedó en " + MESES[+f.slice(5, 7) - 1] + ".";
    else msg.textContent = negTipo === "v" ? "Venta anotada." : "Gasto del negocio anotado.";
    msg.className = "msg ok";
    $("neg-valor").value = ""; $("neg-concepto").value = "";
    changed(); pintarNegocio(); renderTrabajo(); metrica("negocio", "dia");
    $("neg-valor").focus();
  });
  $("neg-lista").addEventListener("click", function (e) {
    var b = e.target.closest("[data-borrar]"); if (!b) return;
    var i = state.negocio.movs.findIndex(function (x) { return x.id === b.dataset.borrar; }); if (i < 0) return;
    var quitado = state.negocio.movs.splice(i, 1)[0];
    changed(); pintarNegocio(); renderTrabajo();
    toast("Se borró.", { action: "Deshacer", onAction: function () { state.negocio.movs.push(quitado); changed(); pintarNegocio(); renderTrabajo(); } });
  });
  $("neg-sueldo").addEventListener("change", function () { state.negocio.sueldo = parseMonto(this.value); changed(); pintarNegocio(); });
  $("neg-pasar").addEventListener("click", function () {
    var s = parseMonto($("neg-sueldo").value), msg = $("neg-msg");
    if (!s) { msg.textContent = "Escribe primero cuánto te vas a pagar."; msg.className = "msg err"; $("neg-sueldo").focus(); return; }
    state.negocio.sueldo = s;
    var m = cur(), ya = m.ingresos.filter(function (x) { return x.id === "neg-sueldo"; })[0];
    if (ya) { ya.plan = s; ya.real = s; } else m.ingresos.push({ id: "neg-sueldo", concepto: "Sueldo de mi negocio", plan: s, real: s });
    changed(); renderAll(); pintarNegocio();
    msg.textContent = "Listo: " + money(s) + " entraron a tu presupuesto de " + MESES[parseKey(state.mes).m - 1] + " como sueldo."; msg.className = "msg ok";
  });
  $("btn-negocio-menu").addEventListener("click", abrirNegocio);

  // Tarjeta en Inicio para quien eligió la plantilla de independiente o de negocio.
  function renderTrabajo() {
    var card = $("trabajo-card"), p = state.prefs.perfil;
    if (state.ejemplo || (p !== "negocio" && p !== "independiente" && !state.negocio.movs.length)) { card.hidden = true; return; }
    card.hidden = false;
    if (p === "independiente" && !state.negocio.movs.length) {
      $("h-trabajo").textContent = "Para independientes";
      $("trabajo-txt").textContent = "Calcula tu sueldo fijo, lo que debes apartar para seguridad social y crea cuentas de cobro.";
      $("trabajo-btn").textContent = "Abrir"; $("trabajo-btn").dataset.abrir = "indep"; return;
    }
    var r = negResumen(state.mes);
    $("h-trabajo").textContent = "Mi negocio en " + MESES[parseKey(state.mes).m - 1];
    $("trabajo-txt").textContent = r.n ? "Vendiste " + money(r.ventas) + " y gastaste " + money(r.gastos) + ": " + (r.ganancia >= 0 ? "ganancia de " + money(r.ganancia) + "." : "vas " + money(-r.ganancia) + " abajo.") : "Anota las ventas y los gastos del negocio aparte de los tuyos y mira cuánto te queda.";
    $("trabajo-btn").textContent = r.n ? "Ver y anotar" : "Empezar"; $("trabajo-btn").dataset.abrir = "negocio";
  }
  // Pregúntale: el negocio y la seguridad social
  PR_R.negocio = function (q) {
    var per = q.per && q.per.k ? q.per.k : state.mes, r = negResumen(per), nom = MESES[parseKey(per).m - 1];
    PR.ctx = { intent: "negocio" };
    if (!state.negocio.movs.length) return { html: "<p>Todavía no has anotado ventas ni gastos de tu negocio. En el menú, <b>Mi negocio</b>, los anotas aparte de tus gastos personales y te digo cuánto ganas.</p>", chips: ["¿Cómo anoto las ventas de mi negocio?"] };
    if (!r.n) return { html: "<p>En " + nom + " no hay movimientos de tu negocio.</p>", chips: [] };
    var h = "<p>En " + nom + " tu negocio vendió <b>" + money(r.ventas) + "</b> y gastó " + money(r.gastos) + ": " + (r.ganancia >= 0 ? "<b>ganancia de " + money(r.ganancia) + "</b>." : "va <b>" + money(-r.ganancia) + " abajo</b>.") + "</p>";
    var sug = negSugerido(per); if (sug) h += "<p>Un sueldo fijo sano para ti sería de " + money(sug) + " al mes.</p>";
    return { html: h, chips: ["¿Cuánto me queda este mes?"] };
  };
  PR_R.seguridad = function (q) {
    var ing = q.monto || calcSueldo().prom || totalsOf(cur()).ingReal || totalsOf(cur()).ingPlan;
    PR.ctx = { intent: "seguridad" };
    if (!ing) return { html: "<p>Dime cuánto te entra al mes, por ejemplo: \"¿cuánto pago de seguridad social si gano $ 3.000.000?\"</p>", chips: [] };
    var c = calcSeguridad(ing, true);
    return { html: "<p>Si te entran " + money(ing) + " al mes como independiente, aparta unos <b>" + money(c.total) + "</b>: salud " + money(c.salud) + ", pensión " + money(c.pension) + (c.fsp ? ", solidaridad " + money(c.fsp) : "") + " y ARL " + money(c.arl) + ".</p><p class=\"pr-nota\">Es un cálculo de referencia sobre el 40 % de tus ingresos. El valor exacto lo da tu planilla PILA.</p>", chips: [] };
  };
  PR_INT.splice(1, 0, ["seguridad", /seguridad social|\bpila\b|cuanto (pago|debo pagar|me toca pagar) de (salud|pension)|cotizar (salud|pension)|aportes? (a|de) (salud|pension)/],
    ["negocio", /\bvend(i|o|imos|ido)\b|ventas|mi negocio|el negocio|ganancia|cuanto gane en el negocio/]);
  PR_COMO.unshift(
    [/cuenta de cobro|cobrarle a un cliente/, "trabajo", "En el menú, <b>Para independientes</b>, pestaña Cuenta de cobro: llenas tus datos y los del cliente y la guardas en PDF."],
    [/seguridad social|\bpila\b|sueldo fijo|ingresos? variables?/, "trabajo", "En el menú, <b>Para independientes</b>: ahí calculas tu sueldo fijo y cuánto apartar para seguridad social."],
    [/negocio|ventas|vender/, "trabajo", "En el menú, <b>Mi negocio</b>: anotas ventas y gastos del negocio aparte de los tuyos, ves la ganancia y te pagas un sueldo."],
    [/invit|referi|recomendar la app|compartir la app|premium gratis/, "", "En el menú, <b>Invita y gana Premium</b>: compartes tu enlace y, por cada persona que compre Premium con él, te damos un código de Premium."],
    [/(rehacer|cambiar|armar de nuevo|plantilla).{0,25}presupuesto|plantilla/, "", "En el menú, <b>Rehacer mi presupuesto</b>: eliges para quién es (estudiante, familia, independiente…) y lo armo de nuevo sin perder lo que ya gastaste."]
  );
  PR_EJ.push("¿Cuánto vendí este mes?", "¿Cuánto pago de seguridad social?");
  $("trabajo-btn").addEventListener("click", function () { if (this.dataset.abrir === "indep") abrirIndep(); else abrirNegocio(); });
  window.FinNegocio = { resumen: negResumen, sugerido: negSugerido };

