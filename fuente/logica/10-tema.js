  // ===================== Tema =====================
  var root = document.documentElement, previewTema = null, previewAcento = null;
  function hostIsDark() {
    var t = root.getAttribute("data-theme");
    if (t === "dark") return true;
    if (t === "light") return false;
    try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { return false; }
  }
  function resolvedDark() { var m = state.prefs.modo; return m === "oscuro" ? true : m === "claro" ? false : hostIsDark(); }
  function luminance(hex) {
    var c = [1, 3, 5].map(function (i) { var v = parseInt(hex.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function mezclaNegro(hex, f) { return "#" + [1, 3, 5].map(function (i) { var v = Math.round(parseInt(hex.substr(i, 2), 16) * (1 - f)); return ("0" + v.toString(16)).slice(-2); }).join(""); }
  function fuerteDe(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || "")) hex = /^#[0-9a-f]{6}$/i.test(state.prefs.acento || "") ? state.prefs.acento : "#2e5bff";
    var c = hex;
    for (var k = 0; k < 14 && 1.05 / (luminance(c) + 0.05) < 4.6; k++) c = mezclaNegro(hex, (k + 1) * 0.06);
    return c;
  }
  function themeColors(id, dark, acento) {
    var base, out = {}, k;
    if (id === "personal") {
      base = THEME_BY_ID.finti[dark ? "dark" : "light"];
      var a = acento || state.prefs.acento;
      for (k in base) out[k] = base[k];
      out.accent = dark ? "color-mix(in srgb, " + a + " 70%, #ffffff)" : a;
      out.soft = "color-mix(in srgb, " + a + (dark ? " 22%, " : " 12%, ") + base.surface + ")";
      out.bg = "color-mix(in srgb, " + a + (dark ? " 6%, " : " 4%, ") + base.bg + ")";
      out.line = "color-mix(in srgb, " + a + " 10%, " + base.line + ")";
      out.onAccent = dark ? base.bg : (luminance(a) > 0.5 ? "#111111" : "#ffffff");
      return out;
    }
    base = (THEME_BY_ID[id] || THEME_BY_ID.finti)[dark ? "dark" : "light"];
    for (k in base) out[k] = base[k];
    out.onAccent = dark ? base.bg : "#ffffff";
    return out;
  }
  function activeTema() {
    if (previewTema) return previewTema;
    var t = state.prefs.tema;
    if (t === "personal" || (THEME_BY_ID[t] && THEME_BY_ID[t].premium)) return hasPremium() ? t : "finti";
    return THEME_BY_ID[t] ? t : "finti";
  }
  function applyTheme() {
    var dark = resolvedDark();
    var c = themeColors(activeTema(), dark, previewAcento);
    var sem = SEM[dark ? "dark" : "light"];
    var map = { "--bg": c.bg, "--surface": c.surface, "--ink": c.ink, "--muted": c.muted, "--line": c.line,
      "--accent": c.accent, "--accent-soft": c.soft, "--on-accent": c.onAccent,
      "--good": sem.good, "--good-soft": sem.goodSoft, "--warn": sem.warn, "--warn-soft": sem.warnSoft, "--bad": sem.bad, "--bad-soft": sem.badSoft };
    var fu = fuerteDe(c.fuerte || c.accent);
    map["--fuerte"] = fu; map["--fuerte-2"] = mezclaNegro(fu, 0.38); map["--fuerte-luz"] = "color-mix(in srgb, " + fu + " 72%, #ffffff)";
    map["--sombra-acento"] = "color-mix(in srgb, " + fu + " 55%, transparent)";
    for (var k in map) root.style.setProperty(k, map[k]);
    root.style.colorScheme = dark ? "dark" : "light";
    if (dark) root.setAttribute("data-modo-oscuro", ""); else root.removeAttribute("data-modo-oscuro");
    // Barra del sistema (estado del celular) del mismo color del fondo
    temaBg = c.bg; colorSistema();
  }
  var temaBg = "#09090b";
  // Barra del sistema: del azul de la banda mientras se ve la banda de Inicio; si no, del color del fondo
  function colorSistema() {
    var mt = document.querySelector('meta[name="theme-color"]'); if (!mt) return;
    var b = $("banda"), sobre = document.body.classList.contains("sobre-banda");
    mt.setAttribute("content", sobre ? (b && b.classList.contains("dia") ? "#4570ff" : "#2347d4") : temaBg);
  }
  try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { applyTheme(); if (!$("dlg-colores").hidden) renderThemeGrid(); }); } catch (e) {}
  try { new MutationObserver(function () { applyTheme(); }).observe(root, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) {}

