  // ===================== Sitio propio: pagos con Wompi, licencia y respaldo =====================
  var webPrecio = 0, webListo = false;
  function descargar(blob, nombre) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function webStatus(t, cls) { var el = $("web-status"); el.textContent = t; el.className = "msg" + (cls ? " " + cls : ""); }
  function api(path, opts) {
    return fetch(path, opts).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); });
  }
  // La configuración del sitio se pide una sola vez por apertura y la comparten todas las partes de la app.
  var configPromesa = null;
  function configApp() {
    if (!configPromesa) configPromesa = api("/api/config").then(function (j) { if (j._status !== 200) throw j; return j; }).catch(function (e) { configPromesa = null; throw e; });
    return configPromesa;
  }
  function guardarLicencia(ref, token) {
    licencia = { ref: ref, token: token };
    try { localStorage.setItem(LIC_KEY, JSON.stringify(licencia)); localStorage.removeItem(PAGO_KEY); } catch (e) {}
    if (WEB && cuenta) subirLicencia();
    renderAll(); renderPremium();
  }
  function revisarPago(ref, extra, intentos) {
    var q = "/api/licencia?ref=" + encodeURIComponent(ref) + extra;
    return api(q).then(function (j) {
      if (j.estado === "APROBADO" && j.token) {
        guardarLicencia(ref, j.token);
        celebrar();
        webStatus("¡Pago aprobado! Premium ya está activo. Tu referencia es " + ref + ".", "ok");
        return;
      }
      if (j.estado === "PENDIENTE" && intentos > 0) {
        webStatus("Tu pago está en proceso. Esperando la confirmación de Wompi…");
        setTimeout(function () { revisarPago(ref, extra, intentos - 1); }, 4000);
        return;
      }
      if (j.estado === "PENDIENTE") { webStatus("Wompi aún no confirma el pago. Si pagaste por PSE o Nequi puede tardar unos minutos: vuelve a abrir esta ventana más tarde."); return; }
      if (j.estado === "DECLINED" || j.estado === "VOIDED" || j.estado === "ERROR") {
        try { localStorage.removeItem(PAGO_KEY); } catch (e) {}
        webStatus("El pago no se aprobó. Puedes intentarlo de nuevo.", "err"); return;
      }
      webStatus(j.error || "No pudimos verificar el pago ahora. Intenta de nuevo en unos minutos.", "err");
    }, function () { webStatus("No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.", "err"); });
  }
  function webInit() {
    $("backup-row").hidden = false;
    configApp().then(function (j) { webPrecio = +j.precioCOP || 0; webListo = !!j.listo; if (!$("dlg-premium").hidden) renderPremium(); }, function () {});
    var revisada = 0; try { revisada = +localStorage.getItem(LIC_KEY + "-revisada") || 0; } catch (e) {}
    if (licencia && Date.now() - revisada > 86400000) {   // una vez al día basta
      api("/api/licencia?ref=" + encodeURIComponent(licencia.ref) + "&token=" + encodeURIComponent(licencia.token)).then(function (j) {
        if (j.valido === false) { licencia = null; try { localStorage.removeItem(LIC_KEY); } catch (e) {} renderAll(); }
        else if (j.valido === true) { try { localStorage.setItem(LIC_KEY + "-revisada", String(Date.now())); } catch (e) {} }
      }, function () {});
    }
    setTimeout(regaloDelEnlace, 300);
    var params = new URLSearchParams(location.search), pend = null;
    try { pend = JSON.parse(localStorage.getItem(PAGO_KEY) || "null"); } catch (e) {}
    var txId = params.get("id");
    if (txId || params.has("env")) { try { history.replaceState(null, "", location.pathname); } catch (e) {} }
    if (pend && pend.ref && !licencia) {
      openPremium();
      webStatus("Verificando tu pago…");
      revisarPago(pend.ref, txId ? "&id=" + encodeURIComponent(txId) : "&email=" + encodeURIComponent(pend.email || ""), txId ? 20 : 3);
    }
  }
  $("btn-pagar").addEventListener("click", function () {
    if (APP_ANDROID.activa) return;   // en la app de Google Play no se cobra con Wompi
    var email = $("f-email").value.trim(), btn = this;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { webStatus("Escribe un correo válido para recibir el comprobante.", "err"); $("f-email").focus(); return; }
    if (!$("f-acepto-compra").checked) { webStatus("Para pagar, confirma que eres mayor de edad y que aceptas las condiciones de compra.", "err"); $("f-acepto-compra").focus(); return; }
    btn.disabled = true; webStatus("Preparando el pago…"); metrica("inicio_pago", "dia", 3);
    api("/api/crear-pago", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email, acepto: { v: LEGAL_V, mayor: true }, invita: invitadoPor() || undefined }) }).then(function (j) {
      if (!j.url || !j.ref) throw j;
      try { localStorage.setItem(PAGO_KEY, JSON.stringify({ ref: j.ref, email: email.toLowerCase() })); } catch (e) {}
      webStatus("Te llevamos a Wompi…");
      location.href = j.url;
    }).catch(function (j) {
      webStatus((j && j.error) || "No se pudo iniciar el pago. Intenta de nuevo.", "err");
      btn.disabled = false;
    });
  });
