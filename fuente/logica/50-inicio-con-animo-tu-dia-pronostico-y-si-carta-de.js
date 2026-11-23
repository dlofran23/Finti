  // ===================== Inicio con ánimo, Tu día, pronóstico, ¿Y si…?, carta del domingo y temporada =====================
  function horaTxt(h) { if (!(h >= 0)) return ""; if (h === 12) return "12:00 m."; var x = h % 12 || 12; return x + ":00 " + (h < 12 ? "a. m." : "p. m."); }
  // La moneda de la mascota crece con el ahorro del mes (de 0 al 30 %)
  function renderMascota(t, animo) {
    var p = t.ingReal > 0 ? Math.max(0, t.ahorro / t.ingReal) : 0, k = Math.min(1, p / 0.3), r = 0.55 + k * 0.75;
    $("ms-moneda").setAttribute("transform", "translate(" + (32 + k * 2).toFixed(1) + " " + (31 - k * 2).toFixed(1) + ") scale(" + r.toFixed(2) + ")");
    $("saludo").dataset.animo = animo;
    $("saludo").classList.toggle("ahorro-meta", p >= 0.2);
    $("saludo-mascota").setAttribute("aria-label", t.ingReal > 0 ? "Tu moneda crece con tu ahorro: va en " + pctf(p) + " de lo que entró." : "Tu moneda crece cuando ahorras.");
  }
  function esTemporada(d) { d = d || new Date(); return (d.getMonth() === 11) || (d.getMonth() === 0 && d.getDate() <= 6); }
  function aplicarTemporada() { root.classList.toggle("navidad", state.prefs.temporada !== false && esTemporada()); }
  $("f-temporada").addEventListener("change", function () { state.prefs.temporada = this.checked; aplicarTemporada(); changed(); });

  // --- Tu día: lo anotado hoy en orden y los pagos que vencen hoy ---
  function renderTuDia() {
    var box = $("tu-dia"), act = keyOf(new Date());
    box.hidden = state.mes !== act; if (box.hidden) return;
    var hs = hoyStr(), items = [], total = 0;
    state.movs.forEach(function (x) { if (x.f === hs) { items.push({ h: x.h, x: x }); if (x.t === "g") total += x.m; } });
    items.sort(function (a, b) { return (a.h >= 0 ? a.h : 99) - (b.h >= 0 ? b.h : 99); });
    var pagos = state.porPagar.filter(function (b) { var e = estadoPago(b); return !e.pagado && e.dias === 0; });
    var html = items.slice(-6).map(function (o) {
      var x = o.x, ing = x.t === "i", nom = x.c || (catById(x.cat) || { name: ing ? "Ingreso" : "Gasto" }).name;
      return '<li style="--c:' + (ing ? "var(--good)" : catColor(x.cat)) + '"><span class="td-h">' + (horaTxt(x.h) || "Hoy") + '</span><span class="td-n">' + esc(nom) +
        (x.com ? "<small>" + esc(x.com) + "</small>" : "") + '</span><b class="cifra' + (ing ? " pos" : "") + '">' + (ing ? "+" : "−") + money(x.m) + "</b></li>";
    }).join("");
    if (items.length > 6) html = '<li class="td-mas"><span class="td-h"></span><span class="td-n">Y ' + pl2(items.length - 6, "movimiento más", "movimientos más") + " antes</span></li>" + html;
    html += pagos.map(function (b) { return '<li class="td-pago" style="--c:var(--warn)"><span class="td-h">Vence hoy</span><span class="td-n">' + esc(b.nombre || "Pago") + '</span><b class="cifra">' + money(b.monto || 0) + "</b></li>"; }).join("");
    if (!items.length) html = '<li class="td-vacio" style="--c:var(--line)"><span class="td-h">' + horaTxt(new Date().getHours()) + '</span><span class="td-n">Aún no anotas nada hoy. <button class="link-btn" type="button" id="td-anotar">Cuéntame un gasto</button></span></li>' + html;
    $("td-linea").innerHTML = html;
    $("td-total").textContent = total ? "Gastaste " + money(total) : "";
  }
  $("td-linea").addEventListener("click", function (e) { if (e.target.closest("#td-anotar")) abrirCharla(); });

  // --- Pronóstico: a este ritmo, ¿cómo cierra el mes? ---
  function pronostico(t) {
    var hoy = new Date(), act = keyOf(hoy); if (state.mes !== act) return null;
    var dias = dim(hoy.getFullYear(), hoy.getMonth() + 1), d = hoy.getDate();
    var ing = Math.max(t.ingReal, t.ingPlan); if (!(ing > 0) || !(t.gasReal > 0)) return null;
    var flexR = 0, fijosPend = 0;
    cur().gastos.forEach(function (r) {
      var g = (catById(r.cat) || { group: "gus" }).group;
      if (r.dia || g === "aho") fijosPend += Math.max(0, r.plan - r.real); else flexR += r.real;
    });
    var ritmo = flexR / d, proy = t.gasReal + ritmo * (dias - d) + fijosPend;
    // Gasto acumulado por día: lo anotado con fecha; lo que se escribió directo en la tabla cuenta desde el día 1
    var porDia = new Array(dias + 1).fill(0), conFecha = 0;
    state.movs.forEach(function (x) { if (x.t === "g" && (x.f || "").slice(0, 7) === act) { var dd = +x.f.slice(8, 10); if (dd <= d) { porDia[dd] += x.m; conFecha += x.m; } } });
    porDia[1] += Math.max(0, t.gasReal - conFecha);
    var acum = [0], a = 0; for (var i = 1; i <= d; i++) { a += porDia[i]; acum.push(a); }
    return { ing: ing, proy: proy, cierre: ing - proy, dias: dias, d: d, acum: acum, ritmo: ritmo, real: t.gasReal };
  }
  var PRON = null;
  function renderPron(t) {
    var P = pronostico(t), box = $("pron"); PRON = P;
    box.hidden = !P || P.d < 3; if (box.hidden) return;
    $("pron-frase").innerHTML = P.cierre >= 0 ? "Si sigues a este ritmo, cierras el mes con <b>" + money(redondeoMil(P.cierre)) + "</b> disponibles."
      : "A este ritmo te faltarían <b>" + money(redondeoMil(-P.cierre)) + "</b> al cierre. Bajar un poco el día a día lo arregla.";
    box.dataset.tono = P.cierre >= 0 ? "bien" : "ojo";
    var W = 320, H = 150, L = 8, R2 = 10, T = 14, B = 22, max = Math.max(P.ing, P.proy) * 1.08;
    var X = function (dd) { return L + (dd - 0) / P.dias * (W - L - R2); }, Y = function (v) { return T + (1 - v / max) * (H - T - B); };
    var real = P.acum.map(function (v, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); }).join("");
    var area = real + "L" + X(P.d).toFixed(1) + " " + Y(0).toFixed(1) + "L" + X(0) + " " + Y(0).toFixed(1) + "Z";
    var svg = '<line x1="' + L + '" x2="' + (W - R2) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" class="pr-eje"/>' +
      '<line x1="' + L + '" x2="' + (W - R2) + '" y1="' + Y(P.ing).toFixed(1) + '" y2="' + Y(P.ing).toFixed(1) + '" class="pr-ing"/>' +
      '<path d="' + area + '" class="pr-area"/><path d="' + real + '" class="pr-real"/>' +
      '<path d="M' + X(P.d).toFixed(1) + " " + Y(P.real).toFixed(1) + "L" + X(P.dias).toFixed(1) + " " + Y(P.proy).toFixed(1) + '" class="pr-proy' + (P.cierre < 0 ? " ojo" : "") + '"/>' +
      '<circle cx="' + X(P.d).toFixed(1) + '" cy="' + Y(P.real).toFixed(1) + '" r="4.5" class="pr-hoy"/>' +
      '<circle cx="' + X(P.dias).toFixed(1) + '" cy="' + Y(P.proy).toFixed(1) + '" r="4" class="pr-fin' + (P.cierre < 0 ? " ojo" : "") + '"/>' +
      '<text x="' + X(P.d).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="pr-tx">Hoy</text>' +
      '<text x="' + (W - R2) + '" y="' + (H - 6) + '" text-anchor="end" class="pr-tx">Día ' + P.dias + "</text>" +
      '<line id="pr-guia" x1="0" x2="0" y1="' + T + '" y2="' + Y(0).toFixed(1) + '" class="pr-guia" visibility="hidden"/>';
    $("pron-svg").innerHTML = svg;
    $("pron-svg").setAttribute("aria-label", "Llevas " + money(P.real) + " gastado al día " + P.d + ". Si sigues así, al día " + P.dias + " serían " + money(redondeoMil(P.proy)) + " de " + money(P.ing) + " que entran.");
    PRON.X = X; PRON.Y = Y; PRON.W = W;
  }
  (function () {
    var svg = $("pron-svg"), tip = $("pron-tip");
    function mover(e) {
      if (!PRON || !PRON.X) return;
      var r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * PRON.W;
      var dd = Math.max(1, Math.min(PRON.dias, Math.round((vx - 8) / (PRON.W - 18) * PRON.dias)));
      var v = dd <= PRON.d ? PRON.acum[dd] : PRON.real + (PRON.proy - PRON.real) * (dd - PRON.d) / Math.max(1, PRON.dias - PRON.d);
      var g = $("pr-guia"); g.setAttribute("x1", PRON.X(dd)); g.setAttribute("x2", PRON.X(dd)); g.setAttribute("visibility", "visible");
      tip.hidden = false; tip.innerHTML = "<b>Día " + dd + "</b>" + (dd <= PRON.d ? "Llevabas " : "Irías en ") + money(redondeoMil(v));
      tip.style.left = Math.max(0, Math.min(r.width - 150, e.clientX - r.left - 75)) + "px";
    }
    svg.addEventListener("pointermove", mover); svg.addEventListener("pointerdown", mover);
    svg.addEventListener("pointerleave", function () { tip.hidden = true; var g = $("pr-guia"); if (g) g.setAttribute("visibility", "hidden"); });
  })();

  // --- ¿Y si…?: recortar un gasto o hacer una compra, sin tocar los datos ---
  function abrirYsi(tab) {
    var t = totalsOf(cur()), op = [];
    Object.keys(t.byCat).forEach(function (id) { var c = catById(id); if (!c || c.group === "aho") return; var v = Math.max(t.byCat[id].plan, t.byCat[id].real); if (v > 0) op.push({ id: id, n: c.name, v: v }); });
    op.sort(function (a, b) { return b.v - a.v; });
    $("ysi-cat").innerHTML = op.map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.n) + " (" + money(o.v) + " al mes)</option>"; }).join("");
    var pref = op.find(function (o) { return /salid|ocio|domic|restaur/.test(o.id); }) || op[0];
    if (pref) $("ysi-cat").value = pref.id;
    ysiTab(tab || "r"); ysiRango(true); ysiCompra();
    openDlg("dlg-ysi", tab === "c" ? "#ysi-monto" : "#ysi-cat");
    metrica("ysi", "una");
  }
  function ysiTab(k) {
    $("ysi-tab-r").setAttribute("aria-selected", k === "r"); $("ysi-tab-c").setAttribute("aria-selected", k === "c");
    $("ysi-r").hidden = k !== "r"; $("ysi-c").hidden = k !== "c";
  }
  $("ysi-tab-r").addEventListener("click", function () { ysiTab("r"); });
  $("ysi-tab-c").addEventListener("click", function () { ysiTab("c"); $("ysi-monto").focus(); });
  function ysiRango(reset) {
    var t = totalsOf(cur()), id = $("ysi-cat").value, x = t.byCat[id] || { plan: 0, real: 0 }, base = Math.max(x.plan, x.real), rg = $("ysi-rango");
    var paso = base > 2e6 ? 50000 : base > 400000 ? 10000 : 5000;
    rg.step = paso; rg.max = Math.max(paso, Math.floor(base / paso) * paso);
    if (reset) rg.value = Math.max(paso, Math.round(base * 0.2 / paso) * paso);
    var v = +rg.value; $("ysi-rango-v").textContent = money(v);
    rg.setAttribute("aria-valuetext", money(v) + " al mes");
    var tiles = [[3, "En 3 meses"], [6, "En 6 meses"], [12, "En un año"]].map(function (q) { return '<div><b class="cifra">' + money(v * q[0]) + "</b><span>" + q[1] + "</span></div>"; }).join("");
    var extra = "", pAho = t.ingReal > 0 ? (t.ahorro + v) / t.ingReal : 0;
    if (t.ingReal > 0) extra += "<p>Tu ahorro pasaría de <b>" + pctf(Math.max(0, t.ahorro / t.ingReal)) + "</b> a <b>" + pctf(pAho) + "</b> de lo que entra.</p>";
    var meta = state.metas.find(function (g) { return g.objetivo > g.ahorrado; });
    if (meta && v > 0) { var falta = meta.objetivo - meta.ahorrado, n = Math.ceil(falta / v); extra += "<p>Con solo esto, completarías tu meta " + esc(meta.nombre || "") + " en <b>" + pl2(n, "mes", "meses") + "</b>.</p>"; }
    $("ysi-res-r").innerHTML = '<div class="ysi-tiles">' + tiles + "</div>" + extra;
  }
  $("ysi-cat").addEventListener("change", function () { ysiRango(true); });
  $("ysi-rango").addEventListener("input", function () { ysiRango(false); });
  function ysiCompra() {
    var raw = $("ysi-monto").value, v = prMonto(nrm(raw)) || +String(raw).replace(/\D/g, "") || 0, out = $("ysi-res-c");
    if (!(v > 0)) { out.innerHTML = '<p class="ysi-nota">Escribe el precio y te digo cómo queda tu mes.</p>'; return; }
    var t = totalsOf(cur()), h = hoyPuedes(t), html = "";
    if (h && h.plan) {
      var antes = Math.max(0, h.resto) / h.quedan, despues = Math.max(0, h.resto - v) / h.quedan;
      html += '<div class="ysi-tiles dos"><div><b class="cifra">' + money(redondeoMil(antes)) + '</b><span>Por día, hoy</span></div><div class="' + (despues < antes * 0.7 ? "ojo" : "") + '"><b class="cifra">' + money(redondeoMil(despues)) + "</b><span>Por día, si lo compras</span></div></div>";
    }
    var saldo = t.saldo - v;
    html += saldo >= 0 ? "<p>Te alcanza: el mes cerraría con <b>" + money(saldo) + "</b> disponibles.</p>" : "<p>Este mes no alcanza: faltarían <b>" + money(-saldo) + "</b>.</p>";
    if (saldo < 0 || (h && h.plan && h.resto - v < 0)) {
      var meses = Math.max(2, Math.ceil(v / Math.max(50000, t.saldo > 0 ? t.saldo : 50000)));
      html += "<p>Una idea: apartar <b>" + money(Math.ceil(v / meses / 1000) * 1000) + "</b> al mes y comprarlo en " + pl2(meses, "mes", "meses") + ", sin apretarte.</p>";
    }
    out.innerHTML = html;
  }
  $("ysi-monto").addEventListener("input", ysiCompra);
  $("pron-ysi").addEventListener("click", function () { abrirYsi("r"); });
  $("btn-ysi-menu").addEventListener("click", function () { cerrarMenu(); abrirYsi("r"); });

  // --- Carta del domingo: la semana contada como carta (domingo y lunes) ---
  function lunesDe(d) { d = d0(d); var w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return d; }
  function semanaGasto(ini) {
    var fin = new Date(ini); fin.setDate(fin.getDate() + 7);
    var tot = 0, cats = {}, dias = {}, n = 0;
    state.movs.forEach(function (x) { var f = parseD(x.f); if (!f || f < ini || f >= fin) return; dias[x.f] = 1; if (x.t !== "g") return; tot += x.m; n++; cats[x.cat] = (cats[x.cat] || 0) + x.m; });
    state.registros.concat(state.sinGasto || []).forEach(function (s2) { var f = parseD(s2); if (f && f >= ini && f < fin) dias[s2] = 1; });
    var top = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; })[0];
    return { tot: tot, n: n, top: top, topV: top ? cats[top] : 0, dias: Object.keys(dias).length };
  }
  function cartaSemana(forzar) {
    var hoy = new Date(), dw = hoy.getDay();
    if (!forzar && dw !== 0 && dw !== 1) return null;
    var ini = lunesDe(hoy); if (dw === 1 || (forzar && dw !== 0 && dw !== 1)) ini.setDate(ini.getDate() - 7);
    var prev = new Date(ini); prev.setDate(prev.getDate() - 7);
    var S = semanaGasto(ini), A = semanaGasto(prev), id = hoyStr(ini);
    if (!forzar && (state.prefs.cartaVista === id || (!S.n && !S.dias))) return null;
    var p = [];
    if (S.n) {
      var dif = A.tot - S.tot;
      p.push("Esta semana gastaste <b>" + money(S.tot) + "</b>" + (A.n ? (dif > 0 ? ", <b>" + money(dif) + " menos</b> que la semana anterior. ¡Qué buen ritmo!" : dif < 0 ? ", " + money(-dif) + " más que la anterior. Pasa; la próxima la equilibramos." : ", igual que la anterior: constancia pura.") : "."));
      if (S.top) p.push("Lo que más se llevó fue " + esc((catById(S.top) || { name: "Otros" }).name) + ", con " + money(S.topV) + ".");
    } else p.push("Esta semana no anotaste gastos. Si de verdad no gastaste, ¡felicitaciones!");
    p.push(S.dias >= 6 ? "Anotaste " + S.dias + " de 7 días: tu constancia es admirable." : S.dias >= 3 ? "Anotaste " + S.dias + " de 7 días. Un minuto al día y llegas a los 7." : "Esta semana que viene, ¿probamos anotar algo cada día? Un minuto basta.");
    var t = totalsOf(cur()), h = hoyPuedes(t);
    if (h && h.plan && h.resto > 0) p.push("Para lo que queda del mes tienes " + money(redondeoMil(h.resto / Math.max(1, h.quedan))) + " por día para el día a día.");
    var f1 = new Date(ini), f2 = new Date(ini); f2.setDate(f2.getDate() + 6);
    return { id: id, k: "Semana del " + f1.getDate() + " al " + f2.getDate() + " de " + MESES[f2.getMonth()].toLowerCase(), html: p.map(function (x) { return "<p>" + x + "</p>"; }).join("") };
  }
  function renderCarta(forzar) {
    var c = cartaSemana(forzar), box = $("carta");
    box.hidden = !c; if (!c) return;
    box.dataset.forzada = forzar ? "1" : ""; $("carta-k").textContent = c.k; $("carta-cuerpo").innerHTML = c.html; box.dataset.id = c.id;
  }
  $("carta-ok").addEventListener("click", function () { state.prefs.cartaVista = $("carta").dataset.id; $("carta").hidden = true; $("carta").dataset.forzada = ""; changed(); toast("Nos vemos el próximo domingo."); });
  $("btn-carta-menu").addEventListener("click", function () { cerrarMenu(); irA("inicio"); renderCarta(true); setTimeout(function () { $("carta").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }); $("carta-ok").focus({ preventScroll: true }); }, 80); });

