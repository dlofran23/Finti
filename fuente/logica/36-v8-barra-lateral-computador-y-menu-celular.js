  // ===================== v8 · Barra lateral (computador) y menú ☰ (celular) =====================
  (function () {
    var lat = $("lateral"), fondo = $("lat-fondo"), btn = $("btn-menu"), movil = window.matchMedia("(max-width: 1023px)");
    function abierta() { return lat.classList.contains("abierta"); }
    function abrir() { lat.classList.add("abierta"); fondo.hidden = false; btn.setAttribute("aria-expanded", "true"); lat.inert = false; setTimeout(function () { $("lat-cerrar").focus(); }, 60); }
    function cerrar(foco) { if (!abierta()) return; lat.classList.remove("abierta"); fondo.hidden = true; btn.setAttribute("aria-expanded", "false"); if (movil.matches) lat.inert = true; if (foco) btn.focus(); }
    function ajustar() { if (movil.matches) { if (!abierta()) lat.inert = true; } else { lat.classList.remove("abierta"); fondo.hidden = true; lat.inert = false; } }
    if (movil.addEventListener) movil.addEventListener("change", ajustar); else movil.addListener(ajustar);
    ajustar();
    btn.addEventListener("click", function () { if (abierta()) cerrar(true); else abrir(); });
    $("lat-cerrar").addEventListener("click", function () { cerrar(true); });
    fondo.addEventListener("click", function () { cerrar(true); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && abierta()) { e.stopPropagation(); cerrar(true); } }, true);
    lat.addEventListener("click", function (e) {
      var t = e.target.closest("[data-clic]");
      if (t) { var dest = $(t.dataset.clic); cerrar(false); if (dest) dest.click(); return; }
      if (e.target.closest("button[data-tab]")) cerrar(false);
    });
    function registrar() { cerrar(false); $("fab-add").click(); }
    $("lat-registrar").addEventListener("click", registrar);
    $("btn-registrar-top").addEventListener("click", registrar);
    $("barra-registrar").addEventListener("click", function () { vibrar(12); registrar(); });
    $("lat-cuenta").addEventListener("click", function () { cerrar(false); $("btn-cuenta").click(); });
    if (WEB) [].forEach.call(document.querySelectorAll(".lat-web"), function (b) { b.hidden = false; });
  })();
  function renderLecturaApp() {
    var n = $("nudge-lectura"); if (!n) return;
    n.hidden = !(WEB && APP_ANDROID.activa && !APP_ANDROID.lectura);
    $("nudge-lectura-si").href = INTENT_AJUSTES;
  }
  function renderLateral() {
    var c = $("lat-cuenta"), visible = !$("btn-cuenta").hidden;
    c.hidden = !visible;
    if (visible) {
      if (typeof cuenta !== "undefined" && cuenta) {
        var u = cuenta.usuario;
        c.innerHTML = '<span class="avatar" aria-hidden="true">' + esc(iniciales(u)) + '</span><span class="acct-name"><b>' + esc(u.nombre || u.correo) + '</b><span class="' + (cuenta.sucio ? "" : "ok") + '">' + (cuenta.sucio ? "Cambios por copiar" : "Guardado en la nube") + "</span></span>";
      } else {
        c.innerHTML = '<span class="avatar" aria-hidden="true"><svg class="ic"><use href="#i-cloud"/></svg></span><span class="acct-name"><b>Guardar en la nube</b><span>Con Google o tu correo</span></span>';
      }
    }
    $("lat-premium-t").textContent = hasPremium() ? "Premium activo" : "Premium";
    renderLecturaApp();
  }

