  // ===================== Modo discreto y bloqueo con PIN =====================
  // Modo discreto: difumina las cifras (todo texto con "$", las celdas de montos y las gráficas) para abrir la app en el
  // bus o la oficina. Bloqueo: un PIN de 4 a 6 números, guardado solo como huella (PBKDF2 con sal), y si el dispositivo
  // lo permite, la huella o el rostro (WebAuthn del propio dispositivo). Evita que otra persona abra la app en tu
  // celular; no cifra los datos ni reemplaza el bloqueo del teléfono.
  var DISC_KEY = "fintelligente-discreto", PIN_KEY = "fintelligente-pin";
  var discreto = false, bloq = { abierto: true, oculto: 0, fallos: 0, espera: 0 };
  function marcarCifras() {
    if (!discreto) return;
    var w = document.createTreeWalker($("app-raiz") || document.body, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      var p = n.parentElement;
      if (p && !p.classList.contains("cifra") && /\$\s?-?\d|\d\s?%|\d{1,3}(?:\.\d{3})+/.test(n.nodeValue) && !p.closest(".dlg-head, .pr-msg.yo, .bloqueo, .no-discreto, button.btn, label, .preg-ej, .pr-chips, .informe")) p.classList.add("cifra");
    }
  }
  var marcarPend = false;
  new MutationObserver(function () { if (!discreto || marcarPend) return; marcarPend = true; requestAnimationFrame(function () { marcarPend = false; marcarCifras(); }); })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
  function ponerDiscreto(on, avisar) {
    discreto = !!on;
    document.body.classList.toggle("discreto", discreto);
    try { localStorage.setItem(DISC_KEY, discreto ? "1" : ""); } catch (e) {}
    var b = $("btn-discreto");
    b.setAttribute("aria-pressed", discreto ? "true" : "false");
    b.setAttribute("aria-label", discreto ? "Mostrar las cifras" : "Ocultar las cifras");
    b.title = discreto ? "Mostrar las cifras" : "Ocultar las cifras";
    b.querySelector("use").setAttribute("href", discreto ? "#i-eye-off" : "#i-eye");
    if (discreto) marcarCifras();
    if (avisar) toast(discreto ? "Modo discreto: las cifras quedan ocultas. Toca el ojo para verlas." : "Cifras visibles.");
  }
  $("btn-discreto").addEventListener("click", function () { ponerDiscreto(!discreto, true); });
  try { if (localStorage.getItem(DISC_KEY)) ponerDiscreto(true); } catch (e) {}

  // ---------- PIN ----------
  function b64(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))); }
  function deB64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function leerPin() { try { return JSON.parse(localStorage.getItem(PIN_KEY) || "null"); } catch (e) { return null; } }
  function huellaPin(pin, sal) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]).then(function (k) {
      return crypto.subtle.deriveBits({ name: "PBKDF2", salt: sal, iterations: 150000, hash: "SHA-256" }, k, 256);
    }).then(b64);
  }
  function pinValido(p) { return /^\d{4,6}$/.test(p) && !/^(\d)\1+$/.test(p) && "0123456789".indexOf(p) < 0 && "9876543210".indexOf(p) < 0; }
  function guardarPin(pin, min) {
    var sal = crypto.getRandomValues(new Uint8Array(16)), prev = leerPin();
    return huellaPin(pin, sal).then(function (h) {
      var cfg = { v: 1, sal: b64(sal), h: h, min: min, huella: prev && prev.huella || null };
      localStorage.setItem(PIN_KEY, JSON.stringify(cfg)); return cfg;
    });
  }
  function bloquear() {
    if (!leerPin()) return;
    bloq.abierto = false;
    var cfg = leerPin();
    document.documentElement.classList.add("con-pin");
    $("bloq-pin").value = ""; $("bloq-msg").textContent = ""; pintarPuntos();
    $("bloq-huella").hidden = !(cfg.huella && window.PublicKeyCredential);
    setTimeout(function () { if (cfg.huella && window.PublicKeyCredential && !bloq.yaIntento) { bloq.yaIntento = true; entrarConHuella(); } else $("bloq-pin").focus(); }, 150);
  }
  function desbloquear() {
    bloq.abierto = true; bloq.fallos = 0; bloq.yaIntento = false;
    document.documentElement.classList.remove("con-pin");
  }
  function pintarPuntos() {
    var n = $("bloq-pin").value.length;
    $("bloq-puntos").innerHTML = [0, 1, 2, 3, 4, 5].map(function (i) { return '<i class="' + (i < n ? "lleno" : "") + (i >= 4 ? " opc" : "") + '"></i>'; }).join("");
  }
  function probarPin() {
    var pin = $("bloq-pin").value, cfg = leerPin(), msg = $("bloq-msg");
    if (Date.now() < bloq.espera) { msg.textContent = "Espera " + Math.ceil((bloq.espera - Date.now()) / 1000) + " segundos para intentar de nuevo."; return; }
    if (!pin.length) return;
    if (pin.length < 4) { msg.textContent = "El PIN tiene de 4 a 6 números."; return; }
    huellaPin(pin, deB64(cfg.sal)).then(function (h) {
      if (h === cfg.h) { desbloquear(); return; }
      bloq.fallos++; $("bloq-pin").value = ""; pintarPuntos();
      if (bloq.fallos >= 5) { bloq.espera = Date.now() + 30000 * Math.pow(2, bloq.fallos - 5); msg.textContent = "PIN incorrecto. Por seguridad, espera " + Math.round((bloq.espera - Date.now()) / 1000) + " segundos."; }
      else msg.textContent = "PIN incorrecto. Te quedan " + (5 - bloq.fallos) + " intentos antes de una pausa.";
      $("bloq-caja").classList.remove("sacudir"); void $("bloq-caja").offsetWidth; $("bloq-caja").classList.add("sacudir");
    });
  }
  $("bloq-pin").addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 6); pintarPuntos(); $("bloq-msg").textContent = "";
    var cfg = leerPin();
    if (cfg && this.value.length === (cfg.largo || 0)) probarPin();
  });
  $("bloq-form").addEventListener("submit", function (e) { e.preventDefault(); probarPin(); });
  $("bloq-olvide").addEventListener("click", function () { $("bloq-reset").hidden = !$("bloq-reset").hidden; });
  $("bloq-borrar").addEventListener("click", function () {
    var claves = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^(presupuesto|fintelligente)/.test(k)) claves.push(k); }
    claves.forEach(function (k) { localStorage.removeItem(k); });
    location.reload();
  });
  // Huella o rostro: una credencial del propio dispositivo. Al desbloquear, el sistema pide la huella; si la acepta, entra.
  function huellaDisponible() {
    if (!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return Promise.resolve(false);
    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; });
  }
  function registrarHuella() {
    return navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: "Finti" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "fintelligente", displayName: "Finti" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" }, timeout: 60000
    } }).then(function (c) { var cfg = leerPin(); cfg.huella = b64(c.rawId); localStorage.setItem(PIN_KEY, JSON.stringify(cfg)); });
  }
  function entrarConHuella() {
    var cfg = leerPin(); if (!cfg || !cfg.huella) return;
    navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: "public-key", id: deB64(cfg.huella) }], userVerification: "required", timeout: 60000 } })
      .then(function (r) { if (r) desbloquear(); }).catch(function () { $("bloq-msg").textContent = "No se pudo con la huella. Escribe tu PIN."; $("bloq-pin").focus(); });
  }
  $("bloq-huella").addEventListener("click", entrarConHuella);
  document.addEventListener("visibilitychange", function () {
    var cfg = leerPin(); if (!cfg || !bloq.abierto) return;
    if (document.hidden) bloq.oculto = Date.now();
    else if (bloq.oculto && Date.now() - bloq.oculto >= (cfg.min || 0) * 60000) bloquear();
  });

  // ---------- Ajustes: dlg-privado ----------
  function pintarPrivado() {
    var cfg = leerPin();
    $("priv-discreto").checked = discreto;
    $("priv-pin-estado").textContent = cfg ? "Activo" + (cfg.huella ? ", con huella o rostro" : "") + "." : "Sin PIN.";
    $("priv-pin-crear").textContent = cfg ? "Cambiar el PIN" : "Poner un PIN";
    $("priv-pin-quitar").hidden = !cfg; $("priv-tiempo-fila").hidden = !cfg;
    if (cfg) $("priv-tiempo").value = String(cfg.min || 0);
    $("priv-pin-form").hidden = true; $("priv-msg").textContent = "";
    $("priv-huella").hidden = true;
    if (cfg) huellaDisponible().then(function (ok) { $("priv-huella").hidden = !ok; $("priv-huella").textContent = cfg.huella ? "Dejar de usar la huella" : "Usar huella o rostro"; });
  }
  function abrirPrivado() { $("menu-mas").hidden = true; pintarPrivado(); openDlg("dlg-privado", "#priv-discreto"); }
  $("btn-privado-menu").addEventListener("click", abrirPrivado);
  $("priv-discreto").addEventListener("change", function () { ponerDiscreto(this.checked, false); });
  $("priv-pin-crear").addEventListener("click", function () { $("priv-pin-form").hidden = false; $("priv-pin1").value = ""; $("priv-pin2").value = ""; $("priv-pin1").focus(); });
  $("priv-pin-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var a = $("priv-pin1").value, b = $("priv-pin2").value, msg = $("priv-msg");
    if (!/^\d{4,6}$/.test(a)) { msg.textContent = "El PIN debe tener de 4 a 6 números."; msg.className = "msg err"; return; }
    if (!pinValido(a)) { msg.textContent = "Ese PIN es muy fácil de adivinar. Evita números repetidos o seguidos."; msg.className = "msg err"; return; }
    if (a !== b) { msg.textContent = "Los dos PIN no coinciden."; msg.className = "msg err"; return; }
    var prev = leerPin();
    guardarPin(a, prev ? prev.min : 1).then(function (cfg) {
      cfg.largo = a.length; localStorage.setItem(PIN_KEY, JSON.stringify(cfg));
      pintarPrivado(); $("priv-msg").textContent = "Listo. La app te pedirá el PIN al abrirla."; $("priv-msg").className = "msg ok";
      metrica("pin", "una");
    });
  });
  $("priv-pin-quitar").addEventListener("click", function () { localStorage.removeItem(PIN_KEY); pintarPrivado(); $("priv-msg").textContent = "Quitaste el PIN."; $("priv-msg").className = "msg"; });
  $("priv-tiempo").addEventListener("change", function () { var cfg = leerPin(); if (!cfg) return; cfg.min = +this.value; localStorage.setItem(PIN_KEY, JSON.stringify(cfg)); });
  $("priv-huella").addEventListener("click", function () {
    var cfg = leerPin(); if (!cfg) return;
    if (cfg.huella) { cfg.huella = null; localStorage.setItem(PIN_KEY, JSON.stringify(cfg)); pintarPrivado(); return; }
    registrarHuella().then(function () { pintarPrivado(); $("priv-msg").textContent = "Listo. Al abrir la app podrás entrar con tu huella o rostro."; $("priv-msg").className = "msg ok"; })
      .catch(function () { $("priv-msg").textContent = "No se pudo activar la huella en este dispositivo."; $("priv-msg").className = "msg err"; });
  });
  if (leerPin()) bloquear();

