  // ===================== Salud técnica: errores y métricas anónimas =====================
  // Si la app falla en un teléfono, llega el mensaje del error (sin números, correos ni datos de la persona) para
  // poder arreglarlo. Las métricas son contadores por día (abrir la app, primer movimiento, ver Premium…) sin
  // ningún identificador. Quien activa "No rastrear" o el Control Global de Privacidad no envía métricas.
  var VERSION_APP = "2026.11.10";   // actualízala al publicar una versión
  function plataformaApp() {
    try { if (APP_ANDROID.activa) return "android-app"; } catch (e) {}
    var ua = navigator.userAgent;
    return /android/i.test(ua) ? "android" : /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "iphone" : "pc";
  }
  function enviarSalud(ruta, obj) {
    try {
      var datos = JSON.stringify(obj);
      if (navigator.sendBeacon && navigator.sendBeacon(ruta, new Blob([datos], { type: "application/json" }))) return;
      fetch(ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: datos, keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  var erroresEnviados = {}, nErrores = 0;
  function reportarError(m, pila, donde) {
    try {
      m = String(m || "").replace(/^Uncaught\s+/, "").slice(0, 300);
      if (!WEB || !m || nErrores >= 5 || erroresEnviados[m] || /ResizeObserver loop|^Script error\.?$/.test(m)) return;
      erroresEnviados[m] = 1; nErrores++;
      enviarSalud("/api/errores", { m: m, s: String(pila || "").split("\n").slice(0, 4).join("\n"), d: donde || "", v: VERSION_APP, p: plataformaApp(),
        t: ((/^#([a-z]+)/.exec(location.hash || "") || [])[1] || "inicio").slice(0, 20) });
    } catch (e) {}
  }
  window.addEventListener("error", function (e) {
    if (e.filename && e.filename.indexOf(location.origin) !== 0) return;   // extensiones del navegador y scripts ajenos
    reportarError(e.message, e.error && e.error.stack, (e.filename || "").replace(location.origin, "") + ":" + e.lineno + ":" + e.colno);
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason || {};
    if (r && (r.name === "AbortError" || /Failed to fetch|NetworkError|Load failed/.test(String(r.message || r)))) return;   // sin conexión no es un error de la app
    reportarError("Promesa: " + (r.message || String(r)), r.stack, "");
  });
  var MET_KEY = "fintelligente-metricas";
  function noRastrear() { return navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" || window.doNotTrack === "1"; }
  // cada: "una" (una vez en este dispositivo) o "dia" (máximo "max" veces al día).
  function metrica(e, cada, max) {
    try {
      if (!WEB || noRastrear()) return;
      var hoy = keyOf(new Date()) + "-" + ("0" + new Date().getDate()).slice(-2), r = JSON.parse(localStorage.getItem(MET_KEY) || "{}");
      r.u = r.u || {}; if (r.d !== hoy) { r.d = hoy; r.c = {}; }
      if (cada === "una") { if (r.u[e]) return; r.u[e] = hoy; }
      else { if ((r.c[e] || 0) >= (max || 1)) return; r.c[e] = (r.c[e] || 0) + 1; }
      localStorage.setItem(MET_KEY, JSON.stringify(r));
      enviarSalud("/api/metrica", { e: e, p: plataformaApp() });
    } catch (x) {}
  }

