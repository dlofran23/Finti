  // ===================== Ventana Premium =====================
  var config = { mensaje: "", link: "", precio: "" }, refCode = "";
  function safeLink(u) { return /^https:\/\/[^\s"'<>]+$/i.test(u || "") ? u : ""; }
  function openPremium(reason) {
    renderPremium(reason);
    openDlg("dlg-premium", hasPremium() ? "[data-close]" : "#f-codigo");
    if (!hasPremium()) metrica("vio_premium", "dia");
    if (isOwnerFlag) loadOwnerPanel();
  }
  $("btn-premium").addEventListener("click", function () { openPremium(); });
  function renderPremium(reason) {
    var prem = hasPremium();
    $("redeem-row").hidden = prem;
    var msg = $("prem-msg");
    if (prem) {
      msg.textContent = isOwnerFlag ? "Como dueño de esta página, tienes Premium completo." : "Tienes Premium desbloqueado. ¡Gracias!";
      msg.className = "msg ok";
    } else if (FREE) {
      msg.textContent = (reason ? reason + " " : "") + (config.mensaje || "Con Premium tienes todas las funciones y tus cifras se guardan en tu cuenta de Claude, para verlas en todos tus dispositivos. Al comprarlo, te invitamos a la versión Premium con tu correo.");
      msg.className = "msg";
    } else {
      msg.textContent = (reason ? reason + " " : "") + (config.mensaje || "Desbloquea todo con un código. Pídelo a quien te compartió este presupuesto.");
      msg.className = "msg";
    }
    if (FREE) {
      $("redeem-row").hidden = true; $("redeem-status").textContent = "";
      $("ref-line").innerHTML = 'Tu referencia: <span class="ref" id="ref-code"></span>. Después de pagar, envíala junto con el correo de tu cuenta de Claude para recibir la invitación a la versión Premium.';
    }
    var link = safeLink(config.link);
    $("buy-row").hidden = prem || !link;
    if (link) $("buy-link").href = link;
    $("buy-price").textContent = config.precio || "";
    $("ref-line").hidden = prem || !refCode;
    $("ref-code").textContent = refCode;
    if (FREE) $("owner-codes").hidden = true;
    if (WEB) {
      $("redeem-row").hidden = true; $("buy-row").hidden = true; $("ref-line").hidden = true;
      // En la app de Android (Google Play) no se vende Premium con Wompi: la política de pagos de Google Play
      // exige su propia facturación para contenido digital. Se puede activar una compra previa o un código de regalo.
      var enTienda = APP_ANDROID.activa;
      $("web-buy").hidden = prem || enTienda; $("web-restore").hidden = prem; $("web-regalo").hidden = prem;
      $("inv-de").hidden = prem || enTienda || !invitadoPor();
      $("tienda-nota").hidden = prem || !enTienda;
      if (!prem && cuenta && cuenta.usuario && cuenta.usuario.correo && !$("f-regalo-email").value) $("f-regalo-email").value = cuenta.usuario.correo;
      if (prem) {
        msg.textContent = "Premium está activo en este dispositivo. Tu referencia es " + licencia.ref + ": guárdala para activarlo en otro dispositivo.";
        msg.className = "msg ok";
      } else {
        msg.textContent = (reason ? reason + " " : "") + (enTienda ? "Premium desbloquea todas las funciones." : webPrecio ? "Desbloquea todo por " + money(webPrecio) + ", pago único." : "Desbloquea todas las funciones con un pago único.");
        msg.className = "msg";
      }
    }
  }
  function renderPremiumButton() {
    var b = $("btn-premium");
    b.innerHTML = '<span class="star">★</span> <span class="lbl">' + (hasPremium() ? "Premium activo" : "Premium") + "</span>";
    b.setAttribute("aria-label", hasPremium() ? "Premium activo" : "Premium");
    b.classList.toggle("on", hasPremium());
    Array.prototype.forEach.call(document.querySelectorAll("[data-premium-chip]"), function (c) { c.hidden = hasPremium(); });
    $("btn-xlsx").title = hasPremium() ? "Descarga el mes, el historial, las metas y las deudas en un archivo de Excel" : "Premium";
  }

  // Códigos
  var CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function normCode(c) { return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function sha256(text) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    });
  }
  function hashCode(c) { return sha256("presupuesto-premium:" + normCode(c)); }
  function newCode() {
    var r = new Uint32Array(8); crypto.getRandomValues(r);
    var out = ""; for (var i = 0; i < 8; i++) { out += CODE_ALPHABET[r[i] % CODE_ALPHABET.length]; if (i === 3) out += "-"; }
    return out;
  }
  function redeemStatus(t, cls) { var el = $("redeem-status"); el.textContent = t; el.className = "msg" + (cls ? " " + cls : ""); }
  $("btn-redeem").addEventListener("click", redeem);
  $("f-codigo").addEventListener("keydown", function (e) { if (e.key === "Enter") redeem(); });
  function redeem() {
    var code = $("f-codigo").value;
    if (normCode(code).length !== 8) { redeemStatus("El código tiene 8 caracteres; por ejemplo, ABCD-2345.", "err"); return; }
    if (!dbApi || !viewerId || mode !== "cloud") { redeemStatus("Para usar un código, abre esta página con tu cuenta de Claude y con permiso de edición.", "err"); return; }
    var btn = $("btn-redeem"), h; btn.disabled = true; redeemStatus("Verificando…");
    hashCode(code).then(function (hash) { h = hash; return dbApi.doc("codigos/" + h).get(); }).then(function (snap) {
      if (!snap.exists) throw { msg: "Ese código no es válido. Revisa que esté bien escrito." };
      var canje = dbApi.doc("canjes/" + h);
      return canje.acquire({ holder: viewerId, ttlMs: 10000 }).then(function (lease) {
        if (!lease.acquired) throw { msg: "Alguien está usando este código en este momento. Intenta de nuevo en unos segundos." };
        return canje.get();
      }).then(function (c) {
        var d = c.exists ? c.data() : null;
        if (d && d.uid && d.uid !== viewerId) throw { msg: "Este código ya fue usado por otra cuenta." };
        if (d && d.uid === viewerId) return;
        return canje.set({ uid: viewerId, fecha: new Date().toISOString() });
      });
    }).then(function () {
      state.prefs.premium = true; state.prefs.codigo = h;
      changed(); renderAll(); renderPremium();
      $("f-codigo").value = "";
      redeemStatus("¡Listo! Ya tienes Premium: todas las funciones y temas están desbloqueados.", "ok");
      celebrar();
    }).catch(function (err) {
      redeemStatus(err && err.msg ? err.msg : "No se pudo verificar el código ahora. Intenta de nuevo.", "err");
    }).then(function () { btn.disabled = false; });
  }

  // Panel del dueño
  var ownerCodes = [];
  function ownerDoc() { return dbApi.doc("data/users/" + viewerId + "/codigos"); }
  function fmtFecha(iso) { try { return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } }
  function renderCodes(states) {
    var tb = $("tb-codes");
    if (!ownerCodes.length) { tb.innerHTML = '<tr><td colspan="5" class="hint">Aún no has generado códigos.</td></tr>'; return; }
    tb.innerHTML = ownerCodes.slice().reverse().map(function (c) {
      var st = states ? states[c.hash] : null;
      var chip = st === "usado" ? '<span class="chip warn">Usado</span>' : st === "libre" ? '<span class="chip ok">Disponible</span>' : '<span class="chip none">…</span>';
      return "<tr><td><code>" + esc(c.codigo) + "</code></td><td>" + esc(c.nota || "") + "</td><td>" + esc(fmtFecha(c.creado)) + "</td><td>" + chip + '</td><td><button type="button" class="btn" data-copy="' + esc(c.codigo) + '">Copiar</button></td></tr>';
    }).join("");
  }
  function loadOwnerPanel() {
    $("sec-owner").hidden = false;
    $("f-msg").value = config.mensaje; $("f-link").value = config.link; $("f-precio").value = config.precio;
    if (!dbApi || FREE) return;
    ownerDoc().get().then(function (snap) {
      var d = snap.exists ? snap.data() : null;
      ownerCodes = d && Array.isArray(d.lista) ? d.lista.slice() : [];
      // Importar códigos creados fuera de la página (por ejemplo, desde el chat)
      var admin = dbApi.doc("data/admin");
      return admin.get().then(function (a) {
        var ad = a.exists ? a.data() : null;
        if (!ad || !Array.isArray(ad.codigos) || !ad.codigos.length) return;
        var have = {}; ownerCodes.forEach(function (c) { have[c.hash] = 1; });
        ad.codigos.forEach(function (c) { if (c && c.hash && c.codigo && !have[c.hash]) ownerCodes.push({ codigo: c.codigo, hash: c.hash, creado: c.creado || "", nota: c.nota || "" }); });
        return ownerDoc().set({ lista: ownerCodes }).then(function () { return admin.delete(); });
      }, function () {});
    }).then(function () {
      renderCodes(null);
      return Promise.all(ownerCodes.map(function (c) {
        return dbApi.doc("canjes/" + c.hash).get().then(function (s) { return [c.hash, s.exists && s.data().uid ? "usado" : "libre"]; }, function () { return [c.hash, null]; });
      }));
    }).then(function (pairs) {
      var st = {}; (pairs || []).forEach(function (p) { st[p[0]] = p[1]; });
      renderCodes(st);
    }).catch(function () {});
  }
  $("tb-codes").addEventListener("click", function (e) {
    var b = e.target.closest("[data-copy]"); if (!b) return;
    try { navigator.clipboard.writeText(b.dataset.copy).then(function () { b.textContent = "Copiado ✓"; setTimeout(function () { b.textContent = "Copiar"; }, 1800); }, function () { b.textContent = "Cópialo a mano"; }); }
    catch (err) { b.textContent = "Cópialo a mano"; }
  });
  $("btn-gen").addEventListener("click", function () {
    var btn = this, st = $("gen-status");
    if (!dbApi) { st.textContent = "Abre la página desde Claude para generar códigos."; st.className = "msg err"; return; }
    btn.disabled = true; st.textContent = "Generando…"; st.className = "msg";
    var code = newCode(), nota = $("f-nota").value.trim().slice(0, 60);
    hashCode(code).then(function (h) {
      return dbApi.doc("codigos/" + h).set({ creado: new Date().toISOString() }).then(function () {
        ownerCodes.push({ codigo: code, hash: h, creado: new Date().toISOString(), nota: nota });
        return ownerDoc().set({ lista: ownerCodes });
      });
    }).then(function () {
      st.textContent = "Código " + code + " listo para enviar."; st.className = "msg ok";
      $("f-nota").value = "";
      loadOwnerPanel();
    }, function (err) {
      st.textContent = err && err.code === "quota_exceeded" ? "Llegaste al límite de códigos guardados." : "No se pudo generar el código. Intenta de nuevo.";
      st.className = "msg err";
    }).then(function () { btn.disabled = false; });
  });
  $("btn-msg").addEventListener("click", function () {
    var st = $("msg-status");
    if (!dbApi) { st.textContent = "Abre la página desde Claude para guardar."; st.className = "msg err"; return; }
    var link = $("f-link").value.trim();
    if (link && !safeLink(link)) { st.textContent = "El link debe empezar por https://"; st.className = "msg err"; return; }
    var cfg = { mensaje: $("f-msg").value.trim().slice(0, 300), link: link.slice(0, 400), precio: $("f-precio").value.trim().slice(0, 40) };
    st.textContent = "Guardando…"; st.className = "msg";
    dbApi.doc("config/premium").set(cfg).then(function () { config = cfg; st.textContent = "Configuración guardada."; st.className = "msg ok"; renderPremium(); },
      function () { st.textContent = "No se pudo guardar."; st.className = "msg err"; });
  });


