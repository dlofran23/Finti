  // ===================== Sonidos y vibración por momento =====================
  // Se generan con Web Audio (no hay archivos de sonido) y siempre después de un toque. Se apagan en Colores y modo.
  var SON = { ctx: null, ult: {} };
  function sonCtx() {
    if (!SON.ctx) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return null; try { SON.ctx = new A(); } catch (e) { return null; } }
    if (SON.ctx.state === "suspended") try { SON.ctx.resume(); } catch (e) {}
    return SON.ctx;
  }
  function tono(c, f, t0, dur, vol, tipo, f2) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = tipo || "sine"; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function soplido(c, t0, dur, desde, hasta, vol) {
    var n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / n);
    var src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; bp.type = "bandpass"; bp.Q.value = 1.2; bp.frequency.setValueAtTime(desde, t0); bp.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
    g.gain.value = vol; src.connect(bp); bp.connect(g); g.connect(c.destination); src.start(t0);
  }
  var PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
  var VIBRA = { gota: [10], monedas: [8, 40, 8], meta: [20, 60, 20, 60, 40], cerca: [12, 90, 12], calma: [35], nota: [5] };
  function sonar(que, i) {
    if (!state || !state.prefs || state.prefs.sonidos === false || document.hidden) return;
    var ahora = Date.now(); if (SON.ult[que] && ahora - SON.ult[que] < 260) return; SON.ult[que] = ahora;   // varios a la vez (bandeja): uno solo
    if (VIBRA[que] && navigator.vibrate) try { navigator.vibrate(VIBRA[que]); } catch (e) {}
    var c = sonCtx(); if (!c) return;
    var t = c.currentTime + 0.01;
    if (que === "gota") { tono(c, 1250, t, 0.16, 0.16, "sine", 420); tono(c, 2400, t + 0.02, 0.05, 0.03, "sine"); }
    else if (que === "monedas") { [1568, 2093, 1760, 2349].forEach(function (f, k) { tono(c, f, t + k * 0.07, 0.22, 0.08, "triangle"); tono(c, f * 2.01, t + k * 0.07, 0.08, 0.02, "sine"); }); }
    else if (que === "meta") { [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach(function (f, k) { tono(c, f, t + k * 0.09, 0.42, 0.09, "triangle"); }); tono(c, 1567.98, t + 0.5, 0.7, 0.07, "sine"); }
    else if (que === "cerca") { tono(c, 880, t, 0.22, 0.07, "sine"); tono(c, 698.46, t + 0.2, 0.3, 0.07, "sine"); }
    else if (que === "calma") { [261.63, 329.63, 392].forEach(function (f, k) { tono(c, f, t + k * 0.05, 1.1, 0.05, "sine"); }); }
    else if (que === "soplo") soplido(c, t, 0.28, 500, 2400, 0.05);
    else if (que === "soplo-inv") soplido(c, t, 0.28, 2400, 500, 0.05);
    else if (que === "nota") tono(c, PENTA[(i || 0) % PENTA.length], t, 0.35, 0.07, "sine");
  }
  // Después de un gasto: la gota y, si la categoría va cerca del límite o se pasó, un aviso suave (nunca una alarma).
  function sonarGasto(cat) {
    sonar("gota");
    var t = totalsOf(cur()).byCat[cat]; if (!t || !(t.plan > 0)) return;
    var r = t.real / t.plan;
    setTimeout(function () { if (r > 1) sonar("calma"); else if (r >= 0.85) sonar("cerca"); }, 320);
  }
  function celebrar() {
    sonar("meta");
    if (reduceMotion) return;
    var cv = $("confetti"), ctx = cv.getContext && cv.getContext("2d"); if (!ctx) return;
    var W = cv.width = innerWidth * devicePixelRatio, H = cv.height = innerHeight * devicePixelRatio;
    var colors = ["#7c5cff", "#ffc53d", "#19c3a0", "#ff5c9a", "#38bdf8", "#ff7a59"];
    var ps = [];
    for (var i = 0; i < 160; i++) ps.push({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .55, vx: (Math.random() - .5) * 26 * devicePixelRatio, vy: (-Math.random() * 26 - 10) * devicePixelRatio,
      s: (6 + Math.random() * 7) * devicePixelRatio, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: colors[i % colors.length] });
    var t0 = performance.now();
    (function frame(now) {
      ctx.clearRect(0, 0, W, H);
      ps.forEach(function (p) { p.vy += 0.9 * devicePixelRatio; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (now - t0 < 2600) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    })(t0);
  }

  // --- Racha de días organizando la plata ---
  function hoyStr(d) { d = d || new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function marcarActividad() {
    var h = hoyStr();
    if (state.actividad[state.actividad.length - 1] !== h) { state.actividad.push(h); state.actividad = state.actividad.slice(-120); return true; }
    return false;
  }
  function racha() {
    var set = {}; state.actividad.forEach(function (d) { set[d] = 1; });
    var d = new Date(), n = 0;
    if (!set[hoyStr(d)]) d.setDate(d.getDate() - 1);
    while (set[hoyStr(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // --- Puntaje de salud financiera (0–100) ---
  function puntaje(t) {
    var ing = t.ingReal || t.ingPlan, tips = [], pts = 0;
    var tasa = ing > 0 ? t.ahorro / ing : 0;
    pts += Math.min(tasa / 0.2, 1) * 35;
    var conPlan = 0, ok = 0, excedidas = [];
    Object.keys(t.byCat).forEach(function (id) {
      var x = t.byCat[id], c = catById(id) || { name: "Otros", group: "gus" };
      if (!x.plan) return;
      conPlan++;
      if (c.group === "aho" ? x.real >= x.plan : x.real <= x.plan) ok++;
      else if (c.group !== "aho") excedidas.push({ c: c, sobre: x.real - x.plan, pct: x.real / x.plan - 1 });
    });
    pts += (conPlan ? ok / conPlan : 1) * 30;
    pts += t.saldo >= 0 ? 15 : 0;
    var cuotas = t.byCat.deudas ? t.byCat.deudas.real : 0, rd = ing > 0 ? cuotas / ing : 0;
    pts += rd <= 0.2 ? 20 : rd >= 0.5 ? 0 : (0.5 - rd) / 0.3 * 20;
    var score = Math.round(Math.max(0, Math.min(100, pts)));
    excedidas.sort(function (a, b) { return b.sobre - a.sobre; }).slice(0, 2).forEach(function (e) {
      tips.push({ cls: "bad", txt: esc(e.c.name) + " va " + money(e.sobre) + " por encima (" + pctf(e.pct) + ")." });
    });
    if (t.saldo < 0) tips.push({ cls: "bad", txt: "Este mes gastas " + money(-t.saldo) + " más de lo que te ingresa." });
    if (ing > 0 && tasa < 0.2) tips.push({ cls: "warn", txt: "Ahorra " + money(Math.ceil((0.2 * ing - t.ahorro) / 1000) * 1000) + " más para llegar al 20 %." });
    else if (ing > 0) tips.push({ cls: "good", txt: "Tu ahorro va en " + pctf(tasa) + ": ¡por encima de la meta!" });
    if (t.ingPlan > t.ingReal && t.ingReal > 0) tips.push({ cls: "warn", txt: "Te faltan " + money(t.ingPlan - t.ingReal) + " por recibir de ingresos." });
    if (!excedidas.length && conPlan) tips.unshift({ cls: "good", txt: "Todas tus categorías están dentro del plan." });
    var label = score >= 80 ? "Excelente" : score >= 65 ? "Buena" : score >= 45 ? "Mejorable" : "En riesgo";
    var cls = score >= 65 ? "ok" : score >= 45 ? "warn" : "bad";
    return { score: score, label: label, cls: cls, tips: tips.slice(0, 3) };
  }

  // --- Inicio: tarjeta principal, puntaje, dona y alertas ---
  var donutSel = null;
  // --- Hoy puedes gastar: lo que queda del día a día (gastos sin día fijo, sin ahorro) repartido en los días que faltan ---
  function hoyPuedes(t) {
    var hoy = new Date(), k = hoy.getFullYear() + "-" + ("0" + (hoy.getMonth() + 1)).slice(-2);
    if (state.mes !== k) return null;
    var flex = {}, P = 0, R = 0, H = 0, hs = hoyStr(hoy);
    cur().gastos.forEach(function (r) {
      if (r.dia || (catById(r.cat) || { group: "gus" }).group === "aho") return;
      flex[r.cat] = 1; P += r.plan; R += r.real;
    });
    state.movs.forEach(function (x) { if (x.f === hs && x.t === "g" && flex[x.cat]) H += x.m; });
    H = Math.min(H, R);
    var quedan = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate() - hoy.getDate() + 1;
    var base = Math.max(0, (P - (R - H)) / quedan);
    return { plan: P, base: base, hoyGasto: H, puede: base - H, quedan: quedan, resto: P - R };
  }
  function redondeoMil(v) { return (v < 0 ? -1 : 1) * Math.floor(Math.abs(v) / 1000) * 1000; }
  function renderHoy(t) {
    var h = hoyPuedes(t), card = $("hoy-card");
    card.hidden = !h;
    if (!h) return h;
    if (!h.plan) {
      card.removeAttribute("data-nivel");
      $("hoy-v").textContent = "–"; $("hoy-v").dataset.v = "0";
      $("hoy-dias").textContent = "";
      $("hoy-fill").style.width = "0";
      $("hoy-barra").setAttribute("aria-label", "Sin plan para el día a día");
      $("hoy-s").textContent = "Ponle un plan a tus gastos del día a día (mercado, transporte, salidas) y te digo cuánto puedes gastar hoy.";
      return h;
    }
    var uso = h.base > 0 ? h.hoyGasto / h.base : (h.hoyGasto > 0 ? 2 : 0);
    var nivel = uso > 1 || h.base <= 0 ? "pasado" : uso >= 0.85 ? "cerca" : "bien";
    card.dataset.nivel = nivel;
    animateNumber($("hoy-v"), Math.max(0, redondeoMil(h.puede)), money);
    $("hoy-dias").textContent = h.quedan === 1 ? "Último día del mes" : "Faltan " + plural(h.quedan, "día");
    $("hoy-fill").style.width = Math.min(100, uso * 100).toFixed(1) + "%";
    $("hoy-barra").setAttribute("aria-label", "Hoy llevas " + money(h.hoyGasto) + " de " + money(redondeoMil(h.base)));
    $("hoy-s").textContent = h.base <= 0 ? "Lo del día a día de este mes ya se usó. Te ayudo a mover algo de otra categoría si lo necesitas."
      : nivel === "pasado" ? "Hoy te pasaste " + money(h.hoyGasto - h.base) + ". Tranquilidad: lo reparto en los días que quedan."
      : h.hoyGasto > 0 ? "Llevas " + money(h.hoyGasto) + " hoy. En el mes te quedan " + money(Math.max(0, h.resto)) + "."
      : "En el mes te quedan " + money(Math.max(0, h.resto)) + " para el día a día.";
    return h;
  }
  $("hoy-registrar").addEventListener("click", function () { abrirCharla(); });

  // --- Saludo en primera persona, según cómo va el mes ---
  function renderSaludo(t, h) {
    var hr = new Date().getHours(), hola = hr < 12 ? "Buenos días." : hr < 19 ? "Buenas tardes." : "Buenas noches.";
    var hoy = new Date(), k = hoy.getFullYear() + "-" + ("0" + (hoy.getMonth() + 1)).slice(-2), actual = state.mes === k;
    var dias = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate(), avance = actual ? hoy.getDate() / dias : 1;
    var usado = t.ingReal > 0 ? t.gasReal / t.ingReal : 0, plan = t.ingPlan > 0 ? t.gasPlan / t.ingPlan : 1, frase, sub;
    if (!(t.ingReal > 0) && !(t.ingPlan > 0)) { frase = "Cuéntame cuánto te entra este mes y te digo cómo vas."; sub = "Con eso armo tu mes en un minuto."; }
    else if (t.saldo < 0) { frase = "Este mes se fue un poco por encima."; sub = "Miremos juntos dónde ajustar; siempre hay espacio para mejorar."; }
    else if (!actual) { frase = usado <= plan ? "Así quedó ese mes: cerraste dentro del plan." : "Así quedó ese mes."; sub = "Estás viendo " + monthLabel(state.mes).toLowerCase() + "."; }
    else if (h && h.plan && h.base <= 0) { frase = "Vamos con calma estos días."; sub = "Lo del día a día ya se usó; te ayudo a cuadrar el resto del mes."; }
    else if (h && h.plan ? h.resto >= h.plan * (1 - (hoy.getDate() - 1) / dias) * 0.95 : usado <= plan * avance + 0.05) {
      frase = "¡Vas muy bien este mes!";
      sub = h && h.plan ? "Tu día a día va al ritmo justo y vamos en el día " + hoy.getDate() + " de " + dias + "." : "Llevas el " + pctf(usado) + " de lo que entró y vamos en el día " + hoy.getDate() + " de " + dias + ".";
    }
    else { frase = "Vas un poco rápido este mes."; sub = "Te ayudo a llegar con calma al cierre: mira cuánto puedes gastar hoy."; }
    var animo = !(t.ingReal > 0) && !(t.ingPlan > 0) ? "nuevo" : t.saldo < 0 ? "neg" : /muy bien|dentro del plan/.test(frase) ? "bien" : /rápido/.test(frase) ? "rapido" : "calma";
    renderMascota(t, animo);
    $("saludo-h").textContent = hola + " " + frase;
    $("saludo-s").textContent = sub;
  }

  function renderInicio(t) {
    var hero = $("t-hero"), ing = t.ingReal;
    renderSaludo(t, renderHoy(t));
    hero.classList.toggle("neg", t.saldo < 0);
    $("hero-month").textContent = monthLabel(state.mes);
    animateNumber($("hero-saldo"), t.saldo, money);
    $("hero-sub").textContent = ing > 0 ? "Ingresaron " + money(ing) + " y llevas gastado " + money(t.gasReal) + "." : "Registra tus ingresos para ver cuánto te queda.";
    var usado = ing > 0 ? Math.min(t.gasReal / ing, 1) : 0, plan = t.ingPlan > 0 ? Math.min(t.gasPlan / t.ingPlan, 1) : 0;
    $("hero-fill").style.width = (usado * 100).toFixed(1) + "%";
    $("hero-fill").style.transition = reduceMotion ? "none" : "width .7s cubic-bezier(.2,.8,.2,1)";
    $("hero-mark").style.left = "calc(" + (plan * 100).toFixed(1) + "% - 1px)";
    $("hero-bar-wrap").setAttribute("aria-label", "Has gastado el " + pctf(usado) + " de tus ingresos; lo planeado era el " + pctf(plan));
    $("hero-chips").innerHTML = "<span>Gastado " + pctf(ing > 0 ? t.gasReal / ing : 0) + "</span><span>Ahorro " + pctf(ing > 0 ? t.ahorro / ing : 0) + "</span><span>Planeado " + money(t.ingPlan - t.gasPlan) + "</span>";

    var p = puntaje(t);
    var arc = $("score-arc"), C = 314.16;
    arc.style.transition = reduceMotion ? "none" : "stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1), stroke .3s";
    arc.style.strokeDashoffset = (C * (1 - p.score / 100)).toFixed(1);
    arc.style.stroke = p.cls === "ok" ? "var(--good)" : p.cls === "warn" ? "var(--warn)" : "var(--bad)";
    animateNumber($("score-num"), p.score, function (v) { return String(Math.round(v)); });
    $("score-svg").setAttribute("aria-label", "Salud financiera: " + p.score + " de 100, " + p.label);
    $("score-chip").className = "chip " + p.cls; $("score-chip").textContent = p.label;
    $("score-tips").innerHTML = p.tips.map(function (x) { return '<li class="' + x.cls + '">' + x.txt + "</li>"; }).join("") || '<li>Agrega tus ingresos y gastos para ver tu diagnóstico.</li>';
    renderRachas();
    renderNudge();

    renderDonut(t);
    renderWatch(t);
    renderTuDia(); renderPron(t); renderQuincena(); renderAlcancia(); renderTarjetasCat(t); renderPorDia(); renderAnSimple(t);
    if (!$("carta").dataset.forzada) renderCarta(false);
  }

  var donutYaPintado = false;
  // "¿En qué se va tu plata?": esta semana o este mes. La dona tiene grosor (como una pieza de verdad), vista casi de frente
  // para que las porciones de adelante no parezcan más grandes de lo que son. Cada porción lleva su cifra en las tarjetas de abajo.
  // Si la persona no ha elegido, se muestra la semana cuando ya tiene gastos esta semana; si no, el mes.
  var donutModo = (function () { try { return localStorage.getItem("fintelligente-donut") || ""; } catch (e) { return ""; } })();
  function byCatSemana() {
    var ini = lunesDe(new Date()), r = {};
    state.movs.forEach(function (x) { if (x.t !== "g") return; var f = parseD(x.f); if (!f || f < ini) return; (r[x.cat] = r[x.cat] || { real: 0, plan: 0 }).real += x.m; });
    return r;
  }
  function renderDonut(t) {
    var sem = byCatSemana(), modo = donutModo || (Object.keys(sem).length ? "semana" : "mes");
    var semana = modo === "semana", fuente = semana ? sem : t.byCat;
    Array.prototype.forEach.call($("donut-modo").querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", b.dataset.dm === modo); });
    var items = Object.keys(fuente).map(function (id) { return { id: id, v: fuente[id].real, plan: semana ? 0 : fuente[id].plan, c: catById(id) || { name: "Otros" } }; })
      .filter(function (x) { return x.v > 0; }).sort(function (a, b) { return b.v - a.v; });
    var total = items.reduce(function (s, x) { return s + x.v; }, 0);
    if (items.length > 7) {
      var rest = items.slice(6).reduce(function (s, x) { return s + x.v; }, 0);
      items = items.slice(0, 6).concat([{ id: "__otras", v: rest, plan: 0, c: { name: "Otras" } }]);
    }
    // Geometría: anillo con puntas redondeadas, aplastado en vertical (vista casi de frente) y con 7 capas de grosor
    var R = 80, C = 2 * Math.PI * R, SW = 24, GAP = items.length > 1 ? 4 : 0, off = 0, SQ = 1, CAPAS = 0, PASO = 2;   // plana: el grosor en 3D no gustó (19 de noviembre de 2026)
    var animar = !donutYaPintado && !reduceMotion && total > 0;
    var trozos = items.map(function (x) {
      var len = total ? x.v / total * C : 0, col = x.id === "__otras" ? "#8e8aa0" : catColor(x.id);
      var redondo = items.length > 1 && len - GAP - SW > 1, dib = redondo ? len - GAP - SW : Math.max(len - GAP, 0.5), ini = redondo ? off + GAP / 2 + SW / 2 : off + GAP / 2;
      if (items.length === 1) { dib = C; ini = 0; redondo = false; }
      var mid = (off + len / 2) / R - Math.PI / 2, sel = donutSel === x.id;
      off += len;
      return { x: x, col: col, dib: dib, ini: ini, redondo: redondo, dx: sel ? Math.cos(mid) * 10 : 0, dy: sel ? Math.sin(mid) * 10 - 14 : 0 };
    });
    function capa(dy, lado) {
      return '<g transform="translate(0 ' + dy + ') translate(100 100) scale(1 ' + SQ + ') translate(-100 -100)">' +
        (!lado && !total ? '<circle cx="100" cy="100" r="' + R + '" fill="none" stroke="var(--line)" stroke-width="' + SW + '" opacity=".6"/>' : "") +
        trozos.map(function (z) {
          var cls = donutSel ? (donutSel === z.x.id ? " on" : " dim") : "";
          if (!CAPAS) { z.dy = donutSel === z.x.id ? z.dy + 14 : 0; }   // plana: la porción elegida solo sale hacia afuera
          return '<g class="trozo' + cls + '" style="transform:translate(' + z.dx.toFixed(1) + "px," + z.dy.toFixed(1) + 'px)"><circle class="' + (lado ? "lado" : "seg") + '" data-id="' + z.x.id + '" cx="100" cy="100" r="' + R +
            '" stroke="' + z.col + '"' + (lado ? ' style="stroke:color-mix(in oklab,' + z.col + " " + (58 + dy * 1.5) + '%,#000)"' : "") + ' stroke-width="' + SW + '" stroke-linecap="' + (z.redondo ? "round" : "butt") +
            '" stroke-dasharray="' + (animar ? "0 " + C.toFixed(2) : z.dib.toFixed(2) + " " + (C - z.dib).toFixed(2)) + '" data-dib="' + z.dib.toFixed(2) + '" stroke-dashoffset="' + (-z.ini).toFixed(2) +
            '" transform="rotate(-90 100 100)">' + (lado ? "" : "<title>" + esc(z.x.c.name) + ": " + money(z.x.v) + "</title>") + "</circle></g>";
        }).join("") + "</g>";
    }
    var svg = CAPAS ? '<defs><radialGradient id="donut-sombra"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="donut-brillo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
      '<ellipse cx="100" cy="' + (100 + CAPAS * PASO + 8) + '" rx="100" ry="60" fill="url(#donut-sombra)"/>' : "";
    for (var k = CAPAS; k >= 1; k--) svg += capa(k * PASO, true);
    svg += capa(0, false);
    // Brillo de la cara de arriba: un aro de luz suave sobre la mitad de atrás
    if (total && CAPAS) svg += '<g transform="translate(100 100) scale(1 ' + SQ + ') translate(-100 -100)" pointer-events="none"><circle cx="100" cy="100" r="' + (R + SW / 2 - 3) + '" fill="none" stroke="url(#donut-brillo)" stroke-width="3" opacity=".9"/></g>';
    $("donut").innerHTML = svg;
    $("donut").setAttribute("aria-label", (semana ? "Gasto de esta semana" : "Gasto del mes") + " por categoría");
    if (total > 0) donutYaPintado = true;
    if (animar) requestAnimationFrame(function () { requestAnimationFrame(function () {
      Array.prototype.forEach.call($("donut").querySelectorAll("circle[data-dib]"), function (c) { var d = +c.dataset.dib; c.setAttribute("stroke-dasharray", d.toFixed(2) + " " + (C - d).toFixed(2)); });
    }); });
    var sel = items.find(function (x) { return x.id === donutSel; });
    $("donut-k").textContent = sel ? sel.c.name : semana ? "Esta semana" : "Este mes";
    $("donut-v").textContent = money(sel ? sel.v : total);
    $("donut-p").textContent = sel && total ? pctf(sel.v / total) + " del total" : (items.length ? plural(items.length, "categoría") : semana ? "Sin gastos esta semana" : "Sin gastos aún");
    $("donut-legend").classList.toggle("con-sel", !!sel);
    $("donut-legend").innerHTML = items.map(function (x) {
      var otras = x.id === "__otras", col = otras ? "#8e8aa0" : catColor(x.id);
      var icon = otras ? '<span class="cat-ic"><svg class="ic"><use href="#c-otros"/></svg></span>' : catIcon(x.id);
      var r = x.plan > 0 ? x.v / x.plan : 0;
      var pie = x.plan > 0 ? (r > 1 ? '<small class="neg">Te pasaste ' + money(x.v - x.plan) + "</small>" : "<small>de " + money(x.plan) + "</small>") : "<small>" + (otras ? "Varias categorías" : semana ? "Esta semana" : "Sin plan") + "</small>";
      return '<button type="button" data-id="' + x.id + '" class="' + (donutSel === x.id ? "on" : "") + '" style="--c:' + col + '" aria-pressed="' + (donutSel === x.id) + '">' +
        '<span class="ct-top">' + icon + '<span class="pc">' + pctf(total ? x.v / total : 0) + "</span></span>" +
        '<span class="nm">' + esc(x.c.name) + '</span><b class="ct-v cifra">' + money(x.v) + "</b>" +
        (x.plan > 0 ? '<span class="ct-bar' + (r > 1 ? " pasado" : "") + '" aria-hidden="true"><i style="width:' + Math.min(100, r * 100).toFixed(1) + '%"></i></span>' : "") + pie + "</button>";
    }).join("");
  }
  function pickDonut(id) {
    donutSel = donutSel === id ? null : id; renderDonut(totalsOf(cur()));
    // Cada categoría tiene su nota (escala pentatónica, siempre suena bien junta)
    if (donutSel) { var ids = Array.prototype.map.call($("donut-legend").querySelectorAll("button[data-id]"), function (x) { return x.dataset.id; }); sonar("nota", Math.max(0, ids.indexOf(id))); }
  }
  $("donut").addEventListener("click", function (e) { var s = e.target.closest(".seg"); if (s) pickDonut(s.dataset.id); });
  $("donut-modo").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-dm]"); if (!b || b.getAttribute("aria-pressed") === "true") return;
    donutModo = b.dataset.dm; donutSel = null; donutYaPintado = false;
    try { localStorage.setItem("fintelligente-donut", donutModo); } catch (er) {}
    renderDonut(totalsOf(cur()));
  });
  // Tocar una tarjeta: se resalta en el anillo y se abre su detalle, creciendo desde la tarjeta
  $("donut-legend").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-id]"); if (!b) return;
    var id = b.dataset.id;
    if (donutSel !== id) pickDonut(id);
    if (id !== "__otras") abrirCategoria(id, b);
  });
  var cdCat = "";
  // Inicio: una tarjeta de color por categoría, como en el prototipo (las que tienen plan o gasto este mes)
  // Tinta con mejor contraste sobre el color de la categoría (oscura o blanca)
  function tintaPara(hex) { var L = luminance(hex), blanco = 1.05 / (L + 0.05), oscuro = (L + 0.05) / (luminance("#14121f") + 0.05); return oscuro >= blanco ? "#14121f" : "#ffffff"; }
  // Si ni la tinta oscura ni la blanca se leen bien (4,5 : 1), oscurece un poco el fondo de la tarjeta
  function fondoLegible(hex) {
    var c = hex;
    for (var k = 0; k < 12; k++) {
      var L = luminance(c), oscuro = (L + 0.05) / (luminance("#14121f") + 0.05), blanco = 1.05 / (L + 0.05);
      if (Math.max(oscuro, blanco) >= 4.6) return c;
      c = "#" + [1, 3, 5].map(function (i) { var v = Math.round(parseInt(hex.substr(i, 2), 16) * (1 - (k + 1) * 0.05)); return ("0" + v.toString(16)).slice(-2); }).join("");
    }
    return c;
  }
  function renderTarjetasCat(t) {
    var sec = $("cat-tarjetas"); if (!sec) return;
    var lista = cats().map(function (c) { var x = t.byCat[c.id] || { plan: 0, real: 0 }; return { c: c, plan: x.plan, real: x.real }; })
      .filter(function (x) { return x.plan > 0 || x.real > 0; })
      .sort(function (a, b) { return (b.plan > 0 ? b.real / b.plan : 0) - (a.plan > 0 ? a.real / a.plan : 0) || b.real - a.real; });
    sec.hidden = !lista.length;
    var max = 6, mostrar = mostrarTodasCat ? lista : lista.slice(0, max);
    $("ct-todas").hidden = lista.length <= max; $("ct-todas").textContent = mostrarTodasCat ? "Ver menos" : "Ver todas (" + lista.length + ")";
    $("ct-grid").innerHTML = mostrar.map(function (x, i) {
      var col = fondoLegible(catColor(x.c.id)), tinta = tintaPara(col), r = x.plan > 0 ? x.real / x.plan : 0;
      var linea = !(x.plan > 0) ? "Gastaste " + money(x.real) : r > 1 ? "Te pasaste " + money(x.real - x.plan) : r >= 1 ? "Ya está completo"
        : r >= 0.85 ? "Casi al límite: quedan " + money(x.plan - x.real) : "Vas bien: quedan " + money(x.plan - x.real);
      if (CON_3D) return '<button type="button" class="ct-carta ct-fila' + (r > 1 ? " pasada" : r >= 0.85 ? " justa" : "") + '" data-cat="' + esc(x.c.id) + '" style="--c:' + catColor(x.c.id) + ";--i:" + i + '" aria-label="' + esc(x.c.name) + ": " + linea + '">' +
        catIcon(x.c.id) + '<span class="ct-txt"><span class="ct-n">' + esc(x.c.name) + '</span><span class="ct-l">' + linea + "</span>" +
        '<span class="ct-barra" aria-hidden="true"><i style="width:' + Math.min(100, r * 100).toFixed(1) + '%"></i></span></span></button>';
      return '<button type="button" class="ct-carta' + (r > 1 ? " pasada" : "") + '" data-cat="' + esc(x.c.id) + '" style="--c:' + col + ";--t:" + tinta + ";--i:" + i + '" aria-label="' + esc(x.c.name) + ": " + linea + '">' +
        '<svg class="ct-fondo" aria-hidden="true"><use href="#c-' + iconoDeCat(x.c.id) + '"/></svg>' +
        '<span class="ct-n">' + esc(x.c.name) + '</span><span class="ct-l">' + linea + '</span>' +
        '<span class="ct-barra" aria-hidden="true"><i style="width:' + Math.min(100, r * 100).toFixed(1) + '%"></i></span></button>';
    }).join("");
  }
  var mostrarTodasCat = false;
  // Análisis en palabras sencillas: cómo va el mes, una frase y cada categoría con Bien, Ojo, Listo o Te pasaste (ícono y palabra, nunca solo color).
  var anDetalle = false;
  try { anDetalle = localStorage.getItem("fintelligente-an-detalle") === "1"; } catch (e) {}
  function renderAnSimple(t) {
    var sec = $("an-simple"); if (!sec) return;
    var hoy = new Date(), k = hoy.getFullYear() + "-" + ("0" + (hoy.getMonth() + 1)).slice(-2), actual = state.mes === k;
    var dias = new Date(+state.mes.slice(0, 4), +state.mes.slice(5, 7), 0).getDate(), avance = actual ? hoy.getDate() / dias : 1;
    var entra = t.ingReal > 0 ? Math.max(t.ingReal, t.ingPlan) : t.ingPlan, gasto = t.gasReal;
    // Mismo pronóstico de la gráfica del detalle, para que las dos cifras coincidan.
    var P = actual ? pronostico(t) : null;
    var sobra = P && P.d >= 3 ? redondeoMil(P.cierre) : redondeoMil(entra - Math.max(gasto, actual ? t.gasPlan : gasto)), estado, frase;
    if (!(entra > 0) && !(gasto > 0)) { estado = "Empecemos"; frase = "Cuéntame cuánto te entra y en qué gastas, y aquí te digo cómo vas."; }
    else if (sobra >= Math.max(1000, entra * 0.05)) { estado = "Vas bien"; frase = actual ? "Si sigues así, al final del mes te sobran unos " + money(sobra) + "." : "Cerraste el mes con unos " + money(Math.max(0, entra - gasto)) + " de sobra."; }
    else if (sobra >= 0) { estado = "Vas justo"; frase = actual ? "Llegas al final del mes, pero con poco margen: unos " + money(sobra) + "." : "Cerraste el mes justo."; }
    else { estado = "Ojo"; frase = actual ? "A este ritmo te faltarían unos " + money(-sobra) + ". Te ayudo a ajustar lo que queda." : "Ese mes gastaste " + money(-sobra) + " más de lo que entró."; }
    $("an-v").textContent = estado; $("an-frase").textContent = frase; $("an-estado").dataset.estado = estado === "Ojo" ? "ojo" : estado === "Vas justo" ? "justo" : "bien";
    var lista = cats().map(function (c) { var x = t.byCat[c.id] || { plan: 0, real: 0 }; return { c: c, plan: x.plan, real: x.real }; })
      .filter(function (x) { return x.plan > 0 || x.real > 0; })
      .sort(function (a, b) { return (b.plan > 0 ? b.real / b.plan : 2) - (a.plan > 0 ? a.real / a.plan : 2) || b.real - a.real; }).slice(0, 6);
    var OK = "M5 12.5l4.5 4.5L19 7.5", OJO = "M12 7v6M12 17h.01", MAS = "M12 5v14M5 12h14";
    $("an-lista").innerHTML = lista.length ? lista.map(function (x) {
      var r = x.plan > 0 ? x.real / x.plan : 0, q = x.plan - x.real, est, ic, tx, cls;
      if (!(x.plan > 0)) { est = "Sin plan"; ic = MAS; cls = "nada"; tx = "Llevas " + money(x.real) + ". Ponle un plan y te aviso."; }
      else if (r > 1) { est = "Te pasaste"; ic = OJO; cls = "ojo"; tx = "Vas " + money(-q) + " arriba. Lo compensamos con otra categoría."; }
      else if (r >= 0.999) { est = "Listo"; ic = OK; cls = "listo"; tx = x.c.group === "aho" ? "¡Ya guardaste lo de este mes!" : "Ya está completo este mes."; }
      else if (r >= 0.85) { est = "Ojo"; ic = OJO; cls = "ojo"; tx = "Te quedan " + money(q) + ". Mejor con calma esta semana."; }
      else { est = "Bien"; ic = OK; cls = "bien"; tx = "Te quedan " + money(q) + "."; }
      return '<li class="an-fila" data-est="' + cls + '">' + catIcon(x.c.id) + '<span class="an-txt"><b>' + esc(x.c.name) + "</b><small>" + tx + '</small></span><span class="an-est"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + ic + '"/></svg>' + est + "</span></li>";
    }).join("") : '<li class="an-vacio">Cuando anotes tus gastos, aquí verás cómo va cada cosa.</li>';
    var v = document.querySelector('[data-view="analisis"]'); if (v) v.classList.toggle("con-detalle", anDetalle);
    $("an-detalle").setAttribute("aria-expanded", String(anDetalle)); $("an-detalle").textContent = anDetalle ? "Ocultar el detalle" : "Ver el detalle con gráficas";
  }
  $("an-detalle").addEventListener("click", function () {
    anDetalle = !anDetalle; try { localStorage.setItem("fintelligente-an-detalle", anDetalle ? "1" : "0"); } catch (e) {}
    vibrar(8); renderAnSimple(totalsOf(cur()));
    if (anDetalle) { var z = $("an-detalle-zona"); if (z) z.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); }
  });
  $("ct-todas").addEventListener("click", function () { mostrarTodasCat = !mostrarTodasCat; recompute(); });
  $("ct-grid").addEventListener("click", function (e) { var b = e.target.closest("[data-cat]"); if (b) { vibrar(8); abrirCategoria(b.dataset.cat, b); } });
  function abrirCategoria(id, desde) {
    var c = catById(id); if (!c) return;
    cdCat = id;
    var col = catColor(id), t = totalsOf(cur()).byCat[id] || { plan: 0, real: 0 }, panel = $("dlg-cat").querySelector(".cat-det");
    panel.style.setProperty("--c", col);
    $("cd-ic").innerHTML = catIcon(id);
    $("cd-t").textContent = c.name;
    $("cd-sub").textContent = monthLabel(state.mes);
    $("cd-real").textContent = money(t.real);
    $("cd-plan").textContent = t.plan > 0 ? "de " + money(t.plan) + " planeados" : "sin plan este mes";
    var r = t.plan > 0 ? t.real / t.plan : 0;
    $("cd-fill").style.width = Math.min(100, r * 100).toFixed(1) + "%";
    $("cd-fill").className = r > 1 ? "pasado" : "";
    $("cd-estado").textContent = !(t.plan > 0) ? "Ponle un plan a esta categoría y te digo cómo vas." : r > 1 ? "Te pasaste " + money(t.real - t.plan) + ". Tranquilidad: miremos de dónde mover." :
      r >= 0.85 ? "Vas cerca del límite: te quedan " + money(t.plan - t.real) + "." : "Vas bien: te quedan " + money(t.plan - t.real) + " (" + pctf(1 - r) + ").";
    // Historia de los últimos 6 meses (los que existan)
    var ks = monthKeys().filter(function (k) { return k <= state.mes; }).slice(-6), vals = ks.map(function (k) { var x = totalsOf(state.meses[k]).byCat[id]; return x ? x.real : 0; });
    var max = Math.max.apply(null, vals.concat([t.plan || 0, 1])), W = 320, n = ks.length, bw = Math.min(36, (W - 20) / Math.max(n, 1) - 14), svg = "";
    if (t.plan > 0) { var yp = 104 - t.plan / max * 88; svg += '<line x1="0" x2="320" y1="' + yp.toFixed(1) + '" y2="' + yp.toFixed(1) + '" class="cd-plan-l"/><text x="318" y="' + (yp - 4).toFixed(1) + '" text-anchor="end" class="cd-plan-t">plan</text>'; }
    ks.forEach(function (k, i) {
      var h = vals[i] / max * 88, x = 10 + i * ((W - 20) / n) + ((W - 20) / n - bw) / 2, p = parseKey(k);
      svg += '<rect x="' + x.toFixed(1) + '" y="' + (104 - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(h, 2).toFixed(1) + '" rx="5" class="' + (k === state.mes ? "act" : "") + '"><title>' + mesCorto(p.y, p.m) + ": " + money(vals[i]) + "</title></rect>" +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="122" text-anchor="middle">' + MESES_C[p.m - 1] + "</text>";
    });
    $("cd-hist").innerHTML = svg;
    $("cd-hist").setAttribute("aria-label", "Gasto en " + c.name + " por mes: " + ks.map(function (k, i) { var p = parseKey(k); return MESES[p.m - 1] + " " + money(vals[i]); }).join(", "));
    var filas = cur().gastos.filter(function (g) { return g.cat === id; });
    $("cd-filas").innerHTML = filas.map(function (g) {
      var rr = g.plan > 0 ? g.real / g.plan : 0;
      return '<div class="cd-fila"><span>' + esc(g.concepto) + '</span><b class="cifra">' + money(g.real) + "</b>" + (g.plan > 0 ? '<small>de ' + money(g.plan) + '</small><span class="cd-mini' + (rr > 1 ? " pasado" : "") + '"><i style="width:' + Math.min(100, rr * 100).toFixed(1) + '%"></i></span>' : "<small>sin plan</small>") + "</div>";
    }).join("") || '<p class="hint">No hay conceptos de esta categoría este mes.</p>';
    var movs = state.movs.filter(function (x) { return x.cat === id && x.t === "g" && (x.f || "").slice(0, 7) === state.mes; }).sort(function (a, b) { return a.f < b.f ? 1 : -1; }).slice(0, 30);
    $("cd-movs-h").hidden = !movs.length;
    $("cd-movs").innerHTML = movs.map(function (x) {
      var d = parseD(x.f);
      return '<div class="cd-mov"><span class="cd-f">' + (d ? d.getDate() + " " + MESES_C[d.getMonth()] : "") + "</span><span>" + esc(x.c || "") + '</span><b class="cifra">' + money(x.m) + "</b></div>";
    }).join("");
    openDlg("dlg-cat", null);
    if (desde && !reduceMotion && panel.animate) {
      var a = desde.getBoundingClientRect(), b = panel.getBoundingClientRect();
      if (b.width && b.height) panel.animate([
        { transformOrigin: "top left", transform: "translate(" + (a.left - b.left) + "px," + (a.top - b.top) + "px) scale(" + (a.width / b.width) + "," + (a.height / b.height) + ")", opacity: 0.6, borderRadius: "18px" },
        { transformOrigin: "top left", transform: "none", opacity: 1 }
      ], { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
  }
  $("cd-anotar").addEventListener("click", function () { var c = catById(cdCat); closeDlg("dlg-cat"); abrirCharla(); });
  // En Análisis, cada categoría también abre su detalle
  $("cat-list").addEventListener("click", function (e) { var d = e.target.closest("[data-cat]"); if (d) abrirCategoria(d.dataset.cat, d); });
  $("cat-list").addEventListener("keydown", function (e) { var d = e.target.closest("[data-cat]"); if (d && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrirCategoria(d.dataset.cat, d); } });

  function renderWatch(t) {
    var rows = Object.keys(t.byCat).map(function (id) { var x = t.byCat[id], c = catById(id) || { name: "Otros", group: "gus" }; return { id: id, c: c, plan: x.plan, real: x.real, r: x.plan ? x.real / x.plan : 0 }; })
      .filter(function (x) { return x.plan > 0 && x.c.group !== "aho" && x.r >= 0.75; }).sort(function (a, b) { return b.r - a.r; }).slice(0, 4);
    $("watch-list").innerHTML = rows.length ? rows.map(function (x) {
      var cls = x.r > 1 ? "bad" : x.r >= 0.9 ? "warn" : "";
      return '<div class="watch-row">' + catIcon(x.id) + '<div><div class="top"><b>' + esc(x.c.name) + '</b><span class="' + (x.r > 1 ? "neg" : "") + '">' +
        (x.r > 1 ? "Pasado por " + money(x.real - x.plan) : "Quedan " + money(x.plan - x.real)) + '</span></div><div class="bar"><div class="fill ' + cls + '" style="width:' + Math.min(x.r * 100, 100).toFixed(1) + '%"></div></div></div></div>';
    }).join("") : '<div class="all-good"><svg class="ic"><use href="#c-ahorro"/></svg>Todo bajo control: ninguna categoría pasa del 75 % de lo planeado.</div>';
  }
  document.addEventListener("click", function (e) { var g = e.target.closest("[data-goto]"); if (g) irAConTransicion(g.dataset.goto, e.clientX || null, e.clientY || null); });
  document.addEventListener("click", function (e) { var g = e.target.closest("[data-ir-sel]"); if (!g) return; var x = document.querySelector(g.dataset.irSel); if (x) x.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); });

  // --- Notas del mes: tarjetas por tipo ---
  var TIPOS_NOTA = { logro: { e: icono("i-trophy"), n: "Logro" }, alerta: { e: icono("i-alert"), n: "Alerta" }, recordatorio: { e: icono("i-pin"), n: "Recordatorio" }, idea: { e: icono("i-bulb"), n: "Idea" }, nota: { e: icono("i-note"), n: "Nota" } };
  function icono(id, cls) { return '<svg class="ic' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  var tipoNota = "logro";
  function leerNotas(txt) {
    return String(txt || "").split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var m = /^(logro|alerta|recordatorio|idea|nota)\s*:\s*/i.exec(l);
      return m ? { tipo: m[1].toLowerCase(), texto: l.slice(m[0].length) } : { tipo: "nota", texto: l };
    });
  }
  function guardarNotas(lista) {
    cur().notas = lista.filter(function (x) { return x.texto.trim(); }).map(function (x) { return TIPOS_NOTA[x.tipo].n + ": " + x.texto.replace(/\s*\n\s*/g, " ").trim(); }).join("\n").slice(0, 4000);
    changed();
  }
  function renderNotas() {
    var lista = leerNotas(cur().notas), box = $("notas-lista");
    if (box.contains(document.activeElement) && document.activeElement.tagName === "TEXTAREA") return;
    box.innerHTML = lista.length ? lista.map(function (x, i) {
      var t = TIPOS_NOTA[x.tipo];
      return '<div class="nota" data-tipo="' + x.tipo + '" data-i="' + i + '"><span class="em" aria-hidden="true">' + t.e + '</span><span class="tx"><small>' + t.n + '</small>' +
        '<textarea rows="1" maxlength="300" aria-label="' + t.n + '">' + esc(x.texto) + '</textarea></span>' +
        '<button class="icon-btn" type="button" data-borrar-nota="' + i + '" aria-label="Borrar nota" title="Borrar">×</button></div>';
    }).join("") : '<p class="notas-vacio">Anota lo que quieras recordar de este mes: lo que lograste, lo que te preocupa o una idea para ahorrar.</p>';
    $("notas-hint").textContent = lista.length ? "También salen en tu Excel" : "";
    renderNotasVista();
    Array.prototype.forEach.call($("nota-tipos").querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.tipoNota === tipoNota)); });
  }
  // Notas a la vista: las de este mes arriba en Inicio (alertas y recordatorios primero) y los recordatorios e
  // ideas del mes pasado, para traerlos con un toque. Lo descartado se recuerda en este dispositivo.
  var NV_KEY = "fintelligente-notas-descartadas";
  function nvDescartadas() { try { return JSON.parse(localStorage.getItem(NV_KEY) || "[]"); } catch (e) { return []; } }
  function nvHuella(k, x) { return k + "|" + x.texto.toLowerCase().slice(0, 80); }
  function notasPasadas() {
    var pk = prevKey(); if (!pk || !state.meses[pk]) return [];
    var ya = leerNotas(cur().notas).map(function (x) { return x.texto.toLowerCase(); }), fuera = nvDescartadas();
    return leerNotas(state.meses[pk].notas).filter(function (x) {
      return (x.tipo === "recordatorio" || x.tipo === "idea") && ya.indexOf(x.texto.toLowerCase()) < 0 && fuera.indexOf(nvHuella(pk, x)) < 0;
    }).map(function (x) { x.k = pk; return x; });
  }
  function renderNotasVista() {
    var box = $("notas-vista"); if (!box) return;
    var lista = leerNotas(cur().notas), peso = { alerta: 0, recordatorio: 1, idea: 2, logro: 3, nota: 4 };
    var orden = lista.map(function (x, i) { x.i = i; return x; }).sort(function (a, b) { return peso[a.tipo] - peso[b.tipo] || a.i - b.i; });
    var pasadas = notasPasadas().slice(0, 3);
    box.hidden = !lista.length && !pasadas.length;
    if (box.hidden) return;
    $("nv-mes").textContent = monthLabel(state.mes).split(" ")[0].toLowerCase();
    $("nv-lista").innerHTML = orden.slice(0, 3).map(function (x) {
      var t = TIPOS_NOTA[x.tipo];
      return '<li data-tipo="' + x.tipo + '"><span class="em" aria-hidden="true">' + t.e + '</span><span class="tx"><small>' + t.n + "</small><span>" + esc(x.texto) + "</span></span></li>";
    }).join("");
    $("nv-lista").hidden = !lista.length;
    $("nv-todas").hidden = lista.length <= 3;
    $("nv-todas").textContent = lista.length > 3 ? "Ver las " + lista.length + " notas" : "";
    $("nv-pasado").hidden = !pasadas.length;
    $("nv-pasado").innerHTML = !pasadas.length ? "" : "<p>Del mes pasado</p>" + pasadas.map(function (x, i) {
      var t = TIPOS_NOTA[x.tipo];
      return '<div class="nv-p"><span aria-hidden="true">' + t.e + '</span><span title="' + esc(x.texto) + '">' + esc(x.texto) + '</span>' +
        '<button class="btn sm" type="button" data-nv-traer="' + i + '">Traer</button><button class="icon-btn" type="button" data-nv-quitar="' + i + '" aria-label="No traer: ' + esc(x.texto) + '" title="No traer">×</button></div>';
    }).join("");
  }
  function irANotas(enfocar) {
    var p = document.querySelector(".notas-panel");
    p.scrollIntoView({ behavior: "smooth", block: "start" });
    p.classList.remove("resaltar"); void p.offsetWidth; p.classList.add("resaltar");
    if (enfocar) setTimeout(function () { $("f-nota-nueva").focus({ preventScroll: true }); }, 450);
  }
  $("nv-agregar").addEventListener("click", function () { irANotas(true); });
  $("nv-todas").addEventListener("click", function () { irANotas(false); });
  $("nv-pasado").addEventListener("click", function (e) {
    var b = e.target.closest("[data-nv-traer],[data-nv-quitar]"); if (!b) return;
    var x = notasPasadas()[+(b.dataset.nvTraer || b.dataset.nvQuitar)]; if (!x) return;
    if (b.dataset.nvTraer != null) {
      var lista = leerNotas(cur().notas); lista.unshift({ tipo: x.tipo, texto: x.texto });
      guardarNotas(lista); renderNotas();
      toast("Nota traída a " + monthLabel(state.mes).toLowerCase() + ".");
    } else {
      var f = nvDescartadas(); f.push(nvHuella(x.k, x));
      try { localStorage.setItem(NV_KEY, JSON.stringify(f.slice(-100))); } catch (e) {}
      renderNotasVista();
    }
  });
  function agregarNota() {
    var inp = $("f-nota-nueva"), txt = inp.value.trim();
    if (!txt) { inp.focus(); return; }
    var lista = leerNotas(cur().notas); lista.unshift({ tipo: tipoNota, texto: txt.slice(0, 300) });
    guardarNotas(lista); inp.value = ""; renderNotas(); inp.focus();
  }
  $("nota-tipos").addEventListener("click", function (e) { var b = e.target.closest("[data-tipo-nota]"); if (!b) return; tipoNota = b.dataset.tipoNota; renderNotas(); $("f-nota-nueva").focus(); });
  $("btn-nota").addEventListener("click", agregarNota);
  $("f-nota-nueva").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); agregarNota(); } });
  $("notas-lista").addEventListener("click", function (e) {
    var b = e.target.closest("[data-borrar-nota]"); if (!b) return;
    var lista = leerNotas(cur().notas), i = +b.dataset.borrarNota, quitada = lista.splice(i, 1)[0];
    guardarNotas(lista); renderNotas();
    toast("Nota borrada.", { action: "Deshacer", onAction: function () { var l = leerNotas(cur().notas); l.splice(i, 0, quitada); guardarNotas(l); renderNotas(); } });
  });
  $("notas-lista").addEventListener("input", function (e) {
    var t = e.target; if (t.tagName !== "TEXTAREA") return;
    var card = t.closest(".nota"), lista = leerNotas(cur().notas), i = +card.dataset.i;
    if (!lista[i]) return;
    lista[i].texto = t.value.replace(/\n/g, " ").slice(0, 300);
    clearTimeout(notasTimer); notasTimer = setTimeout(function () { guardarNotas(lista); }, 400);
  });
  $("notas-lista").addEventListener("keydown", function (e) { if (e.target.tagName === "TEXTAREA" && e.key === "Enter") { e.preventDefault(); e.target.blur(); } });
  $("notas-lista").addEventListener("focusout", function (e) { if (e.target.tagName === "TEXTAREA") setTimeout(renderNotas, 0); });
  var notasTimer = null;

  // --- Grupos del menú lateral: se recuerda cuáles quedaron abiertos ---
  (function () {
    var K = "fintelligente-lat-grupos", abiertos = {};
    try { abiertos = JSON.parse(localStorage.getItem(K) || "{}") || {}; } catch (e) {}
    [].forEach.call(document.querySelectorAll(".lat-grupo"), function (d) {
      if (abiertos[d.id]) d.open = true;
      d.addEventListener("toggle", function () { abiertos[d.id] = d.open; try { localStorage.setItem(K, JSON.stringify(abiertos)); } catch (e) {} });
    });
  })();
  // --- Pestañas ---
  var VIEWS = ["inicio", "movimientos", "metas", "cuentas", "analisis", "presupuesto"];
  var vistaActual = "";
