  // ===================== Aceptación de términos y datos (Ley 1581) =====================
  // Para crear o abrir una cuenta se pide: rango de edad (mínimo 14), autorización del representante si es
  // menor de 18, y aceptación de los términos y la política. El servidor la guarda como prueba.
  // LEGAL_V: versión vigente de la política y los términos (la que queda como prueba al aceptar).
  // LEGAL_MIN: la más vieja que sigue sirviendo. Según el artículo 13 del Decreto 1377 de 2013 (compilado en el Decreto
  // 1074 de 2015), solo hace falta una autorización nueva si cambian las finalidades para las que la persona ya
  // autorizó; los demás cambios se comunican antes de aplicarlos (aviso único en la app y registro de cambios en la
  // política). La 1.3 agrega "compartir mis precios", que tiene su propio permiso, así que la 1.2 sigue sirviendo.
  var LEGAL_V = "1.3", LEGAL_MIN = "1.2", ACEPTO_KEY = "fintelligente-acepto", EDAD_MIN = 14, AVISO_LEGAL_KEY = "fintelligente-aviso-legal";
  function versionNum(v) { var p = String(v || "0").split("."); return (+p[0] || 0) * 1000 + (+p[1] || 0); }
  var acepto = { edad: "", rep: false, ok: false, nac: "" }, nAcepto = 0;
  // Se pide la fecha de cumpleaños (como en las redes sociales) para que no haya que pensar en rangos,
  // pero al servidor solo viaja el rango (18 o más, 14 a 17): la fecha se queda en este dispositivo.
  try { var a0 = JSON.parse(sessionStorage.getItem(ACEPTO_KEY) || "null"); if (a0 && a0.v === LEGAL_V) acepto = { edad: a0.edad || "", rep: !!a0.rep, ok: !!a0.ok, nac: /^\d{4}-\d{2}-\d{2}$/.test(a0.nac || "") ? a0.nac : "" }; } catch (e) {}
  function aceptoValido() { return acepto.ok && (acepto.edad === "18+" || (acepto.edad === "14-17" && acepto.rep)); }
  function aceptoDatos() { return aceptoValido() ? { v: LEGAL_V, edad: acepto.edad, representante: acepto.edad === "14-17" } : null; }
  function diasMes(y, m) { return new Date(y, m, 0).getDate(); }
  function edadDe(nac) {
    var p = nac.split("-").map(Number), h = new Date(), e = h.getFullYear() - p[0];
    if (h.getMonth() + 1 < p[1] || (h.getMonth() + 1 === p[1] && h.getDate() < p[2])) e--;
    return e;
  }
  function rangoDe(e) { return e >= 18 ? "18+" : e >= EDAD_MIN ? "14-17" : "-14"; }
  function textoNac(nac) { var p = nac.split("-").map(Number); return p[2] + " " + MESES_C[p[1] - 1] + " " + p[0]; }
  function pintarAcepto(id) {
    var el = $(id); if (!el || el.dataset.listo) return;
    el.dataset.listo = "1";
    var n = "nac-" + (++nAcepto), hoy = new Date(), Y = hoy.getFullYear();
    var anios = []; for (var y = Y - 100; y <= Y; y++) anios.push(y);
    el.innerHTML = '<div class="nac">' +
      '<button type="button" class="edad-btn nac-btn" aria-expanded="false" aria-controls="' + n + '"><span class="edad-ic" aria-hidden="true"><svg class="ic"><use href="#i-cal"/></svg></span>' +
      '<span class="edad-txt"><small>Tu fecha de cumpleaños</small><b>Elige tu fecha</b></span><span class="nac-min" title="Edad mínima para crear una cuenta">Desde ' + EDAD_MIN + ' años</span>' +
      '<svg class="ic edad-flecha" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<div class="nac-panel" id="' + n + '" hidden><div class="nac-ruedas" role="group" aria-label="Fecha de cumpleaños">' +
        '<div class="nac-rueda" data-r="d" role="listbox" tabindex="0" aria-label="Día"></div>' +
        '<div class="nac-rueda" data-r="m" role="listbox" tabindex="0" aria-label="Mes"></div>' +
        '<div class="nac-rueda" data-r="a" role="listbox" tabindex="0" aria-label="Año"></div><span class="nac-marco" aria-hidden="true"></span></div>' +
        '<p class="nac-edad" aria-live="polite"></p><button type="button" class="btn primary full nac-listo">Listo</button></div>' +
      '<p class="nac-nota"><svg class="ic" aria-hidden="true"><use href="#i-lock"/></svg><span>Esto no se muestra a nadie. Solo confirma que tienes la edad mínima de <b>' + EDAD_MIN + ' años</b>; la fecha se queda en tu dispositivo.</span></p></div>' +
      '<label class="acepto-chk" data-rep hidden><input type="checkbox" data-k="rep"><span>Mi mamá, mi papá o mi representante legal leyó la política de datos y me dio permiso para crear la cuenta.</span></label>' +
      '<label class="acepto-chk"><input type="checkbox" data-k="ok"><span>Acepto los <a href="/legal/terminos.html" target="_blank" rel="noopener">términos</a> y autorizo el tratamiento de mis datos según la <a href="/legal/privacidad.html" target="_blank" rel="noopener">política de datos</a>.</span></label>' +
      '<p class="acepto-menor">¿Tienes menos de ' + EDAD_MIN + ' años? Puedes usar la app sin cuenta: tus datos se quedan en este dispositivo.</p>';
    var caja = el.querySelector(".nac"), btn = caja.querySelector(".nac-btn"), panel = caja.querySelector(".nac-panel"), salida = caja.querySelector(".nac-edad");
    var R = {}, ALTO = 40, tocado = false, tecleo = "", tTecleo = 0;
    // Valor que muestran las ruedas (si no hay fecha elegida, arrancan en hoy, como en Instagram)
    var p0 = acepto.nac ? acepto.nac.split("-").map(Number) : [Y, hoy.getMonth() + 1, hoy.getDate()], val = { d: p0[2], m: p0[1], a: p0[0] };
    function opciones(r) {
      if (r === "m") return MESES.map(function (x, i) { return { v: i + 1, t: x.charAt(0).toUpperCase() + x.slice(1) }; });
      if (r === "a") return anios.map(function (x) { return { v: x, t: String(x) }; });
      var out = []; for (var d = 1; d <= diasMes(val.a, val.m); d++) out.push({ v: d, t: String(d) }); return out;
    }
    function armar(r) {
      var w = R[r].el, ops = opciones(r); R[r].ops = ops;
      w.innerHTML = '<div class="nac-pad"></div>' + ops.map(function (o, i) { return '<div role="option" id="' + n + r + i + '" data-i="' + i + '" aria-selected="false">' + o.t + "</div>"; }).join("") + '<div class="nac-pad"></div>';
    }
    function indice(r) { var ops = R[r].ops; for (var i = 0; i < ops.length; i++) if (ops[i].v === val[r]) return i; return ops.length - 1; }
    function marcar(r) {
      var i = indice(r), w = R[r].el;
      [].forEach.call(w.querySelectorAll("[role=option]"), function (o, j) { o.setAttribute("aria-selected", String(j === i)); });
      w.setAttribute("aria-activedescendant", n + r + i);
    }
    function mover(r, suave) { var w = R[r].el; R[r].prog = true; w.scrollTo({ top: indice(r) * ALTO, behavior: suave && !reduceMotion ? "smooth" : "auto" }); marcar(r); clearTimeout(R[r].tp); R[r].tp = setTimeout(function () { R[r].prog = false; }, suave ? 420 : 60); }
    function ajustarDias() {
      var max = diasMes(val.a, val.m);
      if (R.d.ops.length !== max) { if (val.d > max) val.d = max; armar("d"); mover("d"); }
    }
    function fijar(r, v, suave) {
      val[r] = v; if (r !== "d") ajustarDias(); mover(r, suave);
      if (tocado) elegirFecha();
    }
    ["d", "m", "a"].forEach(function (r) {
      var w = caja.querySelector('[data-r="' + r + '"]'); R[r] = { el: w }; armar(r);
      w.addEventListener("scroll", function () {
        if (R[r].prog) return;
        clearTimeout(R[r].t); R[r].t = setTimeout(function () {
          var i = Math.max(0, Math.min(R[r].ops.length - 1, Math.round(w.scrollTop / ALTO)));
          if (R[r].ops[i].v !== val[r]) { tocado = true; fijar(r, R[r].ops[i].v); } else marcar(r);
        }, 90);
      });
      w.addEventListener("click", function (e) { var o = e.target.closest("[role=option]"); if (!o) return; tocado = true; fijar(r, R[r].ops[+o.dataset.i].v, true); });
      w.addEventListener("keydown", function (e) {
        var i = indice(r), ops = R[r].ops, k = e.key, j = null;
        if (k === "ArrowDown") j = i + 1; else if (k === "ArrowUp") j = i - 1; else if (k === "PageDown") j = i + 5; else if (k === "PageUp") j = i - 5;
        else if (k === "Home") j = 0; else if (k === "End") j = ops.length - 1;
        else if (k === "Enter") { e.preventDefault(); listo(); return; }
        else if (k === "Escape") { e.preventDefault(); e.stopPropagation(); cerrar(true); return; }
        else if (/^\d$/.test(k)) {   // escribir el número salta a él: 2, 0, 0, 8 = año 2008
          var t = Date.now(); tecleo = (t - tTecleo < 1200 ? tecleo : "") + k; tTecleo = t;
          for (var q = 0; q < ops.length; q++) if (String(ops[q].v) === tecleo || (r === "a" && String(ops[q].v).indexOf(tecleo) === 0 && tecleo.length >= 2)) { j = q; break; }
          if (j === null) return;
        } else return;
        e.preventDefault(); j = Math.max(0, Math.min(ops.length - 1, j)); tocado = true; fijar(r, ops[j].v, k !== "Home" && k !== "End" && !/^\d$/.test(k));
      });
    });
    caja.querySelector(".nac-ruedas").addEventListener("pointerdown", function () { tocado = true; });
    caja.querySelector(".nac-ruedas").addEventListener("wheel", function () { tocado = true; }, { passive: true });
    function abrir() {
      panel.hidden = false; caja.classList.add("abierta"); btn.setAttribute("aria-expanded", "true");
      ["d", "m", "a"].forEach(function (r) { mover(r); });
      leyenda(); setTimeout(function () { R[acepto.nac ? "d" : "a"].el.focus({ preventScroll: true }); }, 30);
    }
    function cerrar(foco) { panel.hidden = true; caja.classList.remove("abierta"); btn.setAttribute("aria-expanded", "false"); if (foco) btn.focus(); }
    function listo() { tocado = true; elegirFecha(); cerrar(true); caja.classList.add("elegida"); setTimeout(function () { caja.classList.remove("elegida"); }, 400); }
    function elegirFecha() {
      var nac = val.a + "-" + String(val.m).padStart(2, "0") + "-" + String(val.d).padStart(2, "0");
      if (nac > hoyStr()) nac = hoyStr();
      acepto.nac = nac; acepto.edad = rangoDe(edadDe(nac)); guardarAcepto(); sincronizarAcepto();
    }
    function leyenda() {
      if (!acepto.nac) { salida.textContent = "Gira las ruedas o escribe el año."; salida.className = "nac-edad"; return; }
      var e = edadDe(acepto.nac);
      salida.textContent = e >= 18 ? "Tienes " + plural(e, "año") + ". Todo listo." :
        e >= EDAD_MIN ? "Tienes " + plural(e, "año") + ". Como eres menor de 18, pídele a tu mamá, a tu papá o a quien te cuida que lea la política de datos y te dé permiso." :
        "Tienes " + plural(Math.max(0, e), "año") + ". Todavía no puedes crear una cuenta, pero sí usar la app sin cuenta en este dispositivo.";
      salida.className = "nac-edad " + (e >= 18 ? "ok" : e >= EDAD_MIN ? "medio" : "menor");
    }
    el._nac = function () {
      if (acepto.nac) { var p = acepto.nac.split("-").map(Number); val = { d: p[2], m: p[1], a: p[0] }; if (R.d.ops.length !== diasMes(val.a, val.m)) armar("d"); if (!panel.hidden) ["d", "m", "a"].forEach(function (r) { mover(r); }); else ["d", "m", "a"].forEach(marcar); }
      leyenda();
    };
    btn.addEventListener("click", function () { panel.hidden ? abrir() : cerrar(true); });
    caja.querySelector(".nac-listo").addEventListener("click", listo);
    el.addEventListener("change", function (e) {
      var t = e.target;
      if (t.dataset.k === "rep") acepto.rep = t.checked;
      else if (t.dataset.k === "ok") acepto.ok = t.checked;
      guardarAcepto(); sincronizarAcepto();
    });
    sincronizarAcepto();
  }
  function guardarAcepto() {
    try { sessionStorage.setItem(ACEPTO_KEY, JSON.stringify({ v: LEGAL_V, edad: acepto.edad, rep: acepto.rep, ok: acepto.ok, nac: acepto.nac })); } catch (e) {}
    // Para Google por redirección: el servidor la lee cuando Google devuelve a la persona (vence en 15 minutos).
    try {
      document.cookie = aceptoValido() ? "ft_acepto=" + LEGAL_V + "~" + (acepto.edad === "18+" ? "18" : "14") + "~" + (acepto.rep ? 1 : 0) + "; path=/; max-age=900; SameSite=None; Secure"
        : "ft_acepto=; path=/; max-age=0; SameSite=None; Secure";
    } catch (e) {}
  }
  function sincronizarAcepto() {
    document.querySelectorAll(".acepto").forEach(function (el) {
      var b = el.querySelector(".edad-txt b");
      if (b) {
        var e = acepto.nac ? edadDe(acepto.nac) : null;
        b.textContent = acepto.nac ? textoNac(acepto.nac) + " · " + plural(Math.max(0, e), "año") : acepto.edad ? (acepto.edad === "18+" ? "18 años o más" : acepto.edad === "14-17" ? "Entre 14 y 17 años" : "Menos de 14 años") : "Elige tu fecha";
        el.querySelector(".nac").classList.toggle("con-valor", !!acepto.edad);
      }
      if (el._nac) el._nac();
      var men = el.querySelector(".acepto-menor"); if (men) men.classList.toggle("destacado", acepto.edad === "-14");
      var rep = el.querySelector("[data-rep]"); if (rep) { rep.hidden = acepto.edad !== "14-17"; rep.querySelector("input").checked = acepto.rep; }
      var ok = el.querySelector('[data-k="ok"]'); if (ok) ok.checked = acepto.ok;
    });
    var v = aceptoValido();
    document.querySelectorAll(".g-bloqueo").forEach(function (b) { b.hidden = v; });
    if (v) { if ($("bienv-msg")) $("bienv-msg").textContent = ""; }
  }
  function faltaAcepto(decir) {
    if (aceptoValido()) return false;
    decir(!acepto.edad ? "Primero elige tu fecha de cumpleaños para confirmar tu edad." : acepto.edad === "-14" ? "Con menos de 14 años no se puede crear una cuenta. Puedes usar la app sin cuenta: tus datos se quedan en este dispositivo." : acepto.edad === "14-17" && !acepto.rep ? "Como tienes menos de 18 años, necesitamos la autorización de tu mamá, papá o representante legal." : "Para crear o abrir tu cuenta, acepta los términos y la política de datos.");
    document.querySelectorAll(".acepto").forEach(function (el) { if (el.offsetParent) { el.classList.remove("falta"); void el.offsetWidth; el.classList.add("falta"); } });
    return true;
  }
  function decirBienv(m) { $("bienv-msg").textContent = m; $("bienv-msg").className = "msg center err"; }
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".g-bloqueo"); if (!b) return;
    faltaAcepto(b.closest("#dlg-bienvenida") ? decirBienv : function (m) { ctaMsg("cta-msg", m, "err"); });
  });
  // Quien ya tenía cuenta, o si se publica una versión nueva de los documentos, acepta una vez desde la app.
  function revisarAcepto(u) {
    if (!cuenta || !u || (u.acepto && u.acepto.v === LEGAL_V)) return;
    if (u.acepto && versionNum(u.acepto.v) >= versionNum(LEGAL_MIN)) { avisoCambioLegal(); return; }
    var d = aceptoDatos();
    if (d) { apiC("/api/cuenta/acepto", { method: "POST", body: JSON.stringify(d) }).then(function (j) { if (j._status === 200 && cuenta) { cuenta.usuario = j.usuario; cuentaGuardar(); } }, function () {}); return; }
    if (!$("dlg-acepto").hidden) return;
    $("acepto-msg").textContent = "";
    openDlg("dlg-acepto", "#acepto-ok");
  }
  // Aviso único de un cambio que no pide aceptar de nuevo
  function avisoCambioLegal() {
    try { if (localStorage.getItem(AVISO_LEGAL_KEY) === LEGAL_V) return; localStorage.setItem(AVISO_LEGAL_KEY, LEGAL_V); } catch (e) { return; }
    toast("Actualizamos la política de privacidad (versión " + LEGAL_V + "): ahora puedes compartir tus precios de forma anónima en ¿Dónde compro? Si no lo activas, nada cambia.",
      { action: "Ver cambios", ms: 12000, onAction: function () { window.open("/legal/privacidad.html#cambios", "_blank", "noopener"); } });
  }
  $("acepto-ok").addEventListener("click", function () {
    if (faltaAcepto(function (m) { $("acepto-msg").textContent = m; $("acepto-msg").className = "msg err"; })) return;
    var b = this; b.disabled = true;
    apiC("/api/cuenta/acepto", { method: "POST", body: JSON.stringify(aceptoDatos()) }).then(function (j) {
      b.disabled = false;
      if (j._status !== 200) { $("acepto-msg").textContent = j.error || "No pudimos guardar tu aceptación. Intenta de nuevo."; $("acepto-msg").className = "msg err"; return; }
      if (cuenta) { cuenta.usuario = j.usuario; cuentaGuardar(); }
      closeDlg("dlg-acepto");
    }, function () { b.disabled = false; $("acepto-msg").textContent = "Sin conexión. Intenta de nuevo."; $("acepto-msg").className = "msg err"; });
  });
  // No aceptar: se cierra la sesión (los datos de este dispositivo se cuidan como siempre).
  $("acepto-salir").addEventListener("click", function () { if (!cuenta) return; setTimeout(function () { abrirPerfil(); $("perfil-salir").click(); }, 0); });

  function entrarOk(j) {
    cuenta = { token: j.token, usuario: j.usuario, version: 0, sucio: false, auto: true, e2e: null };
    cuentaGuardar();
    try { localStorage.setItem(BIENV_KEY, "1"); } catch (e) {}
    $("dlg-bienvenida").hidden = true;
    if (j.usuario.licencia && !licencia) guardarLicencia(j.usuario.licencia.ref, j.usuario.licencia.token);
    else subirLicencia();
    renderCuentaUI(); revisarAcepto(j.usuario);
    if ($("dlg-cuenta").hidden) openDlg("dlg-cuenta");
    ctaPaso("listo"); $("cta-listo-t").textContent = "Guardando…"; $("cta-listo-card").innerHTML = ""; $("cta-listo-dev").innerHTML = "";
    return apiC("/api/datos?meta=1").then(function (m) {
      if (m._status === 401) { sesionTerminada(); return; }
      if (m._status !== 200) { status("No pudimos revisar tu cuenta ahora; se intentará de nuevo", "dirty"); cuenta.sucio = true; cuentaGuardar(); mostrarListo(); return; }
      if (!m.version) return subirNube(0).then(mostrarListo);
      // Sin datos propios aquí (ejemplo o vacío): se traen los de la cuenta. Nunca se sube un presupuesto vacío encima.
      if (sinDatosPropios()) return bajarNube().then(function (ok) { if (ok) mostrarListo(); else if (!pendienteE2E) abrirElegir(m, "primera"); });
      abrirElegir(m, "primera");
    }, function () { status("Sin conexión: se copiará cuando vuelva el internet", "dirty"); cuenta.sucio = true; cuentaGuardar(); mostrarListo(); });
  }
  function sinDatosPropios() {
    if (state.ejemplo) return true;
    if (state.metas.length || state.deudas.length || (state.porPagar || []).length) return false;
    if ((state.cuentas || []).some(function (c) { return num(c.saldo); })) return false;
    return monthKeys().every(function (k) { var m = state.meses[k]; return m.ingresos.concat(m.gastos).every(function (r) { return !num(r.real) && !num(r.plan); }); });
  }
  function abrirElegir(meta, modo) {
    eleccionNube = { meta: meta, modo: modo };
    if ($("dlg-cuenta").hidden) openDlg("dlg-cuenta");
    ctaPaso("elegir");
    var cuando = haceCuanto(meta.actualizado), desde = meta.dispositivo ? " desde " + meta.dispositivo : "";
    if (modo === "conflicto") {
      $("cta-elegir-t").textContent = "Tu presupuesto cambió en otro dispositivo";
      $("cta-elegir-p").textContent = "La copia de tu cuenta se actualizó " + cuando + desde + ", y aquí también hay cambios sin copiar. ¿Cuál quieres conservar?";
      $("cta-usar-nube").textContent = "Usar la de la nube"; $("cta-usar-local").textContent = "Conservar la de este dispositivo";
    } else {
      $("cta-elegir-t").textContent = "Ya tienes datos en tu cuenta";
      $("cta-elegir-p").textContent = "Se guardaron " + cuando + desde + ". En este dispositivo también tienes datos. ¿Cuáles quieres usar?";
      $("cta-usar-nube").textContent = "Usar los de mi cuenta"; $("cta-usar-local").textContent = "Usar los de este dispositivo";
    }
    $("cta-msg3").textContent = "";
  }
  function mostrarListo() {
    if (!cuenta) return;
    var u = cuenta.usuario, n = primerNombre(u);
    ctaPaso("listo");
    $("cta-listo-t").textContent = n ? "¡Listo, " + n + "!" : "¡Listo!";
    $("cta-listo-card").innerHTML = '<div class="acct-who"><span class="avatar" aria-hidden="true">' + esc(iniciales(u)) + '</span><div class="acct-name"><b>' + esc(u.nombre || u.correo) + "</b><span>" + esc(u.nombre ? u.correo : (u.google ? "Cuenta de Google" : "Entraste con tu correo")) + "</span></div></div>" +
      '<div class="acct-row"><span>Copia en la nube</span>' + (cuenta.sucio ? '<span class="pill-warn">Pendiente</span>' : '<span class="pill-ok">Al día · ' + esc(haceCuanto(cuenta.actualizado) || "ahora") + "</span>") + "</div>" +
      '<div class="acct-row"><span>Datos guardados</span><b>' + esc(resumenDatos()) + "</b></div>";
    $("cta-listo-dev").innerHTML = '<div class="dev"><svg class="ic" aria-hidden="true"><use href="#i-' + (/android|iphone/i.test(nombreDispositivo()) ? "phone" : "monitor") + '"/></svg><div class="acct-name"><b>Este dispositivo</b><span>' + esc(nombreDispositivo()) + " · ahora</span></div></div>" +
      '<div class="dev sugerido"><svg class="ic" aria-hidden="true"><use href="#i-' + (/android|iphone/i.test(nombreDispositivo()) ? "monitor" : "phone") + '"/></svg><div class="acct-name"><b>¿Lo quieres en otro dispositivo?</b><span>Entra a ' + esc(location.host) + " con el mismo " + (u.google ? "Google" : "correo") + ".</span></div></div>";
    renderCuentaUI();
  }

  // --- Pantalla A: hoja para entrar ---
  function ctaPaso(p) { ["inicio", "codigo", "elegir", "clave", "listo"].forEach(function (k) { $("cta-" + k).hidden = k !== p; }); }
  function abrirCuenta(paso) {
    $("menu-mas").hidden = true;
    if (cuenta && paso !== "clave") { abrirPerfil(); return; }
    $("cta-msg").textContent = ""; $("cta-msg").className = "msg";
    ctaPaso(paso || "inicio");
    openDlg("dlg-cuenta", paso === "clave" ? "#cta-clave-in" : null);
    if (!paso || paso === "inicio") pintarGoogle("cta-google", "cta-google-btn");
    var sinCorreo = !ctaCfg.correo;
    $("cta-correo-box").hidden = sinCorreo; $("cta-o").hidden = sinCorreo || !ctaCfg.google;
    if (sinCorreo && !ctaCfg.google) { $("cta-msg").textContent = "Las cuentas se están activando. Vuelve a intentarlo en un rato."; $("cta-msg").className = "msg err"; }
  }
  function ctaMsg(id, t, cls) { var el = $(id); el.textContent = t || ""; el.className = "msg" + (cls ? " " + cls : ""); }
  $("btn-cuenta").addEventListener("click", function () { abrirCuenta(); });
  $("cta-enviar").addEventListener("click", function () {
    var c = $("cta-correo").value.trim(), btn = this;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c)) { ctaMsg("cta-msg", "Escribe un correo válido.", "err"); $("cta-correo").focus(); return; }
    if (faltaAcepto(function (m) { ctaMsg("cta-msg", m, "err"); })) return;
    btn.disabled = true; ctaMsg("cta-msg", "Enviando tu código…");
    apiC("/api/cuenta/codigo", { method: "POST", body: JSON.stringify({ correo: c }) }).then(function (j) {
      btn.disabled = false;
      if (j._status !== 200) {
        ctaMsg("cta-msg", j.error || "No pudimos enviar el código. Intenta de nuevo.", "err");
        if (j.usarGoogle && ctaCfg.google) { var gw = $("cta-google"); gw.classList.add("resaltar"); try { gw.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {} }
        return;
      }
      ctaCorreo = c.toLowerCase(); ctaMsg("cta-msg", "");
      $("cta-correo-txt").textContent = ctaCorreo;
      ctaPaso("codigo"); limpiarCodigo(); ctaMsg("cta-msg2", "");
      $("cta-code").querySelector("input").focus();
      contarReenvio(45);
    }, function () { btn.disabled = false; ctaMsg("cta-msg", "Sin conexión. Revisa tu internet.", "err"); });
  });
  $("cta-correo").addEventListener("keydown", function (e) { if (e.key === "Enter") $("cta-enviar").click(); });
  $("cta-volver").addEventListener("click", function () { ctaPaso("inicio"); clearInterval(reenvioTimer); $("cta-correo").focus(); });
  function contarReenvio(seg) {
    clearInterval(reenvioTimer);
    var p = $("cta-reenvio"), pintar = function () {
      if (seg > 0) p.innerHTML = "¿No te llegó? Revisa la carpeta de spam. Puedes pedir otro en 0:" + ("0" + seg).slice(-2) + ".";
      else { p.innerHTML = '¿No te llegó? Revisa la carpeta de spam o <button class="link-btn" type="button" id="cta-reenviar">envíame otro código</button>.'; clearInterval(reenvioTimer); }
      seg--;
    };
    pintar(); reenvioTimer = setInterval(pintar, 1000);
  }
  $("cta-codigo").addEventListener("click", function (e) {
    if (e.target.id !== "cta-reenviar") return;
    $("cta-correo").value = ctaCorreo; ctaPaso("inicio"); $("cta-enviar").click();
  });
  var codeInputs = [].slice.call($("cta-code").querySelectorAll("input"));
  function limpiarCodigo() { codeInputs.forEach(function (i) { i.value = ""; }); }
  function codigoActual() { return codeInputs.map(function (i) { return i.value; }).join(""); }
  codeInputs.forEach(function (inp, i) {
    inp.addEventListener("input", function () {
      var d = inp.value.replace(/\D/g, "");
      if (d.length > 1) {   // pegó el código completo
        d.slice(0, 6).split("").forEach(function (ch, k) { if (codeInputs[i + k]) codeInputs[i + k].value = ch; });
        (codeInputs[Math.min(5, i + d.length)] || inp).focus();
      } else { inp.value = d; if (d && codeInputs[i + 1]) codeInputs[i + 1].focus(); }
      if (codigoActual().length === 6) $("cta-verificar").click();
    });
    inp.addEventListener("keydown", function (e) { if (e.key === "Backspace" && !inp.value && codeInputs[i - 1]) { codeInputs[i - 1].focus(); codeInputs[i - 1].value = ""; e.preventDefault(); } });
  });
  $("cta-verificar").addEventListener("click", function () {
    var cod = codigoActual(), btn = this;
    if (cod.length !== 6) { ctaMsg("cta-msg2", "Escribe los 6 números.", "err"); return; }
    if (btn.disabled) return;
    btn.disabled = true; ctaMsg("cta-msg2", "Verificando…");
    apiC("/api/cuenta/verificar", { method: "POST", body: JSON.stringify({ correo: ctaCorreo, codigo: cod, dispositivo: nombreDispositivo(), consentimiento: aceptoDatos() }) }).then(function (j) {
      btn.disabled = false;
      if (j._status !== 200 || !j.token) { ctaMsg("cta-msg2", j.error || "No pudimos verificar el código.", "err"); limpiarCodigo(); codeInputs[0].focus(); return; }
      clearInterval(reenvioTimer); ctaMsg("cta-msg2", "");
      entrarOk(j);
    }, function () { btn.disabled = false; ctaMsg("cta-msg2", "Sin conexión. Revisa tu internet.", "err"); });
  });
  $("cta-usar-nube").addEventListener("click", function () {
    ctaMsg("cta-msg3", "Trayendo tus datos…");
    bajarNube().then(function (ok) { if (ok) { toast("Listo: estás viendo los datos de tu cuenta. Los de antes quedaron como copia en este dispositivo."); mostrarListo(); } });
  });
  $("cta-usar-local").addEventListener("click", function () {
    ctaMsg("cta-msg3", "Guardando los datos de este dispositivo…");
    var v = eleccionNube && eleccionNube.meta ? eleccionNube.meta.version : (cuenta && cuenta.version) || 0;
    subirNube(v).then(function (ok) { if (ok) mostrarListo(); else ctaMsg("cta-msg3", "No se pudo guardar ahora. Intenta de nuevo.", "err"); });
  });
  $("cta-clave-ok").addEventListener("click", function () {
    var clave = $("cta-clave-in").value;
    if (!pendienteE2E) { closeDlg("dlg-cuenta"); return; }
    ctaMsg("cta-msg4", "Abriendo…");
    var salt = pendienteE2E.split(":")[1];
    e2eDerivar(clave, salt).then(function (k) {
      return e2eAbrir(pendienteE2E, k).then(function () { return idbDo("readwrite", function (st) { return st.put(k, "cuenta-e2e"); }); });
    }).then(function () {
      cuenta.e2e = { activo: true, salt: salt }; cuentaGuardar(); pendienteE2E = null; $("cta-clave-in").value = "";
      return bajarNube().then(function (ok) { if (ok) mostrarListo(); });
    }, function () { ctaMsg("cta-msg4", "Esa clave no abre tus datos. Revísala.", "err"); });
  });

  // --- Google ---
  // En iPhone con la app en la pantalla de inicio, la ventana emergente de Google no puede volver a la app.
  // Ahí se usa el modo redirección: Google vuelve a /api/cuenta/google-redirect y este entrega un código
  // de un solo uso (#entrar=...) que la app canjea por la sesión.
  function googlePorRedireccion() {
    try { if (/[?&]google=redireccion/.test(location.search)) return true; } catch (e) {}
    return esIOS() && instalada();
  }
  function entradaGooglePendiente() {
    var m = /^#entrar=([A-Za-z0-9_-]{32})$/.exec(location.hash || ""), e = /^#entrar-error=(\w+)$/.exec(location.hash || "");
    if (!m && !e) return;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (er) {}
    $("dlg-bienvenida").hidden = true;
    openDlg("dlg-cuenta"); ctaPaso("inicio");
    if (e) { ctaMsg("cta-msg", e[1] === "limite" ? "Demasiados intentos. Espera un rato." : e[1] === "consentimiento" ? "Para crear tu cuenta, confirma tu edad y acepta los términos y la política de datos. Luego vuelve a tocar Continuar con Google." : "No pudimos confirmar tu cuenta de Google. Intenta de nuevo.", "err"); configApp().then(function () { pintarGoogle("cta-google", "cta-google-btn"); }, function () {}); return; }
    ctaMsg("cta-msg", "Entrando con Google…");
    apiC("/api/cuenta/canjear", { method: "POST", body: JSON.stringify({ codigo: m[1] }) }).then(function (j) {
      if (j._status !== 200 || !j.token) { ctaMsg("cta-msg", j.error || "No pudimos entrar con Google.", "err"); configApp().then(function () { pintarGoogle("cta-google", "cta-google-btn"); }, function () {}); return; }
      ctaMsg("cta-msg", ""); entrarOk(j);
    }, function () { ctaMsg("cta-msg", "Sin conexión. Revisa tu internet.", "err"); });
  }
  function cargarGIS() {
    if (gisListo) return Promise.resolve();
    if (gisCargando) return gisCargando;
    gisCargando = new Promise(function (res, rej) {
      var sc = document.createElement("script");
      sc.src = "https://accounts.google.com/gsi/client"; sc.async = true;
      sc.onload = function () {
        try {
          var redir = googlePorRedireccion();
          google.accounts.id.initialize(redir
            ? { client_id: ctaCfg.google, ux_mode: "redirect", login_uri: location.origin + "/api/cuenta/google-redirect", auto_select: false, context: "use" }
            : { client_id: ctaCfg.google, callback: alEntrarGoogle, ux_mode: "popup", auto_select: false, cancel_on_tap_outside: true, use_fedcm_for_button: true, context: "use" });
          gisListo = true; res();
        } catch (e) { rej(e); }
      };
      sc.onerror = rej;
      document.head.appendChild(sc);
    });
    return gisCargando;
  }
  function pintarGoogle(wrapId, btnId) {
    var wrap = $(wrapId);
    if (!ctaCfg.google) { wrap.hidden = true; return; }
    wrap.hidden = false;
    cargarGIS().then(function () {
      var el = $(btnId); el.innerHTML = "";
      google.accounts.id.renderButton(el, { type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "pill", logo_alignment: "center", locale: "es", width: Math.max(220, Math.min(400, wrap.clientWidth || 320)) });
    }, function () { wrap.hidden = true; });
  }
  function alEntrarGoogle(resp) {
    if (!resp || !resp.credential) return;
    if (!$("dlg-bienvenida").hidden) { $("dlg-bienvenida").hidden = true; }
    if ($("dlg-cuenta").hidden) openDlg("dlg-cuenta");
    ctaPaso("inicio"); ctaMsg("cta-msg", "Entrando con Google…");
    apiC("/api/cuenta/google", { method: "POST", body: JSON.stringify({ credencial: resp.credential, dispositivo: nombreDispositivo(), consentimiento: aceptoDatos() }) }).then(function (j) {
      if (j._status !== 200 || !j.token) { ctaMsg("cta-msg", j.error || "No pudimos entrar con Google.", "err"); if (j.necesitaConsentimiento) faltaAcepto(function () {}); return; }
      ctaMsg("cta-msg", ""); entrarOk(j);
    }, function () { ctaMsg("cta-msg", "Sin conexión. Revisa tu internet.", "err"); });
  }

  // --- Pantalla C2: tu cuenta ---
  function abrirPerfil() {
    $("menu-mas").hidden = true;
    $("perfil-msg").textContent = ""; $("perfil-e2e-form").hidden = true; $("perfil-borrar").dataset.armado = ""; $("perfil-borrar").textContent = "Borrar mi cuenta y mis datos de la nube"; var ps = $("perfil-salir"); ps.dataset.armado = ""; ps.disabled = false; ps.querySelector("span").textContent = "Cerrar sesión en este dispositivo";
    renderPerfil(); openDlg("dlg-perfil");
    $("perfil-dev").innerHTML = '<p class="hint">Cargando…</p>';
    apiC("/api/cuenta").then(function (j) {
      if (j._status === 401) { closeDlg("dlg-perfil"); sesionTerminada(); return; }
      if (j._status !== 200 || !cuenta) { $("perfil-dev").innerHTML = '<p class="hint">No se pudo cargar. Revisa tu conexión.</p>'; return; }
      cuenta.usuario = j.usuario; cuentaGuardar(); renderPerfil();
      $("perfil-dev").innerHTML = (j.dispositivos || []).map(function (d) {
        var ic = /android|iphone/i.test(d.nombre) ? "phone" : "monitor";
        return '<div class="dev"><svg class="ic" aria-hidden="true"><use href="#i-' + ic + '"/></svg><div class="acct-name"><b>' + esc(d.actual ? "Este dispositivo" : d.nombre) + "</b><span>" +
          esc((d.actual ? d.nombre + " · " : "") + "activo " + haceCuanto(d.ultimo)) + "</span></div>" +
          (d.actual ? "" : '<button class="btn" type="button" data-cerrar-dev="' + esc(d.id) + '">Cerrar</button>') + "</div>";
      }).join("");
    }, function () { $("perfil-dev").innerHTML = '<p class="hint">Sin conexión.</p>'; });
  }
  function renderPerfil() {
    if (!cuenta) return;
    var u = cuenta.usuario;
    $("perfil-who").innerHTML = '<span class="avatar" aria-hidden="true">' + esc(iniciales(u)) + '</span><div class="acct-name"><b>' + esc(u.nombre || u.correo) + "</b><span>" + esc(u.nombre ? u.correo + (u.google ? " · con Google" : "") : (u.google ? "Cuenta de Google" : "Entraste con tu correo")) + "</span></div>" +
      (hasPremium() ? '<span class="pill-gold">★ Premium</span>' : "");
    var ok = !cuenta.sucio;
    $("perfil-est").textContent = ok ? "Todo guardado" : "Cambios por copiar";
    $("perfil-est-sub").textContent = cuenta.actualizado ? "Última copia: " + haceCuanto(cuenta.actualizado) : "Aún no hay copia en la nube";
    $("perfil-est-ic").className = "cta-ic sm " + (ok ? "ok" : "warn");
    $("perfil-auto").checked = cuenta.auto !== false;
    $("perfil-e2e").checked = !!(cuenta.e2e && cuenta.e2e.activo);
  }
  $("perfil-copiar").addEventListener("click", function () {
    var b = this; b.disabled = true; $("perfil-msg").textContent = "Copiando…"; $("perfil-msg").className = "msg";
    subirNube().then(function (ok) { b.disabled = false; renderPerfil(); $("perfil-msg").textContent = ok ? "Copia al día." : "No se pudo copiar ahora."; $("perfil-msg").className = "msg " + (ok ? "ok" : "err"); });
  });
  $("perfil-auto").addEventListener("change", function () { if (!cuenta) return; cuenta.auto = this.checked; cuentaGuardar(); if (cuenta.auto && cuenta.sucio) subirNube().then(renderPerfil); });
  $("perfil-e2e").addEventListener("change", function () {
    if (!cuenta) return;
    if (this.checked) { this.checked = false; $("perfil-e2e-form").hidden = false; $("e2e-1").focus(); return; }
    if (!confirm("¿Quitar tu clave de cifrado? Tu copia seguirá cifrada por Finti, pero ya no con tu clave propia.")) { this.checked = true; return; }
    idbDo("readwrite", function (st) { return st.delete("cuenta-e2e"); }).catch(function () {});
    cuenta.e2e = null; cuentaGuardar();
    subirNube().then(renderPerfil);
  });
  $("e2e-no").addEventListener("click", function () { $("perfil-e2e-form").hidden = true; $("e2e-1").value = ""; $("e2e-2").value = ""; });
  $("e2e-ok").addEventListener("click", function () {
    var a = $("e2e-1").value, b = $("e2e-2").value, msg = $("perfil-msg");
    if (a.length < 8) { msg.textContent = "Usa al menos 8 caracteres."; msg.className = "msg err"; return; }
    if (a !== b) { msg.textContent = "Las dos claves no coinciden."; msg.className = "msg err"; return; }
    msg.textContent = "Cifrando…"; msg.className = "msg";
    var salt = b64e(crypto.getRandomValues(new Uint8Array(16)));
    e2eDerivar(a, salt).then(function (k) { return idbDo("readwrite", function (st) { return st.put(k, "cuenta-e2e"); }); }).then(function () {
      cuenta.e2e = { activo: true, salt: salt }; cuentaGuardar();
      $("e2e-1").value = ""; $("e2e-2").value = ""; $("perfil-e2e-form").hidden = true;
      return subirNube();
    }).then(function (ok) { renderPerfil(); msg.textContent = ok ? "Listo: tu copia en la nube ahora está cifrada con tu clave." : "No se pudo copiar ahora; se intentará de nuevo."; msg.className = "msg " + (ok ? "ok" : "err"); });
  });
  $("perfil-dev").addEventListener("click", function (e) {
    var b = e.target.closest("[data-cerrar-dev]"); if (!b) return;
    b.disabled = true;
    apiC("/api/cuenta/salir", { method: "POST", body: JSON.stringify({ dispositivo: b.dataset.cerrarDev }) }).then(function () { abrirPerfil(); });
  });
  $("perfil-descargar").addEventListener("click", function () { $("btn-export").click(); $("perfil-msg").textContent = "Descargamos un respaldo con todos tus datos."; $("perfil-msg").className = "msg ok"; });
  $("perfil-salir").addEventListener("click", function () {
    var b = this, msg = $("perfil-msg"), forzar = b.dataset.armado === "1";
    if (!cuenta || b.disabled) return;
    b.disabled = true; msg.textContent = "Guardando tus últimos cambios…"; msg.className = "msg";
    (cuenta.sucio ? subirNube() : Promise.resolve(true)).then(function (ok) {
      if (!ok && !forzar) {
        b.disabled = false; b.dataset.armado = "1";
        b.querySelector("span").textContent = "Cerrar sesión de todas formas";
        msg.textContent = "No pudimos copiar tus últimos cambios a la nube. Revisa tu conexión y vuelve a intentarlo. Si cierras sesión ahora, esos cambios se quedan solo en este dispositivo.";
        msg.className = "msg err";
        return;
      }
      var limpio = !!ok, enCuenta = limpio && licencia && cuenta.usuario.licencia && cuenta.usuario.licencia.ref === licencia.ref;
      msg.textContent = "Cerrando sesión…";
      apiC("/api/cuenta/salir", { method: "POST", body: "{}" }).catch(function () {}).then(function () { salirAlInicio(limpio, enCuenta); });
    });
  });
  $("perfil-borrar").addEventListener("click", function () {
    var b = this;
    if (b.dataset.armado !== "1") { b.dataset.armado = "1"; b.textContent = "¿Seguro? Se borra la copia de la nube. Toca otra vez"; return; }
    b.disabled = true;
    apiC("/api/cuenta", { method: "DELETE", body: JSON.stringify({ confirmar: "BORRAR" }) }).then(function (j) {
      b.disabled = false;
      if (j._status !== 200) { $("perfil-msg").textContent = j.error || "No se pudo borrar ahora."; $("perfil-msg").className = "msg err"; return; }
      idbDo("readwrite", function (st) { return st.delete("cuenta-e2e"); }).catch(function () {});
      cuenta = null; cuentaGuardar(); closeDlg("dlg-perfil"); renderCuentaUI();
      status("Guardado en este dispositivo", "ok");
      toast("Borramos tu cuenta y tu copia en la nube. Tus datos siguen en este dispositivo.");
    }, function () { b.disabled = false; });
  });

  // --- Pantalla C1: aviso en Inicio, y B: bienvenida ---
  function renderCuentaUI() {
    if (!WEB) return;
    var activo = ctaCfg.cuentas && (ctaCfg.google || ctaCfg.correo), btn = $("btn-cuenta");
    btn.hidden = !activo && !cuenta;
    if (cuenta) {
      btn.classList.add("on"); btn.innerHTML = esc(iniciales(cuenta.usuario)) + '<span class="dot" aria-hidden="true"></span>';
      btn.setAttribute("aria-label", "Tu cuenta: " + (cuenta.usuario.nombre || cuenta.usuario.correo)); btn.title = "Tu cuenta";
    } else {
      btn.classList.remove("on"); btn.innerHTML = '<svg class="ic"><use href="#i-user"/></svg><span class="dot" aria-hidden="true"></span>';
      btn.setAttribute("aria-label", "Guardar en la nube"); btn.title = "Guarda tu presupuesto en la nube";
    }
    var snooze = 0; try { snooze = +localStorage.getItem(AVISO_CTA_KEY) || 0; } catch (e) {}
    var verAviso = activo && !cuenta && loaded && !state.ejemplo && Date.now() > snooze;
    $("nudge-cuenta").hidden = !verAviso;
    // En iPhone, fuera del ícono de inicio, Safari puede borrar los datos de una página que no se abre en 7 días.
    var iosSafari = esIOS() && !instalada();
    $("nudge-ios-btn").hidden = !iosSafari;
    if (!iosSafari) $("nudge-ios-pasos").hidden = true;
    if (verAviso) {
      var n = monthKeys().length;
      if (iosSafari) {
        $("nudge-cuenta-t").textContent = "En iPhone, Safari puede borrar tus datos";
        $("nudge-cuenta-p").textContent = "Si pasan 7 días sin abrir esta página, Safari puede borrar lo que guardaste aquí. Crea tu cuenta o agrega la app a tu pantalla de inicio para no perder nada.";
      } else {
        $("nudge-cuenta-t").textContent = "Tu presupuesto solo vive en este dispositivo";
        $("nudge-cuenta-p").textContent = (n > 1 ? "Llevas " + n + " meses de registros. " : "Ya empezaste a organizar tu plata. ") + "Protégelos con tu cuenta en 30 segundos.";
      }
    }
    if (!$("dlg-perfil").hidden) renderPerfil();
    renderLateral();
  }
  function posponerAviso(dias) { try { localStorage.setItem(AVISO_CTA_KEY, String(Date.now() + dias * 86400000)); } catch (e) {} renderCuentaUI(); }
  $("nudge-cuenta-si").addEventListener("click", function () { abrirCuenta(); });
  $("nudge-cuenta-luego").addEventListener("click", function () { posponerAviso(7); });
  $("nudge-ios-btn").addEventListener("click", function () { var p = $("nudge-ios-pasos"); p.hidden = !p.hidden; this.setAttribute("aria-expanded", String(!p.hidden)); });
  $("nudge-cuenta-x").addEventListener("click", function () { posponerAviso(30); });
  // Pantalla de entrada: aparece antes de la app cada vez que se abre sin sesión.
  // Probar sin cuenta la quita hasta que se cierre la pestaña o la app.
  var SIN_CTA_KEY = "fintelligente-sin-cuenta", CIERRE_KEY = "fintelligente-cierre";
  function mostrarPuerta() {
    // "Probar sin cuenta" se recuerda 30 días en este dispositivo: no se vuelve a pedir cada vez que se abre la app
    var saltada = false; try { saltada = sessionStorage.getItem(SIN_CTA_KEY) === "1" || Date.now() - (+localStorage.getItem(SIN_CTA_KEY) || 0) < 30 * 864e5; } catch (e) {}
    if (!WEB || cuenta || saltada) return;
    if (/^#(importar|entrar|mudanza)/.test(location.hash) || ACCION_INICIAL || new URLSearchParams(location.search).has("id")) return;
    $("bienv-correo").hidden = true; $("bienv-espera").hidden = false;
    $("bienv-ios").hidden = !(esIOS() && !instalada());
    var cierre = ""; try { cierre = localStorage.getItem(CIERRE_KEY) || ""; localStorage.removeItem(CIERRE_KEY); } catch (e) {}
    $("bienv-cierre").hidden = !cierre;
    $("bienv-cierre").textContent = cierre === "limpio" ? "Cerraste sesión. Tu presupuesto quedó guardado en tu cuenta: entra de nuevo para verlo."
      : cierre ? "Tu sesión terminó. Tus cambios sin copiar siguen en este dispositivo." : "";
    $("dlg-bienvenida").hidden = false;
    quizaHistoria(cierre);
  }
  // La primera vez, antes de la puerta se ve la historia de bienvenida: escenas al compás, sonido,
  // vibración y cuatro tarjetas en 3D. Vive aparte en /historia/ (módulo con Shadow DOM); si no carga,
  // queda la puerta de siempre. Al terminar o saltarla no vuelve a aparecer en este dispositivo.
  var HISTORIA_KEY = "fintelligente-historia";
  function quizaHistoria(cierre) {
    var vista = ""; try { vista = localStorage.getItem(HISTORIA_KEY) || ""; } catch (e) {}
    if (vista || cierre || document.getElementById("historia-js")) return;
    var s = document.createElement("script"); s.type = "module"; s.id = "historia-js"; s.src = "/historia/historia.js";
    document.head.appendChild(s);
  }
  window.addEventListener("finti-historia-fin", function () {
    var b = $("dlg-bienvenida"); if (b && !b.hidden) { var t = $("bienv-t"); if (t) { t.setAttribute("tabindex", "-1"); t.focus(); } }
  });
  function quizaBienvenida() {
    if ($("dlg-bienvenida").hidden) return;
    if (cuenta || !ctaCfg.cuentas || !(ctaCfg.google || ctaCfg.correo)) { $("dlg-bienvenida").hidden = true; return; }
    $("bienv-espera").hidden = true;
    $("bienv-correo").hidden = !ctaCfg.correo;
    pintarGoogle("bienv-google", "bienv-google-btn");
  }
  function cerrarBienvenida() { try { sessionStorage.setItem(SIN_CTA_KEY, "1"); localStorage.setItem(SIN_CTA_KEY, String(Date.now())); } catch (e) {} $("dlg-bienvenida").hidden = true; }
  $("bienv-sin").addEventListener("click", cerrarBienvenida);
  $("bienv-correo").addEventListener("click", function () { cerrarBienvenida(); abrirCuenta(); setTimeout(function () { $("cta-correo").focus(); }, 50); });
  $("dlg-bienvenida").addEventListener("keydown", function (e) { if (e.key === "Escape") cerrarBienvenida(); });

  function initCuenta() {
    pintarAcepto("bienv-acepto"); pintarAcepto("cta-acepto"); pintarAcepto("dlg-acepto-bloque");
    var recibiendo = recibirMudanza();
    if (!recibiendo) mostrarPuerta();
    avisoMudanzaHecha();
    configApp().then(function (j) {
      ctaCfg = { cuentas: !!j.cuentas, google: j.googleClientId || "", correo: !!j.correoLogin, cargado: true };
      if (j.mudarA && !recibiendo) revisarMudanza(j.mudarA);
      renderCuentaUI(); if (!recibiendo) quizaBienvenida();
    }, function () { $("dlg-bienvenida").hidden = true; });
    if (new URLSearchParams(location.search).has("conectar")) setTimeout(abrirFuentes, 300);
    if (cuenta) {
      status(cuenta.sucio ? "Cambios por copiar a tu cuenta" : "Guardado en tu cuenta ✓", cuenta.sucio ? "dirty" : "ok");
      setTimeout(function () { sincronizar(true); }, 1200);
    }
    entradaGooglePendiente();
    window.addEventListener("online", function () { if (cuenta && cuenta.sucio) subirNube(); sincronizar(true); });
  }


