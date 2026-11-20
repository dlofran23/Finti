  // ===================== Colores =====================
  var LOCK = '<svg width="10" height="11" viewBox="0 0 10 11" aria-hidden="true"><rect x="1" y="5" width="8" height="6" rx="1.5" fill="currentColor"/><path d="M3 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>';
  // --- Paleta de la persona: un color por categoría, con aviso si dos se parecen demasiado ---
  var MUESTRAS = ["#7c5cff", "#4d7cfe", "#38bdf8", "#22d3ee", "#19c3a0", "#2fbf71", "#9bd84a", "#c6f432", "#ffc53d", "#ff9f1c", "#ff7a59", "#ff5c9a", "#b06bff", "#8e8aa0"], catColAbierta = "";
  function aLab(hex) {
    var c = [1, 3, 5].map(function (i) { var v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    var x = (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047, y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722, z = (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883;
    var f = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }
  function distColor(a, b) { var p = aLab(a), q = aLab(b); return Math.sqrt(Math.pow(p[0] - q[0], 2) + Math.pow(p[1] - q[1], 2) + Math.pow(p[2] - q[2], 2)); }
  function parecidos() {
    var l = cats(), out = [];
    var p = state.prefs.catColores || {};   // solo se avisa si al menos uno de los dos lo eligió la persona
    for (var i = 0; i < l.length; i++) for (var j = i + 1; j < l.length; j++) if ((p[l[i].id] || p[l[j].id]) && distColor(catColor(l[i].id), catColor(l[j].id)) < 22) out.push([l[i], l[j]]);
    return out;
  }
  function renderCatColores() {
    var propios = state.prefs.catColores || {};
    $("catcol").innerHTML = cats().map(function (c) {
      var col = catColor(c.id), abierta = catColAbierta === c.id;
      return '<div class="catcol-fila' + (abierta ? " abierta" : "") + '" style="--c:' + col + '"><button type="button" class="catcol-b" data-catcol="' + esc(c.id) + '" aria-expanded="' + abierta + '">' +
        '<span>' + esc(c.name) + '</span><i class="catcol-m" aria-hidden="true"></i></button>' +
        (abierta ? '<div class="catcol-muestras" role="radiogroup" aria-label="Color de ' + esc(c.name) + '">' + MUESTRAS.map(function (m) {
          return '<button type="button" role="radio" aria-checked="' + (m === col) + '" data-muestra="' + m + '" style="--m:' + m + '" aria-label="Color ' + m + '"></button>';
        }).join("") + "</div>" : "") + "</div>";
    }).join("");
    var par = parecidos();
    $("catcol-aviso").hidden = !par.length;
    $("catcol-aviso").innerHTML = par.length ? "<span><b>" + esc(par[0][0].name) + "</b> y <b>" + esc(par[0][1].name) + "</b> se parecen mucho. Cambia uno de los dos para que se distingan en el anillo y las gráficas.</span>" : "";
    $("catcol-reset").hidden = !Object.keys(propios).length;
  }
  $("catcol").addEventListener("click", function (e) {
    var m = e.target.closest("[data-muestra]");
    if (m) {
      state.prefs.catColores = state.prefs.catColores || {};
      if (CAT_COLOR[catColAbierta] === m.dataset.muestra) delete state.prefs.catColores[catColAbierta]; else state.prefs.catColores[catColAbierta] = m.dataset.muestra;
      changed(); renderCatColores(); renderAll(); sonar("nota", MUESTRAS.indexOf(m.dataset.muestra)); return;
    }
    var b = e.target.closest("[data-catcol]"); if (!b) return;
    catColAbierta = catColAbierta === b.dataset.catcol ? "" : b.dataset.catcol; renderCatColores();
  });
  $("catcol-reset").addEventListener("click", function () { state.prefs.catColores = {}; catColAbierta = ""; changed(); renderCatColores(); renderAll(); });
  function aplicarLetra() { root.classList.toggle("letra-grande", !!state.prefs.letraGrande); }
  $("f-letra").addEventListener("change", function () { state.prefs.letraGrande = this.checked; aplicarLetra(); changed(); setTimeout(ajustarCifras, 50); });
  $("f-sonidos").addEventListener("change", function () { state.prefs.sonidos = this.checked; changed(); if (this.checked) sonar("monedas"); });
  function renderThemeGrid() {
    var dark = resolvedDark(), current = activeTema(), prem = hasPremium();
    $("theme-grid").innerHTML = THEMES.map(function (t) {
      var c = t[dark ? "dark" : "light"], locked = t.premium && !prem;
      var tag = t.premium ? '<span class="chip premium">' + (locked ? LOCK + " " : "") + "Premium</span>" : '<span class="chip free">Gratis</span>';
      return '<button type="button" class="theme-card" data-tema="' + t.id + '" aria-pressed="' + (current === t.id) + '">' +
        '<span class="swatch"><span class="sw-bg" style="background:' + c.bg + '"><span class="sw-line" style="background:' + c.ink + ';width:70%"></span><span class="sw-line" style="background:' + c.line + '"></span><span class="sw-line" style="background:' + c.muted + ';width:50%"></span></span>' +
        '<span class="sw-accent" style="background:' + c.surface + '"><span class="sw-dot" style="background:' + c.accent + '"></span></span></span>' +
        '<span class="theme-name"><span>' + esc(t.name) + " </span>" + tag + (locked ? '<span class="sr-only">, bloqueado</span>' : "") + "</span></button>";
    }).join("");
    Array.prototype.forEach.call($("seg-modo").querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.modo === state.prefs.modo)); });
    $("chip-propio").innerHTML = (prem ? "" : LOCK + " ") + "Premium";
    $("f-acento").value = previewAcento || state.prefs.acento;
    $("preview-note").hidden = !(previewTema && !prem);
    $("colores-upsell").hidden = prem;
  }
  $("btn-colores").addEventListener("click", function () { renderThemeGrid(); catColAbierta = ""; renderCatColores(); $("f-sonidos").checked = state.prefs.sonidos !== false; $("f-letra").checked = !!state.prefs.letraGrande; $("f-temporada").checked = state.prefs.temporada !== false; openDlg("dlg-colores", '#theme-grid [aria-pressed="true"]'); });
  onCloseHooks["dlg-colores"] = function () { if (previewTema || previewAcento) { previewTema = null; previewAcento = null; applyTheme(); } };
  $("theme-grid").addEventListener("click", function (e) {
    var b = e.target.closest("[data-tema]"); if (!b) return;
    var t = THEME_BY_ID[b.dataset.tema];
    if (t.premium && !hasPremium()) { previewTema = t.id; previewAcento = null; applyTheme(); renderThemeGrid(); return; }
    previewTema = null; previewAcento = null;
    if (state.prefs.tema !== t.id) { state.prefs.tema = t.id; changed(); }
    applyTheme(); renderThemeGrid();
  });
  $("seg-modo").addEventListener("click", function (e) {
    var b = e.target.closest("[data-modo]"); if (!b) return;
    if (state.prefs.modo !== b.dataset.modo) { state.prefs.modo = b.dataset.modo; changed(); }
    applyTheme(); renderThemeGrid(); renderHist();
  });
  var acentoTimer = null;
  $("f-acento").addEventListener("input", function () {
    var v = this.value;
    if (!hasPremium()) { previewAcento = v; previewTema = "personal"; applyTheme(); $("preview-note").hidden = false; return; }
    state.prefs.acento = v; state.prefs.tema = "personal"; previewTema = null; previewAcento = null;
    applyTheme();
    clearTimeout(acentoTimer); acentoTimer = setTimeout(function () { changed(); renderThemeGrid(); }, 250);
  });

