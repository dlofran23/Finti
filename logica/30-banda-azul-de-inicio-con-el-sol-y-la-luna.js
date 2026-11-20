  // ===================== Banda azul de Inicio con el sol y la luna =====================
  // La banda va detrás de todo (z-index -1) y llega hasta el final de "Cuéntame un gasto". Su alto y la altura de la
  // tarjeta de hoy (donde van la F grande y el astro) se miden aquí. El punto de la F es el sol de 6 a. m. a 6 p. m.
  // y la luna el resto. Mientras la banda está detrás de la barra de arriba, esa barra queda transparente.
  var bandaH = 0;
  function ajustarBanda() {
    var b = $("banda"); if (!b) return;
    var h = new Date().getHours(), dia = h >= 6 && h < 18;
    b.classList.toggle("dia", dia); b.classList.toggle("noche", !dia);
    var r = $("hoy-registrar"), hc = $("hoy-card");
    if (document.body.getAttribute("data-vista") !== "inicio" || !r || !r.offsetParent) { bandaH = 0; document.body.classList.remove("sobre-banda"); return; }
    var y = window.scrollY || 0;
    bandaH = Math.round(r.getBoundingClientRect().bottom + y + 30);
    b.style.setProperty("--banda-h", bandaH + "px");
    if (hc && !hc.hidden) b.style.setProperty("--hoy-y", Math.round(hc.getBoundingClientRect().top + y) + "px");
    bandaScroll();
  }
  function bandaScroll() {
    var antes = document.body.classList.contains("sobre-banda"), ahora = !!bandaH && (window.scrollY || 0) < bandaH - 130;
    if (antes !== ahora) { document.body.classList.toggle("sobre-banda", ahora); colorSistema(); }
  }
  window.addEventListener("scroll", bandaScroll, { passive: true });
  window.addEventListener("resize", ajustarBanda);
  try { new ResizeObserver(function () { ajustarBanda(); }).observe(document.querySelector("main.wrap")); } catch (e) {}
  setInterval(ajustarBanda, 5 * 60 * 1000);

  // Cambio de pestaña que pidió la persona (barra, menú, "Ver todos"): con View Transitions si el navegador las tiene.
  // El círculo nace en (x, y), donde tocó la persona. Los cambios desde el código siguen con irA(), al instante.
  var vtCorriendo = null;
  function irAConTransicion(v, x, y, desde) {
    if (VIEWS.indexOf(v) < 0) v = "inicio";
    if (v === vistaActual || !document.startViewTransition || reduceMotion || document.hidden) return irA(v);
    if (vtCorriendo) { try { vtCorriendo.skipTransition(); } catch (e) {} }
    var W = window.innerWidth, H = window.innerHeight;
    if (x == null) { x = W / 2; y = H - 40; }
    root.style.setProperty("--px", Math.round(x) + "px"); root.style.setProperty("--py", Math.round(y) + "px");
    root.style.setProperty("--pr", Math.ceil(Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 8) + "px");
    // El nombre de la pestaña viaja de la barra (o del menú) al título de la pantalla nueva
    var lbl = desde && desde.querySelector ? desde.querySelector("span") : null, tit = document.querySelector('[data-view="' + v + '"] .vista-titulo');
    if (lbl && tit && lbl.offsetParent) lbl.classList.add("vt-titulo"); else lbl = null;
    root.classList.add("con-vt");
    try {
      var t = vtCorriendo = document.startViewTransition(function () {
        if (lbl) lbl.classList.remove("vt-titulo");
        irA(v, false, true);
        if (lbl && tit) tit.classList.add("vt-titulo");
      });
      t.finished.then(fin, fin);
      // Si otra transición la reemplaza, el navegador rechaza estas promesas: no es un error
      if (t.ready) t.ready.catch(function () {}); if (t.updateCallbackDone) t.updateCallbackDone.catch(function () {});
    } catch (e) { fin(); irA(v); }
    function fin() {
      if (lbl) lbl.classList.remove("vt-titulo"); if (tit) tit.classList.remove("vt-titulo");
      if (vtCorriendo === t) { vtCorriendo = null; root.classList.remove("con-vt"); vibrar(6); }
    }
  }

  // Deslizar con el dedo entre Inicio, Movimientos y Metas (celular): la página sigue al dedo, la de al lado entra encima
  // con sombra y la que se va se queda atrás y se apaga. Al soltar decide por distancia o por velocidad; se puede soltar
  // a medias y vuelve. En los bordes (Inicio a la izquierda, Metas a la derecha) frena como una goma.
  (function () {
    var ORDEN = ["inicio", "movimientos", "metas"], g = null;
    var NO = "input, textarea, select, .bills, .seg, .hist-play, .billetera, .bt-pila, [data-no-deslizar], .donut, .pr-pron";
    function hoja(v) { return document.querySelector('.view[data-view="' + v + '"]'); }
    function puede(e) {
      if (window.innerWidth > 760 || e.touches.length !== 1 || vtCorriendo) return false;
      if (document.querySelector(".dlg-backdrop:not([hidden])") || ($("lateral") && $("lateral").classList.contains("abierta"))) return false;
      if (ORDEN.indexOf(vistaActual) < 0 || (e.target.closest && e.target.closest(NO))) return false;
      return !!(e.target.closest && e.target.closest("main.wrap"));
    }
    function limpiar() {
      if (!g) return;
      [g.actual, g.vecina, $("banda")].forEach(function (el) { if (el) { el.style.transform = ""; el.style.filter = ""; el.style.transition = ""; } });
      if (g.vecina) {
        g.vecina.classList.remove("vecina", "desde-izq");
        ["top", "left", "width", "minHeight", "paddingTop", "paddingLeft", "paddingRight", "boxSizing", "background", "alignContent"].forEach(function (k) { g.vecina.style[k] = ""; });
        if (!g.listo) g.vecina.hidden = true;
      }
      if (g.actual) g.actual.classList.remove("arrastra");
      document.body.classList.remove("arrastre-banda");
      g = null;
    }
    function preparar(dir) {
      var i = ORDEN.indexOf(vistaActual), dest = ORDEN[i + dir];
      g.dir = dir; g.actual = hoja(vistaActual); g.actual.classList.add("arrastra");
      if (!dest) { g.goma = true; return; }
      // La vecina es una hoja de pantalla completa bajo la barra de arriba, con su contenido donde quedará al llegar
      var r = g.actual.getBoundingClientRect(), top0 = r.top + window.scrollY, tb = document.querySelector(".topbar").getBoundingClientRect().bottom;
      // El aviso del ejemplo solo vive en Inicio: si se ve aquí y no allá, la vecina empieza más arriba
      var aviso = $("example-notice");
      if (aviso && aviso.offsetParent && dest !== "inicio" && dest !== "presupuesto") top0 -= aviso.offsetHeight + (parseFloat(getComputedStyle(aviso.parentNode).rowGap) || 0);
      g.dest = dest; g.vecina = hoja(dest);
      g.vecina.classList.add("vecina"); if (dir < 0) g.vecina.classList.add("desde-izq");
      var v = g.vecina.style; v.top = tb + "px"; v.left = "0px"; v.width = "100vw"; v.minHeight = (window.innerHeight - tb) + "px";
      v.paddingTop = Math.max(0, top0 - tb) + "px"; v.paddingLeft = v.paddingRight = r.left + "px"; v.boxSizing = "border-box"; v.alignContent = "start";
      g.vecina.hidden = false;
      g.banda = vistaActual === "inicio" ? "actual" : dest === "inicio" ? "vecina" : "";
      if (g.banda === "vecina") {
        document.body.classList.add("arrastre-banda");
        var bh = parseFloat(($("banda") && $("banda").style.getPropertyValue("--banda-h")) || 0) || 560;   // último alto medido en Inicio
        v.background = "linear-gradient(var(--bg), var(--bg)) 0 " + Math.max(0, bh - tb) + "px / 100% 100% no-repeat";
      }
    }
    function pintar(dx) {
      var W = g.W, b = $("banda");
      if (g.goma) { var gx = dx / (1 + Math.abs(dx) / 120) * .55; g.actual.style.transform = "translateX(" + gx + "px)"; return; }
      var p = Math.min(1, Math.max(0, -dx * g.dir / W));
      var xa = -g.dir * p * W * .3, xv = g.dir * (1 - p) * W;
      g.actual.style.transform = "translateX(" + xa + "px) scale(" + (1 - p * .04) + ")"; g.actual.style.filter = "brightness(" + (1 - p * .45) + ")";
      g.vecina.style.transform = "translateX(" + xv + "px)";
      if (b && g.banda) b.style.transform = "translateX(" + (g.banda === "actual" ? xa : xv) + "px)";
      g.p = p;
    }
    document.addEventListener("touchstart", function (e) {
      if (g || !puede(e)) return;
      var t = e.touches[0]; g = { x0: t.clientX, y0: t.clientY, modo: "", W: window.innerWidth, vx: 0, ult: [t.clientX, performance.now()], p: 0 };
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
      if (!g || g.fin) return;
      var t = e.touches[0], dx = t.clientX - g.x0, dy = t.clientY - g.y0;
      if (!g.modo) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { g = null; return; }
        if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
        g.modo = "h"; preparar(dx < 0 ? 1 : -1);
      }
      e.preventDefault();
      var ahora = performance.now(), dt = ahora - g.ult[1];
      if (dt > 0) g.vx = .7 * ((t.clientX - g.ult[0]) / dt) + .3 * g.vx;
      g.ult = [t.clientX, ahora]; g.dx = dx; pintar(dx);
    }, { passive: false });
    function soltar() {
      if (!g || !g.modo || g.fin) { if (g && !g.modo) g = null; return; }
      g.fin = true;
      var va = !g.goma && (g.p > .35 || (g.vx * -g.dir > .45 && g.p > .08));
      var dur = Math.round(Math.max(180, Math.min(420, (va ? 1 - g.p : g.p) * 520)));
      var curva = "transform " + dur + "ms cubic-bezier(.32,.72,0,1), filter " + dur + "ms cubic-bezier(.32,.72,0,1)";
      [g.actual, g.vecina, $("banda")].forEach(function (el) { if (el) el.style.transition = curva; });
      if (g.goma) { g.actual.style.transform = ""; setTimeout(limpiar, dur); return; }
      pintar(va ? -g.dir * g.W : 0);
      var dest = g.dest;
      setTimeout(function () {
        if (!g) return;
        if (va) { g.listo = true; var v = g.vecina; limpiar(); v.hidden = false; irA(dest, false, false, true); try { window.scrollTo({ top: 0, behavior: "instant" }); } catch (e) {} vibrar(6); }
        else limpiar();
      }, dur + 20);
    }
    document.addEventListener("touchend", soltar, { passive: true });
    document.addEventListener("touchcancel", soltar, { passive: true });
  })();

  function irA(v, noHash, enVT, sinAnim) {
    if (VIEWS.indexOf(v) < 0) v = "inicio";
    var dir = vistaActual && vistaActual !== v ? (VIEWS.indexOf(v) > VIEWS.indexOf(vistaActual) ? "entra-der" : "entra-izq") : "";
    vistaActual = v; document.body.setAttribute("data-vista", v);
    Array.prototype.forEach.call(document.querySelectorAll(".view"), function (s) {
      s.hidden = s.dataset.view !== v; s.classList.remove("entra-der", "entra-izq", "entra-vt");
      if (!s.hidden && dir && !sinAnim) { void s.offsetWidth; s.classList.add(enVT ? "entra-vt" : dir); }
    });
    Array.prototype.forEach.call(document.querySelectorAll("#tabs button"), function (b) { if (b.dataset.tab === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    pintarBarra(v); ajustarBanda();
    if (!noHash) { try { history.replaceState(null, "", "#" + v); } catch (e) {} }
    try { window.scrollTo({ top: 0, behavior: reduceMotion || enVT || sinAnim ? "instant" : "smooth" }); } catch (e) {}
  }
  $("tabs").addEventListener("click", function (e) { var b = e.target.closest("button[data-tab]"); if (b) irAConTransicion(b.dataset.tab, e.clientX || null, e.clientY || null); });
  // Barra de abajo (celular): Inicio, Movimientos, registrar, Metas y Más (el menú con Cuentas, Análisis y lo demás)
  function pintarBarra(v) {
    var activo = null;
    [].forEach.call(document.querySelectorAll("#barra [data-ir]"), function (b) {
      var es = b.dataset.ir === v || (b.dataset.ir === "mas" && (v === "cuentas" || v === "analisis" || v === "presupuesto"));
      if (es) { b.setAttribute("aria-current", "page"); activo = b; } else b.removeAttribute("aria-current");
    });
    var luz = $("barra-luz"); if (!luz || !activo) return;
    requestAnimationFrame(function () { requestAnimationFrame(function () { moverLuz(luz, activo); }); });
  }
  function moverLuz(luz, activo) {
    var br = $("barra").getBoundingClientRect(), ar = activo.getBoundingClientRect();
    if (!br.width) return;
    var w = luz.offsetWidth || 56, x = Math.max(2, Math.min(br.width - w - 2, ar.left - br.left + ar.width / 2 - w / 2));
    var antes = luz.style.transform, nuevo = "translateX(" + x.toFixed(1) + "px)";
    if (antes && antes !== nuevo && !reduceMotion) { luz.classList.remove("viaja"); void luz.offsetWidth; luz.classList.add("viaja"); }
    luz.style.transform = nuevo; luz.style.opacity = 1;
  }
  $("barra").addEventListener("click", function (e) {
    var b = e.target.closest("[data-ir]"); if (!b) return;
    vibrar(8);
    if (b.dataset.ir === "mas") { $("btn-menu").click(); return; }
    var rb = b.getBoundingClientRect();
    irAConTransicion(b.dataset.ir, rb.left + rb.width / 2, rb.top + rb.height / 2, b);
  });
  window.addEventListener("resize", function () { pintarBarra(vistaActual); });
  try { document.fonts.ready.then(function () { pintarBarra(vistaActual); }); } catch (e) {}
  // Vibración corta en Android (en iPhone el navegador no la permite); respeta "sonidos y vibración" apagados
  function vibrar(ms) { try { if (navigator.vibrate && !(state && state.prefs && state.prefs.sonidos === false)) navigator.vibrate(ms || 10); } catch (e) {} }
  window.addEventListener("hashchange", function () { irA(location.hash.slice(1), true); });

  // --- Menú Más ---
  function cerrarMenu() { $("menu-mas").hidden = true; $("btn-mas").setAttribute("aria-expanded", "false"); }
  $("btn-mas").addEventListener("click", function (e) {
    e.stopPropagation();
    var abrir = $("menu-mas").hidden;
    $("menu-mas").hidden = !abrir; this.setAttribute("aria-expanded", String(abrir));
    if (abrir) { var f = $("menu-mas").querySelector("button"); if (f) f.focus(); }
  });
  document.addEventListener("click", function (e) { if (!$("menu-mas").hidden && !e.target.closest(".menu-wrap")) cerrarMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("menu-mas").hidden) { cerrarMenu(); $("btn-mas").focus(); } });

  // --- Meses anterior y siguiente ---
  $("mes-prev").addEventListener("click", function () { var ks = monthKeys(), i = ks.indexOf(state.mes); if (i > 0) switchMonth(ks[i - 1]); });
  $("mes-next").addEventListener("click", function () { var ks = monthKeys(), i = ks.indexOf(state.mes); if (i < ks.length - 1) switchMonth(ks[i + 1]); });
  function renderMonthNav() {
    var ks = monthKeys(), i = ks.indexOf(state.mes);
    $("mes-prev").disabled = i <= 0; $("mes-next").disabled = i >= ks.length - 1;
  }

  // --- Registro rápido ---
  var addTipo = "gasto", addSel = null, addCat = "otros", addCuenta = "";
  function parseMonto(v) { return Math.max(0, Math.round(num(String(v).replace(/\./g, "").replace(/,/g, ".")))); }
  function fmtMiles(n) { return n ? new Intl.NumberFormat("es-CO").format(n) : ""; }
  // En celulares el monto se marca con un teclado grande propio (no se abre el del sistema); en computador, con el teclado.
  var addTactil = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches), addFecha = "", addDicho = "";
  function abrirRegistro(tipo) {
    addTipo = tipo || "gasto"; addSel = null; addFecha = ""; addDicho = "";
    $("add-monto").value = ""; $("add-concepto").value = ""; $("add-err").textContent = ""; $("add-texto").value = ""; $("add-entendi").hidden = true;
    $("add-teclado").hidden = !addTactil;
    $("add-monto").setAttribute("inputmode", addTactil ? "none" : "numeric");
    renderRegistro();
    sonar("soplo");
    openDlg("dlg-add", addTactil ? null : "#add-monto");
  }
  function addMontoPoner(m) { $("add-monto").value = m ? fmtMiles(m) : ""; $("add-save").textContent = m ? "Registrar " + money(m) : "Registrar"; }
  $("add-teclado").addEventListener("click", function (e) {
    var b = e.target.closest("[data-k]"); if (!b) return;
    var t = String(parseMonto($("add-monto").value) || ""), k = b.dataset.k;
    t = k === "borrar" ? t.slice(0, -1) : (t + k).replace(/^0+/, "");
    if (t.length > 10) return;
    addMontoPoner(+t || 0);
    var caja = document.querySelector("#dlg-add .amount-box"); if (caja) { caja.classList.remove("salta"); void caja.offsetWidth; caja.classList.add("salta"); }
    if (navigator.vibrate && state.prefs.sonidos) try { navigator.vibrate(6); } catch (er) {}
  });
  $("add-frec").addEventListener("click", function (e) {
    var b = e.target.closest("[data-frec]"); if (!b) return;
    var o = chFrecuentes(4)[+b.dataset.frec]; if (!o) return;
    var f = chFila("g", o.cat, o.c);
    addTipo = "gasto";
    if (f && nrm(f.concepto) === nrm(o.c)) addSel = f.id; else { addSel = "__nuevo"; $("add-concepto").value = o.c; addCat = o.cat || "otros"; }
    addMontoPoner(o.m); renderRegistro();
  });
  // Escribirlo como se diría: "$ 18.000 en almuerzo con Nequi", "ayer taxi 12 mil", "me pagaron 50 mil"
  var addTextoT = null;
  $("add-texto").addEventListener("input", function () { clearTimeout(addTextoT); addTextoT = setTimeout(addEntender, 250); });
  $("add-texto").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); clearTimeout(addTextoT); addEntender(); if (parseMonto($("add-monto").value) && addSel) $("add-save").click(); } });
  function addEntender() {
    var txt = $("add-texto").value.trim(), out = $("add-entendi");
    if (!txt) { out.hidden = true; return; }
    var r = chEntender(txt), partes = [];
    addTipo = r.t === "i" ? "ingreso" : "gasto";
    if (r.m) { addMontoPoner(r.m); partes.push("<b>" + money(r.m) + "</b>"); }
    if (r.t === "i") {
      var fi = chFila("i", "", r.c); addSel = fi ? fi.id : "__nuevo"; if (!fi) $("add-concepto").value = r.c || "Otros ingresos";
      partes.push(esc(fi ? fi.concepto : (r.c || "Otros ingresos")));
    } else if (r.cat || r.c) {
      var f = chFila("g", r.cat, r.c);
      if (f && (!r.c || nrm(f.concepto) === nrm(r.c) || !r.cat || f.cat === r.cat)) { addSel = f.id; partes.push(esc(f.concepto) + (r.c && nrm(r.c) !== nrm(f.concepto) ? " (" + esc(r.c) + ")" : "")); }
      else { addSel = "__nuevo"; $("add-concepto").value = r.c || ""; addCat = r.cat || "otros"; partes.push(esc(r.c || "Otro") + (r.cat ? " · " + esc((catById(r.cat) || {}).name || "") : "")); }
    }
    if (r.cuenta) { addCuenta = r.cuenta; partes.push(esc((cuentaById(r.cuenta) || {}).nombre || "")); }
    addFecha = r.f || ""; if (chFechaTxt(addFecha)) partes.push(esc(chFechaTxt(addFecha)));
    addDicho = r.c || "";
    renderRegistro();
    out.hidden = false;
    out.innerHTML = partes.length ? "Entendí: " + partes.join(" · ") + (r.comp ? '. <button type="button" class="link-btn" id="add-a-charla">Es compartido: anotarlo en la charla</button>' : "") : "Todavía no entiendo. Prueba con el monto y en qué fue.";
  }
  $("add-entendi").addEventListener("click", function (e) {
    if (!e.target.closest("#add-a-charla")) return;
    var t = $("add-texto").value; closeDlg("dlg-add"); abrirCharla(t);
  });
  function renderRegistro() {
    Array.prototype.forEach.call($("add-tipo").querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.tipo === addTipo)); });
    var list = addTipo === "gasto" ? cur().gastos : cur().ingresos;
    $("add-q").textContent = addTipo === "gasto" ? "¿En qué gastaste?" : "¿Qué ingreso recibiste?";
    $("add-items").innerHTML = list.map(function (r) {
      var icon = addTipo === "gasto" ? catIcon(r.cat) : '<span class="cat-ic" style="--c:#0ca678"><svg class="ic"><use href="#c-ingreso"/></svg></span>';
      var q = addTipo === "gasto" ? r.plan - r.real : r.plan - r.real;
      var sub = r.plan ? (addTipo === "gasto" ? (q >= 0 ? "Quedan " + money(q) : "Pasado " + money(-q)) : (q > 0 ? "Faltan " + money(q) : "Completo")) : (r.real ? "Llevas " + money(r.real) : "Sin plan");
      return '<button type="button" class="pick burbuja" style="--c:' + (addTipo === "gasto" ? catColor(r.cat) : "#2fbf71") + '" role="radio" aria-checked="' + (addSel === r.id) + '" data-id="' + esc(r.id) + '">' + icon + '<span class="t"><b>' + esc(r.concepto || "Sin nombre") + '</b><small class="' + (addTipo === "gasto" && q < 0 ? "neg" : "") + '">' + sub + "</small></span></button>";
    }).join("") + '<button type="button" class="pick" role="radio" aria-checked="' + (addSel === "__nuevo") + '" data-id="__nuevo"><span class="cat-ic"><svg class="ic"><use href="#i-plus"/></svg></span><span class="t"><b>Otro</b><small>Nuevo concepto</small></span></button>';
    $("add-new").hidden = addSel !== "__nuevo";
    $("add-cats").hidden = addTipo !== "gasto";
    if (addSel === "__nuevo" && addTipo === "gasto") {
      $("add-cats").innerHTML = cats().map(function (c) { return '<button type="button" class="pick burbuja" style="--c:' + catColor(c.id) + '" role="radio" aria-checked="' + (addCat === c.id) + '" data-cat="' + esc(c.id) + '">' + catIcon(c.id) + '<span class="t"><b>' + esc(c.name) + "</b></span></button>"; }).join("");
    }
    if (addCuenta && !cuentaById(addCuenta)) addCuenta = "";
    $("add-cuentas-wrap").hidden = !state.cuentas.length;
    $("add-cuentas").innerHTML = chipsCuentas(addCuenta);
    var m = parseMonto($("add-monto").value);
    $("add-save").textContent = m ? "Registrar " + money(m) : "Registrar";
    var fr = addTipo === "gasto" ? chFrecuentes(4) : [];
    $("add-frec").hidden = !fr.length;
    $("add-frec").innerHTML = fr.map(function (o, i) { return '<button type="button" class="chip-btn" data-frec="' + i + '" style="--c:' + catColor(o.cat) + '"><i class="pt" aria-hidden="true"></i>' + esc(o.c) + " · " + money(o.m) + "</button>"; }).join("");
  }
  $("add-cuentas").addEventListener("click", function (e) { var b = e.target.closest("[data-cuenta]"); if (!b) return; addCuenta = b.dataset.cuenta; this.innerHTML = chipsCuentas(addCuenta); });
  $("fab-add").addEventListener("click", function () { abrirRegistro("gasto"); });
  $("add-tipo").addEventListener("click", function (e) { var b = e.target.closest("[data-tipo]"); if (!b) return; addTipo = b.dataset.tipo; addSel = null; renderRegistro(); });
  $("add-items").addEventListener("click", function (e) { var b = e.target.closest("[data-id]"); if (!b) return; addSel = b.dataset.id; addDicho = ""; renderRegistro(); if (addSel === "__nuevo") $("add-concepto").focus(); });
  $("add-cats").addEventListener("click", function (e) { var b = e.target.closest("[data-cat]"); if (!b) return; addCat = b.dataset.cat; renderRegistro(); });
  $("add-monto").addEventListener("input", function () {
    var m = parseMonto(this.value); this.value = fmtMiles(m);
    $("add-save").textContent = m ? "Registrar " + money(m) : "Registrar";
  });
  $("add-quick").addEventListener("click", function (e) {
    var b = e.target.closest("[data-suma]"); if (!b) return;
    var m = parseMonto($("add-monto").value) + (+b.dataset.suma);
    $("add-monto").value = fmtMiles(m); $("add-save").textContent = "Registrar " + money(m);
  });
  $("add-monto").addEventListener("keydown", function (e) { if (e.key === "Enter") $("add-save").click(); });
  $("add-save").addEventListener("click", function () {
    var m = parseMonto($("add-monto").value), err = $("add-err");
    if (!m) { err.textContent = "Escribe el monto."; $("add-monto").focus(); return; }
    if (!addSel) { err.textContent = addTipo === "gasto" ? "Elige en qué gastaste." : "Elige qué ingreso recibiste."; return; }
    var list = addTipo === "gasto" ? cur().gastos : cur().ingresos, row, nuevo = false;
    if (addSel === "__nuevo") {
      var nombre = $("add-concepto").value.trim();
      if (!nombre) { err.textContent = "Escribe el concepto."; $("add-concepto").focus(); return; }
      row = addTipo === "gasto" ? { id: rid("g"), concepto: nombre.slice(0, 80), cat: addCat, dia: 0, plan: 0, real: 0 } : { id: rid("i"), concepto: nombre.slice(0, 80), plan: 0, real: 0 };
      list.push(row); nuevo = true;
    } else {
      row = list.find(function (r) { return r.id === addSel; });
      if (!row) return;
    }
    var antes = row.real;
    row.real = antes + m;
    var acc = addCuenta ? cuentaById(addCuenta) : null, accAntes = acc ? acc.saldo : 0, regAntes = state.registros.slice();
    if (acc) acc.saldo = accAntes + signoCuenta(acc, addTipo) * m;
    var mov = anotarMov({ t: addTipo === "gasto" ? "g" : "i", cat: row.cat || "", c: addDicho || row.concepto, m: m, f: addFecha || "", com: addDicho || "", cu: acc ? acc.id : "" });
    marcarRegistro();
    closeDlg("dlg-add");
    changed(); renderIngresos(); renderGastos(); recompute(); renderCuentas();
    var html;
    if (addTipo === "gasto") {
      var r = row.plan ? row.real / row.plan : 0, cls = !row.plan ? "" : r > 1 ? "bad" : r >= 0.9 ? "warn" : "";
      html = "<b>" + money(m) + "</b> en " + esc(row.concepto) + ". " + (row.plan ? (row.real <= row.plan ? "Quedan " + money(row.plan - row.real) + "." : "Van " + money(row.real - row.plan) + " más de lo planeado.") : "") +
        (row.plan ? '<div class="tbar"><i class="' + cls + '" style="width:' + Math.min(r * 100, 100).toFixed(1) + '%"></i></div>' : "");
    } else {
      html = "<b>" + money(m) + "</b> de " + esc(row.concepto) + " registrados. ¡Bien!";
    }
    if (acc) html += '<div style="opacity:.8;font-size:13px;margin-top:4px">' + esc(acc.nombre) + " queda en " + money(acc.saldo) + ".</div>";
    toast(html, { action: "Deshacer", ms: 6000, onAction: function () {
      if (nuevo) { var i = list.indexOf(row); if (i > -1) list.splice(i, 1); } else row.real = antes;
      if (acc) acc.saldo = accAntes;
      state.registros = regAntes; quitarMov(mov);
      changed(); renderIngresos(); renderGastos(); recompute(); renderCuentas();
    } });
  });


