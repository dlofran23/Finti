  // ===================== Para independientes =====================
  // 1. Tu sueldo fijo: con ingresos que cambian, te pagas lo mismo cada mes y el resto va a un colchón.
  // 2. Seguridad social: cuánto apartar para salud, pensión y ARL (IBC del 40 %; valores de 2026).
  // 3. Cuenta de cobro: documento listo para imprimir o guardar en PDF. Los datos quedan solo en este dispositivo.
  var SMMLV = 1750905, SMMLV_ANO = 2026, COBRO_KEY = "fintelligente-cobro";
  function ingresosMensuales() {
    return monthKeys().filter(function (k) { return k < keyOf(d0()); }).slice(-12).map(function (k) { return { k: k, v: totalsOf(state.meses[k]).ingReal }; }).filter(function (x) { return x.v > 0; });
  }
  function calcSueldo() {
    var l = ingresosMensuales(), m = cur(), t = totalsOf(m), fijos = t.byGroup.nec || t.gasPlan * 0.5;
    if (l.length < 2) return { pocos: true, n: l.length, fijos: fijos };
    var vals = l.map(function (x) { return x.v; }).sort(function (a, b) { return a - b; });
    var prom = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length, bajos = vals.slice(0, Math.max(1, Math.ceil(vals.length / 2)));
    var sueldo = Math.floor(bajos.reduce(function (a, b) { return a + b; }, 0) / bajos.length / 10000) * 10000;
    return { n: l.length, prom: prom, min: vals[0], max: vals[vals.length - 1], sueldo: sueldo, fijos: fijos, colchon: Math.ceil(fijos * 3 / 10000) * 10000, esteMes: t.ingReal };
  }
  function pintarSueldo() {
    var r = calcSueldo(), h;
    if (r.pocos) h = "<p>Para calcular tu sueldo fijo necesito al menos 2 meses anteriores con ingresos registrados" + (r.n ? " (tengo " + r.n + ")" : "") + ". Mientras tanto, un buen punto de partida: págate lo que te entra en un mes flojo y aparta todo lo demás.</p>";
    else {
      var dif = r.esteMes - r.sueldo;
      h = '<div class="ind-cifra"><span>Págate cada mes</span><b>' + money(r.sueldo) + "</b><small>Es el promedio de tus meses más flojos de los últimos " + prMeses(r.n) + ".</small></div>" +
        "<ul class=\"pr-lista\"><li>Tus ingresos van de " + money(r.min) + " a " + money(r.max) + " (promedio " + money(Math.round(r.prom / 1000) * 1000) + ").</li>" +
        "<li>Tu colchón debería llegar a <b>" + money(r.colchon) + "</b>: tres meses de tus gastos necesarios.</li>" +
        (r.esteMes ? "<li>Este mes te han entrado " + money(r.esteMes) + ": " + (dif >= 0 ? "págate " + money(r.sueldo) + " y <b>aparta " + money(dif) + " al colchón</b>." : "págate tu sueldo completo <b>tomando " + money(-dif) + " del colchón</b>. Para eso está.") + "</li>" : "") + "</ul>";
    }
    $("ind-sueldo-res").innerHTML = h;
  }
  function calcSeguridad(ingreso, arl) {
    var ibc = Math.min(25 * SMMLV, Math.max(SMMLV, Math.round(ingreso * 0.4))), sal = ibc * 0.125, pen = ibc * 0.16, fsp = ibc >= 4 * SMMLV ? ibc * 0.01 : 0, ar = arl ? ibc * 0.00522 : 0;
    var r = function (v) { return Math.ceil(v / 100) * 100; };
    return { ibc: ibc, salud: r(sal), pension: r(pen), fsp: r(fsp), arl: r(ar), total: r(sal) + r(pen) + r(fsp) + r(ar), bajo: ingreso < SMMLV };
  }
  function pintarSeguridad() {
    var ing = parseMonto($("ind-ss-ing").value), arl = $("ind-ss-arl").checked, out = $("ind-ss-res");
    if (!ing) { out.innerHTML = ""; return; }
    var c = calcSeguridad(ing, arl);
    out.innerHTML = (c.bajo ? '<p class="pr-nota">Con ingresos menores a un salario mínimo, por lo general no estás obligado a cotizar como independiente. Confírmalo con tu contador.</p>' : "") +
      '<div class="ind-cifra"><span>Aparta al mes</span><b>' + money(c.total) + "</b><small>El " + prPct(c.total / ing) + " de lo que te entra.</small></div>" +
      '<table class="ind-tabla"><tr><td>Ingreso base de cotización (40 %' + (c.ibc === SMMLV ? ", mínimo un salario" : "") + ")</td><td>" + money(c.ibc) + "</td></tr>" +
      "<tr><td>Salud (12,5 %)</td><td>" + money(c.salud) + "</td></tr><tr><td>Pensión (16 %)</td><td>" + money(c.pension) + "</td></tr>" +
      (c.fsp ? "<tr><td>Fondo de solidaridad pensional (1 %)</td><td>" + money(c.fsp) + "</td></tr>" : "") +
      (arl ? "<tr><td>ARL, riesgo I (0,522 %)</td><td>" + money(c.arl) + "</td></tr>" : "") + "</table>" +
      '<p class="pr-nota">Cálculo de referencia con el salario mínimo de ' + SMMLV_ANO + " (" + money(SMMLV) + "). El valor exacto lo da tu planilla PILA; tu contador puede ayudarte con costos deducibles.</p>";
  }
  // Cifras en letras para la cuenta de cobro: 1.250.000 → "un millón doscientos cincuenta mil pesos"
  function enLetras(n) {
    n = Math.floor(Math.abs(n));
    var U = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
    var D = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
    var C = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
    function cien(x) { if (x === 100) return "cien"; var c = Math.floor(x / 100), r = x % 100, s = C[c]; if (r) s += (s ? " " : "") + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? " y " + U[r % 10] : "")); return s; }
    function un(t) { return t.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un"); }
    function mil(x) { var m = Math.floor(x / 1000), r = x % 1000, s = m ? (m === 1 ? "" : un(cien(m)) + " ") + "mil " : ""; if (r) s += cien(r); return s.trim(); }
    if (!n) return "cero pesos";
    if (n === 1) return "un peso";
    var mm = Math.floor(n / 1e6), r = n % 1e6, s = mm ? (mm === 1 ? "un millón" : un(mil(mm)) + " millones") : "";
    if (r) s += (s ? " " : "") + un(mil(r));
    return s + (r === 0 && mm ? " de pesos" : " pesos");
  }
  function leerCobro() { try { return JSON.parse(localStorage.getItem(COBRO_KEY) || "{}"); } catch (e) { return {}; } }
  var COBRO_CAMPOS = ["nombre", "doc", "ciudad", "tel", "correo", "cliente", "clienteDoc", "banco", "cuenta"];
  function abrirIndep(tab) {
    $("menu-mas").hidden = true;
    var d = leerCobro();
    COBRO_CAMPOS.forEach(function (c) { $("cc-" + c).value = d[c] || ""; });
    $("cc-num").value = d.num ? d.num + 1 : 1; $("cc-iva").checked = d.iva !== false;
    var r = calcSueldo(); if (!$("ind-ss-ing").value) $("ind-ss-ing").value = r.prom ? "$ " + fmtMiles(Math.round(r.prom / 1000) * 1000) : (totalsOf(cur()).ingPlan ? "$ " + fmtMiles(totalsOf(cur()).ingPlan) : "");
    pintarSueldo(); pintarSeguridad(); indTab(tab || "sueldo");
    openDlg("dlg-indep", "#ind-tabs [aria-selected=true]");
  }
  function indTab(t) {
    [].forEach.call(document.querySelectorAll("#ind-tabs [data-tab]"), function (b) { b.setAttribute("aria-selected", b.dataset.tab === t ? "true" : "false"); });
    [].forEach.call(document.querySelectorAll("#dlg-indep [data-panel]"), function (p) { p.hidden = p.dataset.panel !== t; });
  }
  $("ind-tabs").addEventListener("click", function (e) { var b = e.target.closest("[data-tab]"); if (b) indTab(b.dataset.tab); });
  $("ind-ss-ing").addEventListener("input", function () { var v = parseMonto(this.value); this.value = v ? "$ " + fmtMiles(v) : ""; pintarSeguridad(); });
  $("ind-ss-arl").addEventListener("change", pintarSeguridad);
  $("cc-valor").addEventListener("input", function () { var v = parseMonto(this.value); this.value = v ? "$ " + fmtMiles(v) : ""; $("cc-letras").textContent = v ? cap(enLetras(v)) + "." : ""; });
  $("cc-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var d = {}, msg = $("cc-msg");
    COBRO_CAMPOS.forEach(function (c) { d[c] = $("cc-" + c).value.trim().slice(0, 120); });
    var valor = parseMonto($("cc-valor").value), concepto = $("cc-concepto").value.trim().slice(0, 600), num = Math.max(1, Math.floor(+$("cc-num").value || 1));
    if (!d.nombre || !d.doc || !d.cliente || !concepto || !valor) { msg.textContent = "Completa tu nombre y documento, el cliente, el concepto y el valor."; msg.className = "msg err"; return; }
    d.num = num; d.iva = $("cc-iva").checked;
    try { localStorage.setItem(COBRO_KEY, JSON.stringify(d)); } catch (er) {}
    var hoy = new Date(), ciudad = d.ciudad || "";
    $("informe").innerHTML = '<div class="cobro">' +
      '<p class="cobro-fecha">' + esc(ciudad ? ciudad + ", " : "") + fechaLarga(hoy) + " de " + hoy.getFullYear() + "</p>" +
      '<h1>Cuenta de cobro n.º ' + num + "</h1>" +
      '<p class="cobro-cliente"><b>' + esc(d.cliente) + "</b>" + (d.clienteDoc ? "<br>NIT o C. C. " + esc(d.clienteDoc) : "") + "</p>" +
      "<p>Debe a:</p><p class=\"cobro-yo\"><b>" + esc(d.nombre) + "</b><br>C. C. o NIT " + esc(d.doc) + "</p>" +
      '<p>La suma de:</p><p class="cobro-valor"><b>' + money(valor) + "</b><br>" + esc(cap(enLetras(valor))) + ".</p>" +
      "<p>Por concepto de:</p><p class=\"cobro-concepto\">" + esc(concepto).replace(/\n/g, "<br>") + "</p>" +
      (d.banco || d.cuenta ? "<p>Favor consignar a: " + esc(d.banco) + (d.cuenta ? ", cuenta " + esc(d.cuenta) : "") + ".</p>" : "") +
      (d.iva ? "<p class=\"cobro-nota\">No soy responsable del impuesto sobre las ventas (IVA).</p>" : "") +
      '<div class="cobro-firma"><span></span><b>' + esc(d.nombre) + "</b><br>C. C. o NIT " + esc(d.doc) + (d.tel ? "<br>Tel. " + esc(d.tel) : "") + (d.correo ? "<br>" + esc(d.correo) : "") + "</div></div>";
    msg.textContent = ""; $("cc-num").value = num + 1;
    var titulo = document.title; document.title = "Cuenta de cobro " + num + " - " + d.cliente;
    document.body.classList.add("imprimiendo");
    var fin = function () { document.body.classList.remove("imprimiendo"); document.title = titulo; window.removeEventListener("afterprint", fin); };
    window.addEventListener("afterprint", fin);
    metrica("cobro", "dia");
    setTimeout(function () { try { window.print(); } catch (er) {} }, 60);
  });
  $("btn-indep-menu").addEventListener("click", function () { abrirIndep(); });
  window.FinIndep = { seguridad: calcSeguridad, letras: enLetras };

