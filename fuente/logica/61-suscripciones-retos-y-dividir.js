  // ===================== Suscripciones, retos de ahorro, dividir una cuenta y días de pago =====================
  // Ideas nuevas del 28 de noviembre de 2026. Todo se calcula en el dispositivo con lo que la persona ya anota.

  // ---------- Tus suscripciones ----------
  // Las cuentas por pagar de la categoría Suscripciones (o con nombre de un servicio conocido), cuándo se cobra cada
  // una y cuánto suman al año. También encuentra pagos que se repiten cada mes entre los movimientos y ofrece avisar
  // antes de que cobren (los convierte en cuentas por pagar, que ya tienen avisos).
  var SUBS_CONOCIDAS = ["Netflix", "Spotify", "Disney+", "Max", "Prime Video", "YouTube Premium", "iCloud", "Google One", "Crunchyroll", "Paramount+", "Xbox Game Pass", "PlayStation Plus", "Gimnasio", "Plan del celular"];
  var SUBS_RE = /netflix|spotify|disney|hbo|\bmax\b|prime video|amazon prime|youtube|icloud|apple|google one|crunchyroll|paramount|game pass|playstation|deezer|chatgpt|openai|canva|microsoft 365|office 365|adobe|rappi prime|gimnasio|smart ?fit|bodytech|star\+|vix|win sports|dazn|tidal/;
  function subsNorm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function esSub(b) { return b.f !== "unica" && (b.cat === "suscripciones" || SUBS_RE.test(subsNorm(b.nombre))); }
  function subsProximo(b) {
    var hoy = d0();
    if (b.f === "anual") { var f = parseD(b.fecha); if (!f) return null; while (f < hoy) f.setFullYear(f.getFullYear() + 1); return f; }
    var y = hoy.getFullYear(), m = hoy.getMonth(), d = new Date(y, m, Math.min(b.dia, dim(y, m + 1)));
    if (d < hoy) d = new Date(y, m + 1, Math.min(b.dia, dim(y, m + 2)));
    return d;
  }
  function subsDetectadas() {
    var desde = hoyStr(new Date(Date.now() - 125 * 864e5)), grupos = {}, ya = {};
    state.porPagar.forEach(function (b) { ya[subsNorm(b.nombre)] = 1; });
    state.movs.forEach(function (x) {
      if (x.t !== "g" || !x.f || x.f < desde || x.m < 2000) return;
      var n = subsNorm(x.com || x.c); if (!n || ya[n]) return;
      (grupos[n] = grupos[n] || []).push(x);
    });
    var out = [];
    Object.keys(grupos).forEach(function (n) {
      var xs = grupos[n], meses = {};
      xs.forEach(function (x) { (meses[x.f.slice(0, 7)] = meses[x.f.slice(0, 7)] || []).push(x); });
      var ks = Object.keys(meses).sort(); if (ks.length < 2 || ks.some(function (k) { return meses[k].length > 1; })) return;
      var vals = ks.map(function (k) { return meses[k][0].m; }), medio = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      if (!vals.every(function (v) { return Math.abs(v - medio) <= medio * 0.08; })) return;
      var ult = meses[ks[ks.length - 1]][0];
      out.push({ nombre: (ult.com || ult.c || "").slice(0, 60), monto: Math.round(ult.m), dia: parseD(ult.f).getDate(), cat: ult.cat || "suscripciones", meses: ks.length });
    });
    return out.sort(function (a, b) { return b.monto - a.monto; }).slice(0, 5);
  }
  var subsDet = [];
  function renderSubs() {
    var body = $("subs-body"); if (!body) return;
    var l = state.porPagar.filter(esSub), anual = 0;
    var filas = l.map(function (b) {
      var mes = b.f === "anual" ? b.monto / 12 : b.monto, prox = subsProximo(b), dias = prox ? diasEntre(d0(), prox) : null;
      anual += mes * 12;
      var cuando = !prox ? "Pon la fecha del cobro" : dias === 0 ? "Se cobra hoy" : dias === 1 ? "Se cobra mañana" : "Se cobra el " + fechaLarga(prox) + " (en " + dias + " días)";
      return '<button type="button" class="sub-fila" data-sub="' + esc(b.id) + '" style="--c:' + catColor(b.cat || "suscripciones") + '">' +
        '<span class="sub-ini" aria-hidden="true">' + esc((b.nombre || "?").charAt(0).toUpperCase()) + '</span><span class="sub-txt"><b>' + esc(b.nombre) + "</b><small>" + cuando +
        (b.aviso ? " · te aviso " + plural(b.aviso, "día") + " antes" : "") + '</small></span><span class="sub-m"><b class="cifra">' + money(b.monto) + "</b><small>" + (b.f === "anual" ? "al año" : "al mes") + "</small></span></button>";
    });
    subsDet = subsDetectadas();
    var html = filas.length ? '<div class="sub-lista">' + filas.join("") + "</div>" : '<p class="empty">Aún no tienes suscripciones anotadas. Agrega las que pagas y te aviso antes de cada cobro.</p>';
    if (anual > 0) html += '<p class="sub-anual">Al año suman <b class="cifra">' + money(anual) + "</b>. Si alguna ya no la usas tanto, ahí hay plata para tus metas.</p>";
    if (subsDet.length) html += '<div class="sub-det"><p><b>Encontré pagos que se repiten cada mes</b></p>' + subsDet.map(function (s, i) {
      return '<div class="sub-det-f"><span>' + esc(s.nombre) + " · " + money(s.monto) + ' al mes</span><button class="btn sm" type="button" data-sub-det="' + i + '">Avisarme antes</button></div>';
    }).join("") + "</div>";
    var nombres = l.map(function (b) { return subsNorm(b.nombre); });
    html += '<div class="sub-agregar" role="group" aria-label="Agregar una suscripción"><span>Agregar:</span>' + SUBS_CONOCIDAS.filter(function (n) { return nombres.indexOf(subsNorm(n)) < 0; }).map(function (n) {
      return '<button type="button" class="chip-btn" data-sub-nueva="' + esc(n) + '">' + esc(n) + "</button>";
    }).join("") + '<button type="button" class="chip-btn" data-sub-nueva="">Otra</button></div>';
    body.innerHTML = html;
    $("subs-anual").hidden = !(anual > 0); $("subs-anual").textContent = money(anual) + " al año";
  }
  function subsEditar(b, campo) {
    editPago = b.id; irA("cuentas"); renderPorPagar(); renderPagos();
    var el = $("porpagar-body").querySelector('.bill[data-id="' + b.id + '"] [data-f="' + campo + '"]');
    if (el) { el.scrollIntoView({ block: "center" }); el.focus(); if (el.select) el.select(); }
  }
  document.addEventListener("click", function (e) {
    var n = e.target.closest("[data-sub-nueva]"), d = e.target.closest("[data-sub-det]"), s = e.target.closest("[data-sub]");
    if (n) {
      var b = { id: rid("p"), nombre: n.dataset.subNueva || "Nueva suscripción", monto: 0, f: "mensual", dia: Math.min(new Date().getDate(), 28), fecha: "", cat: "suscripciones", cuenta: "", aviso: 2, creado: hoyStr(), pagos: {} };
      state.porPagar.push(b); changed(); subsEditar(b, n.dataset.subNueva ? "monto" : "nombre"); return;
    }
    if (d) {
      var x = subsDet[+d.dataset.subDet]; if (!x) return;
      state.porPagar.push({ id: rid("p"), nombre: x.nombre, monto: x.monto, f: "mensual", dia: x.dia, fecha: "", cat: catById(x.cat) ? x.cat : "suscripciones", cuenta: "", aviso: 2, creado: hoyStr(), pagos: {} });
      changed(); renderPorPagar(); renderPagos(); toast("Listo: te aviso 2 días antes de que cobren <b>" + esc(x.nombre) + "</b>."); return;
    }
    if (s) { var b2 = state.porPagar.find(function (y) { return y.id === s.dataset.sub; }); if (b2) subsEditar(b2, "monto"); }
  });

  // ---------- Retos de ahorro ----------
  // Retos cortos que la app sigue sola con lo que se anota (o con un toque al día). Se guardan en state.retosMios.
  var RETOS = {
    domicilios: { t: "Semana sin domicilios", d: 7, txt: "7 días sin pedir domicilios. Cocinar en casa rinde más.", modo: "sin", re: /domicilio|rappi|ifood|didi food|uber eats|merqueo|picap/ },
    antojos: { t: "Antojos con tope", d: 7, txt: "Esta semana, máximo $ 30.000 en antojos y salidas.", modo: "tope", tope: 30000, cats: ["ocio", "mecato"], re: /mecato|antojo|helado|postre|dulce|snack|onces|cafe|tinto|cerveza|trago/ },
    guarda: { t: "Guarda $ 5.000 al día", d: 30, txt: "30 días guardando $ 5.000. Al final tienes $ 150.000.", modo: "check", meta: 5000 },
    dias: { t: "4 días sin gastar", d: 14, txt: "En dos semanas, 4 días sin gastar nada.", modo: "dias", meta: 4 }
  };
  function retoFin(r) { var f = parseD(r.ini); f.setDate(f.getDate() + RETOS[r.tipo].d - 1); return f; }
  function retoEstado(r) {
    var R = RETOS[r.tipo], ini = parseD(r.ini), fin = retoFin(r), hoy = d0(), hasta = hoy < fin ? hoy : fin;
    var dentro = function (x) { var f = parseD(x.f); return x.t === "g" && f && f >= ini && f <= fin; };
    var transcurridos = Math.max(0, Math.min(R.d, diasEntre(ini, hasta) + 1)), terminado = hoy > fin, e = { avance: 0, linea: "", logrado: false, roto: false, terminado: terminado };
    if (R.modo === "sin") {
      var malo = state.movs.filter(function (x) { return dentro(x) && R.re.test(subsNorm((x.c || "") + " " + (x.com || ""))); })[0];
      if (malo) { e.roto = true; e.avance = Math.max(0, diasEntre(ini, parseD(malo.f))) / R.d; e.linea = "Hubo un domicilio el " + fechaLarga(parseD(malo.f)) + ". Llevabas " + plural(Math.max(0, diasEntre(ini, parseD(malo.f))), "día") + ": vuelve a empezar cuando quieras."; }
      else { e.avance = transcurridos / R.d; e.logrado = terminado; e.linea = terminado ? "¡Lo lograste! Una semana entera sin domicilios." : "Vas " + plural(transcurridos, "día") + " de " + R.d + " sin domicilios."; }
    } else if (R.modo === "tope") {
      var g = state.movs.filter(function (x) { return dentro(x) && (R.cats.indexOf(x.cat) > -1 || R.re.test(subsNorm(x.c))); }).reduce(function (s, x) { return s + x.m; }, 0);
      e.avance = Math.min(1, g / R.tope); e.roto = g > R.tope; e.logrado = terminado && !e.roto;
      e.linea = e.roto ? "Te pasaste " + money(g - R.tope) + " del tope. Lo bueno: ya sabes cuánto se va en antojos." : e.logrado ? "¡Lo lograste! Gastaste " + money(g) + " en antojos esta semana." : "Llevas " + money(g) + " de " + money(R.tope) + ". Te quedan " + money(R.tope - g) + " para " + plural(R.d - transcurridos + 1, "día") + ".";
    } else if (R.modo === "check") {
      var n = (r.checks || []).length; e.avance = n / R.d; e.logrado = n >= R.d;
      e.linea = e.logrado ? "¡Lo lograste! Guardaste " + money(n * R.meta) + "." : "Llevas " + money(n * R.meta) + " guardados en " + plural(n, "día") + ".";
      e.hoy = (r.checks || []).indexOf(hoyStr()) > -1;
    } else {
      var con = {}; state.movs.forEach(function (x) { if (dentro(x)) con[x.f] = 1; });
      var sin = 0, f = new Date(ini); while (f < hoy && f <= fin) { if (!con[hoyStr(f)]) sin++; f.setDate(f.getDate() + 1); }
      e.avance = Math.min(1, sin / R.meta); e.logrado = sin >= R.meta; e.roto = terminado && !e.logrado;
      e.linea = e.logrado ? "¡Lo lograste! " + plural(sin, "día") + " sin gastar." : "Llevas " + sin + " de " + R.meta + " días sin gastar" + (terminado ? ". Casi: inténtalo otra vez." : ".");
    }
    return e;
  }
  function renderRetosM() {
    var box = $("rm-lista"); if (!box) return;
    var activos = state.retosMios.filter(function (r) { return RETOS[r.tipo]; }), html = "";
    activos.forEach(function (r) {
      var R = RETOS[r.tipo], e = retoEstado(r);
      if (e.logrado && !r.celebrado) { r.celebrado = 1; setTimeout(function () { celebrar(); changed(); }, 300); }
      html += '<div class="rm-card' + (e.logrado ? " logrado" : e.roto ? " roto" : "") + '"><div class="rm-top"><b>' + esc(R.t) + "</b><small>Hasta el " + fechaLarga(retoFin(r)) + "</small></div>" +
        '<div class="rm-barra" role="img" aria-label="Avance: ' + pctf(e.avance) + '"><i style="width:' + (e.avance * 100).toFixed(1) + '%"></i></div><p>' + e.linea + "</p>" +
        '<div class="rm-acc">' + (R.modo === "check" && !e.logrado && !e.terminado ? '<button class="btn primary sm" type="button" data-rm-check="' + esc(r.id) + '"' + (e.hoy ? " disabled" : "") + ">" + (e.hoy ? "Hoy ya guardaste" : "Hoy guardé " + money(R.meta)) + "</button>" : "") +
        ((e.roto || e.terminado || e.logrado) ? '<button class="btn sm" type="button" data-rm-otra="' + esc(r.id) + '">' + (e.logrado ? "Hacerlo otra vez" : "Volver a empezar") + "</button>" : "") +
        '<button class="btn sm" type="button" data-rm-quitar="' + esc(r.id) + '">Quitar</button></div></div>';
    });
    var libres = Object.keys(RETOS).filter(function (k) { return !activos.some(function (r) { return r.tipo === k; }); });
    if (libres.length) html += '<div class="rm-nuevos">' + libres.map(function (k) {
      return '<button type="button" class="rm-nuevo" data-rm-nuevo="' + k + '"><b>' + esc(RETOS[k].t) + "</b><small>" + esc(RETOS[k].txt) + "</small><span>Empezar</span></button>";
    }).join("") + "</div>";
    box.innerHTML = html;
  }
  document.addEventListener("click", function (e) {
    var n = e.target.closest("[data-rm-nuevo]"), c = e.target.closest("[data-rm-check]"), o = e.target.closest("[data-rm-otra]"), q = e.target.closest("[data-rm-quitar]");
    var buscar = function (id) { return state.retosMios.find(function (r) { return r.id === id; }); };
    if (n) { state.retosMios.push({ id: rid("r"), tipo: n.dataset.rmNuevo, ini: hoyStr(), checks: [] }); vibrar(10); changed(); renderRetosM(); toast("¡Reto aceptado! Te llevo la cuenta."); return; }
    if (c) { var r = buscar(c.dataset.rmCheck); if (r && r.checks.indexOf(hoyStr()) < 0) { r.checks.push(hoyStr()); vibrar(10); sonar("monedas"); changed(); renderRetosM(); } return; }
    if (o) { var r2 = buscar(o.dataset.rmOtra); if (r2) { r2.ini = hoyStr(); r2.checks = []; delete r2.celebrado; changed(); renderRetosM(); } return; }
    if (q) { state.retosMios = state.retosMios.filter(function (r) { return r.id !== q.dataset.rmQuitar; }); changed(); renderRetosM(); }
  });

  // ---------- Dividir una cuenta ----------
  // "Pagué la cena y la dividimos": anota la parte de la persona como gasto, saca el total de la cuenta con que pagó y
  // deja en Te deben lo que le toca a cada uno.
  function dvNombres() { return $("dv-quien").value.split(/,| y /).map(function (s) { return s.trim().replace(/\s+/g, " ").slice(0, 40); }).filter(Boolean).slice(0, 12); }
  function dvTotal() { var raw = $("dv-total").value; return prMonto(nrm(raw)) || +String(raw).replace(/\D/g, "") || 0; }
  function dvVista() {
    var l = dvNombres(), t = dvTotal(), out = $("dv-res");
    if (!(t > 0) || !l.length) { out.innerHTML = '<p class="hint">Escribe cuánto fue y con quién la compartiste.</p>'; return null; }
    var n = l.length + 1, cada = Math.round(t / n / 50) * 50, mio = t - cada * l.length;
    out.innerHTML = '<p>Son <b>' + n + "</b> contándote a ti: cada uno pone <b>" + money(cada) + "</b>" + (mio !== cada ? " (tú, " + money(mio) + ")" : "") + ".</p><p>Te deben: " + l.map(function (q) { return "<b>" + esc(q) + "</b> " + money(cada); }).join(", ") + ".</p>";
    return { l: l, t: t, cada: cada, mio: mio };
  }
  function abrirDividir() {
    ["dv-concepto", "dv-total", "dv-quien"].forEach(function (id) { $(id).value = ""; });
    $("dv-cuenta").innerHTML = '<option value="">No sé / no importa</option>' + state.cuentas.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.nombre) + "</option>"; }).join("");
    dvVista(); openDlg("dlg-dividir", "#dv-concepto");
  }
  ["dv-total", "dv-quien"].forEach(function (id) { $(id).addEventListener("input", dvVista); });
  $("td-dividir").addEventListener("click", abrirDividir);
  $("dv-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = dvVista(); if (!v) return;
    var concepto = $("dv-concepto").value.trim().slice(0, 60) || "Cuenta compartida", k = chCategoria(prNorm(concepto)), cat = (k && k.cat) || "ocio";
    var mes = cur(), fila = chFila("g", cat, concepto, mes);
    if (!fila) { fila = { id: rid("g"), concepto: concepto, cat: cat, dia: 0, plan: 0, real: 0 }; mes.gastos.push(fila); }
    fila.real += v.mio;
    var acc = cuentaById($("dv-cuenta").value);
    if (acc) acc.saldo += signoCuenta(acc, "gasto") * v.t;
    anotarMov({ t: "g", cat: fila.cat || cat, c: concepto, m: v.mio, com: concepto, o: "ch", cu: acc ? acc.id : "" });
    v.l.forEach(function (q) { state.meDeben.push({ id: rid("q"), quien: q, m: v.cada, c: concepto, f: hoyStr() }); });
    marcarRegistro(); closeDlg("dlg-dividir");
    changed(); renderIngresos(); renderGastos(); recompute(); renderCuentas(); renderMeDeben();
    toast("Listo: anoté tu parte (" + money(v.mio) + ") y " + (v.l.length === 1 ? esc(v.l[0]) + " te debe " : "cada uno te debe ") + money(v.cada) + ".");
  });

  // ---------- Calendario de pagos: también los días en que te pagan ----------
  var _renderCalPagos0 = renderCalPagos;
  renderCalPagos = function () {
    _renderCalPagos0.apply(this, arguments);
    var dp = (state.prefs.diasPago || []).filter(function (d) { return d > 0; }); if (!dp.length || $("calpag").hidden) return;
    var p = parseKey(calMes), ult = dim(p.y, p.m);
    dp.forEach(function (d) {
      var b = $("calpag-grid").querySelector('[data-dia="' + calMes + "-" + ("0" + Math.min(d, ult)).slice(-2) + '"]'); if (!b) return;
      b.classList.add("paga"); b.setAttribute("aria-label", b.getAttribute("aria-label") + ". Te pagan este día");
    });
    $("calpag-res").insertAdjacentHTML("beforeend", '<span class="cp-entra">Te pagan el ' + dp.map(function (d) { return Math.min(d, ult); }).join(" y el ") + "</span>");
  };

  // ---------- Que todo se mantenga al día ----------
  var _renderPorPagar0 = renderPorPagar;
  renderPorPagar = function () { _renderPorPagar0.apply(this, arguments); renderSubs(); };
  var _renderMeDeben0 = renderMeDeben;
  renderMeDeben = function () { _renderMeDeben0.apply(this, arguments); renderRetosM(); };
  var _renderAll0 = renderAll;
  renderAll = function () { _renderAll0.apply(this, arguments); renderSubs(); renderRetosM(); };
