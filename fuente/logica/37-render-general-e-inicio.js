  // ===================== Render general e inicio =====================
  function renderAll() {
    applyTheme(); renderPremiumButton(); renderHeader(); renderMonthNav(); renderIngresos(); renderGastos(); recompute();
    renderMetas(); renderDeudas(); renderNotas(); renderReto(); renderAlertas(); renderTrabajo();
    renderPorPagar(); renderCuentas(); renderBandeja(); renderDudas();
    if (WEB) renderCuentaUI(); else renderLateral();
    pintarNudgeInicio();
    $("feat-correo").hidden = !WEB;
    $("sec-ia").hidden = !IA_ON; $("feat-ia").hidden = !IA_ON;
    if (IA_ON) renderIA();
    renderMeDeben();
    aplicarLetra();
    aplicarTemporada();
    renderHistPlay();
    renderAlcancia();
    ajustarCifras();
  }

