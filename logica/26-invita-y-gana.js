  // ===================== Invita y gana =====================
  // Tu enlace /#invita=AMIGO-XXXXXX. Si alguien compra Premium con él, recibes un código de Premium (FIN-…) que
  // puedes activar para ti o regalar. El código y su llave viven en tu presupuesto (y en tu copia cifrada).
  var INVITA_KEY = "fintelligente-invita-de", INVITA_DIAS = 60;
  (function () {
    var m = /^#invita=([A-Za-z0-9-]{6,14})$/.exec(location.hash || "");
    if (!m) return;
    try { localStorage.setItem(INVITA_KEY, JSON.stringify({ c: m[1].toUpperCase(), t: Date.now() })); } catch (e) {}
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  })();
  function invitadoPor() {
    try { var x = JSON.parse(localStorage.getItem(INVITA_KEY) || "null"); if (x && x.c && Date.now() - x.t < INVITA_DIAS * 864e5) return x.c; } catch (e) {}
    return "";
  }
  function enlaceInvita() { return location.origin + "/#invita=" + state.invita.codigo; }
  function pintarInvita() {
    var tiene = !!state.invita.codigo;
    $("inv-crear").hidden = tiene; $("inv-mio").hidden = !tiene;
    if (!tiene) return;
    $("inv-enlace").value = enlaceInvita();
    $("inv-premios").innerHTML = '<li class="empty">Revisando tus premios…</li>';
    api("/api/invita?codigo=" + encodeURIComponent(state.invita.codigo) + "&llave=" + encodeURIComponent(state.invita.llave)).then(function (j) {
      if (j._status !== 200) throw j;
      $("inv-cuenta").textContent = j.ventas ? (j.ventas === 1 ? "Una persona compró Premium con tu enlace." : j.ventas + " personas compraron Premium con tu enlace.") : "";
      $("inv-premios").innerHTML = j.premios.length ? j.premios.map(function (p) {
        var libre = p.estado === "libre";
        return '<li><div><b class="inv-cod">' + esc(p.codigo) + "</b><small>" + (libre ? "Sin usar" : p.estado === "usado" ? "Ya se usó" : "Anulado") + "</small></div>" +
          (libre ? (!hasPremium() ? '<button class="btn primary" type="button" data-activar="' + esc(p.codigo) + '">Activar para mí</button>' : "") +
          '<button class="btn" type="button" data-copiar-premio="' + esc(p.codigo) + '">Copiar</button>' : "") + "</li>";
      }).join("") : '<li class="empty">Aún no tienes premios. Cuando alguien compre Premium con tu enlace, tu código aparece aquí.</li>';
    }).catch(function () { $("inv-premios").innerHTML = '<li class="empty">No pudimos revisar tus premios. Revisa tu conexión e intenta más tarde.</li>'; });
  }
  function abrirInvita() {
    $("menu-mas").hidden = true; $("inv-msg").textContent = "";
    pintarInvita();
    openDlg("dlg-invita", state.invita.codigo ? "#inv-compartir" : "#inv-crear");
  }
  $("inv-crear").addEventListener("click", function () {
    var btn = this; btn.disabled = true; $("inv-msg").textContent = "Creando tu enlace…"; $("inv-msg").className = "msg";
    api("/api/invita", { method: "POST" }).then(function (j) {
      if (j._status !== 200 || !j.codigo || !j.llave) throw j;
      state.invita = { codigo: j.codigo, llave: j.llave }; changed();
      $("inv-msg").textContent = ""; pintarInvita(); $("inv-compartir").focus();
    }).catch(function (j) { $("inv-msg").textContent = (j && j.error) || "No hay conexión con el servidor. Intenta de nuevo."; $("inv-msg").className = "msg err"; })
      .then(function () { btn.disabled = false; });
  });
  function copiarTexto(t, btn, normal) {
    try { navigator.clipboard.writeText(t).then(function () { btn.textContent = "Copiado ✓"; setTimeout(function () { btn.textContent = normal; }, 1800); }, function () { btn.textContent = "Cópialo a mano"; }); }
    catch (e) { btn.textContent = "Cópialo a mano"; }
  }
  $("inv-compartir").addEventListener("click", function () {
    var txt = "Estoy organizando mi plata con Finti y me sirve. Pruébala gratis:", url = enlaceInvita(), btn = this;
    if (navigator.share) navigator.share({ title: "Finti", text: txt, url: url }).catch(function () {});
    else copiarTexto(txt + " " + url, btn, "Compartir mi enlace");
  });
  $("inv-copiar").addEventListener("click", function () { copiarTexto(enlaceInvita(), this, "Copiar"); });
  $("inv-premios").addEventListener("click", function (e) {
    var c = e.target.closest("[data-copiar-premio]");
    if (c) { copiarTexto(c.dataset.copiarPremio, c, "Copiar"); return; }
    var a = e.target.closest("[data-activar]");
    if (a) {
      closeDlg("dlg-invita");
      setTimeout(function () {
        openPremium(); $("web-regalo").open = true; $("f-regalo").value = a.dataset.activar;
        webStatus("Escribe tu correo y toca Activar."); $("f-regalo-email").focus();
      }, 200);
    }
  });
  $("btn-invita-menu").addEventListener("click", abrirInvita);
  $("btn-invita-menu").hidden = !WEB;
  window.FinInvita = { invitadoPor: invitadoPor };

  // Código de regalo (los crea el dueño en /panel). También llega como enlace: /#regalo=FIN-XXXXX-XXXXX
  $("btn-regalo").addEventListener("click", function () {
    var codigo = $("f-regalo").value.trim(), email = $("f-regalo-email").value.trim(), btn = this;
    if (!/^(fin)?[a-z2-9]{10}$/i.test(codigo.replace(/[^a-z0-9]/gi, ""))) { webStatus("El código tiene el formato FIN-XXXXX-XXXXX. Revisa que esté bien escrito.", "err"); $("f-regalo").focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { webStatus("Escribe tu correo. Con él puedes activar Premium en otro dispositivo.", "err"); $("f-regalo-email").focus(); return; }
    btn.disabled = true; webStatus("Activando…");
    api("/api/regalo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo: codigo, email: email }) }).then(function (j) {
      if (!j.ref || !j.token) throw j;
      guardarLicencia(j.ref, j.token);
      $("f-regalo").value = "";
      celebrar();
      webStatus("¡Listo! Ya tienes Premium. Disfrútalo.", "ok");
    }).catch(function (j) {
      webStatus((j && j.error) || "No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.", "err");
    }).then(function () { btn.disabled = false; });
  });
