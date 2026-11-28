  // ===================== v5 · Cuentas, pagos, rachas, logros y avisos =====================
  var TIPOS_CUENTA = [
    { id: "banco", name: "Banco", icon: "a-banco", color: "#3b5bdb" },
    { id: "nequi", name: "Nequi", icon: "a-cel", color: "#c2255c" },
    { id: "daviplata", name: "Daviplata", icon: "a-cel", color: "#e03131" },
    { id: "efectivo", name: "Efectivo", icon: "a-efectivo", color: "#2f9e44" },
    { id: "tarjeta", name: "Tarjeta de crédito", icon: "a-tarjeta", color: "#7048e8" },
    { id: "otra", name: "Otra", icon: "a-otra", color: "#868e96" }
  ];
  function tipoCuenta(id) { return TIPOS_CUENTA.find(function (t) { return t.id === id; }) || TIPOS_CUENTA[5]; }
  function cuentaById(id) { return state.cuentas.find(function (c) { return c.id === id; }) || null; }
  // Colores aproximados de cada entidad (solo color y nombre, sin logos). c: tono para fondos con texto, con contraste 4,5 : 1.
  function marcaCuenta(cu) {
    var n = nrm((cu && cu.nombre) || ""), t = (cu && cu.tipo) || "";
    var M = function (c, tx, g, a, sh, clase) { return { c: c, t: tx, g: g, a: a, s: sh, clase: clase }; };
    var clase = t === "efectivo" ? "efectivo" : t === "nequi" || t === "daviplata" ? "billetera" : "tarjeta";
    var bk = t !== "efectivo" && bancoDeCuenta(cu);
    if (bk && bk.id !== "nequi" && bk.id !== "daviplata") return marcaDeBanco(bk, t === "tarjeta" || t === "banco" ? "tarjeta" : bk.g === "d" || bk.tipo === "otra" ? "billetera" : clase);
    if (/nequi/.test(n) || t === "nequi") return M("#da0081", "#fff", "radial-gradient(120% 140% at 0% 0%, #5a1170 0%, #2a0638 45%, #200020 100%)", "#da0081", "rgba(120,0,110,.55)", "billetera");
    if (/daviplata/.test(n) || t === "daviplata") return M("#c8101b", "#fff", "radial-gradient(120% 140% at 0% 0%, #ff5a60 0%, #ed1c24 42%, #a90f17 100%)", "#ffffff", "rgba(190,20,30,.55)", "billetera");
    if (/davivienda/.test(n)) return M("#c8101b", "#fff", "radial-gradient(120% 140% at 0% 0%, #ff5a60 0%, #ed1c24 42%, #a90f17 100%)", "#ffffff", "rgba(190,20,30,.55)", clase);
    if (/bancolombia/.test(n)) return M("#fdda24", "#2c2a29", "radial-gradient(120% 140% at 0% 0%, #fff1a0 0%, #fdda24 40%, #e2ae00 100%)", "#2c2a29", "rgba(200,150,0,.5)", clase);
    if (/(^| )nu( |$)|nubank/.test(n)) return M("#820ad1", "#fff", "radial-gradient(120% 140% at 0% 0%, #b04cf0 0%, #820ad1 45%, #4e0582 100%)", "#ffffff", "rgba(110,10,180,.5)", clase);
    if (/bbva/.test(n)) return M("#1464a5", "#fff", "radial-gradient(120% 140% at 0% 0%, #3d8fd6 0%, #1464a5 45%, #072146 100%)", "#ffffff", "rgba(10,60,120,.5)", clase);
    if (t === "efectivo" || /efectivo|billetera/.test(n)) return M("#237a4b", "#fff", "radial-gradient(120% 140% at 0% 0%, #5cc48a 0%, #2e8b57 45%, #17482e 100%)", "#c8f2d9", "rgba(25,100,60,.5)", "efectivo");
    if (t === "tarjeta") return M("#2a2d35", "#fff", "radial-gradient(120% 140% at 0% 0%, #5b606e 0%, #2a2d35 50%, #121318 100%)", "#ffffff", "rgba(0,0,0,.45)", "tarjeta");
    if (t === "banco") return M("#3a4766", "#fff", "radial-gradient(120% 140% at 0% 0%, #7383a6 0%, #3a4766 50%, #1d2539 100%)", "#ffffff", "rgba(20,30,60,.45)", "tarjeta");
    return M("#5b606e", "#fff", "linear-gradient(135deg, #8a90a0, #5b606e)", "#ffffff", "rgba(0,0,0,.35)", clase);
  }
  var billeteraSel = "";
  function renderBilletera() {
    if (!state.cuentas.length) return "";
    var l = state.cuentas.slice(0, 6), sel = l.some(function (c) { return c.id === billeteraSel; }) ? billeteraSel : l[0].id, i0 = l.findIndex(function (c) { return c.id === sel; });
    var paso = 44, alto = 214 + paso * (l.length - 1);
    return '<div class="billetera" style="--alto:' + alto + 'px" role="group" aria-label="Tus cuentas">' + l.map(function (c, i) {
      var pos = (i - i0 + l.length) % l.length, m = marcaCuenta(c), tj = c.tipo === "tarjeta", t = tipoCuenta(c.tipo);
      var tipo = tj ? "Crédito" : c.tipo === "efectivo" ? "En tu bolsillo" : c.tipo === "nequi" || c.tipo === "daviplata" ? "Billetera" : c.tipo === "banco" ? "Cuenta" : t.name;
      var libre = tj && c.cupo > 0 ? c.cupo - c.saldo : 0, uso = tj && c.cupo > 0 ? Math.min(1, c.saldo / c.cupo) : 0;
      var detalle = m.clase === "tarjeta" ? '<svg class="bt-chip" viewBox="0 0 42 32" aria-hidden="true"><rect x=".5" y=".5" width="41" height="31" rx="7" fill="#e3bc5a" stroke="rgba(80,55,0,.35)"/><rect x=".5" y=".5" width="41" height="14" rx="7" fill="#f7de97" opacity=".7"/><path d="M14 1v30M28 1v30M1 11h13M1 21h13M28 11h13M28 21h13M14 16h14" fill="none" stroke="rgba(90,60,0,.45)" stroke-width="1.2"/></svg><svg class="bt-nfc" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8.5a5 5 0 0 1 0 7M11 6a8.5 8.5 0 0 1 0 12M15 3.5a12 12 0 0 1 0 17"/></svg>'
        : '<span class="bt-ic"><svg class="ic" aria-hidden="true"><use href="#' + (m.clase === "efectivo" ? "i-wallet" : "c-celular") + '"/></svg></span><span>' + (m.clase === "efectivo" ? "Billetes y monedas" : "En tu celular") + "</span>";
      return '<button type="button" class="bt-carta" data-bt="' + esc(c.id) + '" aria-pressed="' + (pos === 0) + '" aria-label="' + esc(c.nombre) + ", " + tipo + ": " + (tj ? "debes " : "") + money(c.saldo) + '"' +
        ' style="--fondo:' + m.g + ";--tinta:" + m.t + ";--aro:" + m.a + ";--sombra:" + m.s + ";--pos:" + pos + ";--y:" + (paso * (l.length - 1 - pos)) + 'px;z-index:' + (20 - pos) + '">' +
        '<span class="bt-arriba"><b>' + esc(c.nombre) + "</b><em>" + esc(tipo) + "</em></span>" +
        '<span class="bt-medio">' + detalle + "</span>" +
        '<span class="bt-saldo"><small>' + (tj ? "Debes" : c.tipo === "efectivo" ? "Tienes" : "Saldo") + "</small><b>" + money(c.saldo) + "</b></span>" +
        '<span class="bt-abajo"><span>' + (tj && c.cupo > 0 ? "Cupo libre " + money(Math.max(0, libre)) : c.saldo < 0 ? "En rojo" : "") + "</span></span>" +
        (tj && c.cupo > 0 ? '<span class="bt-cupo" aria-hidden="true"><i style="width:' + (uso * 100).toFixed(1) + '%"></i></span>' : "") + "</button>";
    }).join("") + "</div>";
  }
  // El color de una cuenta en listas y botones: el de su entidad si se conoce
  function colorCuenta(c) { var b = c.tipo !== "efectivo" && bancoDeCuenta(c); return b ? (b.id === "nequi" ? "#da0081" : b.c === "#ffffff" ? b.a : b.c) : tipoCuenta(c.tipo).color; }
  function acctIcon(c) { var t = tipoCuenta(c.tipo); return '<span class="cat-ic" style="--c:' + colorCuenta(c) + '"><svg class="ic"><use href="#' + t.icon + '"/></svg></span>'; }
  // Un gasto sube la deuda de una tarjeta y baja el saldo de las demás cuentas; un ingreso hace lo contrario.
  function signoCuenta(c, tipo) { var g = tipo !== "ingreso"; return c.tipo === "tarjeta" ? (g ? 1 : -1) : (g ? -1 : 1); }
  function plural(n, s) { return n + " " + (n === 1 ? s : s + "s"); }

  // --- Fechas ---
  function d0(d) { d = d ? new Date(d.getTime ? d.getTime() : d) : new Date(); d.setHours(0, 0, 0, 0); return d; }
  function parseD(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function diasEntre(a, b) { return Math.round((d0(b) - d0(a)) / 864e5); }
  function dim(y, m) { return new Date(y, m, 0).getDate(); }
  function fechaCorta(d) { return d.getDate() + " " + MESES_C[d.getMonth()]; }
  function fechaLarga(d, conAnio) { return d.getDate() + " de " + MESES[d.getMonth()] + (conAnio ? " de " + d.getFullYear() : ""); }

  // --- Ciclos de una cuenta por pagar ---
  function occ(b, k) {
    if (b.f === "mensual") { var y = +k.slice(0, 4), m = +k.slice(5, 7); return new Date(y, m - 1, Math.min(b.dia || 1, dim(y, m))); }
    var f = parseD(b.fecha) || d0();
    if (b.f === "anual") { var yy = +k; return new Date(yy, f.getMonth(), Math.min(f.getDate(), dim(yy, f.getMonth() + 1))); }
    return f;
  }
  function keyDe(b, d) { return b.f === "mensual" ? keyOf(d) : b.f === "anual" ? String(d.getFullYear()) : "u"; }
  function sigKey(b, k, n) { if (b.f === "mensual") return addMonths(k, n); if (b.f === "anual") return String(+k + n); return null; }
  function estadoPago(b, hoy) {
    hoy = hoy || d0();
    var creado = parseD(b.creado) || hoy, k = keyDe(b, hoy);
    if (b.f !== "unica") {
      var kp = sigKey(b, k, -1), dp = occ(b, kp);
      if (!b.pagos[kp] && dp >= creado) return { key: kp, due: dp, pagado: false, dias: diasEntre(hoy, dp) };
    }
    var due = occ(b, k);
    if (b.f !== "unica" && !b.pagos[k] && due < creado) { k = sigKey(b, k, 1); due = occ(b, k); }
    if (b.pagos[k]) {
      var nk = sigKey(b, k, 1), nd = nk ? occ(b, nk) : null;
      return { key: k, due: due, pagado: true, prox: nd, dias: nd ? diasEntre(hoy, nd) : null };
    }
    return { key: k, due: due, pagado: false, dias: diasEntre(hoy, due) };
  }
  function freqTxt(b) {
    if (b.f === "mensual") return "Cada mes, el día " + b.dia;
    var f = parseD(b.fecha);
    if (!f) return b.f === "anual" ? "Cada año" : "Una vez";
    return b.f === "anual" ? "Cada año, el " + fechaLarga(f) : "Una vez, el " + fechaLarga(f, true);
  }
  function chipPago(e, b) {
    if (e.pagado) return '<span class="chip ok">Pagado</span>';
    if (e.dias < 0) return '<span class="chip bad">Vencido hace ' + plural(-e.dias, "día") + "</span>";
    if (e.dias === 0) return '<span class="chip bad">Vence hoy</span>';
    if (e.dias === 1) return '<span class="chip warn">Vence mañana</span>';
    if (e.dias <= Math.max(3, b.aviso)) return '<span class="chip warn">En ' + e.dias + " días</span>";
    return '<span class="chip none">En ' + e.dias + " días</span>";
  }
  // Cada pago lleva el color de su categoría en la cajita de la fecha; el texto encima se elige por luminancia.
  function colorPago(b) {
    var c = catColor(b.cat || "otros"), claro = luminance(c) > 0.32, cal = c;
    // Con letra blanca y pequeña, el fondo se oscurece lo justo para que se lea bien (contraste de 4,5 a 1 o más)
    if (!claro) { var k = 0; while (luminance(cal) > 0.18 && k++ < 12) cal = mezclarHex(cal, "#000000", 0.08); }
    return "--c:" + c + ";--c-cal:" + cal + ";--c-on:" + (claro ? "#14121f" : "#ffffff");
  }
  function mezclarHex(a, b, t) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), r = function (sh) { return Math.round(((x >> sh) & 255) * (1 - t) + ((y >> sh) & 255) * t); };
    return "#" + ((1 << 24) + (r(16) << 16) + (r(8) << 8) + r(0)).toString(16).slice(1);
  }
  function calBox(d) { return '<span class="cal" aria-hidden="true"><small>' + MESES_C[d.getMonth()] + "</small><b>" + d.getDate() + "</b></span>"; }
  function pagosOrdenados() {
    var hoy = d0();
    return state.porPagar.map(function (b) { return { b: b, e: estadoPago(b, hoy) }; }).sort(function (x, y) {
      if (x.e.pagado !== y.e.pagado) return x.e.pagado ? 1 : -1;
      var a = x.e.pagado ? (x.e.prox || x.e.due) : x.e.due, c = y.e.pagado ? (y.e.prox || y.e.due) : y.e.due;
      return a - c;
    });
  }

  // --- Calendario: Google Calendar (todas las versiones) y archivo .ics (sitio propio) ---
  function ymd(d) { return d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2); }
  function rrule(b) {
    if (b.f === "mensual") {
      if (b.dia <= 28) return "RRULE:FREQ=MONTHLY;BYMONTHDAY=" + b.dia;
      var ds = []; for (var i = 28; i <= b.dia; i++) ds.push(i);
      return "RRULE:FREQ=MONTHLY;BYMONTHDAY=" + ds.join(",") + ";BYSETPOS=-1";
    }
    return b.f === "anual" ? "RRULE:FREQ=YEARLY" : "";
  }
  function proxFecha(b) { var e = estadoPago(b); return e.pagado ? (e.prox || e.due) : e.due; }
  function gcalUrl(b) {
    var d = proxFecha(b), d2 = new Date(d); d2.setDate(d2.getDate() + 1);
    var q = "action=TEMPLATE&text=" + encodeURIComponent("Pagar " + b.nombre) + "&dates=" + ymd(d) + "/" + ymd(d2) +
      "&details=" + encodeURIComponent("Monto: " + money(b.monto) + ". Recordatorio de Finti.") + (rrule(b) ? "&recur=" + encodeURIComponent(rrule(b)) : "");
    return "https://calendar.google.com/calendar/render?" + q;
  }
  function icsEsc(t) { return String(t).replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n"); }
  function construirIcs() {
    var now = new Date(), stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    var L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Finti//Pagos//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Finti · Pagos"];
    state.porPagar.forEach(function (b) {
      var d = proxFecha(b), d2 = new Date(d); d2.setDate(d2.getDate() + 1);
      L.push("BEGIN:VEVENT", "UID:" + b.id + "@fintelligente", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + ymd(d), "DTEND;VALUE=DATE:" + ymd(d2),
        "SUMMARY:" + icsEsc("Pagar " + b.nombre + " (" + money(b.monto) + ")"), "DESCRIPTION:" + icsEsc("Recordatorio de Finti. Al pagar, márcalo en la app para sumarlo a tus gastos."), "TRANSP:TRANSPARENT");
      if (rrule(b)) L.push(rrule(b));
      if (b.aviso > 0) L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc(b.nombre + " vence en " + plural(b.aviso, "día")), "TRIGGER:-P" + (b.aviso - 1) + "DT16H", "END:VALARM");
      L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc("Hoy vence " + b.nombre), "TRIGGER:PT8H", "END:VALARM", "END:VEVENT");
    });
    L.push("END:VCALENDAR");
    return L.join("\r\n") + "\r\n";
  }

  // --- Inicio: próximos pagos (reemplaza la función anterior) ---
  function renderPagos() {
    var body = $("pagos-body");
    if (!state.porPagar.length) {
      body.innerHTML = '<div class="locked"><p>Agrega tu arriendo, servicios y cuotas: te avisamos antes de cada vencimiento y, al pagar, se suman solos a tus gastos.</p>' +
        '<button class="btn primary" type="button" data-nuevo-pago>+ Agregar cuenta por pagar</button></div>';
      return;
    }
    var list = pagosOrdenados().filter(function (x) { return !x.e.pagado; }).slice(0, 4);
    var mes = d0(), fin = new Date(mes.getFullYear(), mes.getMonth() + 1, 0), falta = 0, n = 0;
    state.porPagar.forEach(function (b) { var e = estadoPago(b); if (!e.pagado && e.due <= fin) { falta += b.monto; n++; } });
    body.innerHTML = (n ? '<div class="bill-sum"><span>Te faltan <b>' + money(falta) + "</b> en " + plural(n, "pago") + " este mes</span></div>" : '<div class="all-good"><svg class="ic"><use href="#c-ahorro"/></svg>Estás al día con los pagos de este mes.</div>') +
      '<div class="bills">' + list.map(billRowHtml).join("") + "</div>";
  }
  function billRowHtml(x) {
    var b = x.b, e = x.e, d = e.pagado ? (e.prox || e.due) : e.due;
    var sub = money(b.monto) + " · " + (e.pagado ? "Próximo: " + fechaCorta(d) : freqTxt(b));
    return '<div class="bill' + (!e.pagado && e.dias < 0 ? " vencido" : "") + '" data-id="' + esc(b.id) + '" style="' + colorPago(b) + '"><div class="bill-row">' + calBox(d) +
      '<span class="nm"><b>' + esc(b.nombre || "Sin nombre") + "</b><span>" + esc(sub) + '</span></span><span class="act">' + chipPago(e, b) +
      (e.pagado ? "" : '<button class="btn primary" type="button" data-pagar="' + esc(b.id) + '">Pagar</button>') + "</span></div></div>";
  }

  // --- Calendario de pagos: el mes con un punto de color por pago, tocar un día filtra la lista ---
  var calMes = keyOf(new Date()), calDia = "";
  function venceEnMes(b, k) {
    var p = parseKey(k), d;
    if (b.f === "mensual") d = occ(b, k);
    else { var f = parseD(b.fecha); if (!f) return null; d = b.f === "anual" ? new Date(p.y, f.getMonth(), Math.min(f.getDate(), dim(p.y, f.getMonth() + 1))) : f; }
    if (d.getFullYear() !== p.y || d.getMonth() !== p.m - 1) return null;
    // Igual que estadoPago: lo que vencía antes de crear la cuenta por pagar no cuenta (sin fecha de creación, desde hoy)
    var creado = parseD(b.creado) || d0(), pagado = !!b.pagos[keyDe(b, d)];
    if (d < creado && !pagado) return null;
    return { d: d, pagado: pagado };
  }
  function renderCalPagos() {
    var box = $("calpag"); box.hidden = !state.porPagar.length; if (box.hidden) return;
    var p = parseKey(calMes), hoy = d0(), dias = dim(p.y, p.m), primero = (new Date(p.y, p.m - 1, 1).getDay() + 6) % 7, porDia = {}, total = 0, pagado = 0, falta = 0, nFalta = 0;
    state.porPagar.forEach(function (b) {
      var v = venceEnMes(b, calMes); if (!v) return;
      (porDia[v.d.getDate()] = porDia[v.d.getDate()] || []).push({ b: b, pagado: v.pagado });
      total += b.monto; if (v.pagado) pagado += b.monto; else { falta += b.monto; nFalta++; }
    });
    $("calpag-mes").textContent = monthLabel(calMes);
    var html = "";
    for (var i = 0; i < primero; i++) html += '<span class="cp-vacio"></span>';
    for (var d = 1; d <= dias; d++) {
      var l = porDia[d] || [], fecha = new Date(p.y, p.m - 1, d), clave = calMes + "-" + ("0" + d).slice(-2);
      var todos = l.length && l.every(function (x) { return x.pagado; }), vencido = l.some(function (x) { return !x.pagado; }) && fecha < hoy;
      var cls = "cp-dia" + (+fecha === +hoy ? " hoy" : "") + (l.length ? " con" : "") + (todos ? " pagado" : "") + (vencido ? " vencido" : "") + (calDia === clave ? " sel" : "");
      var etiqueta = d + " de " + MESES[p.m - 1] + (l.length ? ": " + l.map(function (x) { return x.b.nombre + " " + money(x.b.monto) + (x.pagado ? ", pagado" : ""); }).join("; ") : "");
      html += '<button type="button" class="' + cls + '" data-dia="' + clave + '"' + (l.length ? "" : " tabindex=\"-1\"") + ' aria-label="' + esc(etiqueta) + '"' + (calDia === clave ? ' aria-pressed="true"' : "") + "><b>" + d + "</b>" +
        (l.length ? '<span class="cp-pts">' + l.slice(0, 3).map(function (x) { return '<i style="--c:' + catColor(x.b.cat || "otros") + '"></i>'; }).join("") + (l.length > 3 ? "<em>+</em>" : "") + "</span>" : "") + "</button>";
    }
    $("calpag-grid").innerHTML = html;
    $("calpag-res").innerHTML = total ? '<span>Pagos del mes: <b class="cifra">' + money(total) + "</b></span>" + (falta ? "<span>Faltan <b class=\"cifra\">" + money(falta) + "</b> en " + plural(nFalta, "pago") + "</span>" : '<span class="ok">Todo pagado</span>') :
      "<span>No hay pagos este mes.</span>";
    // Aviso anticipado: categorías que se pasarían con los pagos que faltan este mes
    var avisos = [];
    if (calMes === keyOf(hoy) && state.mes === calMes) {
      var t = totalsOf(cur()), faltaCat = {};
      // Un pago sin marcar cuyo gasto ya se anotó en el mes (mismo nombre, mismo valor o más) no se cuenta dos veces.
      var yaAnotado = function (b) { return cur().gastos.some(function (r) { return normal(r.concepto) === normal(b.nombre) && r.real >= b.monto; }); };
      Object.keys(porDia).forEach(function (k) { porDia[k].forEach(function (x) { if (!x.pagado && !yaAnotado(x.b)) faltaCat[x.b.cat || "otros"] = (faltaCat[x.b.cat || "otros"] || 0) + x.b.monto; }); });
      Object.keys(faltaCat).forEach(function (c) { var bc = t.byCat[c]; if (bc && bc.plan > 0 && bc.real + faltaCat[c] > bc.plan) avisos.push({ c: c, m: bc.real + faltaCat[c] - bc.plan }); });
    }
    $("calpag-aviso").innerHTML = avisos.map(function (a) { return '<p class="cp-aviso" style="--c:' + catColor(a.c) + '"><svg class="ic" aria-hidden="true"><use href="#i-bell"/></svg><span>Con los pagos que faltan, ' + esc((catById(a.c) || {}).name || "") + " se pasaría <b>" + money(a.m) + "</b> de lo planeado. Si quieres, muévele plata desde otra categoría.</span></p>"; }).join("");
  }
  $("calpag-ant").addEventListener("click", function () { calMes = addMonths(calMes, -1); calDia = ""; renderCalPagos(); renderPorPagar(); });
  $("calpag-sig").addEventListener("click", function () { calMes = addMonths(calMes, 1); calDia = ""; renderCalPagos(); renderPorPagar(); });
  $("calpag-grid").addEventListener("click", function (e) {
    var b = e.target.closest("[data-dia]"); if (!b || !b.classList.contains("con")) return;
    calDia = calDia === b.dataset.dia ? "" : b.dataset.dia; renderCalPagos(); renderPorPagar();
  });

  // --- Cuentas por pagar ---
  var editPago = null;
  function renderPorPagar() {
    var body = $("porpagar-body");
    renderCalPagos();
    var conDia = cur().gastos.filter(function (r) { return r.dia > 0 && !state.porPagar.some(function (b) { return normal(b.nombre) === normal(r.concepto); }); });
    var list = pagosOrdenados(), pagado = 0, falta = 0, mes = d0(), fin = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
    list.forEach(function (x) { if (x.e.pagado && x.e.due.getMonth() === mes.getMonth()) pagado += x.b.monto; else if (!x.e.pagado && x.e.due <= fin) falta += x.b.monto; });
    var html = list.length && !calDia ? '<div class="bill-sum"><span>Por pagar este mes: <b>' + money(falta) + '</b></span><span>Ya pagado: <b>' + money(pagado) + "</b></span></div>" : "";
    if (calDia) {
      var dd = parseD(calDia);
      list = list.filter(function (x) { var v = venceEnMes(x.b, calDia.slice(0, 7)); return v && v.d.getDate() === dd.getDate(); });
      html += '<div class="cp-filtro"><span>Pagos del ' + esc(fechaLarga(dd)) + '</span><button class="link-btn" type="button" id="cp-todos">Ver todos</button></div>';
    }
    html += '<div class="bills">' + list.map(function (x) {
      var b = x.b, e = x.e, d = e.pagado ? (e.prox || e.due) : e.due, abierto = editPago === b.id;
      var sub = money(b.monto) + " · " + freqTxt(b) + (b.cuenta && cuentaById(b.cuenta) ? " · " + cuentaById(b.cuenta).nombre : "");
      var out = '<div class="bill' + (!e.pagado && e.dias < 0 ? " vencido" : "") + '" data-id="' + esc(b.id) + '" style="' + colorPago(b) + '"><div class="bill-row">' + calBox(d) +
        '<span class="nm"><b>' + esc(b.nombre || "Sin nombre") + "</b><span>" + esc(sub) + '</span></span><span class="act">' + chipPago(e, b) +
        (e.pagado ? '<button class="link-btn" type="button" data-despagar="' + esc(b.id) + '">Deshacer</button>' : '<button class="btn primary" type="button" data-pagar="' + esc(b.id) + '">Pagar</button>') +
        '<button class="icon-btn" type="button" data-editar="' + esc(b.id) + '" aria-expanded="' + abierto + '" aria-label="Editar ' + esc(b.nombre) + '" title="Editar"><svg class="ic" style="width:16px;height:16px"><use href="#i-edit"/></svg></button></span></div>';
      if (abierto) {
        out += '<div class="bill-edit">' +
          '<label class="wide">Nombre<input class="field" data-f="nombre" value="' + esc(b.nombre) + '" maxlength="60"></label>' +
          '<label>Monto<input class="field" data-f="monto" type="number" inputmode="numeric" min="0" step="1000" value="' + b.monto + '"></label>' +
          '<label>Se repite<select class="field" data-f="f">' + [["mensual", "Cada mes"], ["anual", "Cada año"], ["unica", "Una sola vez"]].map(function (o) { return '<option value="' + o[0] + '"' + (b.f === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label>" +
          (b.f === "mensual" ? '<label>Día de pago<input class="field" data-f="dia" type="number" inputmode="numeric" min="1" max="31" value="' + b.dia + '"></label>' :
            '<label>Fecha<input class="field" data-f="fecha" type="date" value="' + esc(b.fecha) + '"></label>') +
          '<label>Avisar<select class="field" data-f="aviso">' + [0, 1, 2, 3, 5, 7].map(function (n) { return '<option value="' + n + '"' + (b.aviso === n ? " selected" : "") + ">" + (n ? plural(n, "día") + " antes" : "El mismo día") + "</option>"; }).join("") + "</select></label>" +
          '<label>Categoría<select class="field" data-f="cat">' + catOptions(b.cat) + "</select></label>" +
          '<label>Pagar desde<select class="field" data-f="cuenta"><option value="">Sin definir</option>' + state.cuentas.map(function (c) { return '<option value="' + esc(c.id) + '"' + (b.cuenta === c.id ? " selected" : "") + ">" + esc(c.nombre) + "</option>"; }).join("") + "</select></label>" +
          '<div class="foot"><span class="cal-links"><a class="btn" href="' + esc(gcalUrl(b)) + '" target="_blank" rel="noopener"><svg class="ic"><use href="#i-cal"/></svg> Agregar a Google Calendar</a></span>' +
          '<span class="cal-links"><button class="btn" type="button" data-borrar-pago="' + esc(b.id) + '">Eliminar</button><button class="btn primary" type="button" data-editar="' + esc(b.id) + '">Listo</button></span></div></div>';
      }
      return out + "</div>";
    }).join("") + "</div>";
    if (!list.length) html += '<p class="empty">Aún no tienes cuentas por pagar.</p>';
    html += '<div class="cal-links"><button class="add-btn" type="button" data-nuevo-pago>+ Agregar cuenta por pagar</button><button class="add-btn" type="button" data-escanear-recibo><svg class="ic" aria-hidden="true"><use href="#i-cam"/></svg> Escanear recibo</button>' +
      (conDia.length ? '<button class="add-btn" type="button" id="btn-traer-pagos">Traer ' + plural(conDia.length, "pago") + " con día de tus gastos</button>" : "") + "</div>";
    body.innerHTML = html;
  }
  function normal(t) { return String(t || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function nuevoPago() {
    var b = { id: rid("p"), nombre: "Nueva cuenta", monto: 0, f: "mensual", dia: Math.min(new Date().getDate() + 1, 28), fecha: "", cat: "servicios", cuenta: "", aviso: 2, creado: hoyStr(), pagos: {} };
    state.porPagar.push(b); editPago = b.id; changed();
    irA("cuentas"); renderPorPagar(); renderPagos();
    var el = $("porpagar-body").querySelector('.bill[data-id="' + b.id + '"] [data-f="nombre"]'); if (el) { el.focus(); el.select(); }
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-nuevo-pago]")) { nuevoPago(); return; }
    if (e.target.closest("[data-escanear-recibo]")) { abrirRecibo(); return; }
    var p = e.target.closest("[data-pagar]"); if (p) { abrirPagar(p.dataset.pagar); return; }
    if (e.target.closest("[data-open-avisos]")) abrirAvisos();
  });
  $("porpagar-body").addEventListener("click", function (e) {
    if (e.target.closest("#cp-todos")) { calDia = ""; renderCalPagos(); renderPorPagar(); return; }
    var t = e.target.closest("[data-editar]");
    if (t) { editPago = editPago === t.dataset.editar ? null : t.dataset.editar; renderPorPagar(); return; }
    t = e.target.closest("[data-despagar]");
    if (t) {
      var b = state.porPagar.find(function (x) { return x.id === t.dataset.despagar; }); if (!b) return;
      var e2 = estadoPago(b); delete b.pagos[e2.key]; changed(); renderV5();
      toast("Marcado otra vez como pendiente. Si lo sumaste a tus gastos, ajústalo en Movimientos.");
      return;
    }
    t = e.target.closest("[data-borrar-pago]");
    if (t) {
      if (t.dataset.armado !== "1") { t.dataset.armado = "1"; t.textContent = "¿Seguro? Toca otra vez"; return; }
      state.porPagar = state.porPagar.filter(function (x) { return x.id !== t.dataset.borrarPago; }); editPago = null; changed(); renderV5(); return;
    }
    if (e.target.closest("#btn-traer-pagos")) {
      cur().gastos.filter(function (r) { return r.dia > 0 && !state.porPagar.some(function (b) { return normal(b.nombre) === normal(r.concepto); }); }).forEach(function (r) {
        state.porPagar.push({ id: rid("p"), nombre: r.concepto.slice(0, 60), monto: r.plan, f: "mensual", dia: r.dia, fecha: "", cat: r.cat, cuenta: "", aviso: 2, creado: hoyStr(), pagos: {} });
      });
      changed(); renderV5(); toast("Listo: tus pagos con día quedaron como cuentas por pagar.");
    }
  });
  function onPagoInput(e) {
    var t = e.target, card = t.closest(".bill"); if (!card || !t.dataset.f) return;
    var b = state.porPagar.find(function (x) { return x.id === card.dataset.id; }); if (!b) return;
    var f = t.dataset.f;
    if (f === "nombre") { b.nombre = t.value.slice(0, 60); changed(); return; }
    if (e.type === "input") return;
    if (f === "monto") b.monto = Math.max(0, Math.round(num(t.value)));
    else if (f === "dia") b.dia = clamp(Math.round(num(t.value)) || 1, 1, 31);
    else if (f === "aviso") b.aviso = clamp(+t.value || 0, 0, 15);
    else if (f === "fecha") b.fecha = parseD(t.value) ? t.value : "";
    else if (f === "f") { b.f = t.value; if (b.f !== "mensual" && !b.fecha) b.fecha = hoyStr(new Date(Date.now() + 30 * 864e5)); }
    else b[f] = t.value;
    changed(); renderV5();
    var again = $("porpagar-body").querySelector('.bill[data-id="' + b.id + '"] [data-f="' + f + '"]'); if (again) again.focus();
  }
  $("porpagar-body").addEventListener("input", onPagoInput);
  $("porpagar-body").addEventListener("change", onPagoInput);

  // --- Pagar ---
  var pagarId = null, pagarCuenta = "";
  function chipsCuentas(sel) {
    return '<button type="button" role="radio" aria-pressed="' + (!sel) + '" data-cuenta="">Ninguna</button>' + state.cuentas.map(function (c) {
      return '<button type="button" role="radio" aria-pressed="' + (sel === c.id) + '" data-cuenta="' + esc(c.id) + '" style="--c:' + colorCuenta(c) + '"><i class="dot"></i>' + esc(c.nombre) + "</button>";
    }).join("");
  }
  function filaGasto(m, nombre) { return m.gastos.find(function (r) { return normal(r.concepto) === normal(nombre); }) || null; }
  function abrirPagar(id) {
    var b = state.porPagar.find(function (x) { return x.id === id; }); if (!b) return;
    pagarId = id; pagarCuenta = b.cuenta && cuentaById(b.cuenta) ? b.cuenta : "";
    var e = estadoPago(b), mk = keyOf(e.due), m = state.meses[mk] || cur(), mkey = state.meses[mk] ? mk : state.mes;
    $("dlg-pagar-title").textContent = "Pagar " + (b.nombre || "la cuenta");
    $("pagar-sub").textContent = (e.dias < 0 ? "Venció el " : "Vence el ") + fechaLarga(e.due, true) + ".";
    $("pagar-monto").value = fmtMiles(b.monto);
    $("pagar-cuentas-wrap").hidden = !state.cuentas.length;
    $("pagar-cuentas").innerHTML = chipsCuentas(pagarCuenta);
    var row = filaGasto(m, b.nombre), ya = row && row.plan > 0 && row.real >= row.plan;
    $("pagar-sumar").checked = !ya;
    $("pagar-sumar-t").textContent = "Sumarlo a mis gastos de " + monthLabel(mkey).toLowerCase();
    $("pagar-sumar-s").textContent = ya ? "Ya registraste " + money(row.real) + " en " + row.concepto + ". Déjalo apagado para no contarlo dos veces." :
      row ? "Se suma a " + row.concepto + "." : "Se crea el gasto " + b.nombre + ".";
    openDlg("dlg-pagar", "#pagar-ok");
  }
  $("pagar-cuentas").addEventListener("click", function (e) { var b = e.target.closest("[data-cuenta]"); if (!b) return; pagarCuenta = b.dataset.cuenta; this.innerHTML = chipsCuentas(pagarCuenta); });
  $("pagar-monto").addEventListener("input", function () { this.value = fmtMiles(parseMonto(this.value)); });
  $("pagar-ok").addEventListener("click", function () {
    var b = state.porPagar.find(function (x) { return x.id === pagarId; }); if (!b) return;
    var monto = parseMonto($("pagar-monto").value), e = estadoPago(b);
    var mk = keyOf(e.due), m = state.meses[mk] || cur();
    var undo = { pagos: JSON.parse(JSON.stringify(b.pagos)), regs: state.registros.slice() };
    b.pagos[e.key] = hoyStr();
    if ($("pagar-sumar").checked && monto > 0) {
      var row = filaGasto(m, b.nombre);
      if (row) { undo.row = row; undo.real = row.real; row.real += monto; }
      else { row = { id: rid("g"), concepto: b.nombre.slice(0, 80), cat: b.cat, dia: b.f === "mensual" ? b.dia : e.due.getDate(), plan: b.monto, real: monto }; m.gastos.push(row); undo.nuevo = row; undo.mes = m; }
    }
    var acc = pagarCuenta ? cuentaById(pagarCuenta) : null;
    if (acc && monto > 0) { undo.acc = acc; undo.saldo = acc.saldo; acc.saldo += signoCuenta(acc, "gasto") * monto; }
    if (monto > 0) undo.mov = anotarMov({ t: "g", cat: b.cat, c: b.nombre, m: monto });
    marcarRegistro();
    closeDlg("dlg-pagar");
    changed(); renderIngresos(); renderGastos(); recompute(); renderCuentas();
    var ontime = diasEntre(e.due, d0()) <= 0;
    if (ontime) celebrar();
    toast((ontime ? "¡A tiempo! " : "") + "<b>" + esc(b.nombre) + "</b> quedó pagado." + (acc ? " " + esc(acc.nombre) + " queda en " + money(acc.saldo) + "." : ""), { action: "Deshacer", ms: 6500, onAction: function () {
      b.pagos = undo.pagos; state.registros = undo.regs;
      if (undo.row) undo.row.real = undo.real;
      if (undo.nuevo) { var i = undo.mes.gastos.indexOf(undo.nuevo); if (i > -1) undo.mes.gastos.splice(i, 1); }
      if (undo.acc) undo.acc.saldo = undo.saldo;
      quitarMov(undo.mov);
      changed(); renderIngresos(); renderGastos(); recompute(); renderCuentas();
    } });
  });

  // --- Cuentas de dinero ---
  function renderCuentas() {
    var body = $("cuentas-body"), disp = 0, deuda = 0;
    state.cuentas.forEach(function (c) { if (c.tipo === "tarjeta") deuda += c.saldo; else disp += c.saldo; });
    var html = state.cuentas.length ? '<div class="net"><div class="tile"><span class="label">Dinero disponible</span><span class="value">' + money(disp) + '</span></div>' +
      '<div class="tile"><span class="label">Deuda en tarjetas</span><span class="value' + (deuda > 0 ? " neg" : "") + '">' + money(deuda) + '</span></div>' +
      '<div class="tile"><span class="label">Neto</span><span class="value' + (disp - deuda < 0 ? " neg" : "") + '">' + money(disp - deuda) + "</span></div></div>" : "";
    if (CON_3D) html = renderBilletera() + html;
    html += '<div class="accts">' + state.cuentas.map(function (c) {
      var t = tipoCuenta(c.tipo), tj = c.tipo === "tarjeta", uso = tj && c.cupo > 0 ? c.saldo / c.cupo : 0;
      return '<div class="acct" data-id="' + esc(c.id) + '" style="--c:' + colorCuenta(c) + '"><div class="acct-top">' + acctIcon(c) +
        '<input class="field name" data-f="nombre" value="' + esc(c.nombre) + '" maxlength="40" aria-label="Nombre de la cuenta">' + delBtn(c.nombre) + "</div>" +
        '<div class="bal">' + (c.ini || c.saldo >= 0 ? money(c.saldo) : '<small class="bal-sin">Pon cuánto tenías para ver tu saldo</small>') + "</div>" +
        '<div class="two"><label>Tipo<select class="field" data-f="tipo">' + TIPOS_CUENTA.map(function (o) { return '<option value="' + o.id + '"' + (c.tipo === o.id ? " selected" : "") + ">" + o.name + "</option>"; }).join("") + "</select></label>" +
        "<label>" + (tj ? "Deuda usada" : "Saldo") + '<input class="field" data-f="saldo" type="number" inputmode="numeric" step="1000" value="' + c.saldo + '"></label></div>' +
        (tj ? '<label>Cupo total<input class="field" data-f="cupo" type="number" inputmode="numeric" min="0" step="100000" value="' + c.cupo + '"></label>' +
          (c.cupo > 0 ? '<div class="bar" role="img" aria-label="Usas el ' + pctf(Math.min(uso, 1)) + ' del cupo"><div class="fill" style="width:' + (Math.min(uso, 1) * 100).toFixed(1) + '%"></div></div><span class="hint">Usas el ' + pctf(uso) + " del cupo" + (uso > 0.3 ? ": intenta bajar del 30 %." : ".") + "</span>" : "") : "") +
        "</div>";
    }).join("") + "</div>";
    if (!state.cuentas.length) html += '<p class="empty">Agrega dónde tienes tu plata para ver tu dinero disponible en un solo lugar.</p>';
    html += '<button class="add-btn" type="button" id="add-cuenta">+ Agregar cuenta</button>';
    body.innerHTML = html;
  }
  function onCuentaInput(e) {
    var t = e.target, card = t.closest(".acct"); if (!card || !t.dataset.f) return;
    var c = cuentaById(card.dataset.id); if (!c) return;
    var f = t.dataset.f;
    if (f === "nombre") { c.nombre = t.value.slice(0, 40); var bb = bancoPorId(c.banco); if (c.banco && (!bb || !bb.re.test(" " + bkNrm(c.nombre) + " "))) delete c.banco; changed(); return; }
    if (e.type === "input") return;
    if (f === "tipo") c.tipo = t.value; else if (f === "saldo") { c.saldo = Math.round(num(t.value)); c.ini = true; } else if (f === "cupo") c.cupo = Math.max(0, Math.round(num(t.value)));
    changed(); renderCuentas(); checkLogros();
    var again = $("cuentas-body").querySelector('.acct[data-id="' + c.id + '"] [data-f="' + f + '"]'); if (again) again.focus();
  }
  $("cuentas-body").addEventListener("click", function (e) { var b = e.target.closest("[data-bt]"); if (!b) return; vibrar(8); billeteraSel = b.dataset.bt; renderCuentas(); var n = $("cuentas-body").querySelector('[data-bt="' + b.dataset.bt + '"]'); if (n) n.focus(); });
  $("cuentas-body").addEventListener("input", onCuentaInput);
  $("cuentas-body").addEventListener("change", onCuentaInput);
  $("cuentas-body").addEventListener("click", function (e) {
    if (e.target.closest("#add-cuenta")) { abrirBancos(); return; }
    var b = e.target.closest("[data-del]"); if (!b) return;
    var id = b.closest(".acct").dataset.id;
    state.cuentas = state.cuentas.filter(function (x) { return x.id !== id; });
    state.porPagar.forEach(function (p) { if (p.cuenta === id) p.cuenta = ""; });
    changed(); renderCuentas();
  });

  // --- Rachas ---
  // Anota un movimiento con su fecha y hora para que el asesor aprenda los patrones de gasto.
  function anotarMov(o) {
    metrica("registro", "una");
    var d = new Date(), h = o.hora && /^\d{1,2}:/.test(o.hora) ? parseInt(o.hora, 10) : (o.f && o.f !== hoyStr() ? -1 : d.getHours());
    var x = { id: rid("v"), f: o.f || hoyStr(), h: h, t: o.t === "i" ? "i" : "g", cat: o.cat || "", c: String(o.c || "").slice(0, 80), m: Math.round(o.m), com: String(o.com || "").slice(0, 60) };
    if (o.o) x.o = o.o;
    if (o.cu) x.cu = String(o.cu).slice(0, 30);
    if (o.det && o.det.length) x.det = o.det.slice(0, 25).map(function (d) { return { n: String(d.n || "").slice(0, 40), q: String(d.q || "").slice(0, 12), m: Math.max(0, Math.round(d.m || 0)) }; });
    if (!(x.m > 0)) return null;
    if (x.t === "g" && state.prefs.redondeo) {
      var paso = state.prefs.redondeoA || 1000, rd = Math.ceil(x.m / paso) * paso - x.m;
      if (rd > 0) { x.rd = rd; var ka = x.f.slice(0, 7), al = state.alcancia[ka] || (state.alcancia[ka] = { j: 0, p: 0 }); al.j += rd; }
    }
    state.movs.push(x); if (state.movs.length > 1500) state.movs = state.movs.slice(-1500);
    setTimeout(function () { if (x.t === "g") sonarGasto(x.cat); else sonar("monedas"); }, 0);
    return x;
  }
  function quitarMov(x) {
    if (!x) return; var i = state.movs.indexOf(x); if (i > -1) state.movs.splice(i, 1);
    var al = x.rd && state.alcancia[x.f.slice(0, 7)]; if (al) al.j = Math.max(0, al.j - x.rd);
  }
  function marcarRegistro() { var h = hoyStr(); if (state.registros[state.registros.length - 1] !== h) state.registros.push(h); state.registros = state.registros.slice(-400); }
  function diasActivos() { var set = {}; state.actividad.concat(state.registros, state.sinGasto).forEach(function (d) { set[d] = 1; }); return set; }
  function simRacha() {
    var set = diasActivos(), dias = Object.keys(set).sort(), hoy = d0(), hs = hoyStr(hoy);
    var res = { actual: 0, max: 0, comodines: 0, congelados: {}, hoy: !!set[hs] };
    if (!dias.length) return res;
    var d = parseD(dias[0]), r = 0, com = 0, guard = 0;
    while (d <= hoy && guard++ < 800) {
      var s = hoyStr(d);
      if (set[s]) { r++; if (r % 7 === 0 && com < 2) com++; }
      else if (s !== hs) { if (r > 0 && com > 0) { com--; res.congelados[s] = 1; } else r = 0; }
      if (r > res.max) res.max = r;
      d.setDate(d.getDate() + 1);
    }
    res.actual = r; res.comodines = com;
    return res;
  }
  function mesAhorro(k) { var t = totalsOf(state.meses[k]); return t.ingReal > 0 && t.saldo >= 0 && t.ahorro > 0; }
  function rachaMeses() {
    var nk = nowKey(), ks = monthKeys().filter(function (k) { return k <= nk; }), max = 0, run = 0, prev = null;
    ks.forEach(function (k) {
      if (prev && addMonths(prev, 1) !== k) run = 0;
      if (mesAhorro(k)) { run++; if (run > max) max = run; } else if (k !== nk) run = 0;
      prev = k;
    });
    var n = 0, next = null;
    for (var i = ks.length - 1; i >= 0; i--) {
      var k = ks[i];
      if (next && addMonths(k, 1) !== next) break;
      if (mesAhorro(k)) n++; else if (k !== nk) break;
      next = k;
    }
    return { actual: n, max: max };
  }
  function rachaPagos() {
    var ev = [], hoy = d0();
    state.porPagar.forEach(function (b) {
      Object.keys(b.pagos).forEach(function (k) { var p = parseD(b.pagos[k]); if (p) ev.push({ due: occ(b, k), ok: p <= occ(b, k) }); });
      var e = estadoPago(b, hoy); if (!e.pagado && e.dias < 0) ev.push({ due: e.due, ok: false });
    });
    ev.sort(function (a, b) { return b.due - a.due; });
    var n = 0; while (n < ev.length && ev[n].ok) n++;
    var max = 0, run = 0; ev.slice().reverse().forEach(function (x) { if (x.ok) { run++; if (run > max) max = run; } else run = 0; });
    return { actual: n, max: max };
  }

  // --- Logros ---
  var LOGROS = [
    { id: "primer", ic: "i-sprout", n: "Primer paso", d: "Registra tu primer movimiento." },
    { id: "racha7", ic: "i-flame", n: "Semana encendida", d: "Lleva 7 días seguidos organizando tu plata." },
    { id: "racha30", ic: "i-trophy", n: "Mes imparable", d: "Lleva 30 días seguidos organizando tu plata." },
    { id: "cero3", ic: "i-snow", n: "Días en cero", d: "Marca 3 días sin gastos." },
    { id: "verde", ic: "i-check-circle", n: "Mes en verde", d: "Cierra un mes con saldo positivo y todas las categorías dentro del plan." },
    { id: "ahorro20", ic: "i-coins", n: "Club del 20 %", d: "Ahorra el 20 % o más de tus ingresos en un mes." },
    { id: "meses3", ic: "i-trend", n: "Tres en fila", d: "Ahorra 3 meses seguidos." },
    { id: "pagos5", ic: "i-cal", n: "Puntual", d: "Paga 5 cuentas seguidas a tiempo." },
    { id: "cuentas2", ic: "i-wallet", n: "Todo a la vista", d: "Registra al menos 2 cuentas de dinero." },
    { id: "meta", ic: "i-target", n: "Meta cumplida", d: "Completa una meta de ahorro." },
    { id: "reto10", ic: "i-piggy", n: "Alcancía en marcha", d: "Completa 10 semanas del reto de las 52 semanas." },
    { id: "deuda", ic: "i-feather", n: "Libre de una deuda", d: "Deja una deuda en cero." },
    { id: "redondeo", ic: "i-piggy", n: "Centavo a centavo", d: "Pasa a tu ahorro $ 20.000 juntados con el redondeo." },
    { id: "historia", ic: "i-chart", n: "Tu mes contado", d: "Mira las historias de un mes completo." },
    { id: "amigos", ic: "i-trophy", n: "Mejor en equipo", d: "Cumple todos los días de un reto con amigos." }
  ];
  // Colores de cada medalla (cinta y disco)
  var MEDALLA = { primer: ["#19c3a0", "#0f8f75"], racha7: ["#ff9f1c", "#e8590c"], racha30: ["#ffc53d", "#e0a420"], cero3: ["#4dabf7", "#1c7ed6"], verde: ["#40c057", "#2b8a3e"],
    ahorro20: ["#ffc53d", "#c98a00"], meses3: ["#7c5cff", "#5b3fd6"], pagos5: ["#ff5c9a", "#d6336c"], cuentas2: ["#22b8cf", "#1098ad"], meta: ["#f76707", "#c2410c"],
    reto10: ["#ff8fb8", "#e64980"], deuda: ["#94d82d", "#5c940d"], redondeo: ["#ffd43b", "#f08c00"], historia: ["#b197fc", "#7048e8"], amigos: ["#63e6be", "#0ca678"] };
  function medalla(l, ganado) {
    var c = MEDALLA[l.id] || ["#7c5cff", "#5b3fd6"], a = ganado ? c[0] : "#d9d5e4", b = ganado ? c[1] : "#b9b4c8";
    return '<svg class="medalla" viewBox="0 0 48 58" aria-hidden="true">' +
      '<path d="M15 31 9 55l7-4 4 6 5-20Z" fill="' + b + '"/><path d="M33 31l6 24-7-4-4 6-5-20Z" fill="' + b + '" opacity=".8"/>' +
      '<circle cx="24" cy="22" r="19" fill="' + b + '"/><circle cx="24" cy="21" r="17.5" fill="' + a + '"/>' +
      '<circle cx="24" cy="21" r="13.5" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" stroke-dasharray="1.6 2.4"/>' +
      (ganado ? '<path d="M12 13a14 14 0 0 1 9-6" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round" fill="none"/>' : "") +
      '<svg x="14" y="11" width="20" height="20" viewBox="0 0 24 24" class="ic" style="color:#fff;stroke-width:2.3"><use href="#' + (ganado ? l.ic : "i-lock") + '"/></svg></svg>';
  }
  function logrosGanados() {
    var r = simRacha(), m = rachaMeses(), p = rachaPagos(), g = {};
    var algo = monthKeys().some(function (k) { var x = state.meses[k]; return x.ingresos.some(function (i) { return i.real > 0; }) || x.gastos.some(function (i) { return i.real > 0; }); });
    var verde = false, a20 = false;
    monthKeys().forEach(function (k) {
      var t = totalsOf(state.meses[k]);
      if (t.ingReal > 0 && t.ahorro / t.ingReal >= 0.2) a20 = true;
      if (t.ingReal > 0 && t.saldo >= 0 && t.gasReal > 0 && Object.keys(t.byCat).every(function (id) { var x = t.byCat[id], c = catById(id) || { group: "gus" }; return c.group === "aho" || !x.plan || x.real <= x.plan; })) verde = true;
    });
    if (algo) g.primer = 1;
    if (r.max >= 7) g.racha7 = 1;
    if (r.max >= 30) g.racha30 = 1;
    if (state.sinGasto.length >= 3) g.cero3 = 1;
    if (verde) g.verde = 1;
    if (a20) g.ahorro20 = 1;
    if (m.max >= 3) g.meses3 = 1;
    if (p.max >= 5) g.pagos5 = 1;
    if (state.cuentas.length >= 2) g.cuentas2 = 1;
    if (state.metas.some(function (x) { return x.objetivo > 0 && x.ahorrado >= x.objetivo; })) g.meta = 1;
    if (state.reto.hechas.length >= 10) g.reto10 = 1;
    if (state.deudas.some(function (d) { return d.nombre && d.saldo === 0; })) g.deuda = 1;
    if (Object.keys(state.alcancia).reduce(function (s2, k) { return s2 + state.alcancia[k].p; }, 0) >= 20000) g.redondeo = 1;
    if (state.logros.indexOf("historia") > -1 || logroExtra.historia) g.historia = 1;
    if (state.logros.indexOf("amigos") > -1 || Object.keys(raCache).some(function (c) { var v = raCache[c], yo = v.participantes.find(function (p) { return p.yo; }); return yo && yo.cumplidos >= v.dias; })) g.amigos = 1;
    return g;
  }
  var logrosNuevos = {}, logroExtra = {};
  function checkLogros(silencio) {
    if (state.ejemplo) return;   // los datos de ejemplo no reparten logros
    if ($("dlg-inicio") && !$("dlg-inicio").hidden) return;   // durante el inicio guiado no se tapa el botón: se celebra al cerrar
    var g = logrosGanados(), vistos = {}, nuevos = [];
    state.logros.forEach(function (id) { vistos[id] = 1; });
    LOGROS.forEach(function (l) { if (g[l.id] && !vistos[l.id]) { nuevos.push(l); state.logros.push(l.id); } });
    if (!nuevos.length) return;
    if (!silencio) {
      nuevos.forEach(function (l) { logrosNuevos[l.id] = 1; });
      celebrar();
      toast('<span class="toast-ic">' + icono(nuevos[0].ic) + "</span> ¡Nuevo logro: <b>" + esc(nuevos[0].n) + "</b>!" + (nuevos.length > 1 ? " Y " + plural(nuevos.length - 1, "logro") + " más." : ""), { ms: 5200 });
    }
    renderRachas();
  }

  function renderRachas() {
    var r = simRacha(), m = rachaMeses(), p = rachaPagos();
    var dots = "", hoy = d0(), set = diasActivos();
    for (var i = 6; i >= 0; i--) {
      var d = new Date(hoy); d.setDate(d.getDate() - i); var s = hoyStr(d);
      var cls = set[s] ? "on" : r.congelados[s] ? "frz" : i === 0 ? "hoy" : "";
      dots += '<i class="' + cls + '" title="' + esc(fechaLarga(d)) + (set[s] ? ": activo" : r.congelados[s] ? ": salvado con un comodín" : "") + '">' + (r.congelados[s] ? icono("i-snow") : "") + "</i>";
    }
    $("rachas").innerHTML =
      '<div class="stk' + (r.actual ? " on" : " off") + '" style="--c:#ff9f1c"><span class="em" aria-hidden="true">' + icono("i-flame") + '</span><b>' + r.actual + "</b><span>" + (r.actual === 1 ? "día seguido" : "días seguidos") + " organizando tu plata</span>" +
        '<div class="week" aria-hidden="true">' + dots + "</div>" + (r.comodines ? '<span class="comodin" title="Cada 7 días de racha ganas un comodín (máximo 2). Si un día no entras, el comodín salva tu racha.">' + icono("i-snow") + ' ' + plural(r.comodines, "comodín").replace("comodíns", "comodines") + "</span>" : "") + "</div>" +
      '<div class="stk' + (m.actual ? "" : " off") + '" style="--c:#ffc53d"><span class="em" aria-hidden="true">' + icono("i-coins") + '</span><b>' + m.actual + "</b><span>" + (m.actual === 1 ? "mes ahorrando" : "meses seguidos ahorrando") + "</span></div>" +
      '<div class="stk' + (p.actual ? "" : " off") + '" style="--c:#7c5cff"><span class="em" aria-hidden="true">' + icono("i-cal") + '</span><b>' + p.actual + "</b><span>" + (p.actual === 1 ? "pago a tiempo" : "pagos seguidos a tiempo") + "</span></div>";
    var g = {}; state.logros.forEach(function (id) { g[id] = 1; });
    var n = LOGROS.filter(function (l) { return g[l.id]; }).length;
    $("logros-count").textContent = state.ejemplo ? "Con tus cifras ganas logros" : "Logros: " + n + " de " + LOGROS.length;
    // En vez de la cuadrícula con los pendientes en gris: el próximo logro con su avance, los ganados en color
    // y la lista completa solo si la persona la pide.
    var badge = function (l) {
      return '<button type="button" class="badge' + (g[l.id] ? "" : " off") + (logrosNuevos[l.id] ? " new" : "") + '" data-logro="' + l.id + '" title="' + esc(l.n + ". " + l.d) + '" aria-label="' + esc(l.n + (g[l.id] ? " (ganado)" : " (pendiente)") + ". " + l.d) + '">' + medalla(l, !!g[l.id]) + '<span class="bd-n">' + esc(l.n) + "</span></button>";
    };
    var prox = proximoLogro(g), ganados = LOGROS.filter(function (l) { return g[l.id]; });
    $("logros").innerHTML =
      (prox ? '<div class="prox-logro"><span class="pl-ic">' + medalla(prox.l, false).replace("i-lock", prox.l.ic) + '</span><div class="pl-tx"><small>Tu próximo logro</small><b>' + esc(prox.l.n) + "</b><span>" + esc(prox.l.d) + "</span>" +
        '<div class="pl-bar" role="progressbar" aria-label="Avance" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(prox.a * 100) + '"><i style="width:' + Math.max(4, Math.round(prox.a * 100)) + '%"></i></div></div></div>'
        : '<p class="pl-todos">' + icono("i-trophy") + " ¡Tienes todos los logros!</p>") +
      (ganados.length ? '<div class="badges-ganados" aria-label="Logros ganados">' + ganados.map(badge).join("") + "</div>" : "") +
      '<button type="button" class="link-btn pl-ver" data-ver-logros aria-expanded="' + (verLogros ? "true" : "false") + '">' + (verLogros ? "Ocultar la lista" : "Ver los " + LOGROS.length + " logros") + "</button>" +
      '<div class="badges"' + (verLogros ? "" : " hidden") + ">" + LOGROS.map(badge).join("") + "</div>";
  }
  var verLogros = false;
  // Cuánto falta para cada logro pendiente (0 a 1); el próximo es el que va más adelantado.
  function avanceLogro(id) {
    var r = simRacha(), m = rachaMeses(), p = rachaPagos(), mejor = 0;
    switch (id) {
      case "racha7": return r.actual / 7;
      case "racha30": return r.actual / 30;
      case "cero3": return state.sinGasto.length / 3;
      case "ahorro20":
        monthKeys().forEach(function (k) { var t = totalsOf(state.meses[k]); if (t.ingReal > 0) mejor = Math.max(mejor, t.ahorro / t.ingReal / 0.2); });
        return mejor;
      case "meses3": return m.actual / 3;
      case "pagos5": return p.actual / 5;
      case "cuentas2": return state.cuentas.length / 2;
      case "meta": state.metas.forEach(function (x) { if (x.objetivo > 0) mejor = Math.max(mejor, x.ahorrado / x.objetivo); }); return mejor;
      case "reto10": return state.reto.hechas.length / 10;
      case "redondeo": return Object.keys(state.alcancia).reduce(function (s2, k) { return s2 + state.alcancia[k].p; }, 0) / 20000;
      default: return 0;
    }
  }
  function proximoLogro(g) {
    var mejor = null;
    LOGROS.forEach(function (l) {
      if (g[l.id]) return;
      var a = Math.max(0, Math.min(0.99, avanceLogro(l.id) || 0));
      if (!mejor || a > mejor.a) mejor = { l: l, a: a };
    });
    return mejor;
  }
  $("logros").addEventListener("click", function (e) {
    if (e.target.closest("[data-ver-logros]")) { verLogros = !verLogros; renderRachas(); return; }
    var b = e.target.closest("[data-logro]"); if (!b) return;
    var l = LOGROS.find(function (x) { return x.id === b.dataset.logro; }), ok = state.logros.indexOf(l.id) > -1;
    delete logrosNuevos[l.id]; b.classList.remove("new");
    toast('<span class="toast-ic">' + icono(l.ic) + "</span> <b>" + esc(l.n) + "</b>. " + esc(l.d) + (ok ? " ¡Ya lo tienes!" : ""), { ms: 4500 });
  });

  // --- Un solo aviso arriba a la vez ---
  // Cada aviso decide por su cuenta si aplica (atributo hidden); aquí solo se deja ver el más importante y los demás
  // esperan su turno (clase aviso-espera). Cuando el de arriba se cierra, aparece el siguiente. Primero lo que llegó
  // de los bancos; con datos de ejemplo, armar el presupuesto va antes que el recordatorio del día.
  var AVISOS_ORDEN = ["bandeja-banner", "example-notice", "nudge", "nudge-cuenta", "nudge-lectura"];
  function unAviso() {
    var ya = false;
    AVISOS_ORDEN.forEach(function (id) {
      var el = $(id); if (!el) return;
      var espera = ya && !el.hidden;
      el.classList.toggle("aviso-espera", espera);
      if (!el.hidden && !espera) ya = true;
    });
  }
  try {
    var obsAvisos = new MutationObserver(function () { unAviso(); });
    AVISOS_ORDEN.forEach(function (id) { if ($(id)) obsAvisos.observe($(id), { attributes: true, attributeFilter: ["hidden"] }); });
  } catch (e) {}

  // --- Recordatorio amable para registrar gastos espontáneos ---
  var NUDGE_KEY = "fintelligente-recordatorio";
  function renderNudge() {
    var h = hoyStr(), set = {}, cerrado = "";
    state.registros.concat(state.sinGasto).forEach(function (d) { set[d] = 1; });
    try { cerrado = localStorage.getItem(NUDGE_KEY) || ""; } catch (e) {}
    $("nudge").hidden = !(loaded && state.avisos.registro && new Date().getHours() >= 18 && !set[h] && cerrado !== h);
  }
  $("nudge-reg").addEventListener("click", function () { abrirRegistro("gasto"); });
  $("nudge-x").addEventListener("click", function () { try { localStorage.setItem(NUDGE_KEY, hoyStr()); } catch (e) {} renderNudge(); });
  $("nudge-no").addEventListener("click", function () {
    var antes = simRacha().actual, h = hoyStr();
    if (state.sinGasto.indexOf(h) < 0) state.sinGasto.push(h);
    state.sinGasto = state.sinGasto.slice(-400);
    changed(); renderNudge(); renderRachas();
    var mes = state.sinGasto.filter(function (d) { return d.slice(0, 7) === h.slice(0, 7); }).length;
    if (simRacha().actual > antes) celebrar();
    toast("Día en cero. Llevas " + plural(mes, "día") + " sin gastos este mes.");
  });

  // --- Aviso de pagos dentro de la app (máximo uno al día) ---
  var PAGOS_KEY = "fintelligente-aviso-pagos";
  function avisoPagosApp() {
    if (!state.avisos.pagos || !state.porPagar.length || state.ejemplo) return;
    var h = hoyStr(); try { if (localStorage.getItem(PAGOS_KEY) === h) return; } catch (e) {}
    var lst = pagosOrdenados().filter(function (x) { return !x.e.pagado && x.e.dias <= Math.max(x.b.aviso, 0); });
    if (!lst.length) return;
    try { localStorage.setItem(PAGOS_KEY, h); } catch (e) {}
    var x = lst[0], txt = x.e.dias < 0 ? "<b>" + esc(x.b.nombre) + "</b> está vencido." : x.e.dias === 0 ? "Hoy vence <b>" + esc(x.b.nombre) + "</b>." :
      "<b>" + esc(x.b.nombre) + "</b> vence " + (x.e.dias === 1 ? "mañana" : "en " + x.e.dias + " días") + ".";
    toast(txt + (x.b.monto > 0 ? " " + money(x.b.monto) : "") + (lst.length > 1 ? ", y " + plural(lst.length - 1, "pago") + " más." : ""), { action: "Ver", ms: 8000, onAction: function () { irA("cuentas"); } });
  }

  // --- Reto de las 52 semanas ---
  var retoBase = 5000;
  function renderReto() {
    var r = state.reto, body = $("reto-body");
    if (!r.inicio) {
      body.innerHTML = '<p class="hint">Cada semana guardas un poco más que la anterior: en la semana 1 guardas una vez la base, en la 2, dos veces, y así hasta la 52. Al final reúnes <b>' + money(retoBase * 1378) + "</b>.</p>" +
        '<div class="seg" id="reto-base" role="group" aria-label="Base semanal">' + [2000, 5000, 10000].map(function (b) { return '<button type="button" data-base="' + b + '" aria-pressed="' + (b === retoBase) + '">' + money(b) + "</button>"; }).join("") + "</div>" +
        '<button class="btn primary" type="button" id="reto-go">Empezar el reto</button>';
      return;
    }
    var hechas = {}; r.hechas.forEach(function (n) { hechas[n] = 1; });
    var total = r.hechas.reduce(function (s, n) { return s + n * r.base; }, 0), meta = r.base * 1378;
    var sem = clamp(Math.floor(diasEntre(parseD(r.inicio), d0()) / 7) + 1, 1, 52), cells = "";
    for (var n = 1; n <= 52; n++) cells += '<button type="button" data-sem="' + n + '" class="' + (hechas[n] ? "done" : "") + (n === sem ? " now" : "") + '" aria-pressed="' + !!hechas[n] + '" title="Semana ' + n + ": " + money(n * r.base) + '">' + n + "</button>";
    body.innerHTML = '<div class="reto-top"><span>Llevas <b>' + money(total) + "</b> de " + money(meta) + '</span><span>Semana ' + sem + ": te toca guardar <b>" + money(sem * r.base) + "</b></span></div>" +
      '<div class="bar" role="img" aria-label="' + pctf(total / meta) + ' del reto"><div class="fill" style="width:' + (total / meta * 100).toFixed(1) + '%"></div></div>' +
      '<div class="reto-grid" id="reto-grid">' + cells + "</div>" +
      '<p class="hint">Toca cada semana cuando guardes su monto. ' + plural(r.hechas.length, "semana") + ' completada' + (r.hechas.length === 1 ? "" : "s") + '. <button class="link-btn" type="button" id="reto-reset">Reiniciar el reto</button></p>';
  }
  $("reto-body").addEventListener("click", function (e) {
    var b = e.target.closest("[data-base]");
    if (b) { retoBase = +b.dataset.base; renderReto(); return; }
    if (e.target.closest("#reto-go")) { state.reto = { base: retoBase, inicio: hoyStr(), hechas: [] }; changed(); renderReto(); toast("Reto iniciado. Esta semana guarda " + money(retoBase) + "."); return; }
    if (e.target.closest("#reto-reset")) {
      var rb = e.target.closest("#reto-reset");
      if (rb.dataset.armado !== "1") { rb.dataset.armado = "1"; rb.textContent = "¿Seguro? Toca otra vez"; return; }
      state.reto = { base: state.reto.base, inicio: "", hechas: [] }; changed(); renderReto(); return;
    }
    var c = e.target.closest("[data-sem]"); if (!c) return;
    var n = +c.dataset.sem, i = state.reto.hechas.indexOf(n);
    if (i > -1) state.reto.hechas.splice(i, 1);
    else {
      state.reto.hechas.push(n); marcarRegistro();
      var k = state.reto.hechas.length;
      if (k % 10 === 0 || k === 52) celebrar();
      toast("+" + money(n * state.reto.base) + " a tu alcancía." + (k === 52 ? " ¡Completaste el reto!" : ""));
    }
    changed(); renderReto(); renderRachas();
  });

  // --- Avisos ---
  var AV_KEY = "fintelligente-avisos", avDev = null, avTimer = null, avCfg = { vapid: "", correo: false };
  function randStr(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]; }).join(""); }
  function avLoad() {
    try { avDev = JSON.parse(localStorage.getItem(AV_KEY) || "null"); } catch (e) { avDev = null; }
    if (!avDev || !/^[a-z0-9]{20}$/.test(avDev.id || "")) avDev = { id: randStr(20), token: randStr(32), push: false, sub: null, email: "", correo: false, consejos: "semanal", hora: 20, registrado: false };
  }
  function avSave() { try { localStorage.setItem(AV_KEY, JSON.stringify(avDev)); } catch (e) {} }
  function avActivo() { return !!avDev && (!!(avDev.push && avDev.sub) || !!(avDev.correo && avDev.email)); }
  function avMsg(t, cls) { var el = $("av-msg"); el.textContent = t; el.className = "msg" + (cls ? " " + cls : ""); }
  function ultimoRegistro() { return state.registros.concat(state.sinGasto).sort().pop() || ""; }
  function avPayload() {
    return { id: avDev.id, token: avDev.token, push: avDev.push ? avDev.sub : null, email: avDev.correo ? avDev.email : "", licencia: licencia || null,
      tz: -new Date().getTimezoneOffset(), hora: avDev.hora, consejos: avDev.consejos, ultimo: ultimoRegistro(), efectivo: !!avDev.efectivo, manana: !!avDev.manana,
      dudas: Math.min(9, dudasVigentes().length), preguntar: avDev.preguntar !== false,
      pagos: state.porPagar.slice(0, 40).map(function (b) { return { n: b.nombre, m: b.monto, f: b.f, d: b.dia, fe: b.fecha, a: b.aviso, c: b.creado, p: Object.keys(b.pagos).sort().slice(-3) }; }) };
  }
  function huella(t) { var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return t.length + "." + h; }
  function syncAvisos(soloSiCambio) {
    if (!WEB || !avDev) return Promise.resolve({});
    if (!avActivo()) {
      if (!avDev.registrado) return Promise.resolve({ ok: true });
      return api("/api/avisos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: avDev.id, token: avDev.token }) })
        .then(function (j) { avDev.registrado = false; avSave(); return j; });
    }
    var cuerpo = JSON.stringify(avPayload()), hu = huella(cuerpo);
    if (soloSiCambio && avDev.registrado && avDev.huella === hu && Date.now() - (avDev.enviado || 0) < 86400000) return Promise.resolve({ ok: true, igual: true });
    return api("/api/avisos", { method: "POST", headers: { "Content-Type": "application/json" }, body: cuerpo })
      .then(function (j) { if (j.ok) { avDev.registrado = true; avDev.huella = hu; avDev.enviado = Date.now(); avSave(); } return j; });
  }
  function programarAvisos() { if (!WEB || !avActivo()) return; clearTimeout(avTimer); avTimer = setTimeout(function () { syncAvisos(true).catch(function () {}); }, 4000); }
  function b64u(s) { var p = "====".slice(0, (4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")), out = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out; }
  function esIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
  function instalada() { try { return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; } }
  function activarPush() {
    if (!avCfg.vapid) { avMsg("Las notificaciones todavía no están configuradas en este sitio.", "err"); return; }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      avMsg(esIOS() && !instalada() ? "En iPhone, primero instala la app. En Safari toca Compartir y luego Agregar a inicio. Abre Finti desde ese ícono y activa aquí las notificaciones." :
        "Este navegador no permite notificaciones. Prueba con Chrome, Edge, Firefox o Safari.", "err");
      return;
    }
    avMsg("Activando…");
    navigator.serviceWorker.register("/sw.js").then(function () { return Notification.requestPermission(); }).then(function (p) {
      if (p !== "granted") throw "permiso";
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(avCfg.vapid) }); });
    }).then(function (sub) {
      avDev.push = true; avDev.sub = JSON.parse(JSON.stringify(sub)); avSave();
      return syncAvisos();
    }).then(function (j) {
      if (j && j.ok) avMsg("¡Listo! Te enviamos una notificación de prueba.", "ok"); else avMsg((j && j.error) || "No se pudo registrar el aviso en el servidor.", "err");
      renderAvisos();
    }).catch(function (e) {
      avMsg(e === "permiso" ? "No diste permiso para notificaciones. Puedes darlo en la configuración del navegador y volver a intentarlo." : "No se pudieron activar las notificaciones.", "err");
    });
  }
  function desactivarPush() {
    var p = navigator.serviceWorker && navigator.serviceWorker.getRegistration ? navigator.serviceWorker.getRegistration() : Promise.resolve(null);
    p.then(function (r) { return r && r.pushManager.getSubscription(); }).then(function (s) { return s && s.unsubscribe(); }).catch(function () {}).then(function () {
      avDev.push = false; avDev.sub = null; avSave();
      return syncAvisos();
    }).then(function () { avMsg("Notificaciones apagadas.", "ok"); renderAvisos(); }, function () { renderAvisos(); });
  }
  function abrirAvisos() {
    $("menu-mas").hidden = true;
    avMsg("");
    renderAvisos();
    openDlg("dlg-avisos");
  }
  function renderAvisos() {
    $("av-registro").checked = !!state.avisos.registro;
    $("av-pagos").checked = !!state.avisos.pagos;
    $("av-web").hidden = !WEB; $("av-claude").hidden = WEB;
    if (!WEB) {
      $("av-gcal").innerHTML = state.porPagar.length ? state.porPagar.map(function (b) {
        return '<a class="btn" href="' + esc(gcalUrl(b)) + '" target="_blank" rel="noopener"><svg class="ic"><use href="#i-cal"/></svg> ' + esc(b.nombre) + "</a>";
      }).join("") : '<p class="empty">Primero agrega tus cuentas por pagar en la pestaña Cuentas.</p>';
      return;
    }
    if (!avDev) avLoad();
    $("av-push").textContent = avDev.push ? "Apagar notificaciones" : "Activar notificaciones";
    $("av-push").className = "btn" + (avDev.push ? "" : " primary");
    $("av-push-txt").textContent = esIOS() && !instalada() && !avDev.push ?
      "En iPhone funcionan cuando instalas la app. En Safari toca Compartir y luego Agregar a inicio. Ábrela desde ese ícono y actívalas aquí." :
      "Te llegan como las de cualquier app: pagos por vencer, un recordatorio suave si no has registrado nada y un consejo a la semana.";
    $("av-email").value = avDev.email || "";
    var prem = hasPremium();
    $("av-email").disabled = !prem;
    $("av-mail").textContent = !prem ? "Desbloquear con Premium" : avDev.correo ? "Apagar correo" : "Activar correo";
    Array.prototype.forEach.call($("av-consejos").querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === avDev.consejos)); });
    $("av-hora").value = String(avDev.hora);
    $("av-efectivo").checked = !!avDev.efectivo;
    $("av-preguntar").checked = avDev.preguntar !== false;
  }
  $("btn-avisos-menu").addEventListener("click", abrirAvisos);
  $("av-registro").addEventListener("change", function () { state.avisos.registro = this.checked; changed(); renderNudge(); });
  $("av-pagos").addEventListener("change", function () { state.avisos.pagos = this.checked; changed(); });
  $("av-ics").addEventListener("click", function () {
    if (!state.porPagar.length) { avMsg("Primero agrega tus cuentas por pagar en la pestaña Cuentas.", "err"); return; }
    descargar(new Blob([construirIcs()], { type: "text/calendar;charset=utf-8" }), "fintelligente-pagos.ics");
    avMsg("Calendario descargado. Ábrelo en tu celular para agregar los pagos con sus alarmas.", "ok");
  });
  $("av-push").addEventListener("click", function () { if (avDev.push) desactivarPush(); else activarPush(); });
  $("av-mail").addEventListener("click", function () {
    if (!hasPremium()) { closeDlg("dlg-avisos"); openPremium(); return; }
    if (avDev.correo) { avDev.correo = false; avSave(); syncAvisos().then(function () { avMsg("Avisos por correo apagados.", "ok"); renderAvisos(); }); return; }
    var em = $("av-email").value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { avMsg("Escribe un correo válido.", "err"); $("av-email").focus(); return; }
    avDev.email = em; avDev.correo = true; avSave(); avMsg("Activando…");
    syncAvisos().then(function (j) {
      if (j && j.ok) avMsg("¡Listo! Te enviamos un correo de confirmación a " + em + ".", "ok");
      else { avDev.correo = false; avSave(); avMsg((j && j.error) || "No se pudo activar el correo.", "err"); }
      renderAvisos();
    }, function () { avDev.correo = false; avSave(); avMsg("No hay conexión con el servidor.", "err"); renderAvisos(); });
  });
  $("av-consejos").addEventListener("click", function (e) { var b = e.target.closest("[data-v]"); if (!b) return; avDev.consejos = b.dataset.v; avSave(); renderAvisos(); programarAvisos(); });
  $("av-efectivo").addEventListener("change", function () {
    avDev.efectivo = this.checked; avSave(); programarAvisos();
    if (this.checked && !avActivo()) avMsg("Activa las notificaciones al celular para recibir la pregunta de cada noche.", "");
  });
  $("av-manana").addEventListener("change", function () {
    avDev.manana = this.checked; avSave(); programarAvisos(); guardarCupo();
    if (this.checked && !avActivo()) avMsg("Activa las notificaciones al celular para recibir el aviso de cada mañana.", "");
  });
  $("av-cifra").addEventListener("change", function () { avDev.cifra = this.checked; avSave(); guardarCupo(); });
  $("av-preguntar").addEventListener("change", function () { avDev.preguntar = this.checked; avSave(); programarAvisos(); });
  $("dudas-ver").addEventListener("click", abrirDudas);
  $("av-hora").addEventListener("change", function () { avDev.hora = clamp(+this.value || 20, 18, 20); avSave(); programarAvisos(); });
  function initAvisosWeb() {
    avLoad();
    if ("serviceWorker" in navigator) { try { navigator.serviceWorker.register("/sw.js").catch(function () {}); } catch (e) {} }
    configApp().then(function (j) { avCfg.vapid = j.vapidPublicKey || ""; avCfg.correo = !!j.correo; }, function () {});
    if (avActivo()) setTimeout(function () { syncAvisos(true).catch(function () {}); }, 2500);
  }

  function renderV5() { renderPagos(); renderPorPagar(); renderCuentas(); renderRachas(); renderNudge(); }
  function postLoad() {
    try { checkLogros(true); } catch (e) {}
    renderV5();
    if (WEB) { initAvisosWeb(); initBuzonWeb(); initCuenta(); }
    var hubo = importarDesdeEnlace();
    if (ACCION_INICIAL) hacerAccion(ACCION_INICIAL); else if (!hubo) setTimeout(avisoPagosApp, 1200);
  }

