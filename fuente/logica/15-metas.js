  // ===================== Metas =====================
  var jarVisto = {};
  function renderMetas() {
    var body = $("metas-body");
    // Gratis: 1 meta (decisión del dueño, 17 de noviembre de 2026). Las demás quedan guardadas y vuelven con Premium.
    var visibles = hasPremium() ? state.metas : state.metas.slice(0, 1), ocultas = state.metas.length - visibles.length;
    var falta = 0, nM = 0; visibles.forEach(function (g) { if (g.objetivo > 0) { nM++; falta += Math.max(0, g.objetivo - g.ahorrado); } });
    $("mt-resumen").textContent = nM ? (falta ? "Te faltan " + money(falta) + (nM > 1 ? " entre todas" : "") : "¡Cumpliste " + (nM > 1 ? "todas tus metas" : "tu meta") + "!") : "Tus metas, el reto de las 52 semanas y tu plan para salir de deudas.";
    var nk = nowKey();
    body.innerHTML = '<div class="goals">' + (visibles.length ? visibles.map(function (g) {
      var ratio = g.objetivo > 0 ? g.ahorrado / g.objetivo : 0, done = g.objetivo > 0 && g.ahorrado >= g.objetivo;
      var note;
      if (done) note = "<b>¡Meta cumplida!</b>";
      else if (!g.objetivo) note = "Escribe cuánto quieres reunir.";
      else if (!g.fecha) note = "Faltan <b>" + money(g.objetivo - g.ahorrado) + "</b>. Ponle una fecha para calcular cuánto ahorrar al mes.";
      else {
        var n = monthsBetween(nk, g.fecha);
        note = n <= 0 ? "La fecha ya pasó: faltan <b>" + money(g.objetivo - g.ahorrado) + "</b>." :
          "Faltan <b>" + money(g.objetivo - g.ahorrado) + "</b>: ahorra <b>" + money(Math.ceil((g.objetivo - g.ahorrado) / n / 1000) * 1000) + " al mes</b> durante " + n + (n === 1 ? " mes" : " meses") + ".";
      }
      var pc = Math.min(ratio, 1), jid = "jar-" + String(g.id).replace(/[^a-z0-9_-]/gi, ""), nueva = !jarVisto[g.id]; jarVisto[g.id] = 1;
      // Una alcancía que se llena con una ola; la primera vez sube desde abajo y cae una moneda
      var anillo = '<svg class="goal-jar' + (nueva ? " sube" : "") + (done ? " done" : "") + '" viewBox="0 0 56 64" aria-hidden="true" style="--y:' + (14 + (1 - pc) * 46 - 5).toFixed(1) + 'px">' +
        '<defs><clipPath id="' + jid + '"><path d="M14 16h28a5 5 0 0 1 5 5v31a8 8 0 0 1-8 8H17a8 8 0 0 1-8-8V21a5 5 0 0 1 5-5z"/></clipPath></defs>' +
        '<path class="jar-fondo" d="M14 16h28a5 5 0 0 1 5 5v31a8 8 0 0 1-8 8H17a8 8 0 0 1-8-8V21a5 5 0 0 1 5-5z"/>' +
        '<g clip-path="url(#' + jid + ')"><g class="jar-nivel"><path class="jar-ola" d="M-56 5q7-5 14 0t14 0 14 0 14 0 14 0 14 0 14 0 14 0V80H-56z"/></g></g>' +
        '<path class="jar-borde" d="M14 16h28a5 5 0 0 1 5 5v31a8 8 0 0 1-8 8H17a8 8 0 0 1-8-8V21a5 5 0 0 1 5-5z"/><rect class="jar-tapa" x="16" y="7" width="24" height="7" rx="2.5"/>' +
        (nueva && pc > 0 ? '<circle class="jar-moneda" cx="28" cy="0" r="4.5"/>' : "") +
        "</svg>";
      return '<div class="goal' + (done ? " cumplida" : "") + '" data-id="' + esc(g.id) + '"><div class="goal-top">' + anillo + '<input class="field name" data-f="nombre" value="' + esc(g.nombre) + '" aria-label="Nombre de la meta">' + delBtn(g.nombre) + "</div>" +
        '<div class="goal-fields"><label>Objetivo<input class="field" data-f="objetivo" type="number" inputmode="numeric" step="10000" min="0" value="' + g.objetivo + '"></label>' +
        '<label>Ahorrado<input class="field" data-f="ahorrado" type="number" inputmode="numeric" step="10000" min="0" value="' + g.ahorrado + '"></label>' +
        '<label>Fecha límite<input class="field" data-f="fecha" type="month" value="' + esc(g.fecha) + '"></label></div>' +
        '<div class="bar" role="img" aria-label="' + pctf(Math.min(ratio, 1)) + ' completado"><div class="fill' + (done ? " done" : "") + '" style="width:' + (Math.min(ratio, 1) * 100).toFixed(1) + '%"></div></div>' +
        '<div class="goal-note">' + pctf(Math.min(ratio, 1)) + " · " + note + "</div></div>";
    }).join("") : '<p class="empty">Aún no tienes metas.</p>') + '</div>' +
      (ocultas > 0 ? '<div class="metas-mas">' + "" + "<p>" + (ocultas === 1 ? "Tu otra meta sigue guardada." : "Tus otras " + ocultas + " metas siguen guardadas.") + ' Con Premium las ves y las sigues.</p><button class="btn premium-btn" type="button" data-premium-metas>Ver Premium</button></div>' : "") +
      '<button class="add-btn" type="button" id="add-meta">+ Agregar meta</button>';
  }
  $("metas-body").addEventListener("change", onMetaInput);
  $("metas-body").addEventListener("input", function (e) { if (e.target.dataset.f === "nombre") onMetaInput(e); });
  function onMetaInput(e) {
    var t = e.target, card = t.closest(".goal"); if (!card || !t.dataset.f) return;
    var g = state.metas.find(function (x) { return x.id === card.dataset.id; }); if (!g) return;
    var f = t.dataset.f, antesCumplida = g.objetivo > 0 && g.ahorrado >= g.objetivo;
    if (f === "nombre") { g.nombre = t.value.slice(0, 60); changed(); return; }
    if (f === "fecha") g.fecha = validKey(t.value) ? t.value : "";
    else g[f] = Math.max(0, num(t.value));
    changed(); renderMetas();
    if (!antesCumplida && g.objetivo > 0 && g.ahorrado >= g.objetivo) { celebrar(); toast("¡Meta cumplida: <b>" + esc(g.nombre || "tu meta") + "</b>!"); }
    var again = $("metas-body").querySelector('.goal[data-id="' + g.id + '"] [data-f="' + f + '"]'); if (again) again.focus();
  }
  $("metas-body").addEventListener("click", function (e) {
    if (e.target.closest("[data-premium-metas]")) { openPremium("Con Finti gratis tienes 1 meta. Con Premium tienes todas las que quieras."); return; }
    if (e.target.closest("#add-meta")) {
      // Gratis: 1 meta (decisión del dueño, 17 de noviembre de 2026). Quien ya tenía más las conserva.
      if (!hasPremium() && state.metas.length >= 1) { openPremium("Con Finti gratis tienes 1 meta. Con Premium tienes todas las que quieras."); return; }
      var g = { id: rid("m"), nombre: "Nueva meta", objetivo: 0, ahorrado: 0, fecha: addMonths(nowKey(), 6) };
      state.metas.push(g); changed(); renderMetas();
      var el = $("metas-body").querySelector('.goal[data-id="' + g.id + '"] [data-f="nombre"]'); if (el) { el.focus(); el.select(); }
      return;
    }
    var b = e.target.closest("[data-del]"); if (!b) return;
    var id = b.closest(".goal").dataset.id;
    state.metas = state.metas.filter(function (x) { return x.id !== id; }); changed(); renderMetas();
  });

