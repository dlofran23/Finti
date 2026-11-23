  // ===================== Ayuda y PQR (con radicado) =====================
  // Ley 1480, art. 50, literal g (Ley 2439 de 2024): atención en la misma plataforma, con radicado, fecha y hora, y seguimiento.
  var PQR_KEY = "fintelligente-pqr", pqrRecien = false;   // pqrRecien: se acaba de radicar (se muestra el radicado)
  function pqrMias() { try { var l = JSON.parse(localStorage.getItem(PQR_KEY) || "[]"); return Array.isArray(l) ? l.filter(function (x) { return x && /^PQR-\d{8}-[A-Z0-9]{6}$/.test(x.r); }).slice(0, 10) : []; } catch (e) { return []; } }
  function pqrGuardar(r, c) { var l = pqrMias().filter(function (x) { return x.r !== r; }); l.unshift({ r: r, c: c }); try { localStorage.setItem(PQR_KEY, JSON.stringify(l.slice(0, 10))); } catch (e) {} }
  function pqrModo(m) {
    [].forEach.call(document.querySelectorAll("#pqr-modo [data-pqr-modo]"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.pqrModo === m)); });
    $("pqr-hecho").hidden = m !== "nueva" || !pqrRecien; $("pqr-form").hidden = m !== "nueva" || pqrRecien; $("pqr-consulta").hidden = m !== "consultar";
    if (m === "consultar") {
      var l = pqrMias();
      $("pqr-mias").hidden = !l.length;
      $("pqr-mias").innerHTML = l.length ? "<span>Tus solicitudes en este dispositivo:</span>" + l.map(function (x) { return '<button type="button" class="chip" data-pqr-r="' + esc(x.r) + '" data-pqr-c="' + esc(x.c) + '">' + esc(x.r) + "</button>"; }).join("") : "";
    }
  }
  function abrirPqr(modo) {
    $("pqr-msg").textContent = ""; $("pqr-c-msg").textContent = "";
    var correo = cuenta && cuenta.usuario && cuenta.usuario.correo;
    if (correo && !$("pqr-correo").value) $("pqr-correo").value = correo;
    if (correo && !$("pqr-c-correo").value) $("pqr-c-correo").value = correo;
    if (cuenta && cuenta.usuario && cuenta.usuario.nombre && !$("pqr-nombre").value) $("pqr-nombre").value = cuenta.usuario.nombre;
    if (licencia && licencia.ref && !$("pqr-ref").value) $("pqr-ref").value = licencia.ref;
    pqrModo(modo || "nueva");
    openDlg("dlg-pqr", modo === "consultar" ? "#pqr-c-rad" : "#pqr-tipo");
  }
  $("btn-pqr").addEventListener("click", function () { abrirPqr(); });
  $("pqr-modo").addEventListener("click", function (e) { var b = e.target.closest("[data-pqr-modo]"); if (b) pqrModo(b.dataset.pqrModo); });
  $("pqr-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = $("pqr-msg"), btn = $("pqr-enviar");
    var d = { tipo: $("pqr-tipo").value, nombre: $("pqr-nombre").value.trim(), correo: $("pqr-correo").value.trim(), ref: $("pqr-ref").value.trim(), mensaje: $("pqr-mensaje").value.trim(), acepto: $("pqr-acepto").checked, web: $("pqr-web").value };
    var falta = !d.tipo ? ["Elige el tipo de solicitud.", "pqr-tipo"] : d.nombre.length < 2 ? ["Escribe tu nombre.", "pqr-nombre"] : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.correo) ? ["Escribe un correo válido: ahí te llega el radicado.", "pqr-correo"] :
      d.mensaje.length < 10 ? ["Cuéntanos un poco más (mínimo 10 caracteres).", "pqr-mensaje"] : !d.acepto ? ["Marca la autorización para que podamos atenderte.", "pqr-acepto"] : null;
    if (falta) { msg.textContent = falta[0]; msg.className = "msg err"; $(falta[1]).focus(); return; }
    btn.disabled = true; msg.textContent = "Enviando…"; msg.className = "msg";
    api("/api/pqr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(function (j) {
      if (j._status !== 200 || !j.radicado) { msg.textContent = j.error || "No pudimos radicar tu solicitud. Intenta de nuevo."; msg.className = "msg err"; return; }
      pqrGuardar(j.radicado, d.correo);
      msg.textContent = "";
      $("pqr-hecho-rad").textContent = j.radicado;
      $("pqr-hecho-fechas").innerHTML = "Recibida el <b>" + esc(j.recibidoTexto) + "</b> (hora de Colombia). Te respondemos a más tardar el <b>" + esc(j.venceTexto) + "</b>.";
      $("pqr-hecho-correo").textContent = j.correoEnviado ? "Te enviamos el radicado a " + d.correo + "." : "Guarda este número: con él y tu correo consultas el estado.";
      pqrRecien = true; $("pqr-form").hidden = true; $("pqr-hecho").hidden = false; $("pqr-hecho").focus();
      $("pqr-mensaje").value = ""; $("pqr-acepto").checked = false;
      sonar("monedas"); vibrar(15);
    }, function () { msg.textContent = "No hay conexión. Revisa tu internet e intenta de nuevo; tu mensaje sigue aquí."; msg.className = "msg err"; })
      .then(function () { btn.disabled = false; });
  });
  $("pqr-copiar").addEventListener("click", function () { var r = $("pqr-hecho-rad").textContent; try { navigator.clipboard.writeText(r); toast("Radicado copiado: " + r); } catch (e) {} });
  $("pqr-otra").addEventListener("click", function () { pqrRecien = false; $("pqr-hecho").hidden = true; $("pqr-form").hidden = false; $("pqr-tipo").value = ""; $("pqr-tipo").focus(); });
  $("pqr-mias").addEventListener("click", function (e) { var b = e.target.closest("[data-pqr-r]"); if (!b) return; $("pqr-c-rad").value = b.dataset.pqrR; $("pqr-c-correo").value = b.dataset.pqrC; $("pqr-c-ver").click(); });
  $("pqr-consulta").addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = $("pqr-c-msg"), r = $("pqr-c-rad").value.trim(), c = $("pqr-c-correo").value.trim(), caja = $("pqr-estado");
    if (!r || !c) { msg.textContent = "Escribe el radicado y el correo."; msg.className = "msg err"; return; }
    msg.textContent = "Buscando…"; msg.className = "msg"; caja.hidden = true;
    api("/api/pqr?radicado=" + encodeURIComponent(r) + "&correo=" + encodeURIComponent(c)).then(function (j) {
      if (j._status !== 200) { msg.textContent = j.error || "No encontramos esa solicitud."; msg.className = "msg err"; return; }
      msg.textContent = "";
      caja.innerHTML = '<p class="pqr-rad"><span>Radicado</span><b>' + esc(j.radicado) + '</b></p><p><span class="pqr-chip" data-estado="' + esc(j.estado) + '">' + esc(j.estado) + "</span> " + esc(j.tipoNombre) + "</p>" +
        "<p>Recibida el " + esc(j.recibidoTexto) + ". Fecha límite de respuesta: " + esc(j.venceTexto) + ".</p>" +
        (j.respuestas.length ? j.respuestas.map(function (x) { return '<div class="pqr-resp"><small>Respuesta del ' + esc(x.tTexto) + '</small><p>' + esc(x.texto) + "</p></div>"; }).join("") : '<p class="hint">Aún no hay respuesta. Te avisamos por correo.</p>');
      caja.hidden = false;
    }, function () { msg.textContent = "No hay conexión. Intenta de nuevo."; msg.className = "msg err"; });
  });
  function pqrDelEnlace() { if (location.hash === "#pqr") { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} abrirPqr(); } }
  window.addEventListener("hashchange", pqrDelEnlace);
  setTimeout(pqrDelEnlace, 0);
  function regaloDelEnlace() {
    var m = /^#regalo=([A-Za-z0-9-]{10,20})$/.exec(location.hash);
    if (!m || !WEB) return;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    if (licencia) { openPremium(); webStatus("Premium ya está activo en este dispositivo. Puedes regalarle el código a otra persona."); return; }
    openPremium();
    $("web-regalo").open = true; $("f-regalo").value = m[1].toUpperCase();
    webStatus("¡Te regalaron Premium! Escribe tu correo y toca Activar.");
    setTimeout(function () { $(($("f-regalo-email").value ? "btn-regalo" : "f-regalo-email")).focus(); }, 80);
  }
  window.addEventListener("hashchange", regaloDelEnlace);
  $("btn-restaurar").addEventListener("click", function () {
    var ref = $("f-ref").value.trim().toUpperCase(), email = $("f-email2").value.trim();
    if (!/^PRE-[A-Z2-9]{12}$/.test(ref)) { webStatus("La referencia tiene el formato PRE- seguido de 12 caracteres. Está en el correo de Wompi.", "err"); return; }
    if (!email) { webStatus("Escribe el correo con el que pagaste.", "err"); return; }
    webStatus("Verificando…");
    revisarPago(ref, "&email=" + encodeURIComponent(email), 0);
  });
  // Respaldo: exportar e importar las cifras de este dispositivo
  $("btn-export").addEventListener("click", function () {
    var data = JSON.stringify({ app: "presupuesto-mensual", version: 3, exportado: new Date().toISOString(), state: state }, null, 1);
    descargar(new Blob([data], { type: "application/json" }), "respaldo-finti-" + new Date().toISOString().slice(0, 10) + ".json");
    $("backup-status").textContent = "Respaldo descargado."; $("backup-status").className = "msg ok";
  });
  $("lbl-import").addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("f-import").click(); } });
  $("f-import").addEventListener("change", function () {
    var f = this.files && this.files[0], st = $("backup-status"); if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var j = JSON.parse(rd.result), s = j && j.state ? j.state : j;
        if (!validState(s)) throw 0;
        try { localStorage.setItem(localKey + "-antes-de-importar", JSON.stringify(state)); } catch (e) {}
        state = sanitize(s); changed(); renderAll();
        st.textContent = "Respaldo importado."; st.className = "msg ok";
      } catch (e) { st.textContent = "Ese archivo no es un respaldo válido del presupuesto."; st.className = "msg err"; }
    };
    rd.readAsText(f);
    this.value = "";
  });


