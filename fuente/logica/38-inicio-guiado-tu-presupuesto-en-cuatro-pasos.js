  // ===================== Inicio guiado: tu presupuesto en cuatro pasos =====================
  // Quien llega ve un ejemplo. En tres preguntas (cuánto entra, cuánto es fijo y si quiere que los pagos se anoten
  // solos) se arma su presupuesto con la regla 50/30/20, ajustada si lo fijo pesa más de la mitad, y se le muestra
  // cuánto puede gastar hoy en gustos sin descuadrarse.
  var INICIO_KEY = "fintelligente-inicio", inicioRes = null;
  function inicioVisto() { try { return localStorage.getItem(INICIO_KEY) || ""; } catch (e) { return "hecho"; } }
  function marcarInicio(v) { try { localStorage.setItem(INICIO_KEY, v); } catch (e) {} }
  function pintarNudgeInicio() { /* el aviso de ejemplo (example-notice) ya ofrece "Armar mi presupuesto" mientras haya datos de ejemplo */ }
  function quizaInicioGuiado() {
    if (!loaded || !state.ejemplo || inicioVisto()) return;
    if (!$("dlg-bienvenida").hidden || ACCION_INICIAL || /^#(importar|entrar|mudanza|accion|regalo)/.test(location.hash)) return;
    if (document.querySelector(".dlg-backdrop:not([hidden])") || ($("dlg-mudanza") && !$("dlg-mudanza").hidden) || ($("dlg-acepto") && !$("dlg-acepto").hidden)) return;
    abrirInicio();
  }
  function abrirInicio() {
    var ua = navigator.userAgent, android = /android/i.test(ua), ios = /iphone|ipad|ipod/i.test(ua);
    $("inicio-auto-si").textContent = android ? "La app de Android anota cada pago de Nequi, Bancolombia, Daviplata, Bre-B y más, segundos después de hacerlo."
      : ios ? "En iPhone, con un atajo que manda tus pagos con Apple Pay y los mensajes del banco." : "Desde tu celular: te mostramos un código para conectarlo.";
    $("inicio-msg").textContent = "";
    $("inicio-omitir").textContent = state.ejemplo ? "Saltar" : "Cerrar";
    $("inicio-t").textContent = state.ejemplo ? "¿Cuánto te llega al mes?" : "Rehagamos tu mes. ¿Cuánto te llega?";
    inicioPerfil = state.prefs.perfil || "personal";
    inicioMetas = (state.prefs.metasInicio && state.prefs.metasInicio.length ? state.prefs.metasInicio : [state.prefs.enfoque || "orden"]).slice();
    pintarMetasInicio();
    [].forEach.call($("inicio-perfil").querySelectorAll("[data-perfil]"), function (x) { x.setAttribute("aria-checked", x.dataset.perfil === inicioPerfil ? "true" : "false"); });
    // La primera vez saluda; al rehacer el presupuesto va directo a la pregunta
    inicioSaluda = state.ejemplo && !inicioVisto();
    var desde = inicioSaluda ? 0 : 1;
    pasoActual = desde; pasoInicio(desde);
    openDlg("dlg-inicio", desde ? "#inicio-ingreso" : "#inicio-empecemos");
  }
  var pasoActual = 1, inicioSaluda = false;
  function pasoInicio(n) {
    var dir = n >= pasoActual ? "va" : "vuelve"; pasoActual = n;
    [].forEach.call(document.querySelectorAll("#dlg-inicio .inicio-sec"), function (sec) { sec.hidden = +sec.dataset.paso !== n; sec.classList.remove("va", "vuelve"); if (!sec.hidden) { void sec.offsetWidth; sec.classList.add(dir); } });
    $("inicio-paso").textContent = n === 0 ? "Bienvenida" : n < 5 ? "Paso " + n + " de 4" : "Tu presupuesto";
    [].forEach.call(document.querySelectorAll("#dlg-inicio .inicio-puntos i"), function (i, k) { i.className = k < n ? "on" : k === n ? "on ahora" : ""; });
    $("inicio-atras").hidden = !(n >= 2 && n <= 4) && !(n === 1 && inicioSaluda);
    $("dlg-inicio").dataset.paso = n;
    var foco = { 0: "#inicio-empecemos", 1: "#inicio-ingreso", 2: '#inicio-metas [aria-checked="true"]', 3: "#inicio-vivienda", 4: 'input[name="inicio-auto"]:checked', 5: "#inicio-empezar" }[n];
    setTimeout(function () { var el = document.querySelector("#dlg-inicio " + foco); if (el) el.focus(); }, 60);
  }
  ["inicio-ingreso", "inicio-vivienda", "inicio-servicios", "inicio-deudas"].forEach(function (id) {
    $(id).addEventListener("input", function () { var m = parseMonto(this.value); this.value = m ? "$ " + fmtMiles(m) : ""; });
    $(id).addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); (id === "inicio-ingreso" ? $("inicio-sig1") : $("inicio-sig2")).click(); } });
  });
  function pintarRapidos() { var v = parseMonto($("inicio-ingreso").value); [].forEach.call($("inicio-rapidos").querySelectorAll("[data-v]"), function (b) { b.setAttribute("aria-pressed", String(+b.dataset.v === v)); }); }
  $("inicio-rapidos").addEventListener("click", function (e) { var b = e.target.closest("[data-v]"); if (!b) return; $("inicio-ingreso").value = "$ " + fmtMiles(+b.dataset.v); $("inicio-msg").textContent = ""; pintarRapidos(); });
  $("inicio-ingreso").addEventListener("input", pintarRapidos);
  // − y +: de a $ 100.000, como en el prototipo
  [].forEach.call(document.querySelectorAll("#dlg-inicio [data-paso-monto]"), function (b) {
    b.addEventListener("click", function () { var v = Math.max(0, parseMonto($("inicio-ingreso").value) + +b.dataset.pasoMonto); $("inicio-ingreso").value = v ? "$ " + fmtMiles(v) : ""; $("inicio-msg").textContent = ""; pintarRapidos(); sonar("nota", 2); });
  });
  $("inicio-empecemos").addEventListener("click", function () { pasoInicio(1); });
  $("inicio-atras").addEventListener("click", function () { pasoInicio(Math.max(inicioSaluda ? 0 : 1, pasoActual - 1)); });
  $("inicio-sig1").addEventListener("click", function () {
    var i = parseMonto($("inicio-ingreso").value);
    if (i < 50000) { $("inicio-msg").textContent = "Escribe cuánto te llega en un mes, por ejemplo $ 2.000.000."; $("inicio-msg").className = "msg center err"; $("inicio-ingreso").focus(); return; }
    pasoInicio(2);
  });
  // Lo que la persona quiere lograr (puede elegir varias) acomoda el nombre de su ahorro
  var inicioMetas = ["orden"], METAS_ORDEN = ["viaje", "fondo", "compra", "deudas", "orden"];
  var META_NOMBRE = { viaje: "Ahorro para mi viaje", fondo: "Fondo de emergencia", compra: "Ahorro para mi compra" };
  function pintarMetasInicio() { [].forEach.call($("inicio-metas").querySelectorAll("[data-meta]"), function (x) { x.setAttribute("aria-checked", inicioMetas.indexOf(x.dataset.meta) > -1 ? "true" : "false"); }); }
  $("inicio-metas").addEventListener("click", function (e) {
    var b = e.target.closest("[data-meta]"); if (!b) return;
    var m = b.dataset.meta, k = inicioMetas.indexOf(m);
    if (k > -1) inicioMetas.splice(k, 1); else inicioMetas.push(m);
    if (!inicioMetas.length) inicioMetas = ["orden"];
    inicioMetas.sort(function (a, c) { return METAS_ORDEN.indexOf(a) - METAS_ORDEN.indexOf(c); });
    pintarMetasInicio(); sonar("gota");
  });
  $("inicio-sig-meta").addEventListener("click", function () { pasoInicio(3); });
  $("inicio-sig2").addEventListener("click", function () { pasoInicio(4); });
  onCloseHooks["dlg-inicio"] = function () {
    if (!inicioVisto()) { marcarInicio("omitido"); metrica("inicio_omitido", "una"); }
    pintarNudgeInicio();
    setTimeout(function () { try { checkLogros(); } catch (e) {} }, 400);
  };
  $("nudge-inicio-si").addEventListener("click", abrirInicio);

  // La regla: 50 % necesidades, 30 % gustos y 20 % ahorro. Si lo fijo pesa más, se protege un mínimo para mercado y
  // transporte (15 % de lo que entra) y lo que sobra se reparte 60/40 entre gustos y ahorro.
  // Plantillas: cómo se reparten lo necesario variable y los gustos según la situación de la persona.
  var PLANTILLAS = {
    personal: { nec: [["Mercado", "alimentacion", .55], ["Transporte", "transporte", .3], ["Salud", "salud", .15]], gus: [["Salidas y restaurantes", "ocio", .5], ["Compras y cuidado personal", "compras", .3], ["Suscripciones y apps", "suscripciones", .2]], aho: "Ahorro" },
    estudiante: { nec: [["Almuerzos y mercado", "alimentacion", .5], ["Transporte", "transporte", .35], ["Fotocopias y materiales", "educacion", .15]], gus: [["Salidas con amigos", "ocio", .6], ["Suscripciones y apps", "suscripciones", .2], ["Ropa y cuidado personal", "compras", .2]], aho: "Ahorro" },
    pareja: { nec: [["Mercado de la casa", "alimentacion", .6], ["Transporte", "transporte", .25], ["Salud", "salud", .15]], gus: [["Planes en pareja", "ocio", .5], ["Compras y cuidado personal", "compras", .25], ["Suscripciones y apps", "suscripciones", .25]], aho: "Ahorro para metas juntos" },
    familia: { nec: [["Mercado", "alimentacion", .45], ["Colegio, útiles y pensión", "educacion", .25], ["Transporte", "transporte", .2], ["Salud y medicamentos", "salud", .1]], gus: [["Planes en familia", "ocio", .5], ["Ropa y zapatos", "compras", .3], ["Suscripciones y apps", "suscripciones", .2]], aho: "Ahorro e imprevistos" },
    independiente: { nec: [["Mercado", "alimentacion", .45], ["Seguridad social (salud y pensión)", "salud", .3], ["Transporte", "transporte", .25]], gus: [["Salidas y restaurantes", "ocio", .5], ["Compras y cuidado personal", "compras", .3], ["Suscripciones y apps", "suscripciones", .2]], aho: "Colchón para meses flojos" },
    negocio: { nec: [["Mercado", "alimentacion", .45], ["Seguridad social (salud y pensión)", "salud", .3], ["Transporte", "transporte", .25]], gus: [["Salidas y restaurantes", "ocio", .5], ["Compras y cuidado personal", "compras", .3], ["Suscripciones y apps", "suscripciones", .2]], aho: "Colchón y ahorro" }
  };
  var inicioPerfil = "personal";
  $("inicio-perfil").addEventListener("click", function (e) {
    var b = e.target.closest("[data-perfil]"); if (!b) return;
    inicioPerfil = b.dataset.perfil;
    [].forEach.call(this.querySelectorAll("[data-perfil]"), function (x) { x.setAttribute("aria-checked", x === b ? "true" : "false"); });
  });
  function repartoInicio(I, viv, serv, deu, perfil, metas) {
    var P = PLANTILLAS[perfil] || PLANTILLAS.personal;
    metas = Array.isArray(metas) ? metas : [metas || "orden"];
    var ahorrar = metas.filter(function (m) { return META_NOMBRE[m]; }), meta = metas[0] || "orden";
    var nombreAho = ahorrar.length === 1 ? META_NOMBRE[ahorrar[0]] : ahorrar.length > 1 ? "Ahorro para mis metas" : P.aho;
    var R = function (v) { return Math.max(0, Math.round(v / 1000) * 1000); };
    var F = viv + serv + deu, N = I * 0.5, varNec = Math.max(N - F, I * 0.15), nec = F + varNec, G, A, caso = "normal";
    if (nec <= N + 1) { G = I * 0.3; A = I * 0.2; }
    else if (nec < I) { caso = "ajustado"; G = (I - nec) * 0.6; A = (I - nec) * 0.4; }
    else { caso = "justo"; G = 0; A = 0; }
    var lista = P.nec.map(function (x) { return { concepto: x[0], cat: x[1], plan: R(varNec * x[2]), g: "nec" }; })
      .concat(P.gus.map(function (x) { return { concepto: x[0], cat: x[1], plan: R(G * x[2]), g: "gus" }; }))
      .concat([{ concepto: nombreAho, cat: "ahorro", plan: R(A), g: "aho" }]);
    // Redondear cada fila a $ 1.000 puede descuadrar el total por unos pesos: la diferencia va a la fila más grande,
    // para que el plan sume exactamente lo que entra (antes salía $ 2.501.000 con $ 2.500.000 de ingreso).
    if (caso !== "justo") {
      var totPlan = R(viv) + R(serv) + R(deu) + lista.reduce(function (a, x) { return a + x.plan; }, 0), dif = Math.round(I) - totPlan;
      var porPlan = function (a, b) { return b.plan - a.plan; };
      var mayor = lista.filter(function (x) { return x.g === "nec"; }).sort(porPlan)[0] || lista.filter(function (x) { return x.g !== "aho"; }).sort(porPlan)[0];
      if (dif && mayor && Math.abs(dif) <= 10000 && mayor.plan + dif > 0) mayor.plan += dif;
    }
    var suma = function (g) { return lista.filter(function (x) { return x.g === g; }).reduce(function (a, x) { return a + x.plan; }, 0); };
    return { I: I, viv: R(viv), serv: R(serv), deu: R(deu), lista: lista, meta: meta, metas: metas.slice(), perfil: P === PLANTILLAS[perfil] ? perfil : "personal", nec: R(F) + suma("nec"), gus: suma("gus"), aho: suma("aho"), caso: caso };
  }
  function aplicarInicio(r) {
    var k = keyOf(new Date()), n = 0, id = function (p) { return p + (++n); };
    var gastos = [];
    function g(concepto, cat, plan) { if (plan > 0) gastos.push({ id: id("g"), concepto: concepto, cat: cat, dia: 0, plan: plan, real: 0 }); }
    g("Arriendo o vivienda", "vivienda", r.viv); g("Servicios, internet y celular", "servicios", r.serv); g("Cuotas de deudas", "deudas", r.deu);
    r.lista.forEach(function (x) { g(x.concepto, x.cat, x.plan); });
    var ingresos = [{ id: "i1", concepto: r.perfil === "independiente" || r.perfil === "negocio" ? "Lo que me entra (promedio)" : "Lo que me entra al mes", plan: r.I, real: 0 }];
    if (!state.ejemplo) {
      // Ya hay un presupuesto: solo se cambia la lista de este mes; lo real se conserva por categoría y lo demás no se toca.
      var m = cur(), reales = {}, ingReal = m.ingresos.reduce(function (a, x) { return a + x.real; }, 0);
      m.gastos.forEach(function (x) { reales[x.cat] = (reales[x.cat] || 0) + x.real; });
      gastos.forEach(function (x) { if (reales[x.cat]) { x.real = reales[x.cat]; reales[x.cat] = 0; } });
      Object.keys(reales).forEach(function (c) { if (reales[c] > 0) gastos.push({ id: id("g"), concepto: (catById(c) || { name: "Otros" }).name, cat: c, dia: 0, plan: 0, real: reales[c] }); });
      ingresos[0].real = ingReal;
      m.ingresos = ingresos; m.gastos = gastos; state.prefs.perfil = r.perfil; state.prefs.enfoque = r.meta; state.prefs.metasInicio = r.metas;
      changed(); renderAll(); return;
    }
    var mes = {}; mes[k] = { ingresos: ingresos, gastos: gastos, notas: "" };
    state.prefs.perfil = r.perfil; state.prefs.enfoque = r.meta; state.prefs.metasInicio = r.metas;
    state = sanitize({ titulo: "Mi presupuesto", ejemplo: false, prefs: state.prefs, categorias: state.categorias, meses: mes, mes: k,
      cuentas: [{ id: "a1", nombre: "Cuenta principal", tipo: "banco", saldo: 0, cupo: 0, ini: false }, { id: "a2", nombre: "Efectivo", tipo: "efectivo", saldo: 0, cupo: 0, ini: false }],
      pendientes: state.pendientes, importados: state.importados, reglas: state.reglas, reglasCuenta: state.reglasCuenta, avisos: state.avisos, asesor: state.asesor, movs: state.movs, negocio: state.negocio, invita: state.invita, meDeben: state.meDeben, dudas: state.dudas, noEntendi: state.noEntendi });
    changed(); renderAll();
  }
  $("inicio-armar").addEventListener("click", function () {
    var r = repartoInicio(parseMonto($("inicio-ingreso").value), parseMonto($("inicio-vivienda").value), parseMonto($("inicio-servicios").value), parseMonto($("inicio-deudas").value), inicioPerfil, inicioMetas);
    var conectar = (document.querySelector('input[name="inicio-auto"]:checked') || {}).value === "si";
    aplicarInicio(r); marcarInicio("hecho"); metrica("inicio", "una");
    var mIni = r.metas.filter(function (m) { return META_NOMBRE[m]; })[0];
    if (mIni && !state.metas.some(function (g) { return nrm(g.nombre) === nrm(META_NOMBRE[mIni]); }) && (hasPremium() || !state.metas.length)) {
      state.metas.push({ id: rid("m"), nombre: META_NOMBRE[mIni], objetivo: mIni === "fondo" ? Math.round(r.I * 3 / 100000) * 100000 : 0, ahorrado: 0, fecha: addMonths(nowKey(), mIni === "fondo" ? 12 : 6) });
      changed(); renderMetas();
    }
    inicioRes = { conectar: conectar };
    // La misma cifra que Inicio y Pregúntale: lo del día a día (todo lo que no es fijo ni ahorro), repartido en los días que quedan
    var hoy = new Date(), dias = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate(), quedan = dias - hoy.getDate() + 1, hIni = hoyPuedes(totalsOf(cur()));
    var diario = hIni && hIni.plan ? hIni.puede : r.gus / quedan, mesDia = hIni && hIni.plan ? Math.max(0, hIni.resto) : r.gus;
    $("inicio-hoy").textContent = money(0); $("inicio-hoy").dataset.v = "0";
    setTimeout(function () { animateNumber($("inicio-hoy"), Math.max(0, redondeoMil(diario)), money); }, 450);
    $("inicio-hoy-n").textContent = mesDia ? "Son " + money(mesDia) + " para el día a día este mes (mercado, transporte, salidas y lo demás), repartidos en los " + plural(quedan, "día") + " que quedan." : "Este mes, lo fijo usa casi todo lo que entra.";
    var subAho = (r.metas.filter(function (m) { return META_NOMBRE[m]; }).length > 1 ? "Para tus metas: lo apartas apenas te pagan" : "") ||
      { viaje: "Para tu viaje: lo apartas apenas te pagan", fondo: "Tu fondo de emergencia crece cada mes", compra: "Para esa compra, sin pedir prestado", deudas: "Y con esto abonas de más a tus deudas" }[r.meta] ||
      (r.perfil === "independiente" || r.perfil === "negocio" ? "Tu colchón para los meses flojos" : "Lo apartas apenas te pagan");
    var filas = [["Necesidades", r.nec, "Vivienda, servicios, deudas, mercado, transporte y salud", "#7c5cff"], ["Gustos", r.gus, "Salidas, compras y suscripciones", "#ff5c9a"], ["Ahorro", r.aho, subAho, "#ffc53d"]];
    $("inicio-reparto").innerHTML = filas.map(function (f) {
      var pc = r.I ? Math.round(f[1] / r.I * 100) : 0;
      return '<div class="inicio-fila" style="--c:' + f[3] + '"><div><b><i class="pt" aria-hidden="true"></i>' + f[0] + "</b><small>" + f[2] + '</small></div><span class="inicio-barra" aria-hidden="true"><i data-w="' + Math.min(100, pc) + '" style="width:0"></i></span><span class="inicio-v">' + money(f[1]) + "<small>" + pc + " %</small></span></div>";
    }).join("");
    // El anillo se dibuja tramo por tramo y las barras crecen (si la persona no pidió menos movimiento)
    var C = 2 * Math.PI * 48, off = 0, svg = '<circle cx="60" cy="60" r="48" fill="none" stroke="var(--line)" stroke-width="14" opacity=".5"/>';
    filas.forEach(function (f, k) {
      var len = r.I ? Math.max(0, f[1] / r.I) * C : 0, dib = Math.max(0, len - 3);
      svg += '<circle class="ia-seg" cx="60" cy="60" r="48" fill="none" stroke="' + f[3] + '" stroke-width="14" stroke-linecap="butt" transform="rotate(-90 60 60)" stroke-dashoffset="' + (-off).toFixed(2) +
        '" stroke-dasharray="' + (reduceMotion ? dib.toFixed(2) : "0") + " " + C.toFixed(2) + '" data-dib="' + dib.toFixed(2) + '" style="transition-delay:' + (0.15 + k * 0.35) + 's"/>';
      off += len;
    });
    $("inicio-anillo").innerHTML = svg;
    $("inicio-total").textContent = money(r.I);
    setTimeout(function () {
      [].forEach.call($("inicio-anillo").querySelectorAll(".ia-seg"), function (c) { c.setAttribute("stroke-dasharray", c.dataset.dib + " " + C.toFixed(2)); });
      [].forEach.call($("inicio-reparto").querySelectorAll("[data-w]"), function (i) { i.style.width = i.dataset.w + "%"; });
    }, 60);
    setTimeout(function () { celebrar(); }, reduceMotion ? 0 : 1300);
    $("inicio-nota").textContent = r.caso === "ajustado" ? "Lo fijo pesa más de la mitad de lo que entra, así que ajustamos gustos y ahorro para que el mes cuadre. El asesor te irá mostrando cómo liberar espacio."
      : r.caso === "justo" ? "Lo fijo se lleva casi todo lo que entra. Revisa las cifras; si son así, el asesor te ayuda a encontrar espacio poco a poco."
      : "Es la regla 50/30/20: la mitad para lo necesario, un 30 % para disfrutar y un 20 % para tu ahorro. Puedes cambiar cualquier cifra cuando quieras.";
    $("inicio-empezar").textContent = conectar ? "Conectar mi banco" : "Ver mi Finti";
    pasoInicio(5);
  });
  $("btn-plantilla-menu").addEventListener("click", function () { $("menu-mas").hidden = true; abrirInicio(); });
  $("inicio-empezar").addEventListener("click", function () {
    closeDlg("dlg-inicio");
    if (inicioRes && inicioRes.conectar) setTimeout(abrirFuentes, 250);
    else setTimeout(function () { toast("¿Quieres conocer la app? Hay guías cortas de menos de un minuto.", { action: "Ver guías", onAction: abrirGuias }); }, 900);
  });
  new MutationObserver(function () { if ($("dlg-bienvenida").hidden) setTimeout(quizaInicioGuiado, 500); }).observe($("dlg-bienvenida"), { attributes: true, attributeFilter: ["hidden"] });

