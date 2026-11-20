  // ===================== Almacenamiento =====================
  var statusEl = $("save-status");
  var mode = "loading", docRef = null, localKey = LOCAL_PREFIX + "sin-cuenta";
  var saveTimer = null, saving = false, pending = false, loaded = false;
  var isOwnerFlag = false, dbApi = null, viewerId = null, claudeApi = window.claude;

  function status(text, cls) { statusEl.textContent = text; statusEl.className = "save-status" + (cls ? " " + cls : ""); }
  // Sitio web: el presupuesto se guarda en IndexedDB (mucho más espacio que localStorage) y, mientras quepa,
  // también en localStorage como copia. Al abrir se usa la más reciente de las dos. Los datos que ya estaban
  // en localStorage pasan solos a IndexedDB la primera vez, sin borrar la copia original.
  var DB_DATOS = "fintelligente-datos", idbDatosP = null, idbInicial = null;
  function idbDatos() {
    if (idbDatosP) return idbDatosP;
    idbDatosP = new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error("sin IndexedDB")); return; }
      var r; try { r = indexedDB.open(DB_DATOS, 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = function () { r.result.createObjectStore("estado"); };
      r.onsuccess = function () { var db = r.result; db.onversionchange = function () { db.close(); idbDatosP = null; }; res(db); };
      r.onerror = function () { rej(r.error); };
      r.onblocked = function () { rej(new Error("bloqueada")); };
      setTimeout(function () { rej(new Error("lenta")); }, 2500);
    });
    idbDatosP.catch(function () { idbDatosP = null; });
    return idbDatosP;
  }
  function idbOp(modo, fn) {
    return idbDatos().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction("estado", modo), q = fn(tx.objectStore("estado"));
        tx.oncomplete = function () { res(q && q.result); }; tx.onerror = tx.onabort = function () { rej(tx.error); };
      });
    });
  }
  function idbLeer(k) { return idbOp("readonly", function (st) { return st.get(k); }); }
  function idbEscribir(k, v) { return idbOp("readwrite", function (st) { return st.put(v, k); }); }
  function idbVaciar() { return idbOp("readwrite", function (st) { return st.clear(); }).catch(function () {}); }
  function precargarLocal() {
    return idbLeer(localKey).then(function (v) { idbInicial = { clave: localKey, v: v || null }; }, function () { idbInicial = null; });
  }
  function readLocal() {
    var cand = [];
    try { var raw = localStorage.getItem(localKey); if (raw) cand.push({ txt: raw, t: +localStorage.getItem(localKey + "-t") || 0, ls: true }); } catch (e) {}
    if (idbInicial && idbInicial.clave === localKey && idbInicial.v && idbInicial.v.s) cand.push({ txt: idbInicial.v.s, t: idbInicial.v.t || 0 });
    cand.sort(function (a, b) { return b.t - a.t; });
    for (var i = 0; i < cand.length; i++) {
      try {
        var s = JSON.parse(cand[i].txt);
        if (validState(s)) {
          if (WEB && cand[i].ls && !(idbInicial && idbInicial.v)) idbEscribir(localKey, { s: cand[i].txt, t: cand[i].t || Date.now() }).catch(function () {});   // primera vez: pasa a IndexedDB
          return sanitize(s);
        }
      } catch (e) {}
    }
    return null;
  }
  var canalPestanas = null;
  try { canalPestanas = WEB && window.BroadcastChannel ? new BroadcastChannel("fintelligente") : null; } catch (e) { canalPestanas = null; }
  function writeLocal() {
    var txt = JSON.stringify(state), t = Date.now();
    try { localStorage.setItem(localKey, txt); localStorage.setItem(localKey + "-t", String(t)); }
    catch (e) { try { localStorage.removeItem(localKey); localStorage.removeItem(localKey + "-t"); } catch (e2) {} }   // ya no cabe: queda solo en IndexedDB (y no una copia vieja)
    if (WEB) {
      idbInicial = { clave: localKey, v: { s: txt, t: t } };
      idbEscribir(localKey, { s: txt, t: t }).catch(function () {});
      guardarCupo();
      if (canalPestanas) try { canalPestanas.postMessage({ tipo: "datos", t: t }); } catch (e) {}
    }
  }

  function changed() {
    if (!loaded) return;
    if (marcarActividad()) { try { renderInicio(totalsOf(cur())); } catch (e) {} }
    try { checkLogros(); } catch (e) {}
    if (WEB) programarAvisos();
    writeLocal();
    if (mode === "cloud") {
      status("Cambios sin guardar…", "dirty");
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flush, 900);
    } else if (WEB) {
      status("Guardado en este dispositivo", "ok");
    } else if (FREE) {
      status("Guardado en este navegador", "ok");
    } else {
      status("Guardado solo en este navegador", "dirty");
    }
    if (WEB) { if (cuenta) cuentaCambio(); else if (!state.ejemplo && $("nudge-cuenta").hidden) renderCuentaUI(); }
  }
  function flush() {
    saveTimer = null;
    if (mode !== "cloud" || !docRef) return;
    if (saving) { pending = true; return; }
    saving = true; pending = false;
    status("Guardando…");
    docRef.set({ state: JSON.parse(JSON.stringify(state)), actualizado: new Date().toISOString() }).then(function () {
      saving = false;
      if (pending) { flush(); return; }
      status("Guardado en tu cuenta ✓", "ok");
    }, function (err) {
      saving = false;
      var code = err && err.code;
      if (code === "invalid_argument" || code === "not_granted" || code === "revoked" || code === "capability_disabled" || code === "capability_removed") {
        mode = "local";
        status("Guardado solo en este navegador", "dirty");
        $("foot-note").textContent = "Montos en pesos colombianos (COP). Con tu nivel de acceso a esta página, tus cifras se guardan solo en este navegador. Pide a quien te la compartió acceso de edición para guardarlas en tu cuenta.";
      } else if (code === "quota_exceeded") {
        status("Tu presupuesto llegó al tamaño máximo: elimina meses antiguos", "dirty");
      } else {
        status("No se pudo guardar; se reintentará con tu próximo cambio", "dirty");
        if (code === "unavailable") setTimeout(flush, 1500 + Math.random() * 1500);
      }
    });
  }
  function startLocal(reason) {
    mode = "local";
    var s = readLocal(); if (s) state = s;
    finishLoad();
    if (WEB) status("Guardado en este dispositivo", "ok"); else if (FREE) status("Guardado en este navegador", "ok"); else status("Guardado solo en este navegador", "dirty");
    if (reason) $("foot-note").textContent = reason;
  }
  var recargarAlVolver = false;
  if (canalPestanas) canalPestanas.onmessage = function (e) {
    if (!e.data || e.data.tipo !== "datos" || !loaded) return;
    recargarAlVolver = true;
    if (document.visibilityState === "visible" && !document.hasFocus()) recargarDeOtraPestana();
  };
  function recargarDeOtraPestana() {
    if (!recargarAlVolver) return;
    recargarAlVolver = false;
    precargarLocal().then(function () {
      var s = readLocal(); if (s) { state = s; renderAll(); }
      if (WEB) {
        try {
          var cj = JSON.parse(localStorage.getItem(CUENTA_KEY) || "null");
          if (cuenta && (!cj || cj.token !== cuenta.token)) { cuenta = null; renderCuentaUI(); }
          else if (cuenta && cj) { cuenta.version = cj.version; cuenta.actualizado = cj.actualizado; cuenta.sucio = cj.sucio; cuenta.e2e = cj.e2e; }
        } catch (e) {}
      }
    });
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") recargarDeOtraPestana(); });
  window.addEventListener("focus", recargarDeOtraPestana);
  function finishLoad() {
    loaded = true;
    document.body.classList.remove("loading");
    renderAll();
    postLoad();
    // La firma de la F dura 1,9 s: si la app carga antes, se espera a que termine (sin pasar de ahí)
    var ar = $("arranque"); if (ar) setTimeout(function () { ar.classList.add("fuera"); setTimeout(function () { if (ar.parentNode) ar.parentNode.removeChild(ar); }, 600); }, Math.max(0, 1900 - (performance.now ? performance.now() : 0)));
  }
  function startCloud(db, uid, user) {
    localKey = LOCAL_PREFIX + uid;
    docRef = db.doc("data/users/" + uid + "/presupuesto");
    docRef.get().then(function (snap) {
      var remote = snap.exists ? snap.data() : null;
      if (remote && validState(remote.state)) { state = sanitize(remote.state); return true; }
      var s = readLocal(); if (s) state = s;
      if (!isOwnerFlag) return false;
      var mig = db.doc("data/migracion");   // traslado único de la primera versión
      return mig.get().then(function (m) {
        var d = m.exists ? m.data() : null;
        if (d && validState(d.state)) {
          state = sanitize(d.state);
          return docRef.set({ state: JSON.parse(JSON.stringify(state)), actualizado: new Date().toISOString() })
            .then(function () { return mig.delete().catch(function () {}); })
            .then(function () { return true; });
        }
        return false;
      }, function () { return false; });
    }).then(function (remote) {
      mode = "cloud";
      finishLoad();
      writeLocal();
      status(remote ? "Guardado en tu cuenta ✓" : "Tu presupuesto privado", "ok");
    }, function () {
      startLocal("Montos en pesos colombianos (COP). No se pudo abrir tu espacio privado ahora; tus cambios se guardan en este navegador.");
    });
  }

