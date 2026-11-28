  // ===================== Tu mes contado y Tu año: historias a pantalla completa =====================
  // Todo se calcula en el dispositivo. Al compartir se arma una imagen sin montos: solo porcentajes y logros.
  function resumenPeriodo(keys) {
    var ing = 0, gas = 0, aho = 0, porCat = {}, movsN = 0, mejor = null;
    keys.forEach(function (k) {
      var m = state.meses[k]; if (!m) return;
      var t = totalsOf(m); ing += t.ingReal; gas += t.gasReal; aho += t.ahorro;
      Object.keys(t.byCat).forEach(function (c) { var o = porCat[c] || (porCat[c] = { id: c, real: 0, plan: 0 }); o.real += t.byCat[c].real; o.plan += t.byCat[c].plan; });
      var pa = t.ingReal > 0 ? t.ahorro / t.ingReal : 0; if (t.ingReal > 0 && (!mejor || pa > mejor.p)) mejor = { k: k, p: pa };
    });
    state.movs.forEach(function (x) { if (keys.indexOf((x.f || "").slice(0, 7)) > -1) movsN++; });
    var cats = Object.keys(porCat).map(function (c) { return porCat[c]; }).filter(function (o) { return o.real > 0 && o.id !== "ahorro"; }).sort(function (a, b) { return b.real - a.real; });
    var gasSinAho = cats.reduce(function (s2, o) { return s2 + o.real; }, 0);
    // La estrella: la que más plata dejó sin gastar frente a su plan (sin contar Otros)
    var dentro = cats.filter(function (o) { return o.plan > 0 && o.real <= o.plan; });
    var estrellas = dentro.filter(function (o) { return o.id !== "otros"; }).sort(function (a, b) { return (b.plan - b.real) - (a.plan - a.real); });
    var dias = {}; state.registros.concat(state.actividad || []).forEach(function (d) { if (keys.indexOf(String(d).slice(0, 7)) > -1) dias[d] = 1; });
    var listaD = Object.keys(dias).sort(), racha = 0, r = 0, prev = null;
    listaD.forEach(function (d) { var x = parseD(d); r = prev && (x - prev) / 864e5 === 1 ? r + 1 : 1; racha = Math.max(racha, r); prev = x; });
    return { ing: ing, gas: gas, aho: aho, pAho: ing > 0 ? aho / ing : 0, cats: cats, total: gasSinAho, estrella: estrellas[0] || null, dentroN: dentro.length,
      conPlan: cats.filter(function (o) { return o.plan > 0; }).length, dias: listaD.length, racha: racha, movsN: movsN, mejor: mejor };
  }
  var HI = null;
  function pl2(n, uno, varios) { return n + " " + (n === 1 ? uno : varios); }
  function abrirHistoria(anio) {
    var keys, titulo, sub;
    if (anio) { var y = state.mes.slice(0, 4); keys = monthKeys().filter(function (k) { return k.slice(0, 4) === y; }); titulo = "Tu " + y; sub = "Tu año contado"; }
    else { keys = [state.mes]; var p = parseKey(state.mes); titulo = "Tu " + MESES[p.m - 1]; sub = "Tu mes contado"; }
    var R = resumenPeriodo(keys), escenas = [];
    var periodo = anio ? "este año" : "este mes";
    escenas.push({ c: "#2e5bff", h: '<div class="hi-logo">' + LOGO_VIVO + '</div><p class="hi-k">' + sub + '</p><h2 id="hi-t" class="hi-big">' + esc(titulo) + "</h2><p>" +
      (R.movsN ? "Anotaste " + plural(R.movsN, "movimiento") + (anio ? " en " + pl2(keys.length, "mes", "meses") : "") + ". Te cuento cómo te fue." : "Te cuento cómo te fue.") + "</p>" });
    if (R.cats.length) {
      var top = R.cats.slice(0, 4), C = 2 * Math.PI * 70, off = 0, svg = "";
      var resto = R.total - top.reduce(function (s2, o) { return s2 + o.real; }, 0);
      if (resto > 0) svg += '<circle cx="90" cy="90" r="70" fill="none" stroke="rgba(255,255,255,.32)" stroke-width="22" transform="rotate(-90 90 90)" stroke-dasharray="0 ' + C.toFixed(1) + '" data-d="' + Math.max(0, resto / R.total * C - 3).toFixed(1) + " " + C.toFixed(1) + '" stroke-dashoffset="' + (-(R.total - resto) / R.total * C).toFixed(1) + '"/>';
      top.forEach(function (o, i) { var len = o.real / R.total * C; svg += '<circle cx="90" cy="90" r="70" fill="none" stroke="' + catColor(o.id) + '" stroke-width="22" transform="rotate(-90 90 90)" stroke-dasharray="0 ' + C.toFixed(1) + '" data-d="' + Math.max(0, len - 3).toFixed(1) + " " + C.toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '" style="transition-delay:' + (0.2 + i * 0.3) + 's"/>'; off += len; });
      escenas.push({ c: catColor(top[0].id), h: '<p class="hi-k">En qué se fue tu plata</p><svg class="hi-anillo" viewBox="0 0 180 180" aria-hidden="true">' + svg + "</svg>" +
        '<ul class="hi-lista">' + top.map(function (o) { return '<li style="--c:' + catColor(o.id) + '"><i></i><span>' + esc((catById(o.id) || { name: "Otros" }).name) + "</span><b>" + pctf(o.real / R.total) + "</b></li>"; }).join("") + "</ul>" +
        "<p>" + esc((catById(top[0].id) || { name: "Otros" }).name) + " fue lo que más se llevó " + periodo + ".</p>" });
    }
    if (R.estrella) {
      var e = R.estrella, ne = (catById(e.id) || { name: "Otros" }).name, menos = 1 - e.real / e.plan;
      escenas.push({ c: catColor(e.id), h: '<p class="hi-k">Tu categoría estrella</p><div class="hi-estrella">' + catIcon(e.id) + '</div><h2 class="hi-big' + (ne.length > 9 ? " hi-largo" : "") + '">' + esc(ne) + "</h2><p>" +
        (menos > 0.01 ? "Gastaste " + pctf(menos) + " menos de lo que planeaste. ¡Eso es tener control!" : "Cerraste justo en lo planeado. ¡Precisión total!") + "</p>" +
        (R.dentroN > 1 ? '<p class="hi-peq">Y ' + pl2(R.dentroN - 1, "categoría más quedó", "categorías más quedaron") + " dentro del plan.</p>" : "") });
    }
    escenas.push({ c: "#ffc53d", tinta: "#14121f", h: '<p class="hi-k">Tu ahorro</p><div class="hi-monedas" aria-hidden="true"><i></i><i></i><i></i></div><h2 class="hi-big">' + pctf(R.pAho) + "</h2><p>" +
      (R.pAho >= 0.2 ? "de lo que entró quedó para ti. Superaste la meta del 20 %." : R.pAho > 0.05 ? "de lo que entró quedó para ti. Cada peso cuenta; vamos por más." : R.ing > 0 ? "de lo que entró quedó para ti. El próximo " + (anio ? "año" : "mes") + " lo subimos juntos." : "Cuando anotes lo que te entra, te digo cuánto ahorras.") + "</p>" +
      (anio && R.mejor ? '<p class="hi-peq">Tu mejor mes fue ' + esc(MESES[parseKey(R.mejor.k).m - 1]) + ".</p>" : "") });
    if (R.dias) escenas.push({ c: "#19c3a0", h: '<p class="hi-k">Tu constancia</p><h2 class="hi-big">' + R.dias + '</h2><p>' + (R.dias === 1 ? "día anotaste algo" : "días anotaste algo") + (anio ? " este año." : " este mes.") + "</p>" +
      (R.racha > 1 ? '<p class="hi-peq">Tu mejor racha: ' + pl2(R.racha, "día seguido", "días seguidos") + ".</p>" : '<p class="hi-peq">Anotar un poquito cada día es el secreto.</p>') });
    var lo = R.pAho >= 0.2 ? "Ahorraste más del 20 %." : R.estrella ? "Tuviste a raya " + (catById(R.estrella.id) || { name: "una categoría" }).name + "." : R.dias >= 10 ? "Fuiste constante: " + R.dias + " días anotando." : "Diste el primer paso: mirar tu plata de frente.";
    escenas.push({ c: "#ff5c9a", h: '<p class="hi-k">Lo mejor de ' + (anio ? "tu año" : "tu mes") + '</p><h2 class="hi-big hi-frase">' + esc(lo) + '</h2><div class="hi-acc"><button class="btn hi-btn" type="button" id="hi-compartir">Compartir sin montos</button>' +
      '<button class="link-btn hi-otra" type="button" id="hi-otra">Ver otra vez</button></div><p class="hi-peq">La imagen solo lleva porcentajes y logros, nunca tus cifras.</p>' });
    HI = { escenas: escenas, i: 0, R: R, titulo: titulo, sub: sub, anio: !!anio, t: null, foco: document.activeElement };
    $("hi-barras").innerHTML = escenas.map(function () { return "<span><i></i></span>"; }).join("");
    $("dlg-historia").hidden = false; document.body.classList.add("con-historia");
    hiMostrar(0); sonar("soplo");
    setTimeout(function () { $("hi-cerrar").focus(); }, 50);
    metrica(anio ? "historia_anio" : "historia_mes", "una");
  }
  var LOGO_VIVO = '<svg class="logo-vivo" viewBox="0 0 32 32" aria-hidden="true"><g class="lv-cuadro"><rect width="32" height="32" rx="9" fill="#2e5bff"/><path d="M10 23V9h11M10 16h8" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g><circle class="lv-moneda" cx="23" cy="21" r="2.6" fill="#ffc53d"/></svg>';
  var HI_MS = 5500;
  function hiMostrar(i) {
    if (!HI) return;
    HI.i = Math.max(0, Math.min(i, HI.escenas.length - 1));
    var e = HI.escenas[HI.i], box = $("dlg-historia");
    box.style.setProperty("--hc", e.c); box.style.setProperty("--ht", e.tinta || "#ffffff");
    $("hi-escena").innerHTML = '<div class="hi-in">' + e.h + "</div>";
    [].forEach.call($("hi-barras").children, function (b, k) { b.className = k < HI.i ? "lista" : k === HI.i ? "ahora" : ""; });
    var barra = $("hi-barras").children[HI.i].firstChild; barra.style.animationDuration = HI_MS + "ms";
    setTimeout(function () { [].forEach.call($("hi-escena").querySelectorAll("[data-d]"), function (c) { c.setAttribute("stroke-dasharray", c.dataset.d); }); }, 60);
    clearTimeout(HI.t);
    if (HI.i < HI.escenas.length - 1 && !reduceMotion) HI.t = setTimeout(function () { hiMostrar(HI.i + 1); }, HI_MS);
    if (HI.i === HI.escenas.length - 1) { setTimeout(function () { sonar("meta"); }, 300); if (!logroExtra.historia) { logroExtra.historia = 1; setTimeout(function () { checkLogros(); }, 900); } }
  }
  function cerrarHistoria() {
    if (!HI) return; clearTimeout(HI.t);
    var f = HI.foco; HI = null; $("dlg-historia").hidden = true; document.body.classList.remove("con-historia");
    try { if (f && f.focus) f.focus(); } catch (e) {}
  }
  $("hi-cerrar").addEventListener("click", cerrarHistoria);
  $("hi-sig").addEventListener("click", function () { if (HI.i < HI.escenas.length - 1) hiMostrar(HI.i + 1); });
  $("hi-ant").addEventListener("click", function () { hiMostrar(HI.i - 1); });
  // Mantener presionado pausa (como en las historias de las redes)
  $("hi-escena").addEventListener("pointerdown", function () { if (HI) { clearTimeout(HI.t); $("dlg-historia").classList.add("pausa"); } });
  document.addEventListener("pointerup", function () { if (HI && $("dlg-historia").classList.contains("pausa")) { $("dlg-historia").classList.remove("pausa"); if (HI.i < HI.escenas.length - 1 && !reduceMotion) HI.t = setTimeout(function () { hiMostrar(HI.i + 1); }, 2500); } });
  document.addEventListener("keydown", function (e) {
    if (!HI) return;
    if (e.key === "Escape") cerrarHistoria(); else if (e.key === "ArrowRight") $("hi-sig").click(); else if (e.key === "ArrowLeft") $("hi-ant").click();
  });
  $("hi-escena").addEventListener("click", function (e) {
    if (e.target.closest("#hi-otra")) return hiMostrar(0);
    if (e.target.closest("#hi-compartir")) return compartirHistoria();
  });
  // Imagen para compartir (1080 x 1920), sin montos
  function compartirHistoria() {
    var R = HI.R, cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1920;
    var x = cv.getContext("2d"), g = x.createLinearGradient(0, 0, 260, 1920);
    g.addColorStop(0, "#4a74ff"); g.addColorStop(.3, "#2e5bff"); g.addColorStop(.58, "#1838b8"); g.addColorStop(.82, "#0c1a5c"); g.addColorStop(1, "#09090b"); x.fillStyle = g; x.fillRect(0, 0, 1080, 1920);
    // La F de Finti de marca de agua, como en la banda de Inicio
    x.save(); x.strokeStyle = "rgba(255,255,255,.08)"; x.lineWidth = 46; x.lineCap = "round"; x.lineJoin = "round";
    x.beginPath(); x.moveTo(760, 1010); x.lineTo(760, 150); x.lineTo(1180, 150); x.moveTo(760, 580); x.lineTo(1060, 580); x.stroke(); x.restore();
    var rr = function (X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); };
    var gl = x.createLinearGradient(90, 110, 200, 220); gl.addColorStop(0, "#5c84ff"); gl.addColorStop(.45, "#2e5bff"); gl.addColorStop(1, "#1630b8");
    x.fillStyle = gl; rr(90, 110, 110, 110, 30); x.fill(); x.strokeStyle = "rgba(255,255,255,.25)"; x.lineWidth = 3; x.stroke(); x.strokeStyle = "#fff"; x.lineWidth = 11; x.lineCap = "round"; x.lineJoin = "round";
    x.beginPath(); x.moveTo(124, 190); x.lineTo(124, 140); x.lineTo(164, 140); x.moveTo(124, 165); x.lineTo(153, 165); x.stroke();
    x.fillStyle = "#ffc53d"; x.beginPath(); x.arc(169, 186, 9, 0, 7); x.fill();
    x.fillStyle = "#fff"; x.font = "700 46px Unbounded, sans-serif"; x.fillText("Finti", 225, 182);
    x.font = "600 44px Manrope, sans-serif"; x.globalAlpha = .85; x.fillText(HI.sub, 90, 360); x.globalAlpha = 1;
    // Cada texto se achica hasta caber en su espacio
    var cabe = function (txt, peso, tam, fam, ancho) { do { x.font = peso + " " + tam + "px " + fam; tam -= 2; } while (x.measureText(txt).width > ancho && tam > 16); };
    cabe(HI.titulo, 700, 120, "Unbounded, sans-serif", 900); x.fillText(HI.titulo, 90, 500);
    var y = 640;
    x.font = "600 42px Manrope, sans-serif"; x.fillText("En qué se fue mi plata", 90, y); y += 40;
    R.cats.slice(0, 4).forEach(function (o) {
      y += 90; var p = R.total ? o.real / R.total : 0;
      x.fillStyle = "rgba(255,255,255,.22)"; rr(90, y - 50, 900, 66, 33); x.fill();
      x.fillStyle = catColor(o.id); rr(90, y - 50, Math.max(66, 900 * p), 66, 33); x.fill();
      x.fillStyle = "#fff"; x.font = "700 38px Manrope, sans-serif"; x.fillText((catById(o.id) || { name: "Otros" }).name, 120, y - 5);
      x.textAlign = "right"; x.fillText(pctf(p), 965, y - 5); x.textAlign = "left";
    });
    y += 170;
    [["Ahorré", pctf(R.pAho)], ["Días anotando", String(R.dias)], ["Categorías en el plan", R.conPlan ? R.dentroN + " de " + R.conPlan : "–"]].forEach(function (k, i) {
      var X = 90 + i * 310; x.fillStyle = "rgba(255,255,255,.18)"; rr(X, y - 70, 280, 220, 36); x.fill();
      x.fillStyle = "#fff"; cabe(k[1], 700, 72, "Unbounded, sans-serif", 230); x.fillText(k[1], X + 30, y + 40);
      cabe(k[0], 600, 30, "Manrope, sans-serif", 230); x.fillText(k[0], X + 30, y + 110);
    });
    x.font = "600 36px Manrope, sans-serif"; x.globalAlpha = .9; x.fillText("Mi plata en orden, con Finti.", 90, 1780); x.globalAlpha = 1;
    cv.toBlob(function (blob) {
      if (!blob) return;
      var nombre = (HI && HI.anio ? "mi-año" : "mi-mes") + "-finti.png", file = null;
      try { file = new File([blob], nombre, { type: "image/png" }); } catch (e) {}
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: HI ? HI.sub : "Finti" }).catch(function () {}); return; }
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); toast("Listo: la imagen quedó descargada, sin montos.");
    }, "image/png");
  }
  $("hist-play").addEventListener("click", function () { abrirHistoria(false); });
  $("btn-historia-menu").addEventListener("click", function () { cerrarMenu(); abrirHistoria(false); });
  $("btn-anio-menu").addEventListener("click", function () { cerrarMenu(); abrirHistoria(true); });
  // El reproductor aparece cuando ya hay de qué contar: un mes pasado, o desde el día 20 con algo anotado
  function renderHistPlay() {
    var hoy = new Date(), act = keyOf(hoy), t = totalsOf(cur()), hay = t.gasReal > 0 || t.ingReal > 0;
    var anio = hoy.getMonth() === 11 || (hoy.getMonth() === 0 && hoy.getDate() <= 15);
    $("btn-anio-t").textContent = "Tu " + state.mes.slice(0, 4) + " contado";
    // Siempre a la vista (como en el prototipo), con lo que va del mes; se abre cuando ya hay de qué contar
    var listo = hay && !(state.mes === act && hoy.getDate() < 20 && !anio);
    // Solo aparece cuando hay algo que contar: a quien llegó hoy no le ocupa la pantalla (auditoría del 21 de noviembre)
    $("hist-play").hidden = !listo; $("hist-play").dataset.listo = listo ? "1" : ""; $("hist-play").dataset.hay = hay ? "1" : "";
    var p = parseKey(state.mes), dm = new Date(p.y, p.m, 0).getDate(), dia = state.mes === act ? hoy.getDate() : state.mes < act ? dm : 0;
    $("hist-play-fill").style.width = Math.round(dia / dm * 100) + "%";
    $("hist-play-t").textContent = anio && state.mes === act ? "Tu " + p.y + " contado" : "Tu " + MESES[p.m - 1] + " contado";
    $("hist-play-s").textContent = anio && state.mes === act ? "Tu año en historias" : listo ? "Cinco historias sobre tu mes" : state.mes === act ? dia + " de " + dm : "Sin movimientos";
    $("hist-play").dataset.anio = anio && state.mes === act ? "1" : "";
    // "Nuevo mes" solo cuando sirve: falta el mes de hoy o ya vienen los últimos días. Así el encabezado del celular respira.
    var ult = Object.keys(state.meses).sort().pop() || act;
    $("btn-nuevo-mes").hidden = !(!state.meses[act] || (ult === act && hoy.getDate() >= 25) || ult < act);
  }
  $("hist-play").addEventListener("click", function (e) {
    if (this.dataset.anio) { e.stopImmediatePropagation(); abrirHistoria(true); return; }
    if (!this.dataset.listo) { e.stopImmediatePropagation(); toast(this.dataset.hay ? "Tu mes contado estará listo desde el día 20. Sigue anotando." : "Tu mes contado se arma con lo que anotes este mes."); }
  }, true);

  // --- Te deben (pestaña Cuentas) ---
  function renderMeDeben() {
    var l = state.meDeben, dichos = leerDichos();
    $("td-pagaron").disabled = !l.length; $("tedeben-total").hidden = !l.length;
    $("tedeben-dichos").innerHTML = dichos.map(function (x) {
      return '<div class="td-dicho"><svg class="ic" aria-hidden="true"><use href="#i-chat"/></svg><span>Llegó del atajo: <b>' + esc(x.t) + '</b></span><button class="btn primary" type="button" data-dicho="' + esc(x.id) + '">Anotar</button><button class="icon-btn" type="button" data-dicho-no="' + esc(x.id) + '" aria-label="Descartar"><svg class="ic"><use href="#i-x"/></svg></button></div>';
    }).join("");
    if (!l.length) { $("tedeben-lista").innerHTML = dichos.length ? "" : '<p class="td-vacio">Nadie te debe plata. Cuando le prestes a alguien, anótalo aquí.</p>'; return; }
    var total = l.reduce(function (s, x) { return s + x.m; }, 0);
    $("tedeben-total").textContent = money(total);
    var porQuien = {};
    l.forEach(function (x) { (porQuien[x.quien] = porQuien[x.quien] || []).push(x); });
    $("tedeben-lista").innerHTML = Object.keys(porQuien).map(function (q) {
      var xs = porQuien[q], sum = xs.reduce(function (s, x) { return s + x.m; }, 0);
      return '<div class="td-fila"><span class="td-av" aria-hidden="true">' + esc(q.charAt(0).toUpperCase()) + '</span><div class="td-info"><b>' + esc(q) + "</b><small>" +
        xs.map(function (x) { return esc(x.c || "Me debe") + (x.f ? " · " + esc(chFechaTxt(x.f) || "hoy") : ""); }).join("; ") + '</small></div><b class="cifra td-m">' + money(sum) +
        '</b><button class="btn" type="button" data-pago="' + esc(q) + '">Me pagó</button><button class="icon-btn" type="button" data-borrar-q="' + esc(q) + '" aria-label="Borrar lo que te debe ' + esc(q) + '"><svg class="ic"><use href="#i-x"/></svg></button></div>';
    }).join("");
  }
  // Atajos para deudas con amigos: "Le presté a alguien" y "Me pagaron". Arman la frase y la pasan a Cuéntame,
  // que ya sabe anotarla en Te deben y preguntar de qué cuenta salió o a cuál entró la plata.
  var DD = "preste";
  function abrirDeuda(modo) {
    DD = modo === "pago" ? "pago" : "preste";
    var nombres = []; state.meDeben.forEach(function (x) { if (nombres.indexOf(x.quien) < 0) nombres.push(x.quien); });
    if (DD === "pago" && !nombres.length) { abrirDeuda("preste"); toast("Nadie te debe plata todavía"); return; }
    $("dd-t").textContent = DD === "pago" ? "Me pagaron" : "Le presté a alguien";
    $("dd-sub").textContent = DD === "pago" ? "Lo quito de lo que te deben" : "Te ayudo a recordar quién te debe";
    $("dd-quien").previousElementSibling.textContent = DD === "pago" ? "¿Quién te pagó?" : "¿A quién?";
    $("dd-monto").placeholder = DD === "pago" ? "Si fue todo, déjalo vacío" : "Ej.: $ 50.000";
    $("dd-quien").value = ""; $("dd-monto").value = ""; $("dd-msg").textContent = "";
    $("dd-nombres").innerHTML = nombres.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("");
    $("dd-chips").innerHTML = nombres.slice(0, 6).map(function (n) { return '<button type="button" class="chip-btn" data-n="' + esc(n) + '">' + esc(n) + "</button>"; }).join("");
    openDlg("dlg-deuda", "#dd-quien");
  }
  $("dd-chips").addEventListener("click", function (e) { var b = e.target.closest("[data-n]"); if (b) { $("dd-quien").value = b.dataset.n; $("dd-monto").focus(); } });
  $("dd-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var quien = $("dd-quien").value.trim().replace(/\s+/g, " "), m = $("dd-monto").value.trim();
    if (!quien) { $("dd-msg").textContent = DD === "pago" ? "Escribe quién te pagó." : "Escribe a quién le prestaste."; $("dd-msg").className = "msg err"; return; }
    if (/^[\d.\s$]+$/.test(m)) m = "$ " + m.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (DD === "preste" && !/\d/.test(m)) { $("dd-msg").textContent = "Escribe cuánto le prestaste."; $("dd-msg").className = "msg err"; return; }
    closeDlg("dlg-deuda");
    abrirCharla(DD === "pago" ? quien + " me pagó" + (/\d/.test(m) ? " " + m : "") : "le presté " + m + " a " + quien);
  });
  $("td-preste").addEventListener("click", function () { abrirDeuda("preste"); });
  $("tedeben-dichos").addEventListener("click", function (e) {
    var a = e.target.closest("[data-dicho]"), b = e.target.closest("[data-dicho-no]");
    if (b) return quitarDicho(b.dataset.dichoNo);
    if (a) { var x = leerDichos().filter(function (y) { return y.id === a.dataset.dicho; })[0]; quitarDicho(a.dataset.dicho); if (x) abrirCharla(x.t); }
  });
  $("td-pagaron").addEventListener("click", function () { abrirDeuda("pago"); });
  $("tedeben-lista").addEventListener("click", function (e) {
    var b = e.target.closest("[data-pago]");
    if (b) return abrirCharla(b.dataset.pago + " me pagó");
    var d = e.target.closest("[data-borrar-q]"); if (!d) return;
    var q = d.dataset.borrarQ;
    if (!confirm("¿Borrar lo que te debe " + q + "? No cambia el saldo de tus cuentas.")) return;
    state.meDeben = state.meDeben.filter(function (x) { return x.quien !== q; }); changed(); renderMeDeben();
  });

  // --- Palabras que aprendí ---
  function abrirAprendidas() { $("ap-buscar").value = ""; renderAprendidas(); renderNoEntendi(); openDlg("dlg-aprendidas", "#ap-buscar"); }
  // --- Frases que Finti no entendió: se guardan solo en el teléfono; salen únicamente si la persona las comparte ---
  function noEntendiGuardar(t, de) {
    t = String(t || "").trim().slice(0, 300); if (!t) return;
    state.noEntendi = state.noEntendi.filter(function (x) { return x.t !== t; }).concat([{ t: t, de: de === "pregunta" ? "pregunta" : "charla", f: hoyStr() }]).slice(-40);
    changed();
  }
  function renderNoEntendi() {
    var l = state.noEntendi;
    $("ne-sec").hidden = !l.length;
    $("ne-lista").innerHTML = l.slice().reverse().map(function (x, i) {
      return '<li><span>' + esc(x.t) + '<small>' + (x.de === "pregunta" ? "En Pregúntale" : "En Cuéntame un gasto") + (x.f ? " · " + (+x.f.slice(8)) + " de " + MESES[+x.f.slice(5, 7) - 1] : "") + '</small></span><button class="link-btn" type="button" data-ne-borrar="' + (l.length - 1 - i) + '" aria-label="Borrar esta frase">Borrar</button></li>';
    }).join("");
  }
  $("ne-lista").addEventListener("click", function (e) {
    var b = e.target.closest("[data-ne-borrar]"); if (!b) return;
    state.noEntendi.splice(+b.dataset.neBorrar, 1); changed(); renderNoEntendi();
  });
  $("ne-borrar").addEventListener("click", function () { var antes = state.noEntendi.slice(); state.noEntendi = []; changed(); renderNoEntendi(); toast("Borré las frases.", { action: "Deshacer", onAction: function () { state.noEntendi = antes; changed(); renderNoEntendi(); } }); });
  $("ne-compartir").addEventListener("click", function () {
    var txt = "Frases que Finti no entendió:\n" + state.noEntendi.map(function (x) { return "- " + x.t; }).join("\n");
    if (navigator.share) { navigator.share({ title: "Frases para mejorar Finti", text: txt }).catch(function () {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast("Copié las frases. Pégalas en tu mensaje por Ayuda y PQR."); }, function () { toast("No pude copiarlas. Selecciónalas en la lista y cópialas."); });
  });
  function renderAprendidas() {
    var q = prNorm($("ap-buscar").value || ""), ks = Object.keys(state.reglas).filter(function (k) { return catById(state.reglas[k]) && (!q || prNorm(k).indexOf(q) > -1); }).sort();
    $("ap-vacio").hidden = Object.keys(state.reglas).length > 0;
    var opciones = cats().map(function (c) { return [c.id, c.name]; });
    $("ap-lista").innerHTML = ks.slice(0, 300).map(function (k) {
      var cat = state.reglas[k];
      return '<div class="ap-fila" style="--c:' + catColor(cat) + '" data-k="' + esc(k) + '">' + catIcon(cat) + '<span class="ap-p">' + esc(k) + "</span>" +
        '<select class="field" aria-label="Categoría de ' + esc(k) + '">' + opciones.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cat ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>" +
        '<button class="icon-btn" type="button" data-quitar aria-label="Olvidar ' + esc(k) + '"><svg class="ic"><use href="#i-x"/></svg></button></div>';
    }).join("") || (q ? '<p class="hint">No encontré esa palabra.</p>' : "");
  }
  $("ap-buscar").addEventListener("input", renderAprendidas);
  $("ap-lista").addEventListener("change", function (e) {
    var f = e.target.closest("[data-k]"); if (!f || e.target.tagName !== "SELECT") return;
    state.reglas[f.dataset.k] = e.target.value; changed(); renderAprendidas();
  });
  $("ap-lista").addEventListener("click", function (e) {
    var f = e.target.closest("[data-quitar]") && e.target.closest("[data-k]"); if (!f) return;
    delete state.reglas[f.dataset.k]; changed(); renderAprendidas(); toast("Listo, la olvidé.");
  });
  $("btn-aprendidas-menu").addEventListener("click", function () { cerrarMenu(); abrirAprendidas(); });

  // --- Foto de la tirilla: se lee en el dispositivo con Tesseract (archivos propios en /ocr/). La foto no sale ni se guarda. ---
  var OCR = null;
  function ocrPosible() { return WEB && typeof WebAssembly === "object" && !!window.Worker; }
  function ocrCargar() {
    if (OCR) return OCR;
    OCR = new Promise(function (ok, mal) {
      if (window.Tesseract) return ok(window.Tesseract);
      var sc = document.createElement("script"); sc.src = "/ocr/tesseract.min.js"; sc.onload = function () { ok(window.Tesseract); }; sc.onerror = mal; document.head.appendChild(sc);
    }).then(function (T) {
      var simd = false;
      try { simd = WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) {}
      return T.createWorker("spa", 1, { workerPath: "/ocr/worker.min.js", corePath: "/ocr/tesseract-core-" + (simd ? "simd-" : "") + "lstm.js", langPath: "/ocr", workerBlobURL: false, gzip: true,
        logger: function (m) { if (m.status === "recognizing text" && $("ch-ocr-p")) $("ch-ocr-p").textContent = Math.round(m.progress * 100) + " %"; } });
    });
    OCR.catch(function () { OCR = null; });
    return OCR;
  }
  // Achica y pasa a grises: más rápido y lee mejor.
  function ocrImagen(file) {
    return new Promise(function (ok, mal) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var esc2 = Math.min(1, 1600 / Math.max(img.width, img.height)), cv = document.createElement("canvas");
        cv.width = Math.round(img.width * esc2); cv.height = Math.round(img.height * esc2);
        var cx = cv.getContext("2d"); cx.filter = "grayscale(1) contrast(1.3)"; cx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url); ok(cv);
      };
      img.onerror = function () { URL.revokeObjectURL(url); mal(new Error("imagen")); };
      img.src = url;
    });
  }
  // Lee el total, el comercio y la fecha de una tirilla o factura de Colombia.
  function leerTirilla(texto) {
    var lineas = String(texto || "").split(/\n+/).map(function (l) { return l.replace(/\s+/g, " ").trim(); }).filter(Boolean);
    function montos(l) {
      var out = [], re = /\$?\s?(\d{1,3}(?:[.,]\d{3})+|\d{4,8})(?:[.,](\d{2}))?(?!\d)/g, m;
      while ((m = re.exec(l))) { var v = +m[1].replace(/[.,]/g, ""); if (v >= 100 && v < 5e7) out.push(v); }
      return out;
    }
    var total = 0, mejor = -1;
    lineas.forEach(function (l, i) {
      var n = nrm(l);
      if (/sub ?total|total (items|articulos|unidades|cantidad)|iva|impuesto|propina sugerida|descuento|cambio|vueltas/.test(n)) return;
      var peso = /total a pagar|valor a pagar|neto a pagar|total factura/.test(n) ? 3 : /\btotal\b|vr\.? total|valor total/.test(n) ? 2 : /\b(efectivo|pago|a pagar)\b/.test(n) ? 1 : -1;
      if (peso < 0) return;
      var ms = montos(l); if (!ms.length && lineas[i + 1]) ms = montos(lineas[i + 1]);
      if (ms.length && peso >= mejor) { mejor = peso; total = Math.max.apply(null, ms); }
    });
    if (!total) { var todos = []; lineas.forEach(function (l) { todos = todos.concat(montos(l)); }); if (todos.length) total = Math.max.apply(null, todos); }
    var comercio = "";
    for (var i = 0; i < Math.min(5, lineas.length); i++) {
      var l = lineas[i], n = nrm(l);
      if ((l.match(/[a-záéíóúñ]/gi) || []).length >= 3 && !/\b(nit|factura|fecha|tel|telefono|dir|direccion|calle|cra|carrera|regimen|resolucion|cufe|caja|cajero|ticket)\b/.test(n)) { comercio = LECTOR.bonito(l.replace(/[^\wÁÉÍÓÚÑáéíóúñ&.\- ]/g, "").trim()).slice(0, 40); break; }
    }
    var f = "", fm = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(texto) || null, fi = /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/.exec(texto);
    var d = fi ? new Date(+fi[1], +fi[2] - 1, +fi[3]) : fm ? new Date(fm[3].length === 2 ? 2000 + +fm[3] : +fm[3], +fm[2] - 1, +fm[1]) : null;
    if (d && !isNaN(d) && d <= new Date() && (Date.now() - d) / 864e5 <= 60) f = hoyStr(d);
    return { m: total, c: comercio, f: f };
  }
  function chLeerFoto(file) {
    if (!file) return;
    chMsg("yo", "Foto de una tirilla");
    chMsg("app", 'Leyendo la tirilla aquí en tu teléfono… <span id="ch-ocr-p"></span>' + (OCR ? "" : '<p class="pr-nota">La primera vez descargo el lector (unos 8 MB). Después queda guardado.</p>'));
    Promise.all([ocrCargar(), ocrImagen(file)]).then(function (r) { return r[0].recognize(r[1]); }).then(function (res) {
      var t = leerTirilla(res && res.data ? res.data.text : "");
      if (!t.m && !t.c) { chMsg("app", "No pude leer bien la tirilla. Prueba con más luz y la tirilla derecha, o escríbeme el gasto."); return chInicioChips(); }
      var k = t.c ? chCategoria(prNorm(t.c)) : { cat: "" };
      if (!k.cat && t.c) { var l = LECTOR.sugerirCategoria({ comercio: t.c, tipo: "gasto" }, state.reglas); if (l.por) k.cat = l.cat; }
      // Con qué se pagó, si la tirilla lo dice (efectivo, crédito o débito, cuando hay una sola cuenta de ese tipo)
      var tx = nrm(res && res.data ? res.data.text : ""), cuT = "", unaDe = function (tipo) { var l = state.cuentas.filter(function (c) { return c.tipo === tipo; }); return l.length === 1 ? l[0].id : ""; };
      if (/\befectivo\b/.test(tx)) cuT = chEfectivoId(); else if (/\b(credito|visa|mastercard)\b/.test(tx)) cuT = unaDe("tarjeta"); else if (/\bdebito\b/.test(tx)) cuT = unaDe("banco");
      CH.items = [chItem({ t: "g", m: t.m, cat: k.cat, c: t.c || "Compra", f: t.f, cuenta: cuT })]; CH.idx = 0;
      chMsg("app", "Leí la tirilla" + (t.c ? " de <b>" + esc(t.c) + "</b>" : "") + ". Revisa que el total esté bien antes de anotarla.");
      chSiguiente();
    }).catch(function () { chMsg("app", "No pude abrir el lector de tirillas ahora. Escríbeme el gasto y lo anoto igual."); });
  }
  $("ch-cam").addEventListener("click", function () { $("ch-foto").value = ""; $("ch-foto").click(); });
  $("ch-foto").addEventListener("change", function () { var f = this.files && this.files[0]; this.value = ""; chLeerFoto(f); });

  // --- Voz, solo dentro del dispositivo ---
  var CH_SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var CH_IDIOMAS = ["es-CO", "es-419", "es-US", "es-MX", "es-ES"], chRec = null, chIdioma = null;
  function chVozApp() { return APP_ANDROID.activa && APP_ANDROID.v >= 9; }
  function chVozWeb() { return !!(CH_SR && typeof CH_SR.available === "function"); }
  function chVozPosible() { return chVozApp() || chVozWeb(); }
  function chBuscarIdioma(i) {
    if (i >= CH_IDIOMAS.length) return Promise.resolve(null);
    return CH_SR.available({ langs: [CH_IDIOMAS[i]], processLocally: true }).then(function (st) {
      return st === "unavailable" ? chBuscarIdioma(i + 1) : { lang: CH_IDIOMAS[i], st: st };
    }, function () { return chBuscarIdioma(i + 1); });
  }
  function chEscuchar(lang) {
    try {
      chRec = new CH_SR(); chRec.lang = lang; chRec.processLocally = true; chRec.interimResults = true; chRec.maxAlternatives = 1;
      // Una historia de mercado tiene pausas: se sigue escuchando hasta 3,5 s de silencio o hasta que toque el micrófono otra vez
      chRec.continuous = true;
    } catch (e) { chMsg("app", "No pude usar el micrófono. Escríbemelo y lo anoto igual."); return; }
    var final = "", silencio = null, rec = chRec;
    function callar() { clearTimeout(silencio); silencio = setTimeout(function () { try { rec.stop(); } catch (e) {} }, 3500); }
    $("ch-voz").setAttribute("aria-pressed", "true"); $("ch-input").placeholder = "Te escucho… toca el micrófono al terminar";
    callar();
    chRec.onresult = function (ev) {
      var t = "", f = ""; for (var i = 0; i < ev.results.length; i++) { var x = ev.results[i][0].transcript.trim(); t += (t ? " " : "") + x; if (ev.results[i].isFinal) f += (f ? " " : "") + x; }
      final = f; $("ch-input").value = t; callar();
    };
    chRec.onerror = function (ev) {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") chMsg("app", "Necesito permiso para usar el micrófono. Puedes dármelo en los ajustes del navegador, o escribirme.");
      else if (ev.error !== "no-speech" && ev.error !== "aborted") chMsg("app", "No te escuché bien. Inténtalo otra vez o escríbemelo.");
    };
    chRec.onend = function () {
      clearTimeout(silencio);
      $("ch-voz").setAttribute("aria-pressed", "false"); $("ch-input").placeholder = "Ej.: $ 18.000 en almuerzo"; chRec = null;
      var v = (final || $("ch-input").value).trim(); if (v) { $("ch-input").value = ""; chUsuario(v); }
    };
    try { chRec.start(); } catch (e) { $("ch-voz").setAttribute("aria-pressed", "false"); }
  }
  // Sin voz dentro del navegador (Chrome en Android, Safari en iPhone, la app de Android vieja): se dicta con el micrófono
  // del teclado del celular. Ese dictado lo hace el teléfono; Finti no recibe audio.
  var chDictadoDicho = false;
  function chDictarTeclado() {
    var inp = $("ch-input"); inp.placeholder = "Toca el micrófono de tu teclado y habla"; inp.focus();
    try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) {}
    $("ch-voz").classList.add("dictando"); setTimeout(function () { $("ch-voz").classList.remove("dictando"); }, 2600);
    if (!chDictadoDicho) {
      chDictadoDicho = true;
      var vieja = APP_ANDROID.activa && APP_ANDROID.v < 9;
      chMsg("app", "Toca el <b>micrófono de tu teclado</b> y dime el gasto, por ejemplo <b>dieciocho mil en almuerzo</b>. Tu celular lo convierte en texto y yo lo anoto." +
        (vieja ? " Con la app de Android nueva, el micrófono de aquí te escucha directo." : ""));
    }
  }
  $("ch-voz").addEventListener("click", function () {
    if (chRec) { try { chRec.stop(); } catch (e) {} return; }
    if (chVozApp()) { location.href = "intent://voz#Intent;scheme=fintelligente;package=co.fintelligente.app;end"; return; }
    if (!chVozWeb()) return chDictarTeclado();
    (chIdioma ? Promise.resolve(chIdioma) : chBuscarIdioma(0)).then(function (r) {
      if (!r) return chDictarTeclado();
      if (r.st === "available") { chIdioma = r; return chEscuchar(r.lang); }
      if (r.st === "downloading") { chMsg("app", "Estoy terminando de descargar el español para entenderte sin internet. Prueba en un momento."); return; }
      chMsg("app", "Para entender tu voz sin que salga del teléfono necesito descargar el español una sola vez. ¿Lo descargo?");
      chChips([{ t: "Sí, descargar", v: "voz-instalar", si: true }, { t: "Prefiero escribir", v: "otro" }]);
      chIdioma = r;
    });
  });
  $("ch-chips").addEventListener("click", function (e) {
    var b = e.target.closest('[data-ch="voz-instalar"]'); if (!b || !chIdioma) return;
    chMsg("app", "Descargando… te aviso cuando esté.");
    CH_SR.install({ langs: [chIdioma.lang], processLocally: true }).then(function (ok) {
      if (ok) { chIdioma.st = "available"; chMsg("app", "Listo. Toca el micrófono y dime tu gasto."); chChips([]); }
      else chMsg("app", "No se pudo descargar ahora. Escríbemelo y lo anoto igual.");
    }, function () { chMsg("app", "No se pudo descargar ahora. Escríbemelo y lo anoto igual."); });
  });
  onCloseHooks["dlg-charla"] = function () { if (chRec) try { chRec.abort(); } catch (e) {} };

  // --- Pregúntale también escucha: la voz se entiende dentro del teléfono, como en Cuéntame un gasto ---
  // Con la voz del navegador (sin internet, processLocally), con la app de Android (su reconocimiento en el teléfono;
  // la respuesta vuelve marcada para Pregúntale) o, si no hay ninguna, con el micrófono del teclado.
  var prRec = null;
  function prVozDecir(html) { prBurbuja("<p>" + html + "</p>", "app"); }
  function prEscuchar(lang) {
    var inp = $("pr-input"), boton = $("pr-voz");
    try { prRec = new CH_SR(); prRec.lang = lang; prRec.processLocally = true; prRec.interimResults = true; prRec.maxAlternatives = 1; prRec.continuous = false; }
    catch (e) { prVozDecir("No pude usar el micrófono. Escríbeme tu pregunta."); return; }
    var final = "", rec = prRec, silencio = null;
    function callar() { clearTimeout(silencio); silencio = setTimeout(function () { try { rec.stop(); } catch (e) {} }, 2500); }
    boton.setAttribute("aria-pressed", "true"); inp.placeholder = "Te escucho…";
    callar();
    prRec.onresult = function (ev) {
      var t = "", f = ""; for (var i = 0; i < ev.results.length; i++) { var x = ev.results[i][0].transcript.trim(); t += (t ? " " : "") + x; if (ev.results[i].isFinal) f += (f ? " " : "") + x; }
      final = f; inp.value = t; callar();
    };
    prRec.onerror = function (ev) {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") prVozDecir("Necesito permiso para usar el micrófono. Puedes dármelo en los ajustes del navegador, o escribirme.");
      else if (ev.error !== "no-speech" && ev.error !== "aborted") prVozDecir("No te escuché bien. Inténtalo otra vez o escríbeme.");
    };
    prRec.onend = function () {
      clearTimeout(silencio); boton.setAttribute("aria-pressed", "false"); inp.placeholder = "Dime tu pregunta…"; prRec = null;
      var v = (final || inp.value).trim(); if (v) { inp.value = ""; prPreguntar(v); }
    };
    try { prRec.start(); } catch (e) { boton.setAttribute("aria-pressed", "false"); }
  }
  var prDictadoDicho = false;
  function prDictarTeclado() {
    var inp = $("pr-input"); inp.placeholder = "Toca el micrófono de tu teclado y pregúntame"; inp.focus();
    $("pr-voz").classList.add("dictando"); setTimeout(function () { $("pr-voz").classList.remove("dictando"); }, 2600);
    if (!prDictadoDicho) { prDictadoDicho = true; prVozDecir("Toca el <b>micrófono de tu teclado</b> y pregúntame, por ejemplo <b>¿cuánto gasté en comida?</b> Tu celular lo convierte en texto y yo te respondo."); }
  }
  $("pr-voz").addEventListener("click", function () {
    if (prRec) { try { prRec.stop(); } catch (e) {} return; }
    if (chVozApp()) { try { sessionStorage.setItem("fintelligente-voz-para", "preguntas"); } catch (e) {} location.href = "intent://voz#Intent;scheme=fintelligente;package=co.fintelligente.app;end"; return; }
    if (!chVozWeb()) return prDictarTeclado();
    (chIdioma ? Promise.resolve(chIdioma) : chBuscarIdioma(0)).then(function (r) {
      if (!r) return prDictarTeclado();
      if (r.st === "available") { chIdioma = r; return prEscuchar(r.lang); }
      if (r.st === "downloading") { prVozDecir("Estoy terminando de descargar el español para entenderte sin internet. Prueba en un momento."); return; }
      chIdioma = r;
      prVozDecir('Para entender tu voz sin que salga del teléfono necesito descargar el español una sola vez. <button type="button" class="pr-chip" data-pr-voz-instalar>Sí, descargar</button>');
    });
  });
  $("pr-log").addEventListener("click", function (e) {
    var b = e.target.closest("[data-pr-voz-instalar]"); if (!b || !chIdioma) return;
    b.disabled = true; prVozDecir("Descargando… te aviso cuando esté.");
    CH_SR.install({ langs: [chIdioma.lang], processLocally: true }).then(function (ok) {
      if (ok) { chIdioma.st = "available"; prVozDecir("Listo. Toca el micrófono y pregúntame."); } else prVozDecir("No se pudo descargar ahora. Escríbeme tu pregunta.");
    }, function () { prVozDecir("No se pudo descargar ahora. Escríbeme tu pregunta."); });
  });
  onCloseHooks["dlg-preguntas"] = (function (antes) { return function () { if (prRec) try { prRec.abort(); } catch (e) {} if (antes) antes(); }; })(onCloseHooks["dlg-preguntas"]);
  window.FinCharla = { entender: function (t) { return chEntender(t); }, todo: function (t) { return chEntenderTodo(t); }, numeros: chNumeros, palabras: function () { return chLista().length; }, tirilla: leerTirilla };

  window.FinPreguntas = { entender: function (t) { var r = prEntender(t); PR.espera = null; return { intent: r.intent || (r.fn ? "accion" : ""), cat: r.q && r.q.cat, monto: r.q && r.q.monto, per: r.q && r.q.per && (r.q.per.k || r.q.per.nombre), com: r.q && r.q.com && r.q.com.nombre }; } };

