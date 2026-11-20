  // ===================== Mudanza a una dirección nueva =====================
  // Cuando la app pase a un dominio propio (variable DIRECCION_NUEVA en Netlify), cada navegador tiene sus
  // datos guardados bajo la dirección vieja y la nueva no puede verlos. La dirección vieja los cifra aquí mismo
  // con una llave al azar, sube solo el paquete cifrado y abre la nueva con el número del paquete y la llave
  // después del #, que nunca se envía al servidor. La nueva recoge el paquete (una sola vez), lo abre y pregunta
  // antes de usarlo. Las llaves del buzón no se pueden copiar: la nueva crea las suyas y el código del iPhone sigue igual.
  var MUDADA_KEY = "fintelligente-mudada";
  function b64uDe(u8) { return b64e(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function u8DeB64u(t) { return b64d(t.replace(/-/g, "+").replace(/_/g, "/") + "===".slice(0, (4 - t.length % 4) % 4)); }
  function claveMudanza(k) { return /^(fintelligente-|presupuesto-)/.test(k) && !/-antes-de-|-revisada$|^fintelligente-(sin-cuenta|cierre|mudada)$/.test(k) && k.indexOf(LOCAL_PREFIX) !== 0; }
  function mudanzaMsg(t, cls) { $("mudanza-msg").textContent = t || ""; $("mudanza-msg").className = "msg" + (cls ? " " + cls : ""); }
  function mudanzaBotones(lista) { ["si", "no", "reintentar", "respaldo", "ir"].forEach(function (b) { $("mudanza-" + b).hidden = lista.indexOf(b) < 0; }); }
  function revisarMudanza(destino) {
    if (!destino || destino === location.origin || /^#mudanza=/.test(location.hash)) return;
    var resto = location.pathname + location.search + location.hash, hecha = "";
    try { hecha = localStorage.getItem(MUDADA_KEY) || ""; } catch (e) {}
    var nada = !cuenta && !buzon && !licencia && sinDatosPropios();
    if (hecha.indexOf(destino + "|") === 0 || nada) { location.replace(destino + resto); return; }
    $("dlg-bienvenida").hidden = true;
    $("mudanza-p").textContent = "Ahora la encuentras en " + destino.replace(/^https?:\/\//, "") + ". Estamos llevando tus datos cifrados a la dirección nueva. Toma unos segundos.";
    mudanzaBotones([]); mudanzaMsg("Preparando tus datos…");
    $("dlg-mudanza").hidden = false;
    enviarMudanza(destino, /^#accion=/.test(location.hash) ? location.hash.slice(1) : "");
  }
  function enviarMudanza(destino, extra) {
    var llave, iv = crypto.getRandomValues(new Uint8Array(12));
    var antes = Promise.all([buzon ? revisarBuzon(true) : 0, cuenta && cuenta.sucio ? subirNube() : true]);
    antes.then(function () {
      var ls = {};
      Object.keys(localStorage).forEach(function (k) { if (claveMudanza(k)) ls[k] = localStorage.getItem(k); });
      var paquete = JSON.stringify({ v: 1, origen: location.origin, creado: Date.now(), estado: state, ls: ls });
      return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]).then(function (k) {
        llave = k;
        return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, k, new TextEncoder().encode(paquete));
      });
    }).then(function (ct) {
      var todo = new Uint8Array(12 + ct.byteLength); todo.set(iv, 0); todo.set(new Uint8Array(ct), 12);
      mudanzaMsg("Enviando…");
      return Promise.all([api("/api/mudanza", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paquete: b64uDe(todo) }) }), crypto.subtle.exportKey("raw", llave)]);
    }).then(function (r) {
      var j = r[0];
      if (j._status !== 200 || !j.id) throw new Error(j.error || "No pudimos enviar tus datos.");
      try { localStorage.setItem(MUDADA_KEY, destino + "|" + Date.now()); } catch (e) {}
      location.replace(destino + "/#mudanza=" + j.id + "." + b64uDe(new Uint8Array(r[1])) + (extra ? "&" + extra : ""));
    }).catch(function (e) {
      mudanzaMsg((e && e.message) || "No pudimos llevar tus datos ahora. Revisa tu conexión.", "err");
      mudanzaBotones(["reintentar", "respaldo", "ir"]);
      $("mudanza-reintentar").onclick = function () { mudanzaBotones([]); mudanzaMsg("Intentando de nuevo…"); enviarMudanza(destino, extra); };
      $("mudanza-respaldo").onclick = function () { $("btn-export").click(); };
      $("mudanza-ir").onclick = function () { try { localStorage.setItem(MUDADA_KEY, destino + "|" + Date.now()); } catch (er) {} location.replace(destino + "/"); };
    });
  }
  // Dirección nueva: recoge el paquete, muestra qué trae y pregunta antes de usarlo.
  function recibirMudanza() {
    var m = /^#mudanza=([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})(?:&(.*))?$/.exec(location.hash || "");
    if (!m) return false;
    var extra = m[3] || "";
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    $("dlg-bienvenida").hidden = true;
    $("mudanza-t").textContent = "Trajimos tus datos";
    $("mudanza-p").textContent = "Estos son los datos que tenías en la dirección anterior de Finti.";
    mudanzaBotones([]); mudanzaMsg("Abriendo tus datos…");
    openDlg("dlg-mudanza", "#mudanza-msg");
    var paquete = null;
    api("/api/mudanza?id=" + m[1]).then(function (j) {
      if (j._status !== 200 || !j.paquete) throw new Error(j.error || "No encontramos tus datos.");
      var todo = u8DeB64u(j.paquete);
      return crypto.subtle.importKey("raw", u8DeB64u(m[2]), "AES-GCM", false, ["decrypt"]).then(function (k) {
        return crypto.subtle.decrypt({ name: "AES-GCM", iv: todo.subarray(0, 12) }, k, todo.subarray(12));
      });
    }).then(function (pt) {
      paquete = JSON.parse(new TextDecoder().decode(pt));
      if (!paquete || paquete.v !== 1 || !validState(paquete.estado)) throw new Error("Los datos llegaron dañados.");
      var ls = paquete.ls || {}, cta = null; try { cta = JSON.parse(ls[CUENTA_KEY] || "null"); } catch (e) {}
      var s0 = sanitize(paquete.estado), meses = Object.keys(s0.meses).length;
      $("mudanza-resumen").hidden = false;
      $("mudanza-resumen").innerHTML = '<div class="acct-row"><span>Desde</span><b>' + esc(String(paquete.origen || "").replace(/^https?:\/\//, "")) + "</b></div>" +
        '<div class="acct-row"><span>Datos</span><b>' + esc(s0.ejemplo ? "Datos de ejemplo" : plural(meses, "mes") + " · " + plural(s0.metas.length, "meta") + " · " + plural(s0.cuentas.length, "cuenta")) + "</b></div>" +
        (cta && cta.usuario ? '<div class="acct-row"><span>Cuenta</span><b>' + esc(cta.usuario.correo || "") + "</b></div>" : "") +
        (ls[BUZON_KEY] ? '<div class="acct-row"><span>Conectar bancos</span><b>Sigue conectado</b></div>' : "");
      mudanzaMsg(sinDatosPropios() ? "" : "En esta dirección ya tenías datos: quedarán guardados como copia por si los necesitas.");
      mudanzaBotones(["si", "no"]);
      $("mudanza-si").onclick = function () { aplicarMudanza(paquete, extra); };
    }).catch(function (e) {
      mudanzaMsg(((e && e.message) || "No pudimos abrir tus datos.") + " Vuelve a abrir la dirección anterior para intentarlo otra vez.", "err");
      mudanzaBotones(["no"]); $("mudanza-no").textContent = "Cerrar";
    });
    return true;
  }
  function aplicarMudanza(paquete, extra) {
    mudanzaBotones([]); mudanzaMsg("Guardando…");
    var ls = paquete.ls || {}, bz = null; try { bz = JSON.parse(ls[BUZON_KEY] || "null"); } catch (e) {}
    try { if (!sinDatosPropios()) localStorage.setItem(localKey + "-antes-de-mudanza", JSON.stringify(state)); } catch (e) {}
    Object.keys(ls).forEach(function (k) { if (claveMudanza(k)) try { localStorage.setItem(k, ls[k]); } catch (e) {} });
    state = sanitize(paquete.estado); writeLocal();
    // El buzón sigue siendo el mismo (mismo código de conexión); este navegador crea su llave y se la entrega al servidor.
    var llaveBuzon = !bz ? Promise.resolve() : crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, false, ["encrypt", "decrypt"]).then(function (kp) {
      return crypto.subtle.exportKey("jwk", kp.publicKey).then(function (pub) {
        return api("/api/bandeja/llave", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ buzon: bz.buzon, token: bz.token, pub: { kty: pub.kty, n: pub.n, e: pub.e } }) });
      }).then(function (j) {
        if (j._status !== 200) throw new Error("buzón");
        return idbDo("readwrite", function (st) { return st.put(kp.privateKey, "buzon"); });
      });
    }).catch(function () { try { localStorage.removeItem(BUZON_KEY); } catch (e) {} });   // si falla, se crea uno nuevo desde Conectar bancos
    Promise.all([llaveBuzon, new Promise(function (r) { setTimeout(r, 150); })]).then(function () {
      try { localStorage.setItem(BIENV_KEY, "1"); sessionStorage.setItem(SIN_CTA_KEY, "1"); localStorage.setItem("fintelligente-mudanza-ok", "1"); } catch (e) {}
      location.replace(location.pathname + (extra ? "#" + extra : ""));
      if (extra) location.reload();
    });
  }
  function avisoMudanzaHecha() {
    var ok = ""; try { ok = localStorage.getItem("fintelligente-mudanza-ok"); localStorage.removeItem("fintelligente-mudanza-ok"); } catch (e) {}
    if (ok) setTimeout(function () { toast("Listo: tus datos ya están en la dirección nueva. Guárdala en tus favoritos."); }, 800);
  }

  // --- Marca de Netlify: si aparece en la esquina, la app le deja espacio (no la oculta) ---
  (function vigilarMarca() {
    if (!WEB || !window.MutationObserver) return;
    [].forEach.call(document.body.children, function (el) { el.setAttribute("data-propio", ""); });
    var pendiente = false;
    function revisar() {
      pendiente = false;
      var alto = 0;
      [].forEach.call(document.body.children, function (el) {
        if (el.hasAttribute("data-propio") || /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(el.tagName)) return;
        var cs = getComputedStyle(el);
        if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return;
        var r = el.getBoundingClientRect();
        if (r.width < 40 || r.height < 20 || r.height > 180 || r.width > innerWidth * 0.9) return;
        if (innerHeight - r.bottom > 70 || innerWidth - r.right > 70) return;
        alto = Math.max(alto, Math.ceil(innerHeight - r.top) + 8);
      });
      document.body.classList.toggle("con-marca", alto > 0);
      if (alto) document.body.style.setProperty("--marca-h", alto + "px");
    }
    function pedir() { if (!pendiente) { pendiente = true; requestAnimationFrame(revisar); } }
    new MutationObserver(function (lista) {
      for (var i = 0; i < lista.length; i++) { var t = lista[i].target; if (t === document.body || t.parentNode === document.body) { pedir(); return; } }
    }).observe(document.body, { childList: true, attributes: true, subtree: true, attributeFilter: ["style", "class", "hidden"] });
    window.addEventListener("resize", pedir);
    [1500, 4000, 8000].forEach(function (ms) { setTimeout(pedir, ms); });
  })();

