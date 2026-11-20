  // ===================== v7 · Cuenta y copia en la nube (sitio web) =====================
  var CUENTA_KEY = "fintelligente-cuenta", BIENV_KEY = "fintelligente-bienvenida", AVISO_CTA_KEY = "fintelligente-aviso-cuenta";
  var cuenta = null;   // { token, usuario, version, sucio, auto, actualizado, e2e: { activo, salt } }
  if (WEB) { try { var cj0 = JSON.parse(localStorage.getItem(CUENTA_KEY) || "null"); if (cj0 && /^fs_/.test(cj0.token) && cj0.usuario) cuenta = cj0; } catch (e) {} }
  var ctaCfg = { cuentas: false, google: "", correo: false, cargado: false };
  var subiendoNube = false, subidaNube = null, cambiosNube = 0, nubeTimer = null, ctaCorreo = "", reenvioTimer = null, gisCargando = null, gisListo = false;
  var pendienteE2E = null, eleccionNube = null, primeraCarga = !cuenta;

  function cuentaGuardar() { try { if (cuenta) localStorage.setItem(CUENTA_KEY, JSON.stringify(cuenta)); else localStorage.removeItem(CUENTA_KEY); } catch (e) {} }
  function apiC(path, opts) {
    opts = opts || {};
    var h = { "Content-Type": "application/json" };
    if (cuenta) h.Authorization = "Bearer " + cuenta.token;
    opts.headers = h;
    return api(path, opts);
  }
  function nombreDispositivo() {
    var ua = navigator.userAgent, so = /android/i.test(ua) ? "Android" : /iphone|ipad|ipod/i.test(ua) ? "iPhone" : /macintosh|mac os/i.test(ua) ? "Mac" : /windows/i.test(ua) ? "Windows" : "Computador";
    if (APP_ANDROID.activa) return "App de Android";
    var nav = /edg\//i.test(ua) ? "Edge" : /(chrome|crios)/i.test(ua) ? "Chrome" : /firefox|fxios/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : "";
    return so + (nav ? " · " + nav : "");
  }
  function iniciales(u) {
    var n = String((u && (u.nombre || u.correo)) || "?").trim(), p = n.split(/[\s@._-]+/).filter(Boolean);
    return ((p[0] || "?").charAt(0) + (u && u.nombre && p[1] ? p[1].charAt(0) : "")).toUpperCase();
  }
  function primerNombre(u) { return String((u && u.nombre) || "").split(" ")[0]; }
  function haceCuanto(t) {
    if (!t) return "";
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return "hace un momento";
    if (s < 3600) return "hace " + plural(Math.round(s / 60), "minuto");
    if (s < 86400) return "hace " + plural(Math.round(s / 3600), "hora");
    var d = new Date(t); return "el " + d.getDate() + " de " + MESES_LARGO[d.getMonth()];
  }
  var MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function resumenDatos() { var n = monthKeys().length; return n + (n === 1 ? " mes" : " meses") + " · " + plural(state.metas.length, "meta") + " · " + plural(state.cuentas.length, "cuenta"); }

  // --- Cifrado de extremo a extremo (opcional, con clave propia) ---
  var E2E_ITER = 310000;
  function b64e(u8) { var s = "", paso = 0x8000; for (var i = 0; i < u8.length; i += paso) s += String.fromCharCode.apply(null, u8.subarray(i, i + paso)); return btoa(s); }
  function e2eDerivar(clave, saltB64) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveKey"]).then(function (k) {
      return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64d(saltB64), iterations: E2E_ITER, hash: "SHA-256" }, k, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    });
  }
  function e2eLlave() { return idbDo("readonly", function (st) { return st.get("cuenta-e2e"); }).catch(function () { return null; }); }
  function e2eCifrar(texto) {
    return e2eLlave().then(function (k) {
      if (!k || !cuenta.e2e) throw { e2e: "sin-llave" };
      var iv = crypto.getRandomValues(new Uint8Array(12));
      return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, k, new TextEncoder().encode(texto)).then(function (ct) {
        return "e2e1:" + cuenta.e2e.salt + ":" + b64e(iv) + ":" + b64e(new Uint8Array(ct));
      });
    });
  }
  function e2eAbrir(contenido, llave) {
    var p = contenido.split(":");
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(p[2]) }, llave, b64d(p[3])).then(function (pt) { return new TextDecoder().decode(pt); });
  }
  function leerContenido(c) {
    if (c.indexOf("e2e1:") !== 0) return Promise.resolve(c);
    return e2eLlave().then(function (k) {
      if (!k) { pendienteE2E = c; throw { e2e: "sin-llave" }; }
      return e2eAbrir(c, k).catch(function () { pendienteE2E = c; throw { e2e: "sin-llave" }; });
    });
  }

  // --- Sincronización ---
  function paqueteLocal() { return JSON.stringify({ app: "fintelligente", v: 1, state: state }); }
  function cuentaCambio() {   // se llama desde changed()
    if (!cuenta) return;
    cuenta.sucio = true; cambiosNube++; cuentaGuardar();
    if (cuenta.auto === false) { status("Cambios sin copiar a tu cuenta", "dirty"); return; }
    status("Guardando en tu cuenta…");
    clearTimeout(nubeTimer); nubeTimer = setTimeout(function () { subirNube(); }, 2500);
  }
  // Sube la copia. Si ya hay una subida en curso, espera a que termine y sube otra vez (nunca se responde
  // "no se pudo" solo porque otra subida estaba ocupada). Si hubo cambios mientras subía, queda pendiente.
  function subirNube(base) {
    if (!cuenta) return Promise.resolve(false);
    if (subidaNube) return subidaNube.then(function () {
      if (!cuenta) return false;
      if (!cuenta.sucio && base == null) return true;
      return subirNube(base);
    });
    subiendoNube = true;
    var marca = cambiosNube, e2e = !!(cuenta.e2e && cuenta.e2e.activo), texto = paqueteLocal();
    subidaNube = (e2e ? e2eCifrar(texto) : Promise.resolve(texto)).then(function (contenido) {
      return apiC("/api/datos", { method: "PUT", body: JSON.stringify({ base: base != null ? base : (cuenta.version || 0), contenido: contenido, e2e: e2e, dispositivo: nombreDispositivo() }) });
    }).then(function (j) {
      if (!cuenta) return false;
      if (j._status === 200) {
        cuenta.version = j.version; cuenta.actualizado = j.actualizado;
        cuenta.sucio = cambiosNube !== marca;          // cambios hechos durante la subida siguen pendientes
        cuentaGuardar(); renderCuentaUI();
        if (cuenta.sucio) { status("Guardando en tu cuenta…"); if (cuenta.auto !== false) { clearTimeout(nubeTimer); nubeTimer = setTimeout(function () { subirNube(); }, 1500); } }
        else status("Guardado en tu cuenta ✓", "ok");
        return true;
      }
      if (j._status === 409) { status("Hay cambios de otro dispositivo", "dirty"); setTimeout(revisarNube, 0); return false; }
      if (j._status === 401) { setTimeout(sesionTerminada, 0); return false; }
      status(j.error || "No se pudo copiar a tu cuenta; se intentará de nuevo", "dirty");
      return false;
    }, function (err) {
      if (err && err.e2e) { status("Falta tu clave de cifrado en este dispositivo", "dirty"); abrirCuenta("clave"); }
      else status("Sin conexión: se copiará cuando vuelva el internet", "dirty");
      return false;
    }).then(function (ok) { subiendoNube = false; subidaNube = null; return ok; });
    return subidaNube;
  }
  function revisarNube() {
    if (!cuenta || subiendoNube) return Promise.resolve();
    return apiC("/api/datos?meta=1").then(alMetaNube, function () {});
  }
  // Qué hacer con la versión de la nube: bajarla, subir la local o preguntar si ambas cambiaron.
  function alMetaNube(j) {
    if (!cuenta) return;
    if (j._status === 401 || j.sesion === false) { sesionTerminada(); return; }
    if (j._status && j._status !== 200) return;
    if (j.usuario) actualizarUsuario(j.usuario);
    if (subiendoNube) return;
    if ((j.version || 0) > (cuenta.version || 0)) {
      if (!cuenta.sucio) return bajarNube();
      abrirElegir(j, "conflicto");
      return;
    }
    if (cuenta.sucio && cuenta.auto !== false) return subirNube();
    if (!cuenta.sucio) status("Guardado en tu cuenta ✓", "ok");
  }
  function actualizarUsuario(u) {
    if (!cuenta) return;
    cuenta.usuario = u; cuentaGuardar(); revisarAcepto(u);
    if (u.licencia && !licencia) guardarLicencia(u.licencia.ref, u.licencia.token); else subirLicencia();
    renderCuentaUI();
  }
  function bajarNube() {
    return apiC("/api/datos").then(function (j) {
      if (j._status === 401) { sesionTerminada(); return false; }
      if (j._status !== 200 || !j.contenido) return false;
      return leerContenido(j.contenido).then(function (txt) {
        var o = JSON.parse(txt), s = o && o.state;
        if (!validState(s)) throw { invalido: true };
        try { localStorage.setItem(localKey + "-antes-de-nube", JSON.stringify(state)); } catch (e) {}
        state = sanitize(s); writeLocal();
        cuenta.version = j.version; cuenta.actualizado = j.actualizado; cuenta.sucio = false;
        if (j.e2e) cuenta.e2e = { activo: true, salt: j.contenido.split(":")[1] }; else cuenta.e2e = null;
        cuentaGuardar(); renderAll(); status("Guardado en tu cuenta ✓", "ok");
        return true;
      });
    }).catch(function (e) {
      if (e && e.e2e) { abrirCuenta("clave"); return false; }
      toast("No pudimos abrir la copia de tu cuenta. Tus datos de este dispositivo siguen intactos.");
      return false;
    });
  }
  // Al cerrar sesión se vuelve a la pantalla de entrada. Si todo quedó copiado en la nube, este
  // dispositivo se limpia (los datos vuelven al entrar otra vez); si no, se conservan para no perder nada.
  function salirAlInicio(borrar, licenciaEnCuenta) {
    clearTimeout(nubeTimer);
    cuenta = null; cuentaGuardar();
    try {
      if (borrar) {
        Object.keys(localStorage).forEach(function (k) { if (k.indexOf(LOCAL_PREFIX) === 0) localStorage.removeItem(k); });
        if (licenciaEnCuenta) localStorage.removeItem(LIC_KEY);
        localStorage.removeItem(BUZON_KEY); localStorage.removeItem(AVISO_CTA_KEY);
        localStorage.setItem(CIERRE_KEY, "limpio");
      } else localStorage.setItem(CIERRE_KEY, "conservado");
      sessionStorage.removeItem(SIN_CTA_KEY);
    } catch (e) {}
    var listo = borrar ? Promise.all([idbDo("readwrite", function (st) { st.delete("buzon"); return st.delete("cuenta-e2e"); }).catch(function () {}), idbVaciar()]) : Promise.resolve();
    listo.then(function () { location.replace(location.pathname); });
  }
  function sesionTerminada() {
    var limpio = cuenta && !cuenta.sucio;
    salirAlInicio(!!limpio, limpio && licencia && cuenta.usuario.licencia && cuenta.usuario.licencia.ref === licencia.ref);
  }
  function subirLicencia() {
    if (!cuenta || !licencia || (cuenta.usuario.licencia && cuenta.usuario.licencia.ref === licencia.ref)) return;
    apiC("/api/cuenta/licencia", { method: "PUT", body: JSON.stringify(licencia) }).then(function (j) {
      if (j._status === 200 && cuenta) { cuenta.usuario.licencia = { ref: licencia.ref, token: licencia.token }; cuentaGuardar(); }
    }, function () {});
  }

  // --- Entrar ---
