  // ===================== Diálogos =====================
  var lastFocus = null, onCloseHooks = {};
  function openDlg(id, focusSel) {
    lastFocus = document.activeElement;
    var d = $(id); d.hidden = false;
    var f = focusSel ? d.querySelector(focusSel) : null;
    (f || d.querySelector("[data-close]")).focus();
  }
  function closeDlg(id) {
    var d = $(id); if (d.hidden) return;
    d.hidden = true;
    if (onCloseHooks[id]) onCloseHooks[id]();
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }
  ["dlg-colores", "dlg-premium", "dlg-mes", "dlg-cats", "dlg-add", "dlg-pagar", "dlg-avisos", "dlg-bandeja", "dlg-fuentes", "dlg-cuenta", "dlg-perfil", "dlg-inicio", "dlg-extracto", "dlg-preguntas", "dlg-guias", "dlg-privado", "dlg-indep", "dlg-negocio", "dlg-invita", "dlg-charla", "dlg-aprendidas", "dlg-cat", "dlg-ysi", "dlg-recibo", "dlg-reto", "dlg-buscar", "dlg-donde", "dlg-deuda"].forEach(function (id) {
    var d = $(id);
    d.addEventListener("click", function (e) { if (e.target === d || e.target.closest("[data-close]")) closeDlg(id); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    ["dlg-buscar", "dlg-reto", "dlg-recibo", "dlg-ysi", "dlg-cat", "dlg-aprendidas", "dlg-charla", "dlg-invita", "dlg-negocio", "dlg-indep", "dlg-privado", "dlg-guias", "dlg-preguntas", "dlg-extracto", "dlg-inicio", "dlg-perfil", "dlg-cuenta", "dlg-fuentes", "dlg-pagar", "dlg-avisos", "dlg-bandeja", "dlg-add", "dlg-cats", "dlg-mes", "dlg-premium", "dlg-colores"].some(function (id) { if (!$(id).hidden) { closeDlg(id); return true; } return false; });
  });
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-open-premium]")) {
      ["dlg-colores", "dlg-mes", "dlg-cats"].forEach(function (id) { if (!$(id).hidden) closeDlg(id); });
      openPremium();
    }
  });

