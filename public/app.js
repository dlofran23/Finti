(function () {
  "use strict";

  // ===================== Utilidades =====================
  var $ = function (id) { return document.getElementById(id); };
  // Edición gratis (pública, se guarda en el navegador) o completa (por invitación, se guarda en la cuenta)
  var FREE = document.documentElement.getAttribute("data-edition") === "free";
  var WEB = document.documentElement.getAttribute("data-edition") === "web";   // sitio propio con pagos de Wompi
  var LIC_KEY = "presupuesto-licencia", PAGO_KEY = "presupuesto-pago-pendiente";
  var licencia = null;
  if (WEB) { try { var lj = JSON.parse(localStorage.getItem(LIC_KEY) || "null"); if (lj && /^PRE-[A-Z2-9]{12}$/.test(lj.ref) && lj.token) licencia = lj; } catch (e) {} }
  var fmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  var pct = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 1 });
  var compact = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 });
  function pctf(x) { return pct.format(x).replace(/\s?%/, "\u00a0%"); }
  function money(n) { return fmt.format(Math.round(n || 0)); }
  function signed(n) { n = Math.round(n || 0); return (n > 0 ? "+" : n < 0 ? "−" : "") + fmt.format(Math.abs(n)); }
  function num(v) { var x = parseFloat(String(v == null ? "" : v).replace(/[^\d.-]/g, "")); return isFinite(x) ? x : 0; }
  function rid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

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

  // ===================== Meses =====================
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  // Abreviaturas de la RAE, con su punto.
  var MESES_C = ["en.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ag.", "sept.", "oct.", "nov.", "dic."];
  function keyOf(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2); }
  function nowKey() { return keyOf(new Date()); }
  function validKey(k) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(k || ""); }
  function parseKey(k) { return { y: +k.slice(0, 4), m: +k.slice(5, 7) }; }
  function addMonths(k, n) { var p = parseKey(k); return keyOf(new Date(p.y, p.m - 1 + n, 1)); }
  function monthsBetween(a, b) { var p = parseKey(a), q = parseKey(b); return (q.y - p.y) * 12 + (q.m - p.m); }
  function monthLabel(k) { var p = parseKey(k); var s = MESES[p.m - 1] + " de " + p.y; return s.charAt(0).toUpperCase() + s.slice(1); }
  function monthShort(k) { var p = parseKey(k); return MESES_C[p.m - 1] + " " + String(p.y).slice(2); }
  function parsePeriodo(txt) {
    var m = /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\D*(\d{4})/i.exec(txt || "");
    if (!m) return null;
    var name = m[1].toLowerCase() === "setiembre" ? "septiembre" : m[1].toLowerCase();
    return m[2] + "-" + ("0" + (MESES.indexOf(name) + 1)).slice(-2);
  }

  // ===================== Temas =====================
  var THEMES = [
    // Identidad Finti (17 de noviembre de 2026): azul eléctrico que actúa y moneda amarilla que crece; el resto, blanco y negro.
    { id: "finti", name: "Finti", premium: false,
      light: { bg: "#f3f4f7", surface: "#ffffff", ink: "#0b0c10", muted: "#565b67", line: "#e3e5eb", accent: "#2e5bff", soft: "#e8edff", fuerte: "#2e5bff" },
      dark:  { bg: "#09090b", surface: "#141417", ink: "#f6f7f9", muted: "#9c9fab", line: "#24242b", accent: "#7d97ff", soft: "#18203f", fuerte: "#2e5bff" } },
    { id: "vibrante", name: "Vibrante", premium: false,
      light: { bg: "#f6f4fa", surface: "#ffffff", ink: "#14121f", muted: "#5b576b", line: "#e4e0ee", accent: "#6a4af0", soft: "#eeeaff" },
      dark:  { bg: "#0f0f14", surface: "#1d1b27", ink: "#f4f2ff", muted: "#a9a6bd", line: "#2a2735", accent: "#a08cff", soft: "#2a2445" } },
    { id: "electrico", name: "Eléctrico", premium: false,
      light: { bg: "#f3f5ff", surface: "#ffffff", ink: "#10142b", muted: "#565c78", line: "#dfe3f5", accent: "#3b5bff", soft: "#e6ebff" },
      dark:  { bg: "#0b0e1c", surface: "#161a2e", ink: "#eef0ff", muted: "#a2a8c4", line: "#262b45", accent: "#8197ff", soft: "#1f2648" } },
    { id: "jade", name: "Jade", premium: false,
      light: { bg: "#f1f7f5", surface: "#ffffff", ink: "#0f211c", muted: "#52665f", line: "#d9e6e1", accent: "#007a61", soft: "#ddf2ea" },
      dark:  { bg: "#0b1513", surface: "#14211d", ink: "#e6f4ef", muted: "#95ada5", line: "#233630", accent: "#2ed8a9", soft: "#133a30" } },
    { id: "lima", name: "Lima nocturna", premium: false,
      light: { bg: "#f5f7ef", surface: "#ffffff", ink: "#171c0e", muted: "#5b6450", line: "#e2e6d6", accent: "#4d7c0f", soft: "#eaf3d6" },
      dark:  { bg: "#0e100b", surface: "#191c14", ink: "#f1f5e6", muted: "#a8af98", line: "#2b3022", accent: "#c6f432", soft: "#2c3514" } },
    { id: "cobalto", name: "Cobalto", premium: false,
      light: { bg: "#f2f4f9", surface: "#ffffff", ink: "#141b2d", muted: "#5b6478", line: "#dde2ec", accent: "#2f4bd8", soft: "#e7ebfc" },
      dark:  { bg: "#0f1320", surface: "#181e2e", ink: "#e9edf6", muted: "#9ba5ba", line: "#2a3247", accent: "#8ea2ff", soft: "#222b4a" } },
    { id: "bosque", name: "Bosque", premium: false,
      light: { bg: "#f0f5f2", surface: "#ffffff", ink: "#12241b", muted: "#55675d", line: "#d8e3dc", accent: "#17795a", soft: "#dff0e7" },
      dark:  { bg: "#0d1613", surface: "#15211c", ink: "#e5f0ea", muted: "#92a79b", line: "#25362e", accent: "#5ccfa3", soft: "#183128" } },
    { id: "grafito", name: "Grafito", premium: false,
      light: { bg: "#f4f4f2", surface: "#ffffff", ink: "#1c1c1a", muted: "#63635e", line: "#e1e0dc", accent: "#cf4f1c", soft: "#fbe8de" },
      dark:  { bg: "#121211", surface: "#1c1c1a", ink: "#ededea", muted: "#a3a29c", line: "#30302d", accent: "#ff8b5c", soft: "#3a2419" } },
    { id: "cafe", name: "Café de origen", premium: true,
      light: { bg: "#f6f1ea", surface: "#fffdf9", ink: "#2a1d14", muted: "#74635a", line: "#e6dbcd", accent: "#8a4b22", soft: "#f3e3d3" },
      dark:  { bg: "#17110c", surface: "#211912", ink: "#f1e7dc", muted: "#b3a08f", line: "#3a2c21", accent: "#e3a26b", soft: "#3a2818" } },
    { id: "caribe", name: "Caribe", premium: true,
      light: { bg: "#edf7f8", surface: "#ffffff", ink: "#0f2a33", muted: "#4e6d76", line: "#d2e6ea", accent: "#08879b", soft: "#d9f0f3" },
      dark:  { bg: "#0a191e", surface: "#11252c", ink: "#e2f3f6", muted: "#8eb0b8", line: "#203f49", accent: "#4fd3e6", soft: "#12363f" } },
    { id: "orquidea", name: "Orquídea", premium: true,
      light: { bg: "#f7f2f8", surface: "#ffffff", ink: "#2a1630", muted: "#6e5974", line: "#e8dcec", accent: "#8a3aa6", soft: "#f1e2f6" },
      dark:  { bg: "#150e18", surface: "#201625", ink: "#f1e6f4", muted: "#b19bb8", line: "#3a2a41", accent: "#d59ef1", soft: "#382345" } },
    { id: "medianoche", name: "Medianoche y oro", premium: true,
      light: { bg: "#f5f3ee", surface: "#ffffff", ink: "#141a2c", muted: "#5d6274", line: "#e4e0d6", accent: "#9c7412", soft: "#f5ebd0" },
      dark:  { bg: "#0a0e1b", surface: "#131a2c", ink: "#ece7d9", muted: "#a8a594", line: "#262d44", accent: "#e6b84a", soft: "#2e2a1a" } }
  ];
  var THEME_BY_ID = {};
  THEMES.forEach(function (t) { THEME_BY_ID[t.id] = t; });
  var SEM = {
    light: { good: "#1d7a4e", goodSoft: "#e1f2e9", warn: "#a0640a", warnSoft: "#fbefd9", bad: "#b8322a", badSoft: "#fbe3e1" },
    dark:  { good: "#5fcf98", goodSoft: "#17302a", warn: "#f0b45a", warnSoft: "#362b17", bad: "#ff8a80", badSoft: "#3a1f1f" }
  };

  // ===================== Categorías =====================
  var BASE_CATS = [
    { id: "vivienda", name: "Vivienda", group: "nec" },
    { id: "servicios", name: "Servicios y conectividad", group: "nec" },
    { id: "alimentacion", name: "Alimentación", group: "nec" },
    { id: "transporte", name: "Transporte", group: "nec" },
    { id: "salud", name: "Salud", group: "nec" },
    { id: "educacion", name: "Educación", group: "nec" },
    { id: "deudas", name: "Deudas y créditos", group: "nec" },
    { id: "ocio", name: "Salidas y ocio", group: "gus" },
    { id: "compras", name: "Compras personales", group: "gus" },
    { id: "suscripciones", name: "Suscripciones", group: "gus" },
    { id: "otros", name: "Otros", group: "gus" },
    { id: "ahorro", name: "Ahorro e inversión", group: "aho" }
  ];
  var GROUP_NAME = { nec: "Necesidad", gus: "Gusto", aho: "Ahorro" };
  function cats() { return BASE_CATS.slice(0, 11).concat(hasPremium() ? state.categorias : [], [BASE_CATS[11]]); }
  function catById(id) {
    for (var i = 0; i < BASE_CATS.length; i++) if (BASE_CATS[i].id === id) return BASE_CATS[i];
    for (var j = 0; j < state.categorias.length; j++) if (state.categorias[j].id === id) return state.categorias[j];
    return null;
  }

  // ===================== Estado y migración =====================
  var TEMPLATE = document.getElementById("budget-data").textContent;
  var LOCAL_PREFIX = WEB ? "presupuesto-web-" : FREE ? "presupuesto-gratis-" : "presupuesto-v2-";

  function validState(s) {
    return !!s && typeof s === "object" && ((s.meses && typeof s.meses === "object") || (Array.isArray(s.ingresos) && Array.isArray(s.gastos)));
  }
  function cleanMonth(m, catIds) {
    var out = { ingresos: [], gastos: [], notas: String((m && m.notas) || "").slice(0, 4000) };
    (Array.isArray(m && m.ingresos) ? m.ingresos : []).forEach(function (r) {
      if (r && r.id) out.ingresos.push({ id: String(r.id).slice(0, 40), concepto: String(r.concepto || "").slice(0, 80), plan: num(r.plan), real: num(r.real) });
    });
    (Array.isArray(m && m.gastos) ? m.gastos : []).forEach(function (r) {
      if (r && r.id) out.gastos.push({ id: String(r.id).slice(0, 40), concepto: String(r.concepto || "").slice(0, 80), cat: catIds[r.cat] ? r.cat : "otros",
        dia: clamp(Math.round(num(r.dia)), 0, 31), plan: num(r.plan), real: num(r.real) });
    });
    return out;
  }
  function fechas(a) { return (Array.isArray(a) ? a : []).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); }).slice(-400); }
  function sanitize(s) {
    var pr = s.prefs || {};
    var out = {
      v: 3,
      titulo: String(s.titulo || "Mi presupuesto").slice(0, 80),
      ejemplo: !!s.ejemplo,
      prefs: {
        // idv 3 = identidad Finti azul. Quien seguía en un tema por defecto anterior (Cobalto o Vibrante) pasa una sola vez a Finti.
        tema: (pr.idv || 0) < 3 && (!pr.tema || pr.tema === "cobalto" || pr.tema === "vibrante") ? "finti" : THEME_BY_ID[pr.tema] || pr.tema === "personal" ? pr.tema : "finti",
        idv: 3,
        modo: ["auto", "claro", "oscuro"].indexOf(pr.modo) > -1 ? pr.modo : "oscuro",
        sonidos: pr.sonidos !== false,
        letraGrande: pr.letraGrande === true,
        temporada: pr.temporada !== false,
        cartaVista: /^\d{4}-\d{2}-\d{2}$/.test(pr.cartaVista || "") ? pr.cartaVista : "",
        // Ahorro por redondeo: cada gasto anotado se redondea hacia arriba y la diferencia va a la alcancía
        redondeo: pr.redondeo === true,
        redondeoA: [1000, 5000, 10000].indexOf(pr.redondeoA) > -1 ? pr.redondeoA : 1000,
        // Días del mes en que le pagan a la persona (quincena); [0] = no quiere la cuenta regresiva
        diasPago: (Array.isArray(pr.diasPago) ? pr.diasPago : []).map(function (d) { return Math.round(num(d)); }).filter(function (d) { return d >= 0 && d <= 31; }).slice(0, 3),
        // Colores propios por categoría (paleta de la persona); vacío = los de la identidad
        catColores: (function (o) { var out = {}; o = o && typeof o === "object" ? o : {}; Object.keys(o).slice(0, 60).forEach(function (k) { if (k.length <= 40 && /^#[0-9a-f]{6}$/i.test(o[k] || "")) out[k] = o[k].toLowerCase(); }); return out; })(pr.catColores),
        acento: /^#[0-9a-f]{6}$/i.test(pr.acento || "") ? pr.acento : "#2e5bff",
        premium: !!pr.premium,
        codigo: typeof pr.codigo === "string" ? pr.codigo.slice(0, 80) : "",
        perfil: ["personal", "estudiante", "pareja", "familia", "independiente", "negocio"].indexOf(pr.perfil) > -1 ? pr.perfil : "personal",
        // Lo que la persona dijo que quería lograr en el inicio guiado
        enfoque: ["viaje", "fondo", "deudas", "compra", "orden"].indexOf(pr.enfoque) > -1 ? pr.enfoque : "orden",
        metasInicio: (Array.isArray(pr.metasInicio) ? pr.metasInicio : []).filter(function (m, k, l) { return ["viaje", "fondo", "deudas", "compra", "orden"].indexOf(m) > -1 && l.indexOf(m) === k; })
      },
      categorias: [], metas: [], deudas: [],
      deudaExtra: Math.max(0, num(s.deudaExtra)),
      deudaMetodo: s.deudaMetodo === "bola" ? "bola" : "avalancha",
      meses: {}, mes: "",
      actividad: fechas(s.actividad),
      registros: fechas(s.registros),
      sinGasto: fechas(s.sinGasto),
      logros: (Array.isArray(s.logros) ? s.logros : []).filter(function (x) { return typeof x === "string" && /^[a-z0-9]{1,20}$/.test(x); }).slice(0, 40),
      cuentas: [], porPagar: [], pendientes: [],
      reglas: {}, reglasCuenta: {},
      // Lo que otras personas te deben (gastos compartidos y préstamos), anotado desde Cuéntame un gasto.
      meDeben: (Array.isArray(s.meDeben) ? s.meDeben : []).filter(function (x) { return x && num(x.m) > 0; }).slice(-200).map(function (x) {
        return { id: String(x.id || rid("q")).slice(0, 40), quien: String(x.quien || "Otra persona").slice(0, 40), m: Math.round(num(x.m)), c: String(x.c || "").slice(0, 60), f: /^\d{4}-\d{2}-\d{2}$/.test(x.f || "") ? x.f : "" };
      }),
      // Preguntas pendientes de Cuéntame un gasto (precios que faltaron), para hacerlas después
      noEntendi: (Array.isArray(s.noEntendi) ? s.noEntendi : []).filter(function (x) { return x && typeof x.t === "string" && x.t.trim(); }).slice(-40).map(function (x) {
        return { t: x.t.slice(0, 300), de: x.de === "pregunta" ? "pregunta" : "charla", f: /^\d{4}-\d{2}-\d{2}$/.test(x.f || "") ? x.f : "" }; }),
      dudas: (Array.isArray(s.dudas) ? s.dudas : []).filter(function (d) { return d && /^(precio|nuevo)$/.test(d.k) && num(d.cr) > 0; }).slice(-20).map(function (d) {
        return { id: String(d.id || rid("d")).slice(0, 30), k: d.k, mov: String(d.mov || "").slice(0, 20), n: String(d.n || "").slice(0, 40), q: String(d.q || "").slice(0, 12), c: String(d.c || "").slice(0, 80),
          cat: String(d.cat || "").slice(0, 40), lugar: String(d.lugar || "").slice(0, 40), f: /^\d{4}-\d{2}-\d{2}$/.test(d.f || "") ? d.f : "", cuenta: String(d.cuenta || "").slice(0, 30), cr: num(d.cr),
          det: (Array.isArray(d.det) ? d.det : []).slice(0, 25).map(function (x) { return { n: String(x && x.n || "").slice(0, 40), q: String(x && x.q || "").slice(0, 12), m: 0 }; }) };
      }),
      propios: (Array.isArray(s.propios) ? s.propios : []).filter(function (x) { return typeof x === "string" && x.length > 1 && x.length <= 80; }).slice(-100),
      importados: (Array.isArray(s.importados) ? s.importados : []).filter(function (x) { return typeof x === "string" && x.length < 120; }).slice(-3000),
      reto: { base: 0, inicio: "", hechas: [] },
      alcancia: (function (a) { var out = {}; a = a && typeof a === "object" ? a : {}; Object.keys(a).filter(function (k) { return /^\d{4}-\d{2}$/.test(k); }).sort().slice(-24).forEach(function (k) {
        out[k] = { j: Math.max(0, Math.round(num(a[k] && a[k].j))), p: Math.max(0, Math.round(num(a[k] && a[k].p))) }; }); return out; })(s.alcancia),
      invita: (function (i) { i = i && typeof i === "object" ? i : {}; var ok = /^AMIGO-[A-HJ-NP-Z2-9]{6}$/.test(i.codigo || "") && /^[\w-]{20,80}$/.test(i.llave || "");
        return ok ? { codigo: i.codigo, llave: i.llave } : { codigo: "", llave: "" }; })(s.invita),
      // Cuentas del negocio, aparte de las personales.
      negocio: (function (n) { n = n && typeof n === "object" ? n : {};
        return { sueldo: Math.max(0, Math.round(num(n.sueldo))), movs: (Array.isArray(n.movs) ? n.movs : []).filter(function (x) { return x && /^\d{4}-\d{2}-\d{2}$/.test(x.f) && num(x.m) > 0; }).slice(-3000).map(function (x) {
          return { id: String(x.id || "").slice(0, 24), f: x.f, t: x.t === "g" ? "g" : "v", cat: x.t === "g" ? String(x.cat || "otros").slice(0, 20) : "", c: String(x.c || "").slice(0, 80), m: Math.round(num(x.m)) }; }) }; })(s.negocio),
      // Historial de movimientos con fecha (solo en el dispositivo y en la copia cifrada): el asesor aprende de él.
      movs: (Array.isArray(s.movs) ? s.movs : []).filter(function (x) { return x && /^\d{4}-\d{2}-\d{2}$/.test(x.f) && num(x.m) > 0; }).slice(-1500).map(function (x) {
        var mv = { id: String(x.id || "").slice(0, 20), f: x.f, h: x.h >= 0 && x.h < 24 ? Math.floor(x.h) : -1, t: x.t === "i" ? "i" : "g", cat: String(x.cat || "").slice(0, 40), c: String(x.c || "").slice(0, 80), m: Math.round(num(x.m)), com: String(x.com || "").slice(0, 60), rd: Math.max(0, Math.round(num(x.rd))) };
        if (x.o === "ch" || x.o === "aviso") mv.o = x.o;
        if (x.cu) mv.cu = String(x.cu).slice(0, 30);
        if (x.banco) mv.banco = String(x.banco).slice(0, 30);
        if (Array.isArray(x.det) && x.det.length) mv.det = x.det.slice(0, 25).map(function (d) { return { n: String(d && d.n || "").slice(0, 40), q: String(d && d.q || "").slice(0, 12), m: Math.max(0, Math.round(num(d && d.m))) }; });
        return mv;
      }),
      asesor: (function (a) { a = a && typeof a === "object" ? a : {}; var l = function (v) { return (Array.isArray(v) ? v : []).filter(function (x) { return typeof x === "string" && x.length <= 40; }).slice(-80); };
        return { si: l(a.si), no: l(a.no), aprendido: /^\d{4}-\d{2}-\d{2}$/.test(a.aprendido || "") ? a.aprendido : "" }; })(s.asesor),
      avisos: { registro: !(s.avisos && s.avisos.registro === false), pagos: !(s.avisos && s.avisos.pagos === false) }
    };
    var TIPO_IDS = { banco: 1, nequi: 1, daviplata: 1, efectivo: 1, tarjeta: 1, otra: 1 };
    (Array.isArray(s.cuentas) ? s.cuentas : []).slice(0, 30).forEach(function (c) {
      if (c && c.id) out.cuentas.push({ id: String(c.id).slice(0, 40), nombre: String(c.nombre || "").slice(0, 40), tipo: TIPO_IDS[c.tipo] ? c.tipo : "otra",
        saldo: Math.round(num(c.saldo)), cupo: Math.max(0, Math.round(num(c.cupo))), ini: c.ini === undefined ? Math.round(num(c.saldo)) !== 0 : !!c.ini });
      if (c.banco && /^[a-z0-9]{1,20}$/.test(c.banco)) out.cuentas[out.cuentas.length - 1].banco = c.banco;
    });
    ["reglas", "reglasCuenta"].forEach(function (k) {
      var o = s[k] && typeof s[k] === "object" ? s[k] : {};
      Object.keys(o).slice(-400).forEach(function (x) { if (typeof o[x] === "string" && x.length <= 80) out[k][x.slice(0, 80)] = o[x].slice(0, 40); });
    });
    (Array.isArray(s.pendientes) ? s.pendientes : []).slice(-200).forEach(function (p) {
      if (!p || !p.id) return;
      var txt = function (v, n) { return String(v == null ? "" : v).slice(0, n); };
      var q = { id: txt(p.id, 40), origen: txt(p.origen, 12), recibido: txt(p.recibido, 30), banco: txt(p.banco, 30), tipo: ["gasto", "ingreso", "retiro", "pagoTarjeta", "propio"].indexOf(p.tipo) > -1 ? p.tipo : "gasto",
        monto: Math.max(0, Math.round(num(p.monto))), comercio: txt(p.comercio, 60), fecha: /^\d{4}-\d{2}-\d{2}$/.test(p.fecha || "") ? p.fecha : "", hora: txt(p.hora, 5), medio: txt(p.medio, 30), u4: txt(p.u4, 4),
        nit: txt(p.nit, 20), numero: txt(p.numero, 30), items: (Array.isArray(p.items) ? p.items : []).slice(0, 4).map(function (x) { return txt(x, 60); }), confianza: txt(p.confianza, 6),
        pista: txt(p.pista || (p.texto ? ["nequi", "daviplata", "bolsillo", "colchon", "meta"].filter(function (k) { return String(p.texto).toLowerCase().indexOf(k) > -1; }).join(" ") : ""), 120), cat: txt(p.cat, 40), cuenta: txt(p.cuenta, 40), pago: txt(p.pago, 40), dup: txt(p.dup, 40),
        destino: txt(p.destino, 40), par: txt(p.par, 40), parDe: txt(p.parDe, 40), tipoOriginal: ["gasto", "ingreso"].indexOf(p.tipoOriginal) > -1 ? p.tipoOriginal : "",
        contado: txt(p.contado, 20), contadoNo: !!p.contadoNo };
      if (p.verificacion) q.verificacion = { codigo: txt(p.verificacion.codigo, 12) };
      out.pendientes.push(q);
    });
    var rt = s.reto || {};
    if (/^\d{4}-\d{2}-\d{2}$/.test(rt.inicio || "")) {
      var seen52 = {};
      out.reto = { base: clamp(Math.round(num(rt.base)) || 5000, 100, 1000000), inicio: rt.inicio,
        hechas: (Array.isArray(rt.hechas) ? rt.hechas : []).map(function (n) { return Math.round(num(n)); }).filter(function (n) { if (n < 1 || n > 52 || seen52[n]) return false; seen52[n] = 1; return true; }) };
    }
    var catIds = {};
    BASE_CATS.forEach(function (c) { catIds[c.id] = true; });
    (Array.isArray(s.categorias) ? s.categorias : []).slice(0, 40).forEach(function (c) {
      if (c && c.id && c.name && !catIds[c.id]) {
        out.categorias.push({ id: String(c.id).slice(0, 40), name: String(c.name).slice(0, 40), group: GROUP_NAME[c.group] ? c.group : "gus", ic: /^[a-z]{3,14}$/.test(c.ic || "") ? c.ic : "" });
        catIds[c.id] = true;
      }
    });
    (Array.isArray(s.porPagar) ? s.porPagar : []).slice(0, 60).forEach(function (b) {
      if (!b || !b.id) return;
      var pagos = {};
      if (b.pagos && typeof b.pagos === "object") Object.keys(b.pagos).filter(function (k) { return /^(\d{4}(-\d{2})?|u)$/.test(k) && /^\d{4}-\d{2}-\d{2}$/.test(b.pagos[k]); }).sort().slice(-36).forEach(function (k) { pagos[k] = b.pagos[k]; });
      out.porPagar.push({ id: String(b.id).slice(0, 40), nombre: String(b.nombre || "").slice(0, 60), monto: Math.max(0, Math.round(num(b.monto))),
        f: ["mensual", "anual", "unica"].indexOf(b.f) > -1 ? b.f : "mensual", dia: clamp(Math.round(num(b.dia)) || 1, 1, 31),
        fecha: /^\d{4}-\d{2}-\d{2}$/.test(b.fecha || "") ? b.fecha : "", cat: catIds[b.cat] ? b.cat : "otros", cuenta: typeof b.cuenta === "string" ? b.cuenta.slice(0, 40) : "",
        aviso: clamp(Math.round(num(b.aviso)), 0, 15), creado: /^\d{4}-\d{2}-\d{2}$/.test(b.creado || "") ? b.creado : hoyStr(), pagos: pagos });
    });
    (Array.isArray(s.metas) ? s.metas : []).slice(0, 30).forEach(function (g) {
      if (g && g.id) out.metas.push({ id: String(g.id).slice(0, 40), nombre: String(g.nombre || "").slice(0, 60), objetivo: Math.max(0, num(g.objetivo)), ahorrado: Math.max(0, num(g.ahorrado)), fecha: validKey(g.fecha) ? g.fecha : "" });
    });
    (Array.isArray(s.deudas) ? s.deudas : []).slice(0, 30).forEach(function (d) {
      if (d && d.id) out.deudas.push({ id: String(d.id).slice(0, 40), nombre: String(d.nombre || "").slice(0, 60), saldo: Math.max(0, num(d.saldo)), tasa: clamp(num(d.tasa), 0, 400), cuota: Math.max(0, num(d.cuota)) });
    });
    if (s.meses && typeof s.meses === "object") {
      Object.keys(s.meses).forEach(function (k) { if (validKey(k)) out.meses[k] = cleanMonth(s.meses[k], catIds); });
    } else if (Array.isArray(s.ingresos)) {
      out.meses[parsePeriodo(s.periodo) || nowKey()] = cleanMonth(s, catIds);   // formato anterior: un solo mes
    }
    var keys = Object.keys(out.meses).sort();
    if (!keys.length) { out.meses[nowKey()] = { ingresos: [], gastos: [] }; keys = [nowKey()]; }
    out.mes = out.meses[s.mes] ? s.mes : keys[keys.length - 1];
    return out;
  }
  function freshTemplate() {
    var t; try { t = JSON.parse(TEMPLATE); } catch (e) { t = { ingresos: [], gastos: [] }; }
    return sanitize(t);
  }

  var state = freshTemplate();
  function cur() { return state.meses[state.mes]; }
  function monthKeys() { return Object.keys(state.meses).sort(); }

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

  // ===================== Premium =====================
  function hasPremium() { if (WEB) return !!licencia; return !FREE && (isOwnerFlag || !!state.prefs.premium); }
  function lockCard(text) {
    return '<div class="locked"><p>' + text + '</p><button class="btn premium-btn" type="button" data-open-premium><span class="star">★</span> Desbloquear con Premium</button></div>';
  }

  // ===================== Tema =====================
  var root = document.documentElement, previewTema = null, previewAcento = null;
  function hostIsDark() {
    var t = root.getAttribute("data-theme");
    if (t === "dark") return true;
    if (t === "light") return false;
    try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { return false; }
  }
  function resolvedDark() { var m = state.prefs.modo; return m === "oscuro" ? true : m === "claro" ? false : hostIsDark(); }
  function luminance(hex) {
    var c = [1, 3, 5].map(function (i) { var v = parseInt(hex.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function mezclaNegro(hex, f) { return "#" + [1, 3, 5].map(function (i) { var v = Math.round(parseInt(hex.substr(i, 2), 16) * (1 - f)); return ("0" + v.toString(16)).slice(-2); }).join(""); }
  function fuerteDe(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || "")) hex = /^#[0-9a-f]{6}$/i.test(state.prefs.acento || "") ? state.prefs.acento : "#2e5bff";
    var c = hex;
    for (var k = 0; k < 14 && 1.05 / (luminance(c) + 0.05) < 4.6; k++) c = mezclaNegro(hex, (k + 1) * 0.06);
    return c;
  }
  function themeColors(id, dark, acento) {
    var base, out = {}, k;
    if (id === "personal") {
      base = THEME_BY_ID.finti[dark ? "dark" : "light"];
      var a = acento || state.prefs.acento;
      for (k in base) out[k] = base[k];
      out.accent = dark ? "color-mix(in srgb, " + a + " 70%, #ffffff)" : a;
      out.soft = "color-mix(in srgb, " + a + (dark ? " 22%, " : " 12%, ") + base.surface + ")";
      out.bg = "color-mix(in srgb, " + a + (dark ? " 6%, " : " 4%, ") + base.bg + ")";
      out.line = "color-mix(in srgb, " + a + " 10%, " + base.line + ")";
      out.onAccent = dark ? base.bg : (luminance(a) > 0.5 ? "#111111" : "#ffffff");
      return out;
    }
    base = (THEME_BY_ID[id] || THEME_BY_ID.finti)[dark ? "dark" : "light"];
    for (k in base) out[k] = base[k];
    out.onAccent = dark ? base.bg : "#ffffff";
    return out;
  }
  function activeTema() {
    if (previewTema) return previewTema;
    var t = state.prefs.tema;
    if (t === "personal" || (THEME_BY_ID[t] && THEME_BY_ID[t].premium)) return hasPremium() ? t : "finti";
    return THEME_BY_ID[t] ? t : "finti";
  }
  function applyTheme() {
    var dark = resolvedDark();
    var c = themeColors(activeTema(), dark, previewAcento);
    var sem = SEM[dark ? "dark" : "light"];
    var map = { "--bg": c.bg, "--surface": c.surface, "--ink": c.ink, "--muted": c.muted, "--line": c.line,
      "--accent": c.accent, "--accent-soft": c.soft, "--on-accent": c.onAccent,
      "--good": sem.good, "--good-soft": sem.goodSoft, "--warn": sem.warn, "--warn-soft": sem.warnSoft, "--bad": sem.bad, "--bad-soft": sem.badSoft };
    var fu = fuerteDe(c.fuerte || c.accent);
    map["--fuerte"] = fu; map["--fuerte-2"] = mezclaNegro(fu, 0.38); map["--fuerte-luz"] = "color-mix(in srgb, " + fu + " 72%, #ffffff)";
    map["--sombra-acento"] = "color-mix(in srgb, " + fu + " 55%, transparent)";
    for (var k in map) root.style.setProperty(k, map[k]);
    root.style.colorScheme = dark ? "dark" : "light";
    if (dark) root.setAttribute("data-modo-oscuro", ""); else root.removeAttribute("data-modo-oscuro");
    // Barra del sistema (estado del celular) del mismo color del fondo
    temaBg = c.bg; colorSistema();
  }
  var temaBg = "#09090b";
  // Barra del sistema: del azul de la banda mientras se ve la banda de Inicio; si no, del color del fondo
  function colorSistema() {
    var mt = document.querySelector('meta[name="theme-color"]'); if (!mt) return;
    var b = $("banda"), sobre = document.body.classList.contains("sobre-banda");
    mt.setAttribute("content", sobre ? (b && b.classList.contains("dia") ? "#4570ff" : "#2347d4") : temaBg);
  }
  try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { applyTheme(); if (!$("dlg-colores").hidden) renderThemeGrid(); }); } catch (e) {}
  try { new MutationObserver(function () { applyTheme(); }).observe(root, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) {}

  // ===================== Diálogos =====================
  var lastFocus = null, onCloseHooks = {};
  function openDlg(id, focusSel) {
    lastFocus = document.activeElement;
    var d = $(id); d.hidden = false;
    var f = focusSel ? d.querySelector(focusSel) : null;
    (f || d.querySelector("[data-close]")).focus();
  }
  function closeDlg(id) {
    var d = $(id); if (d.hidden) return;
    d.hidden = true;
    if (onCloseHooks[id]) onCloseHooks[id]();
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }
  ["dlg-colores", "dlg-premium", "dlg-mes", "dlg-cats", "dlg-add", "dlg-pagar", "dlg-avisos", "dlg-bandeja", "dlg-fuentes", "dlg-cuenta", "dlg-perfil", "dlg-inicio", "dlg-extracto", "dlg-preguntas", "dlg-guias", "dlg-privado", "dlg-indep", "dlg-negocio", "dlg-invita", "dlg-charla", "dlg-aprendidas", "dlg-cat", "dlg-ysi", "dlg-recibo", "dlg-reto", "dlg-buscar", "dlg-donde", "dlg-deuda"].forEach(function (id) {
    var d = $(id);
    d.addEventListener("click", function (e) { if (e.target === d || e.target.closest("[data-close]")) closeDlg(id); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    ["dlg-buscar", "dlg-reto", "dlg-recibo", "dlg-ysi", "dlg-cat", "dlg-aprendidas", "dlg-charla", "dlg-invita", "dlg-negocio", "dlg-indep", "dlg-privado", "dlg-guias", "dlg-preguntas", "dlg-extracto", "dlg-inicio", "dlg-perfil", "dlg-cuenta", "dlg-fuentes", "dlg-pagar", "dlg-avisos", "dlg-bandeja", "dlg-add", "dlg-cats", "dlg-mes", "dlg-premium", "dlg-colores"].some(function (id) { if (!$(id).hidden) { closeDlg(id); return true; } return false; });
  });
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-open-premium]")) {
      ["dlg-colores", "dlg-mes", "dlg-cats"].forEach(function (id) { if (!$(id).hidden) closeDlg(id); });
      openPremium();
    }
  });

  // ===================== Tablas de ingresos y gastos =====================
  function catOptions(sel) {
    var list = cats();
    if (!list.some(function (c) { return c.id === sel; })) { var c0 = catById(sel); if (c0) list = list.concat([c0]); }
    return list.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === sel ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("");
  }
  function diffHtml(d) { var cls = d > 0 ? "pos" : d < 0 ? "neg" : "zero"; return '<span class="' + cls + '">' + signed(d) + "</span>"; }
  // Diferencia y, si hay plan, una barra con lo que va de lo planeado (en el color de la categoría).
  function diffUso(r, gasto) {
    var h = diffHtml(gasto ? r.plan - r.real : r.real - r.plan);
    if (!(r.plan > 0)) return h;
    var x = r.real / r.plan;
    return h + '<span class="uso" aria-hidden="true"><i class="' + (gasto && x > 1 ? "pasado" : "") + '" style="width:' + Math.min(100, x * 100).toFixed(1) + '%"></i></span>';
  }
  function moneyInput(id, f, v, label) {
    // Texto con puntos de miles (3.200.000) para que se lea igual que los totales; se escribe con o sin puntos.
    return '<input class="money" id="' + id + '" data-f="' + f + '" type="text" inputmode="numeric" autocomplete="off" value="' + miles(v) + '" aria-label="' + label + '">';
  }
  function miles(v) { v = Math.max(0, Math.round(+v || 0)); return v ? new Intl.NumberFormat("es-CO").format(v) : "0";
  }
  function delBtn(name) { return '<button class="icon-btn" type="button" data-del="1" aria-label="Eliminar ' + esc(name) + '" title="Eliminar">×</button>'; }

  function renderIngresos() {
    $("tb-ing").innerHTML = cur().ingresos.map(function (r) {
      return '<tr data-id="' + esc(r.id) + '" style="--c:#2fbf71">' +
        '<td class="c-concept" data-label="Concepto"><input class="concept" id="ing-c-' + esc(r.id) + '" data-f="concepto" value="' + esc(r.concepto) + '" aria-label="Concepto"></td>' +
        '<td class="num" data-label="Planeado">' + moneyInput("ing-p-" + esc(r.id), "plan", r.plan, "Planeado") + "</td>" +
        '<td class="num" data-label="Real">' + moneyInput("ing-r-" + esc(r.id), "real", r.real, "Real") + "</td>" +
        '<td class="num diff" data-label="Diferencia">' + diffUso(r, false) + '</td><td class="c-del">' + delBtn(r.concepto) + "</td></tr>";
    }).join("");
  }
  function renderGastos() {
    $("tb-gas").innerHTML = cur().gastos.map(function (r) {
      return '<tr data-id="' + esc(r.id) + '" style="--c:' + catColor(r.cat) + '">' +
        '<td class="c-concept" data-label="Concepto"><input class="concept" id="gas-c-' + esc(r.id) + '" data-f="concepto" value="' + esc(r.concepto) + '" aria-label="Concepto"></td>' +
        '<td class="c-cat" data-label="Categoría"><select id="gas-k-' + esc(r.id) + '" data-f="cat" aria-label="Categoría">' + catOptions(r.cat) + "</select></td>" +
        '<td class="num c-day" data-label="Día"><input class="day-input" id="gas-d-' + esc(r.id) + '" data-f="dia" type="number" inputmode="numeric" min="1" max="31" value="' + (r.dia || "") + '" placeholder="–" aria-label="Día de pago"></td>' +
        '<td class="num" data-label="Planeado">' + moneyInput("gas-p-" + esc(r.id), "plan", r.plan, "Planeado") + "</td>" +
        '<td class="num" data-label="Real">' + moneyInput("gas-r-" + esc(r.id), "real", r.real, "Real") + "</td>" +
        '<td class="num diff" data-label="Diferencia">' + diffUso(r, true) + '</td><td class="c-del">' + delBtn(r.concepto) + "</td></tr>";
    }).join("");
  }
  function wireTable(tbodyId, listName) {
    var tb = $(tbodyId), isGasto = listName === "gastos";
    function rowOf(tr) { return cur()[listName].find(function (r) { return r.id === tr.dataset.id; }); }
    tb.addEventListener("input", function (e) {
      var t = e.target, tr = t.closest("tr"); if (!tr || !t.dataset.f) return;
      var row = rowOf(tr); if (!row) return;
      var f = t.dataset.f;
      if (f === "plan" || f === "real") row[f] = parseMonto(t.value);
      else if (f === "dia") row.dia = clamp(Math.round(num(t.value)), 0, 31);
      else if (f === "concepto") row.concepto = t.value.slice(0, 80);
      if (f === "plan" || f === "real") tr.querySelector(".diff").innerHTML = diffUso(row, isGasto);
      changed(); recompute();
    });
    tb.addEventListener("focusout", function (e) {
      var t = e.target; if (!t.classList || !t.classList.contains("money")) return;
      var row = rowOf(t.closest("tr")); if (row) t.value = miles(row[t.dataset.f]);
    });
    tb.addEventListener("change", function (e) {
      if (e.target.tagName !== "SELECT") return;
      var row = rowOf(e.target.closest("tr")); if (!row) return;
      row.cat = e.target.value; e.target.closest("tr").style.setProperty("--c", catColor(row.cat)); changed(); recompute();
    });
    tb.addEventListener("click", function (e) {
      var b = e.target.closest("[data-del]"); if (!b) return;
      var arr = cur()[listName], id = b.closest("tr").dataset.id;
      var i = arr.findIndex(function (r) { return r.id === id; });
      if (i > -1) arr.splice(i, 1);
      isGasto ? renderGastos() : renderIngresos();
      changed(); recompute();
    });
  }
  $("add-ing").addEventListener("click", function () {
    var r = { id: rid("i"), concepto: "Nuevo ingreso", plan: 0, real: 0 };
    cur().ingresos.push(r); renderIngresos(); recompute(); changed();
    var el = $("ing-c-" + r.id); if (el) { el.focus(); el.select(); }
  });
  $("add-gas").addEventListener("click", function () {
    var r = { id: rid("g"), concepto: "Nuevo gasto", cat: "otros", dia: 0, plan: 0, real: 0 };
    cur().gastos.push(r); renderGastos(); recompute(); changed();
    var el = $("gas-c-" + r.id); if (el) { el.focus(); el.select(); }
  });

  // ===================== Cálculos =====================
  function totalsOf(m) {
    var t = { ingPlan: 0, ingReal: 0, gasPlan: 0, gasReal: 0, byCat: {}, byGroup: { nec: 0, gus: 0, aho: 0 } };
    m.ingresos.forEach(function (r) { t.ingPlan += r.plan; t.ingReal += r.real; });
    m.gastos.forEach(function (r) {
      t.gasPlan += r.plan; t.gasReal += r.real;
      var c = t.byCat[r.cat] || (t.byCat[r.cat] = { plan: 0, real: 0 });
      c.plan += r.plan; c.real += r.real;
      t.byGroup[(catById(r.cat) || { group: "gus" }).group] += r.real;
    });
    t.saldo = t.ingReal - t.gasReal;
    t.ahorro = t.byGroup.aho + Math.max(t.saldo, 0);
    return t;
  }
  function prevKey() {
    var ks = monthKeys(), i = ks.indexOf(state.mes);
    return i > 0 ? ks[i - 1] : null;
  }

  function recompute() {
    var t = totalsOf(cur());
    var pk = hasPremium() ? prevKey() : null, pt = pk ? totalsOf(state.meses[pk]) : null;
    $("s-ing").textContent = money(t.ingReal);
    $("s-ing-sub").textContent = "Planeado " + money(t.ingPlan);
    $("s-gas").textContent = money(t.gasReal);
    if (pt && pt.gasReal > 0) {
      var ch = t.gasReal / pt.gasReal - 1;
      $("s-gas-sub").innerHTML = '<span class="cmp ' + (ch > 0 ? "neg" : "pos") + '">' + (ch > 0 ? "▲ " : "▼ ") + pctf(Math.abs(ch)) + "</span> vs " + esc(monthLabel(pk).toLowerCase());
    } else {
      $("s-gas-sub").textContent = t.ingReal > 0 ? pctf(t.gasReal / t.ingReal) + " de tus ingresos" : "Planeado " + money(t.gasPlan);
    }
    $("s-saldo").textContent = money(t.saldo);
    $("s-saldo-sub").textContent = "Planeado " + money(t.ingPlan - t.gasPlan);
    $("t-saldo").classList.toggle("neg", t.saldo < 0);
    $("s-ahorro").textContent = t.ingReal > 0 ? pctf(t.ahorro / t.ingReal) : "–";
    $("s-ahorro-sub").textContent = money(t.ahorro) + " (ahorro + saldo libre)";

    $("ft-ing-plan").textContent = money(t.ingPlan);
    $("ft-ing-real").textContent = money(t.ingReal);
    $("ft-ing-diff").innerHTML = diffHtml(t.ingReal - t.ingPlan);
    $("ft-gas-plan").textContent = money(t.gasPlan);
    $("ft-gas-real").textContent = money(t.gasReal);
    $("ft-gas-diff").innerHTML = diffHtml(t.gasPlan - t.gasReal);

    // Categorías
    var seen = {}, list = [];
    cats().concat(state.categorias).forEach(function (c) { if (!seen[c.id]) { seen[c.id] = 1; list.push(c); } });
    var html = list.filter(function (c) { var x = t.byCat[c.id]; return x && (x.plan || x.real); }).map(function (c) {
      var x = t.byCat[c.id];
      var ratio = x.plan > 0 ? x.real / x.plan : (x.real > 0 ? Infinity : 0);
      var cls, chip;
      if (x.plan === 0) { cls = "bad"; chip = '<span class="chip none">Sin plan</span>'; }
      else if (c.group === "aho") { cls = ratio >= 1 ? "" : "warn"; chip = '<span class="chip ' + (ratio >= 1 ? "ok" : "warn") + '">' + pctf(ratio) + "</span>"; }
      else if (ratio > 1) { cls = "bad"; chip = '<span class="chip bad">Excedido ' + pctf(ratio - 1) + "</span>"; }
      else if (ratio >= 0.9) { cls = "warn"; chip = '<span class="chip warn">' + pctf(ratio) + "</span>"; }
      else { cls = ""; chip = '<span class="chip ok">' + pctf(ratio) + "</span>"; }
      var w = Math.min(isFinite(ratio) ? ratio : 1, 1) * 100;
      if (cls === "warn") cls = "";   // el color de la categoría se mantiene; el porcentaje en ámbar avisa
      return '<div class="cat" role="button" tabindex="0" data-cat="' + esc(c.id) + '" style="--c:' + catColor(c.id) + '"><div class="cat-top">' + catIcon(c.id) + '<span class="cat-name">' + esc(c.name) + "</span>" + chip + "</div>" +
        '<div class="bar" role="img" aria-label="' + esc(c.name) + ": " + money(x.real) + " de " + money(x.plan) + '"><div class="fill ' + cls + '" style="width:' + w.toFixed(1) + '%"></div></div>' +
        '<div class="cat-nums">' + money(x.real) + " de " + money(x.plan) + "</div></div>";
    }).join("");
    $("cat-list").innerHTML = html || '<p class="empty">Agrega gastos para ver la ejecución por categoría.</p>';

    // 50/30/20
    var base = t.ingReal || t.ingPlan;
    $("rule").innerHTML = [
      { name: "Necesidades", val: t.byGroup.nec, target: 0.5, over: true },
      { name: "Gustos", val: t.byGroup.gus, target: 0.3, over: true },
      { name: "Ahorro", val: t.ahorro, target: 0.2, over: false }
    ].map(function (r) {
      var share = base > 0 ? r.val / base : 0;
      var ok = r.over ? share <= r.target : share >= r.target;
      var chip = base > 0 ? '<span class="chip ' + (ok ? "ok" : "warn") + '">' + (ok ? "En meta" : (r.over ? "Por encima" : "Por debajo")) + "</span>" : "";
      return '<div class="rule-row"><div class="rule-top"><b>' + r.name + " " + chip + "</b><span>" + pctf(share) + " · meta " + pctf(r.target) + "</span></div>" +
        '<div class="rule-bar" role="img" aria-label="' + r.name + ": " + pctf(share) + " de los ingresos, meta " + pctf(r.target) + '">' +
        '<div class="fill" style="width:' + Math.min(share * 100, 100).toFixed(1) + '%"></div><div class="target" style="left:calc(' + (r.target * 100) + '% - 1px)"></div></div>' +
        '<div class="cat-nums">' + money(r.val) + "</div></div>";
    }).join("");
    var names = { nec: [], gus: [], aho: [] };
    list.forEach(function (c) { names[c.group].push(c.name.toLowerCase()); });
    $("rule-legend").textContent = "Necesidades: " + names.nec.join(", ") + ". Gustos: " + names.gus.join(", ") + ". Ahorro: " + names.aho.join(", ") + ", más el saldo que quede libre.";

    renderPagos();
    renderHist();
    renderInicio(t);
  }

  // ===================== Historial =====================
  function renderHist() {
    var body = $("hist-body");
    if (!hasPremium()) { body.innerHTML = lockCard("Guarda todos tus meses, compáralos y mira en una gráfica cómo evolucionan tus ingresos y gastos."); return; }
    var ks = monthKeys().slice(-12);
    var data = ks.map(function (k) { var t = totalsOf(state.meses[k]); return { k: k, ing: t.ingReal, gas: t.gasReal, saldo: t.saldo, tasa: t.ingReal > 0 ? t.ahorro / t.ingReal : null }; });
    var max = Math.max.apply(null, data.map(function (d) { return Math.max(d.ing, d.gas); }).concat([1]));
    var mag = Math.pow(10, Math.floor(Math.log10(max))), nice = Math.ceil(max / mag * 2) / 2 * mag;
    var W = 340, H = 170, L = 44, R = 6, T = 8, B = 22, cw = (W - L - R) / data.length, bw = Math.min(16, cw * 0.32);
    var y = function (v) { return T + (H - T - B) * (1 - v / nice); };
    var svg = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Ingresos y gastos reales por mes">';
    [0, 0.5, 1].forEach(function (f) {
      var yy = y(nice * f);
      svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--line)" stroke-width="1"/>';
      svg += '<text x="' + (L - 6) + '" y="' + (yy + 3) + '" text-anchor="end">$ ' + esc(compact.format(nice * f)) + "</text>";
    });
    data.forEach(function (d, i) {
      var cx = L + cw * i + cw / 2, sel = d.k === state.mes;
      svg += '<rect x="' + (cx - bw - 1) + '" y="' + y(d.ing) + '" width="' + bw + '" height="' + Math.max(0, H - B - y(d.ing)) + '" rx="2" fill="color-mix(in srgb, var(--accent) 35%, var(--surface))"><title>Ingresos ' + esc(monthLabel(d.k)) + ": " + money(d.ing) + "</title></rect>";
      svg += '<rect x="' + (cx + 1) + '" y="' + y(d.gas) + '" width="' + bw + '" height="' + Math.max(0, H - B - y(d.gas)) + '" rx="2" fill="var(--accent)"><title>Gastos ' + esc(monthLabel(d.k)) + ": " + money(d.gas) + "</title></rect>";
      svg += '<text x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle"' + (sel ? ' style="fill:var(--ink);font-weight:700"' : "") + ">" + esc(monthShort(d.k)) + "</text>";
    });
    svg += "</svg>";
    var table = '<div class="table-scroll"><table class="hist-table"><thead><tr><th>Mes</th><th class="num">Gastos</th><th class="num">Saldo</th><th class="num">Ahorro</th></tr></thead><tbody>' +
      data.slice().reverse().map(function (d) {
        return '<tr data-mes="' + d.k + '"' + (d.k === state.mes ? ' class="sel"' : "") + ' tabindex="0"><td>' + esc(monthLabel(d.k)) + '</td><td class="num">' + money(d.gas) +
          '</td><td class="num ' + (d.saldo < 0 ? "neg" : "") + '">' + money(d.saldo) + '</td><td class="num">' + (d.tasa == null ? "–" : pctf(d.tasa)) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    body.innerHTML = '<div class="chart-wrap"><div class="legend"><span><i style="background:color-mix(in srgb, var(--accent) 35%, var(--surface))"></i>Ingresos</span><span><i style="background:var(--accent)"></i>Gastos</span></div>' + svg + "</div>" +
      (data.length < 2 ? '<p class="empty">Crea tu siguiente mes con <b>+ Nuevo mes</b> y aquí verás la comparación.</p>' : "") + table;
  }
  $("hist-body").addEventListener("click", function (e) { var tr = e.target.closest("tr[data-mes]"); if (tr) switchMonth(tr.dataset.mes); });
  $("hist-body").addEventListener("keydown", function (e) { var tr = e.target.closest("tr[data-mes]"); if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); switchMonth(tr.dataset.mes); } });

  // ===================== Metas =====================
  var jarVisto = {};
  function renderMetas() {
    var body = $("metas-body");
    // Gratis: 1 meta (decisión del dueño, 17 de noviembre de 2026). Las demás quedan guardadas y vuelven con Premium.
    var visibles = hasPremium() ? state.metas : state.metas.slice(0, 1), ocultas = state.metas.length - visibles.length;
    var falta = 0, nM = 0; visibles.forEach(function (g) { if (g.objetivo > 0) { nM++; falta += Math.max(0, g.objetivo - g.ahorrado); } });
    $("mt-resumen").textContent = nM ? (falta ? "Te faltan " + money(falta) + (nM > 1 ? " entre todas" : "") : "¡Cumpliste " + (nM > 1 ? "todas tus metas" : "tu meta") + "!") : "Tus metas, el reto de las 52 semanas y tu plan para salir de deudas.";
    var nk = nowKey();
    body.innerHTML = '<div class="goals">' + (visibles.length ? visibles.map(function (g) {
      var ratio = g.objetivo > 0 ? g.ahorrado / g.objetivo : 0, done = g.objetivo > 0 && g.ahorrado >= g.objetivo;
      var note;
      if (done) note = "<b>¡Meta cumplida!</b>";
      else if (!g.objetivo) note = "Escribe cuánto quieres reunir.";
      else if (!g.fecha) note = "Faltan <b>" + money(g.objetivo - g.ahorrado) + "</b>. Ponle una fecha para calcular cuánto ahorrar al mes.";
      else {
        var n = monthsBetween(nk, g.fecha);
        note = n <= 0 ? "La fecha ya pasó: faltan <b>" + money(g.objetivo - g.ahorrado) + "</b>." :
          "Faltan <b>" + money(g.objetivo - g.ahorrado) + "</b>: ahorra <b>" + money(Math.ceil((g.objetivo - g.ahorrado) / n / 1000) * 1000) + " al mes</b> durante " + n + (n === 1 ? " mes" : " meses") + ".";
      }
      var pc = Math.min(ratio, 1), jid = "jar-" + String(g.id).replace(/[^a-z0-9_-]/gi, ""), nueva = !jarVisto[g.id]; jarVisto[g.id] = 1;
      // Una alcancía que se llena con una ola; la primera vez sube desde abajo y cae una moneda
      var anillo = '<svg class="goal-jar' + (nueva ? " sube" : "") + (done ? " done" : "") + '" viewBox="0 0 56 64" aria-hidden="true" style="--y:' + (14 + (1 - pc) * 46 - 5).toFixed(1) + 'px">' +
        '<defs><clipPath id="' + jid + '"><path d="M14 16h28a5 5 0 0 1 5 5v31a8 8 0 0 1-8 8H17a8 8 0 0 1-8-8V21a5 5 0 0 1 5-5z"/></clipPath></defs>' +
        '<path class="jar-fondo" d="M14 16h28a5 5 0 0 1 5 5v31a8 8 0 0 1-8 8H17a8 8 0 0 1-8-8V21a5 5 0 0 1 5-5z"/>' +
        '<g clip-path="url(#' + jid + ')"><g class="jar-nivel"><path class="jar-ola" d="M-56 5q7-5 14 0t14 0 14 0 14 0 14 0 14 0 14 0 14 0V80H-56z"/></g></g>' +
        '<path class="jar-borde" d="M14 16h28a5 5 0 0 1 5 5v31a8 8 0 0 1-8 8H17a8 8 0 0 1-8-8V21a5 5 0 0 1 5-5z"/><rect class="jar-tapa" x="16" y="7" width="24" height="7" rx="2.5"/>' +
        (nueva && pc > 0 ? '<circle class="jar-moneda" cx="28" cy="0" r="4.5"/>' : "") +
        "</svg>";
      return '<div class="goal' + (done ? " cumplida" : "") + '" data-id="' + esc(g.id) + '"><div class="goal-top">' + anillo + '<input class="field name" data-f="nombre" value="' + esc(g.nombre) + '" aria-label="Nombre de la meta">' + delBtn(g.nombre) + "</div>" +
        '<div class="goal-fields"><label>Objetivo<input class="field" data-f="objetivo" type="number" inputmode="numeric" step="10000" min="0" value="' + g.objetivo + '"></label>' +
        '<label>Ahorrado<input class="field" data-f="ahorrado" type="number" inputmode="numeric" step="10000" min="0" value="' + g.ahorrado + '"></label>' +
        '<label>Fecha límite<input class="field" data-f="fecha" type="month" value="' + esc(g.fecha) + '"></label></div>' +
        '<div class="bar" role="img" aria-label="' + pctf(Math.min(ratio, 1)) + ' completado"><div class="fill' + (done ? " done" : "") + '" style="width:' + (Math.min(ratio, 1) * 100).toFixed(1) + '%"></div></div>' +
        '<div class="goal-note">' + pctf(Math.min(ratio, 1)) + " · " + note + "</div></div>";
    }).join("") : '<p class="empty">Aún no tienes metas.</p>') + '</div>' +
      (ocultas > 0 ? '<div class="metas-mas">' + "" + "<p>" + (ocultas === 1 ? "Tu otra meta sigue guardada." : "Tus otras " + ocultas + " metas siguen guardadas.") + ' Con Premium las ves y las sigues.</p><button class="btn premium-btn" type="button" data-premium-metas>Ver Premium</button></div>' : "") +
      '<button class="add-btn" type="button" id="add-meta">+ Agregar meta</button>';
  }
  $("metas-body").addEventListener("change", onMetaInput);
  $("metas-body").addEventListener("input", function (e) { if (e.target.dataset.f === "nombre") onMetaInput(e); });
  function onMetaInput(e) {
    var t = e.target, card = t.closest(".goal"); if (!card || !t.dataset.f) return;
    var g = state.metas.find(function (x) { return x.id === card.dataset.id; }); if (!g) return;
    var f = t.dataset.f, antesCumplida = g.objetivo > 0 && g.ahorrado >= g.objetivo;
    if (f === "nombre") { g.nombre = t.value.slice(0, 60); changed(); return; }
    if (f === "fecha") g.fecha = validKey(t.value) ? t.value : "";
    else g[f] = Math.max(0, num(t.value));
    changed(); renderMetas();
    if (!antesCumplida && g.objetivo > 0 && g.ahorrado >= g.objetivo) { celebrar(); toast("¡Meta cumplida: <b>" + esc(g.nombre || "tu meta") + "</b>!"); }
    var again = $("metas-body").querySelector('.goal[data-id="' + g.id + '"] [data-f="' + f + '"]'); if (again) again.focus();
  }
  $("metas-body").addEventListener("click", function (e) {
    if (e.target.closest("[data-premium-metas]")) { openPremium("Con Finti gratis tienes 1 meta. Con Premium tienes todas las que quieras."); return; }
    if (e.target.closest("#add-meta")) {
      // Gratis: 1 meta (decisión del dueño, 17 de noviembre de 2026). Quien ya tenía más las conserva.
      if (!hasPremium() && state.metas.length >= 1) { openPremium("Con Finti gratis tienes 1 meta. Con Premium tienes todas las que quieras."); return; }
      var g = { id: rid("m"), nombre: "Nueva meta", objetivo: 0, ahorrado: 0, fecha: addMonths(nowKey(), 6) };
      state.metas.push(g); changed(); renderMetas();
      var el = $("metas-body").querySelector('.goal[data-id="' + g.id + '"] [data-f="nombre"]'); if (el) { el.focus(); el.select(); }
      return;
    }
    var b = e.target.closest("[data-del]"); if (!b) return;
    var id = b.closest(".goal").dataset.id;
    state.metas = state.metas.filter(function (x) { return x.id !== id; }); changed(); renderMetas();
  });

  // ===================== Deudas =====================
  function simulate(debts, extra, method, rollover) {
    var ds = debts.filter(function (d) { return d.saldo > 0; }).map(function (d) {
      return { id: d.id, nombre: d.nombre, b: d.saldo, r: Math.pow(1 + d.tasa / 100, 1 / 12) - 1, cuota: d.cuota, paid: 0 };
    });
    var res = { ok: true, months: 0, interest: 0, order: [] };
    if (!ds.length) return res;
    var budget = ds.reduce(function (s, d) { return s + d.cuota; }, 0) + extra;
    for (var m = 1; m <= 600; m++) {
      var active = ds.filter(function (d) { return d.b > 0.5; });
      if (!active.length) break;
      active.forEach(function (d) { var i = d.b * d.r; d.b += i; res.interest += i; });
      var avail = rollover ? budget : active.reduce(function (s, d) { return s + d.cuota; }, 0) + extra;
      active.forEach(function (d) { var p = Math.min(d.cuota, d.b, avail); d.b -= p; avail -= p; });
      active.filter(function (d) { return d.b > 0.5; })
        .sort(method === "bola" ? function (a, b) { return a.b - b.b; } : function (a, b) { return b.r - a.r || a.b - b.b; })
        .forEach(function (d) { if (avail <= 0) return; var p = Math.min(avail, d.b); d.b -= p; avail -= p; });
      active.forEach(function (d) { if (d.b <= 0.5 && !d.paid) d.paid = m; });
    }
    res.ok = ds.every(function (d) { return d.paid > 0; });
    res.months = res.ok ? Math.max.apply(null, ds.map(function (d) { return d.paid; })) : 600;
    res.order = ds.slice().sort(function (a, b) { return (a.paid || 9999) - (b.paid || 9999); });
    return res;
  }

  function renderDeudas() {
    var body = $("deudas-body");
    if (!hasPremium()) { body.innerHTML = lockCard("Anota tus tarjetas y créditos, y te mostramos en qué orden pagarlos, cuántos intereses te ahorras y en qué mes quedas libre de deudas."); return; }
    var rows = state.deudas.map(function (d) {
      return '<tr data-id="' + esc(d.id) + '"><td class="c-concept" data-label="Deuda"><input class="concept" data-f="nombre" value="' + esc(d.nombre) + '" aria-label="Deuda"></td>' +
        '<td class="num" data-label="Saldo">' + moneyInput("deu-s-" + esc(d.id), "saldo", d.saldo, "Saldo") + "</td>" +
 '<td class="num" data-label="Tasa E. A. %"><input class="day-input" data-f="tasa" type="number" inputmode="decimal" step="0.1" min="0" value="' + d.tasa + '" aria-label="Tasa efectiva anual" style="width:70px"></td>' +
        '<td class="num" data-label="Cuota mínima">' + moneyInput("deu-c-" + esc(d.id), "cuota", d.cuota, "Cuota mínima") + '</td><td class="c-del">' + delBtn(d.nombre) + "</td></tr>";
    }).join("");
    body.innerHTML =
      '<div class="table-scroll"><table class="rows"><thead><tr><th>Deuda</th><th class="num">Saldo</th><th class="num">Tasa E. A. %</th><th class="num">Cuota mínima</th><th aria-label="Eliminar"></th></tr></thead><tbody id="tb-deu">' +
      (rows || '<tr><td colspan="5" class="empty">Agrega tus tarjetas de crédito y préstamos.</td></tr>') + "</tbody></table></div>" +
      '<button class="add-btn" type="button" id="add-deuda">+ Agregar deuda</button>' +
      '<div class="debt-extra"><label>Pago extra al mes<input class="field" id="f-extra" type="number" inputmode="numeric" step="10000" min="0" value="' + state.deudaExtra + '"></label>' +
      '<div class="seg" role="group" aria-label="Método"><button type="button" data-metodo="avalancha" aria-pressed="' + (state.deudaMetodo === "avalancha") + '">Avalancha</button><button type="button" data-metodo="bola" aria-pressed="' + (state.deudaMetodo === "bola") + '">Bola de nieve</button></div></div>' +
      '<p class="hint">' + (state.deudaMetodo === "avalancha" ? "Avalancha: primero la deuda con la tasa más alta. Es la que menos intereses te cobra en total." : "Bola de nieve: primero la deuda más pequeña. Te da victorias rápidas que motivan a seguir.") +
      " Cuando terminas una deuda, su cuota pasa a la siguiente.</p>" +
      '<div id="deu-res"></div>';
    renderDebtResults();
  }
  function renderDebtResults() {
    var box = $("deu-res"); if (!box) return;
    var valid = state.deudas.filter(function (d) { return d.saldo > 0; });
    if (!valid.length) { box.innerHTML = ""; return; }
    var plan = simulate(valid, state.deudaExtra, state.deudaMetodo, true);
    var minOnly = simulate(valid, 0, state.deudaMetodo, false);
    var warn = valid.filter(function (d) { return d.cuota <= d.saldo * (Math.pow(1 + d.tasa / 100, 1 / 12) - 1); });
    var html = warn.length ? '<p class="warn-box">La cuota de ' + warn.map(function (d) { return "<b>" + esc(d.nombre) + "</b>"; }).join(", ") + " no alcanza a cubrir los intereses del mes: así la deuda no baja. Revisa la cuota o súmale un pago extra.</p>" : "";
    if (!plan.ok) { box.innerHTML = html + '<p class="warn-box">Con estos pagos, las deudas no terminan de pagarse en 50 años. Aumenta el pago extra o las cuotas.</p>'; return; }
    var fin = addMonths(nowKey(), plan.months);
    var ahorroInt = minOnly.ok ? minOnly.interest - plan.interest : null;
    html += '<div class="results">' +
      '<div class="result"><span class="label">Libre de deudas en</span><span class="value">' + plan.months + (plan.months === 1 ? " mes" : " meses") + '</span><span class="sub">' + esc(monthLabel(fin)) + "</span></div>" +
      '<div class="result"><span class="label">Intereses totales</span><span class="value">' + money(plan.interest) + '</span><span class="sub">con este plan</span></div>' +
      '<div class="result"><span class="label">Frente a pagar solo mínimos</span><span class="value">' + (minOnly.ok ? money(Math.max(ahorroInt, 0)) : "—") + '</span><span class="sub">' +
      (minOnly.ok ? "menos intereses y " + Math.max(minOnly.months - plan.months, 0) + " meses antes" : "solo con mínimos no terminarías") + "</span></div></div>" +
      '<ol class="order">' + plan.order.map(function (d) { return "<li>" + esc(d.nombre || "Deuda") + " <span>· pagada en " + esc(monthLabel(addMonths(nowKey(), d.paid)).toLowerCase()) + "</span></li>"; }).join("") + "</ol>";
    box.innerHTML = html;
  }
  $("deudas-body").addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "f-extra") { state.deudaExtra = Math.max(0, num(t.value)); changed(); renderDebtResults(); return; }
    var tr = t.closest("tr[data-id]"); if (!tr || !t.dataset.f) return;
    var d = state.deudas.find(function (x) { return x.id === tr.dataset.id; }); if (!d) return;
    var f = t.dataset.f;
    if (f === "nombre") d.nombre = t.value.slice(0, 60);
    else if (f === "tasa") d.tasa = clamp(num(t.value), 0, 400);
    else d[f] = Math.max(0, num(t.value));
    changed(); renderDebtResults();
  });
  $("deudas-body").addEventListener("click", function (e) {
    var m = e.target.closest("[data-metodo]");
    if (m) { state.deudaMetodo = m.dataset.metodo; changed(); renderDeudas(); return; }
    if (e.target.closest("#add-deuda")) {
      var d = { id: rid("d"), nombre: "Nueva deuda", saldo: 0, tasa: 0, cuota: 0 };
      state.deudas.push(d); changed(); renderDeudas();
      var el = $("deudas-body").querySelector('tr[data-id="' + d.id + '"] [data-f="nombre"]'); if (el) { el.focus(); el.select(); }
      return;
    }
    var b = e.target.closest("[data-del]"); if (!b) return;
    var id = b.closest("tr").dataset.id;
    state.deudas = state.deudas.filter(function (x) { return x.id !== id; }); changed(); renderDeudas();
  });

  // ===================== Asesor =====================
  // Tono: acompaña, no regaña. Primero lo que va bien, luego ideas concretas con su efecto en pesos.
  // Disfrutar es parte del plan. Todo se calcula en el dispositivo; no se envía a nadie.
  var FIJAS = { vivienda: 1, servicios: 1, deudas: 1, educacion: 1, ahorro: 1 };
  var DIAS_SEMANA = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];
  function analizarMes() {
    var m = cur(), t = totalsOf(m), ing = t.ingReal, gas = t.gasReal;
    var pk = prevKey(), pt = pk ? totalsOf(state.meses[pk]) : null;
    var recs = [], diag = [], logros = [];
    function rec(peso, clave, titulo, texto, accion) { recs.push({ peso: peso, clave: clave, titulo: titulo, texto: texto, accion: accion || null }); }
    function nombreCat(id) { var c = catById(id); return c ? c.name : "Otros"; }
    function grupo(id) { return (catById(id) || { group: "gus" }).group; }
    if (!ing && !gas) {
      return { vacio: true, diag: ["Todavía no hay cifras de " + monthLabel(state.mes).toLowerCase() + "."],
        recs: [{ clave: "empezar", titulo: "Empecemos por lo fácil", texto: "Registra lo que vas gastando o confírmalo en Por confirmar. Con unos días de movimientos ya te puedo mostrar cómo vas y qué te conviene." }] };
    }
    var tasa = ing ? t.ahorro / ing : 0, hoyD = new Date(), pm = parseKey(state.mes);
    var enCurso = !state.ejemplo && hoyD.getFullYear() === pm.y && hoyD.getMonth() + 1 === pm.m;   // mes a medias: no se compara como si estuviera cerrado
    // Lo que va bien, primero
    if (ing) diag.push(t.saldo >= 0 ? "Este mes entraron " + money(ing) + " y van " + money(gas) + " en gastos: te quedan " + money(t.saldo) + " libres."
      : "Este mes van " + money(gas) + " en gastos y entraron " + money(ing) + ". Con unos ajustes pequeños lo cierras tranquilo.");
    else diag.push("Llevas " + money(gas) + " en gastos. Cuando registres tus ingresos te digo cuánto te queda libre.");
    if (enCurso) { if (t.byGroup.aho > 0) logros.push("Ya apartaste " + money(t.byGroup.aho) + " para tu ahorro este mes. Págate a ti primero: así se hace."); }
    else if (ing && tasa >= 0.2) logros.push("Estás ahorrando el " + pctf(tasa) + " de lo que entra. Eso es excelente.");
    else if (ing && tasa >= 0.1) logros.push("Estás ahorrando el " + pctf(tasa) + ": vas por buen camino hacia el 20 %.");
    else if (t.ahorro > 0) logros.push("Ya apartaste " + money(t.ahorro) + " para ahorrar. Cada peso cuenta.");
    if (!enCurso && pt && pt.gasReal) { var dv = (gas - pt.gasReal) / pt.gasReal; if (dv <= -0.1) logros.push("Gastaste " + pctf(-dv) + " menos que en " + monthLabel(pk).toLowerCase() + ". Buen trabajo."); }
    var gustos = Object.keys(t.byCat).filter(function (k) { return grupo(k) === "gus" && t.byCat[k].real > 0; }).sort(function (a, b) { return t.byCat[b].real - t.byCat[a].real; });
    if (ing && t.saldo < 0) rec(100, "cerrar-mes", "Ajustemos " + money(-t.saldo) + " para cerrar el mes tranquilo",
      "Lo más fácil suele estar en " + (gustos.length ? gustos.slice(0, 2).map(function (k) { return nombreCat(k).toLowerCase(); }).join(" y ") : "los gustos") + ". No tienes que dejarlos: bajar un poco el ritmo estas semanas ya ayuda. Mejor no cubrirlo con la tarjeta de crédito, que luego cobra intereses.");
    Object.keys(t.byCat).map(function (k) { return { k: k, d: t.byCat[k].real - t.byCat[k].plan, c: t.byCat[k] }; })
      .filter(function (x) { return x.c.plan > 0 && x.d >= 20000 && x.c.real > x.c.plan * 1.1; })
      .sort(function (a, b) { return b.d - a.d; }).slice(0, 2).forEach(function (x, i) {
        rec(80 - i * 5, "cat:" + x.k, nombreCat(x.k) + " pidió más de lo planeado",
          "Llevas " + money(x.c.real) + " de " + money(x.c.plan) + ". Si es algo que valoras, súbele el plan y listo. Si prefieres mantenerlo, con unos " + money(Math.round(x.c.plan / 4.3 / 1000) * 1000) + " a la semana llegas a fin de mes sin estrés.",
          { tipo: "plan", cat: x.k, texto: "Ajustar el plan a " + money(Math.ceil(x.c.real / 10000) * 10000) });
      });
    if (ing) {
      var gus = t.byGroup.gus, nec = t.byGroup.nec;
      if (gus > ing * 0.3) rec(70, "gustos-30", "Tus gustos son el " + pctf(gus / ing) + " de lo que entra",
        "Disfrutar es parte del plan. Si quieres más espacio para tus metas, mover " + money(gus - ing * 0.3) + " al mes de " + (gustos.length ? nombreCat(gustos[0]).toLowerCase() : "los gustos") + " te lo da, sin dejar de darte tus gustos.");
      if (nec > ing * 0.6) rec(55, "fijos", "Tus gastos fijos ocupan el " + pctf(nec / ing),
        "Es lo que más espacio te quita, y se arregla una sola vez: revisar el plan del celular, el internet o los seguros puede liberar plata todos los meses sin cambiar tu día a día.");
      if (tasa < 0.1 && t.saldo >= 0) rec(65, "pagate-primero", "Págate a ti primero: " + money(ing * 0.1) + " al mes",
        "Apenas llegue tu ingreso, pasa ese 10 % a una cuenta aparte. Lo que no ves en la cuenta del día a día, no lo extrañas.");
      else if (tasa < 0.2 && t.saldo > 0) rec(35, "ahorro-20", "Un paso más: ahorrar el 20 %",
        "Te faltan " + money(Math.max(0, ing * 0.2 - t.ahorro)) + " al mes. Subiendo un 2 % cada mes llegas sin sentirlo.");
      if (pt && pt.ingReal && ing < pt.ingReal * 0.85) rec(45, "ingreso-bajo", "Este mes entró un poco menos",
        "Pasa. Ajusta el plan a lo que llegó y el resto del mes se siente más liviano.");
    }
    var deudas = state.deudas.filter(function (d) { return d.saldo > 0; });
    if (deudas.length) {
      var cara = deudas.slice().sort(function (a, b) { return b.tasa - a.tasa; })[0];
      var interes = cara.saldo * (Math.pow(1 + (cara.tasa || 0) / 100, 1 / 12) - 1);
      if (cara.tasa >= 20) rec(75, "deuda:" + cara.nombre, "Tu deuda más cara: " + cara.nombre,
        "Tiene " + cara.tasa + " % E. A. y cuesta unos " + money(Math.round(interes / 1000) * 1000) + " al mes en intereses. Cada abono extra ahí rinde más que en cualquier otra, sin descuidar las cuotas de las demás.");
      var cuotas = deudas.reduce(function (a, d) { return a + (d.cuota || 0); }, 0);
      if (ing && cuotas > ing * 0.3) rec(85, "cuotas", "Tus cuotas ocupan el " + pctf(cuotas / ing) + " de lo que entra",
        "Hasta el 30 % es cómodo. Mientras bajas de ahí, mejor no sumar deudas nuevas; también puedes pedirle al banco mejor tasa o más plazo en la más cara.");
    }
    var hoy = parseKey(state.mes);
    state.metas.forEach(function (g) {
      var falta = g.objetivo - g.ahorrado; if (falta <= 0) return;
      if (!g.fecha) { rec(20, "meta-fecha:" + g.nombre, "Ponle fecha a " + g.nombre, "Con una fecha te digo cuánto apartar cada mes y qué tan probable es que llegues."); return; }
      var f = parseKey(g.fecha), meses = Math.max(1, (f.y - hoy.y) * 12 + (f.m - hoy.m)), porMes = falta / meses;
      if (ing && t.saldo >= 0 && porMes > Math.max(t.saldo, 0) + t.byGroup.aho) rec(50, "meta:" + g.nombre, "Para llegar a " + g.nombre + " a tiempo: " + money(porMes) + " al mes",
        "Con lo que te sobra hoy no alcanza todavía. Puedes mover la fecha unos meses o darle un empujón con lo que liberes en otros gastos. Las dos opciones son válidas.");
      else rec(25, "meta:" + g.nombre, g.nombre + ": aparta " + money(porMes) + " al mes", "Así llegas a " + money(g.objetivo) + " en " + monthLabel(g.fecha).toLowerCase() + ". Si lo programas como pago automático, te olvidas.");
    });
    var tieneFondo = state.metas.some(function (g) { return /emergencia|imprevist|colch/i.test(g.nombre); });
    if (!tieneFondo && t.byGroup.nec) rec(40, "fondo", "Arma tu colchón para imprevistos", "Con unos " + money(t.byGroup.nec * 3) + " (tres meses de gastos necesarios) un daño o una cita médica no te descuadra el mes.");
    var ahora = new Date(), en7 = 0, nombres = [];
    (state.porPagar || []).forEach(function (b) {
      if (!b.monto || b.f !== "mensual" || !b.dia) return;
      var d = new Date(ahora.getFullYear(), ahora.getMonth(), b.dia); if (d < new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())) d.setMonth(d.getMonth() + 1);
      if ((d - ahora) / 864e5 <= 7) { en7 += b.monto; nombres.push(b.nombre); }
    });
    if (en7) rec(60, "pagos-semana", "Esta semana vienen " + money(en7) + " en pagos", "De " + nombres.slice(0, 3).join(", ") + ". Si los dejas separados desde ya, pagas a tiempo y sin intereses de mora.");
    state.metas.forEach(function (g) { if (g.objetivo > 0 && g.ahorrado >= g.objetivo) logros.push("Completaste tu meta " + g.nombre + ". Date un gusto, te lo ganaste."); });
    var cerca = state.metas.filter(function (g) { return g.objetivo > 0 && g.ahorrado < g.objetivo && g.ahorrado / g.objetivo >= 0.75; })[0];
    if (cerca) logros.push("Ya tienes el " + pctf(cerca.ahorrado / cerca.objetivo) + " de " + cerca.nombre + ". Falta poco.");
    // Tu canasta: dónde te sale más barato lo que repites y las compras pequeñas que se acumulan
    var canasta = canResumen(90).filter(function (o) { return o.lugares.length > 1 && o.lugares[0].pu < o.lugares[o.lugares.length - 1].pu * 0.9; }).sort(function (a, b) { return b.total - a.total; })[0];
    if (canasta) rec(55, "canasta-lugar:" + canasta.k, canNombre(canasta.n) + " te sale más barato en " + canasta.lugares[0].lugar,
      "Te ha salido a " + canPrecio(canasta.lugares[0].pu) + canPorUnidad(canasta.ult) + " allá y a " + canPrecio(canasta.lugares[canasta.lugares.length - 1].pu) + " en " + canasta.lugares[canasta.lugares.length - 1].lugar + ". Si te queda de camino, ahí rinde más tu plata.");
    var chicas = state.movs.filter(function (x) { return x.t === "g" && x.cat === "alimentacion" && x.f && x.f.slice(0, 7) === state.mes && x.m < 15000; });
    if (chicas.length >= 8) rec(28, "tienda-seguido", "Este mes vas " + chicas.length + " veces a comprar cosas pequeñas de comida",
      "Suman " + money(chicas.reduce(function (a, x) { return a + x.m; }, 0)) + ". Una compra grande con lista a la semana suele salir más barata que muchas sueltas.");
    if (!recs.length) rec(10, "bien", "Vas muy bien", "Tus cifras están en orden. Si al final del mes te sobra, llévalo a tu meta más cercana o abónalo a tu deuda más cara.");
    // Aprende de la persona: lo que marcó como "no es para mí" no vuelve a salir; lo que le sirvió sube.
    recs = recs.filter(function (r) { return state.asesor.no.indexOf(r.clave) < 0; })
      .map(function (r) { if (state.asesor.si.indexOf(r.clave) > -1) r.peso += 15; return r; });
    recs.sort(function (a, b) { return b.peso - a.peso; });
    return { diag: diag, logros: logros.slice(0, 3), recs: recs.slice(0, 6) };
  }

  // Patrones aprendidos del historial de movimientos (últimos 120 días) y de los meses guardados.
  function aprenderPatrones() {
    var hoy = d0(), lim = new Date(hoy); lim.setDate(lim.getDate() - 120);
    var movs = state.movs.filter(function (x) { var d = parseD(x.f); return d && d >= lim && d <= hoy; });
    var gastos = movs.filter(function (x) { return x.t === "g"; }), items = [];
    var dias = {}; gastos.forEach(function (x) { dias[x.f] = 1; });
    var nDias = Object.keys(dias).length, primero = gastos.length ? parseD(gastos.map(function (x) { return x.f; }).sort()[0]) : hoy;
    var span = Math.max(1, Math.round((hoy - primero) / 864e5) + 1), suficiente = gastos.length >= 12 && span >= 14;
    function grupo(id) { return (catById(id) || { group: "gus" }).group; }
    var variables = gastos.filter(function (x) { return !FIJAS[x.cat] && grupo(x.cat) !== "aho"; });
    if (suficiente) {
      // 1. El día de la semana en que más se gasta
      var porDia = [0, 0, 0, 0, 0, 0, 0], cuenta = [0, 0, 0, 0, 0, 0, 0];
      for (var d = new Date(primero); d <= hoy; d.setDate(d.getDate() + 1)) cuenta[d.getDay()]++;
      variables.forEach(function (x) { porDia[parseD(x.f).getDay()] += x.m; });
      var prom = porDia.map(function (v, i) { return cuenta[i] ? v / cuenta[i] : 0; }), media = prom.reduce(function (a, b) { return a + b; }, 0) / 7;
      var top = prom.indexOf(Math.max.apply(null, prom));
      if (media > 0 && prom[top] >= media * 1.6) items.push({ ic: "i-cal", clave: "dia", titulo: "Los " + DIAS_SEMANA[top] + " son tu día de gasto",
        texto: "En promedio gastas " + money(prom[top]) + " ese día, " + (prom[top] / media).toFixed(1).replace(".", ",") + " veces un día normal. Si lo planeas desde el lunes, lo disfrutas igual y sin sorpresas." });
      // 2. La hora (si se conoce)
      var conHora = variables.filter(function (x) { return x.h >= 0; });
      if (conHora.length >= 10) {
        var noche = conHora.filter(function (x) { return x.h >= 20 || x.h < 5; }), sn = noche.reduce(function (a, x) { return a + x.m; }, 0), st = conHora.reduce(function (a, x) { return a + x.m; }, 0);
        if (st && sn / st >= 0.35) items.push({ ic: "i-bell", clave: "noche", titulo: "Muchas compras pasan de noche",
          texto: "El " + pctf(sn / st) + " de tus gastos variables es después de las 8 p. m. Las compras nocturnas suelen ser más impulsivas: dejar el carrito para mañana es un truco que funciona." });
      }
      // 3. Gastos pequeños de los últimos 30 días
      var hace30 = new Date(hoy); hace30.setDate(hace30.getDate() - 30);
      var peq = variables.filter(function (x) { return x.m < 20000 && parseD(x.f) >= hace30; }), sp = peq.reduce(function (a, x) { return a + x.m; }, 0);
      if (peq.length >= 8) items.push({ ic: "i-note", clave: "hormiga", titulo: peq.length + " compras pequeñas suman " + money(sp),
        texto: "Son compras de menos de " + money(20000) + " en los últimos 30 días. No tiene nada de malo; solo que lo tengas presente, porque juntas pesan tanto como un gasto grande." });
    }
    // 4. Después de recibir el pago (si hay ingresos registrados)
    var ingresos = movs.filter(function (x) { return x.t === "i"; });
    if (suficiente && ingresos.length >= 2) {
      var tras = 0, nTras = 0, resto = 0, nResto = 0, diasPago = {};
      ingresos.forEach(function (x) { diasPago[x.f] = 1; });
      var pagos = Object.keys(diasPago).map(parseD);
      for (var e = new Date(primero); e <= hoy; e.setDate(e.getDate() + 1)) {
        var k = hoyStr(e), g = variables.filter(function (x) { return x.f === k; }).reduce(function (a, x) { return a + x.m; }, 0);
        var cerca = pagos.some(function (p) { var dd = (e - p) / 864e5; return dd >= 0 && dd < 4; });
        if (cerca) { tras += g; nTras++; } else { resto += g; nResto++; }
      }
      if (nTras && nResto && resto && (tras / nTras) >= (resto / nResto) * 1.5) items.push({ ic: "i-wallet", clave: "pago", titulo: "Los días de pago gastas más",
        texto: "En los 3 días después de recibir plata gastas " + ((tras / nTras) / (resto / nResto)).toFixed(1).replace(".", ",") + " veces lo de un día normal. Es muy común. Separar el ahorro y los pagos ese mismo día protege lo importante." });
    }
    // 5. Pagos que se repiten cada mes (suscripciones o recurrentes)
    var grupos = {};
    gastos.forEach(function (x) { var n = normal(x.com || x.c); if (!n) return; (grupos[n] = grupos[n] || []).push(x); });
    var recurrentes = [];
    Object.keys(grupos).forEach(function (n) {
      var xs = grupos[n], meses = {};
      xs.forEach(function (x) { (meses[x.f.slice(0, 7)] = meses[x.f.slice(0, 7)] || []).push(x.m); });
      var ms = Object.keys(meses).sort(); if (ms.length < 2 || ms.some(function (k) { return meses[k].length > 1; })) return;
      var vals = ms.map(function (k) { return meses[k][0]; }), medio = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      if (vals.every(function (v) { return Math.abs(v - medio) <= medio * 0.08; })) recurrentes.push({ nombre: xs[xs.length - 1].com || xs[xs.length - 1].c, monto: medio });
    });
    if (recurrentes.length) {
      var anual = recurrentes.reduce(function (a, r) { return a + r.monto; }, 0) * 12;
      items.push({ ic: "i-sync", clave: "recurrentes", titulo: "Encontré " + plural(recurrentes.length, "pago") + " que se repite" + (recurrentes.length > 1 ? "n" : "") + " cada mes",
        texto: recurrentes.slice(0, 4).map(function (r) { return r.nombre + " (" + money(r.monto) + ")"; }).join(", ") + ". Al año son " + money(anual) + (recurrentes.length > 1 ? ". Si alguno ya no lo usas tanto, ahí hay plata fácil." : ". Si ya no lo usas tanto, ahí hay plata fácil.") });
    }
    // 6. Lo que más disfruta
    var porCat = {}; variables.filter(function (x) { return grupo(x.cat) === "gus"; }).forEach(function (x) { porCat[x.cat] = (porCat[x.cat] || 0) + x.m; });
    var tv = variables.reduce(function (a, x) { return a + x.m; }, 0), fav = Object.keys(porCat).sort(function (a, b) { return porCat[b] - porCat[a]; })[0];
    if (suficiente && fav && tv && porCat[fav] / tv >= 0.15) items.push({ ic: "i-star", clave: "favorito", titulo: "Lo que más disfrutas: " + (catById(fav) || { name: "Otros" }).name.toLowerCase(),
      texto: "Es el " + pctf(porCat[fav] / tv) + " de tus gastos variables. Está bien gastar en lo que te hace feliz; la idea es que esté en tu plan para disfrutarlo sin culpa." });
    // 7. Categorías cuyo plan siempre se queda corto (meses guardados; no necesita historial de movimientos)
    var ks = monthKeys().filter(function (k) { return k <= state.mes; }).slice(-3);
    if (ks.length >= 2) {
      var cuentas = {};
      ks.forEach(function (k) { var b = totalsOf(state.meses[k]).byCat; Object.keys(b).forEach(function (c) { if (b[c].plan > 0 && b[c].real > b[c].plan * 1.1) { cuentas[c] = cuentas[c] || []; cuentas[c].push(b[c].real); } }); });
      Object.keys(cuentas).filter(function (c) { return cuentas[c].length >= 2 && !FIJAS[c]; }).slice(0, 2).forEach(function (c) {
        var vals = cuentas[c].slice().sort(function (a, b) { return a - b; }), med = vals[Math.floor(vals.length / 2)];
        items.push({ ic: "i-target", clave: "plan:" + c, titulo: "Tu plan de " + (catById(c) || { name: "Otros" }).name.toLowerCase() + " suele quedarse corto",
          texto: "En " + vals.length + " de tus últimos " + ks.length + " meses gastaste más de lo planeado (alrededor de " + money(med) + "). Un plan realista es más fácil de cumplir y se siente mejor.",
          accion: { tipo: "plan", cat: c, texto: "Ajustar el plan a " + money(Math.ceil(med / 10000) * 10000) } });
      });
    }
    var r = simRacha();
    if (r.actual >= 3) items.push({ ic: "i-flame", clave: "racha", titulo: "Llevas " + plural(r.actual, "día") + " seguidos registrando", texto: "Esa constancia es lo que más cambia las finanzas, más que cualquier recorte." });
    items = items.filter(function (i) { return state.asesor.no.indexOf(i.clave) < 0; });
    return { items: items, suficiente: suficiente, movimientos: gastos.length, faltan: Math.max(0, 12 - gastos.length), dias: span };
  }

  // Plata para disfrutar sin culpa: lo que se puede gastar en gustos de aquí a fin de mes y aun así cerrar en orden
  // (el cierre más probable ya descuenta lo necesario, los pagos y el ahorro planeado).
  function paraDisfrutar(cierre) {
    var quedan = Math.max(1, cierre.dias - cierre.dia + 1), libre = cierre.p50 + (cierre.gusEst - cierre.gusReal);
    return { libre: libre, quedan: quedan, diario: libre > 0 ? libre / quedan : 0, semana: libre > 0 ? Math.min(libre, libre / quedan * 7) : 0 };
  }

  // ===================== Asesor predictivo =====================
  // Simula 1.000 futuros posibles con las cifras de la persona (en su dispositivo, sin enviar nada):
  // ritmo de gasto del mes, historial, inflación, temporadas de Colombia, imprevistos, deudas con sus tasas
  // y las condiciones que la persona quiera probar. El "escenario más real" es la mediana de esos futuros.
  var SUPUESTOS = {
    inflacion: 0.0629, inflacionFuente: "IPC anual del DANE a septiembre de 2026",
    usura: 0.2834, usuraFuente: "tasa de usura de consumo certificada para noviembre de 2026",
    sims: 1000, imprevistoProb: 0.12,
    temporada: { 1: 1.08, 2: 1.03, 6: 1.04, 12: 1.18 }   // enero (útiles, matrículas), febrero, junio (vacaciones), diciembre (fiestas)
  };
  var aseCond = { recorte: 0, abono: null, extra: 0, prima: false, horizonte: 12 }, aseTimer = null;
  function aleatorio(semilla) {   // generador repetible: el mismo presupuesto da los mismos resultados
    var a = semilla >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function gauss(r) { var u = r() || 1e-9, v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function percentil(arr, p) { var s = arr.slice().sort(function (a, b) { return a - b; }); return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))] : 0; }
  function promPesos(xs) { var w = 0, s = 0; xs.forEach(function (x, i) { s += x * (i + 1); w += i + 1; }); return w ? s / w : 0; }   // los meses recientes pesan más
  function cvDe(xs, def) { if (xs.length < 3) return def; var m = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length; if (!m) return def; var v = xs.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (xs.length - 1); return Math.min(0.35, Math.max(def / 2, Math.sqrt(v) / m)); }
  function mesCorto(y, m) { return MESES_C[m - 1] + " " + String(y).slice(2); }

  // 1. Cómo cierra el mes que se está viendo (ritmo de gasto, pagos fijos pendientes, ingresos por llegar)
  function cierreMes(r) {
    var m = cur(), hoy = new Date(), p = parseKey(state.mes), D = new Date(p.y, p.m, 0).getDate();
    var actual = !state.ejemplo && hoy.getFullYear() === p.y && hoy.getMonth() + 1 === p.m, pasado = state.ejemplo || p.y * 12 + p.m < hoy.getFullYear() * 12 + hoy.getMonth() + 1;
    var d = actual ? hoy.getDate() : pasado ? D : 0, frac = d / D;
    var ing = 0, ingSd = 0, gas = 0, gasSd2 = 0, variableReal = 0, gusEst = 0, gusReal = 0;
    m.ingresos.forEach(function (x) {
      var pend = Math.max(0, x.plan - x.real) * (frac >= 1 ? 0 : 1);
      ing += x.real + pend * 0.92; ingSd += pend * 0.25;
    });
    m.gastos.forEach(function (x) {
      var est, sd;
      if (x.dia > 0) { est = Math.max(x.real, frac >= 1 ? x.real : x.plan); sd = x.real >= x.plan ? 0 : x.plan * 0.03; }
      else {
        // Ritmo del mes mezclado con el plan: al principio pesa más el plan, al final pesa más lo real.
        // Si ya se pasó del plan (por ejemplo, el mercado del mes de una vez), se espera solo un poco más.
        variableReal += x.real;
        var basePlan = x.plan > 0 ? x.plan : x.real / Math.max(frac, 0.25), ritmo = frac > 0 ? x.real / Math.max(frac, 0.08) : basePlan, w = Math.min(1, frac * 1.2);
        if (frac >= 1) est = x.real;
        else if (x.real >= basePlan) est = x.real + (1 - frac) * basePlan * 0.3;
        else est = Math.max(x.real, Math.min(w * ritmo + (1 - w) * basePlan, basePlan * 1.5));
        sd = (est - x.real) * 0.3 + basePlan * 0.04 * (1 - frac);
      }
      gas += est; gasSd2 += sd * sd;
      if (x.dia <= 0 && (catById(x.cat) || { group: "gus" }).group === "gus") { gusEst += est; gusReal += x.real; }
    });
    var sd = Math.sqrt(gasSd2 + ingSd * ingSd), res = [];
    for (var i = 0; i < 400; i++) res.push(ing - gas + gauss(r) * sd);
    return { dia: d, dias: D, actual: actual, ing: ing, gas: gas, p10: percentil(res, 0.1), p50: ing - gas, p90: percentil(res, 0.9),
      rojo: res.filter(function (x) { return x < 0; }).length / res.length, diario: d ? variableReal / d : 0, gusEst: gusEst, gusReal: gusReal };
  }

  // 2. Base mensual a partir del historial (y del cierre esperado de este mes)
  function baseMensual(cierre) {
    var ks = monthKeys().filter(function (k) { return k < state.mes; }).slice(-12), hI = [], hC = [], hG = [];
    // Las cuotas de las deudas registradas se simulan aparte (con su saldo y su tasa): se quitan del gasto base.
    var conDeudas = state.deudas.some(function (d) { return d.saldo > 0; });
    var cuotasDe = function (t, campo) { var c = t.byCat.deudas; return conDeudas && c ? c[campo] : 0; };
    ks.forEach(function (k) { var t = totalsOf(state.meses[k]); if (t.ingReal || t.gasReal) { hI.push(t.ingReal); hC.push(t.byGroup.nec + t.byGroup.gus - cuotasDe(t, "real")); hG.push(t.byGroup.gus); } });
    var t = totalsOf(cur()), esc = t.gasReal ? cierre.gas / t.gasReal : 1, planG = { nec: 0, gus: 0, aho: 0 };
    cur().gastos.forEach(function (x) { if (!(conDeudas && x.cat === "deudas")) planG[(catById(x.cat) || { group: "gus" }).group] += x.plan; });
    if (t.gasReal) { hC.push(Math.max(0, t.byGroup.nec + t.byGroup.gus - cuotasDe(t, "real")) * esc); hG.push(t.byGroup.gus * esc); } else { hC.push(planG.nec + planG.gus); hG.push(planG.gus); }
    hI.push(cierre.ing);
    var n = hC.length, tend = 0;
    if (n >= 4) {   // tendencia (regresión lineal), amortiguada a la mitad y limitada a ±2 % mensual
      var mx = (n - 1) / 2, my = hC.reduce(function (a, b) { return a + b; }, 0) / n, sxy = 0, sxx = 0;
      hC.forEach(function (y, i) { sxy += (i - mx) * (y - my); sxx += (i - mx) * (i - mx); });
      tend = my ? Math.max(-0.02, Math.min(0.02, (sxy / sxx) / my * 0.5)) : 0;
    }
    var C = promPesos(hC);
    return { ing: promPesos(hI), cons: C, gus: Math.min(C, promPesos(hG)), cvI: cvDe(hI, 0.05), cvC: cvDe(hC, 0.08), tend: tend, meses: n,
      nec: Math.max(1, C - promPesos(hG)) };
  }

  // 3. Monte Carlo: H meses hacia adelante con las condiciones elegidas
  function simular(base, cond, semilla) {
    var H = cond.horizonte, N = SUPUESTOS.sims, r = aleatorio(semilla), p = parseKey(state.mes);
    var inflM = Math.pow(1 + SUPUESTOS.inflacion, 1 / 12) - 1, iUsura = Math.pow(1 + SUPUESTOS.usura, 1 / 12) - 1;
    var liquido0 = state.cuentas.filter(function (c) { return c.tipo !== "tarjeta"; }).reduce(function (a, c) { return a + c.saldo; }, 0);
    var deudas0 = state.deudas.filter(function (d) { return d.saldo > 0; }).map(function (d) { return { nombre: d.nombre, saldo: d.saldo, i: Math.pow(1 + (d.tasa || 0) / 100, 1 / 12) - 1, cuota: d.cuota || 0 }; });
    var metas = state.metas.filter(function (g) { return g.objetivo > g.ahorrado; }).slice().sort(function (a, b) { return (a.fecha || "9999").localeCompare(b.fecha || "9999"); });
    var abono = cond.abono == null ? (state.deudaExtra || 0) : cond.abono, bola = state.deudaMetodo === "bola";
    var porMes = []; for (var t = 0; t < H; t++) porMes.push([]);
    var libre = deudas0.map(function () { return []; }), intereses = [], prestamo = 0, metaMes = metas.map(function () { return []; }), finLiquido = [];
    for (var s = 0; s < N; s++) {
      var liq = liquido0, ds = deudas0.map(function (d) { return { saldo: d.saldo, i: d.i, cuota: d.cuota, fin: -1 }; }), nueva = 0, int = 0, ahorrado = 0, pidio = false;
      var metaFin = metas.map(function () { return -1; }), ing0 = base.ing;
      for (t = 0; t < H; t++) {
        var mesCal = ((p.m + t) % 12) + 1;
        if (mesCal === 1 && t > 0) ing0 *= 1 + SUPUESTOS.inflacion;               // ajuste de ingresos en enero
        var ing = ing0 * (1 + gauss(r) * base.cvI) + cond.extra;
        if (cond.prima && (mesCal === 6 || mesCal === 12)) ing += ing0 / 2;     // prima de servicios: 15 días de salario
        var cons = (base.cons - base.gus * cond.recorte) * Math.pow(1 + base.tend + inflM, t + 1) * (SUPUESTOS.temporada[mesCal] || 1) * (1 + gauss(r) * base.cvC);
        if (r() < SUPUESTOS.imprevistoProb) cons += base.cons * (0.1 + r() * 0.4);   // un daño, una cita médica, un viaje urgente
        ds.forEach(function (d) {                                                // cuota de cada deuda: interés del mes + abono a capital
          if (d.saldo <= 0) return;                                              // ya saldada: esa cuota queda libre
          var interes = d.saldo * d.i, pago = Math.min(d.cuota, d.saldo + interes);
          int += interes; d.saldo = d.saldo + interes - pago; cons += pago;
          if (d.saldo <= 1) { d.saldo = 0; if (d.fin < 0) d.fin = t; }
        });
        var sobra = ing - cons, extra = 0, vivas = ds.filter(function (d) { return d.saldo > 0; });
        if (vivas.length && abono > 0 && sobra > 0) {
          extra = Math.min(abono, sobra);
          var obj = vivas.sort(function (a, b) { return bola ? a.saldo - b.saldo : b.i - a.i; })[0];
          var pago = Math.min(extra, obj.saldo); obj.saldo -= pago; extra = pago;
          if (obj.saldo <= 1) { obj.saldo = 0; if (obj.fin < 0) obj.fin = t; }
        }
        if (nueva > 0) { var intN = nueva * iUsura; int += intN; nueva += intN; }
        var neto = sobra - extra;
        if (neto > 0 && nueva > 0) { var pagaN = Math.min(neto, nueva); nueva -= pagaN; neto -= pagaN; }
        liq += neto;
        if (liq < 0) { nueva += -liq; liq = 0; pidio = true; }                     // el faltante se cubre con crédito (a tasa de usura)
        if (neto > 0) ahorrado += neto;
        var acum = 0;
        metas.forEach(function (g, j) { acum += g.objetivo - g.ahorrado; if (metaFin[j] < 0 && ahorrado >= acum) metaFin[j] = t; });
        porMes[t].push(liq - nueva - ds.reduce(function (a, d) { return a + d.saldo; }, 0));
      }
      ds.forEach(function (d, j) { libre[j].push(d.fin); });
      metaFin.forEach(function (f, j) { metaMes[j].push(f); });
      intereses.push(int); if (pidio) prestamo++; finLiquido.push(liq);
    }
    function mesDe(t) { var k = p.m + t, y = p.y + Math.floor(k / 12), m = (k % 12) + 1; return { y: y, m: m }; }
    return {
      meses: porMes.map(function (xs, t) { var md = mesDe(t); return { etiqueta: mesCorto(md.y, md.m), p10: percentil(xs, 0.1), p50: percentil(xs, 0.5), p90: percentil(xs, 0.9) }; }),
      neto0: liquido0 - deudas0.reduce(function (a, d) { return a + d.saldo; }, 0),
      deudas: deudas0.map(function (d, j) {
        var fines = libre[j].filter(function (f) { return f >= 0; }), prob = fines.length / N, med = prob >= 0.5 ? percentil(fines, 0.5 * N / fines.length) : -1;
        return { nombre: d.nombre, prob: prob, cuando: med >= 0 ? mesDe(med) : null };
      }),
      metas: metas.map(function (g, j) {
        var fines = metaMes[j], ok = 0, lim = g.fecha ? (parseKey(g.fecha).y - p.y) * 12 + parseKey(g.fecha).m - p.m - 1 : H;
        fines.forEach(function (f) { if (f >= 0 && f <= lim) ok++; });
        var llegan = fines.filter(function (f) { return f >= 0; });
        return { nombre: g.nombre, fecha: g.fecha, prob: ok / N, probable: llegan.length >= N / 2 ? mesDe(percentil(llegan, 0.5 * N / llegan.length)) : null };
      }),
      intereses: percentil(intereses, 0.5), credito: prestamo / N, colchon: percentil(finLiquido, 0.5)
    };
  }
  function semillaEstado() { var t = totalsOf(cur()); return Math.round(t.ingReal + 7 * t.gasReal + 13 * state.deudas.length) ^ parseInt(state.mes.replace("-", ""), 10); }
  function nombreMes(o) { return o ? MESES[o.m - 1] + " de " + o.y : ""; }

  function graficaAbanico(res) {
    var W = 600, Hh = 210, pl = 84, pr = 24, pt = 14, pb = 28, ms = res.meses, n = ms.length;
    var ys = [res.neto0, 0]; ms.forEach(function (x) { ys.push(x.p10, x.p90); });
    var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys); if (hi - lo < 1) { hi += 1; lo -= 1; }
    var pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    var X = function (i) { return pl + (W - pl - pr) * i / n; }, Y = function (v) { return pt + (Hh - pt - pb) * (hi - v) / (hi - lo); };
    var arriba = ms.map(function (x, i) { return X(i + 1) + "," + Y(x.p90); }), abajo = ms.map(function (x, i) { return X(i + 1) + "," + Y(x.p10); }).reverse();
    var banda = "M" + X(0) + "," + Y(res.neto0) + " L" + arriba.join(" L") + " L" + abajo.join(" L") + " Z";
    var linea = "M" + X(0) + "," + Y(res.neto0) + ms.map(function (x, i) { return " L" + X(i + 1) + "," + Y(x.p50); }).join("");
    var corto = function (v) { var a = Math.abs(v), s = v < 0 ? "−" : ""; return a < 500 ? "$ 0" : s + (a >= 1e6 ? "$ " + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",") + " mill." : money(Math.round(a / 1e3) * 1e3)); };   // "mill." es la abreviatura de millones (RAE)
    var marcas = [hi - pad, (hi + lo) / 2, lo + pad].map(function (v) { return '<text x="' + (pl - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" class="ase-eje">' + corto(v) + "</text>"; }).join("");
    var cada = n > 12 ? 4 : n > 6 ? 2 : 1, et = ms.map(function (x, i) { return (i + 1) % cada ? "" : '<text x="' + X(i + 1) + '" y="' + (Hh - 8) + '" text-anchor="' + (i === n - 1 ? "end" : "middle") + '" class="ase-eje">' + x.etiqueta + "</text>"; }).join("");
    var cero = lo < 0 && hi > 0 ? '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" class="ase-cero"/>' : "";
    var fin = ms[n - 1];
    return '<svg class="ase-graf" viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Proyección de tu patrimonio: en ' + n + " meses, lo más probable es " + money(fin.p50) + '">' +
      cero + '<path d="' + banda + '" class="ase-banda"/><path d="' + linea + '" class="ase-linea"/>' +
      '<circle cx="' + X(n) + '" cy="' + Y(fin.p50) + '" r="4.5" class="ase-punto"/>' + marcas + et + "</svg>";
  }

  function renderIA() {
    var body = $("ia-body");
    if (!hasPremium()) { body.innerHTML = lockCard("Tu asesor aprende cómo manejas tu plata, te dice cuánto puedes disfrutar sin culpa y simula miles de escenarios para mostrarte cómo cierras el mes, cuándo saldas tus deudas y si llegas a tus metas."); return; }
    var r0 = analizarMes();
    if (r0.vacio) { body.innerHTML = '<p class="ase-diag">' + esc(r0.diag[0]) + '</p><ol class="ase-lista"><li><b>' + esc(r0.recs[0].titulo) + "</b><span>" + esc(r0.recs[0].texto) + "</span></li></ol>"; return; }
    if (!body.dataset.escucha) { body.dataset.escucha = "1"; body.addEventListener("click", clicAsesor); }
    if (!body.querySelector("#ase-res")) {
      var dmax = Math.max(500000, Math.round(state.deudas.reduce(function (a, d) { return a + d.cuota; }, 0) / 50000) * 50000);
      body.innerHTML = '<div id="ase-res"></div>' +
        '<details class="ase-cond" id="ase-cond"><summary>Prueba tus condiciones: ¿y si…?</summary>' +
        '<label class="ase-ctl"><span>Recorto mis gustos <b id="ase-v-recorte"></b></span><input type="range" min="0" max="50" step="5" id="ase-recorte"></label>' +
        '<label class="ase-ctl"><span>Abono extra a deudas cada mes <b id="ase-v-abono"></b></span><input type="range" min="0" max="' + dmax + '" step="10000" id="ase-abono"></label>' +
        '<label class="ase-ctl"><span>Ingreso extra cada mes <b id="ase-v-extra"></b></span><input type="range" min="0" max="3000000" step="50000" id="ase-extra"></label>' +
        '<label class="acepto-chk"><input type="checkbox" id="ase-prima"><span>Recibo prima en junio y diciembre (empleo formal)</span></label>' +
        '<div class="ase-hor" role="radiogroup" aria-label="Horizonte">' + [6, 12, 24].map(function (h) { return '<button type="button" class="chip-btn" data-h="' + h + '">' + h + " meses</button>"; }).join("") + "</div></details>" +
        '<details class="ase-como"><summary>¿Cómo calculamos?</summary><div id="ase-como"></div></details>' +
        '<p class="hint">Proyección estadística calculada en tu dispositivo con tus cifras; no se envían a nadie. Es una estimación, no una promesa, y no es asesoría financiera profesional.</p>';
      body.querySelector("#ase-cond").addEventListener("input", function (e) {
        var t = e.target;
        if (t.id === "ase-recorte") aseCond.recorte = +t.value / 100;
        else if (t.id === "ase-abono") aseCond.abono = +t.value;
        else if (t.id === "ase-extra") aseCond.extra = +t.value;
        else if (t.id === "ase-prima") aseCond.prima = t.checked;
        pintarCond(); clearTimeout(aseTimer); aseTimer = setTimeout(calcularAsesor, 60);
      });
      body.querySelector("#ase-cond").addEventListener("click", function (e) {
        var h = e.target.closest("[data-h]"); if (!h) return;
        aseCond.horizonte = +h.dataset.h; pintarCond(); calcularAsesor();
      });
    }
    pintarCond(); clearTimeout(aseTimer); aseTimer = setTimeout(calcularAsesor, 30);
  }
  function pintarCond() {
    var ab = aseCond.abono == null ? (state.deudaExtra || 0) : aseCond.abono;
    if (!$("ase-recorte")) return;
    $("ase-recorte").value = Math.round(aseCond.recorte * 100); $("ase-v-recorte").textContent = Math.round(aseCond.recorte * 100) + " %";
    $("ase-abono").value = ab; $("ase-v-abono").textContent = money(ab);
    $("ase-extra").value = aseCond.extra; $("ase-v-extra").textContent = money(aseCond.extra);
    $("ase-prima").checked = aseCond.prima;
    [].forEach.call(document.querySelectorAll("#ase-cond [data-h]"), function (b) { b.classList.toggle("on", +b.dataset.h === aseCond.horizonte); b.setAttribute("aria-pressed", String(+b.dataset.h === aseCond.horizonte)); });
  }
  function calcularAsesor() {
    var out = $("ase-res"); if (!out) return;
    if (!state.ejemplo) metrica("asesor", "dia");
    var m$ = function (v) { return money(Math.round(v / 1000) * 1000); };   // proyecciones redondeadas a miles: sin falsa precisión
    var semilla = semillaEstado(), r = aleatorio(semilla), cierre = cierreMes(r), base = baseMensual(cierre);
    var res = simular(base, aseCond, semilla), H = aseCond.horizonte, fin = res.meses[H - 1];
    var r0 = analizarMes(), recs = [];
    // Impacto medido: cada idea se simula con los mismos escenarios
    var ab = aseCond.abono == null ? (state.deudaExtra || 0) : aseCond.abono;
    if (base.gus > 0 && aseCond.recorte < 0.15) {
      var c1 = simular(base, Object.assign({}, aseCond, { recorte: 0.15 }), semilla), d1 = c1.meses[H - 1].p50 - fin.p50;
      if (d1 > 0) recs.push({ peso: 70, clave: "sim-recorte", titulo: "Con un 15 % menos en gustos tendrías " + m$(d1) + " más en " + H + " meses",
        texto: "Son unos " + m$(base.gus * 0.15) + " al mes, y sigues disfrutando el otro 85 %. Terminarías con " + m$(c1.meses[H - 1].p50) + " en vez de " + m$(fin.p50) + "." });
    }
    if (res.deudas.length) {
      var c2 = simular(base, Object.assign({}, aseCond, { abono: ab + 100000 }), semilla), ganan = res.intereses - c2.intereses;
      if (ganan > 1000) {
        var antes = res.deudas.filter(function (d) { return d.cuando; }), mejor = c2.deudas.filter(function (d) { return d.cuando; });
        recs.push({ peso: 78, clave: "sim-abono", titulo: "Con " + m$(100000) + " extra al mes, tus deudas se van antes",
          texto: "Te ahorras cerca de " + m$(ganan) + " en intereses en " + H + " meses" + (mejor.length > antes.length ? " y sales de " + plural(mejor.length - antes.length, "deuda") + " más dentro de ese plazo." : ".") });
      }
    }
    if (res.credito > 0.15) recs.push({ peso: 95, clave: "sim-colchon", titulo: "Un colchón te daría tranquilidad",
      texto: "En " + Math.round(res.credito * 10) + " de cada 10 escenarios algún mes queda justo y tocaría usar crédito, que hoy cobra hasta el " + (SUPUESTOS.usura * 100).toFixed(1).replace(".", ",") + " % E. A. Ir armando unos " + m$(base.nec) + ", aunque sea de a poco, te protege de eso." });
    r0.recs.forEach(function (x) { if (x.clave !== "bien") recs.push({ peso: (x.peso || 50) - 10, clave: x.clave, titulo: x.titulo, texto: x.texto, accion: x.accion }); });
    recs = recs.filter(function (x) { return state.asesor.no.indexOf(x.clave) < 0; })
      .map(function (x) { if (state.asesor.si.indexOf(x.clave) > -1) x.peso += 15; return x; });
    recs.sort(function (a, b) { return b.peso - a.peso; }); recs = recs.slice(0, 5);
    var pat = aprenderPatrones(), disf = cierre.actual && cierre.ing > 0 ? paraDisfrutar(cierre) : null, mesNom = esc(monthLabel(state.mes).toLowerCase());
    var mejora = fin.p50 - res.neto0;
    var frase = "Si sigues como vas, en " + H + " meses tu patrimonio (lo que tienes menos lo que debes) pasaría de " + m$(res.neto0) + " a " + m$(fin.p50) +
      (mejora >= 0 ? ", " + m$(mejora) + " más que hoy." : ". Las condiciones de abajo te muestran cómo darle la vuelta.") + " En 8 de cada 10 escenarios quedaría entre " + m$(fin.p10) + " y " + m$(fin.p90) + ".";
    var pred = [];
    res.deudas.forEach(function (d) { pred.push(d.cuando ? "<b>" + esc(d.nombre) + ":</b> lo más probable es que quede saldada en " + nombreMes(d.cuando) + "." : "<b>" + esc(d.nombre) + ":</b> a este ritmo toma más de " + H + " meses (" + Math.round(d.prob * 100) + " % de los escenarios la saldan antes)."); });
    if (res.deudas.length) pred.push("<b>Intereses:</b> pagarías cerca de " + m$(res.intereses) + " en " + H + " meses.");
    res.metas.forEach(function (g) { pred.push("<b>" + esc(g.nombre) + ":</b> " + (g.fecha ? Math.round(g.prob * 100) + " % de probabilidad de lograrla para " + monthLabel(g.fecha).toLowerCase() + "." : "") + (g.probable ? " Fecha más probable: " + nombreMes(g.probable) + "." : " A este ritmo tomaría más de " + H + " meses; abajo puedes probar qué la acerca.")); });
    pred.push("<b>Colchón:</b> al final tendrías unos " + m$(res.colchon) + " disponibles" + (base.nec ? ", " + (res.colchon / base.nec).toFixed(1).replace(".", ",") + " meses de gastos necesarios." : "."));
    function fb(clave) {
      var si = state.asesor.si.indexOf(clave) > -1;
      return '<div class="ase-fb"><button type="button" data-fb="si" aria-pressed="' + si + '"' + (si ? ' class="on"' : "") + '>' + (si ? "Te sirvió" : "Me sirve") + '</button><button type="button" data-fb="no">No es para mí</button></div>';
    }
    var h = "";
    // 1. Lo que va bien, siempre primero
    var buenas = r0.logros || [];
    if (buenas.length) h += '<div class="ase-logros"><span class="ase-pi" aria-hidden="true"><svg class="ic"><use href="#i-star"/></svg></span><div><b>Lo que va bien</b><ul>' + buenas.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div></div>";
    // 2. Para disfrutar sin culpa
    if (disf) h += '<div class="ase-disf"><span class="ase-k">Para disfrutar sin culpa</span>' + (disf.libre > 0
      ? "<b>" + m$(disf.diario) + " al día</b><span>o unos " + m$(disf.semana) + " esta semana, en lo que quieras. Tus gastos necesarios, tus pagos y tu ahorro del mes ya están cubiertos.</span>"
      : "<b>Este mes, planes sencillos</b><span>El espacio para gustos de " + mesNom + " ya se usó. No pasa nada: lo que queda va para lo necesario y el próximo mes arrancas de cero.</span>") + "</div>";
    // 3. Así cierras el mes
    h += '<div class="ase-cierre' + (cierre.p50 < 0 ? " ojo" : "") + '"><span class="ase-k">Así cierras ' + mesNom + "</span><b>" + m$(cierre.p50) + "</b>" +
      "<span>" + (cierre.actual ? "Vas en el día " + cierre.dia + " de " + cierre.dias + ". " : "") + "Lo más probable es que quede entre " + m$(cierre.p10) + " y " + m$(cierre.p90) + ". " +
      (cierre.rojo >= 0.05 ? "Hay un " + Math.round(cierre.rojo * 100) + " % de probabilidad de que cierre justo; un ajuste pequeño lo evita." : "Todo indica que cierras en orden.") +
      (cierre.actual && cierre.diario ? " Tu promedio en gastos variables es de " + m$(cierre.diario) + " al día." : "") + "</span></div>";
    // 4. Lo que aprendí de ti
    h += '<h3 class="ase-h">Lo que aprendí de ti</h3>';
    pat.items.sort(function (a, b) { return (state.asesor.si.indexOf(b.clave) > -1) - (state.asesor.si.indexOf(a.clave) > -1); });
    if (pat.items.length) h += '<ul class="ase-pat">' + pat.items.map(function (x, i) {
      return '<li data-clave="' + esc(x.clave) + '"' + (i >= 3 ? " hidden" : "") + '><span class="ase-pi" aria-hidden="true"><svg class="ic"><use href="#' + x.ic + '"/></svg></span><div><b>' + esc(x.titulo) + "</b><span>" + esc(x.texto) + "</span>" +
        (x.accion ? '<button type="button" class="btn ase-acc" data-plan="' + esc(x.accion.cat) + '">' + esc(x.accion.texto) + "</button>" : "") + fb(x.clave) + "</div></li>";
    }).join("") + "</ul>" + (pat.items.length > 3 ? '<button type="button" class="link-btn" data-ase-mas>Ver ' + (pat.items.length - 3) + " más de lo que aprendí</button>" : "");
    if (!pat.suficiente) h += '<div class="ase-apr"><span>' + (state.movs.length ? "Sigo conociéndote. Con " + plural(Math.max(1, pat.faltan), "movimiento") + " más" + (pat.dias < 14 ? " y un par de semanas" : "") + " te muestro en qué días y horas gastas más, tus pagos que se repiten y tus gastos pequeños."
      : "Cada gasto que registres me ayuda a conocerte: en qué días y horas gastas más, qué pagos se repiten y qué disfrutas. Todo se queda en tu dispositivo.") + '</span><span class="ase-barra"><i style="width:' + Math.min(100, Math.round(pat.movimientos / 12 * 100)) + '%"></i></span></div>';
    // 5. Ideas para ti
    h += '<h3 class="ase-h">Ideas para ti</h3>';
    if (recs.length) h += '<ol class="ase-lista">' + recs.map(function (x) {
      return '<li data-clave="' + esc(x.clave) + '"><b>' + esc(x.titulo) + "</b><span>" + esc(x.texto) + "</span>" +
        (x.accion ? '<button type="button" class="btn ase-acc" data-plan="' + esc(x.accion.cat) + '">' + esc(x.accion.texto) + "</button>" : "") + fb(x.clave) + "</li>";
    }).join("") + "</ol>";
    else h += '<p class="ase-diag">Vas muy bien. Si al final del mes te sobra, llévalo a tu meta más cercana.</p>';
    if (state.asesor.no.length) h += '<button type="button" class="link-btn" data-ase-reset>Volver a mostrar las ideas que ocultaste (' + state.asesor.no.length + ")</button>";
    // 6. Tu camino
    h += '<h3 class="ase-h">Tu camino a ' + H + " meses</h3>" + '<p class="ase-diag">' + esc(frase) + "</p>" + graficaAbanico(res) +
      '<p class="ase-ley"><span class="ase-ley-l"></span>Escenario más probable <span class="ase-ley-b"></span>8 de cada 10 escenarios</p>' +
      '<ul class="ase-pred">' + pred.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>";
    out.innerHTML = h;
    $("ase-como").innerHTML = "<ul>" +
      "<li>Simulamos " + SUPUESTOS.sims.toLocaleString("es-CO") + " futuros posibles con tus cifras. El escenario más probable es el del medio.</li>" +
      "<li>Este mes: tus gastos variables siguen tu ritmo diario; los fijos se toman de tu plan; los ingresos que faltan, como planeados.</li>" +
      "<li>Para disfrutar sin culpa: lo que entra este mes menos tus gastos necesarios y pagos, tu ahorro planeado y lo que ya gastaste en gustos, repartido en los días que quedan.</li>" +
      "<li>Lo que aprendí de ti: tus movimientos de los últimos 120 días (día de la semana, hora, días de pago, pagos que se repiten, compras pequeñas) y tus últimos meses. Las ideas que marcas como útiles aparecen primero y las que no son para ti no vuelven a salir.</li>" +
      "<li>Base mensual: " + (base.meses > 1 ? "promedio de tus últimos " + base.meses + " meses (los recientes pesan más)" : "este mes, porque aún no hay más historial") + ", con su variación real" + (base.tend ? " y tu tendencia (" + (base.tend * 100).toFixed(1).replace(".", ",") + " % al mes)" : "") + ".</li>" +
      "<li>Inflación de " + (SUPUESTOS.inflacion * 100).toFixed(2).replace(".", ",") + " % al año (" + SUPUESTOS.inflacionFuente + "). Los ingresos se ajustan en enero.</li>" +
      "<li>Temporadas: diciembre más caro (+18 %), enero (+8 %), febrero (+3 %) y junio (+4 %).</li>" +
      "<li>Imprevistos: 1 de cada 8 meses aparece un gasto inesperado de entre el 10 % y el 50 % de tu gasto mensual.</li>" +
      "<li>Deudas: interés mensual según su tasa E. A., tu cuota y el abono extra por el método " + (state.deudaMetodo === "bola" ? "bola de nieve" : "avalancha") + ". Al saldar una, su cuota queda libre. Si un mes falta plata, se cubre con crédito a la " + SUPUESTOS.usuraFuente + " (" + (SUPUESTOS.usura * 100).toFixed(2).replace(".", ",") + " %).</li>" +
      "<li>Patrimonio: saldo de tus cuentas (sin tarjetas de crédito) menos tus deudas registradas.</li></ul>";
  }
  // Lo que la persona le enseña al asesor: qué le sirve, qué no y ajustes de plan en un toque.
  function anotarAsesor(lista, clave, quitar) {
    var a = state.asesor[lista], i = a.indexOf(clave);
    if (quitar) { if (i > -1) a.splice(i, 1); } else if (i < 0) { a.push(clave); if (a.length > 80) a.shift(); }
  }
  function ajustarPlanCat(cat) {
    var filas = cur().gastos.filter(function (x) { return x.cat === cat; }); if (!filas.length) return;
    var real = filas.reduce(function (a, x) { return a + x.real; }, 0), plan = filas.reduce(function (a, x) { return a + x.plan; }, 0);
    var ks = monthKeys().filter(function (k) { return k <= state.mes; }).slice(-3), vals = ks.map(function (k) { var c = totalsOf(state.meses[k]).byCat[cat]; return c ? c.real : 0; }).filter(Boolean).sort(function (a, b) { return a - b; });
    var meta = Math.ceil(Math.max(real, vals.length >= 2 ? vals[Math.floor(vals.length / 2)] : 0) / 10000) * 10000; if (meta <= plan) return;
    var antes = filas.map(function (x) { return x.plan; }), mayor = filas.slice().sort(function (a, b) { return b.real - a.real; })[0];
    mayor.plan += meta - plan; changed(); renderAll();
    toast("Listo: " + esc((catById(cat) || { name: "Otros" }).name.toLowerCase()) + " queda en <b>" + money(meta) + "</b>. Un plan realista se cumple más fácil.", { action: "Deshacer", onAction: function () { filas.forEach(function (x, i) { x.plan = antes[i]; }); changed(); renderAll(); } });
  }
  function clicAsesor(e) {
    var b = e.target.closest("[data-fb],[data-plan],[data-ase-reset],[data-ase-mas]"); if (!b) return;
    if (b.hasAttribute("data-ase-mas")) { [].forEach.call(b.parentNode.querySelectorAll(".ase-pat li[hidden]"), function (li) { li.hidden = false; }); b.remove(); return; }
    if (b.hasAttribute("data-ase-reset")) { state.asesor.no = []; changed(); calcularAsesor(); return; }
    if (b.dataset.plan) { ajustarPlanCat(b.dataset.plan); return; }
    var li = b.closest("[data-clave]"), clave = li && li.dataset.clave; if (!clave) return;
    if (b.dataset.fb === "si") {
      var ya = state.asesor.si.indexOf(clave) > -1;
      anotarAsesor("si", clave, ya); changed();
      b.classList.toggle("on", !ya); b.setAttribute("aria-pressed", String(!ya)); b.textContent = ya ? "Me sirve" : "Te sirvió";
      if (!ya) toast("Anotado. Te mostraré primero ideas como esta.");
    } else {
      anotarAsesor("no", clave); anotarAsesor("si", clave, true); changed();
      li.classList.add("ase-fuera"); setTimeout(calcularAsesor, reduceMotion ? 0 : 220);
      toast("Listo, no te la vuelvo a mostrar.", { action: "Deshacer", onAction: function () { anotarAsesor("no", clave, true); changed(); calcularAsesor(); } });
    }
  }

  // ===================== Meses =====================
  function renderHeader() {
    $("f-titulo").value = state.titulo;
    var ks = monthKeys().slice().reverse();
    $("f-mes").innerHTML = ks.map(function (k) { return '<option value="' + k + '"' + (k === state.mes ? " selected" : "") + ">" + esc(monthLabel(k)) + "</option>"; }).join("");
    $("example-notice").hidden = !state.ejemplo;
  }
  var MESES_GRATIS = 3;
  function switchMonth(k) {
    if (!state.meses[k] || k === state.mes) return;
    state.mes = k; changed(); renderAll();
  }
  $("f-titulo").addEventListener("input", function () { state.titulo = this.value.slice(0, 80); changed(); });
  $("f-mes").addEventListener("change", function () { switchMonth(this.value); });
  $("btn-nuevo-mes").addEventListener("click", function () {
    var ks = monthKeys();
    var next = addMonths(ks[ks.length - 1], 1);
    $("f-nuevo-mes").value = next;
    $("mes-free-warn").hidden = hasPremium();
    if (!hasPremium()) $("mes-free-warn").textContent = ks.length >= MESES_GRATIS ?
      "En la versión gratis se guardan tus últimos " + MESES_GRATIS + " meses: al crear este, se borra " + monthLabel(ks[0]).toLowerCase() + ". Con Premium guardas todo tu historial." :
      "En la versión gratis guardas hasta " + MESES_GRATIS + " meses. Te " + (MESES_GRATIS - ks.length === 1 ? "queda 1 mes libre." : "quedan " + (MESES_GRATIS - ks.length) + " meses libres.") + " Con Premium guardas todo tu historial.";
    $("mes-status").textContent = "";
    $("btn-borrar-mes").hidden = ks.length < 2;
    $("btn-borrar-mes").textContent = "Eliminar " + monthLabel(state.mes).toLowerCase();
    borrarArmed = false;
    openDlg("dlg-mes", "#f-nuevo-mes");
  });
  $("btn-crear-mes").addEventListener("click", function () {
    var k = $("f-nuevo-mes").value;
    if (!validKey(k)) { $("mes-status").textContent = "Elige un mes válido."; return; }
    if (state.meses[k]) { $("mes-status").textContent = "Ese mes ya existe. Elígelo en el selector de meses."; return; }
    var src = cur(), m = { ingresos: [], gastos: [] };
    if ($("f-copiar").checked) {
      m.ingresos = src.ingresos.map(function (r) { return { id: rid("i"), concepto: r.concepto, plan: r.plan, real: 0 }; });
      m.gastos = src.gastos.map(function (r) { return { id: rid("g"), concepto: r.concepto, cat: r.cat, dia: r.dia, plan: r.plan, real: 0 }; });
    }
    state.meses[k] = m; state.mes = k;
    if (!hasPremium()) {   // la versión gratis conserva los últimos meses
      var todas = monthKeys().filter(function (x) { return x !== k; });
      while (todas.length >= MESES_GRATIS) delete state.meses[todas.shift()];
    }
    changed(); closeDlg("dlg-mes"); renderAll();
  });
  var borrarArmed = false;
  $("btn-borrar-mes").addEventListener("click", function () {
    var ks = monthKeys(); if (ks.length < 2) return;
    if (!borrarArmed) { borrarArmed = true; this.textContent = "¿Seguro? Se borra " + monthLabel(state.mes).toLowerCase() + ". Haz clic otra vez"; return; }
    delete state.meses[state.mes];
    ks = monthKeys(); state.mes = ks[ks.length - 1];
    changed(); closeDlg("dlg-mes"); renderAll();
  });

  // Poner en cero, con confirmación en dos clics
  var zeroBtn = $("btn-zero"), zeroArmed = false, zeroTimer;
  zeroBtn.addEventListener("click", function () {
    if (!zeroArmed) {
      zeroArmed = true; zeroBtn.textContent = "¿Seguro? Haz clic otra vez";
      zeroTimer = setTimeout(function () { zeroArmed = false; zeroBtn.textContent = "Poner montos en cero"; }, 4000);
      return;
    }
    clearTimeout(zeroTimer);
    cur().ingresos.forEach(function (r) { r.plan = 0; r.real = 0; });
    cur().gastos.forEach(function (r) { r.plan = 0; r.real = 0; });
    state.cuentas.forEach(function (c) { c.saldo = 0; c.cupo = 0; });
    state.porPagar.forEach(function (b) { b.monto = 0; b.pagos = {}; });
    state.ejemplo = false;
    renderAll(); changed();
  });

  // ===================== Categorías propias =====================
  $("btn-cats").addEventListener("click", function () {
    if (!hasPremium()) { openPremium("Las categorías propias son parte de Premium."); return; }
    renderCats(); openDlg("dlg-cats", "#f-cat-nombre");
  });
  function renderCats() {
    $("cat-base").innerHTML = BASE_CATS.map(function (c) { return "<span>" + esc(c.name) + "</span>"; }).join("");
    $("cat-rows").innerHTML = state.categorias.length ? state.categorias.map(function (c) {
      var ic = iconoDeCat(c.id), abierta = iconoAbierto === c.id;
      return '<div class="cat-row' + (abierta ? " con-iconos" : "") + '" data-id="' + esc(c.id) + '" style="--c:' + catColor(c.id) + '"><button type="button" class="cat-ic-btn" data-iconos aria-expanded="' + abierta + '" aria-label="Ícono de ' + esc(c.name) + '"><svg class="ic"><use href="#c-' + ic + '"/></svg></button><input class="field" data-f="name" value="' + esc(c.name) + '" maxlength="40" aria-label="Nombre">' +
        '<select data-f="group" aria-label="Tipo">' + ["nec", "gus", "aho"].map(function (g) { return '<option value="' + g + '"' + (g === c.group ? " selected" : "") + ">" + GROUP_NAME[g] + "</option>"; }).join("") + "</select>" + delBtn(c.name) +
        (abierta ? '<div class="cat-iconos" role="radiogroup" aria-label="Elige el ícono">' + ICONOS_PROPIOS.map(function (x) {
          return '<button type="button" role="radio" aria-checked="' + (x[0] === ic) + '" data-icono="' + x[0] + '" aria-label="' + x[1] + '" title="' + x[1] + '"><svg class="ic"><use href="#c-' + x[0] + '"/></svg></button>';
        }).join("") + "</div>" : "") + "</div>";
    }).join("") : '<p class="empty">Aún no has creado categorías.</p>';
  }
  $("btn-cat-add").addEventListener("click", addCat);
  $("f-cat-nombre").addEventListener("keydown", function (e) { if (e.key === "Enter") addCat(); });
  function addCat() {
    var n = $("f-cat-nombre").value.trim();
    if (!n) { $("f-cat-nombre").focus(); return; }
    if (state.categorias.length >= 40) return;
    state.categorias.push({ id: rid("c_"), name: n.slice(0, 40), group: $("f-cat-grupo").value, ic: adivinarIcono(n) });
    $("f-cat-nombre").value = "";
    changed(); renderCats(); renderGastos(); recompute();
  }
  $("cat-rows").addEventListener("input", function (e) {
    var row = e.target.closest(".cat-row"); if (!row) return;
    var c = state.categorias.find(function (x) { return x.id === row.dataset.id; }); if (!c) return;
    if (e.target.dataset.f === "name") c.name = e.target.value.slice(0, 40) || "Sin nombre";
    if (e.target.dataset.f === "group") c.group = e.target.value;
    changed(); renderGastos(); recompute();
  });
  $("cat-rows").addEventListener("change", function (e) { if (e.target.tagName === "SELECT") e.target.dispatchEvent(new Event("input", { bubbles: true })); });
  var iconoAbierto = "";
  $("cat-rows").addEventListener("click", function (e) {
    var t = e.target.closest("[data-iconos]");
    if (t) { var rid0 = t.closest(".cat-row").dataset.id; iconoAbierto = iconoAbierto === rid0 ? "" : rid0; renderCats(); var nb = document.querySelector('#cat-rows .cat-row[data-id="' + rid0 + '"] ' + (iconoAbierto ? '[aria-checked="true"]' : "[data-iconos]")); if (nb) nb.focus(); return; }
    var ib = e.target.closest("[data-icono]");
    if (ib) { var cc = state.categorias.find(function (x) { return x.id === ib.closest(".cat-row").dataset.id; }); if (cc) { cc.ic = ib.dataset.icono; iconoAbierto = ""; changed(); renderCats(); renderAll(); sonar("gota"); } return; }
    var b = e.target.closest("[data-del]"); if (!b) return;
    var id = b.closest(".cat-row").dataset.id;
    state.categorias = state.categorias.filter(function (c) { return c.id !== id; });
    Object.keys(state.meses).forEach(function (k) { state.meses[k].gastos.forEach(function (r) { if (r.cat === id) r.cat = "otros"; }); });
    changed(); renderCats(); renderGastos(); recompute();
  });

  // ===================== Excel =====================
  function sheetRows() {
    var rows = [["Tipo", "Concepto", "Categoría", "Día de pago", "Planeado", "Real", "Diferencia"]];
    cur().ingresos.forEach(function (r) { rows.push(["Ingreso", r.concepto, "", "", r.plan, r.real, r.real - r.plan]); });
    cur().gastos.forEach(function (r) { rows.push(["Gasto", r.concepto, (catById(r.cat) || {}).name || "", r.dia || "", r.plan, r.real, r.plan - r.real]); });
    return rows;
  }
  $("btn-copy").addEventListener("click", function () {
    var btn = this, lbl = btn.querySelector("span") || btn, text = sheetRows().map(function (r) { return r.join("\t"); }).join("\n");
    function done(msg) { lbl.textContent = msg; setTimeout(function () { lbl.textContent = "Copiar para Excel"; }, 2200); }
    try { navigator.clipboard.writeText(text).then(function () { done("Copiado ✓"); }, function () { done("No se pudo copiar"); }); }
    catch (e) { done("No se pudo copiar"); }
  });
  // ===================== Excel avanzado (plantilla con fórmulas y gráficos) =====================
  // La plantilla trae una fila prototipo por tabla (fila 5; en el Panel, la 76). Se clona por cada dato,
  // se ajustan las tablas y se reemplazan las filas centinela de los gráficos ($991–$994) por la última fila real.
  var jszipLoading = null;
  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (jszipLoading) return jszipLoading;
    jszipLoading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      // En el sitio propio la librería se sirve desde el mismo dominio (no depende de otro servidor).
      s.src = WEB ? "/vendor/jszip-3.10.1.min.js" : "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = function () { window.JSZip ? resolve(window.JSZip) : reject(new Error("jszip")); };
      s.onerror = function () { jszipLoading = null; reject(new Error("jszip")); };
      document.head.appendChild(s);
    });
    return jszipLoading;
  }
  function xmlEsc(v) { return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function shiftFormula(f, delta) {
    if (!delta) return f;
    return f.replace(/("(?:[^"]|"")*"|'(?:[^']|'')*')|(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\d(])/g, function (m, q, d1, col, d2, row) {
      if (q || d2) return m;
      return d1 + col + (+row + delta);
    });
  }
  function cellXml(ref, s, v) {
    var sa = s ? ' s="' + s + '"' : "";
    if (v === null || v === undefined || v === "") return '<c r="' + ref + '"' + sa + "/>";
    if (typeof v === "number" && isFinite(v)) return '<c r="' + ref + '"' + sa + "><v>" + v + "</v></c>";
    return '<c r="' + ref + '"' + sa + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v) + "</t></is></c>";
  }
  function fillRows(xml, protoRow, rows) {
    var m = new RegExp('<row r="' + protoRow + '"([^>]*)>([\\s\\S]*?)</row>').exec(xml);
    if (!m) throw new Error("fila prototipo " + protoRow);
    var rowAttrs = m[1].replace(/\s+spans="[^"]*"/, "");   // conserva la altura de la fila (las filas sin altura quedan ocultas en el Panel)
    var cells = [], re = /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, c;
    while ((c = re.exec(m[2]))) {
      var s = /\ss="(\d+)"/.exec(c[2]), f = c[3] ? /<f>([\s\S]*?)<\/f>/.exec(c[3]) : null;
      cells.push({ col: c[1], s: s ? s[1] : null, f: f ? f[1] : null });
    }
    var out = rows.map(function (vals, i) {
      var r = protoRow + i;
      return '<row r="' + r + '"' + rowAttrs + '>' + cells.map(function (cell, ci) {
        var v = vals[ci];
        if (cell.f && v === undefined) return '<c r="' + cell.col + r + '"' + (cell.s ? ' s="' + cell.s + '"' : "") + "><f>" + shiftFormula(cell.f, i) + "</f></c>";
        return cellXml(cell.col + r, cell.s, v);
      }).join("") + "</row>";
    }).join("");
    return xml.replace(m[0], out);
  }
  function setCell(xml, ref, v) {
    var re = new RegExp('<c r="' + ref + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)');
    return xml.replace(re, function (all, attrs) {
      var s = /\ss="(\d+)"/.exec(attrs);
      return cellXml(ref, s ? s[1] : null, v);
    });
  }
  function setDimension(xml, end) { return xml.replace(/(<dimension ref="[A-Z]+\d+:[A-Z]+)\d+("\/>)/, "$1" + end + "$2"); }
  function setTableEnd(xml, end) { return xml.replace(/ref="([A-Z]+\d+):([A-Z]+)\d+"/g, 'ref="$1:$2' + end + '"'); }
  function dateSerial(k) { var p = parseKey(k); return (Date.UTC(p.y, p.m - 1, 1) - Date.UTC(1899, 11, 30)) / 86400000; }

  // Ubica cada hoja (y su tabla) por nombre, sin depender del número de archivo
  function hojasPorNombre(zip) {
    function abs(base, t) { var parts = (t.charAt(0) === "/" ? t.slice(1) : base + t).split("/"), out = []; parts.forEach(function (p) { if (p === "..") out.pop(); else if (p && p !== ".") out.push(p); }); return out.join("/"); }
    return Promise.all([zip.file("xl/workbook.xml").async("string"), zip.file("xl/_rels/workbook.xml.rels").async("string")]).then(function (r) {
      var rels = {}, m, re = /<Relationship\b[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g, re2 = /<Relationship\b[^>]*?Target="([^"]+)"[^>]*?Id="([^"]+)"/g;
      while ((m = re.exec(r[1]))) rels[m[1]] = m[2];
      while ((m = re2.exec(r[1]))) rels[m[2]] = m[1];
      var out = {}, sr = /<sheet\b[^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"/g, list = [];
      while ((m = sr.exec(r[0]))) list.push({ name: m[1].replace(/&amp;/g, "&"), path: abs("xl/", rels[m[2]]) });
      return Promise.all(list.map(function (h) {
        out[h.name] = { path: h.path, table: null };
        var rp = h.path.replace(/([^/]+)$/, "_rels/$1.rels"), f = zip.file(rp);
        if (!f) return;
        return f.async("string").then(function (x) { var t = /Target="([^"]*tables\/table\d+\.xml)"/.exec(x); if (t) out[h.name].table = abs(h.path.replace(/[^/]+$/, ""), t[1]); });
      })).then(function () { return out; });
    });
  }

  function buildWorkbook(JSZip) {
    var b64 = document.getElementById("xlsx-template").textContent.replace(/\s+/g, "");
    return JSZip.loadAsync(b64, { base64: true }).then(function (zip) {
      var ks = monthKeys();
      var allCats = BASE_CATS.concat(state.categorias), orden = [];
      var mov = [], used = {}, usedOrder = [];
      ks.forEach(function (k) {
        var m = state.meses[k], d = dateSerial(k);
        m.ingresos.forEach(function (r) { mov.push([d, "Ingreso", r.concepto, "", "", r.plan, r.real]); });
        m.gastos.forEach(function (r) {
          var c = catById(r.cat) || BASE_CATS[10];
          mov.push([d, "Gasto", r.concepto, c.name, r.dia || "", r.plan, r.real]);
          if (!used[c.id]) { used[c.id] = 1; }
        });
      });
      // Categorías del Panel: las usadas, ordenadas por gasto real del mes que se está viendo
      var tm = totalsOf(cur());
      orden = allCats.filter(function (c) { return used[c.id]; });
      if (!orden.length) orden = BASE_CATS.slice();
      orden.sort(function (a, b) {
        var x = tm.byCat[a.id] || { real: 0, plan: 0 }, y = tm.byCat[b.id] || { real: 0, plan: 0 };
        return (y.real - x.real) || (y.plan - x.plan);
      });
      usedOrder = orden.map(function (c) { return [c.name]; });
      if (!mov.length) mov = [["", "", "", "", "", "", ""]];
      var cat = allCats.map(function (c) { return [c.name, GROUP_NAME[c.group]]; });
      var hist = ks.map(function (k) { return [dateSerial(k)]; });
      var metas = state.metas.map(function (g) { return [g.nombre, g.objetivo, g.ahorrado, g.fecha ? dateSerial(g.fecha) : ""]; });
      if (!metas.length) metas = [["", "", "", ""]];
      var deudas = state.deudas.map(function (d) { return [d.nombre, d.saldo, d.tasa / 100, d.cuota]; });
      if (!deudas.length) deudas = [["", "", "", ""]];
      var notas = [];   // una fila por mes, con todas las ideas del mes en la misma celda
      ks.forEach(function (k) {
        var lineas = String(state.meses[k].notas || "").split(/\n+/).map(function (t) { return t.trim(); }).filter(Boolean);
        var tipos = leerNotas(state.meses[k].notas).map(function (x) { return x.tipo; }).filter(function (t) { return t !== "nota"; });
        if (lineas.length) notas.push([dateSerial(k), tipos.length ? TIPOS_NOTA[tipos[0]].n : "", lineas.map(function (t) { return "• " + t; }).join("\n")]);
      });
      if (!notas.length) notas = [["", "", ""]];

      // Cuentas por pagar y cuentas de dinero
      var hoyD = d0();
      var pagos = state.porPagar.map(function (b) {
        var c = catById(b.cat) || BASE_CATS[10], f = parseD(b.fecha);
        return [b.nombre, b.monto, b.f === "mensual" ? "Mensual" : b.f === "anual" ? "Anual" : "Una vez", b.f === "mensual" ? b.dia : "",
          f ? (Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()) - Date.UTC(1899, 11, 30)) / 864e5 : "", b.aviso, b.pagos[keyDe(b, hoyD)] || estadoPago(b, hoyD).key > keyDe(b, hoyD) ? "Sí" : "No",
          undefined, undefined, undefined, c.name];
      });
      if (!pagos.length) pagos = [["", "", "", "", "", "", "", undefined, undefined, undefined, ""]];
      var cuentas = state.cuentas.map(function (c) { return [c.nombre, tipoCuenta(c.tipo).name, c.saldo, c.tipo === "tarjeta" && c.cupo ? c.cupo : ""]; });
      if (!cuentas.length) cuentas = [["", "", "", ""]];
      var r0 = simRacha(), m0 = rachaMeses();
      var rachaTxt = state.ejemplo ? "" : "Racha: " + plural(r0.actual, "día") + " · Ahorrando: " + m0.actual + (m0.actual === 1 ? " mes" : " meses") + " · Logros: " + state.logros.length + " de " + LOGROS.length;

      var jobs = [
        { name: "Panel", proto: 76, rows: usedOrder, extra: function (x) { x = setCell(x, "B3", state.titulo || "Mi presupuesto"); x = setCell(x, "F3", rachaTxt); return setCell(x, "C6", dateSerial(state.mes)); } },
        { name: "Movimientos", proto: 5, rows: mov },
        { name: "Pagos", proto: 5, rows: pagos },
        { name: "Cuentas", proto: 5, rows: cuentas },
        { name: "Categorías", proto: 5, rows: cat },
        { name: "Historial", proto: 5, rows: hist },
        { name: "Metas", proto: 5, rows: metas },
        { name: "Deudas", proto: 5, rows: deudas },
        { name: "Notas", proto: 5, rows: notas }
      ];
      var ends = {};
      return hojasPorNombre(zip).then(function (hojas) { return Promise.all(jobs.map(function (j) {
        var h = hojas[j.name]; if (!h) throw new Error("hoja " + j.name);
        var sp = h.path, end = j.proto + j.rows.length - 1;
        ends[j.name] = end;
        return zip.file(sp).async("string").then(function (x) {
          x = fillRows(x, j.proto, j.rows);
          x = setDimension(x, end);
          if (j.extra) x = j.extra(x);
          zip.file(sp, x);
          if (!h.table) return;
          return zip.file(h.table).async("string").then(function (t) { zip.file(h.table, setTableEnd(t, end)); });
        });
      })); }).then(function () {
        var sentinel = { "$991": ends.Panel, "$992": ends.Historial, "$993": ends.Metas, "$994": ends.Deudas };
        var charts = zip.file(/^xl\/charts\/chart\d+\.xml$/);
        return Promise.all(charts.map(function (f) {
          return f.async("string").then(function (x) {
            Object.keys(sentinel).forEach(function (k) { x = x.split(k + "<").join("$" + sentinel[k] + "<"); });
            // Dona: cada porción con el color de su categoría, igual que en la app
            x = x.replace(/A000(\d\d)/g, function (m, i) {
              var c = orden[+i];
              return c ? catColor(c.id).replace("#", "").toUpperCase() : "ADB5BD";
            });
            zip.file(f.name, x);
          });
        }));
      }).then(function () {
        return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      });
    });
  }
  window.__buildWorkbook = function () { return loadJSZip().then(buildWorkbook); }; // usado en pruebas

  $("btn-xlsx").addEventListener("click", function () {
    if (!hasPremium()) { openPremium("Descargar en Excel es parte de Premium."); return; }
    var btn = this, lbl = btn.querySelector("span") || btn, label = lbl.textContent;
    function done(msg) { lbl.textContent = msg; setTimeout(function () { lbl.textContent = label; }, 2600); }
    if (WEB) {
      btn.disabled = true; lbl.textContent = "Preparando…";
      loadJSZip().then(buildWorkbook).then(function (buf) {
        descargar(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "finti-" + state.mes + ".xlsx");
        done("Descargado ✓");
      }, function () { done("No se pudo descargar"); }).then(function () { btn.disabled = false; });
      return;
    }
    if (!claudeApi || typeof claudeApi.use !== "function") { done("Abre la página desde Claude"); return; }
    btn.disabled = true; lbl.textContent = "Preparando…";
    Promise.all([loadJSZip(), claudeApi.use("downloads")]).then(function (r) {
      if (!r[1]) throw { code: "unavailable" };
      return buildWorkbook(r[0]).then(function (buf) {
        return r[1].save({ filename: "finti-" + state.mes + ".xlsx", data: buf });
      });
    }).then(function () { done("Descargado ✓"); }, function (err) {
      var c = err && err.code;
      done(c === "declined" ? "Descarga cancelada" : c === "unavailable" || c === "not_granted" ? "No disponible aquí" : "No se pudo descargar");
    }).then(function () { btn.disabled = false; });
  });

  // ===================== Colores =====================
  var LOCK = '<svg width="10" height="11" viewBox="0 0 10 11" aria-hidden="true"><rect x="1" y="5" width="8" height="6" rx="1.5" fill="currentColor"/><path d="M3 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>';
  // --- Paleta de la persona: un color por categoría, con aviso si dos se parecen demasiado ---
  var MUESTRAS = ["#7c5cff", "#4d7cfe", "#38bdf8", "#22d3ee", "#19c3a0", "#2fbf71", "#9bd84a", "#c6f432", "#ffc53d", "#ff9f1c", "#ff7a59", "#ff5c9a", "#b06bff", "#8e8aa0"], catColAbierta = "";
  function aLab(hex) {
    var c = [1, 3, 5].map(function (i) { var v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    var x = (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047, y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722, z = (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883;
    var f = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }
  function distColor(a, b) { var p = aLab(a), q = aLab(b); return Math.sqrt(Math.pow(p[0] - q[0], 2) + Math.pow(p[1] - q[1], 2) + Math.pow(p[2] - q[2], 2)); }
  function parecidos() {
    var l = cats(), out = [];
    var p = state.prefs.catColores || {};   // solo se avisa si al menos uno de los dos lo eligió la persona
    for (var i = 0; i < l.length; i++) for (var j = i + 1; j < l.length; j++) if ((p[l[i].id] || p[l[j].id]) && distColor(catColor(l[i].id), catColor(l[j].id)) < 22) out.push([l[i], l[j]]);
    return out;
  }
  function renderCatColores() {
    var propios = state.prefs.catColores || {};
    $("catcol").innerHTML = cats().map(function (c) {
      var col = catColor(c.id), abierta = catColAbierta === c.id;
      return '<div class="catcol-fila' + (abierta ? " abierta" : "") + '" style="--c:' + col + '"><button type="button" class="catcol-b" data-catcol="' + esc(c.id) + '" aria-expanded="' + abierta + '">' +
        '<span>' + esc(c.name) + '</span><i class="catcol-m" aria-hidden="true"></i></button>' +
        (abierta ? '<div class="catcol-muestras" role="radiogroup" aria-label="Color de ' + esc(c.name) + '">' + MUESTRAS.map(function (m) {
          return '<button type="button" role="radio" aria-checked="' + (m === col) + '" data-muestra="' + m + '" style="--m:' + m + '" aria-label="Color ' + m + '"></button>';
        }).join("") + "</div>" : "") + "</div>";
    }).join("");
    var par = parecidos();
    $("catcol-aviso").hidden = !par.length;
    $("catcol-aviso").innerHTML = par.length ? "<span><b>" + esc(par[0][0].name) + "</b> y <b>" + esc(par[0][1].name) + "</b> se parecen mucho. Cambia uno de los dos para que se distingan en el anillo y las gráficas.</span>" : "";
    $("catcol-reset").hidden = !Object.keys(propios).length;
  }
  $("catcol").addEventListener("click", function (e) {
    var m = e.target.closest("[data-muestra]");
    if (m) {
      state.prefs.catColores = state.prefs.catColores || {};
      if (CAT_COLOR[catColAbierta] === m.dataset.muestra) delete state.prefs.catColores[catColAbierta]; else state.prefs.catColores[catColAbierta] = m.dataset.muestra;
      changed(); renderCatColores(); renderAll(); sonar("nota", MUESTRAS.indexOf(m.dataset.muestra)); return;
    }
    var b = e.target.closest("[data-catcol]"); if (!b) return;
    catColAbierta = catColAbierta === b.dataset.catcol ? "" : b.dataset.catcol; renderCatColores();
  });
  $("catcol-reset").addEventListener("click", function () { state.prefs.catColores = {}; catColAbierta = ""; changed(); renderCatColores(); renderAll(); });
  function aplicarLetra() { root.classList.toggle("letra-grande", !!state.prefs.letraGrande); }
  $("f-letra").addEventListener("change", function () { state.prefs.letraGrande = this.checked; aplicarLetra(); changed(); setTimeout(ajustarCifras, 50); });
  $("f-sonidos").addEventListener("change", function () { state.prefs.sonidos = this.checked; changed(); if (this.checked) sonar("monedas"); });
  function renderThemeGrid() {
    var dark = resolvedDark(), current = activeTema(), prem = hasPremium();
    $("theme-grid").innerHTML = THEMES.map(function (t) {
      var c = t[dark ? "dark" : "light"], locked = t.premium && !prem;
      var tag = t.premium ? '<span class="chip premium">' + (locked ? LOCK + " " : "") + "Premium</span>" : '<span class="chip free">Gratis</span>';
      return '<button type="button" class="theme-card" data-tema="' + t.id + '" aria-pressed="' + (current === t.id) + '">' +
        '<span class="swatch"><span class="sw-bg" style="background:' + c.bg + '"><span class="sw-line" style="background:' + c.ink + ';width:70%"></span><span class="sw-line" style="background:' + c.line + '"></span><span class="sw-line" style="background:' + c.muted + ';width:50%"></span></span>' +
        '<span class="sw-accent" style="background:' + c.surface + '"><span class="sw-dot" style="background:' + c.accent + '"></span></span></span>' +
        '<span class="theme-name"><span>' + esc(t.name) + " </span>" + tag + (locked ? '<span class="sr-only">, bloqueado</span>' : "") + "</span></button>";
    }).join("");
    Array.prototype.forEach.call($("seg-modo").querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.modo === state.prefs.modo)); });
    $("chip-propio").innerHTML = (prem ? "" : LOCK + " ") + "Premium";
    $("f-acento").value = previewAcento || state.prefs.acento;
    $("preview-note").hidden = !(previewTema && !prem);
    $("colores-upsell").hidden = prem;
  }
  $("btn-colores").addEventListener("click", function () { renderThemeGrid(); catColAbierta = ""; renderCatColores(); $("f-sonidos").checked = state.prefs.sonidos !== false; $("f-letra").checked = !!state.prefs.letraGrande; $("f-temporada").checked = state.prefs.temporada !== false; openDlg("dlg-colores", '#theme-grid [aria-pressed="true"]'); });
  onCloseHooks["dlg-colores"] = function () { if (previewTema || previewAcento) { previewTema = null; previewAcento = null; applyTheme(); } };
  $("theme-grid").addEventListener("click", function (e) {
    var b = e.target.closest("[data-tema]"); if (!b) return;
    var t = THEME_BY_ID[b.dataset.tema];
    if (t.premium && !hasPremium()) { previewTema = t.id; previewAcento = null; applyTheme(); renderThemeGrid(); return; }
    previewTema = null; previewAcento = null;
    if (state.prefs.tema !== t.id) { state.prefs.tema = t.id; changed(); }
    applyTheme(); renderThemeGrid();
  });
  $("seg-modo").addEventListener("click", function (e) {
    var b = e.target.closest("[data-modo]"); if (!b) return;
    if (state.prefs.modo !== b.dataset.modo) { state.prefs.modo = b.dataset.modo; changed(); }
    applyTheme(); renderThemeGrid(); renderHist();
  });
  var acentoTimer = null;
  $("f-acento").addEventListener("input", function () {
    var v = this.value;
    if (!hasPremium()) { previewAcento = v; previewTema = "personal"; applyTheme(); $("preview-note").hidden = false; return; }
    state.prefs.acento = v; state.prefs.tema = "personal"; previewTema = null; previewAcento = null;
    applyTheme();
    clearTimeout(acentoTimer); acentoTimer = setTimeout(function () { changed(); renderThemeGrid(); }, 250);
  });

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


  // ===================== v4 · Experiencia Finti =====================
  var IA_ON = true;   // el asesor funciona con reglas en el dispositivo (no depende de Claude)
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  // Colores de identidad (Finti): cada categoría tiene el suyo y se reconoce en toda la app.
  var CAT_COLOR = { vivienda: "#7c5cff", servicios: "#38bdf8", alimentacion: "#ff7a59", transporte: "#19c3a0", salud: "#9bd84a", educacion: "#4d7cfe",
    deudas: "#ff9f1c", ocio: "#ff5c9a", compras: "#b06bff", suscripciones: "#2fbf71", otros: "#8e8aa0", ahorro: "#ffc53d" };
  var EXTRA_COLORS = ["#ff6b4a", "#22d3ee", "#ffb020", "#f472b6", "#c6f432", "#a78bfa", "#00b386", "#3b5bff"];
  function catColor(id) {
    var propio = state && state.prefs && state.prefs.catColores && state.prefs.catColores[id]; if (propio) return propio;
    if (CAT_COLOR[id]) return CAT_COLOR[id];
    var i = state.categorias.findIndex(function (c) { return c.id === id; });
    return EXTRA_COLORS[(i < 0 ? 0 : i) % EXTRA_COLORS.length];
  }
  // --- Resorte al tocar: se hunde un poco al presionar y rebota al soltar. Respeta "reducir movimiento". ---
  (function () {
    if (reduceMotion || !Element.prototype.animate) return;
    var SEL = "button, .btn, [role='button'], .chip-btn", activo = null, presion = null;
    root.setAttribute("data-resorte", "");
    document.addEventListener("pointerdown", function (e) {
      var b = e.target && e.target.closest ? e.target.closest(SEL) : null;
      if (!b || b.disabled || b.closest("[data-sin-resorte]")) return;
      var hondo = b.getBoundingClientRect().width > 240 ? 0.98 : 0.94;
      activo = b; presion = b.animate([{ transform: "scale(1)" }, { transform: "scale(" + hondo + ")" }], { duration: 110, easing: "ease-out", fill: "forwards" });
      activo._hondo = hondo;
    }, { passive: true });
    function soltar() {
      var b = activo; if (!b) return; activo = null;
      if (presion) { presion.cancel(); presion = null; }
      var h = b._hondo || 0.94;
      b.animate([{ transform: "scale(" + h + ")" }, { transform: "scale(" + (h < 0.95 ? 1.03 : 1.01) + ")", offset: 0.55 }, { transform: "scale(1)" }],
        { duration: 420, easing: "cubic-bezier(.34,1.56,.64,1)" });
    }
    document.addEventListener("pointerup", soltar, { passive: true });
    document.addEventListener("pointercancel", soltar, { passive: true });
  })();
  // Íconos para las categorías propias: la persona elige uno o se adivina por el nombre
  var ICONOS_PROPIOS = [["mascotas", "Mascotas", /perr|gat|mascot|veterin|concentrad|purina/], ["viajes", "Viajes y paseos", /viaj|paseo|vacacion|playa|hotel|tiquete|vuelo/],
    ["regalos", "Regalos", /regal|detalle|cumple(?!a)/], ["belleza", "Belleza y peluquería", /bellez|pelu|uñas|manicur|barber|maquilla|spa/],
    ["gimnasio", "Gimnasio y deporte", /gym|gimnas|deport|fútbol|futbol|crossfit|yoga|bici/], ["hijos", "Hijos y familia", /hij|niñ|familia|colegio de|mesada/],
    ["cafe", "Café y antojos", /caf[eé]|antoj|tinto|panader|onces|snack|mecato/], ["gasolina", "Gasolina", /gasolin|combustib|tanque|acpm/],
    ["tecnologia", "Tecnología", /tecno|computa|portátil|portatil|gadget|software|app/], ["ropa", "Ropa y zapatos", /ropa|zapat|tenis|vestu/],
    ["impuestos", "Impuestos", /impuest|predial|dian|renta|vehicular|4x1000/], ["seguros", "Seguros", /segur|soat|póliza|poliza/],
    ["donaciones", "Donaciones y ofrendas", /donaci|ofrend|diezm|caridad|fundaci/], ["juegos", "Videojuegos", /jueg|play|xbox|nintendo|steam/],
    ["musica", "Música", /músic|music|concierto|instrument/], ["libros", "Libros y cursos", /libro|curso|lectura|kindle/],
    ["carro", "Carro", /carro|vehícul|vehicul|moto|taller|peaje|lavadero/], ["arreglos", "Arreglos de la casa", /arregl|mantenim|ferreter|pintur|reparaci/],
    ["domicilios", "Domicilios", /domicil|rappi|pedido|envío|envio/], ["parqueadero", "Parqueadero", /parque|parking/],
    ["farmacia", "Droguería", /droguer|farmac|medica|pastill/], ["trabajo", "Trabajo", /trabaj|oficina|negocio|cliente/],
    ["celular", "Celular", /celular|plan de datos|recarga/], ["bebe", "Bebé", /beb[eé]|pañal|panal|tetero/],
    ["lavanderia", "Lavandería", /lavander|lavado de ropa|tintorer/], ["fiesta", "Celebraciones", /fiesta|celebra|aniversar|matrimonio|boda|navidad/],
    ["compras", "Compras", /compra/], ["salud", "Salud", /salud|médic|medic|odonto|psic/], ["educacion", "Educación", /educa|universi|semestre|matrícula/],
    ["ocio", "Salidas", /salid|rumba|cine|bar\b/], ["ahorro", "Ahorro", /ahorr|inversi|cdt/], ["propia", "Etiqueta", /^$/]];
  var ICONO_VALIDO = {}; ICONOS_PROPIOS.forEach(function (x) { ICONO_VALIDO[x[0]] = 1; });
  function adivinarIcono(nombre) {
    var n = String(nombre || "").toLowerCase();
    for (var i = 0; i < ICONOS_PROPIOS.length; i++) if (ICONOS_PROPIOS[i][2].test(n)) return ICONOS_PROPIOS[i][0];
    return "propia";
  }
  function iconoDeCat(id) {
    if (CAT_COLOR[id]) return id;
    var c = catById(id); return c && ICONO_VALIDO[c.ic] ? c.ic : c ? adivinarIcono(c.name) : "propia";
  }
  // Identidad Finti: cada categoría es una "ficha" con el mismo lenguaje del logo (trazo redondeado sobre su color,
  // con grosor de tecla). Nada de objetos sueltos: así toda la app se reconoce como Finti. El oro solo aparece en lo que crece.
  var CON_3D = document.documentElement.getAttribute("data-edition") === "web";
  var CRECE = { ahorro: 1, ingreso: 1, meta: 1 };
  function tintaFicha(col) { return /^#[0-9a-f]{6}$/i.test(col) ? tintaPara(col) : "#fff"; }
  function ficha(icono, col, extra) {
    return '<span class="cat-ic ficha' + (CRECE[icono] ? " crece" : "") + (extra ? " " + extra : "") + '" style="--c:' + col + ";--t:" + tintaFicha(col) + '"><svg class="ic" aria-hidden="true"><use href="#c-' + icono + '"/></svg></span>';
  }
  function catIcon(id) { return ficha(iconoDeCat(id), catColor(id)); }
  function ingIcon() { return ficha("ingreso", "#1f9d6a"); }

  // --- Cifras que caben: con la letra ancha de títulos, una cifra larga se encoge un poco en vez de salirse de su tarjeta ---
  var CIFRAS = ".tile .value, .hero-amount, .hoy-v, .stk b, .acct .bal, .donut-legend .ct-v";
  // Por velocidad, se ajustan en lote: primero se escribe, luego se mide todo de una vez (un solo cálculo de la página)
  // y al final se escriben los tamaños. Medir y escribir cifra por cifra obligaba a recalcular la página en cada una.
  function ajustarLote(l) {
    var i, med = [];
    for (i = 0; i < l.length; i++) l[i].style.fontSize = "";
    for (i = 0; i < l.length; i++) { var cw = l[i].clientWidth, sw = l[i].scrollWidth; med.push(cw && sw > cw + 1 ? [cw, sw, parseFloat(getComputedStyle(l[i]).fontSize)] : null); }
    for (i = 0; i < l.length; i++) if (med[i]) l[i].style.fontSize = Math.max(10, Math.floor(med[i][2] * med[i][0] / med[i][1] * 0.98)) + "px";
  }
  function ajustar(el) { ajustarLote([el]); }
  var colaAj = [], rafAj = 0;
  function pedirAjuste(el) {
    if (el._enCola) return; el._enCola = true; colaAj.push(el);
    // Mientras una cifra se anima cambia en cada cuadro: se espera a que se quede quieta y se ajusta una sola vez.
    clearTimeout(rafAj); rafAj = setTimeout(function () { rafAj = 0; var l = colaAj; colaAj = []; l.forEach(function (x) { x._enCola = false; }); ajustarLote(l); }, 140);
  }
  var obsTam = window.ResizeObserver ? new ResizeObserver(function (es) {
    es.forEach(function (e) { var w = Math.round(e.contentRect.width); if (w && w !== e.target._ancho) { e.target._ancho = w; pedirAjuste(e.target); } });
  }) : null;
  var obsTexto = window.MutationObserver ? new MutationObserver(function (ms) { ms.forEach(function (m) { var el = m.target.nodeType === 3 ? m.target.parentNode : m.target; if (el && el._cifra) pedirAjuste(el); }); }) : null;
  function ajustarCifras() {
    var l = [];
    Array.prototype.forEach.call(document.querySelectorAll(CIFRAS), function (el) {
      if (!el._cifra) { el._cifra = true; if (obsTam) obsTam.observe(el); if (obsTexto) obsTexto.observe(el, { childList: true, characterData: true, subtree: true }); }
      l.push(el);
    });
    ajustarLote(l);
  }
  try { document.fonts.ready.then(ajustarCifras); } catch (e) {}

  // --- Números animados ---
  function animateNumber(el, to, fmtFn) {
    var from = +el.dataset.v || 0;
    el.dataset.v = to;
    if (reduceMotion || from === to || !isFinite(from)) { el.textContent = fmtFn(to); return; }
    var t0 = performance.now(), dur = 650;
    if (el._raf) cancelAnimationFrame(el._raf);
    (function step(now) {
      var k = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmtFn(from + (to - from) * e);
      if (k < 1) el._raf = requestAnimationFrame(step);
    })(t0);
  }

  // --- Avisos ---
  function toast(html, opts) {
    opts = opts || {};
    var box = $("toasts"), el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = '<div class="tmsg">' + html + "</div>" + (opts.action ? '<button type="button">' + esc(opts.action) + "</button>" : "");
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    var gone = false;
    function close() { if (gone) return; gone = true; el.classList.add("out"); setTimeout(function () { el.remove(); }, 220); }
    if (opts.action) el.querySelector("button").addEventListener("click", function () { opts.onAction(); close(); });
    setTimeout(close, opts.ms || 4200);
    return close;
  }

  // --- Confeti ---
  // ===================== Sonidos y vibración por momento =====================
  // Se generan con Web Audio (no hay archivos de sonido) y siempre después de un toque. Se apagan en Colores y modo.
  var SON = { ctx: null, ult: {} };
  function sonCtx() {
    if (!SON.ctx) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return null; try { SON.ctx = new A(); } catch (e) { return null; } }
    if (SON.ctx.state === "suspended") try { SON.ctx.resume(); } catch (e) {}
    return SON.ctx;
  }
  function tono(c, f, t0, dur, vol, tipo, f2) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = tipo || "sine"; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function soplido(c, t0, dur, desde, hasta, vol) {
    var n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / n);
    var src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; bp.type = "bandpass"; bp.Q.value = 1.2; bp.frequency.setValueAtTime(desde, t0); bp.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
    g.gain.value = vol; src.connect(bp); bp.connect(g); g.connect(c.destination); src.start(t0);
  }
  var PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
  var VIBRA = { gota: [10], monedas: [8, 40, 8], meta: [20, 60, 20, 60, 40], cerca: [12, 90, 12], calma: [35], nota: [5] };
  function sonar(que, i) {
    if (!state || !state.prefs || state.prefs.sonidos === false || document.hidden) return;
    var ahora = Date.now(); if (SON.ult[que] && ahora - SON.ult[que] < 260) return; SON.ult[que] = ahora;   // varios a la vez (bandeja): uno solo
    if (VIBRA[que] && navigator.vibrate) try { navigator.vibrate(VIBRA[que]); } catch (e) {}
    var c = sonCtx(); if (!c) return;
    var t = c.currentTime + 0.01;
    if (que === "gota") { tono(c, 1250, t, 0.16, 0.16, "sine", 420); tono(c, 2400, t + 0.02, 0.05, 0.03, "sine"); }
    else if (que === "monedas") { [1568, 2093, 1760, 2349].forEach(function (f, k) { tono(c, f, t + k * 0.07, 0.22, 0.08, "triangle"); tono(c, f * 2.01, t + k * 0.07, 0.08, 0.02, "sine"); }); }
    else if (que === "meta") { [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach(function (f, k) { tono(c, f, t + k * 0.09, 0.42, 0.09, "triangle"); }); tono(c, 1567.98, t + 0.5, 0.7, 0.07, "sine"); }
    else if (que === "cerca") { tono(c, 880, t, 0.22, 0.07, "sine"); tono(c, 698.46, t + 0.2, 0.3, 0.07, "sine"); }
    else if (que === "calma") { [261.63, 329.63, 392].forEach(function (f, k) { tono(c, f, t + k * 0.05, 1.1, 0.05, "sine"); }); }
    else if (que === "soplo") soplido(c, t, 0.28, 500, 2400, 0.05);
    else if (que === "soplo-inv") soplido(c, t, 0.28, 2400, 500, 0.05);
    else if (que === "nota") tono(c, PENTA[(i || 0) % PENTA.length], t, 0.35, 0.07, "sine");
  }
  // Después de un gasto: la gota y, si la categoría va cerca del límite o se pasó, un aviso suave (nunca una alarma).
  function sonarGasto(cat) {
    sonar("gota");
    var t = totalsOf(cur()).byCat[cat]; if (!t || !(t.plan > 0)) return;
    var r = t.real / t.plan;
    setTimeout(function () { if (r > 1) sonar("calma"); else if (r >= 0.85) sonar("cerca"); }, 320);
  }
  function celebrar() {
    sonar("meta");
    if (reduceMotion) return;
    var cv = $("confetti"), ctx = cv.getContext && cv.getContext("2d"); if (!ctx) return;
    var W = cv.width = innerWidth * devicePixelRatio, H = cv.height = innerHeight * devicePixelRatio;
    var colors = ["#2e5bff", "#ffc53d", "#19c3a0", "#ff5c9a", "#38bdf8", "#ff7a59"];
    var ps = [];
    for (var i = 0; i < 160; i++) ps.push({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .55, vx: (Math.random() - .5) * 26 * devicePixelRatio, vy: (-Math.random() * 26 - 10) * devicePixelRatio,
      s: (6 + Math.random() * 7) * devicePixelRatio, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: colors[i % colors.length] });
    var t0 = performance.now();
    (function frame(now) {
      ctx.clearRect(0, 0, W, H);
      ps.forEach(function (p) { p.vy += 0.9 * devicePixelRatio; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (now - t0 < 2600) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    })(t0);
  }

  // --- Racha de días organizando la plata ---
  function hoyStr(d) { d = d || new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function marcarActividad() {
    var h = hoyStr();
    if (state.actividad[state.actividad.length - 1] !== h) { state.actividad.push(h); state.actividad = state.actividad.slice(-120); return true; }
    return false;
  }
  function racha() {
    var set = {}; state.actividad.forEach(function (d) { set[d] = 1; });
    var d = new Date(), n = 0;
    if (!set[hoyStr(d)]) d.setDate(d.getDate() - 1);
    while (set[hoyStr(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // --- Puntaje de salud financiera (0–100) ---
  function puntaje(t) {
    var ing = t.ingReal || t.ingPlan, tips = [], pts = 0;
    var tasa = ing > 0 ? t.ahorro / ing : 0;
    pts += Math.min(tasa / 0.2, 1) * 35;
    var conPlan = 0, ok = 0, excedidas = [];
    Object.keys(t.byCat).forEach(function (id) {
      var x = t.byCat[id], c = catById(id) || { name: "Otros", group: "gus" };
      if (!x.plan) return;
      conPlan++;
      if (c.group === "aho" ? x.real >= x.plan : x.real <= x.plan) ok++;
      else if (c.group !== "aho") excedidas.push({ c: c, sobre: x.real - x.plan, pct: x.real / x.plan - 1 });
    });
    pts += (conPlan ? ok / conPlan : 1) * 30;
    pts += t.saldo >= 0 ? 15 : 0;
    var cuotas = t.byCat.deudas ? t.byCat.deudas.real : 0, rd = ing > 0 ? cuotas / ing : 0;
    pts += rd <= 0.2 ? 20 : rd >= 0.5 ? 0 : (0.5 - rd) / 0.3 * 20;
    var score = Math.round(Math.max(0, Math.min(100, pts)));
    excedidas.sort(function (a, b) { return b.sobre - a.sobre; }).slice(0, 2).forEach(function (e) {
      tips.push({ cls: "bad", txt: esc(e.c.name) + " va " + money(e.sobre) + " por encima (" + pctf(e.pct) + ")." });
    });
    if (t.saldo < 0) tips.push({ cls: "bad", txt: "Este mes gastas " + money(-t.saldo) + " más de lo que te ingresa." });
    if (ing > 0 && tasa < 0.2) tips.push({ cls: "warn", txt: "Ahorra " + money(Math.ceil((0.2 * ing - t.ahorro) / 1000) * 1000) + " más para llegar al 20 %." });
    else if (ing > 0) tips.push({ cls: "good", txt: "Tu ahorro va en " + pctf(tasa) + ": ¡por encima de la meta!" });
    if (t.ingPlan > t.ingReal && t.ingReal > 0) tips.push({ cls: "warn", txt: "Te faltan " + money(t.ingPlan - t.ingReal) + " por recibir de ingresos." });
    if (!excedidas.length && conPlan) tips.unshift({ cls: "good", txt: "Todas tus categorías están dentro del plan." });
    var label = score >= 80 ? "Excelente" : score >= 65 ? "Buena" : score >= 45 ? "Mejorable" : "En riesgo";
    var cls = score >= 65 ? "ok" : score >= 45 ? "warn" : "bad";
    return { score: score, label: label, cls: cls, tips: tips.slice(0, 3) };
  }

  // --- Inicio: tarjeta principal, puntaje, dona y alertas ---
  var donutSel = null;
  // --- Hoy puedes gastar: lo que queda del día a día (gastos sin día fijo, sin ahorro) repartido en los días que faltan ---
  function hoyPuedes(t) {
    var hoy = new Date(), k = hoy.getFullYear() + "-" + ("0" + (hoy.getMonth() + 1)).slice(-2);
    if (state.mes !== k) return null;
    var flex = {}, P = 0, R = 0, H = 0, hs = hoyStr(hoy);
    cur().gastos.forEach(function (r) {
      if (r.dia || (catById(r.cat) || { group: "gus" }).group === "aho") return;
      flex[r.cat] = 1; P += r.plan; R += r.real;
    });
    state.movs.forEach(function (x) { if (x.f === hs && x.t === "g" && flex[x.cat]) H += x.m; });
    H = Math.min(H, R);
    var quedan = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate() - hoy.getDate() + 1;
    var base = Math.max(0, (P - (R - H)) / quedan);
    return { plan: P, base: base, hoyGasto: H, puede: base - H, quedan: quedan, resto: P - R };
  }
  function redondeoMil(v) { return (v < 0 ? -1 : 1) * Math.floor(Math.abs(v) / 1000) * 1000; }
  function renderHoy(t) {
    var h = hoyPuedes(t), card = $("hoy-card");
    card.hidden = !h;
    if (!h) return h;
    if (!h.plan) {
      card.removeAttribute("data-nivel");
      $("hoy-v").textContent = "–"; $("hoy-v").dataset.v = "0";
      $("hoy-dias").textContent = "";
      $("hoy-fill").style.width = "0";
      $("hoy-barra").setAttribute("aria-label", "Sin plan para el día a día");
      $("hoy-s").textContent = "Ponle un plan a tus gastos del día a día (mercado, transporte, salidas) y te digo cuánto puedes gastar hoy.";
      return h;
    }
    var uso = h.base > 0 ? h.hoyGasto / h.base : (h.hoyGasto > 0 ? 2 : 0);
    var nivel = uso > 1 || h.base <= 0 ? "pasado" : uso >= 0.85 ? "cerca" : "bien";
    card.dataset.nivel = nivel;
    animateNumber($("hoy-v"), Math.max(0, redondeoMil(h.puede)), money);
    $("hoy-dias").textContent = h.quedan === 1 ? "Último día del mes" : "Faltan " + plural(h.quedan, "día");
    $("hoy-fill").style.width = Math.min(100, uso * 100).toFixed(1) + "%";
    $("hoy-barra").setAttribute("aria-label", "Hoy llevas " + money(h.hoyGasto) + " de " + money(redondeoMil(h.base)));
    $("hoy-s").textContent = h.base <= 0 ? "Lo del día a día de este mes ya se usó. Te ayudo a mover algo de otra categoría si lo necesitas."
      : nivel === "pasado" ? "Hoy te pasaste " + money(h.hoyGasto - h.base) + ". Tranquilidad: lo reparto en los días que quedan."
      : h.hoyGasto > 0 ? "Llevas " + money(h.hoyGasto) + " hoy. En el mes te quedan " + money(Math.max(0, h.resto)) + "."
      : "En el mes te quedan " + money(Math.max(0, h.resto)) + " para el día a día.";
    return h;
  }
  $("hoy-registrar").addEventListener("click", function () { abrirCharla(); });

  // --- Saludo en primera persona, según cómo va el mes ---
  function renderSaludo(t, h) {
    var hr = new Date().getHours(), hola = hr >= 5 && hr < 12 ? "Buenos días." : hr >= 12 && hr < 18 ? "Buenas tardes." : "Buenas noches.";   // igual que el sol (6 a 18) y la luna
    var hoy = new Date(), k = hoy.getFullYear() + "-" + ("0" + (hoy.getMonth() + 1)).slice(-2), actual = state.mes === k;
    var dias = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate(), avance = actual ? hoy.getDate() / dias : 1;
    var usado = t.ingReal > 0 ? t.gasReal / t.ingReal : 0, plan = t.ingPlan > 0 ? t.gasPlan / t.ingPlan : 1, frase, sub;
    if (!(t.ingReal > 0) && !(t.ingPlan > 0)) { frase = "Cuéntame cuánto te entra este mes y te digo cómo vas."; sub = "Con eso armo tu mes en un minuto."; }
    else if (t.saldo < 0) { frase = "Este mes se fue un poco por encima."; sub = "Miremos juntos dónde ajustar; siempre hay espacio para mejorar."; }
    else if (!actual) { frase = usado <= plan ? "Así quedó ese mes: cerraste dentro del plan." : "Así quedó ese mes."; sub = "Estás viendo " + monthLabel(state.mes).toLowerCase() + "."; }
    else if (!(t.gasReal > 0) && !state.movs.some(function (m) { return (m.f || "").slice(0, 7) === k; })) { frase = "Tu mes ya está armado."; sub = "Cuéntame tu primer gasto y desde ahí te digo cómo vas."; }
    else if (h && h.plan && h.base <= 0) { frase = "Vamos con calma estos días."; sub = "Lo del día a día ya se usó; te ayudo a cuadrar el resto del mes."; }
    else if (h && h.plan ? h.resto >= h.plan * (1 - (hoy.getDate() - 1) / dias) * 0.95 : usado <= plan * avance + 0.05) {
      frase = "¡Vas muy bien este mes!";
      sub = h && h.plan ? "Tu día a día va al ritmo justo y vamos en el día " + hoy.getDate() + " de " + dias + "." : "Llevas el " + pctf(usado) + " de lo que entró y vamos en el día " + hoy.getDate() + " de " + dias + ".";
    }
    else { frase = "Vas un poco rápido este mes."; sub = "Te ayudo a llegar con calma al cierre: mira cuánto puedes gastar hoy."; }
    var animo = (!(t.ingReal > 0) && !(t.ingPlan > 0)) || frase === "Tu mes ya está armado." ? "nuevo" : t.saldo < 0 ? "neg" : /muy bien|dentro del plan/.test(frase) ? "bien" : /rápido/.test(frase) ? "rapido" : "calma";
    renderMascota(t, animo);
    $("saludo-h").textContent = hola + " " + frase;
    $("saludo-s").textContent = sub;
  }

  function renderInicio(t) {
    var hero = $("t-hero"), ing = t.ingReal;
    renderSaludo(t, renderHoy(t));
    hero.classList.toggle("neg", t.saldo < 0);
    $("hero-month").textContent = monthLabel(state.mes);
    animateNumber($("hero-saldo"), t.saldo, money);
    $("hero-sub").textContent = ing > 0 ? "Ingresaron " + money(ing) + " y llevas gastado " + money(t.gasReal) + "." : "Registra tus ingresos para ver cuánto te queda.";
    var usado = ing > 0 ? Math.min(t.gasReal / ing, 1) : 0, plan = t.ingPlan > 0 ? Math.min(t.gasPlan / t.ingPlan, 1) : 0;
    $("hero-fill").style.width = (usado * 100).toFixed(1) + "%";
    $("hero-fill").style.transition = reduceMotion ? "none" : "width .7s cubic-bezier(.2,.8,.2,1)";
    $("hero-mark").style.left = "calc(" + (plan * 100).toFixed(1) + "% - 1px)";
    $("hero-bar-wrap").setAttribute("aria-label", "Has gastado el " + pctf(usado) + " de tus ingresos; lo planeado era el " + pctf(plan));
    $("hero-chips").innerHTML = "<span>Gastado " + pctf(ing > 0 ? t.gasReal / ing : 0) + "</span><span>Ahorro " + pctf(ing > 0 ? t.ahorro / ing : 0) + "</span><span>Planeado " + money(t.ingPlan - t.gasPlan) + "</span>";

    var p = puntaje(t);
    var arc = $("score-arc"), C = 314.16;
    arc.style.transition = reduceMotion ? "none" : "stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1), stroke .3s";
    arc.style.strokeDashoffset = (C * (1 - p.score / 100)).toFixed(1);
    arc.style.stroke = p.cls === "ok" ? "var(--good)" : p.cls === "warn" ? "var(--warn)" : "var(--bad)";
    animateNumber($("score-num"), p.score, function (v) { return String(Math.round(v)); });
    $("score-svg").setAttribute("aria-label", "Salud financiera: " + p.score + " de 100, " + p.label);
    $("score-chip").className = "chip " + p.cls; $("score-chip").textContent = p.label;
    $("score-tips").innerHTML = p.tips.map(function (x) { return '<li class="' + x.cls + '">' + x.txt + "</li>"; }).join("") || '<li>Agrega tus ingresos y gastos para ver tu diagnóstico.</li>';
    renderRachas();
    renderNudge();

    renderDonut(t);
    renderWatch(t);
    renderTuDia(); renderPron(t); renderQuincena(); renderAlcancia(); renderTarjetasCat(t); renderPorDia(); renderAnSimple(t);
    if (!$("carta").dataset.forzada) renderCarta(false);
  }

  var donutYaPintado = false;
  // "¿En qué se va tu plata?": esta semana o este mes. Desde el 28 de noviembre de 2026 se ve como barras horizontales
  // (una por categoría, con monto y porcentaje); el anillo SVG se sigue armando pero queda oculto por estilo.
  // Si la persona no ha elegido, se muestra la semana cuando ya tiene gastos esta semana; si no, el mes.
  var donutModo = (function () { try { return localStorage.getItem("fintelligente-donut") || ""; } catch (e) { return ""; } })();
  function byCatSemana() {
    var ini = lunesDe(new Date()), r = {};
    state.movs.forEach(function (x) { if (x.t !== "g") return; var f = parseD(x.f); if (!f || f < ini) return; (r[x.cat] = r[x.cat] || { real: 0, plan: 0 }).real += x.m; });
    return r;
  }
  function renderDonut(t) {
    var sem = byCatSemana(), modo = donutModo || (Object.keys(sem).length ? "semana" : "mes");
    var semana = modo === "semana", fuente = semana ? sem : t.byCat;
    Array.prototype.forEach.call($("donut-modo").querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", b.dataset.dm === modo); });
    var items = Object.keys(fuente).map(function (id) { return { id: id, v: fuente[id].real, plan: semana ? 0 : fuente[id].plan, c: catById(id) || { name: "Otros" } }; })
      .filter(function (x) { return x.v > 0; }).sort(function (a, b) { return b.v - a.v; });
    var total = items.reduce(function (s, x) { return s + x.v; }, 0);
    if (items.length > 7) {
      var rest = items.slice(6).reduce(function (s, x) { return s + x.v; }, 0);
      items = items.slice(0, 6).concat([{ id: "__otras", v: rest, plan: 0, c: { name: "Otras" } }]);
    }
    // Geometría: anillo con puntas redondeadas, aplastado en vertical (vista casi de frente) y con 7 capas de grosor
    var R = 80, C = 2 * Math.PI * R, SW = 24, GAP = items.length > 1 ? 4 : 0, off = 0, SQ = 1, CAPAS = 0, PASO = 2;   // plana: el grosor en 3D no gustó (19 de noviembre de 2026)
    var animar = !donutYaPintado && !reduceMotion && total > 0;
    var trozos = items.map(function (x) {
      var len = total ? x.v / total * C : 0, col = x.id === "__otras" ? "#8e8aa0" : catColor(x.id);
      var redondo = items.length > 1 && len - GAP - SW > 1, dib = redondo ? len - GAP - SW : Math.max(len - GAP, 0.5), ini = redondo ? off + GAP / 2 + SW / 2 : off + GAP / 2;
      if (items.length === 1) { dib = C; ini = 0; redondo = false; }
      var mid = (off + len / 2) / R - Math.PI / 2, sel = donutSel === x.id;
      off += len;
      return { x: x, col: col, dib: dib, ini: ini, redondo: redondo, dx: sel ? Math.cos(mid) * 10 : 0, dy: sel ? Math.sin(mid) * 10 - 14 : 0 };
    });
    function capa(dy, lado) {
      return '<g transform="translate(0 ' + dy + ') translate(100 100) scale(1 ' + SQ + ') translate(-100 -100)">' +
        (!lado && !total ? '<circle cx="100" cy="100" r="' + R + '" fill="none" stroke="var(--line)" stroke-width="' + SW + '" opacity=".6"/>' : "") +
        trozos.map(function (z) {
          var cls = donutSel ? (donutSel === z.x.id ? " on" : " dim") : "";
          if (!CAPAS) { z.dy = donutSel === z.x.id ? z.dy + 14 : 0; }   // plana: la porción elegida solo sale hacia afuera
          return '<g class="trozo' + cls + '" style="transform:translate(' + z.dx.toFixed(1) + "px," + z.dy.toFixed(1) + 'px)"><circle class="' + (lado ? "lado" : "seg") + '" data-id="' + z.x.id + '" cx="100" cy="100" r="' + R +
            '" stroke="' + z.col + '"' + (lado ? ' style="stroke:color-mix(in oklab,' + z.col + " " + (58 + dy * 1.5) + '%,#000)"' : "") + ' stroke-width="' + SW + '" stroke-linecap="' + (z.redondo ? "round" : "butt") +
            '" stroke-dasharray="' + (animar ? "0 " + C.toFixed(2) : z.dib.toFixed(2) + " " + (C - z.dib).toFixed(2)) + '" data-dib="' + z.dib.toFixed(2) + '" stroke-dashoffset="' + (-z.ini).toFixed(2) +
            '" transform="rotate(-90 100 100)">' + (lado ? "" : "<title>" + esc(z.x.c.name) + ": " + money(z.x.v) + "</title>") + "</circle></g>";
        }).join("") + "</g>";
    }
    var svg = CAPAS ? '<defs><radialGradient id="donut-sombra"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="donut-brillo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
      '<ellipse cx="100" cy="' + (100 + CAPAS * PASO + 8) + '" rx="100" ry="60" fill="url(#donut-sombra)"/>' : "";
    for (var k = CAPAS; k >= 1; k--) svg += capa(k * PASO, true);
    svg += capa(0, false);
    // Brillo de la cara de arriba: un aro de luz suave sobre la mitad de atrás
    if (total && CAPAS) svg += '<g transform="translate(100 100) scale(1 ' + SQ + ') translate(-100 -100)" pointer-events="none"><circle cx="100" cy="100" r="' + (R + SW / 2 - 3) + '" fill="none" stroke="url(#donut-brillo)" stroke-width="3" opacity=".9"/></g>';
    $("donut").innerHTML = svg;
    $("donut").setAttribute("aria-label", (semana ? "Gasto de esta semana" : "Gasto del mes") + " por categoría");
    if (total > 0) donutYaPintado = true;
    if (animar) requestAnimationFrame(function () { requestAnimationFrame(function () {
      Array.prototype.forEach.call($("donut").querySelectorAll("circle[data-dib]"), function (c) { var d = +c.dataset.dib; c.setAttribute("stroke-dasharray", d.toFixed(2) + " " + (C - d).toFixed(2)); });
    }); });
    var sel = items.find(function (x) { return x.id === donutSel; });
    $("donut-k").textContent = sel ? sel.c.name : semana ? "Esta semana" : "Este mes";
    $("donut-v").textContent = money(sel ? sel.v : total);
    $("donut-p").textContent = sel && total ? pctf(sel.v / total) + " del total" : (items.length ? plural(items.length, "categoría") : semana ? "Sin gastos esta semana" : "Sin gastos aún");
    $("donut-legend").classList.toggle("con-sel", !!sel);
    // Barras horizontales (28 de noviembre de 2026): cada categoría en una fila con su monto y su porcentaje del total.
    // La barra más larga es la categoría que más se lleva; las demás, en proporción a ella.
    var mayor = items.length ? items[0].v : 0;
    $("donut-legend").classList.add("barras");
    $("donut-legend").innerHTML = items.map(function (x, i) {
      var otras = x.id === "__otras", col = otras ? "#8e8aa0" : catColor(x.id);
      var icon = otras ? '<span class="cat-ic"><svg class="ic"><use href="#c-otros"/></svg></span>' : catIcon(x.id);
      var r = x.plan > 0 ? x.v / x.plan : 0, pc = pctf(total ? x.v / total : 0);
      var pie = x.plan > 0 ? (r > 1 ? '<small class="neg">Te pasaste ' + money(x.v - x.plan) + "</small>" : "<small>de " + money(x.plan) + " planeados</small>") : "<small>" + (otras ? "Varias categorías" : semana ? "Esta semana" : "Sin plan") + "</small>";
      return '<button type="button" data-id="' + x.id + '" class="' + (donutSel === x.id ? "on" : "") + (r > 1 ? " pasada" : "") + '" style="--c:' + col + ";--w:" + (mayor ? Math.max(3, x.v / mayor * 100) : 0).toFixed(1) + "%;--i:" + i + '" aria-pressed="' + (donutSel === x.id) + '"' +
        ' aria-label="' + esc(x.c.name) + ": " + money(x.v) + ", " + pc + ' del total">' +
        '<span class="br-cab">' + icon + '<span class="nm">' + esc(x.c.name) + '</span><b class="ct-v cifra">' + money(x.v) + "</b></span>" +
        '<span class="br-fila"><span class="br-pista" aria-hidden="true"><i></i></span><span class="pc">' + pc + "</span></span>" + pie + "</button>";
    }).join("");
  }
  function pickDonut(id) {
    donutSel = donutSel === id ? null : id; renderDonut(totalsOf(cur()));
    // Cada categoría tiene su nota (escala pentatónica, siempre suena bien junta)
    if (donutSel) { var ids = Array.prototype.map.call($("donut-legend").querySelectorAll("button[data-id]"), function (x) { return x.dataset.id; }); sonar("nota", Math.max(0, ids.indexOf(id))); }
  }
  $("donut").addEventListener("click", function (e) { var s = e.target.closest(".seg"); if (s) pickDonut(s.dataset.id); });
  $("donut-modo").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-dm]"); if (!b || b.getAttribute("aria-pressed") === "true") return;
    donutModo = b.dataset.dm; donutSel = null; donutYaPintado = false;
    try { localStorage.setItem("fintelligente-donut", donutModo); } catch (er) {}
    renderDonut(totalsOf(cur()));
  });
  // Tocar una tarjeta: se resalta en el anillo y se abre su detalle, creciendo desde la tarjeta
  $("donut-legend").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-id]"); if (!b) return;
    var id = b.dataset.id;
    if (donutSel !== id) pickDonut(id);
    if (id !== "__otras") abrirCategoria(id, b);
  });
  var cdCat = "";
  // Inicio: una tarjeta de color por categoría, como en el prototipo (las que tienen plan o gasto este mes)
  // Tinta con mejor contraste sobre el color de la categoría (oscura o blanca)
  function tintaPara(hex) { var L = luminance(hex), blanco = 1.05 / (L + 0.05), oscuro = (L + 0.05) / (luminance("#14121f") + 0.05); return oscuro >= blanco ? "#14121f" : "#ffffff"; }
  // Si ni la tinta oscura ni la blanca se leen bien (4,5 : 1), oscurece un poco el fondo de la tarjeta
  function fondoLegible(hex) {
    var c = hex;
    for (var k = 0; k < 12; k++) {
      var L = luminance(c), oscuro = (L + 0.05) / (luminance("#14121f") + 0.05), blanco = 1.05 / (L + 0.05);
      if (Math.max(oscuro, blanco) >= 4.6) return c;
      c = "#" + [1, 3, 5].map(function (i) { var v = Math.round(parseInt(hex.substr(i, 2), 16) * (1 - (k + 1) * 0.05)); return ("0" + v.toString(16)).slice(-2); }).join("");
    }
    return c;
  }
  function renderTarjetasCat(t) {
    var sec = $("cat-tarjetas"); if (!sec) return;
    var lista = cats().map(function (c) { var x = t.byCat[c.id] || { plan: 0, real: 0 }; return { c: c, plan: x.plan, real: x.real }; })
      .filter(function (x) { return x.plan > 0 || x.real > 0; })
      .sort(function (a, b) { return (b.plan > 0 ? b.real / b.plan : 0) - (a.plan > 0 ? a.real / a.plan : 0) || b.real - a.real; });
    sec.hidden = !lista.length;
    var max = 6, mostrar = mostrarTodasCat ? lista : lista.slice(0, max);
    $("ct-todas").hidden = lista.length <= max; $("ct-todas").textContent = mostrarTodasCat ? "Ver menos" : "Ver todas (" + lista.length + ")";
    $("ct-grid").innerHTML = mostrar.map(function (x, i) {
      var col = fondoLegible(catColor(x.c.id)), tinta = tintaPara(col), r = x.plan > 0 ? x.real / x.plan : 0;
      var linea = !(x.plan > 0) ? "Gastaste " + money(x.real) : r > 1 ? "Te pasaste " + money(x.real - x.plan) : r >= 1 ? "Ya está completo"
        : r >= 0.85 ? "Casi al límite: quedan " + money(x.plan - x.real) : "Vas bien: quedan " + money(x.plan - x.real);
      if (CON_3D) return '<button type="button" class="ct-carta ct-fila' + (r > 1 ? " pasada" : r >= 0.85 ? " justa" : "") + '" data-cat="' + esc(x.c.id) + '" style="--c:' + catColor(x.c.id) + ";--i:" + i + '" aria-label="' + esc(x.c.name) + ": " + linea + '">' +
        catIcon(x.c.id) + '<span class="ct-txt"><span class="ct-n">' + esc(x.c.name) + '</span><span class="ct-l">' + linea + "</span>" +
        '<span class="ct-barra" aria-hidden="true"><i style="width:' + Math.min(100, r * 100).toFixed(1) + '%"></i></span></span></button>';
      return '<button type="button" class="ct-carta' + (r > 1 ? " pasada" : "") + '" data-cat="' + esc(x.c.id) + '" style="--c:' + col + ";--t:" + tinta + ";--i:" + i + '" aria-label="' + esc(x.c.name) + ": " + linea + '">' +
        '<svg class="ct-fondo" aria-hidden="true"><use href="#c-' + iconoDeCat(x.c.id) + '"/></svg>' +
        '<span class="ct-n">' + esc(x.c.name) + '</span><span class="ct-l">' + linea + '</span>' +
        '<span class="ct-barra" aria-hidden="true"><i style="width:' + Math.min(100, r * 100).toFixed(1) + '%"></i></span></button>';
    }).join("");
  }
  var mostrarTodasCat = false;
  // Análisis en palabras sencillas: cómo va el mes, una frase y cada categoría con Bien, Ojo, Listo o Te pasaste (ícono y palabra, nunca solo color).
  var anDetalle = false;
  try { anDetalle = localStorage.getItem("fintelligente-an-detalle") === "1"; } catch (e) {}
  function renderAnSimple(t) {
    var sec = $("an-simple"); if (!sec) return;
    var hoy = new Date(), k = hoy.getFullYear() + "-" + ("0" + (hoy.getMonth() + 1)).slice(-2), actual = state.mes === k;
    var dias = new Date(+state.mes.slice(0, 4), +state.mes.slice(5, 7), 0).getDate(), avance = actual ? hoy.getDate() / dias : 1;
    var entra = t.ingReal > 0 ? Math.max(t.ingReal, t.ingPlan) : t.ingPlan, gasto = t.gasReal;
    // Mismo pronóstico de la gráfica del detalle, para que las dos cifras coincidan.
    var P = actual ? pronostico(t) : null;
    var sobra = P && P.d >= 3 ? redondeoMil(P.cierre) : redondeoMil(entra - Math.max(gasto, actual ? t.gasPlan : gasto)), estado, frase;
    if (!(entra > 0) && !(gasto > 0)) { estado = "Empecemos"; frase = "Cuéntame cuánto te entra y en qué gastas, y aquí te digo cómo vas."; }
    else if (sobra >= Math.max(1000, entra * 0.05)) { estado = "Vas bien"; frase = actual ? "Si sigues así, al final del mes te sobran unos " + money(sobra) + "." : "Cerraste el mes con unos " + money(Math.max(0, entra - gasto)) + " de sobra."; }
    else if (sobra >= 0) { estado = "Vas justo"; frase = actual ? "Llegas al final del mes, pero con poco margen: unos " + money(sobra) + "." : "Cerraste el mes justo."; }
    else { estado = "Ojo"; frase = actual ? "A este ritmo te faltarían unos " + money(-sobra) + ". Te ayudo a ajustar lo que queda." : "Ese mes gastaste " + money(-sobra) + " más de lo que entró."; }
    $("an-v").textContent = estado; $("an-frase").textContent = frase; $("an-estado").dataset.estado = estado === "Ojo" ? "ojo" : estado === "Vas justo" ? "justo" : "bien";
    var lista = cats().map(function (c) { var x = t.byCat[c.id] || { plan: 0, real: 0 }; return { c: c, plan: x.plan, real: x.real }; })
      .filter(function (x) { return x.plan > 0 || x.real > 0; })
      .sort(function (a, b) { return (b.plan > 0 ? b.real / b.plan : 2) - (a.plan > 0 ? a.real / a.plan : 2) || b.real - a.real; }).slice(0, 6);
    var OK = "M5 12.5l4.5 4.5L19 7.5", OJO = "M12 7v6M12 17h.01", MAS = "M12 5v14M5 12h14";
    $("an-lista").innerHTML = lista.length ? lista.map(function (x) {
      var r = x.plan > 0 ? x.real / x.plan : 0, q = x.plan - x.real, est, ic, tx, cls;
      if (!(x.plan > 0)) { est = "Sin plan"; ic = MAS; cls = "nada"; tx = "Llevas " + money(x.real) + ". Ponle un plan y te aviso."; }
      else if (r > 1) { est = "Te pasaste"; ic = OJO; cls = "ojo"; tx = "Vas " + money(-q) + " arriba. Lo compensamos con otra categoría."; }
      else if (r >= 0.999) { est = "Listo"; ic = OK; cls = "listo"; tx = x.c.group === "aho" ? "¡Ya guardaste lo de este mes!" : "Ya está completo este mes."; }
      else if (r >= 0.85) { est = "Ojo"; ic = OJO; cls = "ojo"; tx = "Te quedan " + money(q) + ". Mejor con calma esta semana."; }
      else { est = "Bien"; ic = OK; cls = "bien"; tx = "Te quedan " + money(q) + "."; }
      return '<li class="an-fila" data-est="' + cls + '">' + catIcon(x.c.id) + '<span class="an-txt"><b>' + esc(x.c.name) + "</b><small>" + tx + '</small></span><span class="an-est"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + ic + '"/></svg>' + est + "</span></li>";
    }).join("") : '<li class="an-vacio">Cuando anotes tus gastos, aquí verás cómo va cada cosa.</li>';
    var v = document.querySelector('[data-view="analisis"]'); if (v) v.classList.toggle("con-detalle", anDetalle);
    $("an-detalle").setAttribute("aria-expanded", String(anDetalle)); $("an-detalle").textContent = anDetalle ? "Ocultar el detalle" : "Ver el detalle con gráficas";
  }
  $("an-detalle").addEventListener("click", function () {
    anDetalle = !anDetalle; try { localStorage.setItem("fintelligente-an-detalle", anDetalle ? "1" : "0"); } catch (e) {}
    vibrar(8); renderAnSimple(totalsOf(cur()));
    if (anDetalle) { var z = $("an-detalle-zona"); if (z) z.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); }
  });
  $("ct-todas").addEventListener("click", function () { mostrarTodasCat = !mostrarTodasCat; recompute(); });
  $("ct-grid").addEventListener("click", function (e) { var b = e.target.closest("[data-cat]"); if (b) { vibrar(8); abrirCategoria(b.dataset.cat, b); } });
  function abrirCategoria(id, desde) {
    var c = catById(id); if (!c) return;
    cdCat = id;
    var col = catColor(id), t = totalsOf(cur()).byCat[id] || { plan: 0, real: 0 }, panel = $("dlg-cat").querySelector(".cat-det");
    panel.style.setProperty("--c", col);
    $("cd-ic").innerHTML = catIcon(id);
    $("cd-t").textContent = c.name;
    $("cd-sub").textContent = monthLabel(state.mes);
    $("cd-real").textContent = money(t.real);
    $("cd-plan").textContent = t.plan > 0 ? "de " + money(t.plan) + " planeados" : "sin plan este mes";
    var r = t.plan > 0 ? t.real / t.plan : 0;
    $("cd-fill").style.width = Math.min(100, r * 100).toFixed(1) + "%";
    $("cd-fill").className = r > 1 ? "pasado" : "";
    $("cd-estado").textContent = !(t.plan > 0) ? "Ponle un plan a esta categoría y te digo cómo vas." : r > 1 ? "Te pasaste " + money(t.real - t.plan) + ". Tranquilidad: miremos de dónde mover." :
      r >= 0.85 ? "Vas cerca del límite: te quedan " + money(t.plan - t.real) + "." : "Vas bien: te quedan " + money(t.plan - t.real) + " (" + pctf(1 - r) + ").";
    // Historia de los últimos 6 meses (los que existan)
    var ks = monthKeys().filter(function (k) { return k <= state.mes; }).slice(-6), vals = ks.map(function (k) { var x = totalsOf(state.meses[k]).byCat[id]; return x ? x.real : 0; });
    var max = Math.max.apply(null, vals.concat([t.plan || 0, 1])), W = 320, n = ks.length, bw = Math.min(36, (W - 20) / Math.max(n, 1) - 14), svg = "";
    if (t.plan > 0) { var yp = 104 - t.plan / max * 88; svg += '<line x1="0" x2="320" y1="' + yp.toFixed(1) + '" y2="' + yp.toFixed(1) + '" class="cd-plan-l"/><text x="318" y="' + (yp - 4).toFixed(1) + '" text-anchor="end" class="cd-plan-t">plan</text>'; }
    ks.forEach(function (k, i) {
      var h = vals[i] / max * 88, x = 10 + i * ((W - 20) / n) + ((W - 20) / n - bw) / 2, p = parseKey(k);
      svg += '<rect x="' + x.toFixed(1) + '" y="' + (104 - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(h, 2).toFixed(1) + '" rx="5" class="' + (k === state.mes ? "act" : "") + '"><title>' + mesCorto(p.y, p.m) + ": " + money(vals[i]) + "</title></rect>" +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="122" text-anchor="middle">' + MESES_C[p.m - 1] + "</text>";
    });
    $("cd-hist").innerHTML = svg;
    $("cd-hist").setAttribute("aria-label", "Gasto en " + c.name + " por mes: " + ks.map(function (k, i) { var p = parseKey(k); return MESES[p.m - 1] + " " + money(vals[i]); }).join(", "));
    var filas = cur().gastos.filter(function (g) { return g.cat === id; });
    $("cd-filas").innerHTML = filas.map(function (g) {
      var rr = g.plan > 0 ? g.real / g.plan : 0;
      return '<div class="cd-fila"><span>' + esc(g.concepto) + '</span><b class="cifra">' + money(g.real) + "</b>" + (g.plan > 0 ? '<small>de ' + money(g.plan) + '</small><span class="cd-mini' + (rr > 1 ? " pasado" : "") + '"><i style="width:' + Math.min(100, rr * 100).toFixed(1) + '%"></i></span>' : "<small>sin plan</small>") + "</div>";
    }).join("") || '<p class="hint">No hay conceptos de esta categoría este mes.</p>';
    var movs = state.movs.filter(function (x) { return x.cat === id && x.t === "g" && (x.f || "").slice(0, 7) === state.mes; }).sort(function (a, b) { return a.f < b.f ? 1 : -1; }).slice(0, 30);
    $("cd-movs-h").hidden = !movs.length;
    $("cd-movs").innerHTML = movs.map(function (x) {
      var d = parseD(x.f);
      return '<div class="cd-mov"><span class="cd-f">' + (d ? d.getDate() + " " + MESES_C[d.getMonth()] : "") + "</span><span>" + esc(x.c || "") + '</span><b class="cifra">' + money(x.m) + "</b></div>";
    }).join("");
    openDlg("dlg-cat", null);
    if (desde && !reduceMotion && panel.animate) {
      var a = desde.getBoundingClientRect(), b = panel.getBoundingClientRect();
      if (b.width && b.height) panel.animate([
        { transformOrigin: "top left", transform: "translate(" + (a.left - b.left) + "px," + (a.top - b.top) + "px) scale(" + (a.width / b.width) + "," + (a.height / b.height) + ")", opacity: 0.6, borderRadius: "18px" },
        { transformOrigin: "top left", transform: "none", opacity: 1 }
      ], { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
  }
  $("cd-anotar").addEventListener("click", function () { var c = catById(cdCat); closeDlg("dlg-cat"); abrirCharla(); });
  // En Análisis, cada categoría también abre su detalle
  $("cat-list").addEventListener("click", function (e) { var d = e.target.closest("[data-cat]"); if (d) abrirCategoria(d.dataset.cat, d); });
  $("cat-list").addEventListener("keydown", function (e) { var d = e.target.closest("[data-cat]"); if (d && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrirCategoria(d.dataset.cat, d); } });

  function renderWatch(t) {
    var rows = Object.keys(t.byCat).map(function (id) { var x = t.byCat[id], c = catById(id) || { name: "Otros", group: "gus" }; return { id: id, c: c, plan: x.plan, real: x.real, r: x.plan ? x.real / x.plan : 0 }; })
      .filter(function (x) { return x.plan > 0 && x.c.group !== "aho" && x.r >= 0.75; }).sort(function (a, b) { return b.r - a.r; }).slice(0, 4);
    $("watch-list").innerHTML = rows.length ? rows.map(function (x) {
      var cls = x.r > 1 ? "bad" : x.r >= 0.9 ? "warn" : "";
      return '<div class="watch-row">' + catIcon(x.id) + '<div><div class="top"><b>' + esc(x.c.name) + '</b><span class="' + (x.r > 1 ? "neg" : "") + '">' +
        (x.r > 1 ? "Pasado por " + money(x.real - x.plan) : "Quedan " + money(x.plan - x.real)) + '</span></div><div class="bar"><div class="fill ' + cls + '" style="width:' + Math.min(x.r * 100, 100).toFixed(1) + '%"></div></div></div></div>';
    }).join("") : '<div class="all-good"><svg class="ic"><use href="#c-ahorro"/></svg>Todo bajo control: ninguna categoría pasa del 75 % de lo planeado.</div>';
  }
  document.addEventListener("click", function (e) { var g = e.target.closest("[data-goto]"); if (g) irAConTransicion(g.dataset.goto, e.clientX || null, e.clientY || null); });
  document.addEventListener("click", function (e) { var g = e.target.closest("[data-ir-sel]"); if (!g) return; var x = document.querySelector(g.dataset.irSel); if (x) x.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); });

  // --- Notas del mes: tarjetas por tipo ---
  var TIPOS_NOTA = { logro: { e: icono("i-trophy"), n: "Logro" }, alerta: { e: icono("i-alert"), n: "Alerta" }, recordatorio: { e: icono("i-pin"), n: "Recordatorio" }, idea: { e: icono("i-bulb"), n: "Idea" }, nota: { e: icono("i-note"), n: "Nota" } };
  function icono(id, cls) { return '<svg class="ic' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  var tipoNota = "logro";
  function leerNotas(txt) {
    return String(txt || "").split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var m = /^(logro|alerta|recordatorio|idea|nota)\s*:\s*/i.exec(l);
      return m ? { tipo: m[1].toLowerCase(), texto: l.slice(m[0].length) } : { tipo: "nota", texto: l };
    });
  }
  function guardarNotas(lista) {
    cur().notas = lista.filter(function (x) { return x.texto.trim(); }).map(function (x) { return TIPOS_NOTA[x.tipo].n + ": " + x.texto.replace(/\s*\n\s*/g, " ").trim(); }).join("\n").slice(0, 4000);
    changed();
  }
  function renderNotas() {
    var lista = leerNotas(cur().notas), box = $("notas-lista");
    if (box.contains(document.activeElement) && document.activeElement.tagName === "TEXTAREA") return;
    box.innerHTML = lista.length ? lista.map(function (x, i) {
      var t = TIPOS_NOTA[x.tipo];
      return '<div class="nota" data-tipo="' + x.tipo + '" data-i="' + i + '"><span class="em" aria-hidden="true">' + t.e + '</span><span class="tx"><small>' + t.n + '</small>' +
        '<textarea rows="1" maxlength="300" aria-label="' + t.n + '">' + esc(x.texto) + '</textarea></span>' +
        '<button class="icon-btn" type="button" data-borrar-nota="' + i + '" aria-label="Borrar nota" title="Borrar">×</button></div>';
    }).join("") : '<p class="notas-vacio">Anota lo que quieras recordar de este mes: lo que lograste, lo que te preocupa o una idea para ahorrar.</p>';
    $("notas-hint").textContent = lista.length ? "También salen en tu Excel" : "";
    renderNotasVista();
    Array.prototype.forEach.call($("nota-tipos").querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.tipoNota === tipoNota)); });
  }
  // Notas a la vista: las de este mes arriba en Inicio (alertas y recordatorios primero) y los recordatorios e
  // ideas del mes pasado, para traerlos con un toque. Lo descartado se recuerda en este dispositivo.
  var NV_KEY = "fintelligente-notas-descartadas";
  function nvDescartadas() { try { return JSON.parse(localStorage.getItem(NV_KEY) || "[]"); } catch (e) { return []; } }
  function nvHuella(k, x) { return k + "|" + x.texto.toLowerCase().slice(0, 80); }
  function notasPasadas() {
    var pk = prevKey(); if (!pk || !state.meses[pk]) return [];
    var ya = leerNotas(cur().notas).map(function (x) { return x.texto.toLowerCase(); }), fuera = nvDescartadas();
    return leerNotas(state.meses[pk].notas).filter(function (x) {
      return (x.tipo === "recordatorio" || x.tipo === "idea") && ya.indexOf(x.texto.toLowerCase()) < 0 && fuera.indexOf(nvHuella(pk, x)) < 0;
    }).map(function (x) { x.k = pk; return x; });
  }
  function renderNotasVista() {
    var box = $("notas-vista"); if (!box) return;
    var lista = leerNotas(cur().notas), peso = { alerta: 0, recordatorio: 1, idea: 2, logro: 3, nota: 4 };
    var orden = lista.map(function (x, i) { x.i = i; return x; }).sort(function (a, b) { return peso[a.tipo] - peso[b.tipo] || a.i - b.i; });
    var pasadas = notasPasadas().slice(0, 3);
    box.hidden = !lista.length && !pasadas.length;
    if (box.hidden) return;
    $("nv-mes").textContent = monthLabel(state.mes).split(" ")[0].toLowerCase();
    $("nv-lista").innerHTML = orden.slice(0, 3).map(function (x) {
      var t = TIPOS_NOTA[x.tipo];
      return '<li data-tipo="' + x.tipo + '"><span class="em" aria-hidden="true">' + t.e + '</span><span class="tx"><small>' + t.n + "</small><span>" + esc(x.texto) + "</span></span></li>";
    }).join("");
    $("nv-lista").hidden = !lista.length;
    $("nv-todas").hidden = lista.length <= 3;
    $("nv-todas").textContent = lista.length > 3 ? "Ver las " + lista.length + " notas" : "";
    $("nv-pasado").hidden = !pasadas.length;
    $("nv-pasado").innerHTML = !pasadas.length ? "" : "<p>Del mes pasado</p>" + pasadas.map(function (x, i) {
      var t = TIPOS_NOTA[x.tipo];
      return '<div class="nv-p"><span aria-hidden="true">' + t.e + '</span><span title="' + esc(x.texto) + '">' + esc(x.texto) + '</span>' +
        '<button class="btn sm" type="button" data-nv-traer="' + i + '">Traer</button><button class="icon-btn" type="button" data-nv-quitar="' + i + '" aria-label="No traer: ' + esc(x.texto) + '" title="No traer">×</button></div>';
    }).join("");
  }
  function irANotas(enfocar) {
    var p = document.querySelector(".notas-panel");
    p.scrollIntoView({ behavior: "smooth", block: "start" });
    p.classList.remove("resaltar"); void p.offsetWidth; p.classList.add("resaltar");
    if (enfocar) setTimeout(function () { $("f-nota-nueva").focus({ preventScroll: true }); }, 450);
  }
  $("nv-agregar").addEventListener("click", function () { irANotas(true); });
  $("nv-todas").addEventListener("click", function () { irANotas(false); });
  $("nv-pasado").addEventListener("click", function (e) {
    var b = e.target.closest("[data-nv-traer],[data-nv-quitar]"); if (!b) return;
    var x = notasPasadas()[+(b.dataset.nvTraer || b.dataset.nvQuitar)]; if (!x) return;
    if (b.dataset.nvTraer != null) {
      var lista = leerNotas(cur().notas); lista.unshift({ tipo: x.tipo, texto: x.texto });
      guardarNotas(lista); renderNotas();
      toast("Nota traída a " + monthLabel(state.mes).toLowerCase() + ".");
    } else {
      var f = nvDescartadas(); f.push(nvHuella(x.k, x));
      try { localStorage.setItem(NV_KEY, JSON.stringify(f.slice(-100))); } catch (e) {}
      renderNotasVista();
    }
  });
  function agregarNota() {
    var inp = $("f-nota-nueva"), txt = inp.value.trim();
    if (!txt) { inp.focus(); return; }
    var lista = leerNotas(cur().notas); lista.unshift({ tipo: tipoNota, texto: txt.slice(0, 300) });
    guardarNotas(lista); inp.value = ""; renderNotas(); inp.focus();
  }
  $("nota-tipos").addEventListener("click", function (e) { var b = e.target.closest("[data-tipo-nota]"); if (!b) return; tipoNota = b.dataset.tipoNota; renderNotas(); $("f-nota-nueva").focus(); });
  $("btn-nota").addEventListener("click", agregarNota);
  $("f-nota-nueva").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); agregarNota(); } });
  $("notas-lista").addEventListener("click", function (e) {
    var b = e.target.closest("[data-borrar-nota]"); if (!b) return;
    var lista = leerNotas(cur().notas), i = +b.dataset.borrarNota, quitada = lista.splice(i, 1)[0];
    guardarNotas(lista); renderNotas();
    toast("Nota borrada.", { action: "Deshacer", onAction: function () { var l = leerNotas(cur().notas); l.splice(i, 0, quitada); guardarNotas(l); renderNotas(); } });
  });
  $("notas-lista").addEventListener("input", function (e) {
    var t = e.target; if (t.tagName !== "TEXTAREA") return;
    var card = t.closest(".nota"), lista = leerNotas(cur().notas), i = +card.dataset.i;
    if (!lista[i]) return;
    lista[i].texto = t.value.replace(/\n/g, " ").slice(0, 300);
    clearTimeout(notasTimer); notasTimer = setTimeout(function () { guardarNotas(lista); }, 400);
  });
  $("notas-lista").addEventListener("keydown", function (e) { if (e.target.tagName === "TEXTAREA" && e.key === "Enter") { e.preventDefault(); e.target.blur(); } });
  $("notas-lista").addEventListener("focusout", function (e) { if (e.target.tagName === "TEXTAREA") setTimeout(renderNotas, 0); });
  var notasTimer = null;

  // --- Grupos del menú lateral: se recuerda cuáles quedaron abiertos ---
  (function () {
    var K = "fintelligente-lat-grupos", abiertos = {};
    try { abiertos = JSON.parse(localStorage.getItem(K) || "{}") || {}; } catch (e) {}
    [].forEach.call(document.querySelectorAll(".lat-grupo"), function (d) {
      if (abiertos[d.id]) d.open = true;
      d.addEventListener("toggle", function () { abiertos[d.id] = d.open; try { localStorage.setItem(K, JSON.stringify(abiertos)); } catch (e) {} });
    });
  })();
  // --- Pestañas ---
  var VIEWS = ["inicio", "movimientos", "metas", "cuentas", "analisis", "presupuesto"];
  var vistaActual = "";
  // ===================== Banda azul de Inicio con el sol y la luna =====================
  // La banda va detrás de todo (z-index -1) y llega hasta el final de "Cuéntame un gasto". Su alto y la altura de la
  // tarjeta de hoy (donde van la F grande y el astro) se miden aquí. El punto de la F es el sol de 6 a. m. a 6 p. m.
  // y la luna el resto. Mientras la banda está detrás de la barra de arriba, esa barra queda transparente.
  var bandaH = 0;
  function ajustarBanda() {
    var b = $("banda"); if (!b) return;
    var h = new Date().getHours(), dia = h >= 6 && h < 18;
    b.classList.toggle("dia", dia); b.classList.toggle("noche", !dia);
    var r = $("hoy-registrar"), hc = $("hoy-card");
    if (document.body.getAttribute("data-vista") !== "inicio" || !r || !r.offsetParent) { bandaH = 0; document.body.classList.remove("sobre-banda"); return; }
    var y = window.scrollY || 0;
    bandaH = Math.round(r.getBoundingClientRect().bottom + y + 30);
    b.style.setProperty("--banda-h", bandaH + "px");
    if (hc && !hc.hidden) b.style.setProperty("--hoy-y", Math.round(hc.getBoundingClientRect().top + y) + "px");
    bandaScroll();
  }
  function bandaScroll() {
    var antes = document.body.classList.contains("sobre-banda"), ahora = !!bandaH && (window.scrollY || 0) < bandaH - 130;
    if (antes !== ahora) { document.body.classList.toggle("sobre-banda", ahora); colorSistema(); }
  }
  window.addEventListener("scroll", bandaScroll, { passive: true });
  window.addEventListener("resize", ajustarBanda);
  try { new ResizeObserver(function () { ajustarBanda(); }).observe(document.querySelector("main.wrap")); } catch (e) {}
  setInterval(ajustarBanda, 5 * 60 * 1000);

  // Cambio de pestaña que pidió la persona (barra, menú, "Ver todos"): con View Transitions si el navegador las tiene.
  // El círculo nace en (x, y), donde tocó la persona. Los cambios desde el código siguen con irA(), al instante.
  var vtCorriendo = null;
  function irAConTransicion(v, x, y, desde) {
    if (VIEWS.indexOf(v) < 0) v = "inicio";
    if (v === vistaActual || !document.startViewTransition || reduceMotion || document.hidden) return irA(v);
    if (vtCorriendo) { try { vtCorriendo.skipTransition(); } catch (e) {} }
    var W = window.innerWidth, H = window.innerHeight;
    if (x == null) { x = W / 2; y = H - 40; }
    root.style.setProperty("--px", Math.round(x) + "px"); root.style.setProperty("--py", Math.round(y) + "px");
    root.style.setProperty("--pr", Math.ceil(Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 8) + "px");
    // El nombre de la pestaña viaja de la barra (o del menú) al título de la pantalla nueva
    var lbl = desde && desde.querySelector ? desde.querySelector("span") : null, tit = document.querySelector('[data-view="' + v + '"] .vista-titulo');
    if (lbl && tit && lbl.offsetParent) lbl.classList.add("vt-titulo"); else lbl = null;
    root.classList.add("con-vt");
    try {
      var t = vtCorriendo = document.startViewTransition(function () {
        if (lbl) lbl.classList.remove("vt-titulo");
        irA(v, false, true);
        if (lbl && tit) tit.classList.add("vt-titulo");
      });
      t.finished.then(fin, fin);
      // Si otra transición la reemplaza, el navegador rechaza estas promesas: no es un error
      if (t.ready) t.ready.catch(function () {}); if (t.updateCallbackDone) t.updateCallbackDone.catch(function () {});
    } catch (e) { fin(); irA(v); }
    function fin() {
      if (lbl) lbl.classList.remove("vt-titulo"); if (tit) tit.classList.remove("vt-titulo");
      if (vtCorriendo === t) { vtCorriendo = null; root.classList.remove("con-vt"); vibrar(6); }
    }
  }

  // Deslizar con el dedo entre Inicio, Movimientos y Metas (celular): la página sigue al dedo, la de al lado entra encima
  // con sombra y la que se va se queda atrás y se apaga. Al soltar decide por distancia o por velocidad; se puede soltar
  // a medias y vuelve. En los bordes (Inicio a la izquierda, Metas a la derecha) frena como una goma.
  (function () {
    var ORDEN = ["inicio", "movimientos", "metas"], g = null;
    var NO = "input, textarea, select, .bills, .seg, .hist-play, .billetera, .bt-pila, [data-no-deslizar], .donut, .pr-pron";
    function hoja(v) { return document.querySelector('.view[data-view="' + v + '"]'); }
    function puede(e) {
      if (window.innerWidth > 760 || e.touches.length !== 1 || vtCorriendo) return false;
      if (document.querySelector(".dlg-backdrop:not([hidden])") || ($("lateral") && $("lateral").classList.contains("abierta"))) return false;
      if (ORDEN.indexOf(vistaActual) < 0 || (e.target.closest && e.target.closest(NO))) return false;
      return !!(e.target.closest && e.target.closest("main.wrap"));
    }
    function limpiar() {
      if (!g) return;
      [g.actual, g.vecina, $("banda")].forEach(function (el) { if (el) { el.style.transform = ""; el.style.filter = ""; el.style.transition = ""; } });
      if (g.vecina) {
        g.vecina.classList.remove("vecina", "desde-izq");
        ["top", "left", "width", "minHeight", "paddingTop", "paddingLeft", "paddingRight", "boxSizing", "background", "alignContent"].forEach(function (k) { g.vecina.style[k] = ""; });
        if (!g.listo) g.vecina.hidden = true;
      }
      if (g.actual) g.actual.classList.remove("arrastra");
      document.body.classList.remove("arrastre-banda");
      g = null;
    }
    function preparar(dir) {
      var i = ORDEN.indexOf(vistaActual), dest = ORDEN[i + dir];
      g.dir = dir; g.actual = hoja(vistaActual); g.actual.classList.add("arrastra");
      if (!dest) { g.goma = true; return; }
      // La vecina es una hoja de pantalla completa bajo la barra de arriba, con su contenido donde quedará al llegar
      var r = g.actual.getBoundingClientRect(), top0 = r.top + window.scrollY, tb = document.querySelector(".topbar").getBoundingClientRect().bottom;
      // El aviso del ejemplo solo vive en Inicio: si se ve aquí y no allá, la vecina empieza más arriba
      var aviso = $("example-notice");
      if (aviso && aviso.offsetParent && dest !== "inicio" && dest !== "presupuesto") top0 -= aviso.offsetHeight + (parseFloat(getComputedStyle(aviso.parentNode).rowGap) || 0);
      g.dest = dest; g.vecina = hoja(dest);
      g.vecina.classList.add("vecina"); if (dir < 0) g.vecina.classList.add("desde-izq");
      var v = g.vecina.style; v.top = tb + "px"; v.left = "0px"; v.width = "100vw"; v.minHeight = (window.innerHeight - tb) + "px";
      v.paddingTop = Math.max(0, top0 - tb) + "px"; v.paddingLeft = v.paddingRight = r.left + "px"; v.boxSizing = "border-box"; v.alignContent = "start";
      g.vecina.hidden = false;
      g.banda = vistaActual === "inicio" ? "actual" : dest === "inicio" ? "vecina" : "";
      if (g.banda === "vecina") {
        document.body.classList.add("arrastre-banda");
        var bh = parseFloat(($("banda") && $("banda").style.getPropertyValue("--banda-h")) || 0) || 560;   // último alto medido en Inicio
        v.background = "linear-gradient(var(--bg), var(--bg)) 0 " + Math.max(0, bh - tb) + "px / 100% 100% no-repeat";
      }
    }
    function pintar(dx) {
      var W = g.W, b = $("banda");
      if (g.goma) { var gx = dx / (1 + Math.abs(dx) / 120) * .55; g.actual.style.transform = "translateX(" + gx + "px)"; return; }
      var p = Math.min(1, Math.max(0, -dx * g.dir / W));
      var xa = -g.dir * p * W * .3, xv = g.dir * (1 - p) * W;
      g.actual.style.transform = "translateX(" + xa + "px) scale(" + (1 - p * .04) + ")"; g.actual.style.filter = "brightness(" + (1 - p * .45) + ")";
      g.vecina.style.transform = "translateX(" + xv + "px)";
      if (b && g.banda) b.style.transform = "translateX(" + (g.banda === "actual" ? xa : xv) + "px)";
      g.p = p;
    }
    document.addEventListener("touchstart", function (e) {
      if (g || !puede(e)) return;
      var t = e.touches[0]; g = { x0: t.clientX, y0: t.clientY, modo: "", W: window.innerWidth, vx: 0, ult: [t.clientX, performance.now()], p: 0 };
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
      if (!g || g.fin) return;
      var t = e.touches[0], dx = t.clientX - g.x0, dy = t.clientY - g.y0;
      if (!g.modo) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { g = null; return; }
        if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
        g.modo = "h"; preparar(dx < 0 ? 1 : -1);
      }
      e.preventDefault();
      var ahora = performance.now(), dt = ahora - g.ult[1];
      if (dt > 0) g.vx = .7 * ((t.clientX - g.ult[0]) / dt) + .3 * g.vx;
      g.ult = [t.clientX, ahora]; g.dx = dx; pintar(dx);
    }, { passive: false });
    function soltar() {
      if (!g || !g.modo || g.fin) { if (g && !g.modo) g = null; return; }
      g.fin = true;
      var va = !g.goma && (g.p > .35 || (g.vx * -g.dir > .45 && g.p > .08));
      var dur = Math.round(Math.max(140, Math.min(280, (va ? 1 - g.p : g.p) * 360)));
      var curva = "transform " + dur + "ms cubic-bezier(.32,.72,0,1), filter " + dur + "ms cubic-bezier(.32,.72,0,1)";
      [g.actual, g.vecina, $("banda")].forEach(function (el) { if (el) el.style.transition = curva; });
      if (g.goma) { g.actual.style.transform = ""; setTimeout(limpiar, dur); return; }
      pintar(va ? -g.dir * g.W : 0);
      var dest = g.dest;
      setTimeout(function () {
        if (!g) return;
        if (va) { g.listo = true; var v = g.vecina; limpiar(); v.hidden = false; irA(dest, false, false, true); try { window.scrollTo({ top: 0, behavior: "instant" }); } catch (e) {} vibrar(6); }
        else limpiar();
      }, dur + 20);
    }
    document.addEventListener("touchend", soltar, { passive: true });
    document.addEventListener("touchcancel", soltar, { passive: true });
  })();

  function irA(v, noHash, enVT, sinAnim) {
    if (VIEWS.indexOf(v) < 0) v = "inicio";
    var dir = vistaActual && vistaActual !== v ? (VIEWS.indexOf(v) > VIEWS.indexOf(vistaActual) ? "entra-der" : "entra-izq") : "";
    vistaActual = v; document.body.setAttribute("data-vista", v);
    Array.prototype.forEach.call(document.querySelectorAll(".view"), function (s) {
      s.hidden = s.dataset.view !== v; s.classList.remove("entra-der", "entra-izq", "entra-vt");
      if (!s.hidden && dir && !sinAnim) { void s.offsetWidth; s.classList.add(enVT ? "entra-vt" : dir); }
    });
    Array.prototype.forEach.call(document.querySelectorAll("#tabs button"), function (b) { if (b.dataset.tab === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    pintarBarra(v); ajustarBanda();
    if (!noHash) { try { history.replaceState(null, "", "#" + v); } catch (e) {} }
    try { window.scrollTo({ top: 0, behavior: reduceMotion || enVT || sinAnim ? "instant" : "smooth" }); } catch (e) {}
  }
  $("tabs").addEventListener("click", function (e) { var b = e.target.closest("button[data-tab]"); if (b) irAConTransicion(b.dataset.tab, e.clientX || null, e.clientY || null); });
  // Barra de abajo (celular): Inicio, Movimientos, registrar, Metas y Más (el menú con Cuentas, Análisis y lo demás)
  function pintarBarra(v) {
    var activo = null;
    [].forEach.call(document.querySelectorAll("#barra [data-ir]"), function (b) {
      var es = b.dataset.ir === v || (b.dataset.ir === "mas" && (v === "cuentas" || v === "analisis" || v === "presupuesto"));
      if (es) { b.setAttribute("aria-current", "page"); activo = b; } else b.removeAttribute("aria-current");
    });
    var luz = $("barra-luz"); if (!luz || !activo) return;
    requestAnimationFrame(function () { requestAnimationFrame(function () { moverLuz(luz, activo); }); });
  }
  function moverLuz(luz, activo) {
    var br = $("barra").getBoundingClientRect(), ar = activo.getBoundingClientRect();
    if (!br.width) return;
    var w = luz.offsetWidth || 56, x = Math.max(2, Math.min(br.width - w - 2, ar.left - br.left + ar.width / 2 - w / 2));
    var antes = luz.style.transform, nuevo = "translateX(" + x.toFixed(1) + "px)";
    if (antes && antes !== nuevo && !reduceMotion) { luz.classList.remove("viaja"); void luz.offsetWidth; luz.classList.add("viaja"); }
    luz.style.transform = nuevo; luz.style.opacity = 1;
  }
  $("barra").addEventListener("click", function (e) {
    var b = e.target.closest("[data-ir]"); if (!b) return;
    vibrar(8);
    if (b.dataset.ir === "mas") { $("btn-menu").click(); return; }
    var rb = b.getBoundingClientRect();
    irAConTransicion(b.dataset.ir, rb.left + rb.width / 2, rb.top + rb.height / 2, b);
  });
  window.addEventListener("resize", function () { pintarBarra(vistaActual); });
  try { document.fonts.ready.then(function () { pintarBarra(vistaActual); }); } catch (e) {}
  // Vibración corta en Android (en iPhone el navegador no la permite); respeta "sonidos y vibración" apagados
  function vibrar(ms) { try { if (navigator.vibrate && !(state && state.prefs && state.prefs.sonidos === false)) navigator.vibrate(ms || 10); } catch (e) {} }
  window.addEventListener("hashchange", function () { irA(location.hash.slice(1), true); });

  // --- Menú Más ---
  function cerrarMenu() { $("menu-mas").hidden = true; $("btn-mas").setAttribute("aria-expanded", "false"); }
  $("btn-mas").addEventListener("click", function (e) {
    e.stopPropagation();
    var abrir = $("menu-mas").hidden;
    $("menu-mas").hidden = !abrir; this.setAttribute("aria-expanded", String(abrir));
    if (abrir) { var f = $("menu-mas").querySelector("button"); if (f) f.focus(); }
  });
  document.addEventListener("click", function (e) { if (!$("menu-mas").hidden && !e.target.closest(".menu-wrap")) cerrarMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("menu-mas").hidden) { cerrarMenu(); $("btn-mas").focus(); } });

  // --- Meses anterior y siguiente ---
  $("mes-prev").addEventListener("click", function () { var ks = monthKeys(), i = ks.indexOf(state.mes); if (i > 0) switchMonth(ks[i - 1]); });
  $("mes-next").addEventListener("click", function () { var ks = monthKeys(), i = ks.indexOf(state.mes); if (i < ks.length - 1) switchMonth(ks[i + 1]); });
  function renderMonthNav() {
    var ks = monthKeys(), i = ks.indexOf(state.mes);
    $("mes-prev").disabled = i <= 0; $("mes-next").disabled = i >= ks.length - 1;
  }

  // --- Registro rápido ---
  var addTipo = "gasto", addSel = null, addCat = "otros", addCuenta = "";
  function parseMonto(v) { return Math.max(0, Math.round(num(String(v).replace(/\./g, "").replace(/,/g, ".")))); }
  function fmtMiles(n) { return n ? new Intl.NumberFormat("es-CO").format(n) : ""; }
  // En celulares el monto se marca con un teclado grande propio (no se abre el del sistema); en computador, con el teclado.
  var addTactil = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches), addFecha = "", addDicho = "";
  function abrirRegistro(tipo) {
    addTipo = tipo || "gasto"; addSel = null; addFecha = ""; addDicho = "";
    $("add-monto").value = ""; $("add-concepto").value = ""; $("add-err").textContent = ""; $("add-texto").value = ""; $("add-entendi").hidden = true;
    $("add-teclado").hidden = !addTactil;
    $("add-monto").setAttribute("inputmode", addTactil ? "none" : "numeric");
    renderRegistro();
    sonar("soplo");
    openDlg("dlg-add", addTactil ? null : "#add-monto");
  }
  function addMontoPoner(m) { $("add-monto").value = m ? fmtMiles(m) : ""; $("add-save").textContent = m ? "Registrar " + money(m) : "Registrar"; }
  $("add-teclado").addEventListener("click", function (e) {
    var b = e.target.closest("[data-k]"); if (!b) return;
    var t = String(parseMonto($("add-monto").value) || ""), k = b.dataset.k;
    t = k === "borrar" ? t.slice(0, -1) : (t + k).replace(/^0+/, "");
    if (t.length > 10) return;
    addMontoPoner(+t || 0);
    var caja = document.querySelector("#dlg-add .amount-box"); if (caja) { caja.classList.remove("salta"); void caja.offsetWidth; caja.classList.add("salta"); }
    if (navigator.vibrate && state.prefs.sonidos) try { navigator.vibrate(6); } catch (er) {}
  });
  $("add-frec").addEventListener("click", function (e) {
    var b = e.target.closest("[data-frec]"); if (!b) return;
    var o = chFrecuentes(4)[+b.dataset.frec]; if (!o) return;
    var f = chFila("g", o.cat, o.c);
    addTipo = "gasto";
    if (f && nrm(f.concepto) === nrm(o.c)) addSel = f.id; else { addSel = "__nuevo"; $("add-concepto").value = o.c; addCat = o.cat || "otros"; }
    addMontoPoner(o.m); renderRegistro();
  });
  // Escribirlo como se diría: "$ 18.000 en almuerzo con Nequi", "ayer taxi 12 mil", "me pagaron 50 mil"
  var addTextoT = null;
  $("add-texto").addEventListener("input", function () { clearTimeout(addTextoT); addTextoT = setTimeout(addEntender, 250); });
  $("add-texto").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); clearTimeout(addTextoT); addEntender(); if (parseMonto($("add-monto").value) && addSel) $("add-save").click(); } });
  function addEntender() {
    var txt = $("add-texto").value.trim(), out = $("add-entendi");
    if (!txt) { out.hidden = true; return; }
    var r = chEntender(txt), partes = [];
    addTipo = r.t === "i" ? "ingreso" : "gasto";
    if (r.m) { addMontoPoner(r.m); partes.push("<b>" + money(r.m) + "</b>"); }
    if (r.t === "i") {
      var fi = chFila("i", "", r.c); addSel = fi ? fi.id : "__nuevo"; if (!fi) $("add-concepto").value = r.c || "Otros ingresos";
      partes.push(esc(fi ? fi.concepto : (r.c || "Otros ingresos")));
    } else if (r.cat || r.c) {
      var f = chFila("g", r.cat, r.c);
      if (f && (!r.c || nrm(f.concepto) === nrm(r.c) || !r.cat || f.cat === r.cat)) { addSel = f.id; partes.push(esc(f.concepto) + (r.c && nrm(r.c) !== nrm(f.concepto) ? " (" + esc(r.c) + ")" : "")); }
      else { addSel = "__nuevo"; $("add-concepto").value = r.c || ""; addCat = r.cat || "otros"; partes.push(esc(r.c || "Otro") + (r.cat ? " · " + esc((catById(r.cat) || {}).name || "") : "")); }
    }
    if (r.cuenta) { addCuenta = r.cuenta; partes.push(esc((cuentaById(r.cuenta) || {}).nombre || "")); }
    addFecha = r.f || ""; if (chFechaTxt(addFecha)) partes.push(esc(chFechaTxt(addFecha)));
    addDicho = r.c || "";
    renderRegistro();
    out.hidden = false;
    out.innerHTML = partes.length ? "Entendí: " + partes.join(" · ") + (r.comp ? '. <button type="button" class="link-btn" id="add-a-charla">Es compartido: anotarlo en la charla</button>' : "") : "Todavía no entiendo. Prueba con el monto y en qué fue.";
  }
  $("add-entendi").addEventListener("click", function (e) {
    if (!e.target.closest("#add-a-charla")) return;
    var t = $("add-texto").value; closeDlg("dlg-add"); abrirCharla(t);
  });
  function renderRegistro() {
    Array.prototype.forEach.call($("add-tipo").querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.tipo === addTipo)); });
    var list = addTipo === "gasto" ? cur().gastos : cur().ingresos;
    $("add-q").textContent = addTipo === "gasto" ? "¿En qué gastaste?" : "¿Qué ingreso recibiste?";
    $("add-items").innerHTML = list.map(function (r) {
      var icon = addTipo === "gasto" ? catIcon(r.cat) : '<span class="cat-ic" style="--c:#0ca678"><svg class="ic"><use href="#c-ingreso"/></svg></span>';
      var q = addTipo === "gasto" ? r.plan - r.real : r.plan - r.real;
      var sub = r.plan ? (addTipo === "gasto" ? (q >= 0 ? "Quedan " + money(q) : "Pasado " + money(-q)) : (q > 0 ? "Faltan " + money(q) : "Completo")) : (r.real ? "Llevas " + money(r.real) : "Sin plan");
      return '<button type="button" class="pick burbuja" style="--c:' + (addTipo === "gasto" ? catColor(r.cat) : "#2fbf71") + '" role="radio" aria-checked="' + (addSel === r.id) + '" data-id="' + esc(r.id) + '">' + icon + '<span class="t"><b>' + esc(r.concepto || "Sin nombre") + '</b><small class="' + (addTipo === "gasto" && q < 0 ? "neg" : "") + '">' + sub + "</small></span></button>";
    }).join("") + '<button type="button" class="pick" role="radio" aria-checked="' + (addSel === "__nuevo") + '" data-id="__nuevo"><span class="cat-ic"><svg class="ic"><use href="#i-plus"/></svg></span><span class="t"><b>Otro</b><small>Nuevo concepto</small></span></button>';
    $("add-new").hidden = addSel !== "__nuevo";
    $("add-cats").hidden = addTipo !== "gasto";
    if (addSel === "__nuevo" && addTipo === "gasto") {
      $("add-cats").innerHTML = cats().map(function (c) { return '<button type="button" class="pick burbuja" style="--c:' + catColor(c.id) + '" role="radio" aria-checked="' + (addCat === c.id) + '" data-cat="' + esc(c.id) + '">' + catIcon(c.id) + '<span class="t"><b>' + esc(c.name) + "</b></span></button>"; }).join("");
    }
    if (addCuenta && !cuentaById(addCuenta)) addCuenta = "";
    $("add-cuentas-wrap").hidden = !state.cuentas.length;
    $("add-cuentas").innerHTML = chipsCuentas(addCuenta);
    var m = parseMonto($("add-monto").value);
    $("add-save").textContent = m ? "Registrar " + money(m) : "Registrar";
    var fr = addTipo === "gasto" ? chFrecuentes(4) : [];
    $("add-frec").hidden = !fr.length;
    $("add-frec").innerHTML = fr.map(function (o, i) { return '<button type="button" class="chip-btn" data-frec="' + i + '" style="--c:' + catColor(o.cat) + '"><i class="pt" aria-hidden="true"></i>' + esc(o.c) + " · " + money(o.m) + "</button>"; }).join("");
  }
  $("add-cuentas").addEventListener("click", function (e) { var b = e.target.closest("[data-cuenta]"); if (!b) return; addCuenta = b.dataset.cuenta; this.innerHTML = chipsCuentas(addCuenta); });
  $("fab-add").addEventListener("click", function () { abrirRegistro("gasto"); });
  $("add-tipo").addEventListener("click", function (e) { var b = e.target.closest("[data-tipo]"); if (!b) return; addTipo = b.dataset.tipo; addSel = null; renderRegistro(); });
  $("add-items").addEventListener("click", function (e) { var b = e.target.closest("[data-id]"); if (!b) return; addSel = b.dataset.id; addDicho = ""; renderRegistro(); if (addSel === "__nuevo") $("add-concepto").focus(); });
  $("add-cats").addEventListener("click", function (e) { var b = e.target.closest("[data-cat]"); if (!b) return; addCat = b.dataset.cat; renderRegistro(); });
  $("add-monto").addEventListener("input", function () {
    var m = parseMonto(this.value); this.value = fmtMiles(m);
    $("add-save").textContent = m ? "Registrar " + money(m) : "Registrar";
  });
  $("add-quick").addEventListener("click", function (e) {
    var b = e.target.closest("[data-suma]"); if (!b) return;
    var m = parseMonto($("add-monto").value) + (+b.dataset.suma);
    $("add-monto").value = fmtMiles(m); $("add-save").textContent = "Registrar " + money(m);
  });
  $("add-monto").addEventListener("keydown", function (e) { if (e.key === "Enter") $("add-save").click(); });
  $("add-save").addEventListener("click", function () {
    var m = parseMonto($("add-monto").value), err = $("add-err");
    if (!m) { err.textContent = "Escribe el monto."; $("add-monto").focus(); return; }
    if (!addSel) { err.textContent = addTipo === "gasto" ? "Elige en qué gastaste." : "Elige qué ingreso recibiste."; return; }
    var list = addTipo === "gasto" ? cur().gastos : cur().ingresos, row, nuevo = false;
    if (addSel === "__nuevo") {
      var nombre = $("add-concepto").value.trim();
      if (!nombre) { err.textContent = "Escribe el concepto."; $("add-concepto").focus(); return; }
      row = addTipo === "gasto" ? { id: rid("g"), concepto: nombre.slice(0, 80), cat: addCat, dia: 0, plan: 0, real: 0 } : { id: rid("i"), concepto: nombre.slice(0, 80), plan: 0, real: 0 };
      list.push(row); nuevo = true;
    } else {
      row = list.find(function (r) { return r.id === addSel; });
      if (!row) return;
    }
    var antes = row.real;
    row.real = antes + m;
    var acc = addCuenta ? cuentaById(addCuenta) : null, accAntes = acc ? acc.saldo : 0, regAntes = state.registros.slice();
    if (acc) acc.saldo = accAntes + signoCuenta(acc, addTipo) * m;
    var mov = anotarMov({ t: addTipo === "gasto" ? "g" : "i", cat: row.cat || "", c: addDicho || row.concepto, m: m, f: addFecha || "", com: addDicho || "", cu: acc ? acc.id : "" });
    marcarRegistro();
    closeDlg("dlg-add");
    changed(); renderIngresos(); renderGastos(); recompute(); renderCuentas();
    var html;
    if (addTipo === "gasto") {
      var r = row.plan ? row.real / row.plan : 0, cls = !row.plan ? "" : r > 1 ? "bad" : r >= 0.9 ? "warn" : "";
      html = "<b>" + money(m) + "</b> en " + esc(row.concepto) + ". " + (row.plan ? (row.real <= row.plan ? "Quedan " + money(row.plan - row.real) + "." : "Van " + money(row.real - row.plan) + " más de lo planeado.") : "") +
        (row.plan ? '<div class="tbar"><i class="' + cls + '" style="width:' + Math.min(r * 100, 100).toFixed(1) + '%"></i></div>' : "");
    } else {
      html = "<b>" + money(m) + "</b> de " + esc(row.concepto) + " registrados. ¡Bien!";
    }
    if (acc) html += '<div style="opacity:.8;font-size:13px;margin-top:4px">' + esc(acc.nombre) + " queda en " + money(acc.saldo) + ".</div>";
    toast(html, { action: "Deshacer", ms: 6000, onAction: function () {
      if (nuevo) { var i = list.indexOf(row); if (i > -1) list.splice(i, 1); } else row.real = antes;
      if (acc) acc.saldo = accAntes;
      state.registros = regAntes; quitarMov(mov);
      changed(); renderIngresos(); renderGastos(); recompute(); renderCuentas();
    } });
  });


  // ===================== v5 · Cuentas, pagos, rachas, logros y avisos =====================
  var TIPOS_CUENTA = [
    { id: "banco", name: "Banco", icon: "a-banco", color: "#3b5bdb" },
    { id: "nequi", name: "Nequi", icon: "a-cel", color: "#c2255c" },
    { id: "daviplata", name: "Daviplata", icon: "a-cel", color: "#e03131" },
    { id: "efectivo", name: "Efectivo", icon: "a-efectivo", color: "#2f9e44" },
    { id: "tarjeta", name: "Tarjeta de crédito", icon: "a-tarjeta", color: "#7048e8" },
    { id: "otra", name: "Otra", icon: "a-otra", color: "#868e96" }
  ];
  function tipoCuenta(id) { return TIPOS_CUENTA.find(function (t) { return t.id === id; }) || TIPOS_CUENTA[5]; }
  function cuentaById(id) { return state.cuentas.find(function (c) { return c.id === id; }) || null; }
  // Colores aproximados de cada entidad (solo color y nombre, sin logos). c: tono para fondos con texto, con contraste 4,5 : 1.
  function marcaCuenta(cu) {
    var n = nrm((cu && cu.nombre) || ""), t = (cu && cu.tipo) || "";
    var M = function (c, tx, g, a, sh, clase) { return { c: c, t: tx, g: g, a: a, s: sh, clase: clase }; };
    var clase = t === "efectivo" ? "efectivo" : t === "nequi" || t === "daviplata" ? "billetera" : "tarjeta";
    var bk = t !== "efectivo" && bancoDeCuenta(cu);
    if (bk && bk.id !== "nequi" && bk.id !== "daviplata") return marcaDeBanco(bk, t === "tarjeta" || t === "banco" ? "tarjeta" : bk.g === "d" || bk.tipo === "otra" ? "billetera" : clase);
    if (/nequi/.test(n) || t === "nequi") return M("#da0081", "#fff", "radial-gradient(120% 140% at 0% 0%, #5a1170 0%, #2a0638 45%, #200020 100%)", "#da0081", "rgba(120,0,110,.55)", "billetera");
    if (/daviplata/.test(n) || t === "daviplata") return M("#c8101b", "#fff", "radial-gradient(120% 140% at 0% 0%, #ff5a60 0%, #ed1c24 42%, #a90f17 100%)", "#ffffff", "rgba(190,20,30,.55)", "billetera");
    if (/davivienda/.test(n)) return M("#c8101b", "#fff", "radial-gradient(120% 140% at 0% 0%, #ff5a60 0%, #ed1c24 42%, #a90f17 100%)", "#ffffff", "rgba(190,20,30,.55)", clase);
    if (/bancolombia/.test(n)) return M("#fdda24", "#2c2a29", "radial-gradient(120% 140% at 0% 0%, #fff1a0 0%, #fdda24 40%, #e2ae00 100%)", "#2c2a29", "rgba(200,150,0,.5)", clase);
    if (/(^| )nu( |$)|nubank/.test(n)) return M("#820ad1", "#fff", "radial-gradient(120% 140% at 0% 0%, #b04cf0 0%, #820ad1 45%, #4e0582 100%)", "#ffffff", "rgba(110,10,180,.5)", clase);
    if (/bbva/.test(n)) return M("#1464a5", "#fff", "radial-gradient(120% 140% at 0% 0%, #3d8fd6 0%, #1464a5 45%, #072146 100%)", "#ffffff", "rgba(10,60,120,.5)", clase);
    if (t === "efectivo" || /efectivo|billetera/.test(n)) return M("#237a4b", "#fff", "radial-gradient(120% 140% at 0% 0%, #5cc48a 0%, #2e8b57 45%, #17482e 100%)", "#c8f2d9", "rgba(25,100,60,.5)", "efectivo");
    if (t === "tarjeta") return M("#2a2d35", "#fff", "radial-gradient(120% 140% at 0% 0%, #5b606e 0%, #2a2d35 50%, #121318 100%)", "#ffffff", "rgba(0,0,0,.45)", "tarjeta");
    if (t === "banco") return M("#3a4766", "#fff", "radial-gradient(120% 140% at 0% 0%, #7383a6 0%, #3a4766 50%, #1d2539 100%)", "#ffffff", "rgba(20,30,60,.45)", "tarjeta");
    return M("#5b606e", "#fff", "linear-gradient(135deg, #8a90a0, #5b606e)", "#ffffff", "rgba(0,0,0,.35)", clase);
  }
  var billeteraSel = "";
  function renderBilletera() {
    if (!state.cuentas.length) return "";
    var l = state.cuentas.slice(0, 6), sel = l.some(function (c) { return c.id === billeteraSel; }) ? billeteraSel : l[0].id, i0 = l.findIndex(function (c) { return c.id === sel; });
    var paso = 44, alto = 214 + paso * (l.length - 1);
    return '<div class="billetera" style="--alto:' + alto + 'px" role="group" aria-label="Tus cuentas">' + l.map(function (c, i) {
      var pos = (i - i0 + l.length) % l.length, m = marcaCuenta(c), tj = c.tipo === "tarjeta", t = tipoCuenta(c.tipo);
      var tipo = tj ? "Crédito" : c.tipo === "efectivo" ? "En tu bolsillo" : c.tipo === "nequi" || c.tipo === "daviplata" ? "Billetera" : c.tipo === "banco" ? "Cuenta" : t.name;
      var libre = tj && c.cupo > 0 ? c.cupo - c.saldo : 0, uso = tj && c.cupo > 0 ? Math.min(1, c.saldo / c.cupo) : 0;
      var detalle = m.clase === "tarjeta" ? '<svg class="bt-chip" viewBox="0 0 42 32" aria-hidden="true"><rect x=".5" y=".5" width="41" height="31" rx="7" fill="#e3bc5a" stroke="rgba(80,55,0,.35)"/><rect x=".5" y=".5" width="41" height="14" rx="7" fill="#f7de97" opacity=".7"/><path d="M14 1v30M28 1v30M1 11h13M1 21h13M28 11h13M28 21h13M14 16h14" fill="none" stroke="rgba(90,60,0,.45)" stroke-width="1.2"/></svg><svg class="bt-nfc" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8.5a5 5 0 0 1 0 7M11 6a8.5 8.5 0 0 1 0 12M15 3.5a12 12 0 0 1 0 17"/></svg>'
        : '<span class="bt-ic"><svg class="ic" aria-hidden="true"><use href="#' + (m.clase === "efectivo" ? "i-wallet" : "c-celular") + '"/></svg></span><span>' + (m.clase === "efectivo" ? "Billetes y monedas" : "En tu celular") + "</span>";
      return '<button type="button" class="bt-carta" data-bt="' + esc(c.id) + '" aria-pressed="' + (pos === 0) + '" aria-label="' + esc(c.nombre) + ", " + tipo + ": " + (tj ? "debes " : "") + money(c.saldo) + '"' +
        ' style="--fondo:' + m.g + ";--tinta:" + m.t + ";--aro:" + m.a + ";--sombra:" + m.s + ";--pos:" + pos + ";--y:" + (paso * (l.length - 1 - pos)) + 'px;z-index:' + (20 - pos) + '">' +
        '<span class="bt-arriba"><b>' + esc(c.nombre) + "</b><em>" + esc(tipo) + "</em></span>" +
        '<span class="bt-medio">' + detalle + "</span>" +
        '<span class="bt-saldo"><small>' + (tj ? "Debes" : c.tipo === "efectivo" ? "Tienes" : "Saldo") + "</small><b>" + money(c.saldo) + "</b></span>" +
        '<span class="bt-abajo"><span>' + (tj && c.cupo > 0 ? "Cupo libre " + money(Math.max(0, libre)) : c.saldo < 0 ? "En rojo" : "") + "</span></span>" +
        (tj && c.cupo > 0 ? '<span class="bt-cupo" aria-hidden="true"><i style="width:' + (uso * 100).toFixed(1) + '%"></i></span>' : "") + "</button>";
    }).join("") + "</div>";
  }
  // El color de una cuenta en listas y botones: el de su entidad si se conoce
  function colorCuenta(c) { var b = c.tipo !== "efectivo" && bancoDeCuenta(c); return b ? (b.id === "nequi" ? "#da0081" : b.c === "#ffffff" ? b.a : b.c) : tipoCuenta(c.tipo).color; }
  function acctIcon(c) { var t = tipoCuenta(c.tipo); return '<span class="cat-ic" style="--c:' + colorCuenta(c) + '"><svg class="ic"><use href="#' + t.icon + '"/></svg></span>'; }
  // Un gasto sube la deuda de una tarjeta y baja el saldo de las demás cuentas; un ingreso hace lo contrario.
  function signoCuenta(c, tipo) { var g = tipo !== "ingreso"; return c.tipo === "tarjeta" ? (g ? 1 : -1) : (g ? -1 : 1); }
  function plural(n, s) { return n + " " + (n === 1 ? s : s + "s"); }

  // --- Fechas ---
  function d0(d) { d = d ? new Date(d.getTime ? d.getTime() : d) : new Date(); d.setHours(0, 0, 0, 0); return d; }
  function parseD(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function diasEntre(a, b) { return Math.round((d0(b) - d0(a)) / 864e5); }
  function dim(y, m) { return new Date(y, m, 0).getDate(); }
  function fechaCorta(d) { return d.getDate() + " " + MESES_C[d.getMonth()]; }
  function fechaLarga(d, conAnio) { return d.getDate() + " de " + MESES[d.getMonth()] + (conAnio ? " de " + d.getFullYear() : ""); }

  // --- Ciclos de una cuenta por pagar ---
  function occ(b, k) {
    if (b.f === "mensual") { var y = +k.slice(0, 4), m = +k.slice(5, 7); return new Date(y, m - 1, Math.min(b.dia || 1, dim(y, m))); }
    var f = parseD(b.fecha) || d0();
    if (b.f === "anual") { var yy = +k; return new Date(yy, f.getMonth(), Math.min(f.getDate(), dim(yy, f.getMonth() + 1))); }
    return f;
  }
  function keyDe(b, d) { return b.f === "mensual" ? keyOf(d) : b.f === "anual" ? String(d.getFullYear()) : "u"; }
  function sigKey(b, k, n) { if (b.f === "mensual") return addMonths(k, n); if (b.f === "anual") return String(+k + n); return null; }
  function estadoPago(b, hoy) {
    hoy = hoy || d0();
    var creado = parseD(b.creado) || hoy, k = keyDe(b, hoy);
    if (b.f !== "unica") {
      var kp = sigKey(b, k, -1), dp = occ(b, kp);
      if (!b.pagos[kp] && dp >= creado) return { key: kp, due: dp, pagado: false, dias: diasEntre(hoy, dp) };
    }
    var due = occ(b, k);
    if (b.f !== "unica" && !b.pagos[k] && due < creado) { k = sigKey(b, k, 1); due = occ(b, k); }
    if (b.pagos[k]) {
      var nk = sigKey(b, k, 1), nd = nk ? occ(b, nk) : null;
      return { key: k, due: due, pagado: true, prox: nd, dias: nd ? diasEntre(hoy, nd) : null };
    }
    return { key: k, due: due, pagado: false, dias: diasEntre(hoy, due) };
  }
  function freqTxt(b) {
    if (b.f === "mensual") return "Cada mes, el día " + b.dia;
    var f = parseD(b.fecha);
    if (!f) return b.f === "anual" ? "Cada año" : "Una vez";
    return b.f === "anual" ? "Cada año, el " + fechaLarga(f) : "Una vez, el " + fechaLarga(f, true);
  }
  function chipPago(e, b) {
    if (e.pagado) return '<span class="chip ok">Pagado</span>';
    if (e.dias < 0) return '<span class="chip bad">Vencido hace ' + plural(-e.dias, "día") + "</span>";
    if (e.dias === 0) return '<span class="chip bad">Vence hoy</span>';
    if (e.dias === 1) return '<span class="chip warn">Vence mañana</span>';
    if (e.dias <= Math.max(3, b.aviso)) return '<span class="chip warn">En ' + e.dias + " días</span>";
    return '<span class="chip none">En ' + e.dias + " días</span>";
  }
  // Cada pago lleva el color de su categoría en la cajita de la fecha; el texto encima se elige por luminancia.
  function colorPago(b) {
    var c = catColor(b.cat || "otros"), claro = luminance(c) > 0.32, cal = c;
    // Con letra blanca y pequeña, el fondo se oscurece lo justo para que se lea bien (contraste de 4,5 a 1 o más)
    if (!claro) { var k = 0; while (luminance(cal) > 0.18 && k++ < 12) cal = mezclarHex(cal, "#000000", 0.08); }
    return "--c:" + c + ";--c-cal:" + cal + ";--c-on:" + (claro ? "#14121f" : "#ffffff");
  }
  function mezclarHex(a, b, t) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), r = function (sh) { return Math.round(((x >> sh) & 255) * (1 - t) + ((y >> sh) & 255) * t); };
    return "#" + ((1 << 24) + (r(16) << 16) + (r(8) << 8) + r(0)).toString(16).slice(1);
  }
  function calBox(d) { return '<span class="cal" aria-hidden="true"><small>' + MESES_C[d.getMonth()] + "</small><b>" + d.getDate() + "</b></span>"; }
  function pagosOrdenados() {
    var hoy = d0();
    return state.porPagar.map(function (b) { return { b: b, e: estadoPago(b, hoy) }; }).sort(function (x, y) {
      if (x.e.pagado !== y.e.pagado) return x.e.pagado ? 1 : -1;
      var a = x.e.pagado ? (x.e.prox || x.e.due) : x.e.due, c = y.e.pagado ? (y.e.prox || y.e.due) : y.e.due;
      return a - c;
    });
  }

  // --- Calendario: Google Calendar (todas las versiones) y archivo .ics (sitio propio) ---
  function ymd(d) { return d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2); }
  function rrule(b) {
    if (b.f === "mensual") {
      if (b.dia <= 28) return "RRULE:FREQ=MONTHLY;BYMONTHDAY=" + b.dia;
      var ds = []; for (var i = 28; i <= b.dia; i++) ds.push(i);
      return "RRULE:FREQ=MONTHLY;BYMONTHDAY=" + ds.join(",") + ";BYSETPOS=-1";
    }
    return b.f === "anual" ? "RRULE:FREQ=YEARLY" : "";
  }
  function proxFecha(b) { var e = estadoPago(b); return e.pagado ? (e.prox || e.due) : e.due; }
  function gcalUrl(b) {
    var d = proxFecha(b), d2 = new Date(d); d2.setDate(d2.getDate() + 1);
    var q = "action=TEMPLATE&text=" + encodeURIComponent("Pagar " + b.nombre) + "&dates=" + ymd(d) + "/" + ymd(d2) +
      "&details=" + encodeURIComponent("Monto: " + money(b.monto) + ". Recordatorio de Finti.") + (rrule(b) ? "&recur=" + encodeURIComponent(rrule(b)) : "");
    return "https://calendar.google.com/calendar/render?" + q;
  }
  function icsEsc(t) { return String(t).replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n"); }
  function construirIcs() {
    var now = new Date(), stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    var L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Finti//Pagos//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Finti · Pagos"];
    state.porPagar.forEach(function (b) {
      var d = proxFecha(b), d2 = new Date(d); d2.setDate(d2.getDate() + 1);
      L.push("BEGIN:VEVENT", "UID:" + b.id + "@fintelligente", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + ymd(d), "DTEND;VALUE=DATE:" + ymd(d2),
        "SUMMARY:" + icsEsc("Pagar " + b.nombre + " (" + money(b.monto) + ")"), "DESCRIPTION:" + icsEsc("Recordatorio de Finti. Al pagar, márcalo en la app para sumarlo a tus gastos."), "TRANSP:TRANSPARENT");
      if (rrule(b)) L.push(rrule(b));
      if (b.aviso > 0) L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc(b.nombre + " vence en " + plural(b.aviso, "día")), "TRIGGER:-P" + (b.aviso - 1) + "DT16H", "END:VALARM");
      L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc("Hoy vence " + b.nombre), "TRIGGER:PT8H", "END:VALARM", "END:VEVENT");
    });
    L.push("END:VCALENDAR");
    return L.join("\r\n") + "\r\n";
  }

  // --- Inicio: próximos pagos (reemplaza la función anterior) ---
  function renderPagos() {
    var body = $("pagos-body");
    if (!state.porPagar.length) {
      body.innerHTML = '<div class="locked"><p>Agrega tu arriendo, servicios y cuotas: te avisamos antes de cada vencimiento y, al pagar, se suman solos a tus gastos.</p>' +
        '<button class="btn primary" type="button" data-nuevo-pago>+ Agregar cuenta por pagar</button></div>';
      return;
    }
    var list = pagosOrdenados().filter(function (x) { return !x.e.pagado; }).slice(0, 4);
    var mes = d0(), fin = new Date(mes.getFullYear(), mes.getMonth() + 1, 0), falta = 0, n = 0;
    state.porPagar.forEach(function (b) { var e = estadoPago(b); if (!e.pagado && e.due <= fin) { falta += b.monto; n++; } });
    body.innerHTML = (n ? '<div class="bill-sum"><span>Te faltan <b>' + money(falta) + "</b> en " + plural(n, "pago") + " este mes</span></div>" : '<div class="all-good"><svg class="ic"><use href="#c-ahorro"/></svg>Estás al día con los pagos de este mes.</div>') +
      '<div class="bills">' + list.map(billRowHtml).join("") + "</div>";
  }
  function billRowHtml(x) {
    var b = x.b, e = x.e, d = e.pagado ? (e.prox || e.due) : e.due;
    var sub = money(b.monto) + " · " + (e.pagado ? "Próximo: " + fechaCorta(d) : freqTxt(b));
    return '<div class="bill' + (!e.pagado && e.dias < 0 ? " vencido" : "") + '" data-id="' + esc(b.id) + '" style="' + colorPago(b) + '"><div class="bill-row">' + calBox(d) +
      '<span class="nm"><b>' + esc(b.nombre || "Sin nombre") + "</b><span>" + esc(sub) + '</span></span><span class="act">' + chipPago(e, b) +
      (e.pagado ? "" : '<button class="btn primary" type="button" data-pagar="' + esc(b.id) + '">Pagar</button>') + "</span></div></div>";
  }

  // --- Calendario de pagos: el mes con un punto de color por pago, tocar un día filtra la lista ---
  var calMes = keyOf(new Date()), calDia = "";
  function venceEnMes(b, k) {
    var p = parseKey(k), d;
    if (b.f === "mensual") d = occ(b, k);
    else { var f = parseD(b.fecha); if (!f) return null; d = b.f === "anual" ? new Date(p.y, f.getMonth(), Math.min(f.getDate(), dim(p.y, f.getMonth() + 1))) : f; }
    if (d.getFullYear() !== p.y || d.getMonth() !== p.m - 1) return null;
    // Igual que estadoPago: lo que vencía antes de crear la cuenta por pagar no cuenta (sin fecha de creación, desde hoy)
    var creado = parseD(b.creado) || d0(), pagado = !!b.pagos[keyDe(b, d)];
    if (d < creado && !pagado) return null;
    return { d: d, pagado: pagado };
  }
  function renderCalPagos() {
    var box = $("calpag"); box.hidden = !state.porPagar.length; if (box.hidden) return;
    var p = parseKey(calMes), hoy = d0(), dias = dim(p.y, p.m), primero = (new Date(p.y, p.m - 1, 1).getDay() + 6) % 7, porDia = {}, total = 0, pagado = 0, falta = 0, nFalta = 0;
    state.porPagar.forEach(function (b) {
      var v = venceEnMes(b, calMes); if (!v) return;
      (porDia[v.d.getDate()] = porDia[v.d.getDate()] || []).push({ b: b, pagado: v.pagado });
      total += b.monto; if (v.pagado) pagado += b.monto; else { falta += b.monto; nFalta++; }
    });
    $("calpag-mes").textContent = monthLabel(calMes);
    var html = "";
    for (var i = 0; i < primero; i++) html += '<span class="cp-vacio"></span>';
    for (var d = 1; d <= dias; d++) {
      var l = porDia[d] || [], fecha = new Date(p.y, p.m - 1, d), clave = calMes + "-" + ("0" + d).slice(-2);
      var todos = l.length && l.every(function (x) { return x.pagado; }), vencido = l.some(function (x) { return !x.pagado; }) && fecha < hoy;
      var cls = "cp-dia" + (+fecha === +hoy ? " hoy" : "") + (l.length ? " con" : "") + (todos ? " pagado" : "") + (vencido ? " vencido" : "") + (calDia === clave ? " sel" : "");
      var etiqueta = d + " de " + MESES[p.m - 1] + (l.length ? ": " + l.map(function (x) { return x.b.nombre + " " + money(x.b.monto) + (x.pagado ? ", pagado" : ""); }).join("; ") : "");
      html += '<button type="button" class="' + cls + '" data-dia="' + clave + '"' + (l.length ? "" : " tabindex=\"-1\"") + ' aria-label="' + esc(etiqueta) + '"' + (calDia === clave ? ' aria-pressed="true"' : "") + "><b>" + d + "</b>" +
        (l.length ? '<span class="cp-pts">' + l.slice(0, 3).map(function (x) { return '<i style="--c:' + catColor(x.b.cat || "otros") + '"></i>'; }).join("") + (l.length > 3 ? "<em>+</em>" : "") + "</span>" : "") + "</button>";
    }
    $("calpag-grid").innerHTML = html;
    $("calpag-res").innerHTML = total ? '<span>Pagos del mes: <b class="cifra">' + money(total) + "</b></span>" + (falta ? "<span>Faltan <b class=\"cifra\">" + money(falta) + "</b> en " + plural(nFalta, "pago") + "</span>" : '<span class="ok">Todo pagado</span>') :
      "<span>No hay pagos este mes.</span>";
    // Aviso anticipado: categorías que se pasarían con los pagos que faltan este mes
    var avisos = [];
    if (calMes === keyOf(hoy) && state.mes === calMes) {
      var t = totalsOf(cur()), faltaCat = {};
      // Un pago sin marcar cuyo gasto ya se anotó en el mes (mismo nombre, mismo valor o más) no se cuenta dos veces.
      var yaAnotado = function (b) { return cur().gastos.some(function (r) { return normal(r.concepto) === normal(b.nombre) && r.real >= b.monto; }); };
      Object.keys(porDia).forEach(function (k) { porDia[k].forEach(function (x) { if (!x.pagado && !yaAnotado(x.b)) faltaCat[x.b.cat || "otros"] = (faltaCat[x.b.cat || "otros"] || 0) + x.b.monto; }); });
      Object.keys(faltaCat).forEach(function (c) { var bc = t.byCat[c]; if (bc && bc.plan > 0 && bc.real + faltaCat[c] > bc.plan) avisos.push({ c: c, m: bc.real + faltaCat[c] - bc.plan }); });
    }
    $("calpag-aviso").innerHTML = avisos.map(function (a) { return '<p class="cp-aviso" style="--c:' + catColor(a.c) + '"><svg class="ic" aria-hidden="true"><use href="#i-bell"/></svg><span>Con los pagos que faltan, ' + esc((catById(a.c) || {}).name || "") + " se pasaría <b>" + money(a.m) + "</b> de lo planeado. Si quieres, muévele plata desde otra categoría.</span></p>"; }).join("");
  }
  $("calpag-ant").addEventListener("click", function () { calMes = addMonths(calMes, -1); calDia = ""; renderCalPagos(); renderPorPagar(); });
  $("calpag-sig").addEventListener("click", function () { calMes = addMonths(calMes, 1); calDia = ""; renderCalPagos(); renderPorPagar(); });
  $("calpag-grid").addEventListener("click", function (e) {
    var b = e.target.closest("[data-dia]"); if (!b || !b.classList.contains("con")) return;
    calDia = calDia === b.dataset.dia ? "" : b.dataset.dia; renderCalPagos(); renderPorPagar();
  });

  // --- Cuentas por pagar ---
  var editPago = null;
  function renderPorPagar() {
    var body = $("porpagar-body");
    renderCalPagos();
    var conDia = cur().gastos.filter(function (r) { return r.dia > 0 && !state.porPagar.some(function (b) { return normal(b.nombre) === normal(r.concepto); }); });
    var list = pagosOrdenados(), pagado = 0, falta = 0, mes = d0(), fin = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
    list.forEach(function (x) { if (x.e.pagado && x.e.due.getMonth() === mes.getMonth()) pagado += x.b.monto; else if (!x.e.pagado && x.e.due <= fin) falta += x.b.monto; });
    var html = list.length && !calDia ? '<div class="bill-sum"><span>Por pagar este mes: <b>' + money(falta) + '</b></span><span>Ya pagado: <b>' + money(pagado) + "</b></span></div>" : "";
    if (calDia) {
      var dd = parseD(calDia);
      list = list.filter(function (x) { var v = venceEnMes(x.b, calDia.slice(0, 7)); return v && v.d.getDate() === dd.getDate(); });
      html += '<div class="cp-filtro"><span>Pagos del ' + esc(fechaLarga(dd)) + '</span><button class="link-btn" type="button" id="cp-todos">Ver todos</button></div>';
    }
    html += '<div class="bills">' + list.map(function (x) {
      var b = x.b, e = x.e, d = e.pagado ? (e.prox || e.due) : e.due, abierto = editPago === b.id;
      var sub = money(b.monto) + " · " + freqTxt(b) + (b.cuenta && cuentaById(b.cuenta) ? " · " + cuentaById(b.cuenta).nombre : "");
      var out = '<div class="bill' + (!e.pagado && e.dias < 0 ? " vencido" : "") + '" data-id="' + esc(b.id) + '" style="' + colorPago(b) + '"><div class="bill-row">' + calBox(d) +
        '<span class="nm"><b>' + esc(b.nombre || "Sin nombre") + "</b><span>" + esc(sub) + '</span></span><span class="act">' + chipPago(e, b) +
        (e.pagado ? '<button class="link-btn" type="button" data-despagar="' + esc(b.id) + '">Deshacer</button>' : '<button class="btn primary" type="button" data-pagar="' + esc(b.id) + '">Pagar</button>') +
        '<button class="icon-btn" type="button" data-editar="' + esc(b.id) + '" aria-expanded="' + abierto + '" aria-label="Editar ' + esc(b.nombre) + '" title="Editar"><svg class="ic" style="width:16px;height:16px"><use href="#i-edit"/></svg></button></span></div>';
      if (abierto) {
        out += '<div class="bill-edit">' +
          '<label class="wide">Nombre<input class="field" data-f="nombre" value="' + esc(b.nombre) + '" maxlength="60"></label>' +
          '<label>Monto<input class="field" data-f="monto" type="number" inputmode="numeric" min="0" step="1000" value="' + b.monto + '"></label>' +
          '<label>Se repite<select class="field" data-f="f">' + [["mensual", "Cada mes"], ["anual", "Cada año"], ["unica", "Una sola vez"]].map(function (o) { return '<option value="' + o[0] + '"' + (b.f === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label>" +
          (b.f === "mensual" ? '<label>Día de pago<input class="field" data-f="dia" type="number" inputmode="numeric" min="1" max="31" value="' + b.dia + '"></label>' :
            '<label>Fecha<input class="field" data-f="fecha" type="date" value="' + esc(b.fecha) + '"></label>') +
          '<label>Avisar<select class="field" data-f="aviso">' + [0, 1, 2, 3, 5, 7].map(function (n) { return '<option value="' + n + '"' + (b.aviso === n ? " selected" : "") + ">" + (n ? plural(n, "día") + " antes" : "El mismo día") + "</option>"; }).join("") + "</select></label>" +
          '<label>Categoría<select class="field" data-f="cat">' + catOptions(b.cat) + "</select></label>" +
          '<label>Pagar desde<select class="field" data-f="cuenta"><option value="">Sin definir</option>' + state.cuentas.map(function (c) { return '<option value="' + esc(c.id) + '"' + (b.cuenta === c.id ? " selected" : "") + ">" + esc(c.nombre) + "</option>"; }).join("") + "</select></label>" +
          '<div class="foot"><span class="cal-links"><a class="btn" href="' + esc(gcalUrl(b)) + '" target="_blank" rel="noopener"><svg class="ic"><use href="#i-cal"/></svg> Agregar a Google Calendar</a></span>' +
          '<span class="cal-links"><button class="btn" type="button" data-borrar-pago="' + esc(b.id) + '">Eliminar</button><button class="btn primary" type="button" data-editar="' + esc(b.id) + '">Listo</button></span></div></div>';
      }
      return out + "</div>";
    }).join("") + "</div>";
    if (!list.length) html += '<p class="empty">Aún no tienes cuentas por pagar.</p>';
    html += '<div class="cal-links"><button class="add-btn" type="button" data-nuevo-pago>+ Agregar cuenta por pagar</button><button class="add-btn" type="button" data-escanear-recibo><svg class="ic" aria-hidden="true"><use href="#i-cam"/></svg> Escanear recibo</button>' +
      (conDia.length ? '<button class="add-btn" type="button" id="btn-traer-pagos">Traer ' + plural(conDia.length, "pago") + " con día de tus gastos</button>" : "") + "</div>";
    body.innerHTML = html;
  }
  function normal(t) { return String(t || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function nuevoPago() {
    var b = { id: rid("p"), nombre: "Nueva cuenta", monto: 0, f: "mensual", dia: Math.min(new Date().getDate() + 1, 28), fecha: "", cat: "servicios", cuenta: "", aviso: 2, creado: hoyStr(), pagos: {} };
    state.porPagar.push(b); editPago = b.id; changed();
    irA("cuentas"); renderPorPagar(); renderPagos();
    var el = $("porpagar-body").querySelector('.bill[data-id="' + b.id + '"] [data-f="nombre"]'); if (el) { el.focus(); el.select(); }
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-nuevo-pago]")) { nuevoPago(); return; }
    if (e.target.closest("[data-escanear-recibo]")) { abrirRecibo(); return; }
    var p = e.target.closest("[data-pagar]"); if (p) { abrirPagar(p.dataset.pagar); return; }
    if (e.target.closest("[data-open-avisos]")) abrirAvisos();
  });
  $("porpagar-body").addEventListener("click", function (e) {
    if (e.target.closest("#cp-todos")) { calDia = ""; renderCalPagos(); renderPorPagar(); return; }
    var t = e.target.closest("[data-editar]");
    if (t) { editPago = editPago === t.dataset.editar ? null : t.dataset.editar; renderPorPagar(); return; }
    t = e.target.closest("[data-despagar]");
    if (t) {
      var b = state.porPagar.find(function (x) { return x.id === t.dataset.despagar; }); if (!b) return;
      var e2 = estadoPago(b); delete b.pagos[e2.key]; changed(); renderV5();
      toast("Marcado otra vez como pendiente. Si lo sumaste a tus gastos, ajústalo en Movimientos.");
      return;
    }
    t = e.target.closest("[data-borrar-pago]");
    if (t) {
      if (t.dataset.armado !== "1") { t.dataset.armado = "1"; t.textContent = "¿Seguro? Toca otra vez"; return; }
      state.porPagar = state.porPagar.filter(function (x) { return x.id !== t.dataset.borrarPago; }); editPago = null; changed(); renderV5(); return;
    }
    if (e.target.closest("#btn-traer-pagos")) {
      cur().gastos.filter(function (r) { return r.dia > 0 && !state.porPagar.some(function (b) { return normal(b.nombre) === normal(r.concepto); }); }).forEach(function (r) {
        state.porPagar.push({ id: rid("p"), nombre: r.concepto.slice(0, 60), monto: r.plan, f: "mensual", dia: r.dia, fecha: "", cat: r.cat, cuenta: "", aviso: 2, creado: hoyStr(), pagos: {} });
      });
      changed(); renderV5(); toast("Listo: tus pagos con día quedaron como cuentas por pagar.");
    }
  });
  function onPagoInput(e) {
    var t = e.target, card = t.closest(".bill"); if (!card || !t.dataset.f) return;
    var b = state.porPagar.find(function (x) { return x.id === card.dataset.id; }); if (!b) return;
    var f = t.dataset.f;
    if (f === "nombre") { b.nombre = t.value.slice(0, 60); changed(); return; }
    if (e.type === "input") return;
    if (f === "monto") b.monto = Math.max(0, Math.round(num(t.value)));
    else if (f === "dia") b.dia = clamp(Math.round(num(t.value)) || 1, 1, 31);
    else if (f === "aviso") b.aviso = clamp(+t.value || 0, 0, 15);
    else if (f === "fecha") b.fecha = parseD(t.value) ? t.value : "";
    else if (f === "f") { b.f = t.value; if (b.f !== "mensual" && !b.fecha) b.fecha = hoyStr(new Date(Date.now() + 30 * 864e5)); }
    else b[f] = t.value;
    changed(); renderV5();
    var again = $("porpagar-body").querySelector('.bill[data-id="' + b.id + '"] [data-f="' + f + '"]'); if (again) again.focus();
  }
  $("porpagar-body").addEventListener("input", onPagoInput);
  $("porpagar-body").addEventListener("change", onPagoInput);

  // --- Pagar ---
  var pagarId = null, pagarCuenta = "";
  function chipsCuentas(sel) {
    return '<button type="button" role="radio" aria-pressed="' + (!sel) + '" data-cuenta="">Ninguna</button>' + state.cuentas.map(function (c) {
      return '<button type="button" role="radio" aria-pressed="' + (sel === c.id) + '" data-cuenta="' + esc(c.id) + '" style="--c:' + colorCuenta(c) + '"><i class="dot"></i>' + esc(c.nombre) + "</button>";
    }).join("");
  }
  function filaGasto(m, nombre) { return m.gastos.find(function (r) { return normal(r.concepto) === normal(nombre); }) || null; }
  function abrirPagar(id) {
    var b = state.porPagar.find(function (x) { return x.id === id; }); if (!b) return;
    pagarId = id; pagarCuenta = b.cuenta && cuentaById(b.cuenta) ? b.cuenta : "";
    var e = estadoPago(b), mk = keyOf(e.due), m = state.meses[mk] || cur(), mkey = state.meses[mk] ? mk : state.mes;
    $("dlg-pagar-title").textContent = "Pagar " + (b.nombre || "la cuenta");
    $("pagar-sub").textContent = (e.dias < 0 ? "Venció el " : "Vence el ") + fechaLarga(e.due, true) + ".";
    $("pagar-monto").value = fmtMiles(b.monto);
    $("pagar-cuentas-wrap").hidden = !state.cuentas.length;
    $("pagar-cuentas").innerHTML = chipsCuentas(pagarCuenta);
    var row = filaGasto(m, b.nombre), ya = row && row.plan > 0 && row.real >= row.plan;
    $("pagar-sumar").checked = !ya;
    $("pagar-sumar-t").textContent = "Sumarlo a mis gastos de " + monthLabel(mkey).toLowerCase();
    $("pagar-sumar-s").textContent = ya ? "Ya registraste " + money(row.real) + " en " + row.concepto + ". Déjalo apagado para no contarlo dos veces." :
      row ? "Se suma a " + row.concepto + "." : "Se crea el gasto " + b.nombre + ".";
    openDlg("dlg-pagar", "#pagar-ok");
  }
  $("pagar-cuentas").addEventListener("click", function (e) { var b = e.target.closest("[data-cuenta]"); if (!b) return; pagarCuenta = b.dataset.cuenta; this.innerHTML = chipsCuentas(pagarCuenta); });
  $("pagar-monto").addEventListener("input", function () { this.value = fmtMiles(parseMonto(this.value)); });
  $("pagar-ok").addEventListener("click", function () {
    var b = state.porPagar.find(function (x) { return x.id === pagarId; }); if (!b) return;
    var monto = parseMonto($("pagar-monto").value), e = estadoPago(b);
    var mk = keyOf(e.due), m = state.meses[mk] || cur();
    var undo = { pagos: JSON.parse(JSON.stringify(b.pagos)), regs: state.registros.slice() };
    b.pagos[e.key] = hoyStr();
    if ($("pagar-sumar").checked && monto > 0) {
      var row = filaGasto(m, b.nombre);
      if (row) { undo.row = row; undo.real = row.real; row.real += monto; }
      else { row = { id: rid("g"), concepto: b.nombre.slice(0, 80), cat: b.cat, dia: b.f === "mensual" ? b.dia : e.due.getDate(), plan: b.monto, real: monto }; m.gastos.push(row); undo.nuevo = row; undo.mes = m; }
    }
    var acc = pagarCuenta ? cuentaById(pagarCuenta) : null;
    if (acc && monto > 0) { undo.acc = acc; undo.saldo = acc.saldo; acc.saldo += signoCuenta(acc, "gasto") * monto; }
    if (monto > 0) undo.mov = anotarMov({ t: "g", cat: b.cat, c: b.nombre, m: monto });
    marcarRegistro();
    closeDlg("dlg-pagar");
    changed(); renderIngresos(); renderGastos(); recompute(); renderCuentas();
    var ontime = diasEntre(e.due, d0()) <= 0;
    if (ontime) celebrar();
    toast((ontime ? "¡A tiempo! " : "") + "<b>" + esc(b.nombre) + "</b> quedó pagado." + (acc ? " " + esc(acc.nombre) + " queda en " + money(acc.saldo) + "." : ""), { action: "Deshacer", ms: 6500, onAction: function () {
      b.pagos = undo.pagos; state.registros = undo.regs;
      if (undo.row) undo.row.real = undo.real;
      if (undo.nuevo) { var i = undo.mes.gastos.indexOf(undo.nuevo); if (i > -1) undo.mes.gastos.splice(i, 1); }
      if (undo.acc) undo.acc.saldo = undo.saldo;
      quitarMov(undo.mov);
      changed(); renderIngresos(); renderGastos(); recompute(); renderCuentas();
    } });
  });

  // --- Cuentas de dinero ---
  function renderCuentas() {
    var body = $("cuentas-body"), disp = 0, deuda = 0;
    state.cuentas.forEach(function (c) { if (c.tipo === "tarjeta") deuda += c.saldo; else disp += c.saldo; });
    var html = state.cuentas.length ? '<div class="net"><div class="tile"><span class="label">Dinero disponible</span><span class="value">' + money(disp) + '</span></div>' +
      '<div class="tile"><span class="label">Deuda en tarjetas</span><span class="value' + (deuda > 0 ? " neg" : "") + '">' + money(deuda) + '</span></div>' +
      '<div class="tile"><span class="label">Neto</span><span class="value' + (disp - deuda < 0 ? " neg" : "") + '">' + money(disp - deuda) + "</span></div></div>" : "";
    if (CON_3D) html = renderBilletera() + html;
    html += '<div class="accts">' + state.cuentas.map(function (c) {
      var t = tipoCuenta(c.tipo), tj = c.tipo === "tarjeta", uso = tj && c.cupo > 0 ? c.saldo / c.cupo : 0;
      return '<div class="acct" data-id="' + esc(c.id) + '" style="--c:' + colorCuenta(c) + '"><div class="acct-top">' + acctIcon(c) +
        '<input class="field name" data-f="nombre" value="' + esc(c.nombre) + '" maxlength="40" aria-label="Nombre de la cuenta">' + delBtn(c.nombre) + "</div>" +
        '<div class="bal">' + (c.ini || c.saldo >= 0 ? money(c.saldo) : '<small class="bal-sin">Pon cuánto tenías para ver tu saldo</small>') + "</div>" +
        '<div class="two"><label>Tipo<select class="field" data-f="tipo">' + TIPOS_CUENTA.map(function (o) { return '<option value="' + o.id + '"' + (c.tipo === o.id ? " selected" : "") + ">" + o.name + "</option>"; }).join("") + "</select></label>" +
        "<label>" + (tj ? "Deuda usada" : "Saldo") + '<input class="field" data-f="saldo" type="number" inputmode="numeric" step="1000" value="' + c.saldo + '"></label></div>' +
        (tj ? '<label>Cupo total<input class="field" data-f="cupo" type="number" inputmode="numeric" min="0" step="100000" value="' + c.cupo + '"></label>' +
          (c.cupo > 0 ? '<div class="bar" role="img" aria-label="Usas el ' + pctf(Math.min(uso, 1)) + ' del cupo"><div class="fill" style="width:' + (Math.min(uso, 1) * 100).toFixed(1) + '%"></div></div><span class="hint">Usas el ' + pctf(uso) + " del cupo" + (uso > 0.3 ? ": intenta bajar del 30 %." : ".") + "</span>" : "") : "") +
        "</div>";
    }).join("") + "</div>";
    if (!state.cuentas.length) html += '<p class="empty">Agrega dónde tienes tu plata para ver tu dinero disponible en un solo lugar.</p>';
    html += '<button class="add-btn" type="button" id="add-cuenta">+ Agregar cuenta</button>';
    body.innerHTML = html;
  }
  function onCuentaInput(e) {
    var t = e.target, card = t.closest(".acct"); if (!card || !t.dataset.f) return;
    var c = cuentaById(card.dataset.id); if (!c) return;
    var f = t.dataset.f;
    if (f === "nombre") { c.nombre = t.value.slice(0, 40); var bb = bancoPorId(c.banco); if (c.banco && (!bb || !bb.re.test(" " + bkNrm(c.nombre) + " "))) delete c.banco; changed(); return; }
    if (e.type === "input") return;
    if (f === "tipo") c.tipo = t.value; else if (f === "saldo") { c.saldo = Math.round(num(t.value)); c.ini = true; } else if (f === "cupo") c.cupo = Math.max(0, Math.round(num(t.value)));
    changed(); renderCuentas(); checkLogros();
    var again = $("cuentas-body").querySelector('.acct[data-id="' + c.id + '"] [data-f="' + f + '"]'); if (again) again.focus();
  }
  $("cuentas-body").addEventListener("click", function (e) { var b = e.target.closest("[data-bt]"); if (!b) return; vibrar(8); billeteraSel = b.dataset.bt; renderCuentas(); var n = $("cuentas-body").querySelector('[data-bt="' + b.dataset.bt + '"]'); if (n) n.focus(); });
  $("cuentas-body").addEventListener("input", onCuentaInput);
  $("cuentas-body").addEventListener("change", onCuentaInput);
  $("cuentas-body").addEventListener("click", function (e) {
    if (e.target.closest("#add-cuenta")) { abrirBancos(); return; }
    var b = e.target.closest("[data-del]"); if (!b) return;
    var id = b.closest(".acct").dataset.id;
    state.cuentas = state.cuentas.filter(function (x) { return x.id !== id; });
    state.porPagar.forEach(function (p) { if (p.cuenta === id) p.cuenta = ""; });
    changed(); renderCuentas();
  });

  // --- Rachas ---
  // Anota un movimiento con su fecha y hora para que el asesor aprenda los patrones de gasto.
  function anotarMov(o) {
    metrica("registro", "una");
    var d = new Date(), h = o.hora && /^\d{1,2}:/.test(o.hora) ? parseInt(o.hora, 10) : (o.f && o.f !== hoyStr() ? -1 : d.getHours());
    var x = { id: rid("v"), f: o.f || hoyStr(), h: h, t: o.t === "i" ? "i" : "g", cat: o.cat || "", c: String(o.c || "").slice(0, 80), m: Math.round(o.m), com: String(o.com || "").slice(0, 60) };
    if (o.o) x.o = o.o;
    if (o.cu) x.cu = String(o.cu).slice(0, 30);
    if (o.det && o.det.length) x.det = o.det.slice(0, 25).map(function (d) { return { n: String(d.n || "").slice(0, 40), q: String(d.q || "").slice(0, 12), m: Math.max(0, Math.round(d.m || 0)) }; });
    if (!(x.m > 0)) return null;
    if (x.t === "g" && state.prefs.redondeo) {
      var paso = state.prefs.redondeoA || 1000, rd = Math.ceil(x.m / paso) * paso - x.m;
      if (rd > 0) { x.rd = rd; var ka = x.f.slice(0, 7), al = state.alcancia[ka] || (state.alcancia[ka] = { j: 0, p: 0 }); al.j += rd; }
    }
    state.movs.push(x); if (state.movs.length > 1500) state.movs = state.movs.slice(-1500);
    setTimeout(function () { if (x.t === "g") sonarGasto(x.cat); else sonar("monedas"); }, 0);
    return x;
  }
  function quitarMov(x) {
    if (!x) return; var i = state.movs.indexOf(x); if (i > -1) state.movs.splice(i, 1);
    var al = x.rd && state.alcancia[x.f.slice(0, 7)]; if (al) al.j = Math.max(0, al.j - x.rd);
  }
  function marcarRegistro() { var h = hoyStr(); if (state.registros[state.registros.length - 1] !== h) state.registros.push(h); state.registros = state.registros.slice(-400); }
  function diasActivos() { var set = {}; state.actividad.concat(state.registros, state.sinGasto).forEach(function (d) { set[d] = 1; }); return set; }
  function simRacha() {
    var set = diasActivos(), dias = Object.keys(set).sort(), hoy = d0(), hs = hoyStr(hoy);
    var res = { actual: 0, max: 0, comodines: 0, congelados: {}, hoy: !!set[hs] };
    if (!dias.length) return res;
    var d = parseD(dias[0]), r = 0, com = 0, guard = 0;
    while (d <= hoy && guard++ < 800) {
      var s = hoyStr(d);
      if (set[s]) { r++; if (r % 7 === 0 && com < 2) com++; }
      else if (s !== hs) { if (r > 0 && com > 0) { com--; res.congelados[s] = 1; } else r = 0; }
      if (r > res.max) res.max = r;
      d.setDate(d.getDate() + 1);
    }
    res.actual = r; res.comodines = com;
    return res;
  }
  function mesAhorro(k) { var t = totalsOf(state.meses[k]); return t.ingReal > 0 && t.saldo >= 0 && t.ahorro > 0; }
  function rachaMeses() {
    var nk = nowKey(), ks = monthKeys().filter(function (k) { return k <= nk; }), max = 0, run = 0, prev = null;
    ks.forEach(function (k) {
      if (prev && addMonths(prev, 1) !== k) run = 0;
      if (mesAhorro(k)) { run++; if (run > max) max = run; } else if (k !== nk) run = 0;
      prev = k;
    });
    var n = 0, next = null;
    for (var i = ks.length - 1; i >= 0; i--) {
      var k = ks[i];
      if (next && addMonths(k, 1) !== next) break;
      if (mesAhorro(k)) n++; else if (k !== nk) break;
      next = k;
    }
    return { actual: n, max: max };
  }
  function rachaPagos() {
    var ev = [], hoy = d0();
    state.porPagar.forEach(function (b) {
      Object.keys(b.pagos).forEach(function (k) { var p = parseD(b.pagos[k]); if (p) ev.push({ due: occ(b, k), ok: p <= occ(b, k) }); });
      var e = estadoPago(b, hoy); if (!e.pagado && e.dias < 0) ev.push({ due: e.due, ok: false });
    });
    ev.sort(function (a, b) { return b.due - a.due; });
    var n = 0; while (n < ev.length && ev[n].ok) n++;
    var max = 0, run = 0; ev.slice().reverse().forEach(function (x) { if (x.ok) { run++; if (run > max) max = run; } else run = 0; });
    return { actual: n, max: max };
  }

  // --- Logros ---
  var LOGROS = [
    { id: "primer", ic: "i-sprout", n: "Primer paso", d: "Registra tu primer movimiento." },
    { id: "racha7", ic: "i-flame", n: "Semana encendida", d: "Lleva 7 días seguidos organizando tu plata." },
    { id: "racha30", ic: "i-trophy", n: "Mes imparable", d: "Lleva 30 días seguidos organizando tu plata." },
    { id: "cero3", ic: "i-snow", n: "Días en cero", d: "Marca 3 días sin gastos." },
    { id: "verde", ic: "i-check-circle", n: "Mes en verde", d: "Cierra un mes con saldo positivo y todas las categorías dentro del plan." },
    { id: "ahorro20", ic: "i-coins", n: "Club del 20 %", d: "Ahorra el 20 % o más de tus ingresos en un mes." },
    { id: "meses3", ic: "i-trend", n: "Tres en fila", d: "Ahorra 3 meses seguidos." },
    { id: "pagos5", ic: "i-cal", n: "Puntual", d: "Paga 5 cuentas seguidas a tiempo." },
    { id: "cuentas2", ic: "i-wallet", n: "Todo a la vista", d: "Registra al menos 2 cuentas de dinero." },
    { id: "meta", ic: "i-target", n: "Meta cumplida", d: "Completa una meta de ahorro." },
    { id: "reto10", ic: "i-piggy", n: "Alcancía en marcha", d: "Completa 10 semanas del reto de las 52 semanas." },
    { id: "deuda", ic: "i-feather", n: "Libre de una deuda", d: "Deja una deuda en cero." },
    { id: "redondeo", ic: "i-piggy", n: "Centavo a centavo", d: "Pasa a tu ahorro $ 20.000 juntados con el redondeo." },
    { id: "historia", ic: "i-chart", n: "Tu mes contado", d: "Mira las historias de un mes completo." },
    { id: "amigos", ic: "i-trophy", n: "Mejor en equipo", d: "Cumple todos los días de un reto con amigos." }
  ];
  // Colores de cada medalla (cinta y disco)
  var MEDALLA = { primer: ["#19c3a0", "#0f8f75"], racha7: ["#ff9f1c", "#e8590c"], racha30: ["#ffc53d", "#e0a420"], cero3: ["#4dabf7", "#1c7ed6"], verde: ["#40c057", "#2b8a3e"],
    ahorro20: ["#ffc53d", "#c98a00"], meses3: ["#7c5cff", "#5b3fd6"], pagos5: ["#ff5c9a", "#d6336c"], cuentas2: ["#22b8cf", "#1098ad"], meta: ["#f76707", "#c2410c"],
    reto10: ["#ff8fb8", "#e64980"], deuda: ["#94d82d", "#5c940d"], redondeo: ["#ffd43b", "#f08c00"], historia: ["#b197fc", "#7048e8"], amigos: ["#63e6be", "#0ca678"] };
  function medalla(l, ganado) {
    var c = MEDALLA[l.id] || ["#7c5cff", "#5b3fd6"], a = ganado ? c[0] : "#d9d5e4", b = ganado ? c[1] : "#b9b4c8";
    return '<svg class="medalla" viewBox="0 0 48 58" aria-hidden="true">' +
      '<path d="M15 31 9 55l7-4 4 6 5-20Z" fill="' + b + '"/><path d="M33 31l6 24-7-4-4 6-5-20Z" fill="' + b + '" opacity=".8"/>' +
      '<circle cx="24" cy="22" r="19" fill="' + b + '"/><circle cx="24" cy="21" r="17.5" fill="' + a + '"/>' +
      '<circle cx="24" cy="21" r="13.5" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" stroke-dasharray="1.6 2.4"/>' +
      (ganado ? '<path d="M12 13a14 14 0 0 1 9-6" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round" fill="none"/>' : "") +
      '<svg x="14" y="11" width="20" height="20" viewBox="0 0 24 24" class="ic" style="color:#fff;stroke-width:2.3"><use href="#' + (ganado ? l.ic : "i-lock") + '"/></svg></svg>';
  }
  function logrosGanados() {
    var r = simRacha(), m = rachaMeses(), p = rachaPagos(), g = {};
    var algo = monthKeys().some(function (k) { var x = state.meses[k]; return x.ingresos.some(function (i) { return i.real > 0; }) || x.gastos.some(function (i) { return i.real > 0; }); });
    var verde = false, a20 = false;
    monthKeys().forEach(function (k) {
      var t = totalsOf(state.meses[k]);
      if (t.ingReal > 0 && t.ahorro / t.ingReal >= 0.2) a20 = true;
      if (t.ingReal > 0 && t.saldo >= 0 && t.gasReal > 0 && Object.keys(t.byCat).every(function (id) { var x = t.byCat[id], c = catById(id) || { group: "gus" }; return c.group === "aho" || !x.plan || x.real <= x.plan; })) verde = true;
    });
    if (algo) g.primer = 1;
    if (r.max >= 7) g.racha7 = 1;
    if (r.max >= 30) g.racha30 = 1;
    if (state.sinGasto.length >= 3) g.cero3 = 1;
    if (verde) g.verde = 1;
    if (a20) g.ahorro20 = 1;
    if (m.max >= 3) g.meses3 = 1;
    if (p.max >= 5) g.pagos5 = 1;
    if (state.cuentas.length >= 2) g.cuentas2 = 1;
    if (state.metas.some(function (x) { return x.objetivo > 0 && x.ahorrado >= x.objetivo; })) g.meta = 1;
    if (state.reto.hechas.length >= 10) g.reto10 = 1;
    if (state.deudas.some(function (d) { return d.nombre && d.saldo === 0; })) g.deuda = 1;
    if (Object.keys(state.alcancia).reduce(function (s2, k) { return s2 + state.alcancia[k].p; }, 0) >= 20000) g.redondeo = 1;
    if (state.logros.indexOf("historia") > -1 || logroExtra.historia) g.historia = 1;
    if (state.logros.indexOf("amigos") > -1 || Object.keys(raCache).some(function (c) { var v = raCache[c], yo = v.participantes.find(function (p) { return p.yo; }); return yo && yo.cumplidos >= v.dias; })) g.amigos = 1;
    return g;
  }
  var logrosNuevos = {}, logroExtra = {};
  function checkLogros(silencio) {
    if (state.ejemplo) return;   // los datos de ejemplo no reparten logros
    if ($("dlg-inicio") && !$("dlg-inicio").hidden) return;   // durante el inicio guiado no se tapa el botón: se celebra al cerrar
    var g = logrosGanados(), vistos = {}, nuevos = [];
    state.logros.forEach(function (id) { vistos[id] = 1; });
    LOGROS.forEach(function (l) { if (g[l.id] && !vistos[l.id]) { nuevos.push(l); state.logros.push(l.id); } });
    if (!nuevos.length) return;
    if (!silencio) {
      nuevos.forEach(function (l) { logrosNuevos[l.id] = 1; });
      celebrar();
      toast('<span class="toast-ic">' + icono(nuevos[0].ic) + "</span> ¡Nuevo logro: <b>" + esc(nuevos[0].n) + "</b>!" + (nuevos.length > 1 ? " Y " + plural(nuevos.length - 1, "logro") + " más." : ""), { ms: 5200 });
    }
    renderRachas();
  }

  function renderRachas() {
    var r = simRacha(), m = rachaMeses(), p = rachaPagos();
    var dots = "", hoy = d0(), set = diasActivos();
    for (var i = 6; i >= 0; i--) {
      var d = new Date(hoy); d.setDate(d.getDate() - i); var s = hoyStr(d);
      var cls = set[s] ? "on" : r.congelados[s] ? "frz" : i === 0 ? "hoy" : "";
      dots += '<i class="' + cls + '" title="' + esc(fechaLarga(d)) + (set[s] ? ": activo" : r.congelados[s] ? ": salvado con un comodín" : "") + '">' + (r.congelados[s] ? icono("i-snow") : "") + "</i>";
    }
    $("rachas").innerHTML =
      '<div class="stk' + (r.actual ? " on" : " off") + '" style="--c:#ff9f1c"><span class="em" aria-hidden="true">' + icono("i-flame") + '</span><b>' + r.actual + "</b><span>" + (r.actual === 1 ? "día seguido" : "días seguidos") + " organizando tu plata</span>" +
        '<div class="week" aria-hidden="true">' + dots + "</div>" + (r.comodines ? '<span class="comodin" title="Cada 7 días de racha ganas un comodín (máximo 2). Si un día no entras, el comodín salva tu racha.">' + icono("i-snow") + ' ' + plural(r.comodines, "comodín").replace("comodíns", "comodines") + "</span>" : "") + "</div>" +
      '<div class="stk' + (m.actual ? "" : " off") + '" style="--c:#ffc53d"><span class="em" aria-hidden="true">' + icono("i-coins") + '</span><b>' + m.actual + "</b><span>" + (m.actual === 1 ? "mes ahorrando" : "meses seguidos ahorrando") + "</span></div>" +
      '<div class="stk' + (p.actual ? "" : " off") + '" style="--c:#7c5cff"><span class="em" aria-hidden="true">' + icono("i-cal") + '</span><b>' + p.actual + "</b><span>" + (p.actual === 1 ? "pago a tiempo" : "pagos seguidos a tiempo") + "</span></div>";
    var g = {}; state.logros.forEach(function (id) { g[id] = 1; });
    var n = LOGROS.filter(function (l) { return g[l.id]; }).length;
    $("logros-count").textContent = state.ejemplo ? "Con tus cifras ganas logros" : "Logros: " + n + " de " + LOGROS.length;
    // En vez de la cuadrícula con los pendientes en gris: el próximo logro con su avance, los ganados en color
    // y la lista completa solo si la persona la pide.
    var badge = function (l) {
      return '<button type="button" class="badge' + (g[l.id] ? "" : " off") + (logrosNuevos[l.id] ? " new" : "") + '" data-logro="' + l.id + '" title="' + esc(l.n + ". " + l.d) + '" aria-label="' + esc(l.n + (g[l.id] ? " (ganado)" : " (pendiente)") + ". " + l.d) + '">' + medalla(l, !!g[l.id]) + '<span class="bd-n">' + esc(l.n) + "</span></button>";
    };
    var prox = proximoLogro(g), ganados = LOGROS.filter(function (l) { return g[l.id]; });
    $("logros").innerHTML =
      (prox ? '<div class="prox-logro"><span class="pl-ic">' + medalla(prox.l, false).replace("i-lock", prox.l.ic) + '</span><div class="pl-tx"><small>Tu próximo logro</small><b>' + esc(prox.l.n) + "</b><span>" + esc(prox.l.d) + "</span>" +
        '<div class="pl-bar" role="progressbar" aria-label="Avance" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(prox.a * 100) + '"><i style="width:' + Math.max(4, Math.round(prox.a * 100)) + '%"></i></div></div></div>'
        : '<p class="pl-todos">' + icono("i-trophy") + " ¡Tienes todos los logros!</p>") +
      (ganados.length ? '<div class="badges-ganados" aria-label="Logros ganados">' + ganados.map(badge).join("") + "</div>" : "") +
      '<button type="button" class="link-btn pl-ver" data-ver-logros aria-expanded="' + (verLogros ? "true" : "false") + '">' + (verLogros ? "Ocultar la lista" : "Ver los " + LOGROS.length + " logros") + "</button>" +
      '<div class="badges"' + (verLogros ? "" : " hidden") + ">" + LOGROS.map(badge).join("") + "</div>";
  }
  var verLogros = false;
  // Cuánto falta para cada logro pendiente (0 a 1); el próximo es el que va más adelantado.
  function avanceLogro(id) {
    var r = simRacha(), m = rachaMeses(), p = rachaPagos(), mejor = 0;
    switch (id) {
      case "racha7": return r.actual / 7;
      case "racha30": return r.actual / 30;
      case "cero3": return state.sinGasto.length / 3;
      case "ahorro20":
        monthKeys().forEach(function (k) { var t = totalsOf(state.meses[k]); if (t.ingReal > 0) mejor = Math.max(mejor, t.ahorro / t.ingReal / 0.2); });
        return mejor;
      case "meses3": return m.actual / 3;
      case "pagos5": return p.actual / 5;
      case "cuentas2": return state.cuentas.length / 2;
      case "meta": state.metas.forEach(function (x) { if (x.objetivo > 0) mejor = Math.max(mejor, x.ahorrado / x.objetivo); }); return mejor;
      case "reto10": return state.reto.hechas.length / 10;
      case "redondeo": return Object.keys(state.alcancia).reduce(function (s2, k) { return s2 + state.alcancia[k].p; }, 0) / 20000;
      default: return 0;
    }
  }
  function proximoLogro(g) {
    var mejor = null;
    LOGROS.forEach(function (l) {
      if (g[l.id]) return;
      var a = Math.max(0, Math.min(0.99, avanceLogro(l.id) || 0));
      if (!mejor || a > mejor.a) mejor = { l: l, a: a };
    });
    return mejor;
  }
  $("logros").addEventListener("click", function (e) {
    if (e.target.closest("[data-ver-logros]")) { verLogros = !verLogros; renderRachas(); return; }
    var b = e.target.closest("[data-logro]"); if (!b) return;
    var l = LOGROS.find(function (x) { return x.id === b.dataset.logro; }), ok = state.logros.indexOf(l.id) > -1;
    delete logrosNuevos[l.id]; b.classList.remove("new");
    toast('<span class="toast-ic">' + icono(l.ic) + "</span> <b>" + esc(l.n) + "</b>. " + esc(l.d) + (ok ? " ¡Ya lo tienes!" : ""), { ms: 4500 });
  });

  // --- Un solo aviso arriba a la vez ---
  // Cada aviso decide por su cuenta si aplica (atributo hidden); aquí solo se deja ver el más importante y los demás
  // esperan su turno (clase aviso-espera). Cuando el de arriba se cierra, aparece el siguiente. Primero lo que llegó
  // de los bancos; con datos de ejemplo, armar el presupuesto va antes que el recordatorio del día.
  var AVISOS_ORDEN = ["bandeja-banner", "example-notice", "nudge", "nudge-cuenta", "nudge-lectura"];
  function unAviso() {
    var ya = false;
    AVISOS_ORDEN.forEach(function (id) {
      var el = $(id); if (!el) return;
      var espera = ya && !el.hidden;
      el.classList.toggle("aviso-espera", espera);
      if (!el.hidden && !espera) ya = true;
    });
  }
  try {
    var obsAvisos = new MutationObserver(function () { unAviso(); });
    AVISOS_ORDEN.forEach(function (id) { if ($(id)) obsAvisos.observe($(id), { attributes: true, attributeFilter: ["hidden"] }); });
  } catch (e) {}

  // --- Recordatorio amable para registrar gastos espontáneos ---
  var NUDGE_KEY = "fintelligente-recordatorio";
  function renderNudge() {
    var h = hoyStr(), set = {}, cerrado = "";
    state.registros.concat(state.sinGasto).forEach(function (d) { set[d] = 1; });
    try { cerrado = localStorage.getItem(NUDGE_KEY) || ""; } catch (e) {}
    $("nudge").hidden = !(loaded && state.avisos.registro && new Date().getHours() >= 18 && !set[h] && cerrado !== h);
  }
  $("nudge-reg").addEventListener("click", function () { abrirRegistro("gasto"); });
  $("nudge-x").addEventListener("click", function () { try { localStorage.setItem(NUDGE_KEY, hoyStr()); } catch (e) {} renderNudge(); });
  $("nudge-no").addEventListener("click", function () {
    var antes = simRacha().actual, h = hoyStr();
    if (state.sinGasto.indexOf(h) < 0) state.sinGasto.push(h);
    state.sinGasto = state.sinGasto.slice(-400);
    changed(); renderNudge(); renderRachas();
    var mes = state.sinGasto.filter(function (d) { return d.slice(0, 7) === h.slice(0, 7); }).length;
    if (simRacha().actual > antes) celebrar();
    toast("Día en cero. Llevas " + plural(mes, "día") + " sin gastos este mes.");
  });

  // --- Aviso de pagos dentro de la app (máximo uno al día) ---
  var PAGOS_KEY = "fintelligente-aviso-pagos";
  function avisoPagosApp() {
    if (!state.avisos.pagos || !state.porPagar.length || state.ejemplo) return;
    var h = hoyStr(); try { if (localStorage.getItem(PAGOS_KEY) === h) return; } catch (e) {}
    var lst = pagosOrdenados().filter(function (x) { return !x.e.pagado && x.e.dias <= Math.max(x.b.aviso, 0); });
    if (!lst.length) return;
    try { localStorage.setItem(PAGOS_KEY, h); } catch (e) {}
    var x = lst[0], txt = x.e.dias < 0 ? "<b>" + esc(x.b.nombre) + "</b> está vencido." : x.e.dias === 0 ? "Hoy vence <b>" + esc(x.b.nombre) + "</b>." :
      "<b>" + esc(x.b.nombre) + "</b> vence " + (x.e.dias === 1 ? "mañana" : "en " + x.e.dias + " días") + ".";
    toast(txt + (x.b.monto > 0 ? " " + money(x.b.monto) : "") + (lst.length > 1 ? ", y " + plural(lst.length - 1, "pago") + " más." : ""), { action: "Ver", ms: 8000, onAction: function () { irA("cuentas"); } });
  }

  // --- Reto de las 52 semanas ---
  var retoBase = 5000;
  function renderReto() {
    var r = state.reto, body = $("reto-body");
    if (!r.inicio) {
      body.innerHTML = '<p class="hint">Cada semana guardas un poco más que la anterior: en la semana 1 guardas una vez la base, en la 2, dos veces, y así hasta la 52. Al final reúnes <b>' + money(retoBase * 1378) + "</b>.</p>" +
        '<div class="seg" id="reto-base" role="group" aria-label="Base semanal">' + [2000, 5000, 10000].map(function (b) { return '<button type="button" data-base="' + b + '" aria-pressed="' + (b === retoBase) + '">' + money(b) + "</button>"; }).join("") + "</div>" +
        '<button class="btn primary" type="button" id="reto-go">Empezar el reto</button>';
      return;
    }
    var hechas = {}; r.hechas.forEach(function (n) { hechas[n] = 1; });
    var total = r.hechas.reduce(function (s, n) { return s + n * r.base; }, 0), meta = r.base * 1378;
    var sem = clamp(Math.floor(diasEntre(parseD(r.inicio), d0()) / 7) + 1, 1, 52), cells = "";
    for (var n = 1; n <= 52; n++) cells += '<button type="button" data-sem="' + n + '" class="' + (hechas[n] ? "done" : "") + (n === sem ? " now" : "") + '" aria-pressed="' + !!hechas[n] + '" title="Semana ' + n + ": " + money(n * r.base) + '">' + n + "</button>";
    body.innerHTML = '<div class="reto-top"><span>Llevas <b>' + money(total) + "</b> de " + money(meta) + '</span><span>Semana ' + sem + ": te toca guardar <b>" + money(sem * r.base) + "</b></span></div>" +
      '<div class="bar" role="img" aria-label="' + pctf(total / meta) + ' del reto"><div class="fill" style="width:' + (total / meta * 100).toFixed(1) + '%"></div></div>' +
      '<div class="reto-grid" id="reto-grid">' + cells + "</div>" +
      '<p class="hint">Toca cada semana cuando guardes su monto. ' + plural(r.hechas.length, "semana") + ' completada' + (r.hechas.length === 1 ? "" : "s") + '. <button class="link-btn" type="button" id="reto-reset">Reiniciar el reto</button></p>';
  }
  $("reto-body").addEventListener("click", function (e) {
    var b = e.target.closest("[data-base]");
    if (b) { retoBase = +b.dataset.base; renderReto(); return; }
    if (e.target.closest("#reto-go")) { state.reto = { base: retoBase, inicio: hoyStr(), hechas: [] }; changed(); renderReto(); toast("Reto iniciado. Esta semana guarda " + money(retoBase) + "."); return; }
    if (e.target.closest("#reto-reset")) {
      var rb = e.target.closest("#reto-reset");
      if (rb.dataset.armado !== "1") { rb.dataset.armado = "1"; rb.textContent = "¿Seguro? Toca otra vez"; return; }
      state.reto = { base: state.reto.base, inicio: "", hechas: [] }; changed(); renderReto(); return;
    }
    var c = e.target.closest("[data-sem]"); if (!c) return;
    var n = +c.dataset.sem, i = state.reto.hechas.indexOf(n);
    if (i > -1) state.reto.hechas.splice(i, 1);
    else {
      state.reto.hechas.push(n); marcarRegistro();
      var k = state.reto.hechas.length;
      if (k % 10 === 0 || k === 52) celebrar();
      toast("+" + money(n * state.reto.base) + " a tu alcancía." + (k === 52 ? " ¡Completaste el reto!" : ""));
    }
    changed(); renderReto(); renderRachas();
  });

  // --- Avisos ---
  var AV_KEY = "fintelligente-avisos", avDev = null, avTimer = null, avCfg = { vapid: "", correo: false };
  function randStr(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]; }).join(""); }
  function avLoad() {
    try { avDev = JSON.parse(localStorage.getItem(AV_KEY) || "null"); } catch (e) { avDev = null; }
    if (!avDev || !/^[a-z0-9]{20}$/.test(avDev.id || "")) avDev = { id: randStr(20), token: randStr(32), push: false, sub: null, email: "", correo: false, consejos: "semanal", hora: 20, registrado: false };
  }
  function avSave() { try { localStorage.setItem(AV_KEY, JSON.stringify(avDev)); } catch (e) {} }
  function avActivo() { return !!avDev && (!!(avDev.push && avDev.sub) || !!(avDev.correo && avDev.email)); }
  function avMsg(t, cls) { var el = $("av-msg"); el.textContent = t; el.className = "msg" + (cls ? " " + cls : ""); }
  function ultimoRegistro() { return state.registros.concat(state.sinGasto).sort().pop() || ""; }
  function avPayload() {
    return { id: avDev.id, token: avDev.token, push: avDev.push ? avDev.sub : null, email: avDev.correo ? avDev.email : "", licencia: licencia || null,
      tz: -new Date().getTimezoneOffset(), hora: avDev.hora, consejos: avDev.consejos, ultimo: ultimoRegistro(), efectivo: !!avDev.efectivo, manana: !!avDev.manana,
      dudas: Math.min(9, dudasVigentes().length), preguntar: avDev.preguntar !== false,
      pagos: state.porPagar.slice(0, 40).map(function (b) { return { n: b.nombre, m: b.monto, f: b.f, d: b.dia, fe: b.fecha, a: b.aviso, c: b.creado, p: Object.keys(b.pagos).sort().slice(-3) }; }) };
  }
  function huella(t) { var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return t.length + "." + h; }
  function syncAvisos(soloSiCambio) {
    if (!WEB || !avDev) return Promise.resolve({});
    if (!avActivo()) {
      if (!avDev.registrado) return Promise.resolve({ ok: true });
      return api("/api/avisos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: avDev.id, token: avDev.token }) })
        .then(function (j) { avDev.registrado = false; avSave(); return j; });
    }
    var cuerpo = JSON.stringify(avPayload()), hu = huella(cuerpo);
    if (soloSiCambio && avDev.registrado && avDev.huella === hu && Date.now() - (avDev.enviado || 0) < 86400000) return Promise.resolve({ ok: true, igual: true });
    return api("/api/avisos", { method: "POST", headers: { "Content-Type": "application/json" }, body: cuerpo })
      .then(function (j) { if (j.ok) { avDev.registrado = true; avDev.huella = hu; avDev.enviado = Date.now(); avSave(); } return j; });
  }
  function programarAvisos() { if (!WEB || !avActivo()) return; clearTimeout(avTimer); avTimer = setTimeout(function () { syncAvisos(true).catch(function () {}); }, 4000); }
  function b64u(s) { var p = "====".slice(0, (4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")), out = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out; }
  function esIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
  function instalada() { try { return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; } }
  function activarPush() {
    if (!avCfg.vapid) { avMsg("Las notificaciones todavía no están configuradas en este sitio.", "err"); return; }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      avMsg(esIOS() && !instalada() ? "En iPhone, primero instala la app. En Safari toca Compartir y luego Agregar a inicio. Abre Finti desde ese ícono y activa aquí las notificaciones." :
        "Este navegador no permite notificaciones. Prueba con Chrome, Edge, Firefox o Safari.", "err");
      return;
    }
    avMsg("Activando…");
    navigator.serviceWorker.register("/sw.js").then(function () { return Notification.requestPermission(); }).then(function (p) {
      if (p !== "granted") throw "permiso";
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(avCfg.vapid) }); });
    }).then(function (sub) {
      avDev.push = true; avDev.sub = JSON.parse(JSON.stringify(sub)); avSave();
      return syncAvisos();
    }).then(function (j) {
      if (j && j.ok) avMsg("¡Listo! Te enviamos una notificación de prueba.", "ok"); else avMsg((j && j.error) || "No se pudo registrar el aviso en el servidor.", "err");
      renderAvisos();
    }).catch(function (e) {
      avMsg(e === "permiso" ? "No diste permiso para notificaciones. Puedes darlo en la configuración del navegador y volver a intentarlo." : "No se pudieron activar las notificaciones.", "err");
    });
  }
  function desactivarPush() {
    var p = navigator.serviceWorker && navigator.serviceWorker.getRegistration ? navigator.serviceWorker.getRegistration() : Promise.resolve(null);
    p.then(function (r) { return r && r.pushManager.getSubscription(); }).then(function (s) { return s && s.unsubscribe(); }).catch(function () {}).then(function () {
      avDev.push = false; avDev.sub = null; avSave();
      return syncAvisos();
    }).then(function () { avMsg("Notificaciones apagadas.", "ok"); renderAvisos(); }, function () { renderAvisos(); });
  }
  function abrirAvisos() {
    $("menu-mas").hidden = true;
    avMsg("");
    renderAvisos();
    openDlg("dlg-avisos");
  }
  function renderAvisos() {
    $("av-registro").checked = !!state.avisos.registro;
    $("av-pagos").checked = !!state.avisos.pagos;
    $("av-web").hidden = !WEB; $("av-claude").hidden = WEB;
    if (!WEB) {
      $("av-gcal").innerHTML = state.porPagar.length ? state.porPagar.map(function (b) {
        return '<a class="btn" href="' + esc(gcalUrl(b)) + '" target="_blank" rel="noopener"><svg class="ic"><use href="#i-cal"/></svg> ' + esc(b.nombre) + "</a>";
      }).join("") : '<p class="empty">Primero agrega tus cuentas por pagar en la pestaña Cuentas.</p>';
      return;
    }
    if (!avDev) avLoad();
    $("av-push").textContent = avDev.push ? "Apagar notificaciones" : "Activar notificaciones";
    $("av-push").className = "btn" + (avDev.push ? "" : " primary");
    $("av-push-txt").textContent = esIOS() && !instalada() && !avDev.push ?
      "En iPhone funcionan cuando instalas la app. En Safari toca Compartir y luego Agregar a inicio. Ábrela desde ese ícono y actívalas aquí." :
      "Te llegan como las de cualquier app: pagos por vencer, un recordatorio suave si no has registrado nada y un consejo a la semana.";
    $("av-email").value = avDev.email || "";
    var prem = hasPremium();
    $("av-email").disabled = !prem;
    $("av-mail").textContent = !prem ? "Desbloquear con Premium" : avDev.correo ? "Apagar correo" : "Activar correo";
    Array.prototype.forEach.call($("av-consejos").querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === avDev.consejos)); });
    $("av-hora").value = String(avDev.hora);
    $("av-efectivo").checked = !!avDev.efectivo;
    $("av-preguntar").checked = avDev.preguntar !== false;
  }
  $("btn-avisos-menu").addEventListener("click", abrirAvisos);
  $("av-registro").addEventListener("change", function () { state.avisos.registro = this.checked; changed(); renderNudge(); });
  $("av-pagos").addEventListener("change", function () { state.avisos.pagos = this.checked; changed(); });
  $("av-ics").addEventListener("click", function () {
    if (!state.porPagar.length) { avMsg("Primero agrega tus cuentas por pagar en la pestaña Cuentas.", "err"); return; }
    descargar(new Blob([construirIcs()], { type: "text/calendar;charset=utf-8" }), "fintelligente-pagos.ics");
    avMsg("Calendario descargado. Ábrelo en tu celular para agregar los pagos con sus alarmas.", "ok");
  });
  $("av-push").addEventListener("click", function () { if (avDev.push) desactivarPush(); else activarPush(); });
  $("av-mail").addEventListener("click", function () {
    if (!hasPremium()) { closeDlg("dlg-avisos"); openPremium(); return; }
    if (avDev.correo) { avDev.correo = false; avSave(); syncAvisos().then(function () { avMsg("Avisos por correo apagados.", "ok"); renderAvisos(); }); return; }
    var em = $("av-email").value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { avMsg("Escribe un correo válido.", "err"); $("av-email").focus(); return; }
    avDev.email = em; avDev.correo = true; avSave(); avMsg("Activando…");
    syncAvisos().then(function (j) {
      if (j && j.ok) avMsg("¡Listo! Te enviamos un correo de confirmación a " + em + ".", "ok");
      else { avDev.correo = false; avSave(); avMsg((j && j.error) || "No se pudo activar el correo.", "err"); }
      renderAvisos();
    }, function () { avDev.correo = false; avSave(); avMsg("No hay conexión con el servidor.", "err"); renderAvisos(); });
  });
  $("av-consejos").addEventListener("click", function (e) { var b = e.target.closest("[data-v]"); if (!b) return; avDev.consejos = b.dataset.v; avSave(); renderAvisos(); programarAvisos(); });
  $("av-efectivo").addEventListener("change", function () {
    avDev.efectivo = this.checked; avSave(); programarAvisos();
    if (this.checked && !avActivo()) avMsg("Activa las notificaciones al celular para recibir la pregunta de cada noche.", "");
  });
  $("av-manana").addEventListener("change", function () {
    avDev.manana = this.checked; avSave(); programarAvisos(); guardarCupo();
    if (this.checked && !avActivo()) avMsg("Activa las notificaciones al celular para recibir el aviso de cada mañana.", "");
  });
  $("av-cifra").addEventListener("change", function () { avDev.cifra = this.checked; avSave(); guardarCupo(); });
  $("av-preguntar").addEventListener("change", function () { avDev.preguntar = this.checked; avSave(); programarAvisos(); });
  $("dudas-ver").addEventListener("click", abrirDudas);
  $("av-hora").addEventListener("change", function () { avDev.hora = clamp(+this.value || 20, 18, 20); avSave(); programarAvisos(); });
  function initAvisosWeb() {
    avLoad();
    if ("serviceWorker" in navigator) { try { navigator.serviceWorker.register("/sw.js").catch(function () {}); } catch (e) {} }
    configApp().then(function (j) { avCfg.vapid = j.vapidPublicKey || ""; avCfg.correo = !!j.correo; }, function () {});
    if (avActivo()) setTimeout(function () { syncAvisos(true).catch(function () {}); }, 2500);
  }

  function renderV5() { renderPagos(); renderPorPagar(); renderCuentas(); renderRachas(); renderNudge(); }
  function postLoad() {
    try { checkLogros(true); } catch (e) {}
    renderV5();
    if (WEB) { initAvisosWeb(); initBuzonWeb(); initCuenta(); }
    var hubo = importarDesdeEnlace();
    if (ACCION_INICIAL) hacerAccion(ACCION_INICIAL); else if (!hubo) setTimeout(avisoPagosApp, 1200);
  }

  // ===================== Bancos conocidos =====================
  // Al agregar una cuenta se elige la entidad de una lista: los bancos de Colombia, las billeteras y bancos digitales,
  // las cooperativas y financieras más usadas y las entidades internacionales más comunes. Cada tarjeta lleva el color
  // característico de su entidad (aproximado) y su nombre escrito, sin logos. Son funciones (no variables) para que
  // estén listas desde el primer dibujo de la app.
  // Cada fila: id, nombre, grupo, color de fondo, color del texto, color del aro, tipo de cuenta, otros nombres.
  var BANCOS_GRUPOS = [["d", "Billeteras y bancos digitales"], ["b", "Bancos de Colombia"], ["c", "Cooperativas y financieras"], ["i", "Internacionales"]];
  var _bancos = null;
  function bkNrm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function bancosLista() {
    if (_bancos) return _bancos;
    var B = "#ffffff", filas = [
      ["nequi", "Nequi", "d", "#2a0638", B, "#da0081", "nequi"],
      ["daviplata", "Daviplata", "d", "#d8121b", B, B, "daviplata"],
      ["nu", "Nu", "d", "#820ad1", B, B, "banco", "nubank|nu colombia"],
      ["lulo", "Lulo Bank", "d", "#111214", B, "#d4ff3a", "banco", "lulo"],
      ["rappipay", "RappiPay", "d", "#e8381a", B, B, "banco", "rappi"],
      ["uala", "Ualá", "d", "#3557e8", B, B, "banco"],
      ["movii", "MOVii", "d", "#4f2bb8", B, "#33e0c0", "otra"],
      ["dale", "dale!", "d", "#2c1a66", B, "#ffd100", "otra"],
      ["pibank", "Pibank", "d", "#11225a", B, "#ffd100", "banco"],
      ["global66", "Global66", "d", "#0a2a5e", B, "#00d1b2", "otra"],
      ["mercadopago", "Mercado Pago", "d", "#0a78c2", B, "#fff159", "otra"],
      ["bancolombia", "Bancolombia", "b", "#fdda24", "#2c2a29", "#2c2a29", "banco"],
      ["bogota", "Banco de Bogotá", "b", "#00306e", B, "#d9a520", "banco", "bogota"],
      ["davivienda", "Davivienda", "b", "#e01b22", B, B, "banco"],
      ["bbva", "BBVA", "b", "#004481", B, "#2dcccd", "banco"],
      ["occidente", "Banco de Occidente", "b", "#00529b", B, B, "banco", "occidente"],
      ["popular", "Banco Popular", "b", "#007a4d", B, B, "banco"],
      ["avvillas", "Banco AV Villas", "b", "#c8102e", B, "#0033a0", "banco", "av villas"],
      ["cajasocial", "Banco Caja Social", "b", "#003da5", B, "#e4002b", "banco", "caja social"],
      ["agrario", "Banco Agrario", "b", "#00703c", B, "#ffd100", "banco", "agrario"],
      ["colpatria", "Scotiabank Colpatria", "b", "#d81e05", B, B, "banco", "colpatria|scotiabank"],
      ["itau", "Itaú", "b", "#ec7000", "#0b2a6b", "#0b2a6b", "banco", "itau"],
      ["gnb", "Banco GNB Sudameris", "b", "#006a4e", B, B, "banco", "gnb|sudameris"],
      ["falabella", "Banco Falabella", "b", "#2e7d32", B, "#b5e655", "banco", "falabella|cmr"],
      ["pichincha", "Banco Pichincha", "b", "#ffdd00", "#0f265c", "#0f265c", "banco", "pichincha"],
      ["bancoomeva", "Bancoomeva", "b", "#00805a", B, B, "banco", "coomeva"],
      ["finandina", "Banco Finandina", "b", "#5b2a86", B, B, "banco", "finandina"],
      ["serfinanza", "Banco Serfinanza", "b", "#0033a0", B, "#ff8200", "banco", "serfinanza"],
      ["bancow", "Banco W", "b", "#e0491b", B, B, "banco"],
      ["bancamia", "Bancamía", "b", "#4f8a2b", B, "#f39200", "banco", "bancamia"],
      ["mundomujer", "Banco Mundo Mujer", "b", "#c4006e", B, B, "banco", "mundo mujer"],
      ["mibanco", "Mibanco", "b", "#00843d", B, "#ffd100", "banco"],
      ["coopcentral", "Banco Coopcentral", "b", "#00733c", B, B, "banco", "coopcentral"],
      ["santander", "Banco Santander", "b", "#ec0000", B, B, "banco", "santander"],
      ["union", "Banco Unión", "b", "#0b3d91", B, B, "banco", "banco union"],
      ["contactar", "Banco Contactar", "b", "#0077b6", B, B, "banco", "contactar"],
      ["fna", "Fondo Nacional del Ahorro", "c", "#006e3c", B, "#ffd100", "banco", "fna|fondo nacional del ahorro"],
      ["tuya", "Tuya (Tarjeta Éxito)", "c", "#4b2a7b", B, "#ffd400", "tarjeta", "tuya|tarjeta exito"],
      ["confiar", "Confiar", "c", "#00894f", B, B, "banco"],
      ["cotrafa", "Cotrafa", "c", "#005ba6", B, B, "banco"],
      ["jfk", "JFK Cooperativa", "c", "#0c4da2", B, B, "banco", "jfk"],
      ["juriscoop", "Juriscoop", "c", "#003b71", B, B, "banco"],
      ["paypal", "PayPal", "i", "#003087", B, "#009cde", "otra"],
      ["wise", "Wise", "i", "#9fe870", "#163300", "#163300", "otra"],
      ["revolut", "Revolut", "i", "#191c1f", B, "#0666eb", "banco"],
      ["payoneer", "Payoneer", "i", "#e04400", B, B, "otra"],
      ["chase", "Chase", "i", "#117aca", B, B, "banco"],
      ["bofa", "Bank of America", "i", "#012169", B, "#e31837", "banco", "bank of america|bofa"],
      ["wellsfargo", "Wells Fargo", "i", "#c41f26", B, "#ffcd41", "banco", "wells fargo"],
      ["citi", "Citibank", "i", "#003b70", B, "#e31837", "banco", "citi"],
      ["capitalone", "Capital One", "i", "#004977", B, "#d03027", "banco", "capital one"],
      ["hsbc", "HSBC", "i", "#db0011", B, B, "banco"],
      ["amex", "American Express", "i", "#006fcf", B, B, "tarjeta", "amex|american express"],
      ["skrill", "Skrill", "i", "#862165", B, B, "otra"],
      ["westernunion", "Western Union", "i", "#ffdd00", "#000000", "#000000", "otra", "western union"]
    ];
    _bancos = filas.map(function (f) {
      var nom = bkNrm(f[1]).replace(/[^a-z0-9 ]/g, "").trim();
      var otros = (f[7] ? f[7].split("|") : []).concat([nom]).map(function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
      return { id: f[0], n: f[1], g: f[2], c: f[3], t: f[4], a: f[5], tipo: f[6], re: new RegExp("(^| )(" + otros.join("|") + ")( |$)") };
    });
    return _bancos;
  }
  function bancoPorId(id) { return id ? bancosLista().find(function (b) { return b.id === id; }) || null : null; }
  // La entidad de una cuenta: la que se eligió o, en cuentas viejas, la que dice su nombre.
  function bancoDeCuenta(cu) {
    if (!cu) return null;
    var b = bancoPorId(cu.banco); if (b) return b;
    var n = " " + bkNrm(cu.nombre || "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim() + " ";
    return bancosLista().find(function (x) { return x.re.test(n); }) || null;
  }
  // Los colores de la tarjeta a partir del color de la entidad
  function marcaDeBanco(b, clase) {
    var g = "radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, " + b.c + " 62%, #fff) 0%, " + b.c + " 42%, color-mix(in srgb, " + b.c + " 62%, #000) 100%)";
    return { c: b.c, t: b.t, g: g, a: b.a, s: "color-mix(in srgb, " + b.c + " 55%, transparent)", clase: clase };
  }

  // --- Elegir la entidad al agregar una cuenta ---
  function bancosHtml(q) {
    var n = bkNrm(q || "").trim(), l = bancosLista().filter(function (b) { return !n || bkNrm(b.n).indexOf(n) > -1 || b.re.test(" " + n + " "); });
    var html = BANCOS_GRUPOS.map(function (gr) {
      var del = l.filter(function (b) { return b.g === gr[0]; }); if (!del.length) return "";
      return '<h3 class="bk-grupo">' + gr[1] + '</h3><div class="bk-lista">' + del.map(function (b) {
        return '<button type="button" class="bk-carta" data-banco="' + b.id + '" style="--bk:' + b.c + ";--bk-t:" + b.t + ";--bk-a:" + b.a + '"><span>' + esc(b.n) + "</span></button>";
      }).join("") + "</div>";
    }).join("");
    html += '<h3 class="bk-grupo">Otras</h3><div class="bk-lista">' +
      '<button type="button" class="bk-carta bk-efectivo" data-banco="=efectivo"><span>Efectivo</span></button>' +
      '<button type="button" class="bk-carta bk-otra" data-banco="=otra"><span>' + (n ? "Otra: " + esc(q.trim().slice(0, 40)) : "Otra entidad") + "</span></button></div>";
    return html;
  }
  function abrirBancos() {
    $("bk-buscar").value = ""; $("bk-res").innerHTML = bancosHtml("");
    $("bk-tc").setAttribute("aria-pressed", "false"); $("bk-cta").setAttribute("aria-pressed", "true");
    openDlg("dlg-bancos", "#bk-buscar");
  }
  $("bk-buscar").addEventListener("input", function () { $("bk-res").innerHTML = bancosHtml(this.value); });
  ["bk-cta", "bk-tc"].forEach(function (id) { $(id).addEventListener("click", function () { $("bk-cta").setAttribute("aria-pressed", id === "bk-cta"); $("bk-tc").setAttribute("aria-pressed", id === "bk-tc"); }); });
  $("bk-res").addEventListener("click", function (e) {
    var b = e.target.closest("[data-banco]"); if (!b) return;
    var k = b.dataset.banco, tc = $("bk-tc").getAttribute("aria-pressed") === "true", q = $("bk-buscar").value.trim().slice(0, 40), c;
    if (k === "=efectivo") c = { nombre: "Efectivo", tipo: "efectivo" };
    else if (k === "=otra") c = { nombre: q || "Otra cuenta", tipo: tc ? "tarjeta" : "otra" };
    else { var bk = bancoPorId(k); c = { nombre: bk.n + (tc && bk.tipo !== "tarjeta" ? " · Tarjeta" : ""), tipo: tc ? "tarjeta" : bk.tipo, banco: bk.id }; }
    c.id = rid("a"); c.saldo = 0; c.cupo = 0;
    state.cuentas.push(c); billeteraSel = c.id; closeDlg("dlg-bancos"); vibrar(10); changed(); renderCuentas(); checkLogros();
    var el = $("cuentas-body").querySelector('.acct[data-id="' + c.id + '"] [data-f="saldo"]'); if (el) { el.focus(); el.select(); }
  });
  // ===================== v6 · Registro automático: bandeja Por confirmar =====================
  var LECTOR = window.FinLector;
  var ORIGEN_TXT = { correo: "Correo del banco", factura: "Factura electrónica", atajo: "Atajo del celular", pegado: "Aviso pegado", enlace: "Atajo del celular", android: "Notificación del banco" };
  var bandejaSel = {};   // elección en pantalla por movimiento: { cat, fila, cuenta, pago, sumar }

  function cuentaEfectivo(crear) {
    var c = state.cuentas.find(function (x) { return x.tipo === "efectivo"; });
    if (!c && crear) { c = { id: rid("a"), nombre: "Efectivo", tipo: "efectivo", saldo: 0, cupo: 0 }; state.cuentas.push(c); }
    return c || null;
  }
  function cuentaSugerida(it) {
    if (it.medio === "Efectivo") return cuentaEfectivo(true).id;
    var key = (it.banco || "") + "|" + (it.u4 || "");
    if (state.reglasCuenta[key] && cuentaById(state.reglasCuenta[key])) return state.reglasCuenta[key];
    var nb = LECTOR.normal(it.banco), cs = state.cuentas;
    var porNombre = nb && cs.find(function (c) { return LECTOR.normal(c.nombre).indexOf(nb) > -1; });
    if (porNombre) return porNombre.id;
    var t = /nequi/.test(nb) ? "nequi" : /daviplata/.test(nb) ? "daviplata" : it.medio === "Tarjeta de crédito" ? "tarjeta" : "banco";
    var porTipo = cs.find(function (c) { return c.tipo === t; });
    return porTipo ? porTipo.id : "";
  }
  function pagoSugerido(it) {
    if (it.tipo !== "gasto" && it.tipo !== "pagoTarjeta") return "";
    var hoy = parseD(it.fecha) || d0(), mejor = null;
    state.porPagar.forEach(function (b) {
      var e = estadoPago(b, hoy); if (e.pagado || !b.monto) return;
      var dif = Math.abs(b.monto - it.monto), tol = Math.max(1000, b.monto * 0.02);
      if (dif <= tol && Math.abs(e.dias) <= 12 && (!mejor || dif < mejor.dif)) mejor = { id: b.id, dif: dif };
    });
    return mejor ? mejor.id : "";
  }
  function posibleDuplicado(it) {
    var lista = state.pendientes;
    for (var i = 0; i < lista.length; i++) {
      var p = lista[i];
      if (p.id !== it.id && !p.verificacion && !p.parDe && (p.tipo === "ingreso") === (it.tipo === "ingreso") && p.monto === it.monto && p.fecha && it.fecha && Math.abs(diasEntre(parseD(p.fecha), parseD(it.fecha))) <= 1) return p.id;
    }
    return "";
  }
  // --- Traslados entre tus propias cuentas ---
  function esSalida(t) { return t === "gasto" || t === "propio"; }
  // Del texto del aviso solo se conservan las palabras que ayudan a reconocer tus cuentas (Nequi, bolsillo, el nombre
  // de una cuenta tuya). El resto del mensaje se descarta: no queda en el dispositivo ni en la copia de la nube.
  var PISTAS = ["nequi", "daviplata", "bolsillo", "colchon", "meta"];
  function pistaDe(t) {
    var n = LECTOR.normal(String(t || "")), out = PISTAS.filter(function (k) { return n.indexOf(k) > -1; });
    (state.cuentas || []).forEach(function (c) { var nc = LECTOR.normal(c.nombre); if (nc.length > 2 && n.indexOf(nc) > -1 && out.indexOf(nc) < 0) out.push(nc); });
    return out.join(" ").slice(0, 120);
  }
  function destinoSugerido(it, excluir) {
    var n = LECTOR.normal((it.pista || "") + " " + it.comercio), cs = state.cuentas.filter(function (c) { return c.id !== excluir; });
    var porNombre = cs.find(function (c) { var nc = LECTOR.normal(c.nombre); return nc.length > 2 && n.indexOf(nc) > -1; });
    if (porNombre) return porNombre.id;
    var t = /nequi/.test(n) ? "nequi" : /daviplata/.test(n) ? "daviplata" : /bolsillo|colchon|meta/.test(n) ? "banco" : "";
    var porTipo = t && cs.find(function (c) { return c.tipo === t; });
    return porTipo ? porTipo.id : "";
  }
  function emparejar(it) {
    var c = state.pendientes.find(function (p) {
      return p.id !== it.id && !p.verificacion && !p.par && !p.parDe && p.monto === it.monto && p.fecha && it.fecha &&
        Math.abs(diasEntre(parseD(p.fecha), parseD(it.fecha))) <= 1 &&
        ((esSalida(p.tipo) && it.tipo === "ingreso") || (p.tipo === "ingreso" && esSalida(it.tipo))) && (p.banco !== it.banco || !p.banco || !it.banco);
    });
    if (!c) return;
    var sale = it.tipo === "ingreso" ? c : it, entra = it.tipo === "ingreso" ? it : c;
    if (sale.tipo !== "propio") sale.tipoOriginal = sale.tipo;
    sale.tipo = "propio"; sale.par = entra.id; entra.parDe = sale.id;
    sale.destino = entra.cuenta || destinoSugerido(sale, sale.cuenta);
    sale.dup = ""; entra.dup = "";
    delete bandejaSel[sale.id]; delete bandejaSel[entra.id];
  }
  function visibles() { return state.pendientes.filter(function (p) { return !p.parDe; }); }

  // Agrega un movimiento leído a la bandeja. Devuelve el movimiento, o null si se descartó.
  // ¿Ya me lo contaste? Un aviso del banco que coincide con algo dicho en Cuéntame un gasto (mismo valor o muy
  // parecido, el mismo día o el anterior y, si los dos lo dicen, el mismo lugar) no se anota dos veces.
  function yaContado(it) {
    if (it.tipo !== "gasto" || !it.monto) return "";
    var f = parseD(it.fecha), pal = LECTOR.normal(it.comercio || "").split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 2 && !/^(de|la|el|los|las|en|con|sas|ltda)$/.test(w); });
    var mejor = null, dist = 1e12;
    state.movs.forEach(function (mv) {
      if (mv.o !== "ch" || mv.t !== "g" || mv.banco) return;
      var dd = f ? Math.abs(diasEntre(parseD(mv.f), f)) : 0; if (dd > 1) return;
      var dif = Math.abs(mv.m - it.monto); if (dif > Math.max(1000, Math.min(5000, it.monto * 0.05))) return;
      var c = LECTOR.normal((mv.com || "") + " " + (mv.c || ""));
      var lugar = !pal.length || !mv.com || pal.some(function (w) { return new RegExp("(?:^|[^a-z0-9])" + w + "(?:$|[^a-z0-9])").test(c); });
      if (!lugar) return;
      var d2 = dif + dd * 100; if (d2 < dist) { dist = d2; mejor = mv; }
    });
    return mejor ? mejor.id : "";
  }
  function unirContado(id) {
    var it = state.pendientes.find(function (p) { return p.id === id; }); if (!it) return;
    var mv = state.movs.find(function (x) { return x.id === it.contado; }); if (!mv) { it.contado = ""; return renderBandeja(); }
    var antes = JSON.stringify(state), s = selDe(it), dif = it.monto - mv.m;
    var k = mv.f.slice(0, 7), mes = state.meses[k], fila = mes && chFila("g", mv.cat, mv.c, mes);
    if (fila) fila.real += dif;
    // La cuenta: la que dice el banco manda. Si en la charla quedó otra (por ejemplo, efectivo), se pasa.
    var vieja = mv.cu ? cuentaById(mv.cu) : null, nueva = s.cuenta ? cuentaById(s.cuenta) : null;
    if (vieja && nueva && vieja !== nueva) { vieja.saldo -= signoCuenta(vieja, "gasto") * mv.m; nueva.saldo += signoCuenta(nueva, "gasto") * it.monto; mv.cu = nueva.id; }
    else if (vieja || nueva) { var a = vieja || nueva; a.saldo += signoCuenta(a, "gasto") * (vieja ? dif : it.monto); mv.cu = a.id; }
    mv.m = it.monto; mv.banco = it.banco || "Banco"; mv.o = "aviso";
    if (!mv.com && it.comercio) mv.com = it.comercio.slice(0, 60);
    state.importados.push(LECTOR.huella(it)); state.importados = state.importados.slice(-600);
    state.pendientes = state.pendientes.filter(function (p) { return p.id !== id; });
    delete bandejaSel[id];
    changed(); renderIngresos(); renderGastos(); recompute(); renderCuentas(); renderBandeja();
    toast(dif ? "Era lo mismo. Lo dejé en " + money(it.monto) + ", como dice " + (it.banco || "el banco") + "." : "Era lo mismo que me contaste: no lo anoto dos veces.", { action: "Deshacer", ms: 6500, onAction: function () {
      state = sanitize(JSON.parse(antes)); changed(); renderAll(); renderBandeja();
    } });
  }
  function agregarPendiente(r, origen) {
    if (!r || !r.ok || !r.monto) return null;
    if (!r.fecha) r.fecha = hoyStr();
    var h = LECTOR.huella(r);
    if (state.importados.indexOf(h) > -1 || state.pendientes.some(function (p) { return LECTOR.huella(p) === h; })) return null;
    var it = { id: rid("x"), origen: r.factura ? "factura" : origen, recibido: new Date().toISOString(), banco: r.banco || "", tipo: r.tipo, monto: r.monto,
      comercio: LECTOR.bonito(r.comercio || r.razonSocial || ""), fecha: r.fecha || hoyStr(), hora: r.hora || "", medio: r.medio || "", u4: r.u4 || "",
      nit: r.nit || "", numero: r.numero || "", items: (r.items || []).slice(0, 4), confianza: r.confianza || "media", pista: pistaDe(r.texto) };
    if (origen !== "pegado") metrica("aviso_auto", "una");
    it.cat = LECTOR.sugerirCategoria(r, state.reglas).cat || (it.tipo === "retiro" ? "" : "otros");
    if (!catById(it.cat) && it.cat) it.cat = "otros";
    it.cuenta = cuentaSugerida(it);
    var nc = LECTOR.normal(it.comercio);
    if ((it.tipo === "gasto" || it.tipo === "ingreso") && nc && state.propios.indexOf(nc) > -1) { it.tipoOriginal = it.tipo; it.tipo = "propio"; }
    if (it.tipo === "propio") it.destino = destinoSugerido(it, it.cuenta);
    it.pago = it.tipo === "propio" ? "" : pagoSugerido(it);
    state.pendientes.push(it);
    state.pendientes = state.pendientes.slice(-200);
    it.dup = posibleDuplicado(it);
    it.contado = yaContado(it);
    emparejar(it);
    return it;
  }
  function mesDe(it) { var k = (it.fecha || "").slice(0, 7); return state.meses[k] ? k : state.mes; }
  function filasPara(it, cat) {
    var m = state.meses[mesDe(it)];
    if (it.tipo === "ingreso") return m.ingresos;
    return m.gastos.filter(function (r) { return r.cat === cat; });
  }
  function filaSugerida(it, cat) {
    var filas = filasPara(it, cat), nc = LECTOR.normal(it.comercio);
    var igual = filas.find(function (r) { return LECTOR.normal(r.concepto) === nc; });
    if (igual) return igual.id;
    var conPlan = filas.slice().sort(function (a, b) { return b.plan - a.plan; })[0];
    return conPlan ? conPlan.id : "__nuevo";
  }
  function selDe(it) {
    var s = bandejaSel[it.id];
    if (!s) {
      var entra = it.tipoOriginal === "ingreso" && !it.par;
      s = bandejaSel[it.id] = { cat: it.cat, cuenta: it.cuenta, pago: it.pago, sumar: it.tipo !== "pagoTarjeta", propio: it.tipo === "propio",
        desde: entra ? "" : it.cuenta, hacia: entra ? it.cuenta : (it.destino || "") };
    }
    if (!s.fila || (s.fila !== "__nuevo" && !filasPara(it, s.cat).some(function (r) { return r.id === s.fila; }))) s.fila = filaSugerida(it, s.cat);
    return s;
  }

  // --- Aplicar un movimiento confirmado ---
  function aplicarMovimiento(it) {
    var s = selDe(it), m = state.meses[mesDe(it)], acc = s.cuenta ? cuentaById(s.cuenta) : null, msg = "";
    if (s.propio) {
      var de = s.desde ? cuentaById(s.desde) : null, a = s.hacia ? cuentaById(s.hacia) : null;
      if (de) de.saldo += signoCuenta(de, "gasto") * it.monto;
      if (a) a.saldo += signoCuenta(a, "ingreso") * it.monto;
      var nc = LECTOR.normal(it.comercio);
      if (nc && nc !== "entre tus cuentas" && state.propios.indexOf(nc) < 0) { state.propios.push(nc); state.propios = state.propios.slice(-100); }
      return "Traslado de " + money(it.monto) + (de && a ? " de " + esc(de.nombre) + " a " + esc(a.nombre) : "") + ": no cuenta como gasto.";
    }
    if (s.pago && it.tipo !== "ingreso") {
      var b = state.porPagar.find(function (x) { return x.id === s.pago; });
      if (b) {
        var e = estadoPago(b, parseD(it.fecha) || d0());
        b.pagos[e.key] = it.fecha || hoyStr();
        if (s.sumar) {
          var rowB = filaGasto(m, b.nombre);
          if (rowB) rowB.real += it.monto; else m.gastos.push({ id: rid("g"), concepto: b.nombre.slice(0, 80), cat: b.cat, dia: b.f === "mensual" ? b.dia : e.due.getDate(), plan: b.monto, real: it.monto });
        }
        if (acc) acc.saldo += signoCuenta(acc, "gasto") * it.monto;
        anotarMov({ t: "g", f: it.fecha, hora: it.hora, cat: b.cat, c: b.nombre, m: it.monto, com: it.comercio });
        msg = "<b>" + esc(b.nombre) + "</b> quedó pagado.";
        return msg;
      }
    }
    if (it.tipo === "retiro") {
      if (acc) acc.saldo += signoCuenta(acc, "gasto") * it.monto;
      var efe = state.cuentas.find(function (c) { return c.tipo === "efectivo"; });
      if (efe) efe.saldo += it.monto;
      return "Retiro de " + money(it.monto) + (efe ? ": pasó a tu efectivo." : ".");
    }
    if (it.tipo === "pagoTarjeta") {
      if (acc) acc.saldo += signoCuenta(acc, "gasto") * it.monto;
      var tj = state.cuentas.find(function (c) { return c.tipo === "tarjeta" && c.id !== s.cuenta; });
      if (tj) tj.saldo = Math.max(0, tj.saldo - it.monto);
      if (!s.sumar) return "Pago de tarjeta por " + money(it.monto) + (tj ? ": bajó la deuda de " + esc(tj.nombre) + "." : ".");
    }
    var ingreso = it.tipo === "ingreso", lista = ingreso ? m.ingresos : m.gastos, row;
    if (s.fila && s.fila !== "__nuevo") row = lista.find(function (r) { return r.id === s.fila; });
    if (!row) {
      row = ingreso ? { id: rid("i"), concepto: (it.comercio || "Ingreso").slice(0, 80), plan: 0, real: 0 } :
        { id: rid("g"), concepto: (it.comercio || "Gasto").slice(0, 80), cat: s.cat || "otros", dia: 0, plan: 0, real: 0 };
      lista.push(row);
    }
    row.real += it.monto;
    anotarMov({ t: ingreso ? "i" : "g", f: it.fecha, hora: it.hora, cat: row.cat || "", c: row.concepto, m: it.monto, com: it.comercio, cu: acc ? acc.id : "" });
    if (acc) acc.saldo += signoCuenta(acc, ingreso ? "ingreso" : "gasto") * it.monto;
    if (it.comercio && !ingreso && s.cat) state.reglas[LECTOR.normal(it.comercio)] = s.cat;
    return "<b>" + money(it.monto) + "</b> " + (ingreso ? "de " : "en ") + esc(row.concepto) + ".";
  }
  function confirmar(ids) {
    var antes = JSON.stringify(state), mensajes = [];
    ids.forEach(function (id) {
      var it = state.pendientes.find(function (p) { return p.id === id; }); if (!it || it.verificacion) return;
      var s = selDe(it);
      if (s.cuenta) state.reglasCuenta[(it.banco || "") + "|" + (it.u4 || "")] = s.cuenta;
      mensajes.push(aplicarMovimiento(it));
      state.importados.push(LECTOR.huella(it));
      var par = it.par && state.pendientes.find(function (p) { return p.id === it.par; });
      if (par) state.importados.push(LECTOR.huella(par));
      state.importados = state.importados.slice(-600);
      state.pendientes = state.pendientes.filter(function (p) { return p.id !== id && p.id !== it.par; });
      delete bandejaSel[id];
    });
    if (!mensajes.length) return;
    marcarRegistro();
    changed(); renderIngresos(); renderGastos(); recompute(); renderCuentas(); renderBandeja();
    toast(mensajes.length === 1 ? mensajes[0] : "Confirmaste " + mensajes.length + " movimientos.", { action: "Deshacer", ms: 6500, onAction: function () {
      state = sanitize(JSON.parse(antes)); changed(); renderAll(); renderBandeja();
    } });
  }
  function descartar(id) {
    var it = state.pendientes.find(function (p) { return p.id === id; }); if (!it) return;
    var par = it.par && state.pendientes.find(function (p) { return p.id === it.par; });
    if (!it.verificacion) { state.importados.push(LECTOR.huella(it)); if (par) state.importados.push(LECTOR.huella(par)); state.importados = state.importados.slice(-600); }
    state.pendientes = state.pendientes.filter(function (p) { return p.id !== id && p.id !== it.par; });
    delete bandejaSel[id];
    changed(); renderBandeja();
  }

  // --- Pantalla de la bandeja ---
  function filaOptions(it, s) {
    var filas = filasPara(it, s.cat);
    return filas.map(function (r) { return '<option value="' + esc(r.id) + '"' + (s.fila === r.id ? " selected" : "") + ">" + esc(r.concepto || "Sin nombre") + "</option>"; }).join("") +
      '<option value="__nuevo"' + (s.fila === "__nuevo" ? " selected" : "") + ">Nuevo: " + esc(it.comercio || (it.tipo === "ingreso" ? "Ingreso" : "Gasto")) + "</option>";
  }
  function movHtml(it) {
    if (it.verificacion) {
      return '<div class="mov verif" data-id="' + esc(it.id) + '"><div class="mov-top"><span class="cat-ic" style="--c:#1c7ed6">' + icono("i-mail") + '</span><span class="nm"><b>Código de confirmación de Gmail</b><span>Escríbelo en Gmail para terminar de activar el reenvío.</span></span></div>' +
        '<div class="codigo">' + esc(it.verificacion.codigo || "Ábrelo desde el enlace") + "</div>" +
        '<div class="mov-act">' + (it.verificacion.codigo ? '<button class="btn" type="button" data-copiar="' + esc(it.verificacion.codigo) + '">Copiar código</button>' : "") +
        '<button class="btn primary" type="button" data-descartar="' + esc(it.id) + '">Listo</button></div></div>';
    }
    var s = selDe(it), ingreso = it.tipo === "ingreso" && !s.propio, movInterno = s.propio || it.tipo === "retiro" || (it.tipo === "pagoTarjeta" && !s.pago);
    var signo = ingreso ? "+" : movInterno ? "" : "−", f = parseD(it.fecha);
    var sub = [f ? fechaLarga(f) : "", it.hora, it.medio ? it.medio + (it.u4 ? " *" + it.u4 : "") : "", ORIGEN_TXT[it.origen] || ""].filter(Boolean).join(" · ");
    var b = s.pago ? state.porPagar.find(function (x) { return x.id === s.pago; }) : null;
    var tipoTxt = s.propio ? "Traslado entre tus cuentas: pasa plata de una cuenta a otra; no es gasto ni ingreso." : it.tipo === "retiro" ? "Retiro de efectivo: pasa de tu cuenta a tu efectivo, no es un gasto." :
      it.tipo === "pagoTarjeta" ? "Pago de tarjeta: baja tu deuda. Tus compras con la tarjeta ya cuentan como gasto." : "";
    var out = '<div class="mov' + (it.dup ? " dup" : "") + '" data-id="' + esc(it.id) + '"><div class="mov-top">' +
      (ingreso ? '<span class="cat-ic" style="--c:#0ca678"><svg class="ic"><use href="#c-ingreso"/></svg></span>' : catIcon(s.cat || "otros")) +
      '<span class="nm"><b>' + esc(it.comercio || (ingreso ? "Ingreso" : "Movimiento")) + (it.banco ? ' <small class="bk">' + esc(it.banco) + "</small>" : "") + "</b><span>" + esc(sub) + "</span></span>" +
      '<span class="mv-monto' + (ingreso ? " pos" : "") + '">' + signo + money(it.monto) + "</span></div>";
    if (it.items && it.items.length) out += '<p class="mov-note">Compraste: ' + esc(it.items.join(", ")) + "</p>";
    if (it.dup) out += '<p class="mov-warn">Puede ser el mismo movimiento que otro de la lista (mismo monto y fecha). Si es así, descarta uno.</p>';
    var mvC = it.contado && state.movs.find(function (x) { return x.id === it.contado; });
    if (mvC) {
      var fC = chFechaTxt(mvC.f) || "hoy";
      out += '<div class="mov-contado"><p><b>¿Es lo mismo que me contaste?</b> ' + esc(mvC.c) + " por " + money(mvC.m) + " (" + esc(fC) + ")" +
        (mvC.m !== it.monto ? ". Si es lo mismo, lo dejo en " + money(it.monto) + ", como dice " + esc(it.banco || "el banco") : "") + ".</p>" +
        '<div class="mov-act"><button class="btn" type="button" data-contado-no="' + esc(it.id) + '">No, es otro</button><button class="btn primary" type="button" data-contado-si="' + esc(it.id) + '">Sí, es lo mismo</button></div></div></div>';
      return out;
    }
    if (tipoTxt) out += '<p class="mov-note">' + tipoTxt + "</p>";
    var pareja = it.par && state.pendientes.find(function (p) { return p.id === it.par; });
    if (pareja) out += '<p class="mov-note">También llegó el aviso de entrada' + (pareja.banco ? " de " + esc(pareja.banco) : "") + ": los unimos para no contarlo dos veces.</p>";
    if (it.tipo === "gasto" || it.tipo === "ingreso" || it.tipo === "propio") out += '<label class="switch-row"><span><b>Es entre mis cuentas</b><span>' + (s.propio ? "Si no lo es, apágalo y se registra como " + ((it.tipoOriginal || it.tipo) === "ingreso" ? "ingreso" : "gasto") + "." : "Por ejemplo, de tu banco a tu Nequi. No cuenta como gasto.") + '</span></span><span class="switch"><input type="checkbox" data-f="propio"' + (s.propio ? " checked" : "") + "><i></i></span></label>";
    if (b) out += '<label class="switch-row"><span><b>Es el pago de ' + esc(b.nombre) + '</b><span>Lo marcamos como pagado en tus cuentas por pagar.</span></span><span class="switch"><input type="checkbox" data-f="pago" checked><i></i></span></label>';
    if (it.tipo === "pagoTarjeta" && !b) out += '<label class="switch-row"><span><b>Contarlo como gasto</b><span>Solo si no registras una a una las compras de la tarjeta.</span></span><span class="switch"><input type="checkbox" data-f="sumar"' + (s.sumar ? " checked" : "") + "><i></i></span></label>";
    out += '<div class="mov-fields">';
    if (!ingreso && !movInterno && !b) out += '<label>Categoría<select class="field" data-f="cat">' + catOptions(s.cat || "otros") + "</select></label>";
    if (!movInterno && !b) out += "<label>Sumar a<select class=\"field\" data-f=\"fila\">" + filaOptions(it, s) + "</select></label>";
    var opcCuentas = function (sel) { return '<option value="">Sin definir</option>' + state.cuentas.map(function (c) { return '<option value="' + esc(c.id) + '"' + (sel === c.id ? " selected" : "") + ">" + esc(c.nombre) + "</option>"; }).join(""); };
    if (s.propio && state.cuentas.length) out += '<label>Salió de<select class="field" data-f="desde">' + opcCuentas(s.desde) + '</select></label><label>Llegó a<select class="field" data-f="hacia">' + opcCuentas(s.hacia) + "</select></label>";
    else if (state.cuentas.length) out += '<label>' + (ingreso ? "Llegó a" : "Salió de") + '<select class="field" data-f="cuenta"><option value="">Sin definir</option>' + state.cuentas.map(function (c) { return '<option value="' + esc(c.id) + '"' + (s.cuenta === c.id ? " selected" : "") + ">" + esc(c.nombre) + "</option>"; }).join("") + "</select></label>";
    out += '</div><div class="mov-act"><button class="btn" type="button" data-descartar="' + esc(it.id) + '">Descartar</button><button class="btn primary" type="button" data-confirmar="' + esc(it.id) + '">Confirmar</button></div></div>';
    return out;
  }
  function renderBandeja() {
    var n = visibles().length;
    $("bandeja-banner").hidden = !n;
    $("bandeja-n").textContent = n === 1 ? "Tienes 1 movimiento por confirmar" : "Tienes " + n + " movimientos por confirmar";
    $("bandeja-menu-n").textContent = n ? " (" + n + ")" : "";
    $("lat-n").textContent = n; $("lat-n").hidden = !n; $("menu-n").textContent = n; $("menu-n").hidden = !n; $("barra-n").textContent = n; $("barra-n").hidden = !n;
    if ($("dlg-bandeja").hidden) return;
    var lista = visibles().sort(function (a, b) { return (b.fecha + b.hora).localeCompare(a.fecha + a.hora); });
    var seguros = lista.filter(function (it) { return !it.verificacion && it.confianza === "alta" && !it.dup && !it.contado; });
    $("bandeja-todo").hidden = seguros.length < 2;
    $("bandeja-todo").textContent = "Confirmar los " + seguros.length + " seguros";
    $("bandeja-lista").innerHTML = lista.length ? '<p class="hint gesto-hint">Desliza una tarjeta a la derecha para aceptarla o a la izquierda para descartarla.</p>' + lista.map(movHtml).join("") :
      '<div class="all-good"><svg class="ic"><use href="#c-ahorro"/></svg>Todo al día, no hay movimientos por confirmar.</div>';
  }
  function abrirBandeja(pegar) {
    $("menu-mas").hidden = true;
    $("pegar-msg").textContent = "";
    $("pegar-box").open = !!pegar || !visibles().length;
    openDlg("dlg-bandeja", pegar ? "#pegar-texto" : null);
    renderBandeja();
    if (WEB && buzon) sincronizar(false);
  }
  $("bandeja-ver").addEventListener("click", function () { abrirBandeja(false); });
  $("btn-bandeja-menu").addEventListener("click", function () { abrirBandeja(false); });
  $("add-pegar").addEventListener("click", function () { closeDlg("dlg-add"); abrirBandeja(true); });
  $("bandeja-todo").addEventListener("click", function () {
    confirmar(visibles().filter(function (it) { return !it.verificacion && it.confianza === "alta" && !it.dup && !it.contado; }).map(function (it) { return it.id; }));
  });
  $("bandeja-lista").addEventListener("click", function (e) {
    var t = e.target.closest("[data-confirmar]"); if (t) { confirmar([t.dataset.confirmar]); return; }
    t = e.target.closest("[data-contado-si]"); if (t) { unirContado(t.dataset.contadoSi); return; }
    t = e.target.closest("[data-contado-no]"); if (t) { var it0 = state.pendientes.find(function (p) { return p.id === t.dataset.contadoNo; }); if (it0) { it0.contado = ""; it0.contadoNo = true; changed(); renderBandeja(); } return; }
    t = e.target.closest("[data-descartar]"); if (t) { descartar(t.dataset.descartar); return; }
    t = e.target.closest("[data-copiar]");
    if (t) { try { navigator.clipboard.writeText(t.dataset.copiar); t.textContent = "Copiado ✓"; } catch (er) {} }
  });
  // Deslizar una tarjeta: a la derecha la acepta, a la izquierda la descarta (los botones siguen ahí)
  (function () {
    var g = null;
    $("bandeja-lista").addEventListener("pointerdown", function (e) {
      var card = e.target.closest(".mov"); if (!card || e.target.closest("button, input, select, textarea, a, label, details")) return;
      var si = card.querySelector("[data-confirmar]"), no = card.querySelector("[data-descartar]"); if (!si && !no) return;
      g = { card: card, x: e.clientX, y: e.clientY, dx: 0, activo: false, si: si, no: no, id: e.pointerId };
    });
    $("bandeja-lista").addEventListener("pointermove", function (e) {
      if (!g || e.pointerId !== g.id) return;
      var dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (!g.activo) { if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) { if (Math.abs(dy) > 12) g = null; return; } g.activo = true; try { g.card.setPointerCapture(e.pointerId); } catch (er) {} }
      if ((dx > 0 && !g.si) || (dx < 0 && !g.no)) dx = dx / 4;
      g.dx = dx;
      g.card.style.transition = "none";
      g.card.style.transform = "translateX(" + dx + "px) rotate(" + (dx / 40) + "deg)";
      g.card.classList.toggle("a-der", dx > 40); g.card.classList.toggle("a-izq", dx < -40);
    });
    function soltar(e) {
      if (!g || (e && e.pointerId !== g.id)) return;
      var c = g.card, w = c.offsetWidth, dx = g.dx, si = g.si, no = g.no, activo = g.activo; g = null;
      if (!activo) return;
      c.style.transition = "transform .28s cubic-bezier(.2,.8,.2,1), opacity .28s";
      if (dx > w * 0.33 && si) { c.style.transform = "translateX(" + (w * 1.3) + "px) rotate(12deg)"; c.style.opacity = "0"; setTimeout(function () { si.click(); }, 230); }
      else if (dx < -w * 0.33 && no) { c.style.transform = "translateX(" + (-w * 1.3) + "px) rotate(-12deg)"; c.style.opacity = "0"; setTimeout(function () { sonar("soplo-inv"); no.click(); }, 230); }
      else { c.style.transform = ""; c.classList.remove("a-der", "a-izq"); }
    }
    $("bandeja-lista").addEventListener("pointerup", soltar);
    $("bandeja-lista").addEventListener("pointercancel", soltar);
  })();
  $("bandeja-lista").addEventListener("change", function (e) {
    var t = e.target, card = t.closest(".mov"); if (!card || !t.dataset.f) return;
    var it = state.pendientes.find(function (p) { return p.id === card.dataset.id; }); if (!it) return;
    var s = selDe(it), f = t.dataset.f;
    if (f === "propio") {
      s.propio = t.checked;
      if (!t.checked && it.tipo === "propio") {
        var par = it.par && state.pendientes.find(function (p) { return p.id === it.par; });
        if (par) { delete par.parDe; par.dup = ""; }
        it.tipo = it.tipoOriginal || "gasto"; it.par = ""; s.cat = it.cat || "otros"; s.fila = "";
        changed();
      }
      if (t.checked && !s.desde && !s.hacia) { s.desde = it.tipo === "ingreso" ? "" : it.cuenta; s.hacia = it.tipo === "ingreso" ? it.cuenta : destinoSugerido(it, it.cuenta); }
    }
    else if (f === "pago") s.pago = t.checked ? it.pago : "";
    else if (f === "sumar") s.sumar = t.checked;
    else if (f === "cat") { s.cat = t.value; s.fila = filaSugerida(it, s.cat); }
    else s[f] = t.value;
    renderBandeja();
  });
  $("pegar-leer").addEventListener("click", function () {
    var txt = $("pegar-texto").value.trim(), msg = $("pegar-msg");
    if (!txt) { msg.textContent = "Pega aquí el mensaje que te llegó del banco o de la billetera."; msg.className = "msg err"; return; }
    var r = /<(?:\w+:)?(?:AttachedDocument|Invoice)\b/.test(txt) ? LECTOR.leerFactura(txt) : LECTOR.leerAviso(txt);
    if (!r.ok) { msg.textContent = r.motivo === "estafa" ? "Cuidado: este mensaje parece una estafa. Los bancos y Bre-B nunca te piden confirmar un pago por un enlace. No lo abras; revisa en la app de tu banco." : r.motivo === "codigo" ? "Eso parece un código de seguridad, no un movimiento. Nunca lo compartas." : "No encontramos un monto en ese mensaje. Revisa que sea un aviso de compra, pago o transferencia."; msg.className = "msg err"; return; }
    var it = agregarPendiente(r, "pegado");
    if (!it) { msg.textContent = "Ese movimiento ya estaba registrado."; msg.className = "msg"; return; }
    $("pegar-texto").value = ""; msg.textContent = "Leído: " + money(it.monto) + (it.comercio ? " en " + it.comercio : "") + ". Revísalo abajo y confírmalo."; msg.className = "msg ok";
    changed(); renderBandeja();
  });

  // --- Atajos que abren la app con el texto del aviso (no pasa por ningún servidor) ---
  function b64urlTexto(s) {
    var b = atob(String(s).replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "")), u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return new TextDecoder().decode(u);
  }
  function dosDig(n) { return (n < 10 ? "0" : "") + n; }
  // Avisos que la app de Android leyó de las notificaciones del banco (llegan en la URL, nunca pasan por un servidor).
  var estafasVistas = 0;
  function avisarEstafas() {
    if (!estafasVistas) return;
    toast((estafasVistas === 1 ? "Llegó un mensaje" : "Llegaron " + estafasVistas + " mensajes") + " que parecen estafa: piden confirmar un pago por un enlace. No los registramos. No los abras; revisa en la app de tu banco.");
    estafasVistas = 0;
  }
  function importarLote(cod) {
    var lista = [];
    try { lista = JSON.parse(b64urlTexto(cod)); } catch (e) { lista = []; }
    if (!Array.isArray(lista)) lista = [];
    var nuevos = 0;
    lista.slice(0, 100).forEach(function (x) {
      if (!x || typeof x.t !== "string") return;
      var r = LECTOR.leerAviso(x.t.slice(0, 2000), { remitente: String(x.a || "").slice(0, 60) });
      if (r.motivo === "estafa") estafasVistas++;
      if (!r.ok) return;
      var cuando = Number(x.ts) ? new Date(Number(x.ts)) : null;
      if (cuando && !isNaN(cuando)) {
        if (!r.fecha) r.fecha = cuando.getFullYear() + "-" + dosDig(cuando.getMonth() + 1) + "-" + dosDig(cuando.getDate());
        if (!r.hora) r.hora = dosDig(cuando.getHours()) + ":" + dosDig(cuando.getMinutes());
      }
      if (agregarPendiente(r, "android")) nuevos++;
    });
    return nuevos;
  }
  function importarDesdeEnlace() {
    var h = (location.hash || "").replace(/^#(importar(?:-lote)?)%3D/i, "#$1="), m = /^#importar=(.+)$/.exec(h), lote = /^#importar-lote=([A-Za-z0-9_\-]+)/.exec(h);
    if (!m && !lote) return false;
    try { history.replaceState(null, "", location.pathname + location.search + "#inicio"); } catch (e) {}
    if (lote) {
      var n = importarLote(lote[1]);
      if (n) { changed(); toast((n === 1 ? "Llegó 1 movimiento" : "Llegaron " + n + " movimientos") + " de tu celular. Revísalos y confírmalos."); }
      setTimeout(avisarEstafas, n ? 4500 : 0);
      if (!ACCION_INICIAL) setTimeout(function () { abrirBandeja(false); }, 300);
      return true;
    }
    var txt = ""; try { txt = decodeURIComponent(m[1].replace(/\+/g, " ")).slice(0, 4000); } catch (e) {}
    var it = agregarPendiente(LECTOR.leerAviso(txt), "enlace");
    if (it) changed();
    setTimeout(function () { abrirBandeja(false); }, 300);
    return true;
  }

  window.addEventListener("hashchange", function () {
    var acc = leerAccion(location.hash);
    if (/^#importar(?:-lote)?=/.test(location.hash)) { ACCION_INICIAL = acc; importarDesdeEnlace(); }
    if (acc) hacerAccion(acc);
  });

  // --- App de Android (la app abre esta página con ?app=android&lectura=1) ---
  var APP_ANDROID = { activa: false, lectura: false, v: 0 };
  (function () {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get("app") === "android") sessionStorage.setItem("fin-app", JSON.stringify({ lectura: q.get("lectura") === "1", v: parseInt(q.get("v"), 10) || 0 }));
      var g = JSON.parse(sessionStorage.getItem("fin-app") || "null");
      if (g) { APP_ANDROID.activa = true; APP_ANDROID.lectura = !!g.lectura; APP_ANDROID.v = g.v || 0; }
    } catch (e) {}
  })();
  function esAndroid() { return /android/i.test(navigator.userAgent); }
  function leerAccion(h) { var m = /[#&]accion=(efectivo-gasto|efectivo-ingreso|charla|dudas|preste|mepagaron)\b/.exec(h || ""); return m ? m[1] : ""; }
  function leerDicho(h) {
    var m = /[#&]dicho=([A-Za-z0-9_-]{1,2400})/.exec(h || ""); if (!m) return "";
    try { var b = atob(m[1].replace(/-/g, "+").replace(/_/g, "/")); return decodeURIComponent(escape(b)).slice(0, 800); } catch (e) { return ""; }
  }
  var ACCION_INICIAL = leerAccion(location.hash);
  function abrirEfectivo(accion) {
    var antes = state.cuentas.length, c = cuentaEfectivo(true);
    if (state.cuentas.length !== antes) { changed(); renderCuentas(); }
    addCuenta = c.id;
    abrirRegistro(accion === "efectivo-ingreso" ? "ingreso" : "gasto");
  }
  function hacerAccion(accion) {
    if (!accion) return;
    var dicho = leerDicho(location.hash);
    try { history.replaceState(null, "", location.pathname + location.search + "#inicio"); } catch (e) {}
    setTimeout(function () {
      if (accion === "dudas") return abrirDudas();
      if (accion === "preste" || accion === "mepagaron") { irA("cuentas", true); return abrirDeuda(accion === "preste" ? "preste" : "pago"); }
      if (accion !== "charla") return abrirEfectivo(accion);
      var para = ""; try { para = sessionStorage.getItem("fintelligente-voz-para") || ""; sessionStorage.removeItem("fintelligente-voz-para"); } catch (e) {}
      if (dicho && (para === "preguntas" || !$("dlg-preguntas").hidden)) return $("dlg-preguntas").hidden ? abrirPreguntas(dicho) : prPreguntar(dicho);   // el micrófono de Pregúntale
      if (!$("dlg-charla").hidden && dicho) return chUsuario(dicho);   // volvió del micrófono de la app con la charla abierta
      if (esPreguntaDicha(dicho)) return abrirPreguntas(dicho);        // "¿cuánto me debe Juan?" va a Pregúntale; "le presté..." a Cuéntame
      abrirCharla(dicho);
    }, 350);
  }
  // El botón de la barra de notificaciones (y el micrófono) recibe de todo: un gasto que contar o una pregunta.
  // Es pregunta si lo parece Y no trae un verbo de registrar (gasté, pagué, le presté, me pagó...).
  function esPreguntaDicha(t) {
    t = String(t || "").trim().toLowerCase(); if (!t) return false;
    if (/\b(gast[eé]|pagu[eé]|compr[eé]|prest[eé]|me pag[oó]|me pagaron|recib[ií]|me entr[oó]|me lleg[oó]|me consignaron|me devolvi)/.test(t) && !/^¿|\?$/.test(t)) return false;
    var pinta = /^¿|\?$/.test(t) || /^(cu[aá]nto|cu[aá]nta|qu[eé]|c[oó]mo|puedo|me alcanza|en qu[eé]|d[oó]nde|qui[eé]n|cu[aá]l|cu[aá]ndo|tengo|voy|llevo|estoy)\b/.test(t);
    if (!pinta) return false;
    try { return !!window.FinIntencion(t).intent; } catch (e) { return false; }
  }
  // La app de Android de Finti (1.9 en adelante). La de antes abría la dirección vieja y se quitó; mientras la nueva no esté
  // publicada, el botón lo dice en vez de llevar a un archivo que no existe.
  var APK_URL = "/descargas/finti.apk", apkHay = null;
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href="' + APK_URL + '"]');
    if (!a || apkHay === true) return;
    e.preventDefault();
    var no = function () { apkHay = false; toast("La app de Android de Finti sale muy pronto. Mientras tanto, instálala desde Chrome: menú y luego Instalar app."); };
    if (apkHay === false) return no();
    fetch(APK_URL, { method: "HEAD", cache: "no-store" }).then(function (r) {
      if (!r.ok) return no();
      apkHay = true; var d = document.createElement("a"); d.href = APK_URL; d.download = "finti.apk"; document.body.appendChild(d); d.click(); d.remove();
    }).catch(no);
  });
  var INTENT_AJUSTES = "intent://ajustes#Intent;scheme=fintelligente;package=co.fintelligente.app;end";
  var INTENT_PRIVACIDAD = "intent://privacidad#Intent;scheme=fintelligente;package=co.fintelligente.app;end";
  // Cómo se cuidan los avisos: lo que más preocupa al dar permiso de leer notificaciones, dicho en claro.
  function tarjetaConfianza(abierta) {
    var android = APP_ANDROID.activa || esAndroid();
    var puntos = android ? [
      ["i-shield", "Solo avisos de dinero", "Leemos únicamente los avisos de bancos y billeteras. Nunca WhatsApp, Telegram, Messenger ni tus chats."],
      ["i-lock", "Los códigos de seguridad se bloquean", "Si un mensaje trae un código o una clave, se descarta en el acto y nunca se guarda."],
      ["i-note", "Del aviso solo queda lo necesario", "Valor, comercio, fecha y medio de pago. El texto completo se borra y nunca llega a nuestros servidores."],
      ["i-wallet", "Nadie puede mover tu plata", "No pedimos ni guardamos claves del banco. Finti solo anota; no hace pagos ni transferencias."],
      ["i-bell", "Te avisamos de mensajes falsos", "Si llega un mensaje que pide confirmar un pago por un enlace, no lo registramos y te avisamos. Es la estafa más común con Bre-B."],
      ["i-check", "Tú tienes el control", "Puedes pausar la lectura, elegir si se leen los mensajes de texto o el correo, y quitar el permiso cuando quieras."]
    ] : [
      ["i-lock", "Los códigos de seguridad se bloquean", "Si un aviso trae un código o una clave, se descarta y nunca se guarda."],
      ["i-note", "Del aviso solo queda lo necesario", "Valor, comercio, fecha y medio de pago. El texto completo se descarta."],
      ["i-wallet", "Nadie puede mover tu plata", "No pedimos ni guardamos claves del banco. Finti solo anota; no hace pagos ni transferencias."],
      ["i-bell", "Te avisamos de mensajes falsos", "Si un aviso pide confirmar un pago por un enlace, no lo registramos y te avisamos. Es la estafa más común con Bre-B."]
    ];
    return '<details class="confianza"' + (abierta ? " open" : "") + '><summary><svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg>¿Cómo cuidamos tus avisos?</summary><ul>' +
      puntos.map(function (x) { return '<li><svg class="ic" aria-hidden="true"><use href="#' + x[0] + '"/></svg><span><b>' + x[1] + "</b>" + x[2] + "</span></li>"; }).join("") + "</ul>" +
      (APP_ANDROID.activa && APP_ANDROID.v >= 8 ? '<a class="btn" href="' + INTENT_PRIVACIDAD + '">Ver lo que ha leído la app</a>' : "") +
      '<a class="link-btn" href="/legal/privacidad.html" target="_blank" rel="noopener">Leer la política de datos</a></details>';
  }

  // --- Conectar bancos: buzón cifrado en el sitio propio ---
  var BUZON_KEY = "fintelligente-buzon", buzon = null, buzonCfg = { dominio: "", sitio: "", atajo: "" }, revisando = false;
  try { var bz = JSON.parse(localStorage.getItem(BUZON_KEY) || "null"); if (bz && /^[a-z0-9]{10}$/.test(bz.buzon)) buzon = bz; } catch (e) {}
  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open("fintelligente", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("llaves"); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  function idbDo(modo, fn) { return idb().then(function (db) { return new Promise(function (res, rej) { var tx = db.transaction("llaves", modo), q = fn(tx.objectStore("llaves")); tx.oncomplete = function () { res(q && q.result); }; tx.onerror = function () { rej(tx.error); }; }); }); }
  function b64d(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function crearBuzon() {
    var msg = $("fuentes-msg"); msg.textContent = "Creando tu buzón privado…"; msg.className = "msg";
    var token = randStr(32), par;
    crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, false, ["encrypt", "decrypt"]).then(function (kp) {
      par = kp; return crypto.subtle.exportKey("jwk", kp.publicKey);
    }).then(function (pub) {
      return api("/api/bandeja/registro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token, pub: pub }) });
    }).then(function (j) {
      if (!j.buzon) throw j;
      return idbDo("readwrite", function (st) { return st.put(par.privateKey, "buzon"); }).then(function () {
        buzon = { buzon: j.buzon, token: token, clave: j.clave }; try { localStorage.setItem(BUZON_KEY, JSON.stringify(buzon)); } catch (e) {}
        msg.textContent = "¡Listo! Tu buzón está creado."; msg.className = "msg ok"; metrica("conecto", "una");
        renderFuentes(); programarBuzon();
      });
    }).catch(function (j) { msg.textContent = (j && j.error) || "No se pudo crear el buzón. Revisa tu conexión."; msg.className = "msg err"; });
  }
  function descifrar(item, priv) {
    return crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, b64d(item.k)).then(function (raw) {
      return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    }).then(function (aes) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(item.iv) }, aes, b64d(item.c)); })
      .then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
  }
  function procesarEntrada(d) {
    var nuevos = 0, directos = [];
    (d.partes || []).forEach(function (p) {
      if (p.tipo === "verificacion") {
        var cod = /\b(\d{9})\b/.exec(p.contenido || "") || /(?:código|code)[^\d]{0,30}(\d{6,10})/i.exec(p.contenido || "");
        state.pendientes.push({ id: rid("x"), origen: "correo", recibido: new Date().toISOString(), verificacion: { codigo: cod ? cod[1] : "" }, tipo: "", monto: 0, comercio: "", fecha: hoyStr(), hora: "" });
        nuevos++; return;
      }
      // Del atajo (iPhone, Android o Siri) puede llegar "le presté $ 50.000 a Juan" o "Juan me pagó": eso no es
      // un movimiento del banco sino una deuda con un amigo. Queda en Te deben, por anotar con Cuéntame.
      if (d.origen === "atajo" && p.tipo === "texto" && esDeuda(p.contenido)) { guardarDicho(p.contenido); nuevosDichos++; return; }
      var r = p.tipo === "xml" ? LECTOR.leerFactura(p.contenido, p.asunto) : LECTOR.leerAviso((p.asunto ? p.asunto + ". " : "") + (p.contenido || ""), { remitente: p.de || "" });
      if (r.motivo === "estafa") { estafasVistas++; setTimeout(avisarEstafas, 600); }
      var it = agregarPendiente(r, d.origen === "atajo" ? "atajo" : "correo");
      if (it && d.origen === "atajo" && it.medio === "Efectivo") directos.push(it.id); else if (it) nuevos++;
    });
    if (directos.length) confirmar(directos);
    return nuevos;
  }
  var DICHOS_KEY = "fintelligente-dichos", nuevosDichos = 0;
  function esDeuda(t) {
    t = String(t || "").toLowerCase();
    return /\b(le |les )?prest[eé]\b/.test(t) || /\bme (pag[oó]|pagaron|devolvi[oó]|devolvieron|abon[oó])\b/.test(t) || /\bme debe(n)?\b/.test(t);
  }
  function leerDichos() { try { var l = JSON.parse(localStorage.getItem(DICHOS_KEY) || "[]"); return Array.isArray(l) ? l.filter(function (x) { return x && typeof x.t === "string"; }) : []; } catch (e) { return []; } }
  function guardarDichos(l) { try { localStorage.setItem(DICHOS_KEY, JSON.stringify(l.slice(-20))); } catch (e) {} }
  function guardarDicho(t) { var l = leerDichos(); l.push({ id: rid("y"), t: String(t).trim().slice(0, 200) }); guardarDichos(l); }
  function quitarDicho(id) { guardarDichos(leerDichos().filter(function (x) { return x.id !== id; })); renderMeDeben(); }
  function avisarDichos() {
    if (!nuevosDichos) return; var n = nuevosDichos; nuevosDichos = 0; renderMeDeben();
    var l = leerDichos(), ult = l[l.length - 1];
    if (!ult) return;
    toast(n === 1 ? "Llegó del atajo: " + esc(ult.t) : "Llegaron " + n + " deudas con amigos para anotar.", { action: "Anotar", ms: 9000, onAction: function () { quitarDicho(ult.id); abrirCharla(ult.t); } });
  }
  function revisarBuzon(silencio) {
    if (!WEB || !buzon || revisando) return Promise.resolve(0);
    revisando = true;
    var q = "?buzon=" + buzon.buzon + "&token=" + encodeURIComponent(buzon.token);
    return api("/api/bandeja" + q).then(function (j) { return procesarBandeja(j, silencio); })
      .catch(function () { return 0; }).then(function (n) { revisando = false; return n; });
  }
  // j: respuesta del buzón ({ items } o un error). Descifra, agrega a Por confirmar y borra lo ya leído.
  function procesarBandeja(j, silencio) {
    if (!buzon) return Promise.resolve(0);
    var b = buzon;
    return idbDo("readonly", function (st) { return st.get("buzon"); }).then(function (priv) {
      if (j._status === 403 || j._status === 404 || j.error === 403 || j.error === 404) { if (!silencio) toast("Tu buzón ya no existe. Créalo de nuevo en Conectar bancos."); return 0; }
      if (!priv || !j.items || !j.items.length) return 0;
      var ids = [], total = 0;
      return Promise.all(j.items.map(function (it) {
        return descifrar(it, priv).then(function (d) { total += procesarEntrada(d); ids.push(it.id); }, function () { ids.push(it.id); });
      })).then(function () {
        if (total) { changed(); renderBandeja(); }
        avisarDichos();
        if (ids.length) api("/api/bandeja", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ buzon: b.buzon, token: b.token, ids: ids }) });
        if (total && $("dlg-bandeja").hidden) toast((total === 1 ? "Llegó 1 movimiento" : "Llegaron " + total + " movimientos") + " para confirmar.", { action: "Revisar", ms: 7000, onAction: function () { abrirBandeja(false); } });
        return total;
      });
    }).catch(function () { return 0; });
  }
  function programarBuzon() { sincronizar(true); }

  // --- Novedades: nube y buzón en UNA sola consulta, al abrir la app y al volver a ella ---
  // Antes se preguntaba cada minuto (buzón) y cada dos minutos (nube) mientras la app estaba abierta.
  // Ahora: al abrir, al volver a la app, al recuperar internet y, si sigue en primer plano, cada 10 minutos.
  var ultimaSync = 0, sincronizando = null, SYNC_MIN = 20000, SYNC_LENTO = 600000;
  function sincronizar(forzar) {
    if (!WEB || (!cuenta && !buzon)) return Promise.resolve(0);
    if (sincronizando) return sincronizando;
    if (!forzar && Date.now() - ultimaSync < SYNC_MIN) return Promise.resolve(0);
    ultimaSync = Date.now();
    var q = buzon ? "?buzon=" + buzon.buzon + "&token=" + encodeURIComponent(buzon.token) : "";
    sincronizando = apiC("/api/estado" + q).then(function (j) {
      if (j._status !== 200) return 0;
      var nube = cuenta && j.nube ? alMetaNube(j.nube) : null;
      return Promise.all([nube, buzon && j.bandeja ? procesarBandeja(j.bandeja, true) : 0]).then(function (r) { return r[1] || 0; });
    }).catch(function () { return 0; }).then(function (n) { sincronizando = null; return n; });
    return sincronizando;
  }
  // Si la persona salió de la app (más de 3 segundos) y volvió, se revisa de una vez: quizá viene de correr
  // el atajo del iPhone o de reenviar un correo. Un cambio rápido de ventana no gasta otra consulta.
  var fueraDesde = 0;
  function alVolverALaApp() {
    if (document.visibilityState === "hidden") { fueraDesde = Date.now(); return; }
    var volvio = fueraDesde && Date.now() - fueraDesde > 3000; fueraDesde = 0;
    sincronizar(volvio);
  }
  document.addEventListener("visibilitychange", alVolverALaApp);
  window.addEventListener("focus", alVolverALaApp);
  window.addEventListener("blur", function () { if (!fueraDesde) fueraDesde = Date.now(); });
  window.addEventListener("pageshow", function (e) { if (e.persisted) sincronizar(true); });
  setInterval(function () { if (document.visibilityState === "visible" && document.hasFocus()) sincronizar(false); }, SYNC_LENTO);

  var fuenteTab = esIOS() ? "iphone" : esAndroid() ? "android" : "correo", masFormasAbierto = false;
  var INTENT_BOTON = "intent://boton-efectivo#Intent;scheme=fintelligente;package=co.fintelligente.app;end";
  function tarjetaBotonEfectivo() {
    return '<div class="app-card"><h4>Finti con un toque</h4><p>Agrega el botón Finti a la barra de notificaciones. Tócalo y dile lo que pasó: un gasto, lo que te pagaron, que le prestaste plata a alguien o que ya te pagó. Si le preguntas algo, como cuánto puedes gastar hoy, te responde Pregúntale.</p>' +
      '<a class="btn" href="' + INTENT_BOTON + '">Agregar el botón Finti</a>' +
      '<p class="privacy">Tu voz se entiende en el teléfono y no se guarda. También puedes mantener presionado el ícono de Finti y elegir Gasto en efectivo, Le presté o Me pagaron.</p></div>';
  }
  function tarjetaApp() {
    if (APP_ANDROID.activa) {
      return APP_ANDROID.lectura ?
        '<div class="app-card"><h4>Lectura automática</h4><p class="ok-line">Activa en este celular</p><p>Cada vez que te llegue un aviso de compra, pago o transferencia de tu banco o billetera, aparece aquí en <b>Por confirmar</b>. Todo se lee dentro de tu celular: no pedimos claves y el texto de tus mensajes no pasa por ningún servidor.</p>' +
          '<a class="link-btn" href="' + INTENT_AJUSTES + '">Revisar permisos</a></div>' + tarjetaBotonEfectivo() :
        '<div class="app-card"><h4>Lectura automática</h4><p>Actívala y cada pago o transferencia de Nequi, Bancolombia, Daviplata y demás bancos llega solo, segundos después de hacerlo.</p>' +
          '<a class="btn primary" href="' + INTENT_AJUSTES + '">Activar lectura automática</a>' +
          '<p class="privacy">Se abre un ajuste de Android: busca Finti y actívalo. Si aparece en gris, sigue los pasos que muestra la app.</p></div>' + tarjetaConfianza(true) + tarjetaBotonEfectivo();
    }
    if (!esAndroid()) return "";
    return '<div class="app-card"><h4>Registra tus pagos sin hacer nada</h4><p>Con la app de Finti para Android, cada pago o transferencia que hagas con Nequi, Bancolombia, Daviplata u otro banco aparece solo, segundos después. Sin claves del banco y sin configurar correos.</p>' +
      '<ol class="app-pasos"><li>1. Descarga</li><li>2. Activa la lectura</li><li>3. Listo</li></ol>' +
      '<a class="btn primary" href="' + APK_URL + '" download>Descargar la app</a>' +
      '<p class="privacy">Si usas Chrome, lo que tienes aquí aparece también en la app.</p></div>';
  }
  var QR_APP = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 37 37" shape-rendering="crispEdges"><rect x="-2" y="-2" width="37" height="37" fill="#fff"/><path fill="#111" d="M0 0h7v1h-7zM9 0h1v1h-1zM13 0h2v1h-2zM16 0h3v1h-3zM20 0h3v1h-3zM26 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM8 1h2v1h-2zM11 1h2v1h-2zM16 1h1v1h-1zM18 1h1v1h-1zM26 1h1v1h-1zM32 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM8 2h1v1h-1zM10 2h1v1h-1zM14 2h2v1h-2zM21 2h2v1h-2zM26 2h1v1h-1zM28 2h3v1h-3zM32 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h1v1h-1zM11 3h1v1h-1zM14 3h3v1h-3zM18 3h3v1h-3zM22 3h1v1h-1zM26 3h1v1h-1zM28 3h3v1h-3zM32 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM9 4h3v1h-3zM13 4h5v1h-5zM20 4h1v1h-1zM23 4h2v1h-2zM26 4h1v1h-1zM28 4h3v1h-3zM32 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM11 5h5v1h-5zM17 5h1v1h-1zM19 5h1v1h-1zM22 5h1v1h-1zM26 5h1v1h-1zM32 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h1v1h-1zM24 6h1v1h-1zM26 6h7v1h-7zM8 7h5v1h-5zM15 7h2v1h-2zM18 7h3v1h-3zM0 8h1v1h-1zM6 8h1v1h-1zM8 8h1v1h-1zM11 8h4v1h-4zM16 8h2v1h-2zM19 8h2v1h-2zM22 8h5v1h-5zM29 8h3v1h-3zM0 9h1v1h-1zM3 9h2v1h-2zM8 9h4v1h-4zM13 9h3v1h-3zM17 9h3v1h-3zM21 9h3v1h-3zM28 9h3v1h-3zM0 10h1v1h-1zM2 10h1v1h-1zM6 10h1v1h-1zM8 10h3v1h-3zM12 10h4v1h-4zM17 10h1v1h-1zM22 10h1v1h-1zM24 10h2v1h-2zM28 10h1v1h-1zM30 10h1v1h-1zM4 11h1v1h-1zM7 11h5v1h-5zM13 11h1v1h-1zM15 11h4v1h-4zM20 11h2v1h-2zM25 11h1v1h-1zM27 11h4v1h-4zM1 12h3v1h-3zM5 12h2v1h-2zM10 12h1v1h-1zM13 12h1v1h-1zM15 12h1v1h-1zM17 12h1v1h-1zM19 12h1v1h-1zM21 12h1v1h-1zM23 12h1v1h-1zM26 12h2v1h-2zM31 12h2v1h-2zM0 13h2v1h-2zM5 13h1v1h-1zM7 13h5v1h-5zM13 13h1v1h-1zM17 13h2v1h-2zM21 13h1v1h-1zM23 13h2v1h-2zM26 13h2v1h-2zM29 13h1v1h-1zM31 13h2v1h-2zM0 14h1v1h-1zM2 14h3v1h-3zM6 14h5v1h-5zM12 14h1v1h-1zM14 14h4v1h-4zM20 14h3v1h-3zM24 14h6v1h-6zM31 14h1v1h-1zM0 15h4v1h-4zM5 15h1v1h-1zM7 15h1v1h-1zM12 15h2v1h-2zM16 15h1v1h-1zM18 15h1v1h-1zM20 15h1v1h-1zM22 15h4v1h-4zM27 15h1v1h-1zM30 15h1v1h-1zM32 15h1v1h-1zM1 16h1v1h-1zM6 16h5v1h-5zM13 16h3v1h-3zM17 16h1v1h-1zM20 16h1v1h-1zM22 16h1v1h-1zM25 16h1v1h-1zM27 16h3v1h-3zM32 16h1v1h-1zM0 17h1v1h-1zM2 17h2v1h-2zM7 17h2v1h-2zM10 17h1v1h-1zM12 17h1v1h-1zM14 17h3v1h-3zM18 17h3v1h-3zM23 17h1v1h-1zM26 17h1v1h-1zM29 17h4v1h-4zM0 18h1v1h-1zM2 18h1v1h-1zM4 18h1v1h-1zM6 18h1v1h-1zM8 18h5v1h-5zM14 18h2v1h-2zM17 18h11v1h-11zM29 18h2v1h-2zM32 18h1v1h-1zM2 19h4v1h-4zM9 19h1v1h-1zM14 19h1v1h-1zM19 19h2v1h-2zM22 19h2v1h-2zM25 19h2v1h-2zM28 19h3v1h-3zM0 20h3v1h-3zM4 20h1v1h-1zM6 20h1v1h-1zM10 20h1v1h-1zM13 20h2v1h-2zM18 20h2v1h-2zM21 20h1v1h-1zM23 20h1v1h-1zM25 20h1v1h-1zM27 20h3v1h-3zM0 21h1v1h-1zM5 21h1v1h-1zM13 21h1v1h-1zM21 21h1v1h-1zM23 21h1v1h-1zM25 21h1v1h-1zM27 21h3v1h-3zM0 22h1v1h-1zM2 22h1v1h-1zM4 22h1v1h-1zM6 22h2v1h-2zM10 22h2v1h-2zM13 22h2v1h-2zM19 22h1v1h-1zM21 22h1v1h-1zM25 22h1v1h-1zM28 22h2v1h-2zM31 22h1v1h-1zM0 23h1v1h-1zM3 23h1v1h-1zM7 23h2v1h-2zM10 23h1v1h-1zM13 23h1v1h-1zM15 23h2v1h-2zM19 23h2v1h-2zM22 23h1v1h-1zM24 23h1v1h-1zM26 23h6v1h-6zM0 24h3v1h-3zM6 24h6v1h-6zM13 24h2v1h-2zM16 24h1v1h-1zM20 24h1v1h-1zM23 24h7v1h-7zM8 25h2v1h-2zM12 25h2v1h-2zM15 25h3v1h-3zM19 25h3v1h-3zM24 25h1v1h-1zM28 25h1v1h-1zM30 25h3v1h-3zM0 26h7v1h-7zM9 26h3v1h-3zM13 26h1v1h-1zM15 26h1v1h-1zM17 26h1v1h-1zM20 26h1v1h-1zM22 26h3v1h-3zM26 26h1v1h-1zM28 26h1v1h-1zM30 26h2v1h-2zM0 27h1v1h-1zM6 27h1v1h-1zM9 27h2v1h-2zM13 27h1v1h-1zM17 27h2v1h-2zM21 27h4v1h-4zM28 27h5v1h-5zM0 28h1v1h-1zM2 28h3v1h-3zM6 28h1v1h-1zM9 28h3v1h-3zM13 28h1v1h-1zM16 28h1v1h-1zM20 28h3v1h-3zM24 28h6v1h-6zM0 29h1v1h-1zM2 29h3v1h-3zM6 29h1v1h-1zM9 29h3v1h-3zM14 29h1v1h-1zM18 29h1v1h-1zM23 29h3v1h-3zM27 29h2v1h-2zM30 29h1v1h-1zM32 29h1v1h-1zM0 30h1v1h-1zM2 30h3v1h-3zM6 30h1v1h-1zM10 30h4v1h-4zM15 30h1v1h-1zM17 30h1v1h-1zM19 30h1v1h-1zM23 30h1v1h-1zM25 30h1v1h-1zM27 30h2v1h-2zM31 30h2v1h-2zM0 31h1v1h-1zM6 31h1v1h-1zM18 31h1v1h-1zM22 31h1v1h-1zM25 31h1v1h-1zM27 31h4v1h-4zM0 32h7v1h-7zM8 32h1v1h-1zM10 32h3v1h-3zM15 32h1v1h-1zM17 32h1v1h-1zM22 32h3v1h-3zM27 32h1v1h-1zM31 32h1v1h-1z"/></svg>';
  // --- iPhone: un atajo de Atajos envía los avisos al buzón cifrado ---
  function codigoConexion() { return buzon ? "FT-" + buzon.buzon + "-" + buzon.clave : ""; }
  function pasosIos(id, titulo, chip, pasos) {
    return '<details class="ios-auto" data-ios="' + id + '"><summary><span>' + titulo + '</span><span class="chip ' + (chip === "Automático" ? "ok" : "") + '">' + chip + "</span></summary><ol>" +
      pasos.map(function (p) { return "<li>" + p + "</li>"; }).join("") + "</ol></details>";
  }
  function tarjetaIphone() {
    var cod = codigoConexion(), atajo = buzonCfg.atajo;
    var html = '<div class="app-card ios-card"><h4>Conecta tu iPhone</h4>' +
      '<p>Con el atajo de Finti, tus compras con Apple Pay y los mensajes de texto del banco se registran solos. Lo demás lo envías con dos toques en la parte de atrás del iPhone, y el efectivo lo sumas o restas desde el Centro de control.</p>' +
      '<ol class="ios-pasos"><li><b>Tu código de conexión</b>' +
      (cod ? copiable(cod, "código") + '<span class="hint">Es privado: con él, el atajo envía avisos a tu cuenta. No lo compartas.</span>'
           : '<span class="hint">Lo usa el atajo para enviar los avisos a tu cuenta, cifrados.</span><button class="btn primary" type="button" id="btn-crear-buzon">Crear mi código</button>') + "</li>" +
      '<li><b>Instala el atajo</b>' + (atajo ? '<span class="hint">Cuando te lo pregunte, pega tu código.</span><a class="btn' + (cod ? " primary" : "") + '" href="' + esc(atajo) + '" target="_blank" rel="noopener">Instalar atajo</a>'
           : '<span class="hint">El atajo estará disponible muy pronto. Mientras tanto, usa Pegar aviso.</span>') + "</li>" +
      "<li><b>Elige qué se registra solo</b><span class=\"hint\">Cada opción toma un minuto y se hace una sola vez.</span></li></ol></div>" +
      pasosIos("applepay", "Compras con Apple Pay", "Automático", [
        "Abre la app <b>Atajos</b>, ve a <b>Automatización</b> y toca <b>+</b>.",
        "Elige <b>Transacción</b>, selecciona tus tarjetas y marca <b>Ejecutar inmediatamente</b>. Toca <b>Siguiente</b> y luego <b>Nuevo atajo en blanco</b>.",
        "Agrega la acción <b>Texto</b> y arma esta frase: escribe <b>Compraste</b>, toca <b>Entrada del atajo</b> y elige el monto; escribe <b>en</b>, toca otra vez <b>Entrada del atajo</b> y elige el comercio; termina con <b>con Apple Pay</b>.",
        "Agrega la acción <b>Ejecutar atajo</b>, elige <b>Finti</b> y, en Entrada, elige <b>Texto</b>.",
        "Listo: cada vez que pagues con el iPhone en un datáfono, el movimiento llega a Por confirmar."]) +
      pasosIos("sms", "Mensajes de texto del banco", "Automático", [
        "En <b>Atajos</b>, ve a <b>Automatización</b>, toca <b>+</b> y elige <b>Mensaje</b>.",
        "En <b>El mensaje contiene</b> escribe el nombre de tu banco, por ejemplo <b>Bancolombia</b>. Marca <b>Ejecutar inmediatamente</b> y toca <b>Siguiente</b>.",
        "Toca <b>Nuevo atajo en blanco</b>, agrega <b>Ejecutar atajo</b>, elige <b>Finti</b> y, en Entrada, elige <b>Entrada del atajo</b>.",
        "Repite con cada banco que te avise por SMS. Solo se envían los mensajes que nombran a ese banco."]) +
      pasosIos("atras", "Notificaciones de Nequi, Daviplata y otras apps", "Dos toques", [
        "Ve a <b>Ajustes</b>, luego <b>Accesibilidad</b>, <b>Tocar</b>, <b>Tocar atrás</b> y <b>Doble toque</b>. Elige <b>Finti</b>.",
        "Cuando te llegue el aviso, toma una captura de pantalla con la notificación a la vista.",
        "Toca dos veces la parte de atrás del iPhone y elige <b>Mi última captura de pantalla</b>. El atajo lee el aviso y lo envía.",
        "Si copiaste el texto de un aviso, elige <b>Lo que copié</b>."]) +
      pasosIos("efectivo", "Sumar o restar efectivo", "Un toque", [
        "Abre el <b>Centro de control</b> (desliza desde la esquina de arriba a la derecha), toca <b>+</b> y luego <b>Agregar un control</b>.",
        "Busca <b>Atajos</b>, elige <b>Ejecutar atajo</b> y selecciona <b>Finti</b>.",
        "Cuando pagues o recibas efectivo, toca ese control y elige <b>Gasto en efectivo</b> o <b>Ingreso en efectivo</b>. Se registra de una vez en tu cuenta de efectivo.",
        "Con Siri también funciona: di <b>Oye Siri, Finti</b> y responde cuánto y en qué."]) +
      pasosIos("amigos", "Plata que prestas a amigos", "Un toque", [
        "Con el mismo control o con <b>Oye Siri, Finti</b>, elige <b>Le presté a alguien</b>: dile a quién y cuánto.",
        "Cuando te paguen, elige <b>Me pagaron</b> y di quién.",
        "No llega a Por confirmar: queda en <b>Te deben</b>, en Cuentas, listo para anotar."]) +
      '<div class="pc-iphone"><p><b>¿Prefieres hacerlo a mano?</b> Copia el aviso y pégalo.</p><button class="btn" type="button" id="btn-pegar-aviso">Pegar aviso</button></div>';
    return html;
  }
  function tarjetaPC() {
    return '<div class="app-card app-card-pc"><div class="qr-box" aria-hidden="true">' + QR_APP + '</div><div><h4>Conéctalo desde tu celular</h4><p>Con la app de Finti para Android, cada pago o transferencia de Nequi, Bancolombia, Daviplata u otro banco se registra solo. Si entras con tu cuenta, también lo ves aquí en el computador.</p>' +
      '<ol class="app-pasos"><li>1. Escanea el código con la cámara</li><li>2. Descarga la app</li><li>3. Activa la lectura</li></ol></div></div>' +
      '<div class="pc-iphone"><p><b>¿Tienes iPhone?</b> Abre esta página en Safari desde tu iPhone y sigue la guía. O copia el aviso y pégalo aquí.</p><button class="btn" type="button" id="btn-pegar-aviso">Pegar aviso</button></div>';
  }
  function pegarAviso() {
    closeDlg("dlg-fuentes"); abrirBandeja(true);
    try {
      if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) {
        t = String(t || "").trim(); if (!t || t.length > 4000) return;
        $("pegar-texto").value = t; $("pegar-leer").click();
      }, function () {});
    } catch (e) {}
  }
  function copiable(valor, etiqueta) { return '<div class="copia"><code>' + esc(valor) + '</code><button class="btn" type="button" data-copiar="' + esc(valor) + '">Copiar' + (etiqueta ? " " + etiqueta : "") + "</button></div>"; }
  function renderFuentes() {
    var body = $("fuentes-body");
    $("fuentes-claude").hidden = WEB; $("fuentes-web").hidden = !WEB;
    if (!WEB) return;
    var movil = esAndroid() || esIOS() || APP_ANDROID.activa;
    var arriba = APP_ANDROID.activa || esAndroid() ? tarjetaApp() : esIOS() ? tarjetaIphone() : tarjetaPC();
    // Opciones avanzadas (atajos, MacroDroid, reenvío de correo): escondidas y solo donde sirven.
    var avanzado = (esAndroid() || APP_ANDROID.activa || buzonCfg.dominio) && !esIOS() ? contenidoBuzon() : "";
    var confianza = APP_ANDROID.activa && !APP_ANDROID.lectura ? "" : tarjetaConfianza(!APP_ANDROID.activa && esAndroid());   // sin activar: va junto a la lectura
    var extracto = '<div class="channel"><h4><svg class="ic"><use href="#i-up"/></svg>¿Tienes meses anteriores?</h4><p>Descarga de tu banco los movimientos en Excel o CSV e impórtalos de una vez. El asesor aprende de ellos desde hoy.</p>' +
      '<div class="row"><button class="btn" type="button" data-open-extracto>Importar el extracto</button></div></div>';
    body.innerHTML = arriba + confianza + extracto + (avanzado ? '<details class="mas-formas" id="mas-formas"' + (masFormasAbierto ? " open" : "") + "><summary>Opciones avanzadas</summary>" + avanzado + "</details>" : "");
  }
  function contenidoBuzon() {
    if (!buzon) {
      return '<div class="channel"><h4>Tu buzón privado</h4><p>Para quienes quieren automatizarlo con Atajos de iPhone o MacroDroid. Lo que llegue se guarda cifrado con una llave que vive únicamente en este dispositivo: ni nosotros podemos leerlo.</p>' +
        '<div class="row"><button class="btn primary" type="button" id="btn-crear-buzon">Crear mi buzón</button></div></div>';
    }
    var correo = buzon.buzon + "@" + (buzonCfg.dominio || "entrada.tudominio.com"), url = (buzonCfg.sitio || location.origin) + "/api/entrada";
    var json = '{"buzon":"' + buzon.buzon + '","clave":"' + buzon.clave + '","texto":"…"}';
    var opciones = [["correo", "Correo"], ["iphone", "iPhone"], ["android", "Android"]].filter(function (t) { return t[0] !== "correo" || buzonCfg.dominio; });
    if (!opciones.some(function (t) { return t[0] === fuenteTab; })) fuenteTab = esIOS() ? "iphone" : "android";
    var tabs = '<div class="seg ' + (opciones.length === 3 ? "seg-full3" : "seg-full") + '" id="fuente-tabs" role="group" aria-label="Forma de conectar">' + opciones.map(function (t) {
      return '<button type="button" data-tab-f="' + t[0] + '" aria-pressed="' + (fuenteTab === t[0]) + '">' + t[1] + "</button>"; }).join("") + "</div>";
    var html = "";
    if (fuenteTab === "correo") {
      html = (buzonCfg.dominio ? "" : '<p class="mov-warn">El correo de entrada aún no está configurado en este sitio. Mientras tanto, usa el iPhone o Android.</p>') +
        '<p class="hint">Tu dirección privada:</p>' + copiable(correo) +
        '<ol class="pasos"><li>Activa en tu banco las <b>alertas por correo</b> de compras, pagos y transferencias (en Bancolombia: <b>Alertas y Notificaciones</b>).</li>' +
        "<li>En Gmail, en el computador: <b>Configuración > Reenvío y correo POP/IMAP > Agregar una dirección de reenvío</b> y pega tu dirección. Gmail envía un código: <b>te aparecerá aquí, en Por confirmar</b>. Escríbelo en Gmail.</li>" +
        "<li>Abre un correo de alerta de tu banco, toca los tres puntos y luego <b>Filtrar mensajes similares > Crear filtro > Reenviar a</b> tu dirección. Repite con cada banco.</li>" +
        '<li><b>Facturas electrónicas:</b> crea otro filtro con <b>Contiene las palabras</b> <code>has:attachment filename:zip factura</code> y reenvíalo igual. Al pagar, pide la factura a tu nombre con este correo.</li></ol>' +
        '<p class="privacy">Solo llega lo que tus filtros reenvían. Guardamos únicamente el texto del aviso y el XML de la factura, cifrados; el resto del correo se descarta.</p>';
    } else if (fuenteTab === "iphone") {
      html = '<ol class="pasos"><li>Abre la app <b>Atajos > Automatización > Nueva automatización > Mensaje</b>.</li>' +
        "<li>En <b>El mensaje contiene</b> escribe el nombre del banco (por ejemplo <code>Bancolombia</code>). Elige <b>Ejecutar inmediatamente</b>. Haz una automatización por banco.</li>" +
        "<li>Agrega la acción <b>Obtener contenido de URL</b> con el método <b>POST</b> y el cuerpo de la solicitud en <b>JSON</b>, con los campos <code>buzon</code>, <code>clave</code> y <code>texto</code>. En <code>texto</code> elige la variable <b>Entrada del atajo</b>.</li></ol>" +
        '<p class="hint">URL:</p>' + copiable(url) + '<p class="hint">Buzón y clave:</p>' + copiable(buzon.buzon, "buzón") + copiable(buzon.clave, "clave") +
        '<p class="privacy">Apple no deja leer las notificaciones de otras apps, así que en iPhone funciona con avisos que llegan por SMS o correo. Para los de Nequi que llegan como notificación, copia el aviso y pégalo en <b>Por confirmar</b>.</p>';
    } else {
      html = '<p class="hint"><b>Lo más fácil:</b> la app de Finti para Android lo hace sola, sin MacroDroid. Si prefieres no instalarla:</p><ol class="pasos"><li>Instala <b>MacroDroid</b> (gratis, Play Store).</li>' +
        "<li>Crea una macro con el disparador <b>Notificación recibida</b> y elige las apps de tus bancos y billeteras (Nequi, Daviplata, Bancolombia…). Agrega otro disparador <b>SMS recibido</b> para los bancos que avisan por mensaje.</li>" +
        "<li>Acción: <b>Solicitud HTTP</b>, método <b>POST</b>, tipo <b>JSON</b>, a esta URL, con este cuerpo (en <b>texto</b> usa la variable del texto de la notificación o del SMS):</li></ol>" +
        copiable(url) + copiable(json, "plantilla") +
        '<p class="privacy">La lectura ocurre en tu celular y solo se envía el texto del aviso, a tu buzón cifrado.</p>';
    }
    return tabs + html + '<div class="row" style="margin-top:12px"><button class="btn" type="button" id="btn-revisar-buzon">Revisar ahora</button><button class="link-btn" type="button" id="btn-borrar-buzon">Desconectar y borrar mi buzón</button></div>';
  }
  function abrirFuentes() { $("menu-mas").hidden = true; $("fuentes-msg").textContent = ""; renderFuentes(); openDlg("dlg-fuentes"); }
  $("btn-fuentes-menu").addEventListener("click", abrirFuentes);
  document.addEventListener("click", function (e) { if (e.target.closest("[data-open-fuentes]")) { closeDlg("dlg-bandeja"); abrirFuentes(); } });
  $("dlg-fuentes").addEventListener("toggle", function (e) { if (e.target && e.target.id === "mas-formas") masFormasAbierto = e.target.open; }, true);
  $("dlg-fuentes").addEventListener("click", function (e) {
    var t = e.target.closest("[data-tab-f]"); if (t) { fuenteTab = t.dataset.tabF; renderFuentes(); return; }
    t = e.target.closest("[data-copiar]"); if (t) { try { navigator.clipboard.writeText(t.dataset.copiar); t.textContent = "Copiado ✓"; } catch (er) {} return; }
    if (e.target.closest("#btn-crear-buzon")) { crearBuzon(); return; }
    if (e.target.closest("#btn-pegar-aviso")) { pegarAviso(); return; }
    if (e.target.closest("#btn-revisar-buzon")) {
      var msg = $("fuentes-msg"); msg.textContent = "Revisando…"; msg.className = "msg";
      revisarBuzon(false).then(function (n) { msg.textContent = n ? "Llegaron " + plural(n, "movimiento") + ". Están en Por confirmar." : "No hay movimientos nuevos."; msg.className = "msg ok"; });
      return;
    }
    var bb = e.target.closest("#btn-borrar-buzon");
    if (bb) {
      if (bb.dataset.armado !== "1") { bb.dataset.armado = "1"; bb.textContent = "¿Seguro? Toca otra vez"; return; }
      api("/api/bandeja", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ buzon: buzon.buzon, token: buzon.token, todo: true }) }).then(function () {}, function () {});
      idbDo("readwrite", function (st) { return st.delete("buzon"); }).catch(function () {});
      buzon = null; try { localStorage.removeItem(BUZON_KEY); } catch (er) {}
      renderFuentes();
      $("fuentes-msg").textContent = "Buzón borrado. Recuerda quitar los filtros de reenvío en tu correo."; $("fuentes-msg").className = "msg ok";
    }
  });
  function initBuzonWeb() {
    configApp().then(function (j) { buzonCfg.dominio = j.entradaDominio || ""; buzonCfg.sitio = j.sitio || ""; buzonCfg.atajo = j.atajoIos || ""; if (!$("dlg-fuentes").hidden) renderFuentes(); }, function () {});
    setTimeout(function () { sincronizar(true); }, 1200);
  }

  $("btn-bandeja-cuentas").addEventListener("click", function () { abrirBandeja(false); });

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
      sessionStorage.removeItem(SIN_CTA_KEY); localStorage.removeItem(SIN_CTA_KEY);
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
      '<label class="acepto-chk" data-rep hidden><input type="checkbox" data-k="rep"><span>Mi mamá, papá o representante legal leyó la política de datos y me dio permiso de crear la cuenta.</span></label>' +
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
        e >= EDAD_MIN ? "Tienes " + plural(e, "año") + ". Como eres menor de 18, pídele a tu mamá, papá o a quien te cuida que lea la política de datos y te dé permiso." :
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


  // ===================== Mudanza a una dirección nueva =====================
  // Cuando la app pase a un dominio propio (variable DIRECCION_NUEVA en el servidor viejo), cada navegador tiene sus
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

  // ===================== v8 · Barra lateral (computador) y menú ☰ (celular) =====================
  (function () {
    var lat = $("lateral"), fondo = $("lat-fondo"), btn = $("btn-menu"), movil = window.matchMedia("(max-width: 1023px)");
    function abierta() { return lat.classList.contains("abierta"); }
    function abrir() { lat.classList.add("abierta"); fondo.hidden = false; btn.setAttribute("aria-expanded", "true"); lat.inert = false; setTimeout(function () { $("lat-cerrar").focus(); }, 60); }
    function cerrar(foco) { if (!abierta()) return; lat.classList.remove("abierta"); fondo.hidden = true; btn.setAttribute("aria-expanded", "false"); if (movil.matches) lat.inert = true; if (foco) btn.focus(); }
    function ajustar() { if (movil.matches) { if (!abierta()) lat.inert = true; } else { lat.classList.remove("abierta"); fondo.hidden = true; lat.inert = false; } }
    if (movil.addEventListener) movil.addEventListener("change", ajustar); else movil.addListener(ajustar);
    ajustar();
    btn.addEventListener("click", function () { if (abierta()) cerrar(true); else abrir(); });
    $("lat-cerrar").addEventListener("click", function () { cerrar(true); });
    fondo.addEventListener("click", function () { cerrar(true); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && abierta()) { e.stopPropagation(); cerrar(true); } }, true);
    lat.addEventListener("click", function (e) {
      var t = e.target.closest("[data-clic]");
      if (t) { var dest = $(t.dataset.clic); cerrar(false); if (dest) dest.click(); return; }
      if (e.target.closest("button[data-tab]")) cerrar(false);
    });
    function registrar() { cerrar(false); $("fab-add").click(); }
    $("lat-registrar").addEventListener("click", registrar);
    $("btn-registrar-top").addEventListener("click", registrar);
    $("barra-registrar").addEventListener("click", function () { vibrar(12); registrar(); });
    $("lat-cuenta").addEventListener("click", function () { cerrar(false); $("btn-cuenta").click(); });
    if (WEB) [].forEach.call(document.querySelectorAll(".lat-web"), function (b) { b.hidden = false; });
  })();
  function renderLecturaApp() {
    var n = $("nudge-lectura"); if (!n) return;
    n.hidden = !(WEB && APP_ANDROID.activa && !APP_ANDROID.lectura);
    $("nudge-lectura-si").href = INTENT_AJUSTES;
  }
  function renderLateral() {
    var c = $("lat-cuenta"), visible = !$("btn-cuenta").hidden;
    c.hidden = !visible;
    if (visible) {
      if (typeof cuenta !== "undefined" && cuenta) {
        var u = cuenta.usuario;
        c.innerHTML = '<span class="avatar" aria-hidden="true">' + esc(iniciales(u)) + '</span><span class="acct-name"><b>' + esc(u.nombre || u.correo) + '</b><span class="' + (cuenta.sucio ? "" : "ok") + '">' + (cuenta.sucio ? "Cambios por copiar" : "Guardado en la nube") + "</span></span>";
      } else {
        c.innerHTML = '<span class="avatar" aria-hidden="true"><svg class="ic"><use href="#i-cloud"/></svg></span><span class="acct-name"><b>Guardar en la nube</b><span>Con Google o tu correo</span></span>';
      }
    }
    $("lat-premium-t").textContent = hasPremium() ? "Premium activo" : "Premium";
    renderLecturaApp();
  }

  // ===================== Render general e inicio =====================
  function renderAll() {
    applyTheme(); renderPremiumButton(); renderHeader(); renderMonthNav(); renderIngresos(); renderGastos(); recompute();
    renderMetas(); renderDeudas(); renderNotas(); renderReto(); renderAlertas(); renderTrabajo();
    renderPorPagar(); renderCuentas(); renderBandeja(); renderDudas();
    if (WEB) renderCuentaUI(); else renderLateral();
    pintarNudgeInicio();
    $("feat-correo").hidden = !WEB;
    $("sec-ia").hidden = !IA_ON; $("feat-ia").hidden = !IA_ON;
    if (IA_ON) renderIA();
    renderMeDeben();
    aplicarLetra();
    aplicarTemporada();
    renderHistPlay();
    renderAlcancia();
    ajustarCifras();
  }

  // ===================== Inicio guiado: tu presupuesto en cuatro pasos =====================
  // Quien llega ve un ejemplo. En tres preguntas (cuánto entra, cuánto es fijo y si quiere que los pagos se anoten
  // solos) se arma su presupuesto con la regla 50/30/20, ajustada si lo fijo pesa más de la mitad, y se le muestra
  // cuánto puede gastar hoy en gustos sin descuadrarse.
  var INICIO_KEY = "fintelligente-inicio", inicioRes = null;
  function inicioVisto() { try { return localStorage.getItem(INICIO_KEY) || ""; } catch (e) { return "hecho"; } }
  function marcarInicio(v) { try { localStorage.setItem(INICIO_KEY, v); } catch (e) {} }
  function pintarNudgeInicio() { /* el aviso de ejemplo (example-notice) ya ofrece "Armar mi presupuesto" mientras haya datos de ejemplo */ }
  function quizaInicioGuiado() {
    if (!loaded || !state.ejemplo || inicioVisto()) return;
    if (!$("dlg-bienvenida").hidden || ACCION_INICIAL || /^#(importar|entrar|mudanza|accion|regalo)/.test(location.hash)) return;
    if (document.querySelector(".dlg-backdrop:not([hidden])") || ($("dlg-mudanza") && !$("dlg-mudanza").hidden) || ($("dlg-acepto") && !$("dlg-acepto").hidden)) return;
    abrirInicio();
  }
  function abrirInicio() {
    var ua = navigator.userAgent, android = /android/i.test(ua), ios = /iphone|ipad|ipod/i.test(ua);
    $("inicio-auto-si").textContent = android ? "La app de Android anota cada pago de Nequi, Bancolombia, Daviplata, Bre-B y más, segundos después de hacerlo."
      : ios ? "En iPhone, con un atajo que manda tus pagos con Apple Pay y los mensajes del banco." : "Desde tu celular: te mostramos un código para conectarlo.";
    $("inicio-msg").textContent = "";
    $("inicio-omitir").textContent = state.ejemplo ? "Saltar" : "Cerrar";
    $("inicio-t").textContent = state.ejemplo ? "¿Cuánto te llega al mes?" : "Rehagamos tu mes. ¿Cuánto te llega?";
    inicioPerfil = state.prefs.perfil || "personal";
    inicioMetas = (state.prefs.metasInicio && state.prefs.metasInicio.length ? state.prefs.metasInicio : [state.prefs.enfoque || "orden"]).slice();
    pintarMetasInicio();
    [].forEach.call($("inicio-perfil").querySelectorAll("[data-perfil]"), function (x) { x.setAttribute("aria-checked", x.dataset.perfil === inicioPerfil ? "true" : "false"); });
    // La primera vez saluda; al rehacer el presupuesto va directo a la pregunta
    inicioSaluda = state.ejemplo && !inicioVisto();
    var desde = inicioSaluda ? 0 : 1;
    pasoActual = desde; pasoInicio(desde);
    openDlg("dlg-inicio", desde ? "#inicio-ingreso" : "#inicio-empecemos");
  }
  var pasoActual = 1, inicioSaluda = false;
  function pasoInicio(n) {
    var dir = n >= pasoActual ? "va" : "vuelve"; pasoActual = n;
    [].forEach.call(document.querySelectorAll("#dlg-inicio .inicio-sec"), function (sec) { sec.hidden = +sec.dataset.paso !== n; sec.classList.remove("va", "vuelve"); if (!sec.hidden) { void sec.offsetWidth; sec.classList.add(dir); } });
    $("inicio-paso").textContent = n === 0 ? "Bienvenida" : n < 5 ? "Paso " + n + " de 4" : "Tu presupuesto";
    [].forEach.call(document.querySelectorAll("#dlg-inicio .inicio-puntos i"), function (i, k) { i.className = k < n ? "on" : k === n ? "on ahora" : ""; });
    $("inicio-atras").hidden = !(n >= 2 && n <= 4) && !(n === 1 && inicioSaluda);
    $("dlg-inicio").dataset.paso = n;
    var foco = { 0: "#inicio-empecemos", 1: "#inicio-ingreso", 2: '#inicio-metas [aria-checked="true"]', 3: "#inicio-vivienda", 4: 'input[name="inicio-auto"]:checked', 5: "#inicio-empezar" }[n];
    setTimeout(function () { var el = document.querySelector("#dlg-inicio " + foco); if (el) el.focus(); }, 60);
  }
  ["inicio-ingreso", "inicio-vivienda", "inicio-servicios", "inicio-deudas"].forEach(function (id) {
    $(id).addEventListener("input", function () { var m = parseMonto(this.value); this.value = m ? "$ " + fmtMiles(m) : ""; });
    $(id).addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); (id === "inicio-ingreso" ? $("inicio-sig1") : $("inicio-sig2")).click(); } });
  });
  function pintarRapidos() { var v = parseMonto($("inicio-ingreso").value); [].forEach.call($("inicio-rapidos").querySelectorAll("[data-v]"), function (b) { b.setAttribute("aria-pressed", String(+b.dataset.v === v)); }); }
  $("inicio-rapidos").addEventListener("click", function (e) { var b = e.target.closest("[data-v]"); if (!b) return; $("inicio-ingreso").value = "$ " + fmtMiles(+b.dataset.v); $("inicio-msg").textContent = ""; pintarRapidos(); });
  $("inicio-ingreso").addEventListener("input", pintarRapidos);
  // − y +: de a $ 100.000, como en el prototipo
  [].forEach.call(document.querySelectorAll("#dlg-inicio [data-paso-monto]"), function (b) {
    b.addEventListener("click", function () { var v = Math.max(0, parseMonto($("inicio-ingreso").value) + +b.dataset.pasoMonto); $("inicio-ingreso").value = v ? "$ " + fmtMiles(v) : ""; $("inicio-msg").textContent = ""; pintarRapidos(); sonar("nota", 2); });
  });
  $("inicio-empecemos").addEventListener("click", function () { pasoInicio(1); });
  $("inicio-atras").addEventListener("click", function () { pasoInicio(Math.max(inicioSaluda ? 0 : 1, pasoActual - 1)); });
  $("inicio-sig1").addEventListener("click", function () {
    var i = parseMonto($("inicio-ingreso").value);
    if (i < 50000) { $("inicio-msg").textContent = "Escribe cuánto te llega en un mes, por ejemplo $ 2.000.000."; $("inicio-msg").className = "msg center err"; $("inicio-ingreso").focus(); return; }
    pasoInicio(2);
  });
  // Lo que la persona quiere lograr (puede elegir varias) acomoda el nombre de su ahorro
  var inicioMetas = ["orden"], METAS_ORDEN = ["viaje", "fondo", "compra", "deudas", "orden"];
  var META_NOMBRE = { viaje: "Ahorro para mi viaje", fondo: "Fondo de emergencia", compra: "Ahorro para mi compra" };
  function pintarMetasInicio() { [].forEach.call($("inicio-metas").querySelectorAll("[data-meta]"), function (x) { x.setAttribute("aria-checked", inicioMetas.indexOf(x.dataset.meta) > -1 ? "true" : "false"); }); }
  $("inicio-metas").addEventListener("click", function (e) {
    var b = e.target.closest("[data-meta]"); if (!b) return;
    var m = b.dataset.meta, k = inicioMetas.indexOf(m);
    if (k > -1) inicioMetas.splice(k, 1); else inicioMetas.push(m);
    if (!inicioMetas.length) inicioMetas = ["orden"];
    inicioMetas.sort(function (a, c) { return METAS_ORDEN.indexOf(a) - METAS_ORDEN.indexOf(c); });
    pintarMetasInicio(); sonar("gota");
  });
  $("inicio-sig-meta").addEventListener("click", function () { pasoInicio(3); });
  $("inicio-sig2").addEventListener("click", function () { pasoInicio(4); });
  onCloseHooks["dlg-inicio"] = function () {
    if (!inicioVisto()) { marcarInicio("omitido"); metrica("inicio_omitido", "una"); }
    pintarNudgeInicio();
    setTimeout(function () { try { checkLogros(); } catch (e) {} }, 400);
  };
  $("nudge-inicio-si").addEventListener("click", abrirInicio);

  // La regla: 50 % necesidades, 30 % gustos y 20 % ahorro. Si lo fijo pesa más, se protege un mínimo para mercado y
  // transporte (15 % de lo que entra) y lo que sobra se reparte 60/40 entre gustos y ahorro.
  // Plantillas: cómo se reparten lo necesario variable y los gustos según la situación de la persona.
  var PLANTILLAS = {
    personal: { nec: [["Mercado", "alimentacion", .55], ["Transporte", "transporte", .3], ["Salud", "salud", .15]], gus: [["Salidas y restaurantes", "ocio", .5], ["Compras y cuidado personal", "compras", .3], ["Suscripciones y apps", "suscripciones", .2]], aho: "Ahorro" },
    estudiante: { nec: [["Almuerzos y mercado", "alimentacion", .5], ["Transporte", "transporte", .35], ["Fotocopias y materiales", "educacion", .15]], gus: [["Salidas con amigos", "ocio", .6], ["Suscripciones y apps", "suscripciones", .2], ["Ropa y cuidado personal", "compras", .2]], aho: "Ahorro" },
    pareja: { nec: [["Mercado de la casa", "alimentacion", .6], ["Transporte", "transporte", .25], ["Salud", "salud", .15]], gus: [["Planes en pareja", "ocio", .5], ["Compras y cuidado personal", "compras", .25], ["Suscripciones y apps", "suscripciones", .25]], aho: "Ahorro para metas juntos" },
    familia: { nec: [["Mercado", "alimentacion", .45], ["Colegio, útiles y pensión", "educacion", .25], ["Transporte", "transporte", .2], ["Salud y medicamentos", "salud", .1]], gus: [["Planes en familia", "ocio", .5], ["Ropa y zapatos", "compras", .3], ["Suscripciones y apps", "suscripciones", .2]], aho: "Ahorro e imprevistos" },
    independiente: { nec: [["Mercado", "alimentacion", .45], ["Seguridad social (salud y pensión)", "salud", .3], ["Transporte", "transporte", .25]], gus: [["Salidas y restaurantes", "ocio", .5], ["Compras y cuidado personal", "compras", .3], ["Suscripciones y apps", "suscripciones", .2]], aho: "Colchón para meses flojos" },
    negocio: { nec: [["Mercado", "alimentacion", .45], ["Seguridad social (salud y pensión)", "salud", .3], ["Transporte", "transporte", .25]], gus: [["Salidas y restaurantes", "ocio", .5], ["Compras y cuidado personal", "compras", .3], ["Suscripciones y apps", "suscripciones", .2]], aho: "Colchón y ahorro" }
  };
  var inicioPerfil = "personal";
  $("inicio-perfil").addEventListener("click", function (e) {
    var b = e.target.closest("[data-perfil]"); if (!b) return;
    inicioPerfil = b.dataset.perfil;
    [].forEach.call(this.querySelectorAll("[data-perfil]"), function (x) { x.setAttribute("aria-checked", x === b ? "true" : "false"); });
  });
  function repartoInicio(I, viv, serv, deu, perfil, metas) {
    var P = PLANTILLAS[perfil] || PLANTILLAS.personal;
    metas = Array.isArray(metas) ? metas : [metas || "orden"];
    var ahorrar = metas.filter(function (m) { return META_NOMBRE[m]; }), meta = metas[0] || "orden";
    var nombreAho = ahorrar.length === 1 ? META_NOMBRE[ahorrar[0]] : ahorrar.length > 1 ? "Ahorro para mis metas" : P.aho;
    var R = function (v) { return Math.max(0, Math.round(v / 1000) * 1000); };
    var F = viv + serv + deu, N = I * 0.5, varNec = Math.max(N - F, I * 0.15), nec = F + varNec, G, A, caso = "normal";
    if (nec <= N + 1) { G = I * 0.3; A = I * 0.2; }
    else if (nec < I) { caso = "ajustado"; G = (I - nec) * 0.6; A = (I - nec) * 0.4; }
    else { caso = "justo"; G = 0; A = 0; }
    var lista = P.nec.map(function (x) { return { concepto: x[0], cat: x[1], plan: R(varNec * x[2]), g: "nec" }; })
      .concat(P.gus.map(function (x) { return { concepto: x[0], cat: x[1], plan: R(G * x[2]), g: "gus" }; }))
      .concat([{ concepto: nombreAho, cat: "ahorro", plan: R(A), g: "aho" }]);
    // Redondear cada fila a $ 1.000 puede descuadrar el total por unos pesos: la diferencia va a la fila más grande,
    // para que el plan sume exactamente lo que entra (antes salía $ 2.501.000 con $ 2.500.000 de ingreso).
    if (caso !== "justo") {
      var totPlan = R(viv) + R(serv) + R(deu) + lista.reduce(function (a, x) { return a + x.plan; }, 0), dif = Math.round(I) - totPlan;
      var porPlan = function (a, b) { return b.plan - a.plan; };
      var mayor = lista.filter(function (x) { return x.g === "nec"; }).sort(porPlan)[0] || lista.filter(function (x) { return x.g !== "aho"; }).sort(porPlan)[0];
      if (dif && mayor && Math.abs(dif) <= 10000 && mayor.plan + dif > 0) mayor.plan += dif;
    }
    var suma = function (g) { return lista.filter(function (x) { return x.g === g; }).reduce(function (a, x) { return a + x.plan; }, 0); };
    return { I: I, viv: R(viv), serv: R(serv), deu: R(deu), lista: lista, meta: meta, metas: metas.slice(), perfil: P === PLANTILLAS[perfil] ? perfil : "personal", nec: R(F) + suma("nec"), gus: suma("gus"), aho: suma("aho"), caso: caso };
  }
  function aplicarInicio(r) {
    var k = keyOf(new Date()), n = 0, id = function (p) { return p + (++n); };
    var gastos = [];
    function g(concepto, cat, plan) { if (plan > 0) gastos.push({ id: id("g"), concepto: concepto, cat: cat, dia: 0, plan: plan, real: 0 }); }
    g("Arriendo o vivienda", "vivienda", r.viv); g("Servicios, internet y celular", "servicios", r.serv); g("Cuotas de deudas", "deudas", r.deu);
    r.lista.forEach(function (x) { g(x.concepto, x.cat, x.plan); });
    var ingresos = [{ id: "i1", concepto: r.perfil === "independiente" || r.perfil === "negocio" ? "Lo que me entra (promedio)" : "Lo que me entra al mes", plan: r.I, real: 0 }];
    if (!state.ejemplo) {
      // Ya hay un presupuesto: solo se cambia la lista de este mes; lo real se conserva por categoría y lo demás no se toca.
      var m = cur(), reales = {}, ingReal = m.ingresos.reduce(function (a, x) { return a + x.real; }, 0);
      m.gastos.forEach(function (x) { reales[x.cat] = (reales[x.cat] || 0) + x.real; });
      gastos.forEach(function (x) { if (reales[x.cat]) { x.real = reales[x.cat]; reales[x.cat] = 0; } });
      Object.keys(reales).forEach(function (c) { if (reales[c] > 0) gastos.push({ id: id("g"), concepto: (catById(c) || { name: "Otros" }).name, cat: c, dia: 0, plan: 0, real: reales[c] }); });
      ingresos[0].real = ingReal;
      m.ingresos = ingresos; m.gastos = gastos; state.prefs.perfil = r.perfil; state.prefs.enfoque = r.meta; state.prefs.metasInicio = r.metas;
      changed(); renderAll(); return;
    }
    var mes = {}; mes[k] = { ingresos: ingresos, gastos: gastos, notas: "" };
    state.prefs.perfil = r.perfil; state.prefs.enfoque = r.meta; state.prefs.metasInicio = r.metas;
    state = sanitize({ titulo: "Mi presupuesto", ejemplo: false, prefs: state.prefs, categorias: state.categorias, meses: mes, mes: k,
      cuentas: [{ id: "a1", nombre: "Cuenta principal", tipo: "banco", saldo: 0, cupo: 0, ini: false }, { id: "a2", nombre: "Efectivo", tipo: "efectivo", saldo: 0, cupo: 0, ini: false }],
      pendientes: state.pendientes, importados: state.importados, reglas: state.reglas, reglasCuenta: state.reglasCuenta, avisos: state.avisos, asesor: state.asesor, movs: state.movs, negocio: state.negocio, invita: state.invita, meDeben: state.meDeben, dudas: state.dudas, noEntendi: state.noEntendi });
    changed(); renderAll();
  }
  $("inicio-armar").addEventListener("click", function () {
    var r = repartoInicio(parseMonto($("inicio-ingreso").value), parseMonto($("inicio-vivienda").value), parseMonto($("inicio-servicios").value), parseMonto($("inicio-deudas").value), inicioPerfil, inicioMetas);
    var conectar = (document.querySelector('input[name="inicio-auto"]:checked') || {}).value === "si";
    aplicarInicio(r); marcarInicio("hecho"); metrica("inicio", "una");
    var mIni = r.metas.filter(function (m) { return META_NOMBRE[m]; })[0];
    if (mIni && !state.metas.some(function (g) { return nrm(g.nombre) === nrm(META_NOMBRE[mIni]); }) && (hasPremium() || !state.metas.length)) {
      state.metas.push({ id: rid("m"), nombre: META_NOMBRE[mIni], objetivo: mIni === "fondo" ? Math.round(r.I * 3 / 100000) * 100000 : 0, ahorrado: 0, fecha: addMonths(nowKey(), mIni === "fondo" ? 12 : 6) });
      changed(); renderMetas();
    }
    inicioRes = { conectar: conectar };
    // La misma cifra que Inicio y Pregúntale: lo del día a día (todo lo que no es fijo ni ahorro), repartido en los días que quedan
    var hoy = new Date(), dias = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate(), quedan = dias - hoy.getDate() + 1, hIni = hoyPuedes(totalsOf(cur()));
    var diario = hIni && hIni.plan ? hIni.puede : r.gus / quedan, mesDia = hIni && hIni.plan ? Math.max(0, hIni.resto) : r.gus;
    $("inicio-hoy").textContent = money(0); $("inicio-hoy").dataset.v = "0";
    setTimeout(function () { animateNumber($("inicio-hoy"), Math.max(0, redondeoMil(diario)), money); }, 450);
    $("inicio-hoy-n").textContent = mesDia ? "Son " + money(mesDia) + " para el día a día este mes (mercado, transporte, salidas y lo demás), repartidos en los " + plural(quedan, "día") + " que quedan." : "Este mes, lo fijo usa casi todo lo que entra.";
    var subAho = (r.metas.filter(function (m) { return META_NOMBRE[m]; }).length > 1 ? "Para tus metas: lo apartas apenas te pagan" : "") ||
      { viaje: "Para tu viaje: lo apartas apenas te pagan", fondo: "Tu fondo de emergencia crece cada mes", compra: "Para esa compra, sin pedir prestado", deudas: "Y con esto abonas de más a tus deudas" }[r.meta] ||
      (r.perfil === "independiente" || r.perfil === "negocio" ? "Tu colchón para los meses flojos" : "Lo apartas apenas te pagan");
    var filas = [["Necesidades", r.nec, "Vivienda, servicios, deudas, mercado, transporte y salud", "#7c5cff"], ["Gustos", r.gus, "Salidas, compras y suscripciones", "#ff5c9a"], ["Ahorro", r.aho, subAho, "#ffc53d"]];
    $("inicio-reparto").innerHTML = filas.map(function (f) {
      var pc = r.I ? Math.round(f[1] / r.I * 100) : 0;
      return '<div class="inicio-fila" style="--c:' + f[3] + '"><div><b><i class="pt" aria-hidden="true"></i>' + f[0] + "</b><small>" + f[2] + '</small></div><span class="inicio-barra" aria-hidden="true"><i data-w="' + Math.min(100, pc) + '" style="width:0"></i></span><span class="inicio-v">' + money(f[1]) + "<small>" + pc + " %</small></span></div>";
    }).join("");
    // El anillo se dibuja tramo por tramo y las barras crecen (si la persona no pidió menos movimiento)
    var C = 2 * Math.PI * 48, off = 0, svg = '<circle cx="60" cy="60" r="48" fill="none" stroke="var(--line)" stroke-width="14" opacity=".5"/>';
    filas.forEach(function (f, k) {
      var len = r.I ? Math.max(0, f[1] / r.I) * C : 0, dib = Math.max(0, len - 3);
      svg += '<circle class="ia-seg" cx="60" cy="60" r="48" fill="none" stroke="' + f[3] + '" stroke-width="14" stroke-linecap="butt" transform="rotate(-90 60 60)" stroke-dashoffset="' + (-off).toFixed(2) +
        '" stroke-dasharray="' + (reduceMotion ? dib.toFixed(2) : "0") + " " + C.toFixed(2) + '" data-dib="' + dib.toFixed(2) + '" style="transition-delay:' + (0.15 + k * 0.35) + 's"/>';
      off += len;
    });
    $("inicio-anillo").innerHTML = svg;
    $("inicio-total").textContent = money(r.I);
    setTimeout(function () {
      [].forEach.call($("inicio-anillo").querySelectorAll(".ia-seg"), function (c) { c.setAttribute("stroke-dasharray", c.dataset.dib + " " + C.toFixed(2)); });
      [].forEach.call($("inicio-reparto").querySelectorAll("[data-w]"), function (i) { i.style.width = i.dataset.w + "%"; });
    }, 60);
    setTimeout(function () { celebrar(); }, reduceMotion ? 0 : 1300);
    $("inicio-nota").textContent = r.caso === "ajustado" ? "Lo fijo pesa más de la mitad de lo que entra, así que ajustamos gustos y ahorro para que el mes cuadre. El asesor te irá mostrando cómo liberar espacio."
      : r.caso === "justo" ? "Lo fijo se lleva casi todo lo que entra. Revisa las cifras; si son así, el asesor te ayuda a encontrar espacio poco a poco."
      : "Es la regla 50/30/20: la mitad para lo necesario, un 30 % para disfrutar y un 20 % para tu ahorro. Puedes cambiar cualquier cifra cuando quieras.";
    $("inicio-empezar").textContent = conectar ? "Conectar mi banco" : "Ver mi Finti";
    pasoInicio(5);
  });
  $("btn-plantilla-menu").addEventListener("click", function () { $("menu-mas").hidden = true; abrirInicio(); });
  $("inicio-empezar").addEventListener("click", function () {
    closeDlg("dlg-inicio");
    if (inicioRes && inicioRes.conectar) setTimeout(abrirFuentes, 250);
    else setTimeout(function () { toast("¿Quieres conocer la app? Hay guías cortas de menos de un minuto.", { action: "Ver guías", onAction: abrirGuias }); }, 900);
  });
  new MutationObserver(function () { if ($("dlg-bienvenida").hidden) setTimeout(quizaInicioGuiado, 500); }).observe($("dlg-bienvenida"), { attributes: true, attributeFilter: ["hidden"] });

  // ===================== Importar el extracto del banco (Excel o CSV) =====================
  // La persona descarga sus movimientos en la app o la página de su banco y los sube aquí. Todo se lee en este
  // dispositivo: el archivo no sale de él. Se buscan las columnas de fecha, descripción y valor (o débito y
  // crédito), se saltan los que ya estaban registrados y los traslados entre cuentas propias, y cada movimiento
  // va a su mes y su categoría. Así el asesor tiene historial desde el primer día.
  var extractoLeido = null;
  function nrm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function leerCSV(txt) {
    txt = String(txt || "").replace(/^﻿/, "");
    var muestra = txt.split(/\r?\n/).slice(0, 15).join("\n"), cand = [";", ",", "\t", "|"], sep = ";", mejor = -1;
    cand.forEach(function (c) { var n = muestra.split(c).length; if (n > mejor) { mejor = n; sep = c; } });
    var filas = [], fila = [], campo = "", comillas = false;
    for (var i = 0; i < txt.length; i++) {
      var ch = txt[i];
      if (comillas) { if (ch === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else comillas = false; } else campo += ch; continue; }
      if (ch === '"') comillas = true;
      else if (ch === sep) { fila.push(campo); campo = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && txt[i + 1] === "\n") i++; fila.push(campo); filas.push(fila); fila = []; campo = ""; }
      else campo += ch;
    }
    if (campo || fila.length) { fila.push(campo); filas.push(fila); }
    return filas;
  }
  function leerXLSX(buf) {
    return loadJSZip().then(function (JSZip) { return JSZip.loadAsync(buf); }).then(function (zip) {
      var hoja = Object.keys(zip.files).filter(function (n) { return /^xl\/worksheets\/sheet\d*\.xml$/.test(n); }).sort()[0];
      if (!hoja) throw new Error("sin-hoja");
      var ss = zip.file("xl/sharedStrings.xml");
      return Promise.all([zip.file(hoja).async("string"), ss ? ss.async("string") : ""]);
    }).then(function (r) {
      var dp = new DOMParser(), comp = [];
      if (r[1]) [].forEach.call(dp.parseFromString(r[1], "application/xml").getElementsByTagName("si"), function (si) {
        comp.push([].map.call(si.getElementsByTagName("t"), function (t) { return t.textContent; }).join(""));
      });
      var filas = [];
      [].forEach.call(dp.parseFromString(r[0], "application/xml").getElementsByTagName("row"), function (row) {
        var f = [];
        [].forEach.call(row.getElementsByTagName("c"), function (c) {
          var ref = c.getAttribute("r") || "", col = 0, m = /^([A-Z]+)/.exec(ref);
          if (m) for (var k = 0; k < m[1].length; k++) col = col * 26 + (m[1].charCodeAt(k) - 64);
          var t = c.getAttribute("t"), v = c.getElementsByTagName("v")[0], is = c.getElementsByTagName("is")[0];
          var val = t === "s" ? comp[+(v && v.textContent)] : t === "inlineStr" ? (is ? is.textContent : "") : v ? v.textContent : "";
          if (t !== "s" && t !== "inlineStr" && t !== "str" && val !== "" && !isNaN(+val)) val = { n: +val };
          f[(col || f.length + 1) - 1] = val;
        });
        filas.push(f);
      });
      return filas;
    });
  }
  // "1.234.567,89" · "-45.900" · "1,234,567.89" · "(45.900)" · "$ 45.900" · número de Excel
  function montoExtracto(v) {
    if (v && typeof v === "object") return Math.round(v.n);
    var s = String(v == null ? "" : v).trim();
    if (!s) return NaN;
    var neg = /^\(.*\)$/.test(s) || /^\$?\s*-|-\s*$/.test(s);
    s = s.replace(/[^\d.,]/g, "");
    if (!/\d/.test(s)) return NaN;
    var p = s.lastIndexOf("."), c = s.lastIndexOf(",");
    if (p > -1 && c > -1) { var dec = p > c ? "." : ","; s = s.split(dec === "." ? "," : ".").join(""); if (dec === ",") s = s.replace(",", "."); }
    else if (p > -1 || c > -1) {
      var sep = p > -1 ? "." : ",", partes = s.split(sep);
      if (partes.length > 2 || partes[1].length === 3) s = partes.join("");   // separador de miles: 45.900 · 1.234.567
      else s = partes[0] + "." + partes[1];                                   // decimales: 45900,50
    }
    var n = parseFloat(s);
    return isFinite(n) ? Math.round(neg ? -n : n) : NaN;
  }
  var MESES_TXT = { en: 1, ene: 1, ja: 1, feb: 2, fe: 2, mar: 3, abr: 4, ap: 4, may: 5, jun: 6, jul: 7, ag: 8, ago: 8, au: 8, sep: 9, sept: 9, set: 9, oct: 10, nov: 11, dic: 12, de: 12 };
  function fechaExtracto(v) {
    var d = null, m;
    if (v && typeof v === "object") { if (v.n > 20000 && v.n < 80000) { var t = new Date(Date.UTC(1899, 11, 30) + Math.floor(v.n) * 86400000); return t.toISOString().slice(0, 10); } v = String(v.n); }
    var s = String(v == null ? "" : v).trim().toLowerCase();
    if ((m = /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/.exec(s))) d = [+m[1], +m[2], +m[3]];
    else if ((m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(s))) d = [+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]];
    else if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) d = [+m[1], +m[2], +m[3]];
    else if ((m = /^(\d{1,2})[\s\-\/]*([a-záéíóú]{2,4})\.?[\s\-\/]*(?:de\s+)?(\d{2,4})/.exec(nrm(s)))) { var mm = MESES_TXT[m[2]] || MESES_TXT[m[2].slice(0, 3)]; if (mm) d = [+m[3] < 100 ? 2000 + +m[3] : +m[3], mm, +m[1]]; }
    if (!d || d[1] < 1 || d[1] > 12 || d[2] < 1 || d[2] > 31 || d[0] < 2000 || d[0] > 2100) return "";
    return d[0] + "-" + ("0" + d[1]).slice(-2) + "-" + ("0" + d[2]).slice(-2);
  }
  // De la tabla del banco a una lista de movimientos { fecha, desc, monto (negativo = sale) }.
  function tablaExtracto(filas) {
    var cab = -1, col = {};
    for (var i = 0; i < Math.min(filas.length, 40) && cab < 0; i++) {
      var f = (filas[i] || []).map(function (x) { return nrm(x && typeof x === "object" ? "" : x); }), c = {};
      f.forEach(function (h, j) {
        if (c.fecha == null && /^fecha|^date$|fecha (de )?(transaccion|movimiento|operacion)/.test(h)) c.fecha = j;
        else if (c.tipo == null && /^tipo|naturaleza|^d\/c$|^dc$/.test(h)) c.tipo = j;
        else if (c.desc == null && /descripcion|detalle|concepto|^movimiento|transaccion|comercio|establecimiento|^nombre/.test(h)) c.desc = j;
        else if (c.debito == null && /debito|cargo|retiro|salida|egreso|^debe$/.test(h) && !/saldo/.test(h)) c.debito = j;
        else if (c.credito == null && /credito|abono|deposito|entrada|ingreso|^haber$/.test(h) && !/saldo/.test(h)) c.credito = j;
        else if (c.valor == null && /^valor|^monto|importe|^cantidad/.test(h) && !/saldo/.test(h)) c.valor = j;
      });
      if (c.fecha != null && (c.valor != null || c.debito != null || c.credito != null)) { cab = i; col = c; }
    }
    if (cab < 0) return { error: "No encontramos las columnas de fecha y valor. Revisa que sea el archivo de movimientos del banco (no el PDF del extracto)." };
    var movs = [], soloPositivos = true, conValor = col.valor != null && col.debito == null && col.credito == null;
    for (var r = cab + 1; r < filas.length; r++) {
      var f2 = filas[r] || [], fecha = fechaExtracto(f2[col.fecha]);
      if (!fecha) continue;
      var desc = String(col.desc != null ? (f2[col.desc] && typeof f2[col.desc] === "object" ? f2[col.desc].n : f2[col.desc] || "") : "").trim();
      if (/^(saldo|total|subtotal)\b/i.test(nrm(desc))) continue;
      var monto = 0;
      if (conValor) {
        monto = montoExtracto(f2[col.valor]);
        var tp = col.tipo != null ? nrm(f2[col.tipo]) : "";
        if (isFinite(monto) && monto > 0 && /^(?:d|db|dr|-)$|^(?:debito|cargo|retiro|egreso|compra|pago)/.test(tp)) monto = -monto;
        if (isFinite(monto) && monto < 0 && /^(?:c|cr|\+)$|^(?:credito|abono|ingreso|consignacion|deposito)/.test(tp)) monto = -monto;
      } else {
        var deb = col.debito != null ? montoExtracto(f2[col.debito]) : NaN, cre = col.credito != null ? montoExtracto(f2[col.credito]) : NaN;
        monto = (isFinite(cre) && Math.abs(cre) > 0) ? Math.abs(cre) : (isFinite(deb) && Math.abs(deb) > 0) ? -Math.abs(deb) : 0;
      }
      if (!isFinite(monto) || !monto) continue;
      if (monto < 0) soloPositivos = false;
      movs.push({ fecha: fecha, desc: desc.slice(0, 120), monto: monto });
    }
    // Una sola columna de valor sin signos: se decide por la descripción (abonos y consignaciones son ingresos).
    if (conValor && soloPositivos) movs.forEach(function (m) {
      if (!/abono|consignacion|recibid|nomina|deposito|reintegro|devolucion|intereses? (?:ganados|abonados)|transferencia de|te enviaron|te llego/.test(nrm(m.desc))) m.monto = -m.monto;
    });
    if (!movs.length) return { error: "El archivo no tiene movimientos con fecha y valor que podamos leer." };
    return { movs: movs.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; }), sinSigno: conValor && soloPositivos };
  }
  // "COMPRA EN EXITO LAURELES 1234" → "Exito Laureles"
  function limpiarDesc(d) {
    var s = String(d || "").replace(/\s{2,}/g, " ").trim();
    s = s.replace(/^(?:compra(?:s)?(?: intl| nacional| internacional)?(?: en)?|pago(?: pse| de| a| en)?|pse|transf(?:erencia)?(?: a| de)?|retiro(?: en)? (?:cajero|atm)?|abono(?: de| por)?|cargo(?: de| por)?|debito(?: automatico)?(?: de)?)\s+/i, "");
    s = s.replace(/\s+(?:ref\.?|referencia|nro\.?|no\.)?\s*[\d*#\-]{4,}$/i, "").replace(/\s+\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/, "");
    return LECTOR.bonito(s.slice(0, 60)) || "Movimiento del banco";
  }
  function esTrasladoPropio(desc) {
    var n = nrm(desc);
    if (/traslado|entre (?:tus|sus|mis) (?:cuentas|productos)|a (?:tu|su|mi) (?:bolsillo|colchon|meta|nequi|daviplata)|ahorro programado|pago (?:a |de )?(?:tu |su )?(?:tarjeta|tc\b)|abono a (?:tu |su )?tarjeta|pago recibido|gracias por su pago/.test(n)) return true;
    return (state.cuentas || []).some(function (c) { var nc = nrm(c.nombre); return nc.length > 3 && c.tipo !== "efectivo" && new RegExp("(?:a|hacia|de|desde) (?:tu |su |mi )?" + nc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(n); });
  }
  function analizarExtracto(lista) {
    var yaMovs = {}, out = { nuevos: [], repetidos: 0, traslados: 0, retiros: 0, gastos: 0, ingresos: 0, nG: 0, nI: 0, porCat: {}, meses: {} };
    (state.movs || []).forEach(function (m) { yaMovs[m.f + "|" + m.m] = (yaMovs[m.f + "|" + m.m] || 0) + 1; });
    lista.forEach(function (x) {
      var abs = Math.abs(x.monto), com = limpiarDesc(x.desc), huella = LECTOR.huella({ monto: abs, fecha: x.fecha, comercio: com });
      if (state.importados.indexOf(huella) > -1 || yaMovs[x.fecha + "|" + abs] > 0) { if (yaMovs[x.fecha + "|" + abs] > 0) yaMovs[x.fecha + "|" + abs]--; out.repetidos++; return; }
      if (esTrasladoPropio(x.desc)) { out.traslados++; return; }
      if (x.monto < 0 && /^retiro\b|\bretiro (?:en )?(?:cajero|atm|corresponsal)|\bavance\b/.test(nrm(x.desc))) { out.retiros++; return; }
      var tipo = x.monto < 0 ? "gasto" : "ingreso", cat = "";
      if (tipo === "gasto") { var r = LECTOR.sugerirCategoria({ comercio: com, tipo: "gasto" }, state.reglas); cat = r.cat || "otros"; out.gastos += abs; out.nG++; out.porCat[cat] = (out.porCat[cat] || 0) + abs; }
      else { out.ingresos += abs; out.nI++; }
      out.meses[x.fecha.slice(0, 7)] = 1;
      out.nuevos.push({ fecha: x.fecha, comercio: com, monto: abs, tipo: tipo, cat: cat, huella: huella });
    });
    return out;
  }
  function mesesPermitidos() {
    if (hasPremium()) return null;
    var hoy = new Date(), ks = [];
    for (var i = 0; i < MESES_GRATIS; i++) ks.push(keyOf(new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)));
    return ks;
  }
  function asegurarMes(k) {
    if (state.meses[k]) return state.meses[k];
    var base = cur();
    state.meses[k] = { ingresos: base.ingresos.map(function (r) { return { id: r.id, concepto: r.concepto, plan: r.plan, real: 0 }; }),
      gastos: base.gastos.map(function (r) { return { id: r.id, concepto: r.concepto, cat: r.cat, dia: r.dia, plan: r.plan, real: 0 }; }), notas: "" };
    return state.meses[k];
  }
  function importarExtracto(an, cuentaId) {
    var antes = JSON.stringify(state), permitidos = mesesPermitidos(), enTablas = 0, soloHistorial = 0;
    if (state.ejemplo) {   // el ejemplo se va: queda la lista de conceptos con montos en cero
      Object.keys(state.meses).forEach(function (k) { if (k !== state.mes) delete state.meses[k]; });
      cur().ingresos.forEach(function (r) { r.plan = 0; r.real = 0; }); cur().gastos.forEach(function (r) { r.plan = 0; r.real = 0; });
      state.cuentas.forEach(function (c) { c.saldo = 0; c.cupo = 0; }); state.metas = []; state.deudas = []; state.porPagar = []; state.movs = []; state.ejemplo = false;
    }
    an.nuevos.forEach(function (x) {
      var k = x.fecha.slice(0, 7);
      anotarMov({ t: x.tipo === "ingreso" ? "i" : "g", f: x.fecha, hora: "", cat: x.cat, c: x.comercio, m: x.monto, com: x.comercio });
      state.importados.push(x.huella);
      if (permitidos && permitidos.indexOf(k) < 0) { soloHistorial++; return; }
      var m = asegurarMes(k);
      if (x.tipo === "ingreso") {
        var ri = m.ingresos[0]; if (!ri) { ri = { id: rid("i"), concepto: "Ingresos", plan: 0, real: 0 }; m.ingresos.push(ri); }
        ri.real += x.monto;
      } else {
        var rg = m.gastos.find(function (g) { return g.cat === x.cat; });
        if (!rg) { var c = catById(x.cat); rg = { id: rid("g"), concepto: c ? c.name : "Otros", cat: x.cat, dia: 0, plan: 0, real: 0 }; m.gastos.push(rg); }
        rg.real += x.monto;
      }
      enTablas++;
    });
    if (permitidos) { var ks = Object.keys(state.meses).sort(); while (ks.length > MESES_GRATIS) { var k0 = ks.shift(); if (k0 !== state.mes) delete state.meses[k0]; } }
    state.importados = state.importados.slice(-3000);
    changed(); renderAll();
    metrica("extracto", "una");
    return { antes: antes, enTablas: enTablas, soloHistorial: soloHistorial };
  }
  function pintarExtracto() {
    var an = extractoLeido, box = $("extracto-res");
    if (!an) { box.hidden = true; return; }
    var ms = Object.keys(an.meses).sort(), permitidos = mesesPermitidos(), fuera = permitidos ? ms.filter(function (k) { return permitidos.indexOf(k) < 0; }) : [];
    var top = Object.keys(an.porCat).sort(function (a, b) { return an.porCat[b] - an.porCat[a]; }).slice(0, 5);
    var desde = an.nuevos.length ? an.nuevos[0].fecha : "", hasta = an.nuevos.length ? an.nuevos[an.nuevos.length - 1].fecha : "";
    var f = function (d, conAno) { var p = d.split("-"); return +p[2] + " de " + MESES[+p[1] - 1] + (conAno ? " de " + p[0] : ""); };
    var rango = desde.slice(0, 4) === hasta.slice(0, 4) ? "Del " + f(desde) + " al " + f(hasta, 1) : "Del " + f(desde, 1) + " al " + f(hasta, 1);
    box.innerHTML = !an.nuevos.length ? '<p class="msg">No hay movimientos nuevos para importar' + (an.repetidos ? ": los " + an.repetidos + " del archivo ya estaban registrados." : ".") + "</p>" :
      '<div class="extracto-res-top"><b>' + plural(an.nuevos.length, "movimiento") + " nuevo" + (an.nuevos.length === 1 ? "" : "s") + "</b><span>" + rango + "</span></div>" +
      '<div class="extracto-cifras"><span><small>Gastos</small><b>' + money(an.gastos) + "</b><small>" + plural(an.nG, "movimiento") + '</small></span><span><small>Ingresos</small><b>' + money(an.ingresos) + "</b><small>" + plural(an.nI, "movimiento") + "</small></span></div>" +
      (top.length ? '<ul class="extracto-cats">' + top.map(function (k) { var c = catById(k); return "<li><span>" + esc(c ? c.name : "Otros") + "</span><b>" + money(an.porCat[k]) + "</b></li>"; }).join("") + "</ul>" : "") +
      '<ul class="extracto-notas">' + (an.repetidos ? "<li>" + plural(an.repetidos, "movimiento") + " ya estaba" + (an.repetidos === 1 ? "" : "n") + " registrado" + (an.repetidos === 1 ? "" : "s") + ": no se repite" + (an.repetidos === 1 ? "" : "n") + ".</li>" : "") +
      (an.traslados ? "<li>" + plural(an.traslados, "traslado") + " entre tus cuentas o pagos de tarjeta: no cuentan como gasto.</li>" : "") +
      (an.retiros ? "<li>" + plural(an.retiros, "retiro") + " de cajero: ese efectivo cuenta como gasto cuando lo uses.</li>" : "") +
      (an.sinSigno ? "<li>El archivo no dice qué es gasto y qué es ingreso; lo deducimos por la descripción. Puedes corregirlo después en la tabla del mes.</li>" : "") +
      (fuera.length ? "<li>En la versión gratis se guardan tus últimos " + MESES_GRATIS + " meses en las tablas. Los movimientos de " + fuera.map(function (k) { return monthLabel(k).toLowerCase(); }).join(", ") + " también le sirven al asesor para conocerte.</li>" : "") + "</ul>" +
      '<button class="btn primary full" type="button" id="extracto-ok">Importar ' + plural(an.nuevos.length, "movimiento") + "</button>";
    box.hidden = false;
  }
  function abrirExtracto() {
    $("menu-mas").hidden = true; extractoLeido = null; $("extracto-msg").textContent = ""; $("extracto-res").hidden = true; $("f-extracto").value = "";
    openDlg("dlg-extracto", "#extracto-elegir");
  }
  $("btn-extracto-menu").addEventListener("click", abrirExtracto);
  document.addEventListener("click", function (e) { if (e.target.closest("[data-open-extracto]")) { closeDlg("dlg-fuentes"); setTimeout(abrirExtracto, 50); } });
  $("extracto-elegir").addEventListener("click", function () { $("f-extracto").click(); });
  $("f-extracto").addEventListener("change", function () {
    var file = this.files && this.files[0], msg = $("extracto-msg");
    if (!file) return;
    extractoLeido = null; $("extracto-res").hidden = true;
    if (file.size > 8 * 1024 * 1024) { msg.textContent = "El archivo es muy grande. Descarga un rango más corto, por ejemplo de 3 meses."; msg.className = "msg err"; return; }
    var nombre = file.name.toLowerCase();
    if (/\.pdf$/.test(nombre)) { msg.textContent = "El PDF del extracto no se puede leer. En la app o la página de tu banco, busca la opción de descargar los movimientos en Excel o CSV."; msg.className = "msg err"; return; }
    if (/\.xls$/.test(nombre)) { msg.textContent = "Ese es un Excel antiguo (.xls). Ábrelo y guárdalo como .xlsx o .csv, y súbelo de nuevo."; msg.className = "msg err"; return; }
    msg.textContent = "Leyendo " + file.name + "…"; msg.className = "msg";
    var leer = /\.xlsx$/.test(nombre) ? file.arrayBuffer().then(leerXLSX) : file.text().then(leerCSV);
    leer.then(function (filas) {
      var t = tablaExtracto(filas);
      if (t.error) { msg.textContent = t.error; msg.className = "msg err"; return; }
      extractoLeido = analizarExtracto(t.movs); extractoLeido.sinSigno = t.sinSigno;
      msg.textContent = ""; pintarExtracto();
    }).catch(function () { msg.textContent = "No pudimos abrir ese archivo. Revisa que sea un Excel (.xlsx) o un CSV de movimientos."; msg.className = "msg err"; });
  });
  $("extracto-res").addEventListener("click", function (e) {
    if (!e.target.closest("#extracto-ok") || !extractoLeido || !extractoLeido.nuevos.length) return;
    var r = importarExtracto(extractoLeido), n = extractoLeido.nuevos.length;
    closeDlg("dlg-extracto"); extractoLeido = null;
    toast("Listo: importamos " + plural(n, "movimiento") + ". El asesor ya puede conocer tus hábitos.", { action: "Deshacer", onAction: function () { state = sanitize(JSON.parse(r.antes)); changed(); renderAll(); } });
  });

  // ===================== Pregúntale a Finti =====================
  // Responde preguntas escritas con los números de la persona, sin IA externa y sin que nada salga del dispositivo.
  // Entiende la intención (cuánto gasté, me alcanza, qué debo pagar…), saca de la frase la categoría, el comercio,
  // el periodo y el monto, y recuerda el contexto ("¿y en transporte?", "¿y el mes pasado?"). Si le falta un dato,
  // lo pregunta; si no entiende, propone las preguntas más parecidas. Cada cálculo muestra cómo se hizo.
  var PR = { ctx: null, espera: null, ocupado: false };
  var PR_MES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  var PR_SIN = {
    alimentacion: "comida|comidas|mercado|mercados|alimentos|alimentacion|supermercado|almuerzos?|desayunos?|onces|fruver|carniceria|panaderia|tienda de barrio",
    transporte: "transporte|bus|buses|busetas?|taxis?|uber|didi|indriver|gasolina|pasajes?|transmilenio|metro|moto|carro|parqueaderos?|peajes?|sitp",
    vivienda: "arriendo|arriendos|vivienda|alquiler|hipoteca|administracion|casa",
    servicios: "servicios|luz|agua|gas|internet|celular|plan de datos|telefono|energia",
    salud: "salud|medico|medicos|medicamentos|drogas?|farmacia|drogueria|eps|odontologo|examenes",
    educacion: "educacion|colegio|universidad|cursos?|matriculas?|estudio|libros|utiles",
    deudas: "deudas?|creditos?|cuotas?|prestamos?|tarjeta de credito",
    ocio: "ocio|salidas?|rumba|cine|restaurantes?|domicilios?|fiestas?|cervezas?|tragos?|paseos?|planes",
    compras: "compras|ropa|zapatos|tenis|accesorios|regalos?",
    suscripciones: "suscripciones|suscripcion|netflix|spotify|streaming|disney|youtube premium|apps",
    ahorro: "ahorro|ahorros|inversion|inversiones",
    otros: "otros|varios"
  };
  var PR_PARE = " a al algo como con cual cuales cuando cuanto cuantos de del donde el en es esta este esto hay he la las le lo los me mi mis mucho muy no o para pero por que se si sin su sus te tengo tu tus un una uno y ya ";

  function prNorm(s) { return nrm(s).replace(/[¿?¡!.,;:()"]/g, " ").replace(/\s+/g, " ").trim(); }
  function prPalabras(s) { return prNorm(s).split(" ").filter(function (w) { return w.length > 2 && PR_PARE.indexOf(" " + w + " ") < 0; }); }
  function prPct(x) { return Math.round(x * 100) + " %"; }
  function prCatNombre(id) { var c = catById(id); return c ? c.name.toLowerCase() : "otros"; }

  // ---------- Lo que se saca de la frase ----------
  function prMonto(t) {
    var m;
    if ((m = /(\d+(?:[.,]\d+)?)\s*(?:millones|millon|palos?|mill)\b/.exec(t))) return Math.round(parseFloat(m[1].replace(",", ".")) * 1e6);
    if (/\bmedio (?:millon|palo)\b/.test(t)) return 500000;
    if (/\b(?:un|1) (?:millon|palo)\b/.test(t)) return 1000000;
    if ((m = /(\d+(?:[.,]\d+)?)\s*(?:(?:mil|lucas?|k)\b|barras?\b(?! de))/.exec(t))) return Math.round(parseFloat(m[1].replace(",", ".")) * 1000);
    if ((m = /(?:^|\s|\$)\s*(\d{1,3}(?:[.,]\d{3})+|\d{4,9})(?!\d)/.exec(t))) {
      var n = parseInt(m[1].replace(/[.,]/g, ""), 10);
      if (n >= 1990 && n <= 2100 && /\b(?:de|en|del|ano)\s+\d{4}\b/.test(t)) return 0;   // un año, no un monto
      return n;
    }
    return 0;
  }
  function prCat(t) {
    var lista = cats().concat(state.categorias.filter(function (c) { return !cats().some(function (x) { return x.id === c.id; }); }));
    for (var i = 0; i < lista.length; i++) { var nom = nrm(lista[i].name); if (nom.length > 3 && new RegExp("\\b" + nom.split(" ")[0] + "\\b").test(t)) return lista[i].id; }
    for (var id in PR_SIN) if (new RegExp("\\b(?:" + PR_SIN[id] + ")\\b").test(t)) return id;
    // El vocabulario ampliado solo cuando la pregunta habla de plata ("¿cuánto gasté en el perro?"), para no adivinar en frases sueltas.
    var voc = /\b(gast|pag|compr|llev|cuant|cost|plata|platica|dinero)/.test(t) ? chBuscar(prNorm(t), chAprendidas().concat(chLista())) : null;
    if (voc && !/^(datos|recibo|entrada|juego|salida|detalle|clase|servicios|otros|cuota|tarjeta|credito)$/.test(voc[0])) return voc[1];
    // Conceptos de las tablas del mes ("arriendo", "gimnasio"…)
    var g = cur().gastos.filter(function (r) { var c = nrm(r.concepto).split(" ")[0]; return c.length > 4 && new RegExp("\\b" + c + "\\b").test(t); })[0];
    return g ? g.cat : "";
  }
  function prComercio(t) {
    var vistos = {};
    for (var i = state.movs.length - 1; i >= 0; i--) {
      var nom = state.movs[i].c || ""; if (!nom || vistos[nom]) continue; vistos[nom] = 1;
      var w = nrm(nom).split(" ").filter(function (x) { return x.length > 3 && PR_PARE.indexOf(" " + x + " ") < 0; })[0];
      if (w && !PR_SIN.alimentacion.split("|").concat(PR_SIN.transporte.split("|")).some(function (s) { return s === w; }) && new RegExp("\\b" + w + "\\b").test(t)) return { nombre: nom, clave: w };
    }
    return null;
  }
  function prMesK(y, m) { return y + "-" + ("0" + m).slice(-2); }
  function prNombreMes(k) {
    var hoyK = nowKey();
    if (k === hoyK) return "este mes";
    if (k === addMonths(hoyK, -1)) return "el mes pasado";
    var p = parseKey(k);
    return "en " + MESES[p.m - 1] + (p.y !== new Date().getFullYear() ? " de " + p.y : "");
  }
  function prPeriodo(t) {
    var hoy = d0(), m;
    var r = function (a, b, nom) { return { tipo: "rango", desde: hoyStr(a), hasta: hoyStr(b), nombre: nom }; };
    if (/\bhoy\b/.test(t)) return r(hoy, hoy, "hoy");
    if (/\bayer\b/.test(t)) { var ay = new Date(hoy); ay.setDate(ay.getDate() - 1); return r(ay, ay, "ayer"); }
    if (/semana pasada/.test(t)) { var l0 = new Date(hoy); l0.setDate(l0.getDate() - ((l0.getDay() + 6) % 7) - 7); var d6 = new Date(l0); d6.setDate(d6.getDate() + 6); return r(l0, d6, "la semana pasada"); }
    if (/\b(?:esta|la) semana\b/.test(t)) { var l = new Date(hoy); l.setDate(l.getDate() - ((l.getDay() + 6) % 7)); return r(l, hoy, "esta semana"); }
    if ((m = /ultimos? (\d{1,3}) dias/.exec(t))) { var a = new Date(hoy); a.setDate(a.getDate() - (+m[1] - 1)); return r(a, hoy, "en los últimos " + m[1] + " días"); }
    if (/mes pasado|mes anterior|el otro mes/.test(t)) { var kp = addMonths(nowKey(), -1); return { tipo: "mes", k: kp, nombre: "el mes pasado" }; }
    for (var nom in PR_MES) if (new RegExp("\\b" + nom + "\\b").test(t)) {
      var y = (m = /\b(20\d\d)\b/.exec(t)) ? +m[1] : (PR_MES[nom] > hoy.getMonth() + 1 ? hoy.getFullYear() - 1 : hoy.getFullYear());
      var k = prMesK(y, PR_MES[nom]); return { tipo: "mes", k: k, nombre: prNombreMes(k) };
    }
    if (/este ano|lo que va del ano|en el ano|\bano\b/.test(t)) return { tipo: "ano", y: hoy.getFullYear(), nombre: "en lo que va de " + hoy.getFullYear() };
    if (/este mes|el mes\b|en el mes/.test(t)) { var kh = state.meses[nowKey()] ? nowKey() : state.mes; return { tipo: "mes", k: kh, nombre: prNombreMes(kh) }; }
    return null;
  }
  function prDe(nombre) { return nombre.indexOf("el ") === 0 ? "del " + nombre.slice(3) : nombre.indexOf("en ") === 0 ? "de " + nombre.slice(3) : "de " + nombre; }
  function prChipPasado(txt) { return state.meses[addMonths(nowKey(), -1)] ? [txt || "¿Y el mes pasado?"] : []; }
  function prPeriodoBase() { return { tipo: "mes", k: state.mes, nombre: prNombreMes(state.mes) }; }

  // ---------- Cálculos ----------
  function prRango(per) {
    if (per.tipo === "rango") return [per.desde, per.hasta];
    if (per.tipo === "ano") return [per.y + "-01-01", per.y + "-12-31"];
    return [per.k + "-01", per.k + "-31"];
  }
  function prMovs(per, tipo, cat, com) {
    var r = prRango(per);
    return state.movs.filter(function (x) {
      return x.t === tipo && x.f >= r[0] && x.f <= r[1] && (!cat || x.cat === cat) && (!com || nrm(x.c + " " + x.com).indexOf(com.clave) > -1);
    });
  }
  function prSuma(lista) { return lista.reduce(function (a, x) { return a + x.m; }, 0); }
  // Gasto (o ingreso) de un periodo: con las tablas del mes cuando se puede, con el historial de movimientos si no.
  function prTotal(per, tipo, cat, com) {
    if (!com && per.tipo === "mes") {
      var mm = state.meses[per.k]; if (!mm) return null;
      var t = totalsOf(mm);
      if (tipo === "i") return { real: t.ingReal, plan: t.ingPlan, tabla: true };
      if (cat) { var c = t.byCat[cat] || { plan: 0, real: 0 }; return { real: c.real, plan: c.plan, tabla: true }; }
      return { real: t.gasReal, plan: t.gasPlan, tabla: true };
    }
    if (!com && per.tipo === "ano") {
      var ks = monthKeys().filter(function (k) { return k.slice(0, 4) === String(per.y); });
      if (ks.length) { var s = { real: 0, plan: 0, tabla: true, meses: ks.length }; ks.forEach(function (k) { var x = totalsOf(state.meses[k]), c2 = cat ? (x.byCat[cat] || { real: 0, plan: 0 }) : null; s.real += tipo === "i" ? x.ingReal : c2 ? c2.real : x.gasReal; s.plan += tipo === "i" ? x.ingPlan : c2 ? c2.plan : x.gasPlan; }); return s; }
    }
    var l = prMovs(per, tipo, cat, com);
    return { real: prSuma(l), n: l.length, lista: l, tabla: false };
  }
  function prCierre() { var r = aleatorio(semillaEstado()); var c = cierreMes(r); c.disf = paraDisfrutar(c); return c; }
  function prPagosPendientes(dias) {
    var hoy = d0(), lim = new Date(hoy), out = [];
    lim.setDate(lim.getDate() + dias);
    state.porPagar.forEach(function (b) { var e = estadoPago(b, hoy); if (!e.pagado && e.due <= lim) out.push({ nombre: b.nombre || "Sin nombre", monto: b.monto, due: e.due, dias: e.dias }); });
    return out.sort(function (a, b) { return a.due - b.due; });
  }
  function prAhorroMensual() {
    var ks = monthKeys().filter(function (k) { return k < nowKey(); }).slice(-3), vals = ks.map(function (k) { var t = totalsOf(state.meses[k]); return t.byGroup.aho + Math.max(0, t.saldo); }).filter(function (v) { return v > 0; });
    if (vals.length) return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    var t0 = totalsOf(cur()); return Math.max(0, (t0.byCat.ahorro ? t0.byCat.ahorro.plan : 0), t0.ingPlan - t0.gasPlan);
  }
  function prCuando(meses) { var n = Math.max(1, Math.ceil(meses)), d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return "en " + prMeses(n) + " (hacia " + MESES[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? " de " + d.getFullYear() : "") + ")"; }
  function prMeses(n) { return n === 1 ? "1 mes" : n + " meses"; }
  function prCalc(items) { return '<details class="pr-calc"><summary>Así lo calculé</summary><ul>' + items.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></details>"; }
  function prAviso() { return state.ejemplo ? '<p class="pr-nota">Por ahora uso los números del ejemplo. Cuando armes tu presupuesto, te respondo con los tuyos.</p>' : ""; }

  // ===================== Precios de referencia del DANE (SIPSA) =====================
  // Una tabla pública que GitHub Actions baja del DANE cada día de mercado (boletín diario, herramientas/sipsa-diario.mjs)
  // y la app pide con GET a /api/precios. La petición no lleva nada de la persona; la comparación con sus compras se hace
  // aquí. Se guarda en el dispositivo (sirve sin internet) y se renueva cada 2 horas si es del día (3 días si es semanal).
  var SIPSA_KEY = "fintelligente-sipsa", SIPSA = { d: null, at: 0, pidiendo: null };
  try { var sp0 = JSON.parse(localStorage.getItem(SIPSA_KEY) || "null"); if (sp0 && sp0.d && Array.isArray(sp0.d.productos)) { SIPSA.d = sp0.d; SIPSA.at = sp0.at || 0; } } catch (e) {}
  function sipsaCargar(forzar) {
    if (SIPSA.pidiendo) return SIPSA.pidiendo;
    if (SIPSA.d && !forzar && Date.now() - SIPSA.at < (sipsaDiario() ? 2 * 36e5 : 3 * 864e5)) return Promise.resolve(SIPSA.d);
    if (!WEB || (typeof navigator !== "undefined" && navigator.onLine === false)) return Promise.resolve(SIPSA.d);
    SIPSA.pidiendo = api("/api/precios").then(function (j) {
      if (j._status === 200 && Array.isArray(j.productos)) { delete j._status; SIPSA.d = j; SIPSA.at = Date.now(); try { localStorage.setItem(SIPSA_KEY, JSON.stringify({ at: SIPSA.at, d: j })); } catch (e) {} }
      return SIPSA.d;
    }).catch(function () { return SIPSA.d; }).then(function (d) { SIPSA.pidiendo = null; return d; });
    return SIPSA.pidiendo;
  }
  // Las variedades del DANE que corresponden a una palabra: "papa" → Papa capira, Papa criolla, Papa R-12...
  function sipsaBuscar(palabra) {
    if (!SIPSA.d) return [];
    var w = canSingular(prNorm(palabra).split(" ")[0] || ""); if (w.length < 3) return [];
    return SIPSA.d.productos.filter(function (p) { var a = canSingular(prNorm(p.n).split(" ")[0] || ""); return a === w; })
      .sort(function (a, b) { return Object.keys(b.c || {}).length - Object.keys(a.c || {}).length || a.n.length - b.n.length; });
  }
  // Un producto del DANE nombrado en la pregunta ("¿cómo está el tomate?") aunque la persona no lo haya comprado
  function sipsaProducto(t) {
    if (!SIPSA.d && !GENTE.d) return null;
    var pal = t.split(" ").filter(function (x) { return x.length >= 4 && HI_PARO.indexOf(" " + x + " ") < 0; });
    for (var i = 0; i < pal.length; i++) { var l = sipsaBuscar(pal[i]); if (l.length || genteFilas(canClave(pal[i]), state.prefs.ciudad)) return { k: canClave(pal[i]), n: pal[i], dane: true }; }
    return null;
  }
  function sipsaDiario() { return !!(SIPSA.d && SIPSA.d.tipo === "diario" && SIPSA.d.dia); }
  // "hoy", "ayer", "el 25 de noviembre" o, con datos semanales, "la semana del 9 de noviembre"
  function sipsaFecha() {
    if (sipsaDiario()) return diaTexto(SIPSA.d.dia);
    var w = SIPSA.d && SIPSA.d.semana; return w ? "la semana del " + (+w.slice(8)) + " de " + MESES[+w.slice(5, 7) - 1] : "";
  }
  // "de hoy", "de ayer", "del 25 de noviembre", "de la semana del 9 de noviembre"
  function sipsaDe() { var f = sipsaFecha(); return f ? (f.slice(0, 3) === "el " ? "del " + f.slice(3) : "de " + f) : ""; }
  function sipsaAntes() { return sipsaDiario() ? "al día de mercado anterior" : "a la semana anterior"; }
  // Variación del producto: la de la ciudad elegida si el DANE la trae (boletín diario), si no la nacional
  function sipsaVar(p, ciudad) { var e = ciudad && p.c && p.c[ciudad]; return e && e.length > 3 ? e[3] : p.v; }
  function sipsaTendencia(v) { return v == null || Math.abs(v) < 3 ? { c: "", t: "estable" } : v > 0 ? { c: "sube", t: "subió " + pctf(v / 100) } : { c: "baja", t: "bajó " + pctf(-v / 100) }; }
  // Párrafo para Pregúntale: referencia en la ciudad de la persona (si la eligió) o en el país, y si sube o baja.
  function sipsaParrafo(palabra) {
    var l = sipsaBuscar(palabra), gente = genteFrase(canClave(palabra), state.prefs.ciudad || "");
    if (!l.length) return gente ? "<p>" + gente + "</p>" : "";
    var p = l[0], ciudad = state.prefs.ciudad || "", enC = ciudad && p.c && p.c[ciudad], tend = sipsaTendencia(enC ? sipsaVar(p, ciudad) : p.v);
    var h = "<p>Referencia del DANE " + sipsaDe() + " (precio mayorista por kilo): <b>" + esc(p.n.charAt(0).toLowerCase() + p.n.slice(1)) + "</b> a " + canPrecio(enC ? enC[0] : p.g) + (enC ? " en " + esc(ciudad) : " en el país") +
      ", " + (tend.c ? tend.t : "estable") + " frente " + sipsaAntes() + ".";
    // Con el boletín diario hay una central por ciudad: lo útil es saber dónde está más barata en el país
    var mejor = enC && !sipsaDiario() ? [enC[1], enC[2]] : p.b;
    if (mejor && mejor[0]) h += " Donde más barata " + (sipsaDiario() ? "está" : "estuvo") + (enC && !sipsaDiario() ? " en tu ciudad" : " en el país") + ": " + esc(mejor[0]) + " (" + canPrecio(mejor[1]) + ").";
    return h + " En la tienda suele costar más; sirve para saber si está cara o barata." + (gente ? " " + gente : "") + "</p>";
  }


  // ===================== Precios de la gente =====================
  // Lo que pagó la gente en cada cadena de su ciudad (GET /api/precios-gente: público, no lleva nada tuyo). Con permiso
  // (state.prefs.aportar === "si"), la app manda de forma anónima el precio por kilo, litro o unidad de lo que la
  // persona compró en una cadena: el nombre corto del producto (canClave, máximo dos palabras), la cadena (de una lista
  // cerrada), la ciudad y el día. Ni nombre, ni cuenta, ni el total. Sin cookies (credentials: "omit"). Un producto
  // solo se muestra cuando lo reportan al menos 3 personas distintas (lo decide el servidor).
  var GENTE_KEY = "fintelligente-gente", GENTE_ENV = "fintelligente-gente-enviados", GENTE = { d: null, at: 0, pidiendo: null, re: null };
  try { var g0 = JSON.parse(localStorage.getItem(GENTE_KEY) || "null"); if (g0 && g0.d && g0.d.lista) { GENTE.d = g0.d; GENTE.at = g0.at || 0; } } catch (e) {}
  function genteCargar(forzar) {
    if (GENTE.pidiendo) return GENTE.pidiendo;
    if (GENTE.d && !forzar && Date.now() - GENTE.at < 3 * 36e5) return Promise.resolve(GENTE.d);
    if (!WEB || (typeof navigator !== "undefined" && navigator.onLine === false)) return Promise.resolve(GENTE.d);
    GENTE.pidiendo = api("/api/precios-gente", { credentials: "omit" }).then(function (j) {
      if (j._status === 200 && j.lista) { delete j._status; GENTE.d = j; GENTE.at = Date.now(); GENTE.re = null; try { localStorage.setItem(GENTE_KEY, JSON.stringify({ at: GENTE.at, d: j })); } catch (e) {} }
      return GENTE.d;
    }).catch(function () { return GENTE.d; }).then(function (d) { GENTE.pidiendo = null; return d; });
    return GENTE.pidiendo;
  }
  function genteCiudades() { return (GENTE.d && GENTE.d.lista && GENTE.d.lista.ciudades) || []; }
  // Nombre de producto que acepta el servidor (como lo arma canClave: una o dos palabras, sin números sueltos)
  function genteProducto(k) { return typeof k === "string" && k.length <= 40 && /^[a-zñ][a-z0-9ñ]{1,19}( [a-z0-9ñ]{2,20})?$/.test(k) ? k : null; }
  // Claves donde buscar un producto: la exacta y, si no hay datos, la primera palabra ("papa pastusa" → "papa")
  function genteClaves(k) { k = genteProducto(k); if (!k) return []; var w = k.split(" ")[0]; return w !== k && genteProducto(w) ? [k, w] : [k]; }
  function genteCadena(lugar) {
    if (!GENTE.d || !lugar) return null;
    if (!GENTE.re) GENTE.re = GENTE.d.lista.cadenas.map(function (c) { try { return { id: c.id, re: new RegExp(c.patron) }; } catch (e) { return null; } }).filter(Boolean);
    var t = prNorm(lugar); for (var i = 0; i < GENTE.re.length; i++) if (GENTE.re[i].re.test(t)) return GENTE.re[i].id;
    return null;
  }
  // Precios de un producto en las cadenas: los de las tiendas en línea (GitHub los baja cada día, GENTE.d.linea) y lo
  // que pagó la gente en la ciudad. { u, filas: [{ c: cadena, v: precio, n, en: "linea" | "gente", ej }] }, de menor a mayor.
  function genteFilas(k, ciudad) {
    if (!GENTE.d) return null;
    var ks = genteClaves(k), c = ciudad && GENTE.d.ciudades && GENTE.d.ciudades[ciudad], L = GENTE.d.linea && GENTE.d.linea.productos, us = ["kg", "l", "u"];
    for (var j = 0; j < ks.length; j++) { k = ks[j];
    for (var i = 0; i < us.length; i++) {
      var g = c && c[k + "|" + us[i]], l = L && L[k + "|" + us[i]]; if (!g && !l) continue;
      var filas = (g || []).map(function (f) { return { c: f[0], v: f[1], n: f[2], en: "gente" }; })
        .concat((l || []).map(function (f) { return { c: f[0], v: f[1], n: f[2], en: "linea", ej: f[3] }; }));
      return { u: us[i], filas: filas.sort(function (a, b) { return a.v - b.v; }) };
    } }
    return null;
  }
  // Búsqueda en vivo en las tiendas en línea, para cualquier producto: a Finti solo va el nombre del producto, sin
  // cookies; el servidor consulta las cadenas que lo permiten y guarda la respuesta 12 horas. Aquí se recuerda mientras
  // la app está abierta.
  var BUSCADOS = {};
  function buscarLinea(q) {
    var k = prNorm(q).slice(0, 40); if (k.length < 2 || !WEB) return Promise.resolve(null);
    if (BUSCADOS[k]) return BUSCADOS[k];
    BUSCADOS[k] = api("/api/precios-buscar?q=" + encodeURIComponent(k), { credentials: "omit" }).then(function (j) {
      if (j._status !== 200) { delete BUSCADOS[k]; return null; } return j;
    }, function () { delete BUSCADOS[k]; return null; });
    return BUSCADOS[k];
  }
  // "hoy", "ayer" o "el 25 de noviembre"
  function diaTexto(f) {
    var ay = new Date(); ay.setDate(ay.getDate() - 1);
    return f === hoyStr() ? "hoy" : f === hoyStr(ay) ? "ayer" : "el " + (+f.slice(8)) + " de " + MESES[+f.slice(5, 7) - 1];
  }
  // De dónde sale cada precio: "5 personas en Bogotá" o "tienda en línea, hoy"
  function genteOrigen(f, ciudad) { return f.en === "gente" ? plural(f.n, "persona") + " en " + esc(ciudad) : "tienda en línea, " + diaTexto((GENTE.d.linea && GENTE.d.linea.dia) || hoyStr()); }
  function genteUnidad(u) { return u === "kg" ? " el kilo" : u === "l" ? " el litro" : " la unidad"; }
  function genteEnviados() { try { return JSON.parse(localStorage.getItem(GENTE_ENV) || "{}") || {}; } catch (e) { return {}; } }
  // Compras de los últimos 14 días en cadenas, con producto de la lista y que no se hayan mandado
  function genteAportes() {
    var ciudad = state.prefs.ciudad || "", enviados = genteEnviados(), out = [];
    if (genteCiudades().indexOf(ciudad) < 0) return [];
    canRegistros(14).forEach(function (r) {
      var p = genteProducto(r.k), c = genteCadena(r.lugar), id = r.id + "|" + r.k; if (!p || !c || enviados[id]) return;
      var u = r.unidad, v = r.pu;
      if (u === "lb") { u = "kg"; v = r.pu * 2; } else if (u === "g") { u = "kg"; v = r.pu * 1000; }
      if (["kg", "l", "u"].indexOf(u) < 0 || !(v > 0)) return;
      out.push({ id: id, a: { p: p, c: c, u: u, v: Math.round(v), d: r.f } });
    });
    return out.slice(0, 40);
  }
  var genteEnviando = false;
  function genteEnviar(ya) {
    if (state.prefs.aportar !== "si" || !WEB || genteEnviando) return Promise.resolve(0);
    var ult = +(localStorage.getItem(GENTE_ENV + "-at") || 0);
    if (!ya && Date.now() - ult < 6 * 36e5) return Promise.resolve(0);
    genteEnviando = true;
    return genteCargar().then(function () {
      var l = genteAportes(); if (!l.length) return 0;
      return api("/api/precios-gente", { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ciudad: state.prefs.ciudad, aportes: l.map(function (x) { return x.a; }) }) }).then(function (j) {
        if (j._status !== 200 && j._status !== 400) return 0;   // 400: nada válido; no se vuelve a intentar con lo mismo
        var env = genteEnviados(), hoy = hoyStr(), viejo = hoyStr(new Date(Date.now() - 30 * 864e5));
        Object.keys(env).forEach(function (k) { if (env[k] < viejo) delete env[k]; });
        l.forEach(function (x) { env[x.id] = hoy; });
        try { localStorage.setItem(GENTE_ENV, JSON.stringify(env)); localStorage.setItem(GENTE_ENV + "-at", String(Date.now())); } catch (e) {}
        return l.length;
      });
    }).catch(function () { return 0; }).then(function (n) { genteEnviando = false; return n; });
  }
  setTimeout(function () { genteEnviar(); }, 8000);   // al abrir la app, si la persona aceptó (como mucho cada 6 horas)
  // "En las cadenas, lo más barato es D1: $ 3.900 el kilo (5 personas en Bogotá); en Olímpica, $ 4.200."
  function genteFrase(k, ciudad) {
    var g = genteFilas(k, ciudad); if (!g) return "";
    var f = g.filas[0], s = g.filas[1];
    return "En las cadenas, lo más barato es " + esc(f.c) + ": " + canPrecio(f.v) + genteUnidad(g.u) + " (" + genteOrigen(f, ciudad) + ")" + (s ? "; en " + esc(s.c) + ", " + canPrecio(s.v) : "") + ".";
  }
  // ===================== ¿Dónde compro? =====================
  function abrirDonde(texto) {
    $("menu-mas").hidden = true;
    var frec = canResumen(90).sort(function (a, b) { return b.veces - a.veces; }).slice(0, 6);
    $("dc-chips").innerHTML = frec.map(function (o) { return '<button type="button" class="chip-btn" data-p="' + esc(canNombre(o.n)) + '">' + esc(canNombre(o.n)) + "</button>"; }).join("");
    if (texto) $("dc-lista").value = texto;
    openDlg("dlg-donde", "#dc-lista");
    $("dc-res").innerHTML = SIPSA.d ? "" : '<p class="dc-vacio">Trayendo los precios del DANE…</p><div class="vivo-cargando" aria-hidden="true"><i></i><i></i><i></i></div>';
    Promise.all([sipsaCargar(), genteCargar()]).then(function () { pintarCiudades(); pintarDonde(); pintarAportar(); });
    pintarCiudades(); if (SIPSA.d) pintarDonde(); pintarAportar();
  }
  function pintarCiudades() {
    var sel = $("dc-ciudad"), cs = {}; if (!SIPSA.d && !GENTE.d) return;
    if (SIPSA.d) SIPSA.d.productos.forEach(function (p) { Object.keys(p.c || {}).forEach(function (c) { cs[c] = (cs[c] || 0) + 1; }); });
    genteCiudades().forEach(function (c) { cs[c] = 99; });   // las ciudades donde la gente puede compartir precios
    var l = Object.keys(cs).filter(function (c) { return cs[c] >= 5; }).sort(function (a, b) { return a.localeCompare(b, "es"); });
    sel.innerHTML = '<option value="">Todo el país</option>' + l.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + "</option>"; }).join("");
    sel.value = state.prefs.ciudad && l.indexOf(state.prefs.ciudad) > -1 ? state.prefs.ciudad : "";
  }
  function pintarDonde() {
    var pedidos = $("dc-lista").value.split(/,|\by\b|\n/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 12);
    pintarNota();
    if (!pedidos.length) { $("dc-res").innerHTML = pintarHoy(); return; }
    var ciudad = $("dc-ciudad").value, propios = canResumen(400);
    $("dc-res").innerHTML = pedidos.map(function (q) {
      var k = canClave(q), o = propios.filter(function (x) { return x.k === k || x.k.split(" ")[0] === k.split(" ")[0]; })[0];
      var vars = sipsaBuscar(q), p = vars[0], h = '<article class="dc-item"><h3>' + esc(canNombre(q));
      if (p) { var t = sipsaTendencia(sipsaVar(p, ciudad)); h += '<span class="dc-tend ' + t.c + '">' + (t.c ? (t.c === "sube" ? "Subiendo: " : "Bajando: ") + t.t.replace(/^(subió|bajó) /, "") : "Estable") + "</span>"; }
      h += "</h3>";
      if (o) {
        h += '<span class="dc-k">Lo que has pagado tú</span><p>La última vez, ' + canPrecio(o.ult.pu) + canPorUnidad(o.ult) + (o.ult.lugar ? " en " + esc(o.ult.lugar) : "") + ".";
        if (o.lugares.length > 1 && o.lugares[0].pu < o.lugares[o.lugares.length - 1].pu * 0.97) h += " Donde te sale más barato: <b>" + esc(o.lugares[0].lugar) + "</b> (" + canPrecio(o.lugares[0].pu) + canPorUnidad(o.ult) + ").";
        h += "</p>";
      }
      if (p) {
        var enC = ciudad && p.c && p.c[ciudad];
        var fue = sipsaDiario() ? "es" : "fue";
        h += '<span class="dc-k">Referencia del DANE ' + sipsaDe() + ", por kilo</span><p>" + esc(p.n) + ": " + (enC ? "<b>" + canPrecio(enC[0]) + "</b> en " + esc(ciudad) + (sipsaDiario() ? "; en el país, la central más barata " + fue + " " + esc(p.b[0]) + " (" + canPrecio(p.b[1]) + ")." : "; la central más barata fue " + esc(enC[1]) + " (" + canPrecio(enC[2]) + ").")
          : "<b>" + canPrecio(p.g) + "</b> en el país; la central más barata " + fue + " " + esc(p.b[0]) + " (" + canPrecio(p.b[1]) + ").") + "</p>";
        if (vars.length > 1) h += "<p>Otras variedades: " + vars.slice(1, 4).map(function (x) { var e = ciudad && x.c && x.c[ciudad]; return esc(x.n) + " " + canPrecio(e ? e[0] : x.g); }).join("; ") + ".</p>";
      }
      var gf = genteFilas(k, ciudad);
      if (gf) h += '<span class="dc-k">Precios en las cadenas</span><ul class="dc-gente">' + gf.filas.slice(0, 6).map(function (f, i) {
        return '<li style="--i:' + i + '"><b>' + esc(f.c) + "</b><span>" + canPrecio(f.v) + genteUnidad(gf.u) + "</span><small>" + genteOrigen(f, ciudad) + (f.ej ? ": " + esc(f.ej) : "") + "</small></li>"; }).join("") + "</ul>" +
        (gf.filas.some(function (f) { return f.en === "gente"; }) ? '<p class="dc-vacio">Lo de la gente es de los últimos ' + ((GENTE.d && GENTE.d.dias) || 14) + " días en " + esc(ciudad) + ". Los precios en línea pueden cambiar en cada tienda.</p>" : '<p class="dc-vacio">Los precios en línea pueden cambiar en cada tienda.</p>');
      // Búsqueda en vivo en las tiendas en línea (se llena cuando llega la respuesta)
      h += '<div class="dc-vivo" data-q="' + esc(q) + '"><div class="vivo-cargando" aria-label="Buscando en las tiendas en línea"><i></i><i></i></div></div>';
      if (!o && !p && !gf) h += '<p class="dc-vacio">' + (SIPSA.d ? "El DANE solo mide alimentos frescos, y todavía no hay precios de la gente para este producto. Cuando me cuentes una compra con su precio, aquí verás dónde te sale más barato." : "No pude traer los precios del DANE; revisa tu conexión. Cuando me cuentes una compra con su precio, aquí verás dónde te sale más barato.") + "</p>";
      return h + "</article>";
    }).join("");
    pedidos.forEach(function (q) {
      buscarLinea(q).then(function (j) {
        var el = [].filter.call($("dc-res").querySelectorAll(".dc-vivo"), function (x) { return x.dataset.q === q; })[0]; if (!el) return;
        var cs = j && j.cadenas ? j.cadenas.filter(function (c) { return c.items && c.items.length; }) : [];
        if (!cs.length) { el.innerHTML = j ? '<p class="dc-vacio">No lo encontré en las tiendas en línea que se pueden consultar.</p>' : ""; return; }
        // Si las tiendas sí lo tienen, sobra el aviso de que no hay precios del DANE ni de la gente
        var aviso = el.parentNode && el.parentNode.querySelector(".dc-vivo ~ .dc-vacio"); if (aviso) aviso.remove();
        el.innerHTML = '<span class="dc-k">En las tiendas en línea, ahora</span><ul class="dc-gente">' + cs.map(function (c) {
          return c.items.slice(0, 3).map(function (it) {
            return "<li><b>" + esc(c.c) + "</b><span>" + money(it.p) + "</span><small>" + esc(it.n) + (it.pu ? " · " + canPrecio(it.pu) + genteUnidad(it.u) : "") + "</small></li>";
          }).join("");
        }).join("") + "</ul>";
      });
    });
  }
  function pintarNota() {
    $("dc-nota").hidden = !SIPSA.d;
    if (SIPSA.d) $("dc-nota").textContent = "Los precios de referencia son del DANE (SIPSA), " + sipsaFecha() + ": mayoristas y por kilo. En la tienda suelen ser más altos; sirven para saber si algo está barato o caro. Para traerlos, Finti no envía nada tuyo.";
  }
  // Sin nada escrito: todos los productos del DANE con su precio, si suben o bajan y dónde están más baratos.
  function pintarHoy() {
    if (!SIPSA.d) return "";
    var ciudad = $("dc-ciudad").value, f = sipsaFecha(), gc = ciudad;
    var l = SIPSA.d.productos.filter(function (p) { return !ciudad || (p.c && p.c[ciudad]); }), aviso = "";
    // El DANE no mide todas las ciudades (por ejemplo, Cali): se muestran los del país y, si hay, lo que pagó la gente allí
    if (!l.length) { aviso = "El DANE no mide " + esc(ciudad) + "; estos son los precios del país."; l = SIPSA.d.productos; ciudad = ""; }
    var tit = sipsaDiario() ? "Así amanecieron los precios " + f : "Así estaban los precios " + f;
    return '<article class="dc-item dc-hoy"><h3>' + esc(tit) + "</h3><p>" + (aviso ? aviso + " " : (ciudad ? "En " + esc(ciudad) : "En el país") + ", ") + "por kilo en la central mayorista. Toca un producto para ver más.</p><ul>" +
      l.map(function (p, i) {
        var e = ciudad && p.c[ciudad], t = sipsaTendencia(sipsaVar(p, ciudad)), g = genteFilas(canClave(p.n), gc);
        return '<li style="--i:' + i + '"><button type="button" class="dc-prod" data-p="' + esc(p.n) + '"><b>' + esc(p.n) + "</b><span class=\"dc-precio\">" + canPrecio(e ? e[0] : p.g) + "</span>" +
          '<span class="dc-tend ' + t.c + '">' + (t.c ? (t.c === "sube" ? "Sube " : "Baja ") + t.t.replace(/^(subió|bajó) /, "") : "Estable") + "</span>" +
          "<small>Mejor precio: " + esc(p.b[0]) + " (" + canPrecio(p.b[1]) + ")" + (g ? ". En cadenas, desde " + canPrecio(g.filas[0].v) + genteUnidad(g.u) + " en " + esc(g.filas[0].c) : "") + "</small></button></li>";
      }).join("") + "</ul></article>";
  }
  $("dc-form").addEventListener("submit", function (e) { e.preventDefault(); sipsaCargar().then(pintarDonde); pintarDonde(); });
  $("dc-ciudad").addEventListener("change", function () { state.prefs.ciudad = $("dc-ciudad").value; changed(); pintarDonde(); pintarAportar(); if (state.prefs.aportar === "si") genteEnviar(true); });
  // ¿Compartir mis precios? Pregunta una vez; luego queda un enlace para cambiar de opinión.
  function pintarAportar() {
    var el = $("dc-aportar"), v = state.prefs.aportar; if (!el) return;
    el.hidden = !WEB || !GENTE.d; if (el.hidden) return;
    var sinCiudad = genteCiudades().indexOf(state.prefs.ciudad || "") < 0;
    if (!v) el.innerHTML = '<p class="dc-ap-t">¿Ayudas a otros a comprar más barato?</p><p>Si dices que sí, Finti comparte el precio de lo que compras en cadenas, por ejemplo: papa criolla en D1 de Bogotá a $ 3.900 el kilo. Va sin tu nombre, sin tu cuenta y sin cuánto gastas en total, y un precio solo se muestra cuando lo reportan al menos 3 personas. Puedes cambiarlo cuando quieras.</p>' +
      '<div class="dc-ap-b"><button type="button" class="btn primary" data-aportar="si">Sí, compartir</button><button type="button" class="btn" data-aportar="no">Ahora no</button></div>';
    else el.innerHTML = "<p>" + (v === "si" ? "Compartes tus precios de forma anónima." + (sinCiudad ? " Elige tu ciudad para que cuenten." : "") + ' <button type="button" class="dc-ap-l" data-aportar="no">Dejar de compartir</button>'
      : 'No compartes tus precios. <button type="button" class="dc-ap-l" data-aportar="si">Compartir los míos</button>') + "</p>";
  }
  $("dc-aportar").addEventListener("click", function (e) {
    var b = e.target.closest("[data-aportar]"); if (!b) return;
    state.prefs.aportar = b.dataset.aportar; state.prefs.aportarFecha = hoyStr(); changed(); pintarAportar();
    if (state.prefs.aportar === "si") genteEnviar(true);
  });
  $("dc-res").addEventListener("click", function (e) {
    var b = e.target.closest(".dc-prod"); if (!b) return;
    $("dc-lista").value = b.dataset.p; pintarDonde(); $("dc-lista").focus();
  });
  $("dc-chips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-p]"); if (!b) return;
    var v = $("dc-lista").value.trim(); $("dc-lista").value = v ? v + ", " + b.dataset.p : b.dataset.p; pintarDonde();
  });
  $("btn-donde-menu").addEventListener("click", function () { abrirDonde(); });

  // ===================== Tu canasta: lo que cuentas producto por producto =====================
  // Con las historias ("leche de 4.500, pan de 3.200…") Finti recuerda el precio de cada producto, dónde lo compraste
  // y cuánto se te va en él. De ahí salen las respuestas de Pregúntale, las ideas del asesor y la nota al guardar.
  // Todo se calcula en el dispositivo con los movimientos guardados.
  function canSingular(w) { return /[nrldzj]es$/.test(w) && w.length > 4 ? w.slice(0, -2) : /s$/.test(w) && w.length > 3 ? w.slice(0, -1) : w; }
  function canClave(n) {
    return prNorm(n).split(" ").filter(function (x) { return x.length > 1 && HI_PARO.indexOf(" " + x + " ") < 0 && !/^\d/.test(x); }).slice(0, 2).map(canSingular).join(" ");
  }
  function canCantidad(q) {
    var s = String(q || "").trim(), m = /^(½|¼|¾|\d+(?:[.,]\d+)?)\s*(.*)$/.exec(s);
    if (!m) return { cant: 1, unidad: "u" };
    var c = m[1] === "½" ? 0.5 : m[1] === "¼" ? 0.25 : m[1] === "¾" ? 0.75 : parseFloat(m[1].replace(",", ".")), u = nrm(m[2]).replace(/[×x]/, "").trim();
    return { cant: c > 0 ? c : 1, unidad: /^kg|kilo/.test(u) ? "kg" : /^lb|libra/.test(u) ? "lb" : /^(l|lt|litro)/.test(u) ? "l" : /^g|gramo/.test(u) ? "g" : "u" };
  }
  var CAN_GENERICO = /^(mercado|supermercado|tienda|tienda de barrio|minimercado|fruver|plaza de mercado|galeria|carniceria|panaderia|pescaderia|comida|almuerzo|corrientazo|ejecutivo|menu del dia|desayuno|cena|onces|merienda|lonchera|mecato|aseo|verdura|fruta|otros|lo demas|compra)$/;
  // Cada producto comprado con su precio: de las historias (det) y de los gastos sueltos que nombran un producto ("Tinto")
  function canRegistros(dias, sinIds) {
    var desde = hoyStr(new Date(Date.now() - (dias || 90) * 864e5)), out = [], fuera = sinIds || {};
    state.movs.forEach(function (mv) {
      if (mv.t !== "g" || !mv.f || mv.f < desde || fuera[mv.id]) return;
      var lugar = mv.det && mv.det.length ? (mv.com && mv.com !== mv.c ? mv.com : (/ en (.+)$/.exec(mv.c || "") || [])[1] || "") : "";
      if (mv.det && mv.det.length) {
        mv.det.forEach(function (d) {
          if (!d.m || d.falta || d.deducido || /^otros\b|^lo demas/.test(prNorm(d.n))) return;
          var k = canClave(d.n); if (!k || CAN_GENERICO.test(k)) return;
          var c = canCantidad(d.q);
          out.push({ k: k, n: d.n, unidad: c.unidad, cant: c.cant, pu: d.m / c.cant, m: d.m, f: mv.f, lugar: lugar, id: mv.id });
        });
      } else if (mv.cat === "alimentacion" && mv.c && prNorm(mv.c).split(" ").length <= 2) {
        var k2 = canClave(mv.c);
        if (k2 && !CAN_GENERICO.test(k2) && chBuscar(prNorm(mv.c), chLista())) out.push({ k: k2, n: mv.c, unidad: "u", cant: 1, pu: mv.m, m: mv.m, f: mv.f, lugar: mv.com && mv.com !== mv.c ? mv.com : "", id: mv.id });
      }
    });
    return out.sort(function (a, b) { return a.f < b.f ? -1 : a.f > b.f ? 1 : 0; });
  }
  function canResumen(dias) {
    var g = {}, orden = [];
    canRegistros(dias).forEach(function (r) {
      var o = g[r.k]; if (!o) { o = g[r.k] = { k: r.k, n: r.n, veces: 0, total: 0, regs: [] }; orden.push(o); }
      o.veces++; o.total += r.m; o.regs.push(r); o.n = r.n;
    });
    orden.forEach(function (o) {
      var u = o.regs[o.regs.length - 1].unidad, mismos = o.regs.filter(function (r) { return r.unidad === u; });
      o.unidad = u; o.ult = mismos[mismos.length - 1]; o.primero = mismos[0];
      o.cambio = mismos.length > 1 && o.primero.pu ? (o.ult.pu - o.primero.pu) / o.primero.pu : 0;
      var porLugar = {}; mismos.forEach(function (r) { if (!r.lugar) return; var l = porLugar[r.lugar] || (porLugar[r.lugar] = { lugar: r.lugar, s: 0, n: 0 }); l.s += r.pu; l.n++; });
      o.lugares = Object.keys(porLugar).map(function (l) { var x = porLugar[l]; return { lugar: l, pu: x.s / x.n, n: x.n }; }).sort(function (a, b) { return a.pu - b.pu; });
    });
    return orden;
  }
  function canNombre(n) { return String(n || "").charAt(0).toUpperCase() + String(n || "").slice(1).toLowerCase(); }
  function canPorUnidad(r) { return r.unidad === "kg" ? " el kilo" : r.unidad === "lb" ? " la libra" : r.unidad === "l" ? " el litro" : r.cant > 1 ? " por unidad" : ""; }
  function canPrecio(pu) { return money(pu >= 1000 ? Math.round(pu / 50) * 50 : Math.round(pu)); }
  // La nota al guardar una historia: el cambio de precio más notorio frente a la última compra del mismo producto
  function canNotaGuardado(guardados) {
    var ids = {}, nuevos = [];
    guardados.forEach(function (g) { if (g.mov && g.mov.id) ids[g.mov.id] = 1; });
    var nuevosRegs = canRegistros(400).filter(function (r) { return ids[r.id]; });
    if (!nuevosRegs.length) return "";
    var antes = canRegistros(400, ids), mejor = null;
    nuevosRegs.forEach(function (r) {
      var prev = antes.filter(function (a) { return a.k === r.k && a.unidad === r.unidad; });
      if (!prev.length) return;
      var p = prev[prev.length - 1], dif = r.pu - p.pu, rel = p.pu ? dif / p.pu : 0;
      if (Math.abs(rel) >= 0.05 && Math.abs(dif) >= 100 && (!mejor || Math.abs(rel) > Math.abs(mejor.rel))) {
        var min = prev.slice().sort(function (a, b) { return a.pu - b.pu; })[0];
        mejor = { r: r, p: p, dif: dif, rel: rel, min: min };
      }
    });
    if (!mejor) return "";
    var r = mejor.r, p = mejor.p, nom = "<b>" + esc(canNombre(r.n)) + "</b>", donde = p.lugar && p.lugar !== r.lugar ? " en " + esc(p.lugar) : "";
    if (mejor.dif < 0) return "¡Buena compra! " + nom + " te salió a " + canPrecio(r.pu) + canPorUnidad(r) + ", " + canPrecio(-mejor.dif) + " menos que la vez pasada" + donde + ".";
    var txt = nom + " subió: te salió a " + canPrecio(r.pu) + canPorUnidad(r) + " y la vez pasada" + donde + " estaba a " + canPrecio(p.pu) + ".";
    if (mejor.min.lugar && mejor.min.lugar !== r.lugar && mejor.min.pu < r.pu * 0.95) txt += " En " + esc(mejor.min.lugar) + " te ha salido a " + canPrecio(mejor.min.pu) + ".";
    return txt;
  }
  // El producto del que pregunta la persona: primero lo que ya ha comprado; si no, un alimento conocido
  function prProducto(t) {
    var mejor = null;
    canResumen(400).forEach(function (o) {
      var w = o.k.split(" ")[0];
      if (w.length >= 3 && new RegExp("(?:^| )" + w + "(?:s|es)?(?= |$)").test(t) && (!mejor || o.k.length > mejor.k.length)) mejor = o;
    });
    if (mejor) return { k: mejor.k, n: mejor.n };
    var lugares = {}; HI_LUGARES.forEach(function (l) { l[1].split("|").forEach(function (a) { lugares[prNorm(a)] = 1; }); });
    var cand = CH_VOCAB.alimentacion.split("|").map(prNorm).filter(function (w) { return w && !CAN_GENERICO.test(w) && !lugares[w]; }).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < cand.length; i++) if (new RegExp("(?:^| )" + cand[i] + "(?:s|es)?(?= |$)").test(t)) return { k: canClave(cand[i]), n: cand[i] };
    return null;
  }

  // ---------- Respuestas ----------
  // Cada una devuelve { html, chips } y deja el contexto listo para la siguiente pregunta.
  // Ayudas para las respuestas nuevas
  function prCuentasEn(t) {
    // "en nequi", "en efectivo", "con la tarjeta": la cuenta que nombra la pregunta (por su nombre o su tipo)
    var l = state.cuentas.filter(function (c) {
      var n = nrm(c.nombre || "");
      if (n && n.length > 2 && (" " + t + " ").indexOf(" " + n + " ") > -1) return true;
      return n.split(" ").some(function (w) { return w.length > 3 && new RegExp("\\b" + w + "\\b").test(t); });
    });
    if (l.length) return l;
    if (/efectivo|bolsillo|billetes/.test(t)) return state.cuentas.filter(function (c) { return c.tipo === "efectivo"; });
    if (/tarjeta de credito|\bcredito\b/.test(t)) return state.cuentas.filter(function (c) { return c.tipo === "tarjeta"; });
    if (/nequi/.test(t)) return state.cuentas.filter(function (c) { return c.tipo === "nequi"; });
    if (/daviplata/.test(t)) return state.cuentas.filter(function (c) { return c.tipo === "daviplata"; });
    return [];
  }
  function prMovsMes() { return state.movs.filter(function (x) { return x.t === "g" && (x.f || "").slice(0, 7) === state.mes; }); }
  function asiVaMes(t) {
    var hoy = new Date(), k = hoy.getFullYear() + "-" + ("0" + (hoy.getMonth() + 1)).slice(-2), actual = state.mes === k;
    var entra = t.ingReal > 0 ? Math.max(t.ingReal, t.ingPlan) : t.ingPlan, gasto = t.gasReal, P = actual ? pronostico(t) : null;
    var sobra = P && P.d >= 3 ? redondeoMil(P.cierre) : redondeoMil(entra - Math.max(gasto, actual ? t.gasPlan : gasto));
    if (!(entra > 0) && !(gasto > 0)) return { estado: "Empecemos", frase: "Cuéntame cuánto te entra y en qué gastas, y aquí te digo cómo vas." };
    if (sobra >= Math.max(1000, entra * 0.05)) return { estado: "Vas bien", frase: actual ? "Si sigues así, al final del mes te sobran unos " + money(sobra) + "." : "Cerraste el mes con unos " + money(Math.max(0, entra - gasto)) + " de sobra." };
    if (sobra >= 0) return { estado: "Vas justo", frase: actual ? "Llegas al final del mes, pero con poco margen: unos " + money(sobra) + "." : "Cerraste el mes justo." };
    return { estado: "Ojo", frase: actual ? "A este ritmo te faltarían unos " + money(-sobra) + ". Te ayudo a ajustar lo que queda." : "Ese mes gastaste " + money(-sobra) + " más de lo que entró." };
  }
  var PR_R = {
    // "¿Cuánta plata tengo?", "¿cuánto tengo en Nequi?", "¿cuánto gasté con la tarjeta?"
    saldos: function (q) {
      PR.ctx = { intent: "saldos" };
      var t = q.texto || "", l = prCuentasEn(t), gaste = /gaste|gasto|gastado|llevo|pague/.test(t);
      if (!state.cuentas.length) return PR_R.disponible(q);
      if (gaste && l.length) {
        var ids = l.map(function (c) { return c.id; }), mv = prMovsMes().filter(function (x) { return ids.indexOf(x.cuenta) > -1; });
        if (!mv.length) return { html: "<p>Este mes no tengo gastos anotados con " + esc(l[0].nombre) + ".</p><p>Cuando me cuentes un gasto, dime con qué pagaste y lo sumo aquí.</p>", chips: ["¿Cuánta plata tengo?", "¿En qué gasto más?"] };
        var por = {}; mv.forEach(function (x) { por[x.cat] = (por[x.cat] || 0) + x.m; });
        var top = Object.keys(por).sort(function (a, b) { return por[b] - por[a]; }).slice(0, 3);
        return { html: "<p>Este mes llevas <b>" + money(prSuma(mv)) + "</b> en gastos con " + esc(l[0].nombre) + ", en " + plural(mv.length, "compra") + ".</p><p>Lo que más: " + top.map(function (c) { return esc(prCatNombre(c)) + " (" + money(por[c]) + ")"; }).join(", ") + ".</p>", chips: ["¿Cuánta plata tengo?", "¿En qué gasto más?"] };
      }
      var lista = l.length ? l : state.cuentas;
      var dispo = lista.filter(function (c) { return c.tipo !== "tarjeta"; }), tj = lista.filter(function (c) { return c.tipo === "tarjeta"; });
      var h = "";
      if (l.length === 1) {
        var c = l[0];
        h = c.tipo === "tarjeta" ? "<p>En " + esc(c.nombre) + " debes <b>" + money(c.saldo) + "</b>" + (c.cupo > 0 ? " y te quedan " + money(Math.max(0, c.cupo - c.saldo)) + " de cupo" : "") + ".</p>"
          : "<p>En " + esc(c.nombre) + " tienes <b>" + money(c.saldo) + "</b>.</p>";
        return { html: h + "<p class=\"pr-nota\">Es el saldo que llevo con lo que me has contado. Si no coincide con tu banco, lo cuadramos en Cuentas.</p>", chips: ["¿Cuánta plata tengo?", "¿Cuánto puedo gastar hoy?"] };
      }
      var total = dispo.reduce(function (a, c) { return a + c.saldo; }, 0);
      h = "<p>Entre tus cuentas tienes <b>" + money(total) + "</b>.</p><ul class=\"pr-lista\">" + dispo.map(function (c) { return "<li><b>" + esc(c.nombre) + ":</b> " + money(c.saldo) + "</li>"; }).join("") +
        tj.map(function (c) { return "<li><b>" + esc(c.nombre) + ":</b> debes " + money(c.saldo) + "</li>"; }).join("") + "</ul>";
      return { html: h + "<p class=\"pr-nota\">Son los saldos que llevo con lo que me has contado. Si alguno no coincide con tu banco, lo cuadramos en Cuentas.</p>", chips: ["¿Cuánto puedo gastar hoy?", "¿Cuánto me deben?"] };
    },
    // "¿Cuánto me deben?", "¿quién me debe plata?"
    medeben: function () {
      PR.ctx = { intent: "medeben" };
      var l = state.meDeben.filter(function (x) { return x.m > 0; });
      if (!l.length) return { html: "<p>Nadie te debe plata, según lo que me has contado.</p><p>Cuando le prestes a alguien, dime por ejemplo: <b>le presté $ 50.000 a Juan</b>, y te ayudo a recordarlo.</p>", chips: ["¿Cuánto debo?", "¿Cuánta plata tengo?"] };
      var por = {}; l.forEach(function (x) { var k = x.quien || "Otra persona"; por[k] = (por[k] || 0) + x.m; });
      var nombres = Object.keys(por).sort(function (a, b) { return por[b] - por[a]; }), total = prSuma(l);
      return { html: "<p>Te deben <b>" + money(total) + "</b>" + (nombres.length > 1 ? " entre " + plural(nombres.length, "persona") : "") + ".</p><ul class=\"pr-lista\">" +
        nombres.slice(0, 6).map(function (n) { return "<li><b>" + esc(n) + ":</b> " + money(por[n]) + "</li>"; }).join("") + "</ul>" +
        "<p>Cuando te paguen, dime por ejemplo: <b>" + esc(nombres[0].split(" ")[0]) + " me pagó</b>, y lo quito de la lista.</p>", chips: ["¿Cuánta plata tengo?", "¿Cuánto debo?"] };
    },
    // "¿Cuál fue mi gasto más grande?"
    mayor: function () {
      PR.ctx = { intent: "mayor" };
      var mv = prMovsMes().slice().sort(function (a, b) { return b.m - a.m; });
      if (!mv.length) {
        var t = totalsOf(cur()), ids = Object.keys(t.byCat).filter(function (id) { return t.byCat[id].real > 0; }).sort(function (a, b) { return t.byCat[b].real - t.byCat[a].real; });
        if (!ids.length) return { html: "<p>Todavía no tengo gastos de este mes. Cuando me cuentes alguno, te digo cuál fue el más grande.</p>", chips: ["¿Cómo te cuento un gasto?"] };
        return { html: "<p>Lo que más se lleva este mes es <b>" + esc(prCatNombre(ids[0])) + "</b>, con " + money(t.byCat[ids[0]].real) + ".</p><p>Cuando anotes tus gastos uno por uno, te digo también cuál compra fue la más grande.</p>" + prAviso(), chips: ["¿En qué gasto más?"] };
      }
      var x = mv[0], f = parseD(x.f);
      return { html: "<p>Tu gasto más grande del mes fue <b>" + money(x.m) + "</b> en " + esc(x.c || prCatNombre(x.cat)) + (f ? ", el " + fechaLarga(f) : "") + ".</p>" +
        (mv.length > 1 ? "<p>Le siguen:</p><ul class=\"pr-lista\">" + mv.slice(1, 4).map(function (y) { var g = parseD(y.f); return "<li><b>" + money(y.m) + "</b> en " + esc(y.c || prCatNombre(y.cat)) + (g ? " (" + fechaLarga(g) + ")" : "") + "</li>"; }).join("") + "</ul>" : ""),
        chips: ["¿En qué gasto más?", "¿Cuánto gasto al día en promedio?"] };
    },
    // "¿Cuánto gasto al día en promedio?"
    promedio: function () {
      PR.ctx = { intent: "promedio" };
      var t = totalsOf(cur()), hoy = new Date(), k = hoy.getFullYear() + "-" + ("0" + (hoy.getMonth() + 1)).slice(-2), actual = state.mes === k;
      var dias = actual ? hoy.getDate() : new Date(+state.mes.slice(0, 4), +state.mes.slice(5, 7), 0).getDate();
      if (!(t.gasReal > 0)) return { html: "<p>Todavía no tengo gastos de este mes para sacar el promedio.</p>", chips: ["¿Cuánto me queda este mes?"] };
      var prom = redondeoMil(t.gasReal / dias), h = "<p>En promedio gastas <b>" + money(prom) + " al día</b> " + (actual ? "en lo que va del mes (" + plural(dias, "día") + ")" : "en " + esc(monthLabel(state.mes).toLowerCase())) + ".</p>";
      var hp = actual ? hoyPuedes(t) : null;
      if (hp && hp.plan) h += "<p>Para el día a día (sin contar arriendo, servicios ni ahorro) te quedan unos <b>" + money(redondeoMil(Math.max(0, hp.base))) + " por día</b> hasta fin de mes.</p>";
      return { html: h + prCalc(["Gastos del mes: " + money(t.gasReal) + ".", "Días: " + dias + ".", "El promedio incluye los pagos grandes, como el arriendo; por eso puede verse alto."]) + prAviso(), chips: ["¿Cuánto puedo gastar hoy?", "¿Cuál fue mi gasto más grande?"] };
    },
    // "¿Cuánto puedo gastar hoy?": la misma cifra de la tarjeta azul del Inicio
    hoy: function (q) {
      var t = totalsOf(cur()), hp = hoyPuedes(t);
      if (!hp || !hp.plan) return PR_R.disponible(q);
      PR.ctx = { intent: "hoy" };
      var puede = redondeoMil(hp.puede);
      var h = puede > 0 ? "<p>Hoy puedes gastar <b>" + money(puede) + "</b> en el día a día, sin descuadrar el mes.</p>"
        : "<p>Por hoy ya usaste lo del día a día" + (hp.hoyGasto ? " (llevas " + money(hp.hoyGasto) + ")" : "") + ". Si puedes, deja lo demás para mañana.</p>";
      h += "<p>Te quedan " + plural(hp.quedan, "día") + " en el mes, con unos " + money(redondeoMil(Math.max(0, hp.base))) + " por día.</p>";
      return { html: h + prCalc(["Lo planeado para el día a día este mes: " + money(hp.plan) + ".", "Lo que ya gastaste en eso: " + money(hp.plan - hp.resto) + ".", "Lo que queda, repartido en los días que faltan, menos lo que llevas hoy."]) + prAviso(), chips: ["¿Me alcanza para algo de $ 50.000?", "¿Cómo cierro el mes?"] };
    },
    // "¿Cuánta plata me queda hasta la quincena?"
    quincena: function () {
      PR.ctx = { intent: "quincena" };
      var t = totalsOf(cur()), hoy = new Date(), d = hoy.getDate(), ult = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
      var pago = d < 15 ? 15 : ult, faltan = Math.max(1, pago - d);
      var saldo = Math.max(0, t.saldo), hp = hoyPuedes(t), dia = hp && hp.plan ? redondeoMil(Math.max(0, hp.base)) : redondeoMil(saldo / faltan);
      return { html: "<p>Hasta la próxima quincena (el " + pago + ") faltan <b>" + plural(faltan, "día") + "</b>. Para el día a día tienes unos <b>" + money(dia) + " por día</b>" + (hp && hp.plan ? ", lo mismo que te muestro en Inicio" : "") + ".</p>" +
        (hp && hp.plan ? "<p>Eso ya cuida tus pagos, tu ahorro y lo necesario del mes.</p>" : "") +
        "<p class=\"pr-nota\">Tomo la quincena como el 15 y el último día del mes. Si te pagan en otra fecha, dímela en tus ingresos y lo calculo con esa.</p>" + prAviso(), chips: ["¿Cuánto puedo gastar hoy?", "¿Qué tengo que pagar?"] };
    },
    // "¿Cómo voy?", "¿voy bien?": el mismo estado de Análisis
    estado: function () {
      PR.ctx = { intent: "estado" };
      var a = asiVaMes(totalsOf(cur()));
      return { html: "<p><b>" + a.estado + ".</b> " + a.frase + "</p>" + prAviso(), chips: a.estado === "Ojo" ? ["¿Qué me recomiendas?", "¿En qué gasto más?"] : ["¿En qué gasto más?", "¿Cuánto puedo gastar hoy?"] };
    },
    saludo: function () {
      return { html: "<p>¡Hola! Pregúntame lo que quieras sobre tu plata: cuánto llevas gastado, si te alcanza para algo o qué tienes que pagar.</p>", chips: ["¿Cuánto me queda este mes?", "¿En qué gasto más?", "¿Qué tengo que pagar esta semana?"] };
    },
    gracias: function () { return { html: "<p>¡Con gusto! Aquí estoy cuando quieras revisar algo más.</p>", chips: ["¿Cómo voy frente al mes pasado?", "¿Cómo cierro el mes?"] }; },
    ayuda: function () {
      return { html: "<p>Respondo con tus números, aquí en tu dispositivo. Puedes preguntarme cosas como estas:</p><ul class=\"pr-lista\">" +
        "<li><b>Gastos:</b> ¿cuánto gasté en comida?, ¿cuánto llevo en Rappi este mes?, ¿en qué gasto más?, ¿cuál fue mi gasto más grande?, ¿cuánto gasto al día?</li>" +
        "<li><b>Tus cuentas:</b> ¿cuánta plata tengo?, ¿cuánto tengo en Nequi?, ¿cuánto me deben?</li>" +
        "<li><b>Tu mercado:</b> ¿cuánto gasté en leche?, ¿dónde compro más barato el arroz?, ¿qué es lo que más compro?</li>" +
        "<li><b>Consejos:</b> ¿qué me recomiendas?, ¿cómo puedo ahorrar en el mercado?, ¿debería sacar un crédito?</li>" +
        "<li><b>Decisiones:</b> ¿me alcanza para unos tenis de $ 300.000?, ¿cuánto puedo gastar hoy?</li>" +
        "<li><b>El mes:</b> ¿cómo voy?, ¿cómo cierro el mes?, ¿cuánto me queda hasta la quincena?, ¿cómo voy frente al mes pasado?</li>" +
        "<li><b>Compromisos:</b> ¿qué tengo que pagar esta semana?, ¿cuánto debo?, ¿cuándo llego a mi meta?</li>" +
        "<li><b>Hábitos:</b> ¿cuánto se me va en gastos hormiga?, ¿qué día gasto más?</li>" +
        "<li><b>La app:</b> ¿cómo conecto mi banco?, ¿cómo importo el extracto?</li></ul>" +
        "<p>También entiendo seguimientos: después de una respuesta puedes decir \"¿y en transporte?\" o \"¿y el mes pasado?\".</p>",
        chips: ["¿Cuánto gasté en comida?", "¿Me alcanza para algo de $ 200.000?", "¿Cómo cierro el mes?"] };
    },
    gasto: function (q) {
      var per = q.per || prPeriodoBase(), cat = q.cat, com = q.com, tot = prTotal(per, "g", cat, com);
      PR.ctx = { intent: "gasto", per: per, cat: cat, com: com };
      if (!tot) return { html: "<p>No tengo datos " + esc(prDe(per.nombre)) + ". Tus meses guardados van de " + esc(monthLabel(monthKeys()[0]).toLowerCase()) + " a " + esc(monthLabel(monthKeys()[monthKeys().length - 1]).toLowerCase()) + ".</p>", chips: ["¿Cuánto gasté este mes?"] };
      var que = com ? "en " + esc(com.nombre) : cat ? "en " + esc(prCatNombre(cat)) : "en total", h;
      if (com || !tot.tabla) {
        if (!tot.n) {
          h = "<p>No encontré gastos " + que + " " + esc(per.nombre) + "." + (!state.movs.length ? " Todavía no tengo tu historial de movimientos: se arma cuando registras gastos, conectas tu banco o importas el extracto." : "") + "</p>";
          return { html: h, chips: com ? ["¿Cuánto gasté este mes?"] : ["¿Cuánto gasté este mes?", "¿En qué gasto más?"] };
        }
        var prom = tot.real / tot.n;
        h = "<p>" + cap(esc(per.nombre)) + " llevas <b>" + money(tot.real) + "</b> " + que + ", en " + plural(tot.n, "movimiento") + " (unos " + money(Math.round(prom / 100) * 100) + " cada vez).</p>";
        if (com && tot.n >= 3) { var anual = tot.real / Math.max(1, prDiasPer(per)) * 365; h += "<p>A ese ritmo serían unos <b>" + money(Math.round(anual / 1000) * 1000) + " al año</b>.</p>"; }
        return { html: h, chips: (com ? prChipPasado() : ["¿En qué gasto más?"]).concat(["¿Cuánto me queda este mes?"]) };
      }
      h = "<p>" + cap(esc(per.nombre)) + " llevas <b>" + money(tot.real) + "</b> " + que;
      if (tot.plan > 0) {
        var pct = tot.real / tot.plan;
        h += " de " + money(tot.plan) + " que planeaste (" + prPct(pct) + ").</p>";
        h += tot.real > tot.plan ? "<p>Te pasaste por " + money(tot.real - tot.plan) + ". No pasa nada: " + (per.k === nowKey() ? "lo importante es ajustar lo que queda del mes." : "sirve para planear mejor el próximo.") + "</p>"
          : tot.real === tot.plan ? "<p>Llegaste justo a lo planeado.</p>"
          : pct >= 0.9 ? "<p>Vas cerca del límite: te quedan " + money(tot.plan - tot.real) + ".</p>" : "<p>Te quedan " + money(tot.plan - tot.real) + ". Vas bien.</p>";
      } else h += ".</p>";
      var chips = cat ? prChipPasado().concat(["¿En qué gasto más?"]) : ["¿En qué gasto más?"].concat(prChipPasado("¿Cómo voy frente al mes pasado?"));
      if (!cat && !com) { PR.espera = { tipo: "cat", texto: "¿Quieres verlo por categoría?" }; h += "<p>¿Quieres verlo de alguna categoría en particular?</p>"; chips = prTopCats(per, 3).map(function (c) { return "¿Y en " + prCatNombre(c) + "?"; }).concat(chips.slice(0, 1)); }
      return { html: h + prAviso(), chips: chips };
    },
    top: function (q) {
      var per = q.per || prPeriodoBase(); PR.ctx = { intent: "top", per: per };
      var top = prTopCats(per, 3, true);
      if (!top.length) return { html: "<p>No tengo gastos registrados " + esc(per.nombre) + ".</p>", chips: ["¿Cuánto me queda este mes?"] };
      var total = top.total, h = "<p>" + cap(esc(per.nombre)) + " tu plata se va sobre todo en:</p><ol class=\"pr-lista\">" + top.map(function (c) { return "<li><b>" + esc(cap(prCatNombre(c.id))) + ":</b> " + money(c.real) + " (" + prPct(c.real / total) + ")</li>"; }).join("") + "</ol>";
      var gus = top.filter(function (c) { return (catById(c.id) || { group: "gus" }).group === "gus"; })[0];
      if (gus) h += "<p>Si quisieras ahorrar más, " + esc(prCatNombre(gus.id)) + " es donde un pequeño ajuste se nota: un 10 % menos son " + money(Math.round(gus.real * 0.1 / 1000) * 1000) + " al mes.</p>";
      return { html: h + prAviso(), chips: top.slice(0, 2).map(function (c) { return "¿Cuánto gasté en " + prCatNombre(c.id) + "?"; }).concat(["¿Cuánto se me va en gastos hormiga?"]) };
    },
    ingresos: function (q) {
      var per = q.per || prPeriodoBase(), tot = prTotal(per, "i"); PR.ctx = { intent: "ingresos", per: per };
      if (!tot) return { html: "<p>No tengo datos de ese periodo.</p>", chips: [] };
      var h = "<p>" + cap(esc(per.nombre)) + " te han entrado <b>" + money(tot.real) + "</b>" + (tot.plan ? " de " + money(tot.plan) + " que esperabas." : ".") + "</p>";
      if (tot.plan > tot.real && tot.tabla) h += "<p>Te faltan " + money(tot.plan - tot.real) + " por recibir.</p>";
      return { html: h + prAviso(), chips: ["¿Cuánto gasté este mes?", "¿Cuánto estoy ahorrando?"] };
    },
    disponible: function (q) {
      PR.ctx = { intent: "disponible", cat: q.cat };
      var t = totalsOf(cur());
      if (q.cat) {
        var c = t.byCat[q.cat] || { plan: 0, real: 0 }, nom = esc(prCatNombre(q.cat));
        if (!c.plan) return { html: "<p>No tienes un monto planeado para " + nom + " en " + esc(monthLabel(state.mes).toLowerCase()) + ". Llevas " + money(c.real) + ".</p>", chips: ["¿Cuánto me queda este mes?"] };
        return { html: "<p>En " + nom + " te quedan <b>" + money(Math.max(0, c.plan - c.real)) + "</b> de " + money(c.plan) + "." + (c.real > c.plan ? " Te pasaste por " + money(c.real - c.plan) + "." : "") + "</p>" + prAviso(), chips: ["¿En qué gasto más?", "¿Cuánto puedo gastar hoy?"] };
      }
      var ci = prCierre(), d = ci.disf, h = "<p>Te quedan <b>" + money(t.saldo) + "</b> de lo que te ha entrado en " + esc(monthLabel(state.mes).toLowerCase()) + ".</p>";
      if (ci.actual) h += d.libre > 0 ? "<p>Para gustos, sin tocar lo necesario, tus pagos ni tu ahorro, tienes unos <b>" + money(Math.round(d.diario / 1000) * 1000) + " al día</b> (" + money(Math.round(d.libre / 1000) * 1000) + " en los " + plural(d.quedan, "día") + " que quedan).</p>"
        : "<p>El espacio para gustos de este mes ya se usó. Lo que queda va para lo necesario y tus pagos: mejor planes sencillos hasta fin de mes.</p>";
      h += prCalc(["Ingresos reales: " + money(t.ingReal) + ".", "Gastos reales: " + money(t.gasReal) + ".",
        ci.actual ? "Para gustos: lo que esperas recibir este mes menos tus gastos necesarios, tus pagos con fecha y tu ahorro planeado, menos lo que ya gastaste en gustos, repartido en los días que quedan." : "Estás viendo un mes que no es el actual: el cálculo por día solo aplica al mes en curso."]);
      return { html: h + prAviso(), chips: ["¿Me alcanza para algo de $ 100.000?", "¿Cómo cierro el mes?"] };
    },
    alcanza: function (q) {
      if (!q.monto) { PR.espera = { tipo: "monto", intent: "alcanza" }; return { html: "<p>Te ayudo a pensarlo. ¿Cuánto cuesta lo que quieres?</p>", chips: ["$ 50.000", "$ 200.000", "$ 1.000.000"] }; }
      PR.ctx = { intent: "alcanza", monto: q.monto };
      var ci = prCierre(), d = ci.disf, t = totalsOf(cur()), libre = ci.actual ? d.libre : t.saldo, pend = prPagosPendientes(31).reduce(function (a, x) { return a + x.monto; }, 0);
      var aho = t.byCat.ahorro ? Math.max(0, t.byCat.ahorro.plan - t.byCat.ahorro.real) : 0, h, chips;
      var pasos = ["Lo que quieres: " + money(q.monto) + ".", "Te quedan " + money(t.saldo) + " de lo que te ha entrado este mes.",
        pend ? "Aún tienes " + money(pend) + " en pagos por vencer." : "No tienes pagos pendientes registrados.", aho ? "Faltan " + money(aho) + " de tu ahorro planeado." : "",
        ci.actual ? "Para gustos te quedan unos " + money(Math.round(Math.max(0, libre) / 1000) * 1000) + " hasta fin de mes." : ""].filter(Boolean);
      if (libre >= q.monto) {
        var resto = libre - q.monto;
        h = "<p><b>Sí te alcanza.</b> Después de comprarlo te quedarían unos " + money(Math.round(resto / 1000) * 1000) + " para el día a día" + (ci.actual ? " (" + money(Math.round(resto / d.quedan / 1000) * 1000) + " al día)" : "") + ", sin tocar lo necesario, tus pagos ni tu ahorro.</p>";
        if (resto < libre * 0.25) h += "<p>Eso sí, te quedaría poco margen. Si no es urgente, también puedes esperar al próximo mes.</p>";
        chips = ["¿Cuánto puedo gastar hoy?", "¿Cómo cierro el mes?"];
      } else if (libre + aho >= q.monto && libre + aho > 0) {
        h = "<p><b>Justo.</b> Solo te alcanza si usas parte del ahorro que planeaste este mes (" + money(q.monto - Math.max(0, libre)) + "). Lo necesario y tus pagos seguirían cubiertos.</p><p>¿Quieres que calcule cuánto apartar para comprarlo sin tocar tu ahorro?</p>";
        PR.espera = { tipo: "si", accion: function () { return prPlanCompra(q.monto, libre); } }; chips = ["Sí, calcúlalo", "No, gracias"];
      } else {
        h = "<p><b>Este mes no te alcanza sin descuadrar tus cuentas.</b> Te faltarían unos " + money(Math.round((q.monto - Math.max(0, libre)) / 1000) * 1000) + ".</p><p>¿Quieres que te diga cuánto apartar y en cuánto tiempo lo logras?</p>";
        PR.espera = { tipo: "si", accion: function () { return prPlanCompra(q.monto, libre); } }; chips = ["Sí, calcúlalo", "No, gracias"];
      }
      return { html: h + prCalc(pasos) + prAviso(), chips: chips };
    },
    cierre: function () {
      PR.ctx = { intent: "cierre" };
      var ci = prCierre(), m$ = function (v) { return money(Math.round(v / 1000) * 1000); };
      if (!ci.actual) { var t = totalsOf(cur()); return { html: "<p>" + esc(monthLabel(state.mes)) + (state.mes >= nowKey() ? " va con un saldo de <b>" : " cerró con un saldo de <b>") + money(t.saldo) + "</b>" + (t.ingReal ? " y una tasa de ahorro del " + prPct(t.ahorro / t.ingReal) : "") + ".</p>" + prAviso(), chips: ["¿En qué gasto más?"] }; }
      var h;
      if (ci.p50 < 0) {
        var porDia = Math.ceil(-ci.p50 / Math.max(1, ci.dias - ci.dia) / 1000) * 1000;
        h = "<p>A este ritmo <b>cerrarías el mes en rojo</b>, con unos " + m$(-ci.p50) + " de menos (entre " + m$(Math.max(0, -ci.p90)) + " y " + m$(-ci.p10) + ").</p>";
        h += "<p>Todavía estás a tiempo: si bajas tus gastos variables unos " + money(porDia) + " al día, cierras en cero. Revisa primero los gustos.</p>";
      } else {
        h = "<p>Si sigues a este ritmo, lo más probable es que cierres el mes con <b>" + m$(ci.p50) + "</b> a favor (entre " + m$(Math.max(0, ci.p10)) + " y " + m$(ci.p90) + ").</p>";
        h += ci.rojo >= 0.05 ? "<p>Hay un " + Math.round(ci.rojo * 100) + " % de probabilidad de cerrar en rojo. Un ajuste pequeño en gustos lo evita.</p>" : "<p>Todo indica que cierras en orden.</p>";
      }
      h += prCalc(["Vas en el día " + ci.dia + " de " + ci.dias + ".", "Tus gastos variables van a " + m$(ci.diario) + " al día y se proyectan al resto del mes, mezclados con tu plan.", "Los pagos con fecha se toman de tu plan y los ingresos que faltan, como planeados.", "Simulé 400 cierres posibles con esa variación: el rango cubre 8 de cada 10."]);
      return { html: h + prAviso(), chips: ["¿Cuánto puedo gastar hoy?", "¿En qué gasto más?"] };
    },
    comparar: function (q) {
      PR.ctx = { intent: "comparar", cat: q.cat };
      var k = state.mes, kp = addMonths(k, -1);
      if (!state.meses[kp]) { var av = asiVaMes(totalsOf(cur())); return { html: "<p><b>" + av.estado + ".</b> " + av.frase + "</p><p>Todavía no tengo " + esc(monthLabel(kp).toLowerCase()) + "; desde el próximo mes también te comparo con el anterior.</p>" + prAviso(), chips: ["¿En qué gasto más?", "¿Cuánto puedo gastar hoy?"] }; }
      var a = totalsOf(cur()), b = totalsOf(state.meses[kp]), ra = q.cat ? (a.byCat[q.cat] || { real: 0 }).real : a.gasReal, rb = q.cat ? (b.byCat[q.cat] || { real: 0 }).real : b.gasReal;
      var que = q.cat ? " en " + esc(prCatNombre(q.cat)) : "", ci = prCierre(), h;
      if (ci.actual && ci.dia < ci.dias) {
        // Mismo punto del mes: con el historial de movimientos, si lo hay
        var dd = ("0" + ci.dia).slice(-2), mA = state.movs.filter(function (x) { return x.t === "g" && x.f >= k + "-01" && x.f <= k + "-" + dd && (!q.cat || x.cat === q.cat); }),
          mB = state.movs.filter(function (x) { return x.t === "g" && x.f >= kp + "-01" && x.f <= kp + "-" + dd && (!q.cat || x.cat === q.cat); });
        if (mA.length >= 3 && mB.length >= 3) { ra = prSuma(mA); rb = prSuma(mB); h = "<p>A esta altura del mes (día " + ci.dia + ") llevas <b>" + money(ra) + "</b>" + que + "; el mes pasado, al mismo día, llevabas " + money(rb) + ".</p>"; }
        else h = "<p>Este mes llevas <b>" + money(ra) + "</b>" + que + " y el mes pasado gastaste " + money(rb) + " en total. Como el mes no ha terminado, compáralo con calma.</p>";
      } else h = "<p>" + esc(monthLabel(k)) + ": <b>" + money(ra) + "</b>" + que + ". " + esc(monthLabel(kp)) + ": " + money(rb) + ".</p>";
      if (rb > 0) { var dif = ra / rb - 1; h += Math.abs(dif) < 0.05 ? "<p>Vas prácticamente igual.</p>" : dif < 0 ? "<p>¡Vas un " + prPct(-dif) + " por debajo! Bien hecho.</p>" : "<p>Vas un " + prPct(dif) + " por encima. Mira en qué se fue la diferencia y decide si vale la pena.</p>"; }
      return { html: h + prAviso(), chips: q.cat ? ["¿En qué gasto más?"] : ["¿En qué gasto más?", "¿Cómo cierro el mes?"] };
    },
    ahorro: function () {
      PR.ctx = { intent: "ahorro" };
      var t = totalsOf(cur()), ing = t.ingReal || t.ingPlan, tasa = ing ? t.ahorro / ing : 0;
      var h = "<p>En " + esc(monthLabel(state.mes).toLowerCase()) + " vas ahorrando <b>" + money(t.ahorro) + "</b>" + (ing ? ", el " + prPct(tasa) + " de lo que te entra" : "") + ".</p>";
      h += ing ? (tasa >= 0.2 ? "<p>¡Estás por encima del 20 %, la meta de la regla 50/30/20!</p>" : "<p>Para llegar al 20 % te faltan " + money(Math.ceil((0.2 * ing - t.ahorro) / 1000) * 1000) + ". Cada peso cuenta.</p>") : "";
      var ah = prAhorroMensual(); if (ah > 0) h += "<p>En promedio ahorras unos " + money(Math.round(ah / 1000) * 1000) + " al mes.</p>";
      return { html: h + prAviso(), chips: state.metas.length ? ["¿Cuándo llego a mi meta?", "¿En qué gasto más?"] : ["¿Me alcanza para algo de $ 500.000?", "¿En qué gasto más?"] };
    },
    metas: function (q) {
      PR.ctx = { intent: "metas" };
      if (!state.metas.length) return { html: "<p>Todavía no tienes metas de ahorro. Ponerle nombre y fecha a lo que quieres (un viaje, un colchón para imprevistos) ayuda mucho a lograrlo.</p>", chips: ["¿Cómo creo una meta?", "¿Cuánto estoy ahorrando?"] };
      var ah = prAhorroMensual(), lista = state.metas;
      if (q.texto) { var f = lista.filter(function (g) { return prPalabras(g.nombre).some(function (w) { return q.texto.indexOf(w) > -1; }); }); if (f.length) lista = f; }
      var h = "<ul class=\"pr-lista\">" + lista.slice(0, 4).map(function (g) {
        var falta = Math.max(0, g.objetivo - g.ahorrado), pct = g.objetivo ? g.ahorrado / g.objetivo : 0, s = "<li><b>" + esc(g.nombre || "Meta") + ":</b> llevas " + money(g.ahorrado) + " de " + money(g.objetivo) + " (" + prPct(pct) + "). ";
        if (!falta) return s + "¡Ya la lograste!</li>";
        if (g.fecha) { var mesesF = Math.max(1, (parseKey(g.fecha).y - new Date().getFullYear()) * 12 + parseKey(g.fecha).m - (new Date().getMonth() + 1)); s += "Para tenerla en " + esc(monthLabel(g.fecha).toLowerCase()) + " necesitas apartar " + money(Math.ceil(falta / mesesF / 1000) * 1000) + " al mes."; }
        else if (ah > 0) s += "Si le dedicas todo tu ahorro promedio (" + money(Math.round(ah / 1000) * 1000) + " al mes), la logras " + prCuando(falta / ah) + ".";
        return s + "</li>";
      }).join("") + "</ul>";
      return { html: h + prAviso(), chips: ["¿Cuánto estoy ahorrando?", "¿En qué gasto más?"] };
    },
    deudas: function () {
      PR.ctx = { intent: "deudas" };
      if (!state.deudas.length) return { html: "<p>No tienes deudas registradas. Si tienes alguna, agrégala en Metas para que te arme un plan para salir de ella.</p>", chips: ["¿Cómo agrego una deuda?"] };
      var tot = state.deudas.reduce(function (a, d) { return a + d.saldo; }, 0), cuotas = state.deudas.reduce(function (a, d) { return a + d.cuota; }, 0);
      var orden = state.deudas.filter(function (d) { return d.saldo > 0; }).slice().sort(state.deudaMetodo === "bola" ? function (a, b) { return a.saldo - b.saldo; } : function (a, b) { return b.tasa - a.tasa; }), p = orden[0];
      var h = "<p>Debes <b>" + money(tot) + "</b> en " + plural(state.deudas.length, "deuda") + ", con cuotas de " + money(cuotas) + " al mes.</p>";
      if (p) h += "<p>Si te sobra algo, abónalo primero a <b>" + esc(p.nombre || "tu deuda") + "</b>: " + (state.deudaMetodo === "bola" ? "es la de menor saldo, y saldarla pronto te da impulso para seguir (método bola de nieve)." : "es la que cobra más interés (" + String(p.tasa).replace(".", ",") + " % E. A.), así pagas menos intereses en total (método avalancha).") + "</p>";
      var ing = totalsOf(cur()).ingReal; if (ing > 0) h += "<p>Tus cuotas son el " + prPct(cuotas / ing) + " de tus ingresos." + (cuotas / ing > 0.3 ? " Es alto: evita nuevas deudas por ahora." : " Es un nivel manejable.") + "</p>";
      return { html: h, chips: ["¿Cuánto puedo gastar hoy?", "¿Qué tengo que pagar esta semana?"] };
    },
    pagos: function (q) {
      var dias = q.per && q.per.tipo === "rango" && /semana/.test(q.per.nombre) ? 7 : /\bhoy\b/.test(q.texto || "") ? 0 : /manana/.test(q.texto || "") ? 1 : 31;
      PR.ctx = { intent: "pagos" };
      var l = prPagosPendientes(dias);
      var pal = (q.texto || "").split(" ").filter(function (w) { return w.length > 3 && !/^(cuando|vence|vencen|pagar|tengo|debo|esta|semana|pagos?|pendientes?|proximos?|cuanto|cuales)$/.test(w); });
      var uno = pal.length ? l.filter(function (x) { var n = nrm(x.nombre); return pal.some(function (w) { return n.indexOf(w) > -1 || n.indexOf(w.slice(0, 5)) > -1; }); }) : [];
      if (uno.length) l = uno;
      var filas = cur().gastos.filter(function (r) { return r.dia > 0 && r.real < r.plan && !state.porPagar.some(function (b) { return normal(b.nombre) === normal(r.concepto); }); });
      if (!l.length && !filas.length) return { html: "<p>" + (state.porPagar.length ? "No tienes pagos pendientes " + (dias === 7 ? "esta semana" : dias <= 1 ? "para " + (dias ? "mañana" : "hoy") : "este mes") + ". ¡Estás al día!" : "No tienes cuentas por pagar registradas. Agrégalas en Cuentas y te aviso antes de que venzan.") + "</p>", chips: state.porPagar.length ? ["¿Cuánto me queda este mes?"] : ["¿Cómo agrego un recordatorio de pago?"] };
      var h = "";
      if (l.length) h += "<p>Tienes " + plural(l.length, "pago") + " pendiente" + (l.length === 1 ? "" : "s") + " por " + money(l.reduce(function (a, x) { return a + x.monto; }, 0)) + ":</p><ul class=\"pr-lista\">" + l.slice(0, 6).map(function (x) {
        return "<li><b>" + esc(x.nombre) + ":</b> " + money(x.monto) + ", " + (x.dias < 0 ? "vencido hace " + plural(-x.dias, "día") : x.dias === 0 ? "vence hoy" : x.dias === 1 ? "vence mañana" : "vence el " + fechaLarga(x.due)) + "</li>";
      }).join("") + "</ul>";
      if (filas.length && dias > 7) h += "<p>En tu presupuesto también faltan: " + filas.slice(0, 4).map(function (r) { return esc(r.concepto) + " (día " + r.dia + ")"; }).join(", ") + ".</p>";
      return { html: h, chips: ["¿Cuánto me queda este mes?", "¿Cuánto debo?"] };
    },
    hormiga: function () {
      PR.ctx = { intent: "hormiga" };
      var hoy = d0(), lim = new Date(hoy); lim.setDate(lim.getDate() - 29);
      var l = state.movs.filter(function (x) { return x.t === "g" && x.m <= 20000 && x.f >= hoyStr(lim); });
      if (l.length < 3) return { html: "<p>Los gastos hormiga son las compras pequeñas (menos de $ 20.000) que se repiten: el tinto, el paquete, el domicilio. Todavía no tengo suficientes movimientos tuyos para medirlos; los veo a medida que registras o conectas tu banco.</p>", chips: ["¿Cómo conecto mi banco?"] };
      var tot = prSuma(l), por = {}; l.forEach(function (x) { var c = x.c || "Otros"; por[c] = (por[c] || 0) + x.m; });
      var top = Object.keys(por).sort(function (a, b) { return por[b] - por[a]; }).slice(0, 3);
      var h = "<p>En los últimos 30 días tuviste <b>" + plural(l.length, "gasto") + " pequeño" + (l.length === 1 ? "" : "s") + "</b> que suman " + money(tot) + ". Al año serían unos <b>" + money(Math.round(tot * 12 / 1000) * 1000) + "</b>.</p>";
      h += "<p>Los que más se repiten: " + top.map(function (c) { return esc(c) + " (" + money(por[c]) + ")"; }).join(", ") + ".</p><p>No se trata de dejarlos todos: elige uno o dos que no extrañarías.</p>";
      return { html: h, chips: ["¿En qué gasto más?", "¿Qué día gasto más?"] };
    },
    habitos: function () {
      PR.ctx = { intent: "habitos" };
      var pat = aprenderPatrones();
      if (!pat.items.length) return { html: "<p>Todavía te estoy conociendo. Con " + plural(Math.max(1, pat.faltan || 12), "movimiento") + " más y un par de semanas te muestro en qué días y horas gastas más y qué pagos se repiten.</p>", chips: ["¿Cómo importo el extracto?"] };
      return { html: "<p>Esto es lo que he aprendido de ti:</p><ul class=\"pr-lista\">" + pat.items.slice(0, 4).map(function (x) { return "<li><b>" + esc(x.titulo) + ".</b> " + esc(x.texto) + "</li>"; }).join("") + "</ul>", chips: ["¿Cuánto se me va en gastos hormiga?", "¿En qué gasto más?"] };
    },
    salud: function () {
      PR.ctx = { intent: "salud" };
      var p = puntaje(totalsOf(cur()));
      return { html: "<p>Tu salud financiera de " + esc(monthLabel(state.mes).toLowerCase()) + " es <b>" + p.score + " de 100: " + esc(p.label.toLowerCase()) + "</b>.</p><ul class=\"pr-lista\">" + p.tips.map(function (x) { return "<li>" + x.txt + "</li>"; }).join("") + "</ul>" + prCalc(["35 puntos por tu tasa de ahorro (la meta es 20 %).", "30 por cumplir lo planeado en cada categoría.", "15 por gastar menos de lo que te entra.", "20 por mantener tus cuotas de deuda por debajo del 20 % de tus ingresos."]) + prAviso(), chips: ["¿En qué gasto más?", "¿Cuánto estoy ahorrando?"] };
    }
  };
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function prDiasPer(per) { var r = prRango(per), a = parseD(r[0]), b = parseD(r[1]) || d0(); if (b > d0()) b = d0(); return Math.max(1, diasEntre(a, b) + 1); }
  function prTopCats(per, n, conTotal) {
    var by = {}, total = 0;
    if (per.tipo === "mes" && state.meses[per.k]) { var t = totalsOf(state.meses[per.k]); Object.keys(t.byCat).forEach(function (id) { if (id !== "ahorro" && t.byCat[id].real > 0) { by[id] = t.byCat[id].real; total += by[id]; } }); }
    else prMovs(per, "g").forEach(function (x) { if (x.cat === "ahorro") return; by[x.cat || "otros"] = (by[x.cat || "otros"] || 0) + x.m; total += x.m; });
    var out = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).slice(0, n).map(function (id) { return conTotal ? { id: id, real: by[id] } : id; });
    out.total = total; return out;
  }
  function prPlanCompra(monto, libre) {
    var falta = Math.max(0, monto - Math.max(0, libre)), ah = prAhorroMensual(), gus = totalsOf(cur()).byGroup.gus;
    var h = "<p>Para juntar " + money(falta) + ":</p><ul class=\"pr-lista\">";
    if (gus > 0) { var m1 = Math.max(1, Math.ceil(falta / (gus * 0.15))); h += "<li>Con un 15 % menos en gustos (" + money(Math.round(gus * 0.15 / 1000) * 1000) + " al mes) lo tienes en " + prMeses(m1) + ".</li>"; }
    if (ah > 0) { var m2 = Math.max(1, Math.ceil(falta / (ah * 0.5))); h += "<li>Apartando la mitad de tu ahorro promedio (" + money(Math.round(ah / 2 / 1000) * 1000) + " al mes), en " + prMeses(m2) + ".</li>"; }
    h += "<li>Apartando " + money(Math.ceil(falta / 3 / 1000) * 1000) + " al mes, en 3 meses.</li></ul><p>Un consejo: crea una meta con ese nombre para ver tu avance.</p>";
    PR.ctx = { intent: "alcanza", monto: monto };
    return { html: h, chips: ["¿Cómo creo una meta?", "¿Cuánto puedo gastar hoy?"] };
  }

  // ---------- Preguntas sobre cómo usar la app: respuesta corta + guía ----------
  // ---------- El asesor en Pregúntale: productos, mercado y consejos con los números de la persona ----------
  var PR_NO_PROF = '<p class="pr-nota">Es una guía con tus números, no una asesoría financiera profesional.</p>';
  PR_R.producto = function (q) {
    var p = q.prod, o = canResumen(400).filter(function (x) { return x.k === p.k; })[0], nom = esc(canNombre(p.n));
    PR.ctx = { intent: "gasto", per: null, cat: "alimentacion", com: null };
    var dane = sipsaParrafo(p.n), chipsP = ["¿Dónde compro " + nom.toLowerCase() + "?", "¿Qué es lo que más compro?"];
    if (!o && !dane) return { html: "<p>Todavía no tengo el precio de <b>" + nom.toLowerCase() + "</b> guardado. En <b>¿Dónde compro?</b> te muestro cuánto cuesta hoy en las tiendas en línea y lo que ha pagado la gente.</p>", chips: ["¿Dónde compro " + nom.toLowerCase() + "?", "¿Qué es lo que más compro?"] };
    if (!o) return { html: (dane || "") + "<p>" + (dane ? "Todavía no me has contado compras de <b>" + nom.toLowerCase() + "</b> con su precio. Cuando lo hagas en <b>Cuéntame un gasto</b>, te digo cuánto gastas y dónde te sale más barato." : "Todavía no tengo compras de <b>" + nom.toLowerCase() + "</b> con su precio. Cuando me cuentes tu mercado producto por producto en <b>Cuéntame un gasto</b>, te digo cuánto gastas en eso y dónde te sale más barato.") + "</p>",
      chips: dane ? chipsP : ["¿Qué es lo que más compro?", "¿Cómo puedo ahorrar en el mercado?"] };
    var mes = o.regs.filter(function (r) { return r.f.slice(0, 7) === state.mes; }), u = o.ult;
    var h = "<p>" + (mes.length ? "Este mes llevas <b>" + money(mes.reduce(function (a, r) { return a + r.m; }, 0)) + "</b> en " + nom.toLowerCase() + " (" + plural(mes.length, "compra") + "). " : "") +
      "La última vez, el " + (+u.f.slice(8)) + " de " + MESES[+u.f.slice(5, 7) - 1] + (u.lugar ? " en " + esc(u.lugar) : "") + ", te salió a <b>" + canPrecio(u.pu) + "</b>" + canPorUnidad(u) + ".</p>";
    if (o.lugares.length > 1 && o.lugares[0].pu < o.lugares[o.lugares.length - 1].pu * 0.95)
      h += "<p>Donde te ha salido más barato: <b>" + esc(o.lugares[0].lugar) + "</b>, a " + canPrecio(o.lugares[0].pu) + canPorUnidad(u) + ". En " + esc(o.lugares[o.lugares.length - 1].lugar) + " te ha costado " + canPrecio(o.lugares[o.lugares.length - 1].pu) + ".</p>";
    if (Math.abs(o.cambio) >= 0.05) h += "<p>Desde la primera compra que me contaste, " + (o.cambio > 0 ? "subió" : "bajó") + " un " + pctf(Math.abs(o.cambio)) + ".</p>";
    return { html: h + dane + prCalc(o.regs.slice(-6).reverse().map(function (r) { return (+r.f.slice(8)) + " de " + MESES[+r.f.slice(5, 7) - 1] + (r.lugar ? ", " + esc(r.lugar) : "") + ": " + money(r.m) + (r.cant !== 1 || r.unidad !== "u" ? " (" + canPrecio(r.pu) + canPorUnidad(r) + ")" : ""); })),
      chips: dane ? chipsP : ["¿Qué es lo que más compro?", "¿Cómo puedo ahorrar en el mercado?"] };
  };
  PR_R.productos = function () {
    var l = canResumen(90);
    PR.ctx = { intent: "gasto", per: null, cat: "alimentacion", com: null };
    if (!l.length) return { html: "<p>Todavía no me has contado tu mercado producto por producto. Cuando lo hagas en <b>Cuéntame un gasto</b> (por ejemplo: <b>en el D1 compré leche de 4.500, pan de 3.200 y huevos de 13.000</b>), te digo qué compras más, cómo van los precios y dónde te sale más barato.</p>",
      chips: ["¿Cómo puedo ahorrar en el mercado?", "¿Cuánto gasté en comida este mes?"] };
    var top = l.slice().sort(function (a, b) { return b.total - a.total; }).slice(0, 5);
    var h = "<p>En los últimos 3 meses, en lo que más se te va del mercado:</p><ul class=\"pr-lista\">" + top.map(function (o) { return "<li><b>" + esc(canNombre(o.n)) + "</b>: " + money(o.total) + " (" + plural(o.veces, "compra") + ")</li>"; }).join("") + "</ul>";
    var mov = l.filter(function (o) { return Math.abs(o.cambio) >= 0.05; }).sort(function (a, b) { return Math.abs(b.cambio) - Math.abs(a.cambio); }).slice(0, 3);
    if (mov.length) h += "<p>Cómo van los precios: " + mov.map(function (o) { return esc(canNombre(o.n).toLowerCase()) + " " + (o.cambio > 0 ? "subió" : "bajó") + " " + pctf(Math.abs(o.cambio)); }).join("; ") + ".</p>";
    else if (l.some(function (o) { return o.regs.length > 1; })) h += "<p>Los precios de lo que repites se han mantenido estables.</p>";
    var barato = l.filter(function (o) { return o.lugares.length > 1 && o.lugares[0].pu < o.lugares[o.lugares.length - 1].pu * 0.9; })[0];
    if (barato) h += "<p>Un dato: " + esc(canNombre(barato.n).toLowerCase()) + " te sale más barato en <b>" + esc(barato.lugares[0].lugar) + "</b> que en " + esc(barato.lugares[barato.lugares.length - 1].lugar) + ".</p>";
    return { html: h, chips: ["¿Cómo puedo ahorrar en el mercado?", "¿Cuánto gasté en comida este mes?"] };
  };
  function prConsejoMercado() {
    var t = totalsOf(cur()), c = t.byCat.alimentacion || { plan: 0, real: 0 }, ideas = [], l = canResumen(90), d = new Date(), dias = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    if (c.plan) {
      var esperado = c.plan * d.getDate() / dias;
      ideas.push(c.real <= esperado ? "Vas bien: llevas " + money(c.real) + " en alimentación de " + money(c.plan) + " que planeaste, y el mes va en el día " + d.getDate() + "."
        : "Llevas " + money(c.real) + " en alimentación de " + money(c.plan) + " que planeaste. Para cerrar dentro del plan te quedan " + money(Math.max(0, c.plan - c.real)) + " para el resto del mes.");
    }
    var barato = l.filter(function (o) { return o.lugares.length > 1 && o.lugares[0].pu < o.lugares[o.lugares.length - 1].pu * 0.9; }).sort(function (a, b) { return b.total - a.total; })[0];
    if (barato) ideas.push(canNombre(barato.n) + " te sale más barato en " + barato.lugares[0].lugar + " (" + canPrecio(barato.lugares[0].pu) + ") que en " + barato.lugares[barato.lugares.length - 1].lugar + " (" + canPrecio(barato.lugares[barato.lugares.length - 1].pu) + ").");
    var top = l.slice().sort(function (a, b) { return b.total - a.total; })[0];
    if (top && top.total > 0) ideas.push("Donde más se te va es en " + canNombre(top.n).toLowerCase() + ": " + money(top.total) + " en 3 meses. Comprarlo en presentación grande o en promoción es donde más se nota.");
    var chicas = state.movs.filter(function (m) { return m.t === "g" && m.cat === "alimentacion" && m.f && m.f.slice(0, 7) === state.mes && m.m < 15000; });
    if (chicas.length >= 8) ideas.push("Este mes hiciste " + chicas.length + " compras pequeñas de comida que suman " + money(chicas.reduce(function (a, m) { return a + m.m; }, 0)) + ". Una compra grande con lista a la semana suele salir más barata que muchas sueltas.");
    ideas.push("Haz la lista mirando la nevera y la despensa antes de salir: lo que no está en la lista casi siempre sobra.");
    ideas.push("Las marcas propias de los supermercados y las frutas y verduras de la plaza o el fruver suelen costar menos.");
    return { html: "<p>Ideas para que el mercado rinda más:</p><ul class=\"pr-lista\">" + ideas.slice(0, 4).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
      (l.length ? "" : '<p class="pr-nota">Si me cuentas tu mercado producto por producto, te digo dónde te sale más barato cada cosa.</p>'), chips: ["¿Qué es lo que más compro?", "¿Cuánto gasté en comida este mes?"] };
  }
  function prConsejoCredito() {
    var t = totalsOf(cur()), ing = t.ingReal || t.ingPlan, cuotas = state.deudas.filter(function (x) { return x.saldo > 0; }).reduce(function (a, x) { return a + (x.cuota || 0); }, 0);
    if (!ing) return { html: "<p>Para decirte si un crédito te conviene necesito saber cuánto te entra al mes. Anota tus ingresos en <b>Tu presupuesto</b> y te respondo con tus números.</p>", chips: ["¿Cuánto debo?"] };
    var r = cuotas / ing, libre = Math.max(0, ing * 0.3 - cuotas), h = "<p>Hoy tus cuotas son <b>" + money(cuotas) + "</b> al mes, el " + pctf(r) + " de lo que te entra.</p>";
    h += r >= 0.3 ? "<p>Ya pasas del 30 %, que es el límite cómodo. Mejor no sumar deudas nuevas por ahora: primero abona a la más cara o pídele al banco mejor tasa o más plazo.</p>"
      : r >= 0.2 ? "<p>Estás cerca del límite cómodo del 30 %. Si lo necesitas, que la cuota nueva no pase de <b>" + money(redondeoMil(libre)) + "</b>.</p>"
      : "<p>Tienes espacio. Para quedarte por debajo del 30 %, la cuota nueva no debería pasar de <b>" + money(redondeoMil(libre)) + "</b> al mes.</p>";
    h += "<p>Antes de firmar, compara la tasa efectiva anual (E. A.) y el costo total, no solo la cuota. Si es para algo que pierde valor, ahorrar primero casi siempre sale más barato.</p>";
    return { html: h + PR_NO_PROF + prCalc(["Ingresos del mes: " + money(ing), "Cuotas de tus deudas: " + money(cuotas), "Límite cómodo (30 %): " + money(ing * 0.3)]), chips: ["¿Qué pago primero?", "¿Cuánto debo?"] };
  }
  function prConsejoAhorro() {
    var t = totalsOf(cur()), ing = t.ingReal || t.ingPlan, nec = t.byGroup.nec || t.gasPlan * 0.5;
    if (!ing) return { html: "<p>Anota tus ingresos en <b>Tu presupuesto</b> y te digo cuánto te conviene ahorrar con tus números. Como regla general, entre el 10 % y el 20 % de lo que entra.</p>", chips: ["¿Cómo puedo ahorrar en el mercado?"] };
    var fondo = state.metas.filter(function (g) { return /emergencia|imprevist|colch/i.test(g.nombre); })[0];
    var h = "<p>Una buena meta es ahorrar entre el 10 % y el 20 % de lo que entra: con tus ingresos son entre <b>" + money(redondeoMil(ing * 0.1)) + "</b> y <b>" + money(redondeoMil(ing * 0.2)) + "</b> al mes. Este mes vas en " + money(t.ahorro) + " (" + pctf(t.ahorro / ing) + ").</p>";
    h += fondo ? "<p>Tu colchón para imprevistos va en " + money(fondo.ahorrado) + " de " + money(fondo.objetivo) + ". Mientras lo completas, que sea lo primero que apartas.</p>"
      : "<p>Lo primero: un colchón para imprevistos de unos <b>" + money(redondeoMil(nec * 3)) + "</b> (tres meses de tus gastos necesarios). Después, tus metas.</p>";
    h += "<p>Si empiezas con poco, sube un 1 % cada mes: casi no se siente y en un año el cambio es grande.</p>";
    return { html: h + PR_NO_PROF, chips: ["¿Cuándo llego a mi meta?", "¿Cómo puedo ahorrar en el mercado?"] };
  }
  PR_R.consejo = function (q) {
    var t = q.texto;
    if (/mercado|supermercado|comida|alimentacion|la tienda/.test(t)) return prConsejoMercado();
    if (/credito|prestamo|endeud|financiar|a cuotas/.test(t)) return prConsejoCredito();
    if (/cuanto (deberia|debo|tengo que|me toca) ahorrar|cuanto ahorrar|cuanto ahorro al mes/.test(t)) return prConsejoAhorro();
    var a = analizarMes(), recs = (a.recs || []).slice(0, 3);
    PR.ctx = null;
    return { html: "<p>" + (a.vacio ? "Con unos días de movimientos te doy ideas con tus números. Por ahora:" : "Con tus números de este mes, esto es lo que más te sirve:") + "</p><ul class=\"pr-lista\">" +
      recs.map(function (r) { return "<li><b>" + esc(r.titulo) + ".</b> " + esc(r.texto) + "</li>"; }).join("") + "</ul>",
      chips: ["¿Cómo puedo ahorrar en el mercado?", "¿Cuánto debería ahorrar al mes?", "¿Cómo cierro el mes?"] };
  };
  var PR_COMO = [
    [/(registr|anot|agreg|apunt|meter|poner).{0,20}(gasto|ingreso|compra|plata)|como (registro|anoto)\b/, "registrar", "Toca el botón <b>Registrar</b> (el +), escribe el valor y elige en qué fue. Toma 5 segundos."],
    [/(conect|vincul|enlaz|sincroniz).{0,20}(banco|nequi|daviplata|bancolombia|cuenta)|avisos? automatic|lectura automatic|solos? los gastos/, "bancos", "En <b>Conectar bancos</b> eliges cómo te llegan los avisos de tu banco: en Android se leen solos y en iPhone o el computador, por correo. Nunca pedimos tus claves."],
    [/extracto|(importar|subir|cargar).{0,20}(movimientos|excel|csv|archivo)/, "extracto", "En el menú, <b>Importar extracto</b>: subes el Excel o CSV de movimientos que descargas de tu banco y los ordeno por mes y categoría."],
    [/\bnotas?\b/, "notas", "En Inicio, en <b>Notas del mes</b>: eliges si es logro, alerta, recordatorio o idea, la escribes y listo. Las más importantes salen arriba."],
    [/\bmetas?\b/, "metas", "En la sección <b>Metas</b> creas una meta con nombre, valor y fecha, y le vas sumando lo que ahorras."],
    [/\bdeudas?\b|\bcredito/, "metas", "En <b>Metas</b>, en \"Plan para salir de deudas\", agregas cada deuda con su saldo, tasa y cuota, y te digo cuál pagar primero."],
    [/recordatorio|cuentas? por pagar|vencimiento|avis.{0,15}pago|pago.{0,15}avis/, "pagos", "En <b>Cuentas</b>, en \"Cuentas por pagar\", agregas el arriendo, los servicios o las cuotas con su día, y te aviso antes de que venzan."],
    [/excel|descarg|exportar|copiar/, "excel", "En el menú de los tres puntos tienes <b>Descargar Excel</b> y <b>Copiar para Excel</b>."],
    [/categori|(nuevo|otro|siguiente|cambiar de?) mes|presupuesto|planead|plan del mes/, "presupuesto", "En <b>Movimientos</b> están tus ingresos y gastos del mes con lo planeado y lo real. Con <b>+ Nuevo mes</b> arrancas el siguiente con la misma lista."],
    [/premium|cuanto cuesta la app|pagar la app|codigo de regalo/, "premium", "Toca la estrella de <b>Premium</b>: ahí ves qué incluye, el precio de pago único y, si te regalaron un código, dónde activarlo."],
    [/\bcuenta\b|nube|otro (dispositivo|celular|computador)|respaldo|iniciar sesion|entrar con/, "cuenta", "Crea tu <b>cuenta</b> con tu correo para guardar tu presupuesto cifrado en la nube y abrirlo en otros dispositivos."],
    [/preguntar|preguntas|asistente|hablar contigo/, "preguntas", "Escríbeme tu pregunta aquí abajo, como se la harías a una persona. Te respondo con tus números."]
  ];
  function prComo(t) {
    if (!/^(como|donde|puedo|se puede|quiero|necesito|ayudame a|en donde|que hago para)\b/.test(t) && !/\b(como|donde) (se |puedo |hago |lo |la )/.test(t)) return null;
    if (/^como (voy|va|van|vamos|cierro|termino|estoy|estan|esta mi|ando|salgo|me va|gasto menos|ahorro mas|hago para que)\b/.test(t)) return null;
    for (var i = 0; i < PR_COMO.length; i++) if (PR_COMO[i][0].test(t)) return { guia: PR_COMO[i][1], html: "<p>" + PR_COMO[i][2] + "</p>" };
    if (/privacidad|seguro|mis datos|quien (ve|puede ver)/.test(t)) return { html: "<p>Tus cifras son privadas: se guardan en tu dispositivo y, si creas cuenta, cifradas en la nube. Ni siquiera nosotros podemos verlas. Estas respuestas se calculan aquí mismo; nada sale de tu dispositivo.</p>" };
    return null;
  }
  function prSobrePrivacidad(t) { return /(es seguro|privacidad|mis datos|quien (ve|puede ver)|me espian|envias? mis datos)/.test(t); }

  // ---------- Entender la pregunta ----------
  var PR_INT = [
    ["saludo", /^(que onda|que hubo|hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que mas|quiubo|q mas)\b/],
    ["gracias", /^(gracias|muchas gracias|mil gracias|listo|ok|vale|perfecto|genial|chevere|super)\b/],
    ["ayuda", /que preguntas (te|le) puedo hacer|como te uso|como (se )?usa(s)? (esto|la app|finti)|(te|le) puedo preguntar|puedo preguntarte|que (puedo|le puedo|te puedo) (preguntar|hacer)(?! para)|que sabes|ayuda|que haces|como funcionas|ejemplos?\b/],
    ["medeben", /me deben|me debe\b|quien(es)? me debe|te deben|lo que me deben|me tienen que pagar|me tiene que pagar|cuanto me falta por cobrar|por cobrar/],
    ["saldos", /cuant[oa] (efectivo|dinero|plata) (me )?(tengo|hay|queda) en (la |mi |el )?(cuenta|banco)|que plata tengo|plata tengo (ahora|hoy)|cuant[oa] (efectivo|dinero|plata) (tengo|hay)\b|cuanta (plata|lana|platica) (tengo|hay)|que saldo tengo|dime mis saldos|cuanto hay en mis cuentas|cuanto (me )?(queda|tengo|hay) en (la |el |mi )?(nequi|daviplata|bancolombia|davivienda|bbva|banco|efectivo|cuenta|ahorros|nu|lulo|movii|dale|tarjeta)\b|cuanta plata tengo|cuanto dinero tengo|cuanta plata hay|mi saldo|\bsaldos?\b|cuanto (tengo|hay) en (?!total)|mis cuentas|plata en (el )?banco|cuanto gaste (con|en) (la |mi |el )?(tarjeta|nequi|daviplata|efectivo)|gaste con (la |mi )?tarjeta/],
    ["mayor", /ha sido mi compra mas|mi compra mas grande|gasto mas (grande|caro|alto)|mayor gasto\b|compra mas (grande|cara)|lo mas caro que|el gasto mas|gaste mas plata de una/],
    ["promedio", /cuanto gasto al dia|gasto al dia|promedio|gasto diario|cuanto gasto (al|por|cada) dia|gasto por dia|al dia gasto/],
    ["quincena", /quincena|como llego (al|a) (15|30|fin|final)|aguanto hasta|hasta el pago|hasta que me paguen|hasta que me pagan|hasta el (proximo )?pago|hasta el 15\b|hasta el 30\b/],
    ["hoy", /(puedo|me puedo) gastar hoy|dispongo hoy|(cuanto|que|cuanta plata) (puedo|me puedo) gastar hoy|cuanto tengo para hoy|gastar hoy|para hoy\b|me puedo gastar hoy|hoy cuanto puedo/],
    ["consejo", /aconsej|consejo|como gasto menos|que me rinda|rinda la plata|ideas para ahorrar|que puedo hacer para (gastar menos|ahorrar)|ayudame a organizar|recomiend|recortar|(?:reducir|bajar|bajarle a|controlar) (?:mis |los )?gastos|(?:en|de) (?:que|donde) (?:puedo|podria) ahorrar|gastar menos|recomendacion|\btips?\b|como (?:puedo |hago (?:para )?|hacer para |podria )?(?:ahorrar|gastar menos|rendir|estirar)|para que me alcance|que me alcance la plata|ayudame a ahorrar|deberia (?:sacar|pedir|tomar|endeudarme|meterme en)|me conviene (?:sacar|pedir|un credito|un prestamo|endeudarme)|cuanto (?:deberia|debo|tengo que|me toca) ahorrar|que hago con (?:mi|la) plata|como manejo (?:mi|la) plata|como organizo (?:mi|la) plata/],
    ["productos", /lo que mas compro|que compro mas|mis productos|productos|(?:subio|sube|ha subido|esta (?:mas )?caro|se ha encarecido) el mercado|precios? del mercado|canasta/],
    ["deudas", /(?:que|cual) (?:pago|deuda pago|debo pagar) primero|pagar primero/],
    ["alcanza", /(?:me puedo dar|darme) un gusto|(?:tengo|hay|me queda) plata para|alcanzo a|alcanza|me da para|tengo para|puedo (comprar|comprarme|pagar|darme|permitirme|gastarme)|deberia comprar|vale la pena comprar|me (compro|doy el gusto)/],
    ["pagos", /(tengo|hay) algo (por|que) pagar|que me toca pagar|me toca pagar|que se me vence|que pagos (vienen|tengo|hay)|cuando (pago|tengo que pagar|hay que pagar|toca pagar) (la|el|los|las)\b|que cuentas tengo por pagar|que (tengo|debo|me falta) (que )?pagar|que pago|vence|vencen|vencimiento|pagos? pendientes?|proximos? pagos?|cuentas? por pagar/],
    ["deudas", /(cuanto|que) (le )?debo\b(?! (pagar|de pagar))|a quien le debo|como salgo de (las |mis )?deudas|deuda|cuanto debo|lo que debo|creditos?|prestamos?|que pago primero|cual pago primero|tarjeta de credito/],
    ["metas", /como van mis metas|\bmetas?\b|cuando (llego|lograre|completo|logro|tendre)|cuanto me falta para/],
    ["cierre", /(me va a|va a|me van a) (sobrar|faltar) (plata|dinero)|al final del mes|voy a (terminar|cerrar|acabar) el mes|como (voy a )?(terminar|acabar|quedar)|quedar en rojo|en rojo\b|termino el mes|como me va a ir|como (voy a )?(cierro|cerrar|termino|acabo)|fin de mes|cierre del mes|llego a fin|alcanzo a fin|como cierr/],
    ["hormiga", /(compras|cosas|gastos|gastico)s? (pequen|chiquit)\w*|(pequenas|pequenos) (compras|cosas|gastos)|de a poquito|chiquitos?|pequenitos?|gusticos|hormiga|gastos? pequenos?|pequenos gastos|antojos|tinto|cafecito/],
    ["habitos", /en que momento (del mes|de la semana|del dia) (gasto|compro)|patron(es)? de gasto|que dias? (de la semana )?(se me va|gasto|compro|me gasto)|que dia (\w+ )?gasto|a que hora|habitos|patrones|cuando gasto mas|que he aprendido|que sabes de mi|me conoces/],
    ["salud", /que tan bien (estoy|voy|ando)|como estoy con (la|mi) plata|como estan mis finanzas|mis finanzas|situacion financiera|como estoy financieramente|salud financiera|puntaje|calificacion|como estoy (financieramente|de plata)|como esta mi plata/],
    ["estado", /^(como voy|voy bien|como vamos|como va (mi|el) mes|como va mi plata|estoy bien|voy mal)\b(?!.*(pasado|anterior|comparad|frente))/],
    ["comparar", /(mas|menos) (o (mas|menos) )?que antes|comparame|mas de lo normal|(peor|mejor) que el mes|estoy gastando (?:mucho|demasiado|bien|poco)|gasto (?:mucho|demasiado)|gastando mucho|comparad|comparar|frente al|versus|\bvs\b|como voy|voy (mejor|peor|bien|mal)|gaste (mas|menos)|gasto mas que|respecto al/],
    ["top", /donde se (me )?(esta yendo|va|fue) (mi |la |el )?(sueldo|plata|dinero|salario)|lo que mas plata me (quita|saca)|botando (la )?plata|en que se me (esta yendo|va|fue) (la plata|el dinero|todo)|se me esta yendo la plata|se lleva la mayor parte|gastos mas grandes|en que me estoy gastando|en que (gasto|gaste|se me va|se va|se fue|me gasto)|donde (se me va|gasto|se va)|mayor(es)? gastos?|mas gasto|que es lo que mas|en que se me fue|en que se fue/],
    ["ingresos", /cuanto me pagan|cuanto (me )?ingreso|cuanto (me )?ingresa|cuanto (me )?(ha entrado|entro|gane|gano|recibi|me pagaron)|cuanto gano|ingresos?|sueldo|salario|lo que me entra/],
    ["ahorro", /ahorr/],
    ["disponible", /que me queda (para|de|del)\b|me sobra|queda libre|me resta|que tanto me queda|cuanto (me queda|tengo disponible|tengo libre|puedo gastar|me sobra)|disponible|me queda (algo|plata)|cuanto tengo/],
    ["gasto", /cuant[oa] (plata )?se (me )?(fue|va|ha ido) en|^gastos? (en|de) |cuanta plata se me (ha ido|fue|va)|plata que se me (fue|ha ido)|cuanto me (ha costado|ha salido|salio|costo)|cuanto pague de|cuanto llevo en|que tanto (?:gasto|gaste|llevo|he gastado)|cuanto (me )?(he )?(gaste|gastado|llevo|va|van|se me ha ido|se me fue|se va|se me va|invierto|pago|pague|cuesta)|gasto en|gastos de|lo que (he )?gastado|lo que gaste|total de gastos|cuanto en\b/]
  ];
  var PR_EJ = ["¿Cuánta plata tengo?", "¿Cuánto me deben?", "¿Cuál fue mi gasto más grande?", "¿Cuánto gasto al día en promedio?", "¿Cuánto me queda hasta la quincena?", "¿Cuánto puedo gastar hoy?", "¿Cuánto gasté en comida este mes?", "¿En qué gasto más?", "¿Cuánto me queda este mes?", "¿Me alcanza para algo de $ 200.000?", "¿Cómo cierro el mes?", "¿Cómo voy frente al mes pasado?",
    "¿Qué tengo que pagar esta semana?", "¿Cuánto debo?", "¿Cuándo llego a mi meta?", "¿Cuánto se me va en gastos hormiga?", "¿Qué día gasto más?", "¿Cuánto estoy ahorrando?", "¿Cómo está mi salud financiera?", "¿Qué me recomiendas?", "¿Cómo puedo ahorrar en el mercado?", "¿Qué es lo que más compro?", "¿Cuánto debería ahorrar al mes?", "¿Cómo conecto mi banco?", "¿Cómo importo el extracto?"];

  // ---------- La pregunta como la escribe la gente ----------
  // Abreviaturas ("q", "ke", "xq", "dbo"), letras repetidas ("cuantoo") y errores de dedo en las palabras de plata
  // ("gsate", "cuamto"): solo se corrige hacia palabras de este vocabulario, y nunca una palabra real del español.
  var PR_ABREV = { q: "que", k: "que", ke: "que", qe: "que", xq: "porque", pq: "porque", porq: "porque", tb: "tambien", tmb: "tambien", d: "de", kuanto: "cuanto", kuanta: "cuanta",
    cuant: "cuanto", cnto: "cuanto", cuamto: "cuanto", cuabto: "cuanto", dbo: "debo", gate: "gaste", plat: "plata", xfa: "por favor", porfa: "por favor", pls: "por favor", hrs: "horas",
    qeda: "queda", keda: "queda", qedan: "quedan", kedan: "quedan", grax: "gracias", grs: "gracias", graxias: "gracias", ola: "hola", holi: "hola", holis: "hola",
    // Sinónimos a una forma común: así las reglas cubren más maneras de decir lo mismo
    billete: "plata", lana: "plata", platica: "plata", diariamente: "al dia", diario: "al dia", resta: "queda", sobra: "queda",
    guardado: "ahorrado", guardada: "ahorrada", guardar: "ahorrar", guarde: "ahorre", facturas: "pagos pendientes", factura: "pago pendiente", recibos: "pagos pendientes",
    ahorita: "ahora", tngo: "tengo", tnemos: "tenemos", gstos: "gastos", gsto: "gasto", dnero: "dinero", plta: "plata" };
  var PR_VOCAB = ("cuanto cuanta cuantos cuantas gaste gastado gastos gasto gastar gastando debo deuda deudas plata dinero queda quedan pagar pagos tengo puedo "
    + "recomiendas recomienda consejo semana quincena metas saldo saldos ingresos ahorro ahorrar ahorrado comida mercado transporte cuentas pendientes promedio "
    + "hormiga comparar presupuesto disponible arriendo servicios").split(" ");
  function prArreglarPregunta(t) {
    var w = t.split(" ");
    return w.map(function (x, i) {
      if (PR_ABREV[x]) return PR_ABREV[x];
      if (/^h?olaa+$|^holaa+$/.test(x)) return "hola";
      if ((x === "usar" || x === "usarme") && /plata|dinero/.test(t)) return "gastar";
      if (x === "pata" && /^(cuanta|la|mi|de|sin|mucha|poca|tengo)$/.test(w[i - 1] || "")) return "plata";
      var y = x.replace(/([a-z])\1{2,}/g, "$1");
      if (/[aeiou]{2}$/.test(y) && y[y.length - 1] === y[y.length - 2] && PR_VOCAB.indexOf(y.slice(0, -1)) > -1) y = y.slice(0, -1);   // "cuantoo"
      if (y.length < 5 || PR_VOCAB.indexOf(y) > -1 || /\d/.test(y)) return y;
      if (typeof CH_REALES === "string" && (CH_REALES.indexOf(" " + y + " ") > -1 || CH_COMUNES.indexOf(" " + y + " ") > -1)) return y;
      var max = y.length >= 8 ? 2 : 1, mejor = "", dmin = max + 1, empate = false;
      PR_VOCAB.forEach(function (v) {
        if (v[0] !== y[0]) return;
        // En palabras cortas no se cambia una letra por otra ("salgo" no es "saldo", "gusto" no es "gasto"): solo letras
        // cruzadas ("gsate") o una de más o de menos ("gastoo", "cunto")
        if (y.length <= 6 && v.length === y.length && y.split("").sort().join("") !== v.split("").sort().join("")) return;
        var d = chDistancia(y, v, max); if (d < dmin) { dmin = d; mejor = v; empate = false; } else if (d === dmin && v !== mejor) empate = true;
      });
      return mejor && !empate && dmin <= max ? mejor : y;
    }).join(" ");
  }
  // Respaldo cuando ninguna regla calza: la pregunta se compara con ejemplos de cada intención (palabras en común,
  // pesando más las raras). Solo responde si el parecido es alto y la pregunta habla de plata; si no, "no entendí".
  var PR_BANCO = {
    saldos: ["cuanta plata tengo en mis cuentas", "que saldo tengo", "cuanto dinero hay en el banco"],
    disponible: ["cuanto me queda del presupuesto", "cuanto puedo gastar este mes", "cuanto tengo libre para gastar"],
    hoy: ["cuanto puedo gastar hoy", "cuanto me toca para hoy"],
    quincena: ["me alcanza hasta la quincena", "cuanto me queda hasta el dia de pago"],
    gasto: ["cuanto gaste en comida", "cuanto he gastado este mes", "cuanto se me fue en transporte", "cuanto pague de arriendo", "cuanto me cuesta el mercado"],
    top: ["en que se me va la plata", "cuales son mis mayores gastos", "que se lleva mi dinero"],
    mayor: ["cual fue mi compra mas grande", "el gasto mas caro"],
    promedio: ["cuanto gasto por dia en promedio"],
    hormiga: ["cuanto se me va en gastos pequenos", "los antojos y gastos hormiga"],
    habitos: ["que dia de la semana gasto mas", "mis costumbres de gasto"],
    comparar: ["gaste mas que el mes pasado", "comparar este mes con el anterior", "estoy gastando mas de la cuenta"],
    cierre: ["como voy a cerrar el mes", "me va a sobrar o faltar plata a fin de mes"],
    salud: ["como esta mi salud financiera", "que tan sanas estan mis finanzas"],
    ingresos: ["cuanto dinero me ha entrado", "cuanto gano al mes", "cuanto recibi de sueldo"],
    ahorro: ["cuanto he ahorrado", "cuanto estoy guardando de plata"],
    metas: ["cuanto me falta para mi meta", "cuando completo mi meta de ahorro"],
    alcanza: ["me alcanza para comprar algo", "puedo darme un gusto"],
    pagos: ["que pagos tengo pendientes", "que cuentas se vencen pronto", "que me toca pagar"],
    deudas: ["cuanto debo en total", "cuales son mis deudas", "que credito pago primero"],
    medeben: ["cuanto me deben", "quien me debe plata"],
    consejo: ["que me recomiendas para ahorrar", "como gasto menos plata", "dame un consejo para mi plata"],
    productos: ["que es lo que mas compro", "como estan los precios del mercado"]
  };
  var PR_DE_PLATA = /\b(plata|dinero|lana|billete|platica|gast|pag|deb|deud|ahorr|cuant|saldo|ingres|sueld|meta|presupuest|compr|cuest|cost|vale|precio|quincena|mes|cuenta|credito|prestamo|finanz|rinda|alcanz)/;
  var PR_BANCO_IDX = null;
  function prRaiz(w) { w = w.replace(/(es|s)$/, ""); return w.slice(0, 5); }
  function prRaices(t) { return prPalabras(t).map(prRaiz).filter(function (x, i, l) { return x.length >= 3 && l.indexOf(x) === i; }); }
  function prParecido(t) {
    if (!PR_DE_PLATA.test(t)) return null;
    if (!PR_BANCO_IDX) {
      PR_BANCO_IDX = { ej: [], df: {} };
      Object.keys(PR_BANCO).forEach(function (it) { PR_BANCO[it].forEach(function (e) { var r = prRaices(e); PR_BANCO_IDX.ej.push({ it: it, r: r }); r.forEach(function (x) { PR_BANCO_IDX.df[x] = (PR_BANCO_IDX.df[x] || 0) + 1; }); }); });
    }
    var n = PR_BANCO_IDX.ej.length, q = prRaices(t); if (!q.length) return null;
    var peso = function (x) { return Math.log(1 + n / (PR_BANCO_IDX.df[x] || 0.5)); };
    var mejor = null, segundo = 0;
    PR_BANCO_IDX.ej.forEach(function (e) {
      var com = 0, tq = 0, te = 0;
      q.forEach(function (x) { tq += peso(x); if (e.r.indexOf(x) > -1) com += peso(x); });
      e.r.forEach(function (x) { te += peso(x); });
      var s = com / Math.sqrt(tq * te || 1);
      if (!mejor || s > mejor.s) { if (mejor && mejor.it !== e.it) segundo = Math.max(segundo, mejor.s); mejor = { it: e.it, s: s }; }
      else if (e.it !== mejor.it) segundo = Math.max(segundo, s);
    });
    return mejor && mejor.s >= 0.45 && mejor.s - segundo >= 0.08 ? mejor.it : null;
  }

  // Clasificador entrenado (herramientas/entrenar-preguntale.mjs): bayesiano ingenuo con palabras, raíces y pares de
  // palabras, entrenado con miles de formas de decir cada pregunta y una clase "fuera" (lo que no es de plata).
  // Corre aquí mismo, sin servidor. Se usa cuando ninguna regla entiende; las reglas siguen mandando porque son exactas.
  var PR_MODELO = null, PR_VACIAS = {};
  "a al el la los las lo un una unos unas de del y o en con por para mi mis tu tus su sus me te se le que es ya pues porfa favor oye finti parce dime ey mira".split(" ").forEach(function (w) { PR_VACIAS[w] = 1; });
  function prRasgos(t) {
    var w = nrm(t).replace(/[¿?¡!.,;:()"]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(function (x) { return x && !PR_VACIAS[x]; }), out = {};
    w.forEach(function (x, i) { out["w:" + x] = 1; if (x.length >= 5) out["s:" + x.slice(0, 4)] = 1; if (i > 0) out["b:" + w[i - 1] + "_" + x] = 1; });
    return Object.keys(out);
  }
  function prClasificar(t) {
    if (PR_MODELO === null) { try { PR_MODELO = JSON.parse(document.getElementById("pr-modelo").textContent); } catch (e) { PR_MODELO = false; } }
    if (!PR_MODELO) return null;
    var m = PR_MODELO, rs = prRasgos(t).filter(function (r) { return m.rasgos[r]; }); if (!rs.length) return null;
    var N = 0, c, punt = []; for (c in m.clases) N += m.clases[c];
    for (c in m.clases) { var s = Math.log(m.clases[c] / N); rs.forEach(function (r) { s += Math.log(((m.rasgos[r][c] || 0) + 0.5) / (m.totales[c] + 0.5 * m.n)); }); punt.push([c, s]); }
    punt.sort(function (a, b) { return b[1] - a[1]; });
    var z = 0; punt.forEach(function (x) { z += Math.exp(x[1] - punt[0][1]); });
    return { clase: punt[0][0], p: 1 / z, conocidos: rs.length };
  }
  var PR_UMBRAL = 0.6;

  function prEntender(texto) {
    texto = chPrevio(texto);
    var t = prArreglarPregunta(prNorm(texto)), q = { texto: t, per: prPeriodo(t), cat: "", com: null, monto: prMonto(nrm(texto).replace(/[¿?¡!]/g, " ")) };
    q.com = prComercio(t); q.cat = q.com ? "" : prCat(t);
    // 1. Lo que estábamos esperando
    var esp = PR.espera; PR.espera = null;
    if (esp && esp.tipo === "si") {
      if (/^(si|sii|claro|dale|de una|hagale|ok|bueno|por favor|calculalo)\b/.test(t)) return { fn: esp.accion };
      if (/^(no|nop|nel|despues|ahora no)\b/.test(t)) return { fn: function () { return { html: "<p>Listo. ¿Te ayudo con algo más?</p>", chips: ["¿Cuánto me queda este mes?", "¿En qué gasto más?"] }; } };
    }
    if (esp && esp.tipo === "monto" && q.monto) return { intent: esp.intent, q: q };
    if (/^(si|sii|claro|dale|ok|okey|bueno|no|nop|ya)$/.test(t)) return { fn: function () { return { html: "<p>¡Listo! ¿Qué más quieres revisar?</p>", chips: ["¿Cómo cierro el mes?", "¿En qué gasto más?", "¿Qué puedo preguntarte?"] }; } };
    var como = prComo(t); if (como) return { fn: function () { PR.ctx = null; return { html: como.html, guia: como.guia, chips: como.guia ? [] : ["¿Qué puedo preguntarte?"] }; } };
    if (prSobrePrivacidad(t)) return { fn: function () { return prComo("como privacidad") || { html: "<p>Tus cifras son privadas: se guardan en tu dispositivo y, si creas cuenta, cifradas. Estas respuestas se calculan aquí mismo; nada sale de tu dispositivo.</p>" }; } };
    // "¿Dónde compro papa?" (el botón de la respuesta) abre la pantalla ¿Dónde compro? con ese producto
    if (/^donde (compro|consigo|puedo comprar)\b/.test(t) && !/barat/.test(t)) {
      var dq = t.replace(/^donde (compro|consigo|puedo comprar)\s*/, "").replace(/^(el|la|los|las|un|una) /, "").trim();
      return { fn: function () { setTimeout(function () { closeDlg("dlg-preguntas"); abrirDonde(dq ? canNombre(dq) : ""); }, 450); return { html: "<p>Te abro <b>¿Dónde compro?</b>" + (dq ? " con " + esc(dq) : "") + ": ahí ves lo que has pagado tú y cómo va el precio en el país.</p>" }; } };
    }
    // 2. Un producto: "¿cuánto gasté en leche?", "¿dónde compro más barato el arroz?"
    if (/(?:^| )(cuanto|cuantos|sale|salen|cuesta|cuestan|vale|valen|precio|barat|caro|cara|a como|donde|gaste|gasto|gastado|compro|compre|llevo|como esta|como estan|subiendo|bajando|subio|bajo el|bajo la)/.test(t) && !/consejo|recomiend|ahorrar en/.test(t)) {
      var prod = prProducto(t) || sipsaProducto(t); if (prod) { q.prod = prod; return { intent: "producto", q: q }; }
      // "¿A cómo está la papa?", "¿cuánto vale el jabón Rey?": aunque no haya compras ni precios guardados de ese producto
      var pm = /^(?:a como (?:esta|estan)|cuanto (?:vale|valen|cuesta|cuestan)|precio (?:de|del)|que precio tiene)\s+(?:el |la |los |las |un |una )?([a-zñ][a-zñ ]{2,30})$/.exec(t);
      if (pm && !/\b(mes|semana|hoy|ano|arriendo|vida)\b/.test(pm[1])) { q.prod = { k: canClave(pm[1]), n: pm[1].trim(), dane: true }; return { intent: "producto", q: q }; }
    }
    // 3. La intención
    for (var i = 0; i < PR_INT.length; i++) if (PR_INT[i][1].test(t)) {
      var it = PR_INT[i][0];
      // "recomiéndame una película": una recomendación que no es de plata no se responde con un consejo de plata
      if (it === "consejo" && /recomiend\w* (un|una|unos|unas|algun|alguna) /.test(t) && !PR_DE_PLATA.test(t.replace(/recomiend\w*/, ""))) continue;
      // "¿voy a terminar el mes con saldo positivo?" es sobre cómo cierra el mes, no sobre los saldos de hoy
      if (it === "saldos" && /(terminar|cerrar|acabar|fin de|final de) (el )?mes/.test(t)) continue;
      // "¿voy bien con el ahorro?": si se nombra un tema, manda el tema y no el "cómo voy" general
      if ((it === "estado" || it === "comparar") && /^(como |)voy (bien|mal|mejor|peor)? ?(con|en) (el |la |mi |mis |los |las )?(ahorr|meta|deud|credito)/.test(t)) continue;
      if ((it === "saludo" || it === "gracias") && t.split(" ").length > 4) continue;
      return { intent: it, q: q };
    }
    // 3. Un seguimiento: "¿y en transporte?", "¿y el mes pasado?", "¿y en Rappi?"
    if (PR.ctx && (q.cat || q.com || q.per || q.monto) && t.split(" ").length <= 7) {
      var c = PR.ctx, nq = { texto: t, per: q.per || c.per, cat: q.com ? "" : (q.cat || (q.per ? c.cat : "")), com: q.com || (q.cat ? null : (q.per ? c.com : null)), monto: q.monto || c.monto };
      var sigue = (q.cat || q.com) ? (["gasto", "comparar", "disponible"].indexOf(c.intent) > -1 ? c.intent : "gasto")
        : q.monto ? (c.intent === "alcanza" ? "alcanza" : "gasto") : (["gasto", "top", "ingresos"].indexOf(c.intent) > -1 ? c.intent : "gasto");
      if (sigue === "disponible" && q.com) sigue = "gasto";
      return { intent: sigue, q: nq };
    }
    // 4. Solo una categoría o un comercio: se entiende como "¿cuánto gasté en…?"
    if ((q.cat || q.com) && t.split(" ").length <= 4) return { intent: "gasto", q: q };
    if (q.monto && /comprar|compra|gastar|celular|tenis|viaje|regalo|televisor|computador|ropa/.test(t)) return { intent: "alcanza", q: q };
    var cl = prClasificar(t);
    if (cl && cl.clase === "fuera" && cl.p >= 0.5) return { intent: "", q: q, fuera: true };
    // Un saludo, unas gracias o una pregunta de ayuda son frases cortas: "traduce hola al inglés" no es un saludo
    if (cl && /^(saludo|gracias|ayuda)$/.test(cl.clase) && t.split(" ").length > 3) cl = null;
    if (cl && cl.clase !== "fuera" && cl.p >= PR_UMBRAL && PR_R[cl.clase]) return { intent: cl.clase, q: q, modelo: cl.p };
    var par = prParecido(t); if (par) return { intent: par, q: q, parecido: true };
    return { intent: "", q: q };
  }
  function prParecidas(t) {
    var ws = prPalabras(t);
    return PR_EJ.map(function (e) { var we = prPalabras(e); return { e: e, s: ws.filter(function (w) { return we.some(function (x) { return x === w || (w.length > 4 && x.indexOf(w.slice(0, 5)) === 0); }); }).length }; })
      .filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 3).map(function (x) { return x.e; });
  }
  function prResponder(texto) {
    var r = prEntender(texto), out;
    PR.ultIntent = r.intent || ""; PR.ultCat = (r.q && r.q.cat) || "";
    try {
      if (r.fn) out = r.fn();
      else if (r.intent && PR_R[r.intent]) out = PR_R[r.intent](r.q);
      else {
        var par = prParecidas(texto);
        out = { noEntendi: texto, html: "<p>Mmm, esa no la entendí del todo. " + (par.length ? "¿Quisiste preguntar alguna de estas?" : "Todavía estoy aprendiendo: pregúntame sobre tus gastos, lo que te queda, tus pagos, tus deudas o tus metas.") + "</p>",
          chips: par.length ? par : ["¿Qué puedo preguntarte?", "¿Cuánto me queda este mes?", "¿En qué gasto más?"] };
      }
    } catch (e) {
      out = { html: "<p>Algo falló al calcular esa respuesta. Intenta preguntarlo de otra forma.</p>", chips: ["¿Qué puedo preguntarte?"] };
      reportarError("preguntas: " + (e && e.message), e && e.stack, "preguntas");
    }
    return out;
  }

  // ---------- La conversación ----------
  var PR_AVATAR = '<span class="pr-avatar" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M10 23V9h11M10 16h8"/><circle cx="23" cy="21" r="2.6"/></svg></span>';
  function prBurbuja(html, quien) {
    var d = document.createElement("div");
    d.className = "pr-msg " + quien;
    d.innerHTML = html;
    // Finti habla con su marca al lado; la persona, en azul
    if (quien === "app") { var f = document.createElement("div"); f.className = "pr-fila"; f.innerHTML = PR_AVATAR; f.appendChild(d); $("pr-log").appendChild(f); }
    else $("pr-log").appendChild(d);
    return d;
  }
  // Primeras sugerencias como tarjetas con su ficha; después de la primera pregunta vuelven a ser botones pequeños
  var PR_INICIO = [["¿Cuánto puedo gastar hoy?", "cafe", "#2E5BFF"], ["¿En qué gasto más?", "compras", "#8a5cf6"], ["¿Qué tengo que pagar?", "servicios", "#e08a00"], ["¿Cuánta plata tengo?", "ahorro", "#1f9d6a"]];
  function prBienvenida() {
    var box = $("pr-chips"); box.classList.add("bienvenida");
    box.innerHTML = PR_INICIO.map(function (x) { return '<button type="button" class="pr-chip pr-tarjeta">' + ficha(x[1], x[2]) + "<span>" + esc(x[0]) + "</span></button>"; }).join("");
  }
  // La primera frase de la respuesta va arriba, grande, con sus cifras resaltadas. El resto queda en frases completas.
  function prConCifra(html) {
    var m = /^<p>([\s\S]*?)<\/p>/.exec(html); if (!m) return html;
    // Las cifras de la primera frase se resaltan (las que no venían en negrilla)
    var frase = m[1].split(/(<[^>]+>)/).map(function (x, i, a) { return x.charAt(0) === "<" || /<b[ >]/.test(a[i - 1] || "") ? x : x.replace(/\$\s?\d[\d.]*(?:,\d+)?(?: millones)?/g, function (v) { return '<b class="pr-num">' + v + "</b>"; }); }).join("");
    frase = frase.replace(/<b>(\$\s?\d[\d.]*(?:,\d+)?(?: millones)?)<\/b>/g, '<b class="pr-num">$1</b>');
    return '<p class="pr-voz">' + frase + "</p>" + html.slice(m[0].length);
  }
  function prChips(lista, guia) {
    var box = $("pr-chips"); box.classList.remove("bienvenida");
    box.innerHTML = (guia ? '<button type="button" class="pr-chip guia" data-guia="' + esc(guia) + '">Ver la guía paso a paso</button>' : "") +
      (lista || []).slice(0, 4).map(function (c) { return '<button type="button" class="pr-chip">' + esc(c) + "</button>"; }).join("");
  }
  function prDesplazar() { var l = $("pr-log"); l.scrollTop = l.scrollHeight; }
  function prPreguntar(texto) {
    texto = String(texto || "").trim().slice(0, 200);
    if (!texto || PR.ocupado) return;
    prBurbuja(esc(texto), "yo");
    $("pr-input").value = ""; prChips([]);
    PR.ocupado = true;
    var p = prBurbuja('<span class="pr-pensando" role="img" aria-label="Pensando"><i></i><i></i><i></i></span>', "app");
    prDesplazar();
    setTimeout(function () {
      var r = prResponder(texto);
      p.innerHTML = prConCifra(r.html); prChips(r.chips, r.guia);
      if (r.noEntendi) { PR.noEntendi = r.noEntendi; $("pr-chips").insertAdjacentHTML("beforeend", '<button type="button" class="pr-chip" data-no-entendi>Guardar la pregunta para que Finti aprenda</button>'); }
      PR.ocupado = false; prDesplazar();
      metrica("pregunta", "dia");
    }, reduceMotion ? 0 : 450);
  }
  function abrirPreguntas(texto) {
    $("menu-mas").hidden = true;
    if (!$("pr-log").children.length) {
      prBurbuja("<p>¡Hola! Soy Finti. Pregúntame lo que quieras de tu plata y te respondo con tus números, sin rodeos.</p>", "app");
      prBienvenida();
    }
    openDlg("dlg-preguntas", "#pr-input");
    sipsaCargar(); genteCargar();   // precios públicos del DANE y de la gente para responder "¿cómo está la papa?" (no envía nada tuyo)
    if (texto) prPreguntar(texto);
  }
  $("pr-form").addEventListener("submit", function (e) { e.preventDefault(); prPreguntar($("pr-input").value); });
  $("pr-chips").addEventListener("click", function (e) {
    var b = e.target.closest(".pr-chip"); if (!b) return;
    if (b.classList.contains("pr-tarjeta")) { prPreguntar(b.querySelector("span:last-child").textContent); return; }
    if (b.hasAttribute("data-no-entendi")) { noEntendiGuardar(PR.noEntendi, "pregunta"); b.remove(); prBurbuja("<p>Listo, la guardé en tu teléfono para aprender a responderla. Puedes verla en <b>Palabras que aprendí</b>.</p>", "app"); prDesplazar(); return; }
    if (b.dataset.guia) { closeDlg("dlg-preguntas"); iniciarGuia(b.dataset.guia); return; }
    prPreguntar(b.textContent);
  });
  $("pr-limpiar").addEventListener("click", function () { $("pr-log").innerHTML = ""; PR.ctx = null; PR.espera = null; abrirPreguntas(); });
  $("preg-ini-form").addEventListener("submit", function (e) { e.preventDefault(); var v = $("preg-ini").value; $("preg-ini").value = ""; abrirPreguntas(v.trim()); });
  $("preg-ej").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) abrirPreguntas(b.textContent); });
  $("btn-preguntas-menu").addEventListener("click", function () { abrirPreguntas(); });
  $("hoy-preguntar").addEventListener("click", function () { abrirPreguntas(); });
  // ===================== Cuéntame un gasto: registro conversado, escrito o dicho =====================
  // Entiende frases como "18 mil en almuerzo", "pagué un taxi de doce mil" o "me pagaron 50 mil". Todo se interpreta
  // aquí. La voz solo se usa si se reconoce dentro del dispositivo: en la app de Android (reconocimiento del teléfono)
  // o en un navegador que tenga el español descargado (processLocally). Nunca se manda audio a un servidor.
  var CH = null, CH_ULT = null;
  var CH_NUM = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
    dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
    veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100,
    doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
    setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900 };
  // "veinte mil" → "20000"; "dos millones quinientos mil" → "2500000". Un "un" suelto ("un taxi") no se toca.
  function chNumeros(t) {
    var w = t.split(" "), out = [], i = 0;
    while (i < w.length) {
      var j = i, total = 0, cur = 0, usado = false, mult = false;
      while (j < w.length) {
        var x = w[j];
        if (CH_NUM[x] != null) { cur += CH_NUM[x]; usado = true; }
        else if (/^\d{1,3}$/.test(x) && j === i && /^mil$/.test(w[j + 1] || "")) { cur += +x; usado = true; }
        else if (/^\d{1,3}$/.test(x) && mult && cur === 0 && j > i) { cur += +x; }
        else if (/^mil$/.test(x) && usado) { total += (cur || 1) * 1000; cur = 0; mult = true; }
        else if (/^mil$/.test(x) && !usado && j === i && !/^[\d.,]+$/.test(out[out.length - 1] || "")) { total += 1000; usado = true; mult = true; }
        else if (/^millon(es)?$/.test(x) && usado) { total = (total + (cur || 1)) * 1e6; cur = 0; mult = true; }
        else if (x === "y" && usado && j + 1 < w.length && CH_NUM[w[j + 1]] != null) { /* treinta y cinco */ }
        else break;
        j++;
      }
      var solo = j - i === 1 && /^(un|uno|una)$/.test(w[i]);
      if (usado && !solo && (mult || j - i > 1 || CH_NUM[w[i]] > 1)) { out.push(String(total + cur)); i = j; }
      else { out.push(w[i]); i++; }
    }
    return out.join(" ");
  }
  // Vocabulario para reconocer la categoría en lo que la persona escribe o dice. En minúsculas y sin tildes; cada palabra
  // vale también en plural (empanada → empanadas). Gana la coincidencia más larga ("recarga tullave" le gana a "recarga").
  var CH_VOCAB = {
    alimentacion: "mercado|supermercado|tienda|tienda de barrio|minimercado|fruver|plaza de mercado|galeria|carniceria|panaderia|pescaderia|famia|"
      + "d1|ara|exito|carulla|olimpica|jumbo|makro|pricesmart|isimo|oxxo|justo y bueno|surtimax|super inter|euro supermercado|zapatoca|colsubsidio mercado|"
      + "comida|almuerzo|corrientazo|ejecutivo|menu del dia|desayuno|cena|onces|merienda|lonchera|almorce|almorzamos|desayune|desayunamos|cene|cenamos|comi|comimos|"
      + "tinto|cafe|aromatica|pan|pan de bono|pandebono|almojabana|bunuelo|arepa|empanada|pastel de pollo|tamal|lechona|"
      + "huevo|leche|queso|cuajada|mantequilla|yogurt|kumis|avena|cereal|arroz|frijol|lenteja|garbanzo|pasta|espagueti|"
      + "platano|yuca|mazorca|tomate|cebolla|ajo|verdura|fruta|banano|manzana|naranja|mango|aguacate|limon|guayaba|mora|"
      + "pollo|carne|res|cerdo|chicharron|chorizo|salchicha|jamon|atun|sardina|pescado|mojarra|"
      + "aceite|azucar|panela|sal|harina|chocolate|cafe molido|galleta|mecato|papitas|chitos|chocolatina|dulce|bon bon bum|"
      + "gaseosa|jugo|botella de agua|agua en botella|bolsa de agua|refresco|pony malta|malta|"
      + "detergente|jabon|jabon en polvo|papel higienico|limpido|blanqueador|suavizante|lavaloza|esponja|bolsas de basura|aseo",
    transporte: "transporte|bus|buseta|colectivo|taxi|uber|didi|indrive|indriver|cabify|picap|mototaxi|bicitaxi|"
      + "transmilenio|sitp|metro|metroplus|metrocable|mio cali|megabus|transcaribe|metrolinea|tullave|tu llave|civica|recarga tullave|recarga civica|"
      + "pasaje|tiquete|tiquete de bus|terminal|intermunicipal|vuelo|tiquete aereo|avion|avianca|latam|wingo|jetsmart|"
      + "gasolina|tanqueada|tanquear|acpm|diesel|gas vehicular|terpel|primax|biomax|texaco|peaje|parqueadero|parqueo|"
      + "lavada del carro|lavadero|mecanico|taller del carro|cambio de aceite|aceite del carro|aceite de la moto|llanta|repuesto|bateria del carro|"
      + "soat|tecnomecanica|revision tecnomecanica|multa|comparendo|fotomulta|impuesto vehicular|licencia de conduccion|"
      + "carro|moto|bicicleta|patineta|scooter|gasolinera",
    servicios: "servicios|servicios publicos|recibo|factura de luz|recibo de luz|luz|energia|recibo del agua|factura del agua|acueducto|alcantarillado|"
      + "gas|recibo del gas|pipeta|internet|wifi|celular|plan del celular|plan de datos|datos|minutos|recarga|recarga del celular|telefono|"
      + "television|cable|directv|claro|movistar|tigo|wom|etb|une|enel|codensa|epm|vanti|emcali|air-e|afinia|celsia|triple a|recibo del aseo",
    vivienda: "arriendo|alquiler|administracion|cuota de administracion|predial|impuesto predial|hipoteca|cuota de la casa|casa|apartamento|"
      + "reparacion|arreglo de la casa|plomero|electricista|cerrajero|pintura|ferreteria|homecenter|easy|"
      + "mueble|colchon|cortina|sabana|cobija|almohada|decoracion|olla|vajilla|electrodomestico|nevera|lavadora|estufa|licuadora|"
      + "empleada|empleada domestica|senora del aseo|aseo de la casa|mudanza|trasteo",
    salud: "salud|medicina|medicamento|pastilla|remedio|drogueria|farmacia|farmatodo|cruz verde|la rebaja|locatel|"
      + "cita medica|consulta|medico|doctor|especialista|odontologo|dentista|ortodoncia|examen|laboratorio|terapia|psicologo|fisioterapia|"
      + "vacuna|gafas|lentes|optometra|optica|copago|cuota moderadora|eps|prepagada|urgencias|hospital|clinica|"
      + "acetaminofen|dolex|ibuprofeno|vitamina|curita|tapabocas|alcohol antiseptico",
    educacion: "educacion|colegio|pension del colegio|matricula|universidad|semestre|curso|clase|diplomado|tutoria|refuerzo|"
      + "libro|cuaderno|utiles|utiles escolares|uniforme|lapiz|fotocopia|impresion|ruta escolar|jardin infantil|"
      + "platzi|udemy|coursera|ingles|idiomas|icetex|sena",
    deudas: "deuda|cuota|cuota de la tarjeta|tarjeta|tarjeta de credito|credito|prestamo|abono a la deuda|intereses|cuota de manejo|"
      + "addi|sistecredito|gota a gota|fiado|fiado de la tienda|pagar el fiado|libranza|leasing|cuota del carro|cuota de la moto",
    ocio: "salida|rumba|fiesta|bar|discoteca|cerveza|pola|chela|aguardiente|guaro|ron|whisky|trago|coctel|vino tinto|botella de vino|"
      + "cine|boleta|entrada|concierto|partido|estadio|teatro|museo|bolos|billar|tejo|karaoke|parque de diversiones|"
      + "paseo|viaje|hotel|hostal|airbnb|finca|piscina|playa|"
      + "restaurante|asadero|pizzeria|pizza|hamburguesa|perro caliente|salchipapa|picada|sushi|comida rapida|alitas|"
      + "domicilio|rappi|ifood|frisby|kfc|mcdonalds|el corral|crepes|juan valdez|tostao|starbucks|oma|presto|"
      + "helado|postre|torta|cumpleanos|loteria|chance|baloto|apuesta|betplay|wplay|rushbet|juego|videojuego",
    compras: "compras|ropa|camisa|camiseta|blusa|pantalon|jean|short|falda|vestido|chaqueta|buzo|saco|ropa interior|medias|"
      + "zapatos|tenis|sandalias|chanclas|bolso|morral|maleta|billetera|reloj|accesorio|gafas de sol|"
      + "perfume|maquillaje|crema|shampoo|champu|desodorante|cuchilla|cepillo de dientes|crema dental|toallas higienicas|"
      + "peluqueria|barberia|corte de pelo|manicure|pedicure|unas acrilicas|arreglo de unas|cejas|depilacion|spa|"
      + "audifonos|cargador|cable usb|computador|portatil|tablet|celular nuevo|forro del celular|juguete|regalo|detalle|flores|"
      + "falabella|mercado libre|amazon|temu|shein|aliexpress|zara|koaj|arturo calle|tennis|alkosto|ktronix|dollarcity|miniso|panamericana",
    suscripciones: "suscripcion|membresia|netflix|spotify|disney|max|hbo|prime video|amazon prime|youtube premium|apple music|icloud|google one|"
      + "chatgpt|claude|deezer|crunchyroll|paramount|vix|star plus|game pass|playstation plus|canva|duolingo|"
      + "gimnasio|gym|smart fit|bodytech|mensualidad del gimnasio",
    ahorro: "ahorro|ahorrar|ahorre|ahorramos|guarde para|cdt|alcancia|inversion|bolsillo|colchon de nequi|fondo de emergencia|cripto|acciones|pension voluntaria",
    otros: "otros|propina|donacion|limosna|diezmo|ofrenda|iglesia|vaca|notaria|tramite|pasaporte|cedula|"
      + "mascota|perro|gato|veterinario|vacuna del perro|vacuna del gato|vacuna de la mascota|cita del perro|cita del gato|veterinaria|concentrado|arena para gato|lavanderia|envio|mensajeria|servientrega|interrapidisimo|"
      + "giro|comision|cuatro por mil|4x1000|impuesto|dian|imprevisto"
  };
  var CH_LISTA = null;
  function chRx(t) { return new RegExp("(?:^| )" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:e?s)?(?= |$)"); }
  function chLista() {
    if (CH_LISTA) return CH_LISTA;
    CH_LISTA = [];
    Object.keys(CH_VOCAB).forEach(function (cat) { CH_VOCAB[cat].split("|").forEach(function (t) { t = prNorm(t); if (t) CH_LISTA.push([t, cat, null]); }); });
    return CH_LISTA;
  }
  // La coincidencia más larga entre los pares [palabra, categoría]; las aprendidas de la persona se miran primero.
  function chBuscar(t, pares) {
    var mejor = null;
    pares.forEach(function (p) {
      if (mejor && p[0].length <= mejor[0].length) return;
      if (!p[2]) p[2] = chRx(p[0]);
      if (p[2].test(t)) mejor = p;
    });
    return mejor;
  }
  function chAprendidas() {
    return Object.keys(state.reglas).filter(function (k) { return k.length >= 3 && catById(state.reglas[k]); }).map(function (k) { return [prNorm(k), state.reglas[k], null]; });
  }
  function chCategoria(t) {
    var a = chBuscar(t, chAprendidas()); if (a) return { cat: a[1], por: "aprendida" };
    var v = chBuscar(t, chLista()); if (v) return { cat: v[1], por: "vocabulario" };
    var l = LECTOR.sugerirCategoria({ comercio: t, tipo: "gasto" }, {}); if (l.por === "lista") return { cat: l.cat, por: "comercio" };
    var p = prCat(t); return p ? { cat: p, por: "nombre" } : { cat: "", por: "" };
  }
  var CH_RELLENO = " toco pagar solte bote clavaron tumbaron gastamos pagamos fueron salieron cobraron barras barra gaste gastaste pague pagaste compre compraste me te le pagaron pago recibi llego llegaron dieron consignaron en de del un una uno unos unas el la los las lo por para con y pesos peso mil millon millones lucas luca palos palo k cop cash hoy fue costo vale valio salio que mas mi mis su sus tu tus al a pedi meti di deje puse saque fui hice es era eran ";
  var CH_DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  var CH_MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var CH_DIAS_C = ["dom.", "lun.", "mar.", "miér.", "jue.", "vie.", "sáb."];

  // --- Cuándo fue: hoy, ayer, antier, hace 3 días, el sábado, el 10, el 10 de noviembre. Nunca en el futuro ni hace más de 60 días. ---
  function chFecha(t) {
    var hoy = d0(), m, d = null;
    if ((m = /(?:^| )(antier|anteayer|antes de ayer|antier en la noche)(?= |$)/.exec(t))) d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 2);
    else if ((m = /(?:^| )(ayer(?: en la (?:manana|tarde|noche))?)(?= |$)/.exec(t))) d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
    else if ((m = /(?:^| )hace (\d{1,2}) dias?(?= |$)/.exec(t))) { var n = Math.min(60, +m[1]); d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - n); }
    else if ((m = /(?:^| )(?:el |este |el pasado )?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)( pasado)?(?= |$)/.exec(t))) {
      var dif = (hoy.getDay() - CH_DIAS.indexOf(m[1]) + 7) % 7; if (dif === 0 && m[2]) dif = 7;
      d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dif);
    }
    else if ((m = /(?:^| )el (?:dia )?(\d{1,2})(?: de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))?(?= |$)(?! (?:mil|lucas?|k|millon|millones|pesos|palos?)\b)/.exec(t))) {
      var dia = +m[1], mes = m[2] ? CH_MESES.indexOf(m[2]) : hoy.getMonth(), anio = hoy.getFullYear();
      if (dia >= 1 && dia <= 31) {
        d = new Date(anio, mes, dia);
        if (d > hoy) d = m[2] ? new Date(anio - 1, mes, dia) : new Date(anio, mes - 1, dia);
      }
    }
    else if ((m = /(?:^| )(hoy|esta manana|esta tarde|esta noche)(?= |$)/.exec(t))) d = hoy;
    if (!d || (hoy - d) / 864e5 > 60) return null;
    return { f: hoyStr(d), txt: m[0] };
  }
  function chFechaTxt(f) {
    if (!f || f === hoyStr()) return "";
    var hoy = d0(), d = new Date(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10)), dif = Math.round((hoy - d) / 864e5);
    if (dif === 1) return "ayer";
    if (dif === 2) return "antier";
    return CH_DIAS_C[d.getDay()] + " " + d.getDate() + " " + MESES_C[d.getMonth()];
  }

  // --- Con qué pagó: "con Nequi", "por Daviplata", "con la tarjeta", "en efectivo". Gana el nombre de una cuenta propia. ---
  var CH_TIPO_PAL = { nequi: "nequi", daviplata: "daviplata|davi plata", tarjeta: "tarjeta|tarjeta de credito|la de credito|credito|visa|mastercard|master",
    banco: "debito|tarjeta debito|tarjeta de debito|la cuenta|cuenta|cuenta de ahorros|banco|transferencia|bancolombia|davivienda|bbva|banco de bogota|pse", efectivo: "efectivo|cash|billete|billetes" };
  function chCuentaDe(t) {
    var mejor = null;
    function probar(pal, id) {
      // "de" y "en" solo para billeteras: "la cuota de la tarjeta" no dice con qué se pagó.
      var pre = /^(efectivo|cash)$/.test(pal) ? "(?:^| )(?:(?:en|con|de|por|y)(?: el| mi)? )?"
        : /^(nequi|daviplata|davi plata)$/.test(pal) ? "(?:^| )(?:con|por|desde|usando|via|en|de|del)(?: la| el| mi| mis)? "
        : "(?:^| )(?:con|por|desde|usando|via)(?: la| el| mi| mis| una| un)? ";
      var re = new RegExp(pre + pal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?= |$)"), m = re.exec(t);
      if (m && (!mejor || pal.length > mejor.pal.length)) mejor = { id: id, pal: pal, txt: m[0] };
    }
    state.cuentas.forEach(function (c) {
      var n = prNorm(c.nombre); if (n.length >= 3) probar(n, c.id);
      (CH_TIPO_PAL[c.tipo] || "").split("|").forEach(function (p) { if (p) probar(p, c.id); });
    });
    // Sin cuenta de ese tipo todavía: igual se entiende "en efectivo"
    if (!mejor && /(?:^| )(?:en )?efectivo(?= |$)/.test(t)) { var e = cuentaEfectivo(false); if (e) mejor = { id: e.id, txt: /(?:^| )(?:en )?efectivo(?= |$)/.exec(t)[0] }; }
    return mejor;
  }

  // --- Compartido: "la mitad es de Juan", "entre tres con Ana y Luis", "dividido entre 2" ---
  var CH_NO_NOMBRE = /^(es|era|la|el|los|las|mi|mis|ellos|ellas|nosotros|otro|otra|otros|todos|pagar|paga|pone|debe|toca)$/;
  var CH_NUM_TXT = { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8 };
  function chCompartido(t) {
    var m, partes = 0, quien = "";
    if ((m = /(?:^| )(?:y )?(?:la )?mitad(?: (?:es|era|le toca a|la pone|la paga|me la debe|la debe|lo pone|lo paga))?(?: de)?(?: ([a-z]+(?: y [a-z]+)?))?(?= |$)/.exec(t))) { partes = 2; quien = m[1] || ""; }
    else if ((m = /(?:^| )(?:dividido |partido |a medias )?entre (\d|dos|tres|cuatro|cinco|seis|siete|ocho)(?: personas)?(?: con ([a-z]+(?: y [a-z]+)?))?(?= |$)/.exec(t))) { partes = CH_NUM_TXT[m[1]] || +m[1]; quien = m[2] || ""; }
    else if ((m = /(?:^| )a medias con ([a-z]+(?: y [a-z]+)?)(?= |$)/.exec(t))) { partes = 2; quien = m[1]; }
    if (!partes || partes < 2 || partes > 12) return null;
    quien = quien.split(" y ").filter(function (x) { return x && !CH_NO_NOMBRE.test(x); }).join(" y ");
    return { partes: partes, quien: quien, txt: m[0] };
  }
  // Recupera el nombre como se escribió ("juan" → "Juan", "angela" → "Ángela")
  function chNombre(norm, original) {
    if (!norm) return "";
    var pal = String(original || "").split(/[\s,.;]+/);
    return norm.split(" y ").map(function (w) {
      var o = pal.find(function (p) { return nrm(p) === w; }) || w;
      return o.charAt(0).toUpperCase() + o.slice(1);
    }).join(" y ");
  }

  // ===================== Antes de leer: la frase como la dice la gente =====================
  // Arregla lo que el dictado y el afán dejan en la frase antes de entenderla: "18 000" (con espacio), "d uno",
  // "un millón doscientos", "2 palos y medio", "taxi de 12" (12 mil) y errores de escritura en palabras conocidas
  // ("almuerso", "drogeria", "olimpca"). Solo corrige si hay una única palabra conocida muy parecida.
  var CH_UNIDAD_NUM = "un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\\d+";
  var CH_CIENTOS = "cien|ciento|doscientos|doscientas|trescientos|trescientas|cuatrocientos|cuatrocientas|quinientos|quinientas|seiscientos|seiscientas|setecientos|setecientas|ochocientos|ochocientas|novecientos|novecientas";
  // Cosas que de verdad cuestan menos de mil pesos: con ellas, "de 500" son quinientos pesos
  var CH_BARATOS = /\b(pan|panes|pancito|tinto|tintos|dulce|dulces|chicle|chicles|bombon|bombones|confite|confites|huevo|huevos|bolsa|bolsas|fotocopias?|copias?|minutos?|aromatica|galleta|galletas|unidad|c\/u|cada uno|cada una)\b/;
  var CH_DECENAS = "diez|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa";
  var CH_COMUNES = " estaba estuve estuvimos fuimos tenia tengo tiene tenemos habia hicimos hacer hecho hago compre compro compramos compraste comprar pague pagamos pagaste pagar gaste gastamos gastaste gastar llevo lleve llevamos llevaba cogimos coger cogi salio salieron salimos sali cobraron cobro costo costaron valio vale valen quedo quedaron quedamos queda dieron dimos devolvieron devolvio vueltas cambio total todos todas todo cuanto cuantos cuanta donde cuando porque pues entonces despues luego tambien ademas mitad medio media billete billetes efectivo tarjeta credito debito nequi daviplata cuenta ahorros banco plata pesos lucas barras palos millon millones semana manana tarde noche ahora antes ayer antier mismo misma otra otro otros otras cosas algo nada mucho mucha poco poca menos mejor peor bueno buena grande pequeno unidad unidades kilos kilo libra libras gramos litro litros paquete paquete bolsa bolsas docena docenas caja cajas pedazo porcion "
    + " esposa esposo novia novio mama papa hijo hija hermana hermano amigo amiga amigos vecino abuela abuelo senora senor familia ";
  // Palabras reales del español que se parecen a una del vocabulario ("tanto" y "tinto"): esas nunca se corrigen.
  // Se generan con herramientas/palabras-reales.cjs a partir de la lista an-array-of-spanish-words (licencia MIT, Zeke Sikelianos).
  var CH_REALES = " abano abazon abino abitas abobo aboco abofo abogo abona abondo abone aborro aboyo abozo acarones accesiones accesoria accesorias accionad accionais accionan accionar accionares accionas accionase accionases accione accioneis accionemos accionen acechones acecines aceita aceitare aceitase aceiteis aceiten aceitera aceitero aceito aceitones acemite acemites acena acepa acepciones acepte acerte acetite acetites achiotes acion aciones acirones acojones acorro acorros acraticas acrebite acredite acribias acrilica acrilico acrilicos acriminas acronicas actinicas acuesta acuite acullicas acusones administrarian administraron aducar aerea afeite afilia afina afinaria afinca afinidad afonia afono aforrar aforro aforros agitas aguacales aguacatal aguacateca aguacatera aguacatero aguacaton aguachare aguachase aguachaste aguadare aguadase aguadaste aguarape aguatare aguatase aguataste aguazare aguazase aguazaste ahitas ahorcar ahorcara ahorcare ahorco ahormar ahormara ahormare ahormo ahornar ahornara ahornare ahorno ahorra ahorraba ahorrad ahorrada ahorrado ahorrador ahorrados ahorrais ahorramos ahorran ahorrara ahorraran ahorraras ahorrare ahorraren ahorraria ahorraron ahorras ahorrase ahorre ahorreis ahorremos ahorres ahorrosa ahorrosas ahorroso ahorrosos airee aireo ajena ajorrar ajorro alabancia alacenas alasitas alauitas albitas albohol alborada alcaceles alcacenas alcaceres alcaidia alcairia alcaldia alcanceis alcancen alcances alcanciazo alcandia alcandial alcandias alcaneria alcantarilla alcantarillaba alcantarillad alcantarillada alcantarilladas alcantarillais alcantarillamos alcantarillan alcantarillando alcantarillar alcantarillara alcantarillare alcantarillaron alcantarillas alcantarillase alcantarillero alcantarillo alcarcil alcarria alcatenes alcaucil alcaucis alcistas alcofol alcohela alcohola alcoholad alcoholan alcoholar alcoholas alcohole alcoholen alcoholo aleonada aletas algueros alhacenas alhorro aliacanes alias alicantos alicas alicatas alienacion alientas alientes alientos alifas aligas alijas alimenta alimentad alimentados alimentais alimental alimentamos alimentan alimentar alimentarian alimentario alimentarios alimentaron alimentas alimentase alimente alimenteis alimentemos alimenten alimentes alimenticio alimenticios alimento alimentosa alimentosas alimentoso alimentosos alinas alipatas alisas alistais alistas alistase alitan alitanes almacena almacenad almacenais almacenajes almacenan almacenar almacenares almacenas almacenase almacenases almacene almaceneis almacenemos almacenen almacenera almaceneras almacenero almaceneros almaceno almacenos almadees almadenas almahala almancebes almarada almenada almogama almohace almohadada almohadado almohadazo almohade almohades almohadon almohaza almohazad almohazada almohazan almohazar almohazas almohazo almojama almojaya almoneda almorzada almotacenes almozada almozadas almozala almudada almudero almuderos almuerce almuerces almuerza almuerzan almuerzas almuezas alojaban alombada alotas alquicel alquicer alquilad alquilan alquilar alquilara alquilare alquilas alquile alquileis alquilen alquiles alquilon alquilos altas amaron amazona amazonas amazonia amazonio amena amono amorrar amorro anion antisemitico antiseptica antisepticas antitetico apale aparamento aparcamiento apareamiento apartamiento apartamientos apele apena apesta apile apitas apole aporrar apresta aprestad aprestan aprestar aprestas apuestan apueste apuesten apuestes apuesto apuestos aquesta arana ardiendo ardiondo areca arela arenad arenal arenan arenar arenca arene arenga areno arienzos armazon aromaria aromatice aromaticen aromatices aromatico aromaticos aromatiza aromatizad aromatizan aromatizar aromatizas aromatizo arraz arreados arreando arrebolo arreciendo arredilo arregazo arregla arreglad arreglado arreglan arreglar arreglas arregle arreglen arregles arreglin arrendas arrendes arrendo arreo arriados arriando arrianos arribado arribando arribeno arribenos arridado arridados arridando arriedro arriemos arrienda arriendan arriendas arriende arrienden arriendes arrieros arriesgo arrigido arrigiendo arrimado arrimados arrimando arritado arritados arritando arrizado arrizados arrizando arroaz arruando artero arturico aruna asadera asaderas asalmero asarero asareros aseladero asidero asideros asmadera asmadero asono aspadera atadero atono atroz aturo audifono audiofono audiofonos aureo avenad avenan avenar avene avenga aveni avenia aveno aventa averna aveza avian avien avilanta avino avionica avios avison azocar azorrar azorro azucara azucarad azucaran azucarar azucaras azucare azucaren azucari azucaris azucaro azular azuzar babearia bacano bacteria bacterias bailoteo bajearia bajura balano balearia baleria balerias balito ballar balos balota balotado balote balsa balsas balseria balso balto bambearia banado banan banana banando bananero bancando banderia banezano bangano banganos baniano banianos barano barateria barbareria barbaria barbarian barbarias barbarica barbarie barbariza barbeaba barbeada barbeais barbeara barbearia barbearian barbearias barbecha barbeeis barbera barberas barberil barberol barberos bardaria bario baroto barraria barrearia barreo barreria barrerian barrerias barri barria barrido barridos barrigon barril barrillo barrimos barriosa barrioso barrisco barrito barritos barro basara bases bastaria bastearia basterna basural basurea basuread basurean basurear basureas basurera batano batearia batearian batearias batera baterista batiria batirian batirias bausa bayano beses biliar bilitera billa billarda billas billetada billetea billeteaba billetead billeteada billetean billetear billeteara billetearan billetearas billeteare billetearia billeteas billetee billeteen billetees billeteo billetero billeteros billetes bilmar birlar bises blandeador blanquead blanqueada blanqueadas blanqueado blanqueadora blanqueadoras blanqueados blanqueadura blanqueamos blanqueando blanquear blanquearon blanquecedor bloqueador bobos bofeta bofos bojos bolas boldo boldos bolea boleas boleo boleos bolera boles boletaba boletad boletada boletado boletais boletan boletar boletara boletare boletase bolete boletea boletead boletean boletear boleteas boletera boletina boleto bolillo bolillos bolis bolisa bolisas bolita bolla bollar bollas bollo bollos bolon bolsadas bolsea bolseais bolseas bolsease bolseo bolseras bolson bolsor bombillo boneta bordillo boros botellazo botellera botellin botellita botellon boteria botilla botillas botos bozos brillar buces buena bufes bujes bujeta bules bulos bunuelero bureta buretas busera buseras busietes cabale cabio cablea cablee cableo cabre cabrilla cabro cachador cacle cadireta caible cajas calase calcador calce calchon caldense calente caliendo calienta calientan calientas calienten caliento calimote calla callador callante callea callee callen calleo callo calmante calme calpense calva calve calzador camareta cambia cambiado cambiazo cambie cambin cambista cambizo cambizos cambo cambrico camias camina caminata caminera camio camioneta camirena camiseada camisera camiseras camiseria camisero camisola camisote camita campista canda candente canea caneceria canga cangador cangados cania canoa cansa canta cantador capeador capillo captador caralla carallas caramulla carao cardador cardadora cardados carde cardo careador careados careceria caree carene careo carero cargadal cargadas cargadera cargadero cargado cargadora cargadoras cargados cargamos cargando cargaron cargazon cargo cariados carie carilla carillas carine cario cariseto carlo carme carnea carnee carneo carnicera carniceras carnicero carniceros carpe carpidor carpo carra carral carrao carricera carricerin carroceria carron cartilla casineta casinete casulla casullas cateador catolice catonice catorcena catorceno cauro causador ceajas cebas cebollada cebollana cebollar cebollera cebolleta cebollon cebolluda cecas cedas cedro cedulaba cedulad cedulada cedulado cedulais cedulaje cedulan cedular cedulara cedulare cedulase cedule cedulo cegas cejad cejais cejan cejar cejase cejes cejos celas celase celia cellar celosia celosias celula celulada celulado celularia celulario celulas cemas cendro cenero centauro centen centenar centolla centra centrado centre centrico cenuro cenutrio cepas cepellon cepilla cepillad cepillado cepillan cepillar cepillas cepille cepillen cepilles ceras cercenas cerceras cercetas cercillo cerco cerda cerdeo cerdon cerea cereas cerebral cereo cereza cerezal cerezas cerillo cerillos cerio cerita cermenas cernadero cerne cernejas cerneras cerno cerolla cerollas cerradera cerradero cerraderos cerrajea cerrajead cerrajeado cerrajean cerrajear cerrajeara cerrajeare cerrajearon cerrajeas cerrajee cerrajeen cerrajees cerrajeo cerrajeria cerrateno cerrenas cerreras cerretas cerrillo cerro certeras certeza certezas cerval cervecea cerveceas cervinas cervunas cesas cetro chabolas chace chacharon chala chalalas chalchas challe chamelas champa champe champo champuda champudo champuz chanadas chanca chancabas chancacas chancadas chancais chancaras chancare chancas chancase chancea chancead chanceais chancean chancear chanceas chancease chancee chanceen chanceo chancera chanceras chancero chanchas chanchis chanchos chancla chancletas chanclos chanco chancomas chancome chanconas chancros chane chanelad chanelais chanelan chanelar chanelas chanelase chaneles chanflas chanfleas chanfles changles changuas chanquete chante chapelas chapolas chaquena chaquenas chaqueno chaquete chaquetea chaquetead chaquetean chaquetear chaqueteas chaquetee chaqueteo chaquetera chaquetes chaqueton chaquira charchas charleta charnelas charneta charolas charquea charquetal charro chasquea chasquera chatos chauchas chavalas chavolas checa chele cheli chelo chepa chepes chequera chera chesa cheta chetos chicarro chicarron chicarrona chicarros chicharo chicharos chicharra chicharrad chicharran chicharrar chicharraron chicharras chicharre chicharrea chicharrean chicharree chicharreen chicharren chicharreo chicharres chicharrina chicharro chicharrona chicharronas chicharronea chicharronee chicharroneo chicharros chichearon chichurro chichurros chicos chidos chimos chincharon chinchas chinelas chinglas chinitos chinolas chinos chintos chiquita chirizo chirizos chistosa chistoso chitamos chitas chitemos chites chito chiton chitones chivatos chivos chocharon choclare choclase choclaste chocolatada chocolatera chocolatero chocolatin chocolatines chola chonelas choriceo choriza chorizad chorizado chorizan chorizar chorizas chorlito chota chotas chotos chucharon chula chunchas chupitos chutos ciase cibica cijas cinica cirro civico claco clame clamo clara clareo claror clave clavo clema clero cliente clinico clinicos clise clitica cliticas clonica clonicas cloro clota clotas coactivo coarte cobijaba cobijad cobijada cobijado cobijais cobijan cobijar cobijara cobijare cobijase cobije cobijena cobijera cobijo cocida cocidas codeinas codena codenas codesera coeducacion cogida cogidas cohesion coimeras coimputado coimputados coite coitos cojas colacion colase colativo colchan colcharon colchen colcho colectado colecticio colectiva colectivas colectivero colectivizo colegi colegia colegiad colegiado colegial colegian colegiar colegias colegid colegida colegido colegidos colegie colegien colegies colegimos colegir colegira colegire colegis colerico colerizo coligio colija colindas colision colisiona colisione colisiono colmadas colmaras colochon colochona colochos colusion comalida comalidas comandas comarcal comarcas combadas combaras combinas comedias comedida comedidas comensal comentador comeras comercia comerciaba comerciable comerciad comerciado comerciais comercian comerciar comerciara comerciare comercias comerciase comercie comercien comercies comercio comercios comerian comerias cometida cometidas comia comias comica comicas comicial comicios comidais comidamos comidan comide comidera comideras comides comido comidos comienda comiendas comieras comieron comiliton comillas comineas comisa comisada comisadas comisais comisaron comisas comisase comiscan comiscas comisiona comisionad comisionan comisionar comisionas comisione comisionen comisiono comistion comiza comizas comoda comodas compadrando compadras compadreado compadreando companas compango comparad comparado comparador comparais comparan comparando comparar comparas comparase comparecido comparecio comparen comparente compares comparezco comparsa comparsas compartas compartido compartiendo compas compasando compasas compaseado compaseando compasion compelas compensa competas competidor compilador compilas compitas complida comportas compotas compra compraba comprabas comprad comprada compradas comprado comprador comprados comprais compramos compran comprando comprar comprara compraras comprare comprares comprase comprasen compraste compredas compreis comprenda comprende comprendi comprendio comprendo compreras compres compresa compresas comprimas comprobas computad computada computadas computado computadora computadoras computados computamos computando computar computaron computas comunion concento concentra concentraba concentrad concentrada concentradas concentrador concentradora concentrais concentramos concentran concentrando concentrar concentrara concentrare concentraron concentras concentrase concentrico concentro concepteado concepto conceptuado concerta concertado concerte concerto conchero concierna concierne concierta conciertan conciertas concierte concierten conciertes concision concreto concuerdo conculca condenas condensa condensad condensan condensar condensas condense condenso condicion conducian conducta conectiva conectivo conectivos confaccion confeccion confiero confutador conjuncion conjunta conminas conmistion conmutador conreina consiento consiervo consista constata consuela consuelda consuena consueta consuetas consueto consular consules consulesa consultaba consultad consultada consultado consultais consultan consultar consultara consultare consultase consulte consulten consultes consultiva consulto consultor consultora consumia consuncion consunta consuntas consunto conte contentado contina continua conveccion convectivo conviccion convidas convierta convierte convierto convulsa cooperas coordina copado copano copazo copiadas copras copulador coracina corajina coral coralina corbe cordal coree corete corita corle cornal corolina corporal corra corralon corran corras corre correal correctivo correera corridas corriera corro corroera corrosal corse corseara corso corsos corta corten cortical cortinada cortinado cortinaje cortinal cortinon cortisona corto corulla corval corve corvidas corvina corvinas cosechon cosida cosidas cosija cosmicas coste costina costinas cotas cotral creces crecidos crecimos credo credula credulos crees creia cremad creman cremar creme cremes cremo crepe crepitas crepites crepito creps cresa creta creticos cretinos crinitos cripta criptico cripton cristo croma cuaderna cuadernal cuadernas cuadrada cuadro cuajaba cuajaban cuajabas cuajad cuajadera cuajado cuajados cuajadura cuajando cuajara cuajaran cuajaras cuajaria cuarcita cuartada cuartero cuarto cuata cuatas cuaterna cuaterno cuaternos cuatreno cuatrero cubija cubijada cucharilla cuchillada cuchillar cuchillazo cuchillo cuchillos cuclillas cuclillo cuela cuerdo cugujada cuita cuitas cujas culantro culle culta cultas cumplamos cumpleaneros cumpliamos cuotea cuoteais cuoteas cuotease cuprosos curasaos curco curcos curdo curdos curia curio curios curiosos curos curro curros cursa cursados cursamos cursas curse cursemos cursera curses cursi cursis cursor cursores curta curtas curte curtia curto curtos curvo curvos cusita custro cutas dados dallar damos danos dantos datas dateos dates dauda daudas debda debelacion declaracion decoccion decoloracion decolorante decorarian decoraron decusacion dedicacion deferente deflacion deformacion delacion delantal deluda deludais deludas deludias demuda demudais demudas demudase denotacion denta dentad dentar dentas dentaste dentelle dentudas denuda denudais denudas denudase denuesta depilarian depilaron deportacion depuracion derivacion derogacion derogas desabono desabonos desadoraste desaduano desafino desahumo desajunto desalacion desalino desalinos desamuro desanudo desapunto desareno desarenos desatino desatinos desatufo desavino desayuda desayudas desayude desayudes desayudo desayuna desayunad desayunado desayunados desayunais desayunamos desayunan desayunar desayunas desayunase desayune desayuneis desayunemos desayunen desayunes desazono desda desdas desdoraste desmalle desnudas desodorizante desolacion desopilacion despista destable destalla destalle destallen destalles destallo destelle destilacion desuda desudais desudas desudase desurdas desvista detal detall detalla detallad detallan detallar detallare detallas detallase detalleis detallen detallo detergen detergere detergiste detonacion deudo deudoras deudos devantal develacion deviacion dezmo dialogado diantres diapentes dicentes dicientes dientas diente dienten dientones diese diesen dieses dietes diezma diezmado diezme diezmero digresiones dimensiones diplomaba diplomad diplomada diplomadas diplomais diplomamos diploman diplomando diplomar diplomara diplomare diplomaron diplomas diplomase dipsomano directa directas directe directiva directivo directo director directos discentes disensiones disentis disertes disientes dislocado disnea dispersiones diversion divisiones doblar docto doctora doctorad doctoral doctoran doctorar doctoras doctore doctoren doctoro doctos dogas dolar doled doler doles domesticaba domesticad domesticada domesticado domesticais domestican domesticar domesticara domesticare domesticase domestico domesticos domicilia domiciliad domiciliado domiciliados domiciliais domiciliamos domicilian domiciliar domicilias domiciliase domicilie domicilieis domiciliemos domicilien domicilies dominacion domotica donadios donarian dotacion dotor dragas droga drogabas drogad drogadas drogados drogais drogamos drogan drogar drogaras drogares drogaria drogase drogasen drogaste drogatas drogotas drogueis droguera drogueras droguero drogueros ductor dudas edito educacional educarian educaron educcion ejecutado ejecutiva ejecutivas elquina emanada emanadas embajada embalada embatada embazada embonada embreada emergeria emergia emito empacaba empacada empacadas empacado empacara empachada empajaba empajada empajadas empajado empajara empalaba empalada empaladas empalado empalaga empalara empalmada empanaba empanaban empanabas empanad empanado empanados empanadura empanais empanando empanara empanaran empanaras empanare empanaria empanase empanda empandaba empandad empandada empandadas empandado empandan empandar empandara empandas empaneta empanetada empanica empanicada empaniza empanizada empantana empanzaba empanzado empanzara empapaba empapada empapadas empapado empapara emparama empardada empareda emparrada emparvada empastada empataba empatada empatadas empatado empatara empautada empavaba empavada empavadas empavado empavara empavonada empegada empelaba empelado empelara empellada empenaba empenada empenadas empenado empenara empentada empernada empezada empilada empinaba empinada empinadas empinado empinara empipada emplazada empleaba empleaban empleabas emplead empleado empleador empleadora empleados empleais empleando empleara emplearan emplearas empleare emplearia emplease empleita empleitada emplenta emplomada emplumada empollada empolvada empopada emporada empozada emprenada emprenda empujada empulgada empunaba empunada empunadas empunado empunara empuntada empurada enarcada encarada encerada encolar encorada endurada energica energicas energice energico energiza energizad energizan energizar energizas energizo enervada enfriada engorada engranda enrio enserada entada entamada entecada entejada entelada entenada enteraba enterada enteradas enterado enterara entercia enterrada entesada entibada entilada entinada entisada entizada entolada entonada entoraba entorada entoradas entorado entorara entornada entortada entraba entrabad entrabada entraban entrabar entrabas entrad entrado entrador entradora entrados entrama entramad entramada entraman entramar entramas entrampa entrana entranad entranada entranal entranan entranar entranas entrando entrapa entrapad entrapada entrapan entrapar entrapas entrara entraran entraras entraria entrazada entregada entrenada entripada entrizada entrojada entronada entrujada entubada enturcada envarada envia envido envie envigo envino envion envirada enviro enviso equina esbozares escalabres escalar escalara escalaras escalare escalareis escalaren escalares escalases escaldar escaldares escalfar escalfares escaliar escaliares escamares escanares escancio escandio escapares escarares escarolar escarolares escavares escayolar escayolares esclafes esclarea esclareas escobaces escobar escobara escobaras escobare escobareis escobaren escobares escobases escocar escocara escocaras escocare escocareis escocaren escocares escocases escodar escodara escodaras escodare escodareis escodaren escodares escodases escofiar escola escolaba escolabas escolad escolado escolais escolamos escolan escolanes escolano escolanos escolara escolarais escolaran escolaras escolarca escolarcas escolare escolareis escolaremos escolaren escolaria escolarias escolarices escolaron escolas escolase escolaseis escolasen escolases escoliad escolian escoliar escoliara escoliaras escoliare escoliareis escoliaren escoliares escolias escoliases escolies escollad escollan escollar escollara escollaras escollare escollareis escollaren escollares escollas escollases escolles escoltad escoltan escoltar escoltara escoltaras escoltare escoltareis escoltaren escoltares escoltas escoltases escoltes escomar escomara escomaras escomare escomareis escomaren escomares escomases escombres escomear esconar esconara esconaras esconare esconareis esconaren esconares esconases esconzar esconzares escoplear escopleares escorar escorara escoraras escorare escorareis escoraren escorares escorases escoriar escoriares escorzar escorzares escosar escosara escosaras escosare escosareis escosaren escosares escosases escoscar escoscares escotar escotara escotaras escotare escotareis escotaren escotares escotases escozar escozara escozaras escozare escozareis escozaren escozares escozarse escozases escozores escudares esculcar esculcares escullar escullares escupina escurares esencialista esfogares esfolar esfolara esfolaras esfolare esfolareis esfolaren esfolares esfolases esfollar esfollares esfotares esfoyares esfumina espalares especializa espolear espoleares espoliar espoliares esponjaba esponjad esponjada esponjado esponjais esponjan esponjar esponjara esponjare esponjase esponje esponjen esponjera esponjes esponjo esponjosa esposares esquena esquenas esquia esquiaba esquian esquiara esquicia esquifa esquifad esquifan esquifar esquifas esquila esquilad esquilan esquilar esquilas esquilma esquimal esquinaba esquinad esquinada esquinado esquinais esquinal esquinan esquinar esquinara esquinare esquinase esquinazo esquince esquinco esquine esquinela esquinen esquinera esquines esquino esquinza esquinzad esquinzan esquinzar esquinzas esquinzo esquirla esquisar esquita esquitad esquitan esquitar esquitas esquiva esquivad esquivan esquivar esquivas estacion estaco estadero estadia estadias estadillo estadiza estadizo estadizos estado estadojo estadono estafa estanado estanca estancad estancado estancan estancar estancas estancia estando estanero estano estantio estarcio estatico estativo estatizo estelares estilares estinco estincos estofa estofares estordio estovares estozares estrada estuario estuca estudia estudiad estudiado estudian estudiar estudias estudie estudien estudies estudiosa estudioso estufaba estufad estufada estufado estufais estufan estufar estufara estufare estufase estufe estufera estufido estufo estupido estura esturdia esturdid esturdido esturdio esturdir esturdis esturion evito exageres examinas examineis examinen examines excito exclamen exijo exilo eximen eximentes eximo existo fabas facas factora factoras factoria facturaba facturad facturada facturado facturais facturan facturar facturara facturare facturase facture facturen factures facturo fadas fajas falca faldar faldea falida falla falsa falta falua fanas faras farda fardaria faria farmacos farro fatas fayas femas ferreria ferretea ferreteaba ferreteada ferreteais ferreteara ferretearia ferretearian ferretearias ferreteeis ferretera ferreteras ferretero ferreteros ferro festa fiaca fiada fiador fiando fieltras fiestea fiestead fiesteais fiestean fiestear fiesteas fiestease fiestees fiestera fiesteras fiestoca fiestocas fifado fijado filado finado fincad fincan fincar fincha finco finia finja finta fisioterapica fisioterapicas fisioterapico fisioterapista fista fistas fitoterapia fizado flamas flexores florales florares floras florases flore florea floreais floreas florease floreces floree floreeis florees floreis floremos floren florense floreo floreos floreras floreros floresta floretas floretes florines florones flotares flotes fluoreis fluores fonda fondeo fondon fonio forero forjo formo forno forra forre forreo forzo fotocopiaba fotocopiad fotocopiada fotocopiado fotocopiais fotocopian fotocopiar fotocopiara fotocopiare fotocopiase fotocopie fotocopien fotocopies fotocopio fotofobia fototipia frado frejol freta frijolar frijon frisol frita frota fruia frutad frutal frutan frutar frute frutea fruto fruya fumas funca fundo gafad gafais gafan gafar gafase gafearia gafeas gafes gafos gagas gaiteria galas galenica galera galerada galerin galerista galerita galeritas galerna galernas galgueria gallareta gallaria gallea galleaba galleada galleara gallearia gallega gallegas gallera galleras galleria gallerias gallete galletera galletes gallinera gallineta gamas ganas garas garbando garbanza garbanzal garbanzas garbanzon garbeando garfas garlando garlaria garpando garrando garuando gasajosa gasas gasearia gaseoso gaseosos gasoleno gasolera gastosa gastosas gatas gatearia gateria gaterias gayaba gayas gazas gimnasia gimnasias gimnasta gimnastico gofas guabo guachaba guaco guado guairo guamo guanaba guanabas guano guapeaba guapo guara guarao guardaba guardo guare guareaba guareo guari guario guarno guarro guasabea guaseaba guaso guateaba guato guayababa guayabad guayabado guayabais guayabal guayaban guayabana guayabar guayabara guayabare guayabase guayabate guayabe guayabea guayabean guayabear guayabeas guayabee guayaben guayabeo guayabera guayabes guayabita guayabo guayabon guayabos guayabuda guayaca guayacan guayacas guayada guayadas guayara guayaran guayaras guayaria guayo guero guiro hacina halado hambrina hamburgues hamburgueses haria harian harija harinado harinea harinean harinear harinera harinosa harinuda harona helad helada heladero heladizo helador heladora helando heleado heleados heleando helgado helgados higienica higienice higieniceis higienicen higienices higienistas higieniza higienizad higienizais higienizan higienizar higienizas higienizase higienizo hilado hipnotica hipotecaba hipotecad hipotecada hipotecado hipotecais hipotecan hipotecar hipotecara hipotecare hipotecase hipotecnia hipoteco hipotensa hipotesi hipotetica hortal hostil hueco huego huelo huero hueso hueva hueve hueveo huevon hulado idiocias idioma idiotas iglesiera implosion imprecision impreciso impresiona impresionad impresionan impresionar impresionas impresione impresionen impresiono impresiva impresivo impresivos impresor impresos imprevision imprevisor imprevista imprevistas improviso improvista improvisto improvistos impuesta impuestas impulsion incursion incursiones infancia infantas infantes infantillo infantina infantino inferior infertil infles ingle inglesa inglesas ingletes ingres ingreses inhesion inhesiones inmersion inmersiones insercion inserciones integrases intenses intension intensiones intercedes interesa interesad interesais interesal interesales interesan interesar interesares interesas interesase interesases interese intereseis interesemos interesen intereso interina interinar interine interinen interines interino interinos internad internan internar internas internases interne interneis internen internes internos interpeles interpon interven intruses intuyeses invasion invasiones invencion invenciones invernen invernes inversor inversores inversos invertian istmo jabona jabone jabono jalon jaman jambo jamen jamona japon jardinea jardinee jardineo jubon juega juguetea juguetead juguetean juguetear jugueteas juguetee jugueteen jugueteo jugueteos juguetera juguetero jugueton jumeo junto justa juste juzgo labradero labradora labre labro labros lacada ladradora lagarero lamedora lanada lanteja lanzadora lapiza lapizo larvada larvadas latan latas lataz lateria lavaba lavacara lavad lavadedos lavado lavador lavadores lavadura lavaduras lavanda lavandas lavandera lavanderas lavandero lavanderos lavara laxada layada layadora layadoras lazada lecha lechen lechina lechinas lecho lechon lechones lechosa lechosas lenateas lenatees lenatera lenes lentas lente lenteces lentecia lentejar lenteza lentezas lentezca lentores lentos lestes levada levantes leventes lianta liare libare liber libere libero liberos libertos libio libios libon libra libracos libradora librados libramos librana libranas librando libranos libraria libras librazos librea libree librejos libremos libren libreo libreros libretos libriana licenciaba licenciad licenciada licenciado licenciais licencian licenciar licenciara licenciare licenciase licencie licencien licencies licencio licenciosa licitadora licoreria licorerias licorosa licuados lidiadora lidon liebre ligadora ligon lijadora liman limen limonera limos limosa limosnea limosnead limosnean limosnear limosneas limosnee limosneo limosnera limpiada limpiado limpiador limpiados limpiando limpida limpidas limpidez limpio limusina linon lipido lipon liron literia litre litro litros llame llana llanca llanea llanita llanitas llantear llantera llantina llanto llape llavea llavee llaveo lleve llove lobearia loberia loberias locateli locatelis locearia loceria locerias loche logreria lolearia lomearia longuera loqueria lorearia lotearia lotearian lotearias lotera luche maceta macro magno magro majoleta majorca majorcas malata malea malera malestar maletera maletia maleva maleza malla mallorca malmeta malmetan malmetas malmetia maltea malva manana manco mandanga mando maneja manejado maneje maneo manero maneta maneto manga mangana manganas manganea manganga mangon manicera manicero manicura manicuras manicuro manicuros manio maniobre manipule manojo mansejon manso manta mantequillera manto mantuana manzanal manzanar manzanera manzaneta manzanil manzanita manzano manzanos maquilare maquilase maquilla maquillaba maquillad maquillada maquillado maquillais maquillan maquillar maquillara maquillare maquillaren maquillares maquillas maquillase maquillasen maquillases maquillaste maquille marcado mareta margo marro marta maseo masicote matricial matricida matricidas matriculaba matriculabas matriculad matriculada matriculadas matriculado matriculados matriculais matriculamos matriculan matricular matriculara matricularas matriculare matriculares matriculase matriculasen matriculaste matricule matriculeis matriculen matricules matriculo mauro mavacure mavorcia mazana mazmorra mazorral mazurca mazurcas meato mecanica mecanicas mecanice mecanicen mecanices mecanismo mecaniza mecanizo mecano mecatazo mecate mecateo mechados mecias meciendo medas media mediabas mediacana mediad mediadas mediados mediais medial mediales mediamos median medianas mediania medianos mediar mediaras mediares mediase mediasen mediaste mediatas mediatos medicaba medicad medicada medicado medicados medicais medicamenta medicamentad medicamentado medicamentados medicamentais medicamentamos medicamentan medicamentar medicamentas medicamentase medicamente medicamenteis medicamentemos medicamenten medicamentes medicamentosa medicamentosas medicamentoso medicamentosos medicamos medican medicar medicara medicare medicase medicinaba medicinad medicinada medicinado medicinais medicinal medicinan medicinar medicinara medicinare medicinase medicine medicinen medicines medicino medicion medida medidamente medidas medido medidos mediemos medieras medieros medies medievos medimos medina medinas medio medios medira mediras medirian medirias medis medita meditais meditas meditase medito medras medro mejias mejicana mejiendo melanica melanico melanicos melecina melgabas melgados melica melico melicos mellados melodias melodica melodico melodicos membreta mendigas mendigos mendocina meneados meniscos mensajera mensajeras mensajero mensajeros mentados mentalidad merado merados mercabas mercad mercada mercadas mercadea mercadeas mercadee mercadees mercadeo mercadeos mercader mercadero mercador mercadora mercales mercamos mercando mercaras mercares mercarias mercaron mercases mercedes merceros merecido merecidos merenda merendad merendar merendas meridena meriendan meriende merienden meriendes meriendo merindad merinera meritado mermadas mermado mermador mermados mermamos mermando mesiados mesianico mesias mesnaderia metalico metias meticona metiendo metio metodica metodico metodicos metra metricos metropolis mexicana mezcaleas mezcladas mezclado mezclados miedica mingo minimo minino minio minios ministro minuanos minuetes minuetos minutados minutais minutamos minutas minutase minuteis minutemos minuteros minutes minutisa minuto mitro mocarra mocarras modelador modeladora modeladoras moderada moderado moderador moderadores moderados moderara moderatoria modica modico modicos modistas moduladora moharra moharras mojadora mojadura mojara mojaria mojarian mojarias molado moldeadora moldo molestar moleta molida moliendo molino molio momeadora mongo monistas moradora moral morcado morcal moreral morra morralla morras mortal mostradora motejadora movido muble mudadiza muebla mueblaje mueblare mueblase muebleis mueblen mueblo muele muelle mueso mulata muleo muleta mulita mulla mulsa multad multan multar multe multo mundanea murta musco musen musepo muses musgo musia musica musico musio musir musis muslo mutro nagranda naranjada naranjado naranjal naranjera naranjo naranjos neque nevara nevereta neveria neverias nevero nievo niqui noqui normaria nortearia notara notarais notareis notariada notariado notariais notarial notarian notariato notario notarios notoria notorias novaria novarian novarias noviaria nueso nueva nueve odontologa odontologas odontologia odontologico ofenda ofrecida ofrendaba ofrendad ofrendada ofrendado ofrendais ofrendan ofrendar ofrendara ofrendare ofrendase ofrende ofrenden ofrendes ofrendo ogros olimpena olimpiaca olimpiaco olimpiada olimpico olimpicos oncea onceas oncee oncees onceo oneces onices ontica optico optima optometria optometrias optometro optometros orces ortodoxia ortofonia ortos ostros oteros otras otres otris otrosi pacada pachilla pacotilla pacta pactaron padeceria pagad pagadera pagaduria pagan pagara pagare pagas pagel paisaje paisajes pajar pajareria pajel pajeo pajes pajistas pajuilla paladearia paleo paleteria paletilla paliqueo palistas pallo palmilla palmitas palpitad palpitais palpitan palpitar palpitas palpitase palpites palpitos palta pamela pampinas panadeaba panadeada panadeais panadeara panadearia panadearian panadearias panadeeis panadera panaderas panadero panaderos panalon panamericano panamericanos panatela pancilla pancitas pandearia pandemia panderon pandilla panel panelera panera paneta panetaron panetela paneteria panitela panoleria panque pantalan pantalla pantanos papainas papal papar papea papearia papee papeleaba papeleais papeleara papelearia papelearian papelearias papeleeis papelera papeleras papelerio papelerios papelero papeleros papeleta papeletea papeletiza papelorio papen papeo papes papilas papillas papisas papistas paqueo paradera paraje parajes parar pardilla pareceria parecido parejeria parel pareo pareos parido parienta parleria parotida parotideo parquea parquead parqueado parqueados parquean parquear parquearemos parqueas parqueasemos parquee parqueen parqui parrilla parro parta parteado partid partida partidas partideno partidero partidor partiendo partimos partio pasables pasadera pasajera pasajeras pasajero pasajeros pasantes pasaporta pasaportad pasaportan pasaportar pasaportare pasaportas pasaportase pasaporteis pasaporten pasaporto pasar pasare pasareis pasares pasase pasaseis pasases pascales pasco pascuilla pasea paseados paseamos paseares paseas paseases pasee paseemos pasees paseillo paseis pasemos pasen pasero paseros pases pasiegos pasma pasmares pasmases pasmemos pasmo pasmos pasos pasota paspa paspares paspases paspemos paspo pasqueno pastad pastan pastar pastares pastaron pastases paste pastea pastee pastelea pastelee pasteleo pasteleria pastelon pastemos pasten pasteo pasteros pastes pastizal pastle pasto pastos pataje patajes patajues pataleta pataneria pateo pateos patilla patillas patinaba patinada patinara patinata patinatas patineis patinete patinetes patitas paulilla pausares pausases pausemos pauta pautaron paviotas payar peajeros peale peales peanes pecado pediculo pedicura pedicuras pedicuro pedicuros pedidura pedro pegar pejes pelaje pelajes pelaza pello peluquea peluqueaba peluqueada peluqueais peluqueara peluquearia peluquearian peluquearias peluqueeis peluquera peluqueras peluquero peluqueros pensaron pensiona pensionad pensionan pensionar pensionas pensione pensionen pensiono peonajes pepitas percador perchado perero perfuma perfumad perfuman perfumar perfumare perfumas perfumase perfumea perfumead perfumean perfumear perfumeas perfumee perfumeen perfumeis perfumen perfumeo perfumera perfumero perfumo perfunde perime perlo perno peroro perque perra perrajes perreo persuado pesado pesaje pesajes pescad pescada pescadas pescadera pescaderas pescadero pescaderos pescador pescadora pescamos pescando pescaria pescaron pesqueria petaqueria piada pianes piantara picaba picad picado picadora picadura pical pican picana picar picara picarda picardas picardea picardia picas picaza picotada picuda pieza pijada pilada pileta pilleria pillo pinada pinatera pinchada pinciana pintara pintaran pintaras pintaria pinteara pintora pintoras pintuda pintudas pinturera pinza pinzaria piojeria pipada pipera pipetea pipetead pipetean pipetear pipeteas pipita pipitas piqueria pirada pircada pircadas pirque pirro pisada pisciana piscianas pisciano pista pistura pisturas pitada pizca pizcada pizcadas pizcaria placa placando places plafones plaga plagando plagar plana planas planches plane planea planeais planeas planease planee planeeis planees planen planeo planeos planeras planeres planese planesen planetas planis planos plantado plantando planteas plantees planteis planteos plantes plasta plata platado platados platanal platanar platanazo platanea plataneo plataneos platanero plateado plateando platines platino platinos platones plautino playad playan playando playar playe playes playo playones plazca plazo plomaron plomeado plomeara plomeare plomearon plomemos plomeo plomeria plumerio plumero plumeros poblo polco poleo polio polla polleo pololo polveo popel porque porro portaria porteril posare poseo posta poste posteare postee poster posteres postores postra postrare postrase postreis postrema postremo postren postrer postrera postrero postro pradial praza preciamos predicad predican predicar predicas predigan predigas prediran prediras pregustamos pregusto premiamos prenamos prendamos prendian prendias prenotamos prensamos preparaba preparad preparada preparadas preparado preparara prepasada prepasado prepeamos presados presagiada presagos prescito presentamos presento presidamos presintamos preso prest presta prestaba prestabamos prestabas prestada prestadas prestado prestador prestados prestais prestamero prestameros prestando prestara prestaramos prestaras prestare prestaremos prestares prestaron prestase prestasemos prestases preste prestemos prestido prestidos prestino prestinos presumamos presunto preveamos previsto prima primad primal priman primar primas primaz primea primee primen primeo primer primo prive proemial propagaba propagad propagada propagadas propagado propaganda propagara propalada propasada propenda propensa propia propicia propienda propinaba propinad propinada propinado propinais propinan propinar propinara propinare propinase propincua propine propinen propines propino proponga proponia propugna proseamos proteina protestamos protesto psicologa psicologas psicologia psicologico pubicos publicad publicados publicais publicamos publican publicanos publicar publicas publicase publico puerro puesto pullo puntura purro queco quedo quejo quemo quepo quero queseo quiso rabida raida rapada rapido rapina rapinada rapita reaparicion rebaba rebajaba rebajad rebajada rebajado rebajais rebajan rebajar rebajara rebajare rebajase rebaje rebajo rebana rebasa rebata rebuja recabo recaeria recaiga recaigan recaigas recalo recalzos recargaba recargad recargada recargado recargais recargan recargar recargara recargare recargase recargo recargos recargue recebo recesion reciba recibe recibi recibido recibio recino recio recito recrezco rectaria recuarta recuento recuerdo recuesta recueste recuesto recuestos redicion refalosa reforesto refranesco refreido refrendo refresca refrescad refrescado refrescan refrescar refrescas refuerce refuerza refuerzan refuerzas regables regadios regado regados regajo regajos regala regalado regalados regalais regalamos regalas regalase regale regaleis regalemos regalero regaleros regales regalias regalon regalona regalonas regalones regamos regano reganos regateos regato regatos regazo regazos regiamos reglados reglamos reglo regoldos regolfos regulo regulos relaja relajacion relej religion remecido remecio remedado remedais remedeis remedi remedia remediad remediado remedian remediar remedias remedid remedida remedido remedidos remedie remedien remedies remedimos remedion remedir remedira remedire remedis remedo remejido remejio remetido remetio remidio remision remordio remudio remuerdo rengados rengamos repararian repararon reparticion repatriacion reportacion repueblo repuesta repuestas reputacion resallos resaltos resalvos rescision respiracion respuesta restauran restaurando restaurantera restauranteras restaurantero restauranteros restaurare restaurares restaurase restaurases restauraste restaurasteis resuelto retablos retaja retallos retardacion retasacion retiracion retuerto retuerza retuerzo retuesta retueste retuesto revendio reversion revesino revieron revisaron revisita revistan revisten revistio revistos revivian revuelto revulsion ruaba rumbad rumban rumbar rumbe rumbea rumbo rumia sabadena sabanal sabanazo sabanea sabanead sabanean sabanear sabaneas sabanera sabaneta sabano sabatina sabaya sabida sabidas sabina saboyana saciadas salad salada saladas salbanda salcedas salchichera salchichon salchucho salcinas salcocha salda saldadas saldarias saldas salgadas salia salias salica salicas salid salidera salideras salido salidos salieras salina salinas saliva salivada salivadas salivais salivas salivase salladas salmadas salpicas salsinas saltadas saluda saludais saludas saludase salude saludo salvadas sanana sanarias sandalia sandalina sandalinas sandalino sandalinos sandalos sanearias sanidina sanjarias sapida sapidas sardana sardanas sardiana sardianas sardiano sardinada sardinal sardinel sardinera sardineta sardino sardinos sardonal sardonia secuestre semejare sementare semestral senadora senara senera senor senorada senoraje senorea senoread senorean senorear senoreas senoria senorial senorias senorita senorona sensoria seora seresere serifios serviais serviamos servicia serviciad serviciados serviciais servicial serviciamos servician serviciar servicias serviciase servicie servicieis serviciemos servicien servicies servicio servidos servimos servirias sevicias solida solidas sonora sordina sport suavizan suavizando suavizare suavizase suavizaste subscripcion subscripciones supera superante superantes supere supero surtidas surtimos surtiran surtiras suscepcion suscepciones tabal tabis table tablea tablee tablen tableo tables tableta tabletas tabletea tabletee tableteo tallar tallas talle tallecer tallen tallera talleras tallero talleros talles tamil tamul tanateada tanatear tangueaba tangueado tanguean tanguear tangueara tangueare tangueas tanguera tanqueis tanqueta tanquetas tanteada tanto tapaboca tapadoras tapiocas tapis taqueaba taqueada taqueadas taqueado taquear taqueara taqueare tarijena tarjera tarjeras tarjetea tarjetean tarjetear tarjeteas tarjetee tarjeteo tarjetera tarta tasis tasqueaba tasquead tasqueado tasquean tasquear tasqueara tasqueare tasqueas tasquera teatrero teatrico telefonazo telefonea telefonee telefoneo telefonia telefonico telefoto telefotos televisan televisaron televisen televisiva televisivo televisivos televiso televisor tenas teneis tenes tenia tenias tenid tenio tenios tenir tento terapea terapead terapean terapear terapeas terapiaba terapiad terapiada terapiado terapiais terapian terapiar terapiara terapiare terapiase terapie terapien terapies terapio termicas termina terminaba terminable terminad terminada terminado terminais terminajo terminan terminar terminara terminare terminas terminase terminen termines terminos termitas ternaria terpinas terpinol terrenal terrinas tersaria tesis tetro texano tiendan tiende tiendera tienderas tiendes tiendo tienta tientas tiento tinco tineo tinta tinte tintor tiple tiqueare tiquease tiqueaste tiquee tiznadas toalla toalletas toballas tocomate tollas toller tomare tomase tomaste tomatera tomatero tonta tonto torca torda torea torga torna torra tortea torva tosta tostad tostado tostador tostados tostamos tostando tostar tostaron tostas tosto tozalbas trabo tracateo trafagos traga tragados tragamos tragas tragicos tragon tragonas tragones traigo traite trajiste trajo trallas tramaste tramita tramitad tramitan tramitar tramitare tramitas tramitase tramiteis tramiten tramito tramo tramonte tramos transborde transcriba transcribe transcriben transcribes transcribi transcribo transforme transite transmite transmonte transpire transpone transporta transportad transportan transportar transportare transportas transportase transporteis transporten transporto trapo trapos traro traros trascribe trasgo trasgos trasiego trasmate trasmine trasmita trasmite trasmiten trasmites trasmiti trasmito trasmute trasporta trasporte trasporten trasportes trasporto trastajo trastazo traste trastea trastead trasteado trastean trastear trasteas trastee trasteen trastees trasteja trasteje trastejo trastejos trastera trastero trasteros trastes trastesa trastese trasteso trasteson trasto trastoco trastulo trasueno trasveno trasveo trato tratos traviste travo trazo trazos tremiste trigo trigos trile trille tripe tripie tripla tripleta triplete triplex triplice triplo tripoles tripule tripulen tripules trota tutearia tutora tutoraba tutorada tutorais tutorara tutoraria tutoreis unciforme unciformes uniforma uniformad uniforman uniformar uniformare uniformas uniformase uniformeis uniformen uniformice uniformo universalidad urgencia utileras utileros utilices vacios vacua vacunaba vacunad vacunada vacunado vacunais vacunan vacunar vacunara vacunare vacunase vacune vacuno vadeo vainilla vajillo vajillos validez vaquilla vareos variados variamos varias varicosa varicoso variemos varies varilla varillas vario varis varizos vatios veeduria vehicula vehiculaba vehiculad vehiculada vehiculado vehiculais vehiculan vehiculara vehicularan vehicularas vehiculare vehicularen vehicularia vehicularon vehiculas vehiculase vehicule vehiculen vehicules vehiculo vehiculos veladura vende verdea verdeara verdee verdel verdeo verdugal verdulera verdusca verge verme vermicular verse verte vertido vertidos vesicula vesicular vesiculas vestid vestida vestidas vestidor vestigio vestiglo vestimos viaja viajen viajo viarios vicuna vides vidro viniendo viraje vireo virios visaje viseo vitaliza vitaminada vitaminado vitaminica vitarian vitelina viviendo viviente volantearia volitaria voltaria voluntariado voluntario voluntarios voluntariosa voluntarista vuela vuelco vuele vuelto vuelvo vueso yagurt yogur zacateca zafacoca zampados zampamos zapallos zapalota zapamos zapaneca zapatas zapatazos zapateas zapatees zapateos zapatera zapateros zapateta zapatitos zapato zapatuda zapatudos zapeados zapeamos zapitos zaratosa zaratoso zarpados zarpamos zarpazos ";
  var CH_PALABRAS = null;
  function chPalabrasConocidas() {
    if (CH_PALABRAS) return CH_PALABRAS;
    var v = {};
    function add(t) { prNorm(t).split(" ").forEach(function (w) { if (w.length >= 3 && !/\d/.test(w)) v[w] = 1; }); }
    Object.keys(CH_VOCAB).forEach(function (c) { CH_VOCAB[c].split("|").forEach(add); });
    HI_LUGARES.forEach(function (l) { l[1].split("|").forEach(add); });
    Object.keys(PR_SIN).forEach(function (c) { PR_SIN[c].split("|").forEach(function (t) { add(t.replace(/[?()]/g, "")); }); });
    CH_PALABRAS = Object.keys(v);
    return CH_PALABRAS;
  }
  // Distancia de edición con trasposiciones ("amlerzo"), cortando apenas pasa del límite
  function chDistancia(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) {
      var fila = max + 1;
      for (j = 1; j <= b.length; j++) {
        var c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        if (d[i][j] < fila) fila = d[i][j];
      }
      if (fila > max) return max + 1;
    }
    return d[a.length][b.length];
  }
  function chConocida(w, palabras, propias) {
    if (propias[w]) return true;
    var raiz = [w, w.replace(/s$/, ""), w.replace(/es$/, "")];
    return raiz.some(function (r) { return palabras.indexOf(r) > -1 || CH_REALES.indexOf(" " + r + " ") > -1 || CH_COMUNES.indexOf(" " + r + " ") > -1 || CH_RELLENO.indexOf(" " + r + " ") > -1 || HI_PARO.indexOf(" " + r + " ") > -1 || PR_PARE.indexOf(" " + r + " ") > -1 || CH_NUM[r] != null || PR_MES[r] || CH_DIAS.indexOf(r) > -1; });
  }
  function chArreglarEscritura(texto) {
    var palabras = chPalabrasConocidas(), propias = {};
    Object.keys(state.reglas || {}).forEach(function (k) { prNorm(k).split(" ").forEach(function (w) { propias[w] = 1; }); });
    (state.movs || []).slice(-300).forEach(function (m) { (m.det || []).forEach(function (d) { prNorm(d.n).split(" ").forEach(function (w) { propias[w] = 1; }); }); });
    return String(texto).replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{5,}/g, function (orig) {
      var w = nrm(orig);
      if (chConocida(w, palabras, propias)) return orig;
      var max = w.length >= 8 ? 2 : 1, mejor = null, empate = false, dmin = max + 1;
      palabras.forEach(function (p) {
        if (p[0] !== w[0] || p.length < 5) return;
        if (max === 2 && p[1] !== w[1]) return;
        var d = chDistancia(w, p, max);
        if (d < dmin) { dmin = d; mejor = p; empate = false; } else if (d === dmin && d <= max && p !== mejor) empate = true;
      });
      if (!mejor || empate || dmin > max) return orig;
      return orig[0] === orig[0].toUpperCase() ? mejor[0].toUpperCase() + mejor.slice(1) : mejor;
    });
  }
  function chValorPalabras(s) {
    return nrm(s).split(" ").reduce(function (a, w) { return a + (CH_NUM[w] != null ? CH_NUM[w] : /^\d+$/.test(w) ? +w : 0); }, 0);
  }
  function chPrevio(texto) {
    var t = String(texto || "");
    // "18 000", "1 300 000", "$ 18 500": miles separados con espacio por el dictado
    t = t.replace(/(\$\s*)?\b(\d{1,3})((?:[   ]\d{3})+)(?!\d)(\s*pesos)?/g, function (todo, signo, a, grupos, pesos) {
      return signo || pesos || /\s000$/.test(grupos) ? (signo || "") + a + grupos.replace(/[   ]/g, "") + (pesos || "") : todo;
    });
    // "d uno", "d 1" → D1
    t = t.replace(/\b[dD]\s+(?:uno|1)\b/g, "D1");
    // "2 palos y medio", "un millón y medio"
    t = t.replace(new RegExp("\\b(" + CH_UNIDAD_NUM + ")\\s+(?:mill[oó]n(?:es)?|palos?)\\s+y\\s+medio\\b", "gi"), function (x, n) { return String((chValorPalabras(n) || 1) * 1e6 + 5e5); });
    // "un millón doscientos" (sin "mil" al final) es 1.200.000
    t = t.replace(new RegExp("\\b(" + CH_UNIDAD_NUM + ")\\s+(?:mill[oó]n(?:es)?|palos?)\\s+((?:" + CH_CIENTOS + ")(?:\\s+(?:" + CH_DECENAS + "))?|\\d{3})\\b(?!\\s+mil)", "gi"), function (x, n, c) {
      return String((chValorPalabras(n) || 1) * 1e6 + chValorPalabras(c) * 1000);
    });
    // "taxi de 12", "gasté 15 en el almuerzo", "me salió en 29": en Colombia, un número corto donde va la plata son miles
    t = t.replace(/(^|\s)(de|en|por|gast[eé]|gastamos|pagu[eé]|pagamos|pagar|cost[oó]|costaron|cuesta|cuestan|sali[oó]|sale|vale|val[ií]o|cobraron|fueron|fue|total|como)\s+(\d{1,3})(?![\d.,]*\d)(?=\s*(?:$|[.;!?]|,(?!\d)|\s(?:en|de|por|pesos|y|con|el|la|los|las|para|pagu[eé]|pagamos|todo)\b))/gi, function (x, a, b, n) {
      // Con tres cifras, solo si no es un precio por unidad de algo barato: "10 panes de 500" son $ 5.000, no $ 5 millones
      if (n.length === 3 && (CH_BARATOS.test(t) || /\b\d+\s+[a-zñ]+\s+(?:de|a)\s+\d{3}\b/.test(t))) return x;
      return +n > 0 ? a + b + " " + n + "000" : x;
    });
    // "la cuota del carro 850", "netflix 26": un número corto al final, cuando la frase no trae otra plata, también son miles
    if (!/\d{4,}|\d[.,]\d{3}|\bmil\b|millon|palo|luca/.test(t) && !CH_BARATOS.test(t)) t = t.replace(/^([a-zñáéíóú][^\d]*?[a-zñáéíóú])\s+(\d{1,3})\s*$/i, function (x, a, n) { return +n >= 2 ? a + " " + n + "000" : x; });
    t = t.replace(/\b(pagu[eé]|pagamos|pag[oó]|di|dimos)\s+con\s+(\d{1,3})(?![\d.,]*\d)(?=\s*(?:$|[.,;!?]|\s(?:y|me|nos|pesos|de|en|porque)\b))/gi, function (x, v, n) { return v + " con " + n + "000"; });
    return chArreglarEscritura(t);
  }
  function chEntender(texto) {
    var base = chNumeros(nrm(texto)).replace(/\b(una|1) luca\b/, "1000"), quitados = [];
    var fe = chFecha(base); if (fe) { base = base.replace(fe.txt, " "); quitados.push(fe.txt); }
    var ll = /(?:^| )(?:(?:con|por|desde|via|usando)(?: la| una| mi)? (?:llave|llaves)|(?:con |por |via )?bre ?-?b)(?= |$)/.exec(base); if (ll) { base = base.replace(ll[0], " "); quitados.push(ll[0]); }
    var cu = chCuentaDe(base); if (cu) { base = base.replace(cu.txt, " "); quitados.push(cu.txt); }
    var co = chCompartido(base); if (co) { base = base.replace(co.txt, " "); quitados.push(co.txt); }
    var limpio = prNorm(base);
    var r = { m: prMonto(base), t: /\b(me pagaron|me pago|recibi|me llego|me llegaron|me dieron|me consignaron|me entro|me entraron|me devolvieron|me reembolsaron|me prestaron|me regalaron|me transfirieron|me giraron|me gane|gane|ingreso|vendi|cobre|sueldo|salario|quincena)\b/.test(limpio) ? "i" : "g",
      cat: "", c: "", f: fe ? fe.f : "", cuenta: cu ? cu.id : "", llave: !!ll, comp: co ? { partes: co.partes, quien: chNombre(co.quien, texto) } : null };
    // "un tinto de 800": con algo barato, un número de dos o tres cifras son pesos
    if (!r.m && CH_BARATOS.test(limpio)) { var mb = /(?:^|\s)(\d{2,3})(?=\s|$)/.exec(limpio); if (mb && +mb[1] >= 50) r.m = +mb[1]; }
    if (r.t === "g") { var k = chCategoria(limpio); r.cat = k.cat; r.por = k.por; }
    var fuera = {}; quitados.join(" ").split(" ").forEach(function (w) { if (w) fuera[w] = 1; });
    if (co && co.quien) co.quien.split(" ").forEach(function (w) { fuera[w] = 1; });
    // Las palabras con sentido, y los conectores que quedan entre ellas ("corte de pelo", "mercado en el Éxito").
    var tok = String(texto).replace(/[¿?¡!.,;:()"$]/g, " ").split(/\s+/).filter(Boolean).map(function (p) {
      var n = nrm(p), si = !!n && !fuera[n] && CH_RELLENO.indexOf(" " + n + " ") < 0 && CH_NUM[n] == null && !/^\d/.test(n) && !/^(\d+k|millon(es)?|mitad|entre|medias|dividido|partido|personas)$/.test(n);
      return { p: p, si: si, con: !fuera[n] && /^(de|del|la|el|los|las|y|con|en|para|al|mi|mis|su|sus)$/.test(n) };
    });
    var i0 = tok.findIndex(function (x) { return x.si; }), i1 = -1;
    for (var q = tok.length - 1; q >= 0; q--) if (tok[q].si) { i1 = q; break; }
    var pal = "";
    if (i0 > -1) {
      var tramo = tok.slice(i0, i1 + 1), corte = tramo.findIndex(function (x) { return !x.si && !x.con; });   // un número o un verbo corta la frase
      if (corte > -1) tramo = tramo.slice(0, corte);
      var con = tramo.filter(function (x) { return x.si; }).length;
      pal = (con <= 5 ? tramo : tramo.filter(function (x) { return x.si; }).slice(0, 4)).map(function (x) { return x.p; }).join(" ");
    }
    r.c = pal ? pal.charAt(0).toUpperCase() + pal.slice(1) : "";
    return r;
  }
  // --- Varios gastos en una frase: "almuerzo 18 mil y taxi 12 mil". Solo se separa si cada parte trae su monto. ---
  function chPartes(texto) {
    var tok = String(texto).replace(/\s*([,;+])\s*/g, " $1 ").split(/\s+/).filter(Boolean), partes = [[]];
    tok.forEach(function (w, i) {
      var n = nrm(w), prev = nrm(tok[i - 1] || ""), sig = nrm(tok[i + 1] || "");
      var corta = w === "," || w === ";" || w === "+" || /^(tambien|ademas|mas)$/.test(n) || (n === "y" && !(CH_NUM[prev] != null && CH_NUM[sig] != null));
      if (corta) { if (partes[partes.length - 1].length) partes.push([]); } else partes[partes.length - 1].push(w);
    });
    return partes.map(function (p) { return p.join(" "); }).filter(Boolean);
  }
  function chEntenderTodo(texto) {
    texto = chPrevio(texto);
    var partes = chPartes(texto);
    if (partes.length > 1) {
      var items = partes.map(chEntender);
      if (items.every(function (x) { return x.m > 0; })) {
        var f = items.map(function (x) { return x.f; }).filter(Boolean)[0] || "", cu = items.map(function (x) { return x.cuenta; }).filter(Boolean)[0] || "";
        items.forEach(function (x) { if (!x.f) x.f = f; if (!x.cuenta) x.cuenta = cu; });
        return items.slice(0, 8);
      }
    }
    return [chEntender(texto)];
  }

  // ===================== Historias: "fui al D1 y compré leche, pan y huevos…" =====================
  // Entiende el relato completo de una compra o de una salida: dónde fue, cada producto con su cantidad y su precio
  // (por unidad o en total), el total, las vueltas, los descuentos, con qué se pagó, lo que puso otra persona y los
  // gastos aparte (el taxi, el parqueadero, la propina). Lo que no queda claro se pregunta; si la persona prefiere,
  // se le pregunta después. Todo se calcula aquí, en el dispositivo.
  var HI_LUGARES = [
    ["D1", "d1|tiendas d1|el d1", "alimentacion"], ["Ara", "ara|tiendas ara", "alimentacion"], ["Éxito", "exito|almacenes exito|el exito", "alimentacion"],
    ["Carulla", "carulla", "alimentacion"], ["Olímpica", "olimpica|super olimpica|sao", "alimentacion"], ["Jumbo", "jumbo", "alimentacion"], ["Makro", "makro", "alimentacion"],
    ["PriceSmart", "pricesmart|price smart", "alimentacion"], ["Ísimo", "isimo", "alimentacion"], ["Oxxo", "oxxo", "alimentacion"], ["Justo & Bueno", "justo y bueno|justo & bueno", "alimentacion"],
    ["Surtimax", "surtimax", "alimentacion"], ["Super Inter", "super inter|superinter", "alimentacion"], ["Zapatoca", "zapatoca|mercados zapatoca", "alimentacion"],
    ["Colsubsidio", "colsubsidio", "alimentacion"], ["Euro", "euro supermercados|eurosupermercados", "alimentacion"], ["Megatiendas", "megatiendas", "alimentacion"],
    ["Mercaldas", "mercaldas", "alimentacion"], ["Merkepaisa", "merkepaisa", "alimentacion"], ["La 14", "la 14|la catorce", "alimentacion"], ["Famia", "famia", "alimentacion"],
    ["Farmatodo", "farmatodo", "salud"], ["Cruz Verde", "cruz verde", "salud"], ["La Rebaja", "la rebaja|drogas la rebaja", "salud"], ["Locatel", "locatel", "salud"],
    ["Homecenter", "homecenter|home center", "vivienda"], ["Easy", "easy", "vivienda"], ["Dollarcity", "dollarcity|dollar city", "compras"], ["Miniso", "miniso", "compras"],
    ["Falabella", "falabella", "compras"], ["Alkosto", "alkosto", "compras"], ["Ktronix", "ktronix", "compras"], ["Panamericana", "panamericana", "educacion"],
    ["Supermercado", "supermercado|el super|al super", "alimentacion"], ["Tienda", "tienda|tiendita|la tienda de la esquina|la tienda del barrio", "alimentacion"],
    ["Minimercado", "minimercado|minimarket|mini mercado", "alimentacion"], ["Plaza de mercado", "plaza|plaza de mercado|galeria", "alimentacion"], ["Fruver", "fruver", "alimentacion"],
    ["Carnicería", "carniceria|famas", "alimentacion"], ["Panadería", "panaderia", "alimentacion"], ["Droguería", "drogueria|farmacia", "salud"],
    ["Ferretería", "ferreteria", "vivienda"], ["Papelería", "papeleria", "educacion"], ["Centro comercial", "centro comercial", "compras"], ["Licorera", "licorera|estanco", "ocio"]
  ];
  // Gastos que no son parte de la compra del lugar, aunque se cuenten en la misma historia
  var HI_APARTE = /(?:^| )(taxi|uber|didi|indrive|indriver|picap|cabify|bus|buseta|colectivo|transmilenio|sitp|metro|mio|pasaje|pasajes|parqueadero|parqueo|peaje|gasolina|tanqueada|tanqueamos|tanquee|propina|domicilio|domiciliario|mototaxi|bicitaxi|cuidacarros|celador|el que cuida|lavada del carro|almorce|almorzamos|almuerzo|desayune|desayunamos|comimos|cenamos|cene|nos tomamos|tomamos|me tome|me comi|nos comimos|helado|helados|cine|boletas?)(?= |$)/;
  var HI_PARO = " a al de del la el los las lo un una unos unas y e o u con por para en que me nos se le les mi mis su sus tu tus ese esa eso esto este esta otro otra otros otras tambien ademas luego despues entonces ahi alli ya ah bueno pues como mas o menos casi aproximadamente aprox cada c/u total todo toda todos todas fue fueron era eran es son salio salieron costo costaron valio valieron cobraron cobro pague pagamos pagaste gaste gastamos compre compramos compro lleve llevamos traje trajimos cogi cogimos coji cojimos tome tomamos fui fuimos estuve estuvimos pase pasamos hice hicimos di dimos deje dejamos meti pedi pedimos agarre agarramos echamos eche hoy ayer antier pesos peso mil millon millones lucas luca k cop plata unidad unidades cada una cada uno precio valor vale ";
  var HI_GENERICO = /^(mercado|mercadito|el mercado|compra|compras|la compra|cuenta|la cuenta|factura|la factura|todo|todo eso|eso|lo demas|las cosas|cosas|el resto|resto|total|surtido|el surtido|mercado del mes|mercado de la semana)$/;
  var HI_UNIDADES = { kilo: "kg", kilos: "kg", kg: "kg", libra: "lb", libras: "lb", lb: "lb", gramos: "g", gr: "g", g: "g", litro: "L", litros: "L", lt: "L", docena: "docena", docenas: "docena",
    paquete: "paquete", paquetes: "paquete", bolsa: "bolsa", bolsas: "bolsa", caja: "caja", cajas: "caja", botella: "botella", botellas: "botella", lata: "lata", latas: "lata", paca: "paca", pacas: "paca",
    canasta: "canasta", canastas: "canasta", bandeja: "bandeja", bandejas: "bandeja", tarro: "tarro", tarros: "tarro", frasco: "frasco", frascos: "frasco", barra: "barra", barras: "barra", rollo: "rollo", rollos: "rollo", sixpack: "six pack", "six-pack": "six pack" };
  var HI_PERSONAS = /^(esposa|esposo|novia|novio|mama|papa|mami|papi|hijo|hija|hijos|hijas|nino|nina|ninos|ninas|bebe|amigo|amiga|amigos|amigas|hermano|hermana|hermanos|hermanas|familia|pareja|mujer|marido|suegra|suegro|abuela|abuelo|tia|tio|primo|prima|vecina|vecino|jefe|companero|companera|socio|socia|parcero|parcera|parce)$/;
  var HI_COMPRA = /(?:^| )(compre|compramos|compro|lleve|llevamos|pedi|pedimos|eche|echamos|agarre|agarramos|traje|trajimos|cogi|cogimos|meti|metimos|habia que comprar|tocaba comprar|mercado|mercamos|merque)(?= |$)/;

  // --- Palabras a fichas, con los números ya como números ("dos mil quinientos" → 2500, "18 lucas" → 18000) ---
  function hiFichas(texto) {
    var s = String(texto || "").replace(/\r?\n+/g, " . ").replace(/\$\s*/g, " $ ").replace(/(\d)\s*k\b/gi, "$1 k")
      .replace(/([,;!?¿¡()"“”:])/g, " $1 ").replace(/\.(?!\d)/g, " . ").replace(/(\D)\.(\d)/g, "$1 . $2");
    var crudo = s.split(/\s+/).filter(Boolean).map(function (o) { return { o: o, n: nrm(o) }; }), out = [], i = 0;
    function esNumPal(n) { return CH_NUM[n] != null; }
    while (i < crudo.length) {
      var t = crudo[i], n = t.n, v = null, dinero = false, j = i, orig = [];
      if (n === "$") { if (crudo[i + 1] && /^\d/.test(crudo[i + 1].n)) { crudo[i + 1].dolar = true; i++; continue; } i++; continue; }
      if (/^\d/.test(n)) {
        var mm;
        if (/^\d{1,3}(?:[.,]\d{3})+$/.test(n)) v = parseInt(n.replace(/[.,]/g, ""), 10);
        else if ((mm = /^(\d+)[.,](\d{1,2})$/.exec(n))) v = parseFloat(mm[1] + "." + mm[2]);
        else if (/^\d+$/.test(n)) v = parseInt(n, 10);
        if (v != null) { orig.push(t.o); j = i + 1; dinero = !!t.dolar; }
      } else if (esNumPal(n) && !(/^(un|uno|una)$/.test(n) && !(crudo[i + 1] && /^(mil|millon|millones)$/.test(crudo[i + 1].n)))) {
        var cur = 0, total = 0, usado = false;
        while (j < crudo.length) {
          var x = crudo[j].n;
          if (esNumPal(x)) { cur += CH_NUM[x]; usado = true; }
          else if (x === "y" && usado && crudo[j + 1] && esNumPal(crudo[j + 1].n) && CH_NUM[crudo[j + 1].n] < 10) { /* treinta y cinco */ }
          else break;
          orig.push(crudo[j].o); j++;
        }
        v = total + cur;
      } else if (/^mil$/.test(n) && !(out.length && out[out.length - 1].v != null)) { v = 1; j = i; }
      else if (n === "medio" || n === "media") { if (crudo[i + 1] && (HI_UNIDADES[crudo[i + 1].n] || /^(millon|palo)$/.test(crudo[i + 1].n))) { v = 0.5; orig.push(t.o); j = i + 1; } }
      else if (n === "par" && out.length && /^(un|el)$/.test(out[out.length - 1].n)) { out.pop(); v = 2; orig.push("un par"); j = i + 1; if (crudo[j] && crudo[j].n === "de") j++; }
      if (v == null) { out.push({ o: t.o, n: n }); i++; continue; }
      // Multiplicadores: mil, millones, lucas, k, palos; y lo que sigue ("2 mil 500", "un millón doscientos mil")
      var mul = crudo[j] ? crudo[j].n : "";
      if (/^(millon|millones|palo|palos|mill)$/.test(mul)) {
        v = v * 1e6; dinero = true; orig.push(crudo[j].o); j++;
        var rest = 0, k2 = j, curr = 0, us = false;
        while (k2 < crudo.length && (esNumPal(crudo[k2].n) || /^\d{1,3}$/.test(crudo[k2].n))) { curr += esNumPal(crudo[k2].n) ? CH_NUM[crudo[k2].n] : +crudo[k2].n; us = true; k2++; }
        if (us && crudo[k2] && /^mil$/.test(crudo[k2].n)) { rest = curr * 1000; for (var q = j; q <= k2; q++) orig.push(crudo[q].o); j = k2 + 1; v += rest; }
      } else if (/^mil$/.test(mul)) {
        v = (v || 1) * 1000; dinero = true; orig.push(crudo[j].o); j++;
        var cola = 0, k3 = j, us2 = false;
        while (k3 < crudo.length && (esNumPal(crudo[k3].n) || /^\d{1,3}$/.test(crudo[k3].n))) { if (crudo[k3].n === "un" || crudo[k3].n === "una") break; cola += esNumPal(crudo[k3].n) ? CH_NUM[crudo[k3].n] : +crudo[k3].n; us2 = true; k3++; }
        if (us2 && cola < 1000 && !(crudo[k3] && /^(mil|kilos?|libras?|unidades|docenas?|paquetes?|gramos)$/.test(crudo[k3].n))) { for (var q2 = j; q2 < k3; q2++) orig.push(crudo[q2].o); j = k3; v += cola; }
      } else if (/^(lucas?|k|barras?)$/.test(mul) && !(mul.indexOf("barra") === 0 && crudo[j + 1] && crudo[j + 1].n === "de")) { v = v * 1000; dinero = true; orig.push(crudo[j].o); j++; }
      if (crudo[j] && /^(pesos?|cop)$/.test(crudo[j].n)) { dinero = true; orig.push(crudo[j].o); j++; }
      if (v >= 1000 && Math.round(v) === v) dinero = true;
      out.push({ o: orig.join(" "), n: String(v), v: v, dinero: dinero });
      i = Math.max(j, i + 1);
    }
    return out;
  }
  // --- Partes de la historia: frases, y dentro de ellas, productos separados por comas o por "y" ---
  var HI_SIGUE = /^(pesos?|cop|cada|c\/u|c|u|el|la|los|las|por|de|del|en|para|con|x|al|a|mas|menos|aprox|aproximadamente|o|y|mil|lucas?|k|barras?|millon|millones|palos?|unidad|kilo|libra|docena)$/;
  function hiPartes(fichas) {
    var partes = [[]];
    fichas.forEach(function (f, i) {
      var corta = /^[.;!?:]$/.test(f.n) || f.n === "," || (f.n === "y" && !(fichas[i - 1] && fichas[i - 1].v != null && fichas[i + 1] && fichas[i + 1].v != null && fichas[i + 1].v < 100 && fichas[i - 1].v >= 20 && fichas[i - 1].v < 100))
        || /^(despues|luego|tambien|ademas|entonces|porque)$/.test(f.n);
      // Dictado sin comas: después de un precio, lo que no lo complementa empieza otra parte ("pollo de 18 mil unas papas de 5 mil")
      var ant = fichas[i - 1], sigueDinero = ant && ant.v != null && (ant.dinero || ant.v >= 1000) && f.v == null && !HI_SIGUE.test(f.n);
      if (corta) { if (partes[partes.length - 1].length) partes.push([]); }
      else if (!/^[()"“”¿¡]$/.test(f.n)) { if (sigueDinero && partes[partes.length - 1].length) partes.push([]); partes[partes.length - 1].push(f); }
    });
    return partes.filter(function (p) { return p.length; });
  }
  function hiTexto(fichas) { return fichas.map(function (f) { return f.v != null ? f.n : f.n; }).join(" "); }
  function hiLugar(n) {
    var mejor = null;
    HI_LUGARES.forEach(function (L) {
      L[1].split("|").forEach(function (alias) {
        var re = new RegExp("(?:^| )(?:al|a la|a|en el|en la|en|del|de la|por el|por la|donde)\\s+(?:supermercado |tienda |almacen |almacenes |drogueria )?" + alias.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&") + "(?= |$)");
        var m = re.exec(n);
        if (m && (!mejor || alias.length > mejor.alias.length)) mejor = { nombre: L[0], alias: alias, cat: L[2], txt: m[0], i: m.index };
      });
    });
    if (!mejor) return null;
    // "la tienda de don José", "la panadería de la esquina"
    var dueno = new RegExp(mejor.alias.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&") + " de (don|dona|la senora|el senor|la esquina|la cuadra|mi barrio|la casa|al lado) ?([a-z]+)?").exec(n);
    if (dueno && /tienda|panaderia|drogueria|carniceria|fruver|ferreteria|papeleria/.test(mejor.alias)) {
      var quien = (dueno[1] === "dona" ? "doña" : dueno[1].replace("senora", "señora").replace("senor", "señor")) + (dueno[2] && /^(don|dona|la senora|el senor)$/.test(dueno[1]) ? " " + hiCap(chNombre(dueno[2], hiOriginal) || dueno[2]) : "");
      mejor.nombre = mejor.nombre + " de " + quien;
    }
    return mejor;
  }
  // --- Un producto: cantidad, unidad, nombre y precio ("2 leches de 4.500", "medio kilo de carne en 12 mil", "las galletas") ---
  function hiProducto(p) {
    var n = hiTexto(p), qty = null, unidad = "", precio = null, porUnidad = false, nombre = [];
    var idxPrecio = -1;
    for (var i = 0; i < p.length; i++) {
      var f = p[i];
      if (f.v == null) continue;
      var sig = p[i + 1] ? p[i + 1].n : "", ant = p[i - 1] ? p[i - 1].n : "";
      var esCantidad = !f.dinero && f.v < 1000 && (HI_UNIDADES[sig] || (sig && sig !== "de" && !/^(cada|c\/u|la|el|pesos?)$/.test(sig) && qty == null && precio == null && i < p.length - 1));
      if (esCantidad && qty == null) { qty = f.v; if (HI_UNIDADES[sig]) { unidad = HI_UNIDADES[sig]; i++; if (unidad === "docena") { qty = qty * 12; unidad = ""; } } continue; }
      if (precio == null && (f.dinero || f.v >= 50 || /^(a|de|en|por|cada)$/.test(ant))) {
        precio = f.v < 50 && !f.dinero ? f.v * 1000 : f.v; idxPrecio = i;
        var despues = p.slice(i + 1).map(function (x) { return x.n; }).join(" ");
        porUnidad = /^(a|cada|c\/u)$/.test(ant) || /^(cada|c\/u|la unidad|el kilo|la libra|el litro|c u)\b/.test(despues) || (ant === "de" && qty > 1 && !unidad);
        continue;
      }
    }
    // "una docena de huevos", "un kilo de carne"
    p.forEach(function (f, k) { if (qty == null && f.v == null && /^(un|una)$/.test(f.n) && p[k + 1] && HI_UNIDADES[p[k + 1].n]) { qty = 1; unidad = HI_UNIDADES[p[k + 1].n]; if (unidad === "docena") { qty = 12; unidad = ""; } } });
    // El nombre: de la primera a la última palabra con sentido, con los conectores de adentro ("concentrado del perro")
    var util = p.map(function (f, k) {
      if (f.v != null || k === idxPrecio) return 0;
      if (HI_UNIDADES[f.n] && (k === 0 || (p[k - 1] && (p[k - 1].v != null || /^(un|una|medio|media)$/.test(p[k - 1].n))))) return 0;
      if (/^(kilo|libra|unidad|docena|litro)$/.test(f.n) && idxPrecio > -1 && k > idxPrecio) return 0;
      if (HI_PARO.indexOf(" " + f.n + " ") > -1 || /^[.,;$]$/.test(f.n) || /^(c\/u|c|u)$/.test(f.n)) return /^(de|del|la|el|con|y)$/.test(f.n) ? 2 : 0;
      return 1;
    });
    var a0 = util.indexOf(1), a1 = util.lastIndexOf(1);
    for (var z = a0; a0 > -1 && z <= a1; z++) {
      if (/^(para|porque|pa|que|cuando|donde)$/.test(p[z].n) && nombre.length) break;
      if (util[z] === 1 || (util[z] === 2 && nombre.length)) nombre.push(p[z].o); else if (util[z] === 0 && nombre.length && z < a1 && p[z].v != null) break;
    }
    var nom = nombre.join(" ").replace(/^(de|del|la|el)\s+/i, "").replace(/\s+(de|del|la|el|con|y)$/i, "").trim();
    var cuenta = qty != null && qty > 0 && porUnidad ? qty : 1;
    return { nombre: nom, qty: qty, unidad: unidad, precio: precio, unit: porUnidad && precio != null ? precio : null, m: precio != null ? Math.round(precio * cuenta) : 0, texto: n };
  }
  function hiCap(s) { s = String(s || "").trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }
  function hiCantidadTxt(x) {
    if (x.qty == null || (x.qty === 1 && !x.unidad)) return "";
    var q = x.qty === 0.5 ? "½" : String(x.qty).replace(".", ",");
    var u = x.unidad && x.qty > 1 && !/^(kg|lb|g|L|six pack)$/.test(x.unidad) ? x.unidad.replace(/\.$/, "") + (/[aeiou]$/.test(x.unidad) ? "s" : "es") : x.unidad;
    return u ? q + " " + u : q + " ×";
  }

  // --- La historia completa ---
  var hiOriginal = "";
  function chHistoria(texto) {
    texto = chPrevio(texto);
    hiOriginal = String(texto || "");
    var original = String(texto || "").slice(0, 800), fichas = hiFichas(original), todo = hiTexto(fichas);
    var dineros = fichas.filter(function (f) { return f.v != null && (f.dinero || f.v >= 1000); }).length;
    var precios = fichas.filter(function (f, k) { return f.v != null && (f.dinero || f.v >= 1000 || (f.v >= 50 && fichas[k - 1] && /^(a|de|por|en)$/.test(fichas[k - 1].n))); }).length;
    var lugar0 = hiLugar(todo), compro = /(?:^| )(compre|compramos|lleve|llevamos|hice (?:el )?mercado|hicimos (?:el )?mercado|mercado|mercamos|merque)(?= |$)/.test(todo);
    var partes = hiPartes(fichas);
    // Solo si de verdad es una historia: varios montos o una compra con varios productos. Lo corto lo entiende chEntender.
    var productosSueltos = partes.filter(function (p) { var x = hiProducto(p); return x.nombre && !HI_GENERICO.test(nrm(x.nombre)); }).length;
    if (!(dineros >= 3 || (dineros >= 2 && (lugar0 || compro || original.length > 70)) || ((lugar0 || compro) && precios >= 2 && productosSueltos >= 2) || ((lugar0 || compro) && productosSueltos >= 3 && dineros >= 1))) return null;

    var fe = chFecha(prNorm(todo)), cuTodo = null, comp = chCompartido(prNorm(todo));
    if (comp && !comp.quien) { var mq = /(?:mitad|entre \w+)[^.,;]*? (mi|mis) ([a-z]+(?: y [a-z]+)?)(?= |$)/.exec(prNorm(todo)); if (mq) comp.quien = mq[1] + " " + mq[2]; }
    var lugares = [], aparte = [], actual = null, ultimoItem = null, enLista = false, metodoTxt = "";
    function nuevoLugar(L) { var o = { nombre: L ? L.nombre : "", cat: L ? L.cat : "", items: [], total: null, aprox: false, vueltas: 0, dio: 0, desc: 0, aportes: [], cuenta: "" }; lugares.push(o); return o; }
    partes.forEach(function (p) {
      var n = hiTexto(p), pn = prNorm(n), L = hiLugar(n), dinero = p.filter(function (f) { return f.v != null && (f.dinero || f.v >= 50); });
      var cu = chCuentaDe(pn);
      // El lugar puede llegar al final ("…y un aceite, en el Surtimax"): lo que venía sin lugar es de ese lugar
      if (L && actual && !actual.nombre) { actual.nombre = L.nombre; actual.cat = L.cat; }
      else if (L && (!actual || actual.nombre !== L.nombre)) actual = nuevoLugar(L);
      if (L) { var quitar = L.txt.trim().split(" "); p = p.filter(function (f) { var k = quitar.indexOf(f.n); if (k > -1 && f.v == null) { quitar.splice(k, 1); return false; } return true; }); }
      p = p.filter(function (f, k) { return !(HI_PERSONAS.test(f.n) && p[k - 1] && /^(mi|mis|la|el|los|las|con|su|sus|tu)$/.test(p[k - 1].n)); });
      if (HI_COMPRA.test(pn)) enLista = true;
      if (chCompartido(pn) && !p.some(function (f) { return f.v != null && f.v >= 1000; })) return;   // "la mitad la paga mi hermana": ya se tuvo en cuenta
      var pago = /(?:^| )(?:con|por|desde|usando|en|via)(?: la| el| mi| mis| una| un)? (nequi|daviplata|davi plata|tarjeta(?: de credito| debito| de debito)?|credito|debito|efectivo|cash|transferencia|bre-?b|llave|qr|pse|datafono|la de credito|la debito|billetera)(?= |$)/.exec(prNorm(hiTexto(p)));
      if (pago) { var qp = pago[0].trim().split(" "); p = p.filter(function (f) { var k2 = qp.indexOf(f.n); if (k2 > -1 && f.v == null) { qp.splice(k2, 1); return false; } return true; }); }
      if (pago && !cu) { metodoTxt = metodoTxt || pago[1]; }
      var m;
      // Con qué se pagó: "todo con Nequi", "pagué con la tarjeta"
      if ((cu || pago) && !p.some(function (f) { return f.v != null; }) && !hiProducto(p).nombre) {
        if (!cu) return;
        if (!actual && !ultimoItem) cuTodo = cu.id;
        if (ultimoItem && ultimoItem.aparte) ultimoItem.cuenta = cu.id; else if (actual) actual.cuenta = cu.id;
        return;
      }
      // Vueltas y billete: "me dieron 2 mil de vueltas", "pagué con un billete de 50"
      if (/(?:^| )(vueltas?|vuelto|cambio|me devolvieron|me regresaron|devuelta)(?= |$)/.test(pn) && dinero.length && !HI_APARTE.test(" " + pn + " ")) { if (!actual) actual = nuevoLugar(null); actual.vueltas += dinero[dinero.length - 1].v; return; }
      if ((m = /(?:^| )(?:con )?(?:un |una )?billete de (\d+)(?= |$)/.exec(pn)) || (m = /(?:^| )(?:pague|pagamos|pago|di|dimos) con (?:un |una )?(\d{4,})(?= |$)/.exec(pn))) { if (!actual) actual = nuevoLugar(null); var b = +m[1]; actual.dio = b < 1000 ? b * 1000 : b; if (cu) actual.cuenta = cu.id; return; }
      // Descuento
      if (/(?:^| )(descuento|rebaja|rebajaron|descontaron|promocion|cupon)(?= |$)/.test(pn) && dinero.length) { if (!actual) actual = nuevoLugar(null); actual.desc += dinero[0].v; return; }
      // Lo que puso otra persona: "mi esposa puso 20 mil", "mi mamá me dio 10 mil para el mercado"
      if ((m = /(?:^| )((?:mi |la |el )?[a-z]+)(?: me)? (puso|pusieron|aporto|me dio|me dieron|me paso|pago la mitad|pago una parte|colaboro)(?= |$)/.exec(pn)) && dinero.length && !/^(yo|me|se|le|nos|que)$/.test(m[1])) {
        if (!actual) actual = nuevoLugar(null);
        var quien = m[1].replace(/^(la|el) /, "").split(" ").map(function (w) { return (chNombre(w, original) || w).toLowerCase(); }).join(" "); actual.aportes.push({ quien: hiCap(quien), m: dinero[0].v }); return;
      }
      // El total: "fueron 27 mil", "en total 80 mil", "me cobraron 45.000", "el mercado me salió en 150 mil"
      var prod = hiProducto(p);
      var esTotal = dinero.length && (/(?:^| )(en total|total|todo|fueron|fue|salio|me salio|nos salio|cobraron|me cobraron|nos cobraron|la cuenta|la factura|pague|pagamos|gaste|gastamos|me gaste|nos gastamos)(?= |$)/.test(pn))
        && (!prod.nombre || HI_GENERICO.test(nrm(prod.nombre)) || (actual && nrm(prod.nombre) === nrm(actual.nombre)));
      if (esTotal && !HI_APARTE.test(pn)) {
        if (!actual) actual = nuevoLugar(null);
        actual.total = dinero[dinero.length - 1].v; actual.aprox = /(?:^| )(como|mas o menos|casi|aproximadamente|aprox|unos|alrededor|por ahi)(?= |$)/.test(pn);
        if (cu) actual.cuenta = cu.id; return;
      }
      if (!prod.nombre && !dinero.length) return;
      // Un gasto aparte: taxi, parqueadero, propina, almuerzo afuera…
      if (prod.nombre && HI_APARTE.test(" " + prNorm(prod.texto) + " ")) {
        var clave = HI_APARTE.exec(" " + prNorm(prod.texto) + " ")[1], k = chCategoria(prNorm(prod.texto));
        var NOMBRES = { almorce: "Almuerzo", almorzamos: "Almuerzo", desayune: "Desayuno", desayunamos: "Desayuno", comimos: "Comida", cenamos: "Cena", cene: "Cena", "nos tomamos": "Algo de tomar", tomamos: "Algo de tomar", tanqueada: "Gasolina", tanqueamos: "Gasolina", tanquee: "Gasolina", domiciliario: "Domicilio", cuidacarros: "Cuidacarros", celador: "Cuidacarros", "el que cuida": "Cuidacarros", boleta: "Cine", boletas: "Cine", pasajes: "Pasajes" };
        var resto = /^(me tome|me comi|nos comimos)$/.test(clave) ? prNorm(prod.nombre).replace(/^(?:me |nos )?(?:tome|comi|comimos)\s*/, "").replace(/^(un|una|unos|unas|el|la)\s+/, "") : "";
        var nom = resto ? hiCap(resto) : NOMBRES[clave] || hiCap(clave);
        if (/^(almorce|almorzamos|almuerzo|desayune|desayunamos|comimos|cenamos|cene)$/.test(clave) && !k.cat) k = { cat: "alimentacion" };
        if (/propina|cuidacarros|celador|el que cuida/.test(prNorm(prod.texto))) k = { cat: /cuidacarros|cuida/.test(prNorm(prod.texto)) ? "transporte" : "otros" };
        var it = { t: "g", c: nom, cat: k.cat, m: prod.m || (dinero[0] ? dinero[0].v : 0), cuenta: cu ? cu.id : "", aparte: true, det: [] };
        aparte.push(it); ultimoItem = it; return;
      }
      // Un producto (o varios, si la frase trae solo nombres: "pan, leche y huevos" ya viene separado)
      if (!prod.nombre && dinero.length && ultimoItem && !ultimoItem.m && !ultimoItem.aparte) { ultimoItem.m = dinero[0].v; ultimoItem.precio = dinero[0].v; return; }
      if (!prod.nombre) return;
      if (HI_GENERICO.test(nrm(prod.nombre)) && (!dinero.length || !/^(mercado|mercadito|compra|compras|la compra|surtido|el surtido|mercado del mes|mercado de la semana)$/.test(nrm(prod.nombre)))) { if (dinero.length) { if (!actual) actual = nuevoLugar(null); actual.total = dinero[0].v; } return; }
      // Sin precio, solo cuenta como producto si viene en la lista de lo que compró o si es algo que se reconoce
      var palabras = prod.nombre.split(/\s+/).length, reconocido = /^(vocabulario|aprendida)$/.test(chCategoria(prNorm(prod.nombre)).por);
      if (!prod.m && !(reconocido || (enLista && palabras <= 4))) { if (palabras > 5) enLista = false; return; }
      if (!actual) actual = nuevoLugar(null);
      var cat = chCategoria(prNorm(prod.nombre)).cat;
      var item = { n: hiCap(prod.nombre), q: hiCantidadTxt(prod), m: prod.m, cat: cat, unit: prod.unit };
      if (cu) actual.cuenta = actual.cuenta || cu.id;
      actual.items.push(item); ultimoItem = item;
    });
    // --- Cuentas de cada lugar ---
    var movs = [], preguntas = [];
    lugares.forEach(function (L) {
      if (!L.items.length && L.total == null && !L.dio) return;
      var catBase = L.cat || "";
      if (!catBase) { var cnt = {}; L.items.forEach(function (x) { if (x.cat) cnt[x.cat] = (cnt[x.cat] || 0) + 1; }); catBase = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0] || "alimentacion"; }
      // En una tienda, un producto no es un recibo ni una deuda: "agua" es agua en botella, no el recibo del agua
      L.items.forEach(function (x) { if (!x.cat || /^(servicios|deudas|ahorro|transporte)$/.test(x.cat)) x.cat = catBase; });
      // En la droguería, el champú o la crema dental van con la compra; no se parte el recibo por eso
      if (catBase === "salud") L.items.forEach(function (x) { if (x.cat === "compras") x.cat = catBase; });
      var suma = L.items.reduce(function (s, x) { return s + (x.m || 0); }, 0), sinPrecio = L.items.filter(function (x) { return !x.m; });
      var total = L.total != null ? L.total : (L.dio && L.vueltas ? L.dio - L.vueltas : null);
      if (total == null && L.dio && !L.vueltas) total = L.dio;
      var conflicto = null;
      if (total != null && L.aprox && suma > 0 && Math.abs(total - suma) <= total * 0.1) total = suma;
      var todosSinPrecio = L.items.length > 0 && sinPrecio.length === L.items.length;
      if (total != null && todosSinPrecio) { /* "compré pan, leche y huevos; me cobraron 15 mil": el total es la compra */ }
      else if (total != null) {
        if (L.desc && L.total == null) total -= L.desc;
        if (total > suma) {
          var resto = total - suma;
          if (sinPrecio.length === 1) { sinPrecio[0].m = resto; sinPrecio[0].deducido = true; }
          else if (sinPrecio.length > 1) { sinPrecio.forEach(function (x) { x.junto = true; }); L.items.push({ n: "Lo demás (" + sinPrecio.map(function (x) { return x.n.toLowerCase(); }).join(", ") + ")", m: resto, cat: catBase, deducido: true }); L.items = L.items.filter(function (x) { return !x.junto; }); }
          else if (L.items.length) L.items.push({ n: resto <= Math.max(1000, total * 0.03) ? "Otros (bolsa, redondeo…)" : "Otras cosas", m: resto, cat: catBase, resto: true });
        } else if (total < suma) {
          if (L.aprox) total = suma; else conflicto = { suma: suma, total: total };
        }
        if (sinPrecio.length && total <= suma && !conflicto) sinPrecio.forEach(function (x) { x.falta = true; });
      } else {
        total = suma - (L.desc || 0);
        sinPrecio.forEach(function (x) { x.falta = true; });
      }
      // Una compra por categoría (el mercado aparte de la comida del perro), con el mismo lugar y medio de pago
      var grupos = {}, orden = [];
      L.items.forEach(function (x) { if (!grupos[x.cat]) { grupos[x.cat] = []; orden.push(x.cat); } grupos[x.cat].push(x); });
      if (!orden.length) { grupos[catBase] = []; orden.push(catBase); }
      orden.sort(function (a, b) { return (a === catBase ? -1 : 0) - (b === catBase ? -1 : 0); });
      var aporte = L.aportes.reduce(function (s, a) { return s + a.m; }, 0);
      orden.forEach(function (cat, gi) {
        var lista = grupos[cat], m = lista.reduce(function (s, x) { return s + (x.m || 0); }, 0);
        if (gi === 0) {
          if (conflicto) m += conflicto.total - conflicto.suma;   // por defecto, lo que dijo que pagó; se le pregunta
          if (!lista.length || todosSinPrecio) m = total;
          if (L.desc && L.total == null && L.items.length) m -= L.desc;
          m -= aporte;
        }
        var nomCat = (catById(cat) || { name: "Compra" }).name, sitio = L.nombre;
        var c = cat === "alimentacion" && (lista.length > 1 || !lista.length) ? (sitio ? "Mercado en " + sitio : "Mercado") : lista.length === 1 ? lista[0].n + (sitio ? " en " + sitio : "") : nomCat + (sitio ? " en " + sitio : "");
        movs.push({ t: "g", c: c.slice(0, 80), cat: cat, m: Math.max(0, Math.round(m)), cuenta: L.cuenta || cuTodo || "", lugar: sitio, det: lista.map(function (x) { return { n: x.n, q: x.q || "", m: x.m || 0, falta: !!x.falta, deducido: !!x.deducido }; }),
          conflicto: gi === 0 ? conflicto : null, aportes: gi === 0 ? L.aportes : [], vueltas: gi === 0 ? L.vueltas : 0, dio: gi === 0 ? L.dio : 0, desc: gi === 0 ? L.desc : 0, comp: comp && gi === 0 ? { partes: comp.partes, quien: hiCap(comp.quien.split(" ").map(function (w) { return chNombre(w, original).toLowerCase() || w; }).join(" ")) } : null });
      });
    });
    aparte.forEach(function (x) { movs.push({ t: "g", c: x.c, cat: x.cat || "", m: x.m || 0, cuenta: x.cuenta || (lugares.length ? "" : cuTodo) || "", lugar: "", det: [], aparte: true }); });
    movs.forEach(function (x) { x.f = fe ? fe.f : ""; });
    if (!movs.length) return null;
    return { movs: movs, fecha: fe ? fe.f : "", texto: original };
  }
  // --- La historia en la charla: lo que entendí, lo que me falta saber y lo que se pregunta después ---
  function chHistoriaEmpezar(hi) {
    CH.historia = { diferidos: [] };
    CH.items = hi.movs.map(function (r) {
      var x = chItem(r); x.det = (r.det || []).map(function (d) { return { n: d.n, q: d.q, m: d.m, falta: d.falta, deducido: d.deducido }; });
      x.lugar = r.lugar || ""; x.conflicto = r.conflicto || null; x.aportes = r.aportes || []; x.vueltas = r.vueltas || 0; x.dio = r.dio || 0; x.desc = r.desc || 0; x.aparte = !!r.aparte;
      return x;
    });
    CH.idx = 0;
    var lugares = CH.items.filter(function (x) { return x.lugar; }).map(function (x) { return x.lugar; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var prods = CH.items.reduce(function (s, x) { return s + x.det.length; }, 0), apartes = CH.items.filter(function (x) { return x.aparte; });
    var partes = [];
    if (prods) partes.push(pl2(prods, "producto", "productos") + (lugares.length ? " en " + lugares.map(esc).join(" y ") : ""));
    if (apartes.length) partes.push(apartes.map(function (x) { return esc(x.c.toLowerCase()); }).join(", ").replace(/, ([^,]*)$/, " y $1"));
    chMsg("app", "<p>Te entendí todo: " + (partes.join(", y aparte ") || "tu compra") + ".</p>");
    chHistoriaSiguiente();
  }
  function chHistoriaSiguiente() {
    for (var i = 0; i < CH.items.length; i++) {
      var x = CH.items[i]; CH.idx = i;
      if (x.conflicto) {
        CH.paso = "hi-total";
        chMsg("app", "En " + esc(x.lugar || "la compra") + " los productos suman <b>" + money(x.conflicto.suma) + "</b>, pero me dijiste que pagaste <b>" + money(x.conflicto.total) + "</b>. ¿Cuál anoto?");
        return chChips([{ t: "Lo que pagué: " + money(x.conflicto.total), v: "hi:total:" + x.conflicto.total, si: true }, { t: "La suma: " + money(x.conflicto.suma), v: "hi:total:" + x.conflicto.suma }]);
      }
      var k = x.det.findIndex(function (d) { return d.falta && !d.despues; });
      if (k > -1) {
        CH.paso = "hi-precio"; CH.hiDet = k;
        var d = x.det[k];
        chMsg("app", "¿Cuánto pagaste por <b>" + esc((d.q ? d.q.replace(" ×", "") + " " : "") + d.n.toLowerCase()) + "</b>" + (x.lugar ? " en " + esc(x.lugar) : "") + "?");
        var usual = chPrecioUsual(d.n), ops = [2000, 5000, 10000].filter(function (v) { return v !== usual; });
        return chChips((usual ? [{ t: "Como siempre: " + money(usual), v: "hi:monto:" + usual, si: true }] : []).concat(ops.map(function (v) { return { t: money(v), v: "hi:monto:" + v }; }),
          [{ t: "Te digo después", v: "hi:despues" }, { t: "No me acuerdo", v: "hi:nose" }]));
      }
      if (!x.m && x.det.length && x.det.every(function (d) { return d.despues; })) {
        // No sé nada del precio: la compra entera queda para después
        CH.historia.diferidos.push(x); CH.items.splice(i, 1); i--; continue;
      }
    }
    if (!CH.items.length) {
      var n = CH.historia.diferidos.length; chHistoriaDudas([]);
      chMsg("app", "Listo, " + (n === 1 ? "esa compra" : "esas compras") + " te la pregunto después. Cuando me digas cuánto fue, la anoto.");
      chNuevo(); return chChips([{ t: "Anotar otro", v: "otro" }, { t: "Cerrar", v: "cerrar" }]);
    }
    chSiguiente();
  }
  function chHistoriaRespuesta(texto) {
    var base = chNumeros(nrm(texto)), n = prNorm(base), x = CH.items[CH.idx]; if (!x) return chSiguiente();
    if (CH.paso === "hi-total") {
      var v = prMonto(base); if (!v && /lo que pague|lo pagado|pague/.test(n)) v = x.conflicto.total; if (!v && /suma/.test(n)) v = x.conflicto.suma;
      if (!v) { chMsg("app", "¿Cuál de los dos anoto? Puedes escribir el valor."); return; }
      return chHistoriaTotal(v);
    }
    if (CH.paso === "hi-precio") {
      if (/(?:^| )(despues|luego|mas tarde|ahorita no|ahora no)(?= |$)/.test(n)) return chHistoriaPrecio("despues");
      if (/(?:^| )(no se|no me acuerdo|ni idea|no recuerdo|olvide)(?= |$)/.test(n)) return chHistoriaPrecio("nose");
      var m = prMonto(base); if (!m && /^\d{1,3}$/.test(n)) m = +n * 1000;
      if (m) return chHistoriaPrecio(m);
      chMsg("app", "Dime cuánto fue, por ejemplo <b>$ 3.500</b>, o toca <b>Te digo después</b>."); return;
    }
  }
  function chHistoriaTotal(v) {
    var x = CH.items[CH.idx], c = x.conflicto; x.conflicto = null;
    x.m += v - c.total; chMsg("yo", money(v));
    if (v === c.suma) x.det = x.det.filter(function (d) { return !d.resto; });
    chHistoriaSiguiente();
  }
  function chHistoriaPrecio(v) {
    var x = CH.items[CH.idx], d = x.det[CH.hiDet]; if (!d) return chHistoriaSiguiente();
    if (v === "despues") { chMsg("yo", "Te digo después"); d.despues = true; }
    else if (v === "nose") { chMsg("yo", "No me acuerdo"); d.falta = false; }
    else { chMsg("yo", money(v)); d.m = v; d.falta = false; x.m += v; }
    chHistoriaSiguiente();
  }
  // El precio que suele tener un producto, según lo que la persona ha contado antes
  function chPrecioUsual(nombre) {
    var k = nrm(nombre), cnt = {}, mejor = 0, veces = 0;
    state.movs.forEach(function (mv) { (mv.det || []).forEach(function (d) { if (nrm(d.n) === k && d.m > 0 && !d.q) { cnt[d.m] = (cnt[d.m] || 0) + 1; if (cnt[d.m] > veces) { veces = cnt[d.m]; mejor = d.m; } } }); });
    return mejor;
  }

  // ===================== Preguntas pendientes: lo que me faltó saber, para preguntarlo después =====================
  // Se guardan en el dispositivo. Al servidor solo va cuántas hay (sin su contenido), para que el aviso llegue
  // de vez en cuando: máximo una vez cada dos días, a la hora del almuerzo y solo si ese día no abriste la app.
  function dudasVigentes() {
    var lim = Date.now() - 10 * 864e5, antes = state.dudas.length;
    state.dudas = state.dudas.filter(function (d) { return d.cr > lim; });
    if (state.dudas.length !== antes) changed();
    return state.dudas;
  }
  function dudaTexto(d, corto) {
    var f = chFechaTxt(d.f) || "hoy", donde = d.lugar ? " en " + d.lugar : "";
    if (d.k === "nuevo") return corto ? "¿Cuánto fue lo de " + d.c.toLowerCase() + "?" : "¿Cuánto fue " + (d.c ? "lo de <b>" + esc(d.c.toLowerCase()) + "</b>" : "la compra") + " (" + esc(f) + ")?";
    return corto ? "¿Cuánto pagaste por " + d.n.toLowerCase() + donde + "?" : "¿Cuánto pagaste por <b>" + esc((d.q ? d.q.replace(" ×", "") + " " : "") + d.n.toLowerCase()) + "</b>" + esc(donde) + " (" + esc(f) + ")?";
  }
  // Crea las preguntas de lo que quedó para después (después de guardar, con el id de cada movimiento)
  function chHistoriaDudas(guardados) {
    if (!CH || !CH.historia) return 0;
    var n = 0;
    guardados.forEach(function (g) {
      (g.item.det || []).forEach(function (d) {
        if (!d.despues || !g.mov) return;
        state.dudas.push({ id: rid("d"), k: "precio", mov: g.mov.id, n: d.n.slice(0, 40), q: d.q || "", lugar: (g.item.lugar || "").slice(0, 40), f: g.mov.f, cuenta: g.item.cuenta || "", cr: Date.now() }); n++;
      });
    });
    CH.historia.diferidos.forEach(function (x) {
      state.dudas.push({ id: rid("d"), k: "nuevo", mov: "", n: "", c: (x.c || "Compra").slice(0, 80), cat: x.cat || "", lugar: (x.lugar || "").slice(0, 40), f: x.f || hoyStr(), cuenta: x.cuenta || "", det: x.det.map(function (d) { return { n: d.n, q: d.q, m: 0 }; }).slice(0, 25), cr: Date.now() }); n++;
    });
    CH.historia.diferidos = [];
    state.dudas = state.dudas.slice(-20);
    if (n) { changed(); renderDudas(); }
    return n;
  }
  function renderDudas() {
    var l = dudasVigentes(), d = l[0];
    $("dudas-card").hidden = !l.length;
    if (d) {
      $("dudas-t").textContent = l.length === 1 ? "Me quedó una pregunta" : "Me quedaron " + l.length + " preguntas";
      $("dudas-s").textContent = dudaTexto(d, true);
    }
    if (WEB) {
      idbEscribir("dudas", { n: l.length, txt: d ? dudaTexto(d, true) : "", t: Date.now() }).catch(function () {});
      programarAvisos();
    }
  }
  function abrirDudas() {
    if ($("dlg-charla").hidden) abrirCharla();
    chDudaPreguntar(true);
  }
  function chDudaPreguntar(primera) {
    var l = dudasVigentes(), d = l[0];
    if (!d) { CH.paso = "inicio"; chMsg("app", "No me queda ninguna pregunta. ¡Gracias por ayudarme!"); return chInicioChips(); }
    CH.paso = "duda"; CH.duda = d.id;
    chMsg("app", (primera ? (l.length === 1 ? "Me quedó una pregunta de lo que me contaste. " : "Me quedaron " + l.length + " preguntas. ") : "") + dudaTexto(d, false));
    var usual = d.k === "precio" ? chPrecioUsual(d.n) : 0, ops = (d.k === "nuevo" ? [20000, 50000, 100000] : [2000, 5000, 10000]).filter(function (v) { return v !== usual; });
    chChips((usual ? [{ t: "Como siempre: " + money(usual), v: "duda:monto:" + usual, si: true }] : []).concat(ops.map(function (v) { return { t: money(v), v: "duda:monto:" + v }; }),
      [{ t: "No me acuerdo", v: "duda:nose" }, { t: "Después", v: "duda:despues" }]));
  }
  function chDudaRespuesta(texto) {
    var base = chNumeros(nrm(texto)), n = prNorm(base);
    if (/(?:^| )(despues|luego|mas tarde|ahora no)(?= |$)/.test(n)) return chDudaAccion("despues");
    if (/(?:^| )(no se|no me acuerdo|ni idea|no recuerdo|olvide|olvidalo)(?= |$)/.test(n)) return chDudaAccion("nose");
    var m = prMonto(base); if (!m && /^\d{1,3}$/.test(n)) m = +n * 1000;
    if (m) return chDudaAccion(m);
    chMsg("app", "Dime el valor, por ejemplo <b>$ 3.500</b>, o toca <b>Después</b>.");
  }
  function chDudaAccion(v) {
    var d = state.dudas.find(function (x) { return x.id === CH.duda; }); if (!d) return chDudaPreguntar(false);
    if (v === "despues") { chMsg("yo", "Después"); chMsg("app", "Listo, te pregunto otro día. Sin afán."); CH.paso = "inicio"; return chChips([{ t: "Anotar otro", v: "otro" }, { t: "Cerrar", v: "cerrar" }]); }
    state.dudas = state.dudas.filter(function (x) { return x.id !== d.id; });
    if (v === "nose") { chMsg("yo", "No me acuerdo"); chMsg("app", "Tranquilidad, lo dejo así."); changed(); renderDudas(); return chDudaPreguntar(false); }
    chMsg("yo", money(v));
    if (d.k === "nuevo") {
      changed(); renderDudas();
      CH.items = [chItem({ t: "g", m: v, cat: d.cat, c: d.c, f: d.f, cuenta: d.cuenta })]; CH.items[0].det = (d.det || []).map(function (x) { return { n: x.n, q: x.q, m: 0 }; }); CH.items[0].lugar = d.lugar; CH.idx = 0;
      return chSiguiente();
    }
    var mv = state.movs.find(function (x) { return x.id === d.mov; });
    if (mv) {
      mv.m += v;
      (mv.det || []).forEach(function (x) { if (nrm(x.n) === nrm(d.n) && !x.m) x.m = v; });
      var k = mv.f.slice(0, 7), mes = state.meses[k], fila = mes && chFila("g", mv.cat, mv.c, mes);
      if (fila) fila.real += v;
      var acc = d.cuenta ? cuentaById(d.cuenta) : null; if (acc) acc.saldo += signoCuenta(acc, "gasto") * v;
      chMsg("app", "Listo, sumé " + money(v) + ". " + esc(mv.c) + " queda en " + money(mv.m) + ".");
    }
    changed(); renderIngresos(); renderGastos(); recompute(); renderCuentas(); renderDudas();
    chDudaPreguntar(false);
  }
  window.FinCuentaNombre = function (id) { var a = cuentaById(id); return a ? a.nombre : ""; };
  window.FinHistoria = function (t) { var h = chHistoria(t); return h ? JSON.parse(JSON.stringify(h)) : null; };
  window.FinEntender = function (t) { return JSON.parse(JSON.stringify(chEntenderTodo(t))); };
  window.FinIdeas = function () { return analizarMes().recs.map(function (r) { return r.clave; }); };
  window.FinVocabulario = function () { return chPalabrasConocidas(); };
  window.FinClasificar = function (t) { return prClasificar(prArreglarPregunta(prNorm(t))); };
  window.FinIntencion = function (t) { PR.espera = null; PR.ctx = null; var r = prEntender(t); return { intent: r.intent || (r.fn ? "fn" : ""), cat: r.q ? r.q.cat : "", monto: r.q ? r.q.monto : 0 }; };


  function chFila(t, cat, concepto, mes) {
    mes = mes || cur();
    var lista = t === "i" ? mes.ingresos : mes.gastos, n = nrm(concepto);
    var igual = n && lista.find(function (x) { return nrm(x.concepto) === n; });
    if (igual || t === "i") return igual || lista.find(function (x) { return /otros ingresos|extra|independ/.test(nrm(x.concepto)); }) || null;
    return lista.find(function (x) { return x.cat === cat && !x.dia; }) || lista.find(function (x) { return x.cat === cat; }) || null;
  }
  function chMsg(quien, html) {
    var d = document.createElement("div"); d.className = "pr-msg " + quien; d.innerHTML = html;
    $("ch-log").appendChild(d); $("ch-log").scrollTop = $("ch-log").scrollHeight;
  }
  function chChips(lista) {
    $("ch-chips").innerHTML = lista.map(function (x) { return '<button type="button" class="pr-chip' + (x.si ? " si" : "") + (x.col ? " con-marca" : "") + '" data-ch="' + esc(x.v) + '">' + (x.col ? '<i class="ch-marca" style="--m:' + x.col + '" aria-hidden="true"></i>' : "") + esc(x.t) + "</button>"; }).join("");
  }
  function chEfectivoId() { var e = cuentaEfectivo(false); return e ? e.id : ""; }
  // Cuentas que sirven para cada caso: un ingreso no llega a una tarjeta de crédito; una llave (Bre-B) sale de un banco o billetera.
  function chCuentasPara(x) {
    return state.cuentas.filter(function (c) { return x.t === "i" ? c.tipo !== "tarjeta" : x.llave ? c.tipo !== "efectivo" && c.tipo !== "tarjeta" : true; });
  }
  function chCuentaUsual(x) {
    for (var i = state.movs.length - 1; i >= 0; i--) { var m = state.movs[i]; if (m.cu && (x.t === "i" ? m.t === "i" : m.t === "g" && m.cat === x.cat) && cuentaById(m.cu)) return m.cu; }
    return "";
  }
  // Una respuesta escrita a "¿Con qué pagaste?": "nequi", "la tarjeta", "en efectivo", o el nombre de la cuenta.
  function chCuentaSola(n, x) {
    var ops = chCuentasPara(x || {}), w = " " + n + " ";
    return ops.filter(function (c) { var nm = prNorm(c.nombre); return nm && (w.indexOf(" " + nm + " ") > -1 || (n.length >= 3 && nm.indexOf(n) === 0)); })[0] ||
      ops.filter(function (c) { return (CH_TIPO_PAL[c.tipo] || "").split("|").some(function (p) { return p && w.indexOf(" " + p + " ") > -1; }); })[0] || null;
  }
  function chNuevo() { CH = { items: [], paso: "inicio", idx: 0, cuadre: CH && CH.cuadre || null, frec: CH ? CH.frec : [] }; }
  function chItem(o) {
    // Sin cuenta dicha queda vacía: Finti pregunta con qué se pagó (nunca supone efectivo).
    return { t: o.t || "g", m: o.m || 0, cat: o.cat || "", c: o.c || "", f: o.f || "", cuenta: o.cuenta || "", llave: !!o.llave, comp: o.comp || null, quien: o.quien || "", aprender: !!o.aprender };
  }

  // --- Lo que repites: mismo concepto y mismo valor al menos dos veces en los últimos 90 días ---
  function chFrecuentes(n) {
    var desde = hoyStr(new Date(Date.now() - 90 * 864e5)), cuenta = {};
    state.movs.forEach(function (x) {
      if (x.t !== "g" || !x.c || x.f < desde) return;
      var k = nrm(x.c) + "|" + x.m, o = cuenta[k] || (cuenta[k] = { c: x.c, m: x.m, cat: x.cat, n: 0, ult: "" });
      o.n++; if (x.f > o.ult) o.ult = x.f;
    });
    return Object.keys(cuenta).map(function (k) { return cuenta[k]; }).filter(function (o) { return o.n >= 2; })
      .sort(function (a, b) { return b.n - a.n || (b.ult > a.ult ? 1 : -1); }).slice(0, n || 3);
  }
  function chMontoUsual(concepto) {
    var n = nrm(concepto), cnt = {}, mejor = 0, veces = 0;
    if (!n) return 0;
    state.movs.forEach(function (x) { if (x.t === "g" && nrm(x.c) === n) { cnt[x.m] = (cnt[x.m] || 0) + 1; if (cnt[x.m] > veces) { veces = cnt[x.m]; mejor = x.m; } } });
    return mejor;
  }
  function chAyer() { var a = hoyStr(new Date(Date.now() - 864e5)); return state.movs.filter(function (x) { return x.f === a && x.t === "g"; }); }

  function abrirCharla(dicho) {
    var e0 = state.cuentas.length; if (!cuentaEfectivo(false)) { cuentaEfectivo(true); if (state.cuentas.length !== e0) { changed(); renderCuentas(); } }
    CH = null; chNuevo(); $("ch-log").innerHTML = ""; $("ch-input").value = "";
    $("ch-voz").hidden = false; $("ch-cam").hidden = !ocrPosible();   // el micrófono siempre se ve: si no hay voz dentro del navegador, se dicta con el teclado
    chMsg("app", "<p>¿En qué gastaste y cuánto fue? Escríbemelo o dímelo con el micrófono, por ejemplo: <b>$ 18.000 en almuerzo</b>. También puedes contarme todo tu mercado, producto por producto." +
      ($("ch-cam").hidden ? "" : " También puedo leer la foto de una tirilla.") + "</p>");
    chInicioChips();
    openDlg("dlg-charla", "#ch-input"); sonar("soplo");
    if (dicho) setTimeout(function () { chUsuario(dicho); }, 250);
  }
  function chInicioChips() {
    CH.frec = chFrecuentes(3);
    var l = CH.frec.map(function (o, i) { return { t: o.c + " · " + money(o.m), v: "frec:" + i }; });
    if (!l.length) l = cur().gastos.filter(function (x) { return !x.dia && (catById(x.cat) || { group: "gus" }).group !== "aho"; }).slice(0, 2).map(function (x) { return { t: x.concepto, v: "fila:" + x.id }; });
    if (chAyer().length) l.push({ t: "Lo mismo de ayer", v: "ayer" });
    l.push({ t: "Cuadrar mi billetera", v: "cuadre" }, { t: "Me entró plata", v: "ingreso" });
    var nd = dudasVigentes().length; if (nd) l.unshift({ t: nd === 1 ? "Responder mi pregunta" : "Responder mis " + nd + " preguntas", v: "dudas", si: true });
    chChips(l);
  }

  // --- Lo que la persona escribe o dice ---
  function chUsuario(texto) {
    texto = String(texto || "").trim().slice(0, 800); if (!texto) return;
    chMsg("yo", esc(texto));
    if (!/^(si|no|listo|ok|dale|cancela|cancelar)$/.test(prNorm(texto))) CH.ultTexto = texto;
    var base = chNumeros(nrm(texto)), n = prNorm(base), it = CH.items[CH.idx];
    // "¿Cuánto tenías en Nequi antes de esto?": con eso la cuenta muestra su saldo real
    if (CH.paso === "saldo-ini" && CH.saldoIni) {
      var si0 = prMonto(base);
      if (si0 || /^(0|cero|nada)$/.test(n)) {
        var a0 = cuentaById(CH.saldoIni.acc); CH.paso = "inicio";
        if (a0) { a0.saldo = Math.round(si0 || 0) + CH.saldoIni.delta; a0.ini = true; changed(); renderCuentas(); chMsg("app", "Listo: <b>" + esc(a0.nombre) + "</b> queda en <b>" + money(a0.saldo) + "</b>. Desde ahora te lo voy diciendo."); }
        CH.saldoIni = null; return chChips([{ t: "Anotar otro", v: "otro" }, { t: "Cerrar", v: "cerrar" }]);
      }
      CH.paso = "inicio"; CH.saldoIni = null;
    }
    // Una pregunta en medio ("¿cuánto llevo en mercado?") se responde aquí, sin perder lo que estaba por anotar
    var tPreg = texto.trim();
    if ((/\?$|^¿/.test(tPreg) || /^(cu[aá]nto|cu[aá]nta|qu[eé]|c[oó]mo|puedo|me alcanza|en qu[eé]|d[oó]nde|cu[aá]l|cu[aá]ndo)\b/i.test(tPreg)) && esPreguntaDicha(tPreg)) {
      var rq = prResponder(tPreg); chMsg("app", rq.html);
      if (CH.items.length && /^(cuenta|confirmar|monto|cat|quien)$/.test(CH.paso)) { chMsg("app", "<p>Lo de antes sigue esperando; no lo he anotado.</p>"); return chSiguiente(); }
      return chInicioChips();
    }
    if (CH.paso === "cuenta" && it && chBilleteraNueva(true)) return chSiguiente();
    // Mientras pregunto la cuenta también se puede corregir: "no, el taxi eran 15 mil", "ponlo en transporte"
    if (CH.paso === "cuenta" && CH.items.length && /^(no|nop|eran|era|fueron|fue|ponlo|ponla|pon|cambia\w*|mejor|perdon|corrige|en realidad)\b/.test(n)) {
      var rc = chEntender(texto);
      if (rc.m || rc.f || rc.comp || (rc.cat && rc.por !== "aprendida") || /\bingreso\b/.test(n)) return chCorregir(rc, n);
    }
    // Respuestas a una pregunta mía
    if (CH.paso === "cuadre") { var mm = prMonto(base); if (mm || /^(0|cero|nada)$/.test(n)) return chCuadre(mm || 0); chMsg("app", "¿Cuánto tienes en la billetera? Por ejemplo: <b>$ 45.000</b>."); return; }
    if (CH.paso === "quien" && it) {
      if (/^(nadie|yo|lo pago yo|solo yo)$/.test(n)) { it.comp = null; it.quien = ""; }
      else { var nom = chNombre(n.split(" ").filter(function (w) { return !CH_NO_NOMBRE.test(w) && CH_RELLENO.indexOf(" " + w + " ") < 0; }).slice(0, 3).join(" ").replace(/ y y /g, " y "), texto) || "Otra persona"; if (it.comp) it.comp.quien = nom; else it.quien = nom; }
      return chSiguiente();
    }
    if (/^(cancela|cancelar|olvidalo|dejalo|dejalo asi|no gracias)$/.test(n)) { chNuevo(); chMsg("app", "Listo, no anoté nada. ¿Me cuentas otro?"); return chInicioChips(); }
    if (CH.paso === "hi-total" || CH.paso === "hi-precio") return chHistoriaRespuesta(texto);
    if (CH.paso === "duda") return chDudaRespuesta(texto);
    if (CH.paso === "confirmar") {
      var r = chEntender(texto), neg = /^(no|nop|cancela|cancelar|olvidalo|nada|dejalo)\b/.test(n);
      var cambio = r.m || r.cuenta || r.f || r.comp || (r.cat && r.por !== "aprendida" ? r.cat : "") || /\bingreso\b/.test(n);
      var esCorr = /^(no|nop|eran|era|fueron|fue|ponlo|ponla|pon|cambia\w*|mejor|es|son|perdon|corrige|en realidad|y)\b/.test(n) || (!r.c && !r.cat);
      if (cambio && esCorr) return chCorregir(r, n);
      if (/^(si|sii|dale|listo|ok|okay|de una|claro|anotalo|anotalos|hagale|correcto|eso|perfecto|asi es)\b/.test(n)) return chGuardar();
      if (neg) { chNuevo(); chMsg("app", "Listo, no anoté nada. ¿Me cuentas otro?"); return chInicioChips(); }
    }
    if (CH.paso === "cat" && it) {
      var c = cats().find(function (x) { return nrm(x.name).indexOf(n) === 0 || n.indexOf(nrm(x.name).split(" ")[0]) > -1; });
      var k = c ? { cat: c.id } : chCategoria(n);
      if (k.cat) { it.cat = k.cat; it.aprender = true; return chSiguiente(); }
    }
    if (CH.paso === "monto" && it) { var mo = prMonto(base); if (mo) { it.m = mo; return chSiguiente(); } }
    if (CH.paso === "cuenta" && /^(no|nop|nada|cancela|cancelar)$/.test(n)) { chNuevo(); chMsg("app", "Listo, no anoté nada. ¿Me cuentas otro?"); return chInicioChips(); }
    if (CH.paso === "cuenta" && it) {
      var cs = chCuentaSola(n, it);
      if (cs) { var varios = CH.items.filter(function (x) { return !x.cuenta && x.t !== "d"; }).length > 1; CH.items.forEach(function (x) { if (x === it || (varios && !x.cuenta && x.t !== "d")) x.cuenta = cs.id; }); return chSiguiente(); }
    }
    // Otras cosas que entiendo
    if ((/\b(cuadr\w*)\b/.test(n) && /\b(billetera|efectivo|bolsillo|cartera|caja)\b/.test(n)) || (/\b(tengo|me queda|me quedan|quedan|hay|cargo)\b/.test(n) && /\b(billetera|bolsillo|cartera|en efectivo|en la mano)\b/.test(n))) {
      var tengo = prMonto(base); if (tengo || /\b(0|cero|nada)\b/.test(n)) return chCuadre(tengo || 0);
      CH.paso = "cuadre"; chMsg("app", "¿Cuánto tienes en la billetera ahora? Cuéntalo y dímelo."); return chChips([]);
    }
    if (/\b(lo mismo|igual|lo) (de|que) ayer\b/.test(n)) return chMismoAyer();
    if (/\b(que|cuales|las) (aprendiste|palabras)\b|\bpalabras que aprendiste\b|\blo que aprendiste\b/.test(n)) { closeDlg("dlg-charla"); return abrirAprendidas(); }
    var pm = /(?:^| )([a-z]+(?: y [a-z]+)?) (?:ya )?me (pago|pagaron|devolvio|devolvieron|consigno|giro|transfirio|cancelo)(?= |$)/.exec(n);
    if (pm && !CH_NO_NOMBRE.test(pm[1])) return chMePago(chNombre(pm[1], texto), prMonto(base), chCuentaDe(base));
    var pr = /(?:^| )le (?:preste|di prestado|di prestados)(?= |$)/.test(n) || /(?:^| )preste(?= |$)/.test(n);
    var md = /(?:^| )([a-z]+(?: y [a-z]+)?) me debe(?:n)?(?= |$)/.exec(n);
    if (pr || (md && !CH_NO_NOMBRE.test(md[1]))) {
      var nombre = md ? md[1] : ((/(?:^| )a ([a-z]+(?: y [a-z]+)?)(?= |$)/.exec(n.replace(/(?:^| )a (?:mi |la |el )/, " a ")) || [])[1] || "");
      var cu2 = chCuentaDe(base);
      CH.items = [chItem({ t: pr ? "p" : "d", m: prMonto(base), c: pr ? "Préstamo" : "Me debe", quien: chNombre(nombre, texto), cuenta: cu2 ? cu2.id : "" })]; CH.idx = 0;
      return chSiguiente();
    }
    // Una historia completa ("fui al D1 y compré…"): la entiendo parte por parte
    if (CH.paso !== "monto" && CH.paso !== "cat") { var hi = chHistoria(texto); if (hi) return chHistoriaEmpezar(hi); }
    // Gastos e ingresos
    var items = chEntenderTodo(texto);
    if (CH.paso === "monto" || CH.paso === "cat") {
      // Seguía armando un gasto: completo lo que falte con lo nuevo
      var r1 = items[0];
      if (it) { if (r1.m && !it.m) it.m = r1.m; if (r1.cat && !it.cat) it.cat = r1.cat; if (r1.c && !it.c) it.c = r1.c; if (r1.f) it.f = r1.f; if (r1.cuenta) it.cuenta = r1.cuenta; }
      if (r1.m || r1.cat) return chSiguiente();
    }
    var vacio = items.length === 1 && !items[0].m && !items[0].cat && !items[0].c;
    if (vacio) { chMsg("app", "No te entendí bien. Prueba con el monto y en qué fue, por ejemplo: <b>$ 12.000 en taxi</b>."); return chChips([{ t: "Guardar la frase para que Finti aprenda", v: "noent" }]); }
    var nuevos = items.map(function (r) {
      var x = chItem(r);
      if (x.t === "g" && !x.cat && x.c) { var f = chFila("g", "", x.c); if (f) x.cat = f.cat; }
      return x;
    });
    // Si algo estaba por anotar, no se pierde: lo nuevo se suma y se anotan juntos
    var antes = (CH.paso === "confirmar" || CH.paso === "cuenta") ? CH.items.filter(function (x) { return x.m; }) : [];
    if (antes.length) chMsg("app", "<p>Lo sumo a lo que estaba por anotar, para que no se pierda nada.</p>");
    CH.items = antes.concat(nuevos); CH.guardarAlFinal = false;
    CH.idx = 0;
    chSiguiente();
  }
  // "no, eran 15 mil", "ponlo en transporte", "fue con Nequi", "fue ayer", "es un ingreso"
  function chCorregir(r, n) {
    var i = 0;
    if (CH.items.length > 1) {
      i = CH.items.length - 1;
      CH.items.forEach(function (x, k) { if (x.c && new RegExp("(?:^| )" + prNorm(x.c).split(" ")[0] + "(?= |$)").test(n)) i = k; });
    }
    var x = CH.items[i];
    if (r.m) x.m = r.m;
    if (r.cuenta) x.cuenta = r.cuenta;
    if (r.f) x.f = r.f;
    if (r.comp) x.comp = r.comp;
    if (/\bingreso\b/.test(n) && x.t === "g") { x.t = "i"; x.cat = ""; }
    else if (r.cat && x.t === "g" && r.cat !== x.cat) { x.cat = r.cat; x.aprender = true; }
    chMsg("app", "Corregido.");
    chSiguiente();
  }

  function chMin(t) { t = String(t || ""); return t.charAt(0).toLowerCase() + t.slice(1); }
  // "con nequi" sin cuenta Nequi: la creo (sin saldo conocido) y la quito de la descripción
  var CH_BILLE = { nequi: ["Nequi", /(?:^| )(?:con|por|desde|en|de|del|usando|via)(?: la| el| mi)? nequi(?= |$)/], daviplata: ["Daviplata", /(?:^| )(?:con|por|desde|en|de|del|usando|via)(?: la| el| mi)? davi ?plata(?= |$)/] };
  function chBilleteraNueva(suelto) {
    var t = prNorm(chNumeros(nrm(CH.ultTexto || ""))), hecho = null;
    Object.keys(CH_BILLE).forEach(function (tipo) {
      var dicho = CH_BILLE[tipo][1].test(t) || (suelto && new RegExp("(?:^| )" + (tipo === "nequi" ? "nequi" : "davi ?plata") + "(?= |$)").test(t));
      if (hecho || !dicho || state.cuentas.some(function (c) { return c.tipo === tipo || /nequi|davi ?plata/.test(nrm(c.nombre)) && nrm(c.nombre).indexOf(tipo.slice(0, 4)) > -1; })) return;
      var c = { id: rid("a"), nombre: CH_BILLE[tipo][0], tipo: tipo, saldo: 0, cupo: 0, ini: false };
      state.cuentas.push(c); changed(); renderCuentas(); hecho = c;
    });
    if (hecho) CH.items.forEach(function (y) { if (!y.cuenta && y.t !== "d") { y.cuenta = hecho.id; y.c = (y.c || "").replace(/\s*\b(?:con|por|desde|en|de|del|usando|via)(?: la| el| mi)? (?:nequi|davi ?plata)\b/i, "").trim(); } });
    return hecho;
  }

  function chSiguiente() {
    for (var i = 0; i < CH.items.length; i++) {
      var x = CH.items[i]; CH.idx = i;
      var sobre = CH.items.length > 1 && x.c ? " " + esc(chMin(x.c)) : "";
      if (!x.m) {
        CH.paso = "monto";
        chMsg("app", x.t === "i" ? "¿Cuánto te entró?" : x.t === "p" ? "¿Cuánto le prestaste?" : x.t === "d" ? "¿Cuánto te debe?" : "¿Cuánto fue" + (x.c ? " " + esc(chMin(x.c)) : "") + "?");
        var usual = chMontoUsual(x.c), ops = [5000, 10000, 20000, 50000].filter(function (v) { return v !== usual; });
        return chChips((usual ? [{ t: "Como siempre: " + money(usual), v: "monto:" + usual, si: true }] : []).concat(ops.map(function (v) { return { t: money(v), v: "monto:" + v }; }), CH.ultTexto && x.c ? [{ t: "No me entendiste", v: "noent" }] : []));
      }
      if (x.t === "g" && !x.cat) {
        CH.paso = "cat";
        chMsg("app", "¿En qué categoría pongo" + (sobre || " este gasto") + "?");
        return chChips(cats().filter(function (c) { return c.group !== "aho"; }).map(function (c) { return { t: c.name, v: "cat:" + c.id }; }));
      }
      if ((x.comp && !x.comp.quien) || ((x.t === "p" || x.t === "d") && !x.quien)) {
        CH.paso = "quien";
        chMsg("app", x.t === "p" ? "¿A quién le prestaste?" : x.t === "d" ? "¿Quién te debe?" : "¿Quién te debe la otra parte (" + money(x.m - Math.round(x.m / x.comp.partes)) + ")?");
        return chChips(x.comp ? [{ t: "Varias personas", v: "quien:Varias personas" }, { t: "Nadie, lo pago yo", v: "quien:" }] : []);
      }
    }
    // ¿Con qué pagaste? Solo si hay más de una opción; la que usaste la última vez para eso sale primero (sin elegirla por ti).
    var faltan = CH.items.filter(function (x) { return !x.cuenta && x.t !== "d"; });
    if (faltan.length) { var bn = chBilleteraNueva(); if (bn) CH.creada = bn; faltan = faltan.filter(function (x) { return !x.cuenta; }); }
    if (faltan.length) {
      faltan.forEach(function (x) { var o = chCuentasPara(x); if (o.length === 1) x.cuenta = o[0].id; });
      faltan = faltan.filter(function (x) { return !x.cuenta && chCuentasPara(x).length > 1; });
      if (faltan.length) {
        var x1 = faltan[0], todos = faltan.length > 1, usual = chCuentaUsual(x1), ops = chCuentasPara(x1).slice().sort(function (a, b) { return (b.id === usual) - (a.id === usual); });
        CH.paso = "cuenta"; CH.idx = CH.items.indexOf(x1);
        // Muestra lo que entendió (sirve sobre todo si lo dijo por voz) y pregunta con qué se pagó: elegir la cuenta ya lo anota.
        var tot = faltan.reduce(function (a, x) { return a + (x.m || 0); }, 0), unoF = CH.items.length === 1;
        var pre = unoF ? (x1.t === "i" ? "Entendí este ingreso:" : x1.t === "p" ? "Entendí este préstamo:" : "Entendí este gasto:") : "Entendí estos " + CH.items.length + ":";
        var preg = todos ? "¿Con qué pagaste todo esto? Al elegir, lo anoto." : x1.t === "i" ? "¿A dónde te llegó? Al elegir, lo anoto." : x1.t === "p" ? "¿De dónde salió la plata? Al elegir, lo anoto." : x1.llave ? "¿Desde qué cuenta salió la llave? Al elegir, lo anoto." : "¿Con qué lo pagaste? Al elegir, lo anoto.";
        chMsg("app", "<p>" + pre + "</p>" + CH.items.map(chTarjeta).join("") + (!unoF ? '<p class="pr-nota">Total: <b>' + money(CH.items.reduce(function (a, x) { return a + x.m; }, 0)) + "</b></p>" : "") + "<p>" + preg + "</p>");
        CH.guardarAlFinal = true;
        var gUno = unoF && x1.t === "g";
        return chChips(ops.map(function (c) { return { t: c.nombre, v: (todos ? "cuentas:" : "cuenta:") + c.id, col: marcaCuenta(c).c }; }).concat(gUno ? [{ t: "Otra categoría", v: "otracat" }] : [], CH.ultTexto ? [{ t: "No me entendiste", v: "noent" }] : [], [{ t: "Cancelar", v: "no" }]));
      }
    }
    if (CH.guardarAlFinal) { CH.guardarAlFinal = false; return chGuardar(); }
    CH.paso = "confirmar";
    var html = CH.items.map(chTarjeta).join(""), uno = CH.items.length === 1, x0 = CH.items[0];
    var titulo = !uno ? "¿Anoto estos " + CH.items.length + "?" : x0.t === "i" ? "¿Anoto este ingreso?" : x0.t === "p" ? "¿Anoto este préstamo?" : x0.t === "d" ? "¿Anoto lo que te deben?" : "¿Anoto este gasto?";
    chMsg("app", "<p>" + titulo + "</p>" + html + (!uno ? '<p class="pr-nota">Total: <b>' + money(CH.items.reduce(function (s, x) { return s + x.m; }, 0)) + "</b></p>" : ""));
    var g = uno && x0.t === "g";
    chChips([{ t: uno ? "Sí, anótalo" : "Sí, anota los " + CH.items.length, v: "si", si: true }].concat(g ? [{ t: "Otra categoría", v: "otracat" }] : [],
      (uno && x0.t !== "d" && state.cuentas.length > 1) ? [{ t: "Otra cuenta", v: "otracuenta" }] : [], [{ t: "No me entendiste", v: "noent" }, { t: "Cancelar", v: "no" }]));
  }
  function chTarjeta(x) {
    var acc = x.cuenta ? cuentaById(x.cuenta) : null, cat = x.t === "g" ? catById(x.cat) : null, col, ic, donde, partes = [];
    if (x.t === "g") { col = catColor(x.cat); ic = catIcon(x.cat); donde = cat ? cat.name : "Otros"; }
    else if (x.t === "i") { col = "#2fbf71"; ic = ingIcon(); var fi = chFila("i", "", x.c); donde = fi ? fi.concepto : "Otros ingresos"; }
    else { col = "#38bdf8"; ic = '<span class="cat-ic" style="--c:#38bdf8"><svg class="ic"><use href="#i-wallet"/></svg></span>'; donde = x.t === "p" ? "Le prestaste a " + (x.quien || "…") : (x.quien || "…") + " te debe"; }
    partes.push(esc(donde));
    if (x.c && nrm(x.c) !== nrm(donde) && x.t !== "p" && x.t !== "d") partes.push(esc(x.c));
    if (acc && x.t !== "d") partes.push('<span class="mv-cta"><i style="--m:' + marcaCuenta(acc).c + '" aria-hidden="true"></i>' + esc(acc.nombre) + "</span>");
    var fe = chFechaTxt(x.f); if (fe) partes.push(esc(fe));
    var extra = "";
    if (x.comp) { var mia = Math.round(x.m / x.comp.partes); extra = "<small>Tu parte: <b>" + money(mia) + "</b> · " + esc(x.comp.quien || "…") + " te " + (/ y |varias/i.test(x.comp.quien) ? "deben" : "debe") + " " + money(x.m - mia) + "</small>"; }
    if (x.det && x.det.length) {
      extra += '<ul class="ch-det">' + x.det.slice(0, 25).map(function (d) {
        return "<li><span>" + (d.q ? '<i class="ch-q">' + esc(d.q) + "</i> " : "") + esc(d.n) + "</span><b>" + (d.m ? money(d.m) : d.despues ? '<i class="ch-despues">te pregunto después</i>' : d.falta === false && !d.m ? "" : "") + "</b></li>";
      }).join("") + "</ul>";
      var notas = [];
      if (x.dio && x.vueltas) notas.push("Pagaste con " + money(x.dio) + " y te dieron " + money(x.vueltas) + " de vueltas");
      if (x.desc) notas.push("Descuento de " + money(x.desc));
      (x.aportes || []).forEach(function (a) { notas.push(esc(a.quien) + " puso " + money(a.m) + "; anoto solo tu parte"); });
      if (notas.length) extra += "<small>" + notas.join(" · ") + ".</small>";
    }
    return '<div class="ch-res" style="--c:' + col + '">' + ic + '<div><b class="cifra">' + money(x.m) + "</b><small>" + partes.join(" · ") + "</small>" + extra + "</div></div>";
  }

  // --- Guardar todo lo confirmado (y poder deshacerlo) ---
  function chGuardar() {
    var deshacer = [], aprendidas = [], cuentasTocadas = {}, regAntes = state.registros.slice(), deudasAntes = state.meDeben.slice(), guardados = [];
    CH.items.forEach(function (x) {
      var acc = x.cuenta ? cuentaById(x.cuenta) : null, u = { acc: acc, accAntes: acc ? acc.saldo : 0 };
      if (x.t === "p" || x.t === "d") {
        if (x.t === "p" && acc) { acc.saldo += signoCuenta(acc, "gasto") * x.m; cuentasTocadas[acc.id] = acc; }
        state.meDeben.push({ id: rid("q"), quien: (x.quien || "Otra persona").slice(0, 40), m: x.m, c: x.t === "p" ? "Préstamo" : (x.c && x.c !== "Me debe" ? x.c : "Me debe").slice(0, 60), f: x.f || hoyStr() });
        deshacer.push(u); return;
      }
      var k = (x.f || "").slice(0, 7), mes = state.meses[k] ? state.meses[k] : cur(), lista = x.t === "i" ? mes.ingresos : mes.gastos;
      var fila = chFila(x.t, x.cat, x.c, mes), nueva = false;
      if (!fila) {
        fila = x.t === "i" ? { id: rid("i"), concepto: "Otros ingresos", plan: 0, real: 0 } : { id: rid("g"), concepto: (x.c || (catById(x.cat) || { name: "Otros" }).name).slice(0, 80), cat: x.cat || "otros", dia: 0, plan: 0, real: 0 };
        lista.push(fila); nueva = true;
      }
      var mio = x.comp ? Math.round(x.m / x.comp.partes) : x.m;
      u.lista = lista; u.fila = fila; u.nueva = nueva; u.antes = fila.real;
      fila.real += mio;
      if (acc) { acc.saldo += signoCuenta(acc, x.t === "i" ? "ingreso" : "gasto") * x.m; cuentasTocadas[acc.id] = acc; }
      u.mov = anotarMov({ t: x.t, f: x.f || "", cat: fila.cat || "", c: x.c || fila.concepto, m: mio, com: x.lugar || x.c || "", det: x.det, o: "ch", cu: acc ? acc.id : "" });
      guardados.push({ item: x, mov: u.mov });
      if (x.comp) state.meDeben.push({ id: rid("q"), quien: (x.comp.quien || "Otra persona").slice(0, 40), m: x.m - mio, c: (x.c || fila.concepto).slice(0, 60), f: x.f || hoyStr() });
      // Si me tocó preguntar la categoría (o me corrigieron), la recuerdo para esa palabra: la próxima vez ya la sé.
      if (x.t === "g" && x.aprender && x.c && x.cat && prNorm(x.c).length >= 3 && !cats().some(function (c) { return nrm(c.name) === nrm(x.c); })) {
        var clave = LECTOR.normal(x.c).slice(0, 80);
        if (state.reglas[clave] !== x.cat) { u.regla = { clave: clave, antes: state.reglas[clave] }; state.reglas[clave] = x.cat; aprendidas.push(x); }
      }
      deshacer.push(u);
    });
    marcarRegistro();
    CH_ULT = { pasos: deshacer, regAntes: regAntes, deudasAntes: deudasAntes };
    changed(); renderIngresos(); renderGastos(); recompute(); renderCuentas(); renderMeDeben();
    var x0 = CH.items[0], uno = CH.items.length === 1, txt = uno ? "Listo, quedó anotado." : "Listo, anoté los " + CH.items.length + ".", extra = "";
    if (CH.items.some(function (x) { return x.t === "g" && (!x.f || x.f === hoyStr()); })) {
      var h = hoyPuedes(totalsOf(cur()));
      if (h && h.plan) extra = h.puede > 0 ? " Hoy todavía puedes gastar <b>" + money(redondeoMil(h.puede)) + "</b>." : " Con esto hoy te pasaste un poco; tranquilidad, lo reparto en los días que quedan.";
    } else if (uno && x0.t === "i") extra = " ¡Bien!";
    var tocadas = Object.keys(cuentasTocadas).map(function (id) { return cuentasTocadas[id]; });
    var saldos = tocadas.filter(function (a) { return a.ini; }).map(function (a) { return esc(a.nombre) + " queda en " + money(a.saldo); });
    if (saldos.length) extra += " " + saldos.join("; ") + ".";
    if (CH.creada) extra += '<p class="pr-nota">Creé tu cuenta <b>' + esc(CH.creada.nombre) + "</b>; la ves en Cuentas.</p>";
    var sinIni = tocadas.filter(function (a) { return !a.ini && !CH_SALDO_PREG[a.id]; })[0], saldoIni = null;
    if (sinIni) {
      CH_SALDO_PREG[sinIni.id] = 1;
      var pasoIni = deshacer.filter(function (u) { return u.acc === sinIni; })[0];
      saldoIni = { acc: sinIni.id, delta: sinIni.saldo - (pasoIni ? pasoIni.accAntes : 0) };
      extra += '<p class="pr-nota">¿Cuánto tenías en <b>' + esc(sinIni.nombre) + "</b> antes de esto? Dímelo y te muestro tu saldo real.</p>";
    }
    var efNeg = tocadas.some(function (a) { return a.ini && a.tipo === "efectivo" && a.saldo < 0; });
    if (efNeg) extra += '<p class="pr-nota">El efectivo quedó en negativo, así que seguramente falta anotar plata que te entró. Si quieres, cuadramos tu billetera.</p>';
    var deben = CH.items.filter(function (x) { return x.comp || x.t === "p" || x.t === "d"; });
    if (deben.length) extra += ' <p class="pr-nota">Lo dejé en <b>Te deben</b>, en la pestaña Cuentas. Cuando te paguen, dime por ejemplo: ' + esc((deben[0].comp ? deben[0].comp.quien : deben[0].quien) || "Juan") + " me pagó.</p>";
    if (aprendidas.length) extra += '<p class="pr-nota">Aprendí algo: la próxima vez que me digas ' + aprendidas.map(function (x) { return "<b>" + esc(x.c.toLowerCase()) + "</b>"; }).join(" o ") +
      ", lo pongo en " + esc((catById(aprendidas[0].cat) || {}).name || "") + (aprendidas.length > 1 ? " y así" : "") + ".</p>";
    var notaPrecio = canNotaGuardado(guardados); if (notaPrecio) extra += '<p class="pr-nota">' + notaPrecio + "</p>";
    if (guardados.some(function (g) { return g.item.det && g.item.det.length && g.item.cat === "alimentacion"; })) {
      var ta = totalsOf(cur()).byCat.alimentacion;
      if (ta && ta.plan) extra += '<p class="pr-nota">Con esto llevas ' + money(ta.real) + " en alimentación este mes, el " + pctf(ta.real / ta.plan) + " de lo que planeaste.</p>";
    }
    var nDudas = chHistoriaDudas(guardados);
    if (nDudas) extra += '<p class="pr-nota">Lo que me faltó saber te lo pregunto después' + (avActivo() && WEB ? ", con un aviso de vez en cuando" : "") + '. También está en Inicio.</p>';
    chMsg("app", txt + extra);
    chNuevo();
    if (saldoIni) { CH.paso = "saldo-ini"; CH.saldoIni = saldoIni; }
    var sig = [{ t: "Anotar otro", v: "otro" }, { t: "Deshacer", v: "deshacer" }];
    if (saldoIni) sig.unshift({ t: "Ahora no", v: "saldo-no" });
    if (CH.cuadre && chCuadreRevisar()) return;
    if (efNeg) sig.splice(1, 0, { t: "Cuadrar mi billetera", v: "cuadre" });
    if (WEB && avDev && !avDev.efectivo && !chRecordarOfrecido) { chRecordarOfrecido = true; sig.push({ t: "Recordarme cada noche", v: "recordar" }); }
    sig.push({ t: "Cerrar", v: "cerrar" });
    chChips(sig);
  }
  var chRecordarOfrecido = false, CH_SALDO_PREG = {};
  function chDeshacer() {
    var u = CH_ULT; if (!u) return; CH_ULT = null;
    u.pasos.slice().reverse().forEach(function (p) {
      if (p.fila) { if (p.nueva) { var i = p.lista.indexOf(p.fila); if (i > -1) p.lista.splice(i, 1); } else p.fila.real = p.antes; }
      if (p.acc) p.acc.saldo = p.accAntes;
      if (p.mov) quitarMov(p.mov);
      if (p.regla) { if (p.regla.antes) state.reglas[p.regla.clave] = p.regla.antes; else delete state.reglas[p.regla.clave]; }
      if (p.ajuste) p.ajuste.acc.saldo = p.ajuste.antes;
    });
    state.registros = u.regAntes; state.meDeben = u.deudasAntes;
    changed(); renderIngresos(); renderGastos(); recompute(); renderCuentas(); renderMeDeben();
    chMsg("app", "Listo, lo quité. ¿Me cuentas otro?"); chInicioChips(); sonar("soplo-inv");
  }

  // --- Lo mismo de ayer ---
  function chMismoAyer() {
    var l = chAyer();
    if (!l.length) { chMsg("app", "Ayer no anoté gastos. ¿Qué gastaste hoy?"); return chInicioChips(); }
    CH.items = l.slice(0, 8).map(function (x) { return chItem({ t: "g", m: x.m, cat: x.cat, c: x.c }); }); CH.idx = 0;
    chMsg("app", "Esto fue lo de ayer; lo anoto con la fecha de hoy. Si algo cambió, dímelo.");
    chSiguiente();
  }

  // --- Cuadre de billetera: lo que tienes en la mano contra lo que dice Efectivo ---
  function chCuadre(tengo) {
    var acc = cuentaEfectivo(true); CH.cuadre = { tengo: Math.round(tengo), acc: acc.id }; CH.paso = "inicio";
    var dif = acc.saldo - CH.cuadre.tengo;
    if (Math.abs(dif) < 100) { CH.cuadre = null; chMsg("app", "¡Cuadra perfecto! Tienes " + money(tengo) + ", igual que lo anotado en " + esc(acc.nombre) + "."); renderCuentas(); return chInicioChips(); }
    if (dif > 0) {
      chMsg("app", "Según lo anotado deberías tener <b>" + money(acc.saldo) + "</b> y tienes " + money(tengo) + ": faltan <b>" + money(dif) + "</b>. ¿En qué se fueron? Cuéntamelo y lo anoto, por ejemplo: <b>taxi $ 10.000 y tinto $ 2.000</b>.");
      return chChips([{ t: "No me acuerdo: ponlo en Otros", v: "cuadre-otros" }, { t: "Solo ajustar el saldo", v: "cuadre-ajustar" }]);
    }
    chMsg("app", "Tienes <b>" + money(-dif) + "</b> más de lo anotado en " + esc(acc.nombre) + ". ¿Te entró plata en efectivo?");
    chChips([{ t: "Sí, fue un ingreso", v: "cuadre-ingreso", si: true }, { t: "Solo ajustar el saldo", v: "cuadre-ajustar" }]);
  }
  function chCuadreRevisar() {
    var q = CH.cuadre, acc = q && cuentaById(q.acc); if (!acc) { CH.cuadre = null; return false; }
    var dif = acc.saldo - q.tengo;
    if (Math.abs(dif) < 100) { CH.cuadre = null; chMsg("app", "¡Ahora sí cuadra tu billetera!"); chChips([{ t: "Deshacer", v: "deshacer" }, { t: "Cerrar", v: "cerrar" }]); return true; }
    if (dif > 0) { chMsg("app", "Todavía faltan <b>" + money(dif) + "</b> por explicar. ¿Algo más?"); chChips([{ t: "No me acuerdo: ponlo en Otros", v: "cuadre-otros" }, { t: "Solo ajustar el saldo", v: "cuadre-ajustar" }, { t: "Deshacer", v: "deshacer" }]); return true; }
    chMsg("app", "Ojo: con eso quedan " + money(-dif) + " de más. ¿Ajusto el saldo a lo que tienes?"); chChips([{ t: "Sí, ajustar", v: "cuadre-ajustar", si: true }, { t: "Deshacer", v: "deshacer" }]); return true;
  }
  function chCuadreAccion(v) {
    var q = CH.cuadre, acc = q && cuentaById(q.acc); if (!acc) return;
    var dif = acc.saldo - q.tengo;
    if (v === "cuadre-ajustar") {
      CH_ULT = { pasos: [{ ajuste: { acc: acc, antes: acc.saldo } }], regAntes: state.registros.slice(), deudasAntes: state.meDeben.slice() };
      acc.saldo = q.tengo; acc.ini = true; CH.cuadre = null; changed(); renderCuentas();
      chMsg("app", "Listo, " + esc(acc.nombre) + " queda en " + money(acc.saldo) + ".");
      return chChips([{ t: "Deshacer", v: "deshacer" }, { t: "Cerrar", v: "cerrar" }]);
    }
    CH.items = [v === "cuadre-otros" ? chItem({ t: "g", m: dif, cat: "otros", c: "Efectivo sin anotar", cuenta: acc.id }) : chItem({ t: "i", m: -dif, c: "Efectivo de más", cuenta: acc.id })];
    chGuardar();
  }

  // --- Te deben: "Juan me pagó" ---
  function chMePago(nombre, monto, cu) {
    var n = nrm(nombre).split(" y ")[0];
    var suyas = state.meDeben.filter(function (x) { return nrm(x.quien).split(/ y |, /).some(function (w) { return w === n || w.split(" ")[0] === n; }); });
    if (!suyas.length) {
      chMsg("app", "No tengo anotado que " + esc(nombre) + " te deba. ¿Lo anoto como un ingreso?");
      CH.items = [chItem({ t: "i", m: monto, c: "Pago de " + nombre, cuenta: cu ? cu.id : "" })]; CH.idx = 0;
      return monto ? chSiguiente() : (CH.paso = "monto", chChips([]));
    }
    var total = suyas.reduce(function (s, x) { return s + x.m; }, 0), paga = monto && monto < total ? monto : total, resto = paga;
    var acc = cu ? cuentaById(cu.id) : cuentaEfectivo(true);
    CH_ULT = { pasos: [{ acc: acc, accAntes: acc.saldo }], regAntes: state.registros.slice(), deudasAntes: state.meDeben.map(function (x) { return Object.assign({}, x); }) };
    suyas.sort(function (a, b) { return a.f < b.f ? -1 : 1; }).forEach(function (x) { var q = Math.min(x.m, resto); x.m -= q; resto -= q; });
    state.meDeben = state.meDeben.filter(function (x) { return x.m > 0; });
    acc.saldo += signoCuenta(acc, "ingreso") * paga;
    changed(); renderCuentas(); renderMeDeben();
    var queda = total - paga;
    chMsg("app", "¡Bien! " + esc(nombre) + " te pagó " + money(paga) + ". " + esc(acc.nombre) + " queda en " + money(acc.saldo) + "." + (queda > 0 ? " Todavía te debe " + money(queda) + "." : " Ya quedó a paz y salvo."));
    chNuevo(); chChips([{ t: "Deshacer", v: "deshacer" }, { t: "Anotar otro", v: "otro" }, { t: "Cerrar", v: "cerrar" }]);
  }

  $("ch-form").addEventListener("submit", function (e) { e.preventDefault(); var v = $("ch-input").value; $("ch-input").value = ""; chUsuario(v); });
  $("ch-chips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-ch]"); if (!b) return;
    var v = b.dataset.ch, p = v.split(":"), it = CH.items[CH.idx];
    if (v === "si") { chMsg("yo", esc(b.textContent)); return chGuardar(); }
    if (v === "no") return chUsuario("No");
    if (v === "otro") { chNuevo(); chMsg("app", "Dale, ¿qué más?"); return chInicioChips(); }
    if (v === "deshacer") return chDeshacer();
    if (v === "saldo-no") { chMsg("yo", "Ahora no"); CH.paso = "inicio"; CH.saldoIni = null; chMsg("app", "Dale. Cuando quieras, lo pones en Cuentas."); return chInicioChips(); }
    if (v === "cerrar") return closeDlg("dlg-charla");
    if (v === "ayer") { chMsg("yo", "Lo mismo de ayer"); return chMismoAyer(); }
    if (v === "cuadre") { chMsg("yo", "Cuadrar mi billetera"); CH.paso = "cuadre"; chMsg("app", "Cuenta lo que tienes en la billetera y dime cuánto es."); return chChips([]); }
    if (/^cuadre-/.test(v)) { chMsg("yo", esc(b.textContent)); return chCuadreAccion(v); }
    if (v === "recordar") { chMsg("yo", "Recordarme cada noche"); return chActivarRecordatorio(); }
    if (v === "ingreso") { chMsg("yo", "Me entró plata"); CH.items = [chItem({ t: "i" })]; CH.idx = 0; return chSiguiente(); }
    if (v === "dudas") { chMsg("yo", esc(b.textContent)); return chDudaPreguntar(true); }
    if (v === "noent") {
      chMsg("yo", esc(b.textContent)); noEntendiGuardar(CH.ultTexto, "charla"); chNuevo();
      chMsg("app", "<p>Gracias por avisarme. Guardé la frase en tu teléfono para aprender a entenderla; no se envía a ningún lado. Puedes verla en <b>Palabras que aprendí</b>.</p><p>Mientras tanto, cuéntamelo por partes, por ejemplo: <b>$ 12.000 en taxi</b>.</p>");
      return chInicioChips();
    }
    if (p[0] === "hi") { if (p[1] === "total") return chHistoriaTotal(+p[2]); if (p[1] === "monto") return chHistoriaPrecio(+p[2]); return chHistoriaPrecio(p[1]); }
    if (p[0] === "duda") { return chDudaAccion(p[1] === "monto" ? +p[2] : p[1]); }
    if (v === "otracat" && it) { chMsg("yo", "Otra categoría"); it.cat = ""; it.aprender = true; CH.guardarAlFinal = false; return chSiguiente(); }
    if (v === "otracuenta") { CH.paso = "cuenta"; CH.guardarAlFinal = false; chMsg("app", "¿Con qué lo pagaste?"); return chChips(state.cuentas.map(function (c) { return { t: c.nombre, v: "cuenta:" + c.id }; })); }
    if (p[0] === "cuenta" && it) { it.cuenta = p[1]; chMsg("yo", esc((cuentaById(p[1]) || {}).nombre || "")); return chSiguiente(); }
    if (p[0] === "cuentas") { CH.items.forEach(function (x) { if (!x.cuenta && x.t !== "d") x.cuenta = p[1]; }); chMsg("yo", esc((cuentaById(p[1]) || {}).nombre || "")); return chSiguiente(); }
    if (p[0] === "monto" && it) { chMsg("yo", money(+p[1])); it.m = +p[1]; return chSiguiente(); }
    if (p[0] === "cat" && it) { chMsg("yo", esc((catById(p[1]) || {}).name || "")); it.cat = p[1]; it.aprender = true; return chSiguiente(); }
    if (p[0] === "quien" && it) { chMsg("yo", esc(b.textContent)); if (!p[1]) { it.comp = null; } else if (it.comp) it.comp.quien = p[1]; else it.quien = p[1]; return chSiguiente(); }
    if (p[0] === "frec") { var o = CH.frec[+p[1]]; if (!o) return; chMsg("yo", esc(o.c)); CH.items = [chItem({ t: "g", m: o.m, cat: o.cat, c: o.c })]; CH.idx = 0; return chSiguiente(); }
    if (p[0] === "fila") { var f = cur().gastos.find(function (x) { return x.id === p[1]; }); if (!f) return; chMsg("yo", esc(f.concepto)); CH.items = [chItem({ t: "g", cat: f.cat, c: f.concepto })]; CH.idx = 0; return chSiguiente(); }
  });
  // Recordatorio de cada noche: usa los avisos al celular (notificaciones) que ya existen.
  function chActivarRecordatorio() {
    avDev.efectivo = true; avSave();
    if (avActivo()) {
      syncAvisos().then(function () {}, function () {});
      chMsg("app", "Listo: cada noche, a las " + (avDev.hora - 12) + " p. m., te pregunto por los gastos en efectivo. Puedes cambiar la hora en Avisos y recordatorios.");
      return chChips([{ t: "Cerrar", v: "cerrar" }]);
    }
    chMsg("app", "Para preguntártelo cada noche necesito que actives las notificaciones al celular. Te llevo allá.");
    setTimeout(function () { closeDlg("dlg-charla"); abrirAvisos(); }, 900);
  }





  // ===================== Buscar movimientos =====================
  // Busca en el historial con fecha: concepto, comercio, categoría, valor ("18 mil", "18.000") y mes ("octubre").
  var bsTipo = "todo";
  function buscarMovs(q, tipo) {
    var n = nrm(q).trim(), monto = 0, mes = -1, palabras = [];
    if (n) {
      monto = prMonto(n) || (/^\$?\s*[\d.]+$/.test(q.trim()) ? +q.replace(/\D/g, "") : 0);
      n.split(/\s+/).forEach(function (w) {
        var i = MESES.map(nrm).indexOf(w); if (i > -1) { mes = i; return; }
        if (/^(de|del|en|la|el|los|las|y|mil|lucas?|pesos|\$)$/.test(w) || /^\d[\d.,]*$/.test(w)) return;
        palabras.push(w);
      });
    }
    var res = state.movs.filter(function (x) {
      if (tipo !== "todo" && x.t !== tipo) return false;
      if (mes > -1 && +x.f.slice(5, 7) - 1 !== mes) return false;
      if (monto && Math.abs(x.m - monto) > Math.max(500, monto * 0.02)) return false;
      if (!palabras.length) return !!(monto || mes > -1);
      var hay = nrm([x.c, x.com, (catById(x.cat) || { name: x.t === "i" ? "ingreso" : "" }).name].join(" "));
      return palabras.every(function (w) { return hay.indexOf(w) > -1; });
    });
    return res.sort(function (a, b) { return a.f < b.f ? 1 : a.f > b.f ? -1 : (b.h || 0) - (a.h || 0); });
  }
  function renderBuscar() {
    var q = $("bs-q").value, l = buscarMovs(q, bsTipo), box = $("bs-lista");
    if (!q.trim()) { $("bs-res").textContent = state.movs.length ? "Escribe lo que buscas." : "Aquí aparecen los gastos e ingresos que anotas."; box.innerHTML = ""; return; }
    var gas = 0, ing = 0; l.forEach(function (x) { if (x.t === "g") gas += x.m; else ing += x.m; });
    $("bs-res").textContent = l.length ? pl2(l.length, "movimiento", "movimientos") + (gas ? " · gastos por " + money(gas) : "") + (ing ? " · ingresos por " + money(ing) : "") : "No encontré movimientos con eso.";
    var dia = "", html = "";
    l.slice(0, 120).forEach(function (x) {
      if (x.f !== dia) { dia = x.f; html += '<h3 class="bs-dia">' + esc(cap(fechaLarga(parseD(x.f), true))) + "</h3>"; }
      var ing2 = x.t === "i", nom = x.c || (catById(x.cat) || { name: ing2 ? "Ingreso" : "Gasto" }).name;
      html += '<div class="bs-item" style="--c:' + (ing2 ? "var(--good)" : catColor(x.cat)) + '">' + (ing2 ? '<span class="cat-ic" style="--c:var(--good)"><svg class="ic"><use href="#i-coins"/></svg></span>' : catIcon(x.cat)) +
        '<span class="bs-n"><b>' + esc(nom) + "</b><small>" + esc([(catById(x.cat) || { name: ing2 ? "Ingreso" : "" }).name, x.com && x.com !== x.c ? x.com : "", horaTxt(x.h)].filter(Boolean).join(" · ")) + "</small></span>" +
        '<b class="cifra' + (ing2 ? " pos" : "") + '">' + (ing2 ? "+" : "−") + money(x.m) + "</b></div>";
    });
    if (l.length > 120) html += '<p class="hint">Muestro los 120 más recientes.</p>';
    box.innerHTML = html;
  }
  // Movimientos: lo anotado este mes, agrupado por día, con el total de cada día
  var pdDias = 7;
  function nombreDia(f) {
    var d = parseD(f), h = parseD(hoyStr()); if (!d || !h) return f;
    var dif = Math.round((h - d) / 864e5);
    if (dif === 0) return "Hoy"; if (dif === 1) return "Ayer";
    return cap(["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][d.getDay()] + " " + fechaLarga(d));
  }
  var pdFiltro = "todas";
  function renderPorDia() {
    var box = $("pd-lista"); if (!box) return;
    var delMes = state.movs.filter(function (x) { return (x.f || "").slice(0, 7) === state.mes; });
    // Filtros: Todas, Ingresos y las categorías que tienen movimientos este mes
    var cats = [], vistos = {}, hayIng = false;
    delMes.forEach(function (x) { if (x.t !== "g") { hayIng = true; return; } var k = x.cat || "otros"; if (!vistos[k]) { vistos[k] = 1; cats.push(k); } });
    if (pdFiltro !== "todas" && pdFiltro !== "ing" && !vistos[pdFiltro]) pdFiltro = "todas";
    if (pdFiltro === "ing" && !hayIng) pdFiltro = "todas";
    var fil = [{ k: "todas", n: "Todas", c: "var(--ink)" }].concat(hayIng ? [{ k: "ing", n: "Ingresos", c: "var(--good)" }] : [], cats.map(function (k) { return { k: k, n: (catById(k) || { name: "Otros" }).name, c: catColor(k) }; }));
    $("mv-filtros").hidden = fil.length <= 2;
    $("mv-filtros").innerHTML = fil.map(function (f) { return '<button type="button" class="mv-fil" data-mv-fil="' + esc(f.k) + '" aria-pressed="' + (pdFiltro === f.k) + '" style="--c:' + f.c + '">' + (f.k !== "todas" ? '<i aria-hidden="true"></i>' : "") + esc(f.n) + "</button>"; }).join("");
    var l = delMes.filter(function (x) { return pdFiltro === "todas" || (pdFiltro === "ing" ? x.t !== "g" : x.t === "g" && (x.cat || "otros") === pdFiltro); }).sort(function (a, b) { return a.f < b.f ? 1 : a.f > b.f ? -1 : (b.h || 0) - (a.h || 0); });
    var dias = []; l.forEach(function (x) { var u = dias[dias.length - 1]; if (!u || u.f !== x.f) dias.push(u = { f: x.f, l: [], g: 0, i: 0 }); u.l.push(x); if (x.t === "g") u.g += x.m; else u.i += x.m; });
    var gas = 0; l.forEach(function (x) { if (x.t === "g") gas += x.m; });
    $("pd-total").textContent = l.length ? pl2(l.length, "movimiento", "movimientos") + " · " + money(gas) + " en gastos" : "";
    var ingF = 0; l.forEach(function (x) { if (x.t !== "g") ingF += x.m; });
    $("mv-resumen").textContent = l.length ? pl2(l.length, "movimiento", "movimientos") + " · " + money(pdFiltro === "ing" ? ingF : gas) + (pdFiltro === "ing" ? " recibidos" : " en gastos") : "Lo que anotas en " + monthLabel(state.mes).toLowerCase() + ", día por día.";
    $("pd-mas").hidden = dias.length <= pdDias;
    if (!l.length) {
      box.innerHTML = '<p class="empty">Aún no anotas movimientos en ' + esc(monthLabel(state.mes).toLowerCase()) + '. Cuéntame un gasto o conecta tu banco y aquí los verás, día por día.</p><button class="btn primary pd-anotar" type="button" data-clic-reg>Cuéntame un gasto</button>';
      return;
    }
    box.innerHTML = dias.slice(0, pdDias).map(function (d, k) {
      return '<div class="pd-dia" style="--i:' + k + '"><h3 class="pd-cab"><span>' + esc(nombreDia(d.f)) + '</span><span class="pd-suma">' + (d.g ? "−" + money(d.g) : "") + (d.g && d.i ? " · " : "") + (d.i ? '<span class="pos">+' + money(d.i) + "</span>" : "") + "</span></h3>" +
        d.l.map(function (x) {
          var ing = x.t === "i", nom = x.c || (catById(x.cat) || { name: ing ? "Ingreso" : "Gasto" }).name;
          var acc = x.cu ? cuentaById(x.cu) : null;
          return '<div class="bs-item pd-item" style="--c:' + (ing ? "var(--good)" : catColor(x.cat)) + '">' + (ing ? ingIcon() : catIcon(x.cat)) +
            '<span class="bs-n"><b>' + esc(nom) + "</b><small>" + esc([(catById(x.cat) || { name: ing ? "Ingreso" : "" }).name, x.com && x.com !== x.c ? x.com : "", horaTxt(x.h)].filter(Boolean).join(" · ")) +
            (acc ? '<span class="mv-cta"><i style="--m:' + marcaCuenta(acc).c + '" aria-hidden="true"></i>' + esc(acc.nombre) + "</span>" : "") + "</small></span>" +
            '<b class="cifra' + (ing ? " pos" : "") + '">' + (ing ? "+" : "−") + money(x.m) + "</b></div>";
        }).join("") + "</div>";
    }).join("");
  }
  $("pd-mas").addEventListener("click", function () { pdDias += 14; renderPorDia(); });
  $("mv-filtros").addEventListener("click", function (e) { var b = e.target.closest("[data-mv-fil]"); if (!b) return; pdFiltro = b.dataset.mvFil; vibrar(8); renderPorDia(); });
  document.addEventListener("click", function (e) { if (e.target.closest("[data-clic-reg]")) $("fab-add").click(); });
  function abrirBuscar() { $("bs-q").value = ""; renderBuscar(); openDlg("dlg-buscar", "#bs-q"); metrica("buscar", "dia"); }
  $("bs-q").addEventListener("input", renderBuscar);
  document.querySelector(".bs-filtros").addEventListener("click", function (e) { var b = e.target.closest("[data-bs]"); if (!b) return; bsTipo = b.dataset.bs; [].forEach.call(this.children, function (x) { x.setAttribute("aria-pressed", String(x === b)); }); renderBuscar(); });
  $("btn-buscar-menu").addEventListener("click", function () { cerrarMenu(); abrirBuscar(); });
  $("bs-entrada").addEventListener("click", abrirBuscar);
  window.FinBuscar = function (q, t) { return buscarMovs(q, t || "todo").length; };

  // ===================== Tanda 4: quincena, redondeo, escáner de recibos, retos con amigos, aviso de la mañana =====================
  // --- Aviso de la mañana: el servidor solo manda "es hora"; el service worker calcula la cifra aquí, con esto ---
  function guardarCupo() {
    if (!WEB) return;
    try {
      var k = keyOf(new Date()), m = state.meses[k], P = 0, R = 0;
      if (m) m.gastos.forEach(function (r) { if (r.dia || (catById(r.cat) || { group: "gus" }).group === "aho") return; P += r.plan; R += r.real; });
      idbEscribir("cupo", { mes: k, P: P, R: R, cifra: !!(avDev && avDev.cifra), t: Date.now() }).catch(function () {});
    } catch (e) {}
  }
  // --- Cuenta regresiva a la quincena ---
  function proxPago(hoy) {
    var dias = (state.prefs.diasPago || []).filter(function (d) { return d > 0; }); if (!dias.length) return null;
    var h = d0(hoy), fechas = [];
    for (var mm = -1; mm <= 1; mm++) { var f = new Date(h.getFullYear(), h.getMonth() + mm, 1), u = dim(f.getFullYear(), f.getMonth() + 1);
      dias.forEach(function (d) { fechas.push(new Date(f.getFullYear(), f.getMonth(), Math.min(d, u))); }); }
    fechas.sort(function (a, b) { return a - b; });
    var sig = fechas.find(function (x) { return x >= h; }), ant = fechas.filter(function (x) { return x < sig; }).pop();
    return { f: sig, faltan: Math.round((sig - h) / 864e5), largo: Math.max(1, Math.round((sig - ant) / 864e5)) };
  }
  function renderQuincena() {
    var box = $("quincena"), dp = state.prefs.diasPago || [], hoy = new Date();
    box.hidden = state.ejemplo || state.mes !== keyOf(hoy) || (dp.length === 1 && dp[0] === 0); if (box.hidden) return;
    var q = proxPago(hoy), C = 2 * Math.PI * 27;
    $("qn-elige").hidden = !!q; box.classList.toggle("eligiendo", !q);
    if (!q) { $("qn-t").textContent = "¿Cuándo te pagan?"; $("qn-s").textContent = "Te muestro cuántos días faltan para tu próximo pago."; $("qn-n").textContent = "?"; $("qn-fg").style.strokeDasharray = "0 " + C; return; }
    var avance = 1 - q.faltan / q.largo;
    $("qn-fg").style.strokeDasharray = (C * Math.max(0.02, avance)).toFixed(1) + " " + C.toFixed(1);
    $("qn-n").textContent = q.faltan || "¡Hoy!";
    box.classList.toggle("hoy", q.faltan === 0);
    $("qn-t").textContent = q.faltan === 0 ? "¡Hoy es día de pago!" : q.faltan === 1 ? "Mañana te pagan" : "Faltan " + q.faltan + " días para tu pago";
    var h = hoyPuedes(totalsOf(cur()));
    $("qn-s").textContent = q.faltan === 0 ? "Antes de gastar, separa tu ahorro. Tu yo del futuro te lo agradece." :
      "Llega el " + fechaLarga(q.f) + "." + (h && h.plan && h.resto > 0 ? " Hasta entonces te quedan " + money(redondeoMil(Math.max(0, h.resto) * Math.min(1, (q.faltan + 1) / h.quedan))) + " para el día a día." : "");
    $("qn-n").setAttribute("font-size", q.faltan ? "20" : "13");
  }
  $("qn-elige").addEventListener("click", function (e) {
    var b = e.target.closest("[data-pago]"); if (!b) return;
    var v = b.dataset.pago;
    if (v === "otro") { var d = prompt("¿Qué día del mes te pagan? Si son dos, sepáralos con una coma (por ejemplo: 10, 25)."); if (!d) return; v = d; }
    var dias = String(v).split(/[ ,y]+/).map(function (x) { return Math.round(+x); }).filter(function (x) { return x >= 0 && x <= 31; }).slice(0, 3);
    if (!dias.length) return;
    state.prefs.diasPago = dias; changed(); renderQuincena();
    if (dias[0] === 0) toast("Listo, no te muestro la cuenta regresiva.");
  });

  // --- Ahorro por redondeo ---
  function renderAlcancia() {
    var on = !!state.prefs.redondeo, k = state.mes, a = state.alcancia[k] || { j: 0, p: 0 }, libre = Math.max(0, a.j - a.p);
    $("f-redondeo").checked = on; $("alc-acc").hidden = !on;
    $("alc-v").textContent = money(libre);
    $("alc-s").textContent = !on ? "Actívalo y cada gasto que anotes se redondea hacia arriba: la diferencia va a tu alcancía." :
      libre ? "Juntaste esto redondeando tus gastos de " + MESES[parseKey(k).m - 1].toLowerCase() + "." + (a.p ? " Ya pasaste " + money(a.p) + " a tu ahorro." : "") :
      a.p ? "¡Todo lo de este mes ya está en tu ahorro! Pasaste " + money(a.p) + "." : "Cuando anotes tu próximo gasto, la alcancía empieza a llenarse.";
    [].forEach.call(document.querySelectorAll("[data-rd]"), function (b) { b.setAttribute("aria-pressed", String(+b.dataset.rd === state.prefs.redondeoA)); });
    $("alc-pasar").disabled = !libre;
    document.querySelector(".alcancia").classList.toggle("llena", libre > 0);
  }
  $("f-redondeo").addEventListener("change", function () { state.prefs.redondeo = this.checked; changed(); renderAlcancia(); if (this.checked) toast("Listo: desde tu próximo gasto, la alcancía empieza a juntar."); });
  document.querySelector(".alc-paso").addEventListener("click", function (e) { var b = e.target.closest("[data-rd]"); if (!b) return; state.prefs.redondeoA = +b.dataset.rd; changed(); renderAlcancia(); });
  $("alc-pasar").addEventListener("click", function () {
    var k = state.mes, a = state.alcancia[k]; if (!a) return; var v = a.j - a.p; if (!(v > 0)) return;
    var m = state.meses[k], fila = m.gastos.find(function (r) { return r.cat === "ahorro" && /redondeo/i.test(r.concepto); }) || m.gastos.find(function (r) { return r.cat === "ahorro"; });
    if (!fila) { fila = { id: rid("g"), concepto: "Ahorro por redondeo", cat: "ahorro", dia: 0, plan: 0, real: 0 }; m.gastos.push(fila); }
    fila.real += v; a.p += v; changed(); renderAll(); sonar("monedas"); toast("¡Bien! " + money(v) + " más en tu ahorro de este mes.");
  });

  // --- Escáner del código de barras de los recibos (GS1-128 de las facturas de servicios en Colombia) ---
  // (415) número de la empresa, (8020) referencia de pago, (3900) valor a pagar, (96) fecha límite AAAAMMDD.
  function leerGS1(raw) {
    var s = String(raw || "").replace(/\]C1/g, "").trim(), r = {};
    if (/\(\d{2,4}\)/.test(s)) { var re = /\((\d{2,4})\)\s*([^(]*)/g, m; while ((m = re.exec(s))) r[m[1]] = m[2].replace(/\D/g, ""); }
    else {
      var d = s.replace(/[^\d\x1d]/g, ""), m2 = /^415(\d{13})8020(\d+?)\x1d?3900(\d+?)\x1d?(?:96(\d{8}))?$/.exec(d);
      if (m2) { r["415"] = m2[1]; r["8020"] = m2[2]; r["3900"] = m2[3]; if (m2[4]) r["96"] = m2[4]; }
    }
    if (!r["3900"] || !(+r["3900"] > 0)) return null;
    var f = r["96"] && /^(\d{4})(\d{2})(\d{2})$/.exec(r["96"]), fecha = f && +f[2] >= 1 && +f[2] <= 12 && +f[3] >= 1 && +f[3] <= 31 ? f[1] + "-" + f[2] + "-" + f[3] : "";
    return { empresa: r["415"] || "", ref: (r["8020"] || "").replace(/^0+(?=\d{4})/, ""), valor: +r["3900"], fecha: fecha };
  }
  var RC = null, rcStream = null, rcTimer = null;
  function rcEmpresas() { try { return JSON.parse(localStorage.getItem("fintelligente-empresas") || "{}"); } catch (e) { return {}; } }
  function abrirRecibo() {
    RC = null; $("rc-form").hidden = true; $("rc-msg").textContent = ""; $("rc-codigo").value = "";
    openDlg("dlg-recibo", "#rc-codigo");
    var puede = "BarcodeDetector" in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    $("rc-cam").hidden = true;
    if (!puede) { $("rc-manual-l").textContent = "Este navegador no lee códigos con la cámara. Escribe los números que aparecen debajo del código de barras."; return; }
    window.BarcodeDetector.getSupportedFormats().then(function (fm) {
      var usar = ["code_128", "itf", "ean_13"].filter(function (x) { return fm.indexOf(x) > -1; });
      if (!usar.length) return;
      var det = new window.BarcodeDetector({ formats: usar });
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }).then(function (st) {
        if ($("dlg-recibo").hidden) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
        rcStream = st; var v = $("rc-video"); v.srcObject = st; v.play().catch(function () {}); $("rc-cam").hidden = false;
        $("rc-manual-l").textContent = "O escribe los números que aparecen debajo del código";
        var buscar = function () {
          if (!rcStream) return;
          det.detect(v).then(function (l) {
            var x = null; l.some(function (c) { x = leerGS1(c.rawValue); return !!x; });
            if (x) { rcParar(); rcMostrar(x); sonar("nota"); } else rcTimer = setTimeout(buscar, 350);
          }, function () { rcTimer = setTimeout(buscar, 600); });
        };
        buscar();
      });
    }).catch(function () { $("rc-msg").textContent = "No pude usar la cámara. Puedes escribir los números del código."; });
  }
  function rcParar() { clearTimeout(rcTimer); if (rcStream) { rcStream.getTracks().forEach(function (t) { t.stop(); }); rcStream = null; } $("rc-cam").hidden = true; }
  onCloseHooks["dlg-recibo"] = rcParar;
  function rcMostrar(x) {
    RC = x; $("rc-form").hidden = false; $("rc-msg").textContent = "";
    $("rc-valor").textContent = money(x.valor); $("rc-fecha").textContent = x.fecha ? fechaLarga(parseD(x.fecha), true) : "Sin fecha";
    $("rc-ref").textContent = x.ref || "–";
    $("rc-nombre").value = (x.empresa && rcEmpresas()[x.empresa]) || ""; $("rc-nombre").focus();
  }
  $("rc-leer").addEventListener("click", function () {
    var x = leerGS1($("rc-codigo").value);
    if (!x) { $("rc-msg").textContent = "No reconocí esos números. Copia toda la línea, con los números entre paréntesis."; return; }
    rcMostrar(x);
  });
  $("rc-codigo").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("rc-leer").click(); } });
  $("rc-form").addEventListener("submit", function (e) {
    e.preventDefault(); if (!RC) return;
    var nombre = $("rc-nombre").value.trim().slice(0, 60) || "Servicio";
    if (RC.empresa) { var em = rcEmpresas(); em[RC.empresa] = nombre; try { localStorage.setItem("fintelligente-empresas", JSON.stringify(em)); } catch (er) {} }
    var f = RC.fecha || hoyStr(), dup = state.porPagar.find(function (b) { return b.f === "unica" && b.fecha === f && b.monto === RC.valor && b.nombre === nombre; });
    if (!dup) state.porPagar.push({ id: rid("p"), nombre: nombre, monto: RC.valor, f: "unica", dia: parseD(f).getDate(), fecha: f, cat: "servicios", cuenta: "", aviso: 2, creado: hoyStr(), pagos: {} });
    changed(); closeDlg("dlg-recibo"); irA("cuentas"); renderAll();
    toast(dup ? "Ese recibo ya estaba en tus cuentas por pagar." : "Listo: " + esc(nombre) + " por " + money(RC.valor) + (RC.fecha ? ", hasta el " + fechaLarga(parseD(RC.fecha), true) : "") + ".");
  });

  // --- Retos con amigos: el servidor solo guarda apodos y días cumplidos ---
  var RA_TIPOS = [
    { id: "domicilios", n: "Una semana sin domicilios", d: "7 días cocinando en casa", dias: 7, ic: "i-store" },
    { id: "anotar", n: "Anotar todos los días", d: "14 días seguidos anotando lo que gastan", dias: 14, ic: "i-flame" },
    { id: "antojos", n: "Cero antojos", d: "7 días sin compras por impulso", dias: 7, ic: "i-snow" },
    { id: "cafe", n: "Café de la casa", d: "10 días sin comprar café ni mecato en la calle", dias: 10, ic: "i-coins" }
  ];
  var RA_KEY = "fintelligente-retos", raTipo = "domicilios", raCache = {};
  function raMios() { try { return (JSON.parse(localStorage.getItem(RA_KEY) || "[]") || []).filter(function (x) { return x && /^RETO-[A-Z2-9]{6}$/.test(x.codigo); }).slice(-10); } catch (e) { return []; } }
  function raGuardar(l) { try { localStorage.setItem(RA_KEY, JSON.stringify(l.slice(-10))); } catch (e) {} }
  function raApi(body) {
    return fetch("/api/retos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "No pudimos hablar con el servidor."); return j; }); });
  }
  function raTipo2(id) { return RA_TIPOS.find(function (t) { return t.id === id; }) || RA_TIPOS[0]; }
  function renderRetosAmigos() {
    var l = raMios(), box = $("ra-lista");
    if (!l.length) { box.innerHTML = '<p class="empty">Aún no tienes retos. Crea uno y compártelo por WhatsApp.</p>'; return; }
    box.innerHTML = l.map(function (r) {
      var t = raTipo2(r.tipo), v = raCache[r.codigo];
      var gente = v ? v.participantes.map(function (p) {
        var pct = Math.min(1, p.cumplidos / v.dias);
        return '<li class="' + (p.yo ? "yo" : "") + '"><span class="ra-av" aria-hidden="true">' + esc(p.apodo.slice(0, 1).toUpperCase()) + '</span><span class="ra-nom">' + esc(p.apodo) + (p.yo ? " (tú)" : "") +
          '</span><span class="ra-bar" role="img" aria-label="' + p.cumplidos + " de " + v.dias + ' días"><i style="width:' + (pct * 100).toFixed(0) + '%"></i></span><b>' + p.cumplidos + "/" + v.dias + "</b></li>";
      }).join("") : "";
      var yo = v && v.participantes.find(function (p) { return p.yo; });
      var estado = !v ? '<p class="hint">Cargando…</p>' : v.estado === "antes" ? '<p class="hint">Empieza el ' + esc(fechaLarga(parseD(v.inicio), true)) + ".</p>" : v.estado === "fin" ? '<p class="hint">Terminó. ¡Gracias por jugar!</p>' : "";
      return '<article class="ra-card" data-codigo="' + esc(r.codigo) + '"><div class="ra-top"><span class="ra-ic" aria-hidden="true">' + icono(t.ic) + '</span><div><b>' + esc(t.n) + "</b><small>" + esc(t.d) + " · " + esc(r.codigo) + "</small></div></div>" +
        estado + (gente ? '<ol class="ra-gente">' + gente + "</ol>" : "") +
        '<div class="ra-acc">' + (v && v.estado === "activo" ? (yo && yo.hoy ? '<span class="chip ok">Hoy cumpliste</span>' : '<button class="btn primary sm" type="button" data-ra-marcar>Hoy cumplí</button>') : "") +
        '<button class="btn sm" type="button" data-ra-compartir>Invitar</button><button class="link-btn" type="button" data-ra-salir>Salir</button></div></article>';
    }).join("");
  }
  function raRefrescar() {
    var l = raMios(); if (!WEB || !l.length) { renderRetosAmigos(); return; }
    renderRetosAmigos();
    l.forEach(function (r) {
      raApi({ accion: "ver", codigo: r.codigo, pid: r.pid, token: r.token, hoy: hoyStr() }).then(function (j) { raCache[r.codigo] = j; renderRetosAmigos(); }, function (e) {
        if (/no existe|terminó hace/i.test(e.message)) { raGuardar(raMios().filter(function (x) { return x.codigo !== r.codigo; })); renderRetosAmigos(); }
      });
    });
  }
  function abrirReto(codigo) {
    $("rt-tipos").innerHTML = RA_TIPOS.map(function (t) { return '<button type="button" role="radio" aria-checked="' + (t.id === raTipo) + '" data-rt="' + t.id + '"><span class="ra-ic" aria-hidden="true">' + icono(t.ic) + "</span><span><b>" + esc(t.n) + "</b><small>" + esc(t.d) + "</small></span></button>"; }).join("");
    $("rt-msg").textContent = ""; $("rt-apodo").value = (raMios()[0] || {}).apodo || nombreLocal();
    if (codigo) { $("rt-codigo").value = codigo; document.querySelector(".rt-unirse").open = true; }
    openDlg("dlg-reto", codigo ? "#rt-apodo" : '#rt-tipos [aria-checked="true"]');
  }
  $("rt-tipos").addEventListener("click", function (e) { var b = e.target.closest("[data-rt]"); if (!b) return; raTipo = b.dataset.rt; [].forEach.call(this.children, function (x) { x.setAttribute("aria-checked", String(x === b)); }); });
  // El nombre que la persona escribió en las tarjetas de bienvenida: solo vive en este dispositivo.
  function nombreLocal() { try { return (localStorage.getItem("fintelligente-nombre") || "").slice(0, 20); } catch (e) { return ""; } }
  function raApodo() { var a = $("rt-apodo").value.trim().replace(/\s+/g, " "); if (a.length < 2) { $("rt-msg").textContent = "Escribe un apodo de al menos 2 letras."; $("rt-apodo").focus(); return ""; } return a; }
  function raCompartir(codigo) {
    var t = raTipo2((raMios().find(function (x) { return x.codigo === codigo; }) || {}).tipo), url = location.origin + "/#reto=" + codigo;
    var txt = "Te reto: " + t.n + " (" + t.d + "). Únete en Finti con el código " + codigo + ". Solo se ven apodos y días cumplidos, nunca montos.";
    if (navigator.share) navigator.share({ title: "Reto en Finti", text: txt, url: url }).catch(function () {});
    else {
      var p = null; try { p = navigator.clipboard && navigator.clipboard.writeText(txt + " " + url); } catch (e) { p = null; }
      if (p && p.then) p.then(function () { toast("Copié la invitación. Pégala en WhatsApp."); }, function () { toast("Tu código es <b>" + codigo + "</b>. Compártelo con tus amigos."); });
      else toast("Tu código es <b>" + codigo + "</b>. Compártelo con tus amigos.");
    }
  }
  $("rt-crear").addEventListener("click", function () {
    var apodo = raApodo(); if (!apodo) return; var b = this; b.disabled = true; $("rt-msg").textContent = "Creando el reto…";
    raApi({ accion: "crear", tipo: raTipo, apodo: apodo, hoy: hoyStr() }).then(function (j) {
      var l = raMios(); l.push({ codigo: j.codigo, pid: j.pid, token: j.token, tipo: raTipo, apodo: apodo }); raGuardar(l);
      closeDlg("dlg-reto"); raRefrescar(); irA("metas"); raCompartir(j.codigo); metrica("reto_amigos", "una");
    }, function (e) { $("rt-msg").textContent = e.message; }).then(function () { b.disabled = false; });
  });
  $("rt-unirme").addEventListener("click", function () {
    var apodo = raApodo(); if (!apodo) return;
    var c = $("rt-codigo").value.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^RETO/, ""); if (!/^[A-Z2-9]{6}$/.test(c)) { $("rt-msg").textContent = "El código tiene la forma RETO-ABC234."; return; }
    c = "RETO-" + c; if (raMios().some(function (x) { return x.codigo === c; })) { $("rt-msg").textContent = "Ya estás en ese reto."; return; }
    raApi({ accion: "unirse", codigo: c, apodo: apodo, hoy: hoyStr() }).then(function (j) {
      var l = raMios(); l.push({ codigo: c, pid: j.pid, token: j.token, tipo: j.tipo, apodo: apodo }); raGuardar(l);
      closeDlg("dlg-reto"); irA("metas"); raRefrescar(); toast("¡Te uniste al reto!");
    }, function (e) { $("rt-msg").textContent = e.message; });
  });
  $("ra-lista").addEventListener("click", function (e) {
    var card = e.target.closest("[data-codigo]"); if (!card) return; var c = card.dataset.codigo, r = raMios().find(function (x) { return x.codigo === c; }); if (!r) return;
    if (e.target.closest("[data-ra-compartir]")) return raCompartir(c);
    if (e.target.closest("[data-ra-salir]")) { if (!confirm("¿Salir de este reto? Dejarás de verlo en tu app.")) return; raApi({ accion: "salir", codigo: c, pid: r.pid, token: r.token }).catch(function () {}); raGuardar(raMios().filter(function (x) { return x.codigo !== c; })); delete raCache[c]; renderRetosAmigos(); return; }
    if (e.target.closest("[data-ra-marcar]")) raApi({ accion: "marcar", codigo: c, pid: r.pid, token: r.token, hoy: hoyStr() }).then(function (j) { raCache[c] = j; renderRetosAmigos(); sonar("meta"); toast("¡Un día más! Sigue así."); }, function (er) { toast(esc(er.message)); });
  });
  $("ra-nuevo").addEventListener("click", function () { abrirReto(""); });
  $("btn-retos-menu").addEventListener("click", function () { cerrarMenu(); irA("metas"); raRefrescar(); setTimeout(function () { document.querySelector(".retos-amigos").scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" }); }, 60); });
  if (raMios().length) setTimeout(raRefrescar, 2500);
  (function () { var m = /^#reto=(RETO-[A-Za-z0-9]{6})$/.exec(location.hash || ""); if (m) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} setTimeout(function () { irA("metas"); abrirReto(m[1].toUpperCase()); }, 900); } })();

  // ===================== Inicio con ánimo, Tu día, pronóstico, ¿Y si…?, carta del domingo y temporada =====================
  function horaTxt(h) { if (!(h >= 0)) return ""; if (h === 12) return "12:00 m."; var x = h % 12 || 12; return x + ":00 " + (h < 12 ? "a. m." : "p. m."); }
  // La moneda de la mascota crece con el ahorro del mes (de 0 al 30 %)
  function renderMascota(t, animo) {
    var p = t.ingReal > 0 ? Math.max(0, t.ahorro / t.ingReal) : 0, k = Math.min(1, p / 0.3), r = 0.55 + k * 0.75;
    $("ms-moneda").setAttribute("transform", "translate(" + (32 + k * 2).toFixed(1) + " " + (31 - k * 2).toFixed(1) + ") scale(" + r.toFixed(2) + ")");
    $("saludo").dataset.animo = animo;
    $("saludo").classList.toggle("ahorro-meta", p >= 0.2);
    $("saludo-mascota").setAttribute("aria-label", t.ingReal > 0 ? "Tu moneda crece con tu ahorro: va en " + pctf(p) + " de lo que entró." : "Tu moneda crece cuando ahorras.");
  }
  function esTemporada(d) { d = d || new Date(); return (d.getMonth() === 11) || (d.getMonth() === 0 && d.getDate() <= 6); }
  function aplicarTemporada() { root.classList.toggle("navidad", state.prefs.temporada !== false && esTemporada()); }
  $("f-temporada").addEventListener("change", function () { state.prefs.temporada = this.checked; aplicarTemporada(); changed(); });

  // --- Tu día: lo anotado hoy en orden y los pagos que vencen hoy ---
  function renderTuDia() {
    var box = $("tu-dia"), act = keyOf(new Date());
    box.hidden = state.mes !== act; if (box.hidden) return;
    var hs = hoyStr(), items = [], total = 0;
    state.movs.forEach(function (x) { if (x.f === hs) { items.push({ h: x.h, x: x }); if (x.t === "g") total += x.m; } });
    items.sort(function (a, b) { return (a.h >= 0 ? a.h : 99) - (b.h >= 0 ? b.h : 99); });
    var pagos = state.porPagar.filter(function (b) { var e = estadoPago(b); return !e.pagado && e.dias === 0; });
    var html = items.slice(-6).map(function (o) {
      var x = o.x, ing = x.t === "i", nom = x.c || (catById(x.cat) || { name: ing ? "Ingreso" : "Gasto" }).name;
      return '<li style="--c:' + (ing ? "var(--good)" : catColor(x.cat)) + '"><span class="td-h">' + (horaTxt(x.h) || "Hoy") + '</span><span class="td-n">' + esc(nom) +
        (x.com ? "<small>" + esc(x.com) + "</small>" : "") + '</span><b class="cifra' + (ing ? " pos" : "") + '">' + (ing ? "+" : "−") + money(x.m) + "</b></li>";
    }).join("");
    if (items.length > 6) html = '<li class="td-mas"><span class="td-h"></span><span class="td-n">Y ' + pl2(items.length - 6, "movimiento más", "movimientos más") + " antes</span></li>" + html;
    html += pagos.map(function (b) { return '<li class="td-pago" style="--c:var(--warn)"><span class="td-h">Vence hoy</span><span class="td-n">' + esc(b.nombre || "Pago") + '</span><b class="cifra">' + money(b.monto || 0) + "</b></li>"; }).join("");
    if (!items.length) html = '<li class="td-vacio" style="--c:var(--line)"><span class="td-h">' + horaTxt(new Date().getHours()) + '</span><span class="td-n">Aún no anotas nada hoy. <button class="link-btn" type="button" id="td-anotar">Cuéntame un gasto</button></span></li>' + html;
    $("td-linea").innerHTML = html;
    $("td-total").textContent = total ? "Gastaste " + money(total) : "";
  }
  $("td-linea").addEventListener("click", function (e) { if (e.target.closest("#td-anotar")) abrirCharla(); });

  // --- Pronóstico: a este ritmo, ¿cómo cierra el mes? ---
  function pronostico(t) {
    var hoy = new Date(), act = keyOf(hoy); if (state.mes !== act) return null;
    var dias = dim(hoy.getFullYear(), hoy.getMonth() + 1), d = hoy.getDate();
    var ing = Math.max(t.ingReal, t.ingPlan); if (!(ing > 0) || !(t.gasReal > 0)) return null;
    var flexR = 0, fijosPend = 0;
    cur().gastos.forEach(function (r) {
      var g = (catById(r.cat) || { group: "gus" }).group;
      if (r.dia || g === "aho") fijosPend += Math.max(0, r.plan - r.real); else flexR += r.real;
    });
    var ritmo = flexR / d, proy = t.gasReal + ritmo * (dias - d) + fijosPend;
    // Gasto acumulado por día: lo anotado con fecha; lo que se escribió directo en la tabla cuenta desde el día 1
    var porDia = new Array(dias + 1).fill(0), conFecha = 0;
    state.movs.forEach(function (x) { if (x.t === "g" && (x.f || "").slice(0, 7) === act) { var dd = +x.f.slice(8, 10); if (dd <= d) { porDia[dd] += x.m; conFecha += x.m; } } });
    porDia[1] += Math.max(0, t.gasReal - conFecha);
    var acum = [0], a = 0; for (var i = 1; i <= d; i++) { a += porDia[i]; acum.push(a); }
    return { ing: ing, proy: proy, cierre: ing - proy, dias: dias, d: d, acum: acum, ritmo: ritmo, real: t.gasReal };
  }
  var PRON = null;
  function renderPron(t) {
    var P = pronostico(t), box = $("pron"); PRON = P;
    box.hidden = !P || P.d < 3; if (box.hidden) return;
    $("pron-frase").innerHTML = P.cierre >= 0 ? "Si sigues a este ritmo, cierras el mes con <b>" + money(redondeoMil(P.cierre)) + "</b> disponibles."
      : "A este ritmo te faltarían <b>" + money(redondeoMil(-P.cierre)) + "</b> al cierre. Bajar un poco el día a día lo arregla.";
    box.dataset.tono = P.cierre >= 0 ? "bien" : "ojo";
    var W = 320, H = 150, L = 8, R2 = 10, T = 14, B = 22, max = Math.max(P.ing, P.proy) * 1.08;
    var X = function (dd) { return L + (dd - 0) / P.dias * (W - L - R2); }, Y = function (v) { return T + (1 - v / max) * (H - T - B); };
    var real = P.acum.map(function (v, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); }).join("");
    var area = real + "L" + X(P.d).toFixed(1) + " " + Y(0).toFixed(1) + "L" + X(0) + " " + Y(0).toFixed(1) + "Z";
    var svg = '<line x1="' + L + '" x2="' + (W - R2) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" class="pr-eje"/>' +
      '<line x1="' + L + '" x2="' + (W - R2) + '" y1="' + Y(P.ing).toFixed(1) + '" y2="' + Y(P.ing).toFixed(1) + '" class="pr-ing"/>' +
      '<path d="' + area + '" class="pr-area"/><path d="' + real + '" class="pr-real"/>' +
      '<path d="M' + X(P.d).toFixed(1) + " " + Y(P.real).toFixed(1) + "L" + X(P.dias).toFixed(1) + " " + Y(P.proy).toFixed(1) + '" class="pr-proy' + (P.cierre < 0 ? " ojo" : "") + '"/>' +
      '<circle cx="' + X(P.d).toFixed(1) + '" cy="' + Y(P.real).toFixed(1) + '" r="4.5" class="pr-hoy"/>' +
      '<circle cx="' + X(P.dias).toFixed(1) + '" cy="' + Y(P.proy).toFixed(1) + '" r="4" class="pr-fin' + (P.cierre < 0 ? " ojo" : "") + '"/>' +
      '<text x="' + X(P.d).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="pr-tx">Hoy</text>' +
      '<text x="' + (W - R2) + '" y="' + (H - 6) + '" text-anchor="end" class="pr-tx">Día ' + P.dias + "</text>" +
      '<line id="pr-guia" x1="0" x2="0" y1="' + T + '" y2="' + Y(0).toFixed(1) + '" class="pr-guia" visibility="hidden"/>';
    $("pron-svg").innerHTML = svg;
    $("pron-svg").setAttribute("aria-label", "Llevas " + money(P.real) + " gastado al día " + P.d + ". Si sigues así, al día " + P.dias + " serían " + money(redondeoMil(P.proy)) + " de " + money(P.ing) + " que entran.");
    PRON.X = X; PRON.Y = Y; PRON.W = W;
  }
  (function () {
    var svg = $("pron-svg"), tip = $("pron-tip");
    function mover(e) {
      if (!PRON || !PRON.X) return;
      var r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * PRON.W;
      var dd = Math.max(1, Math.min(PRON.dias, Math.round((vx - 8) / (PRON.W - 18) * PRON.dias)));
      var v = dd <= PRON.d ? PRON.acum[dd] : PRON.real + (PRON.proy - PRON.real) * (dd - PRON.d) / Math.max(1, PRON.dias - PRON.d);
      var g = $("pr-guia"); g.setAttribute("x1", PRON.X(dd)); g.setAttribute("x2", PRON.X(dd)); g.setAttribute("visibility", "visible");
      tip.hidden = false; tip.innerHTML = "<b>Día " + dd + "</b>" + (dd <= PRON.d ? "Llevabas " : "Irías en ") + money(redondeoMil(v));
      tip.style.left = Math.max(0, Math.min(r.width - 150, e.clientX - r.left - 75)) + "px";
    }
    svg.addEventListener("pointermove", mover); svg.addEventListener("pointerdown", mover);
    svg.addEventListener("pointerleave", function () { tip.hidden = true; var g = $("pr-guia"); if (g) g.setAttribute("visibility", "hidden"); });
  })();

  // --- ¿Y si…?: recortar un gasto o hacer una compra, sin tocar los datos ---
  function abrirYsi(tab) {
    var t = totalsOf(cur()), op = [];
    Object.keys(t.byCat).forEach(function (id) { var c = catById(id); if (!c || c.group === "aho") return; var v = Math.max(t.byCat[id].plan, t.byCat[id].real); if (v > 0) op.push({ id: id, n: c.name, v: v }); });
    op.sort(function (a, b) { return b.v - a.v; });
    $("ysi-cat").innerHTML = op.map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.n) + " (" + money(o.v) + " al mes)</option>"; }).join("");
    var pref = op.find(function (o) { return /salid|ocio|domic|restaur/.test(o.id); }) || op[0];
    if (pref) $("ysi-cat").value = pref.id;
    ysiTab(tab || "r"); ysiRango(true); ysiCompra();
    openDlg("dlg-ysi", tab === "c" ? "#ysi-monto" : "#ysi-cat");
    metrica("ysi", "una");
  }
  function ysiTab(k) {
    $("ysi-tab-r").setAttribute("aria-selected", k === "r"); $("ysi-tab-c").setAttribute("aria-selected", k === "c");
    $("ysi-r").hidden = k !== "r"; $("ysi-c").hidden = k !== "c";
  }
  $("ysi-tab-r").addEventListener("click", function () { ysiTab("r"); });
  $("ysi-tab-c").addEventListener("click", function () { ysiTab("c"); $("ysi-monto").focus(); });
  function ysiRango(reset) {
    var t = totalsOf(cur()), id = $("ysi-cat").value, x = t.byCat[id] || { plan: 0, real: 0 }, base = Math.max(x.plan, x.real), rg = $("ysi-rango");
    var paso = base > 2e6 ? 50000 : base > 400000 ? 10000 : 5000;
    rg.step = paso; rg.max = Math.max(paso, Math.floor(base / paso) * paso);
    if (reset) rg.value = Math.max(paso, Math.round(base * 0.2 / paso) * paso);
    var v = +rg.value; $("ysi-rango-v").textContent = money(v);
    rg.setAttribute("aria-valuetext", money(v) + " al mes");
    var tiles = [[3, "En 3 meses"], [6, "En 6 meses"], [12, "En un año"]].map(function (q) { return '<div><b class="cifra">' + money(v * q[0]) + "</b><span>" + q[1] + "</span></div>"; }).join("");
    var extra = "", pAho = t.ingReal > 0 ? (t.ahorro + v) / t.ingReal : 0;
    if (t.ingReal > 0) extra += "<p>Tu ahorro pasaría de <b>" + pctf(Math.max(0, t.ahorro / t.ingReal)) + "</b> a <b>" + pctf(pAho) + "</b> de lo que entra.</p>";
    var meta = state.metas.find(function (g) { return g.objetivo > g.ahorrado; });
    if (meta && v > 0) { var falta = meta.objetivo - meta.ahorrado, n = Math.ceil(falta / v); extra += "<p>Con solo esto, completarías tu meta " + esc(meta.nombre || "") + " en <b>" + pl2(n, "mes", "meses") + "</b>.</p>"; }
    $("ysi-res-r").innerHTML = '<div class="ysi-tiles">' + tiles + "</div>" + extra;
  }
  $("ysi-cat").addEventListener("change", function () { ysiRango(true); });
  $("ysi-rango").addEventListener("input", function () { ysiRango(false); });
  function ysiCompra() {
    var raw = $("ysi-monto").value, v = prMonto(nrm(raw)) || +String(raw).replace(/\D/g, "") || 0, out = $("ysi-res-c");
    if (!(v > 0)) { out.innerHTML = '<p class="ysi-nota">Escribe el precio y te digo cómo queda tu mes.</p>'; return; }
    var t = totalsOf(cur()), h = hoyPuedes(t), html = "";
    if (h && h.plan) {
      var antes = Math.max(0, h.resto) / h.quedan, despues = Math.max(0, h.resto - v) / h.quedan;
      html += '<div class="ysi-tiles dos"><div><b class="cifra">' + money(redondeoMil(antes)) + '</b><span>Por día, hoy</span></div><div class="' + (despues < antes * 0.7 ? "ojo" : "") + '"><b class="cifra">' + money(redondeoMil(despues)) + "</b><span>Por día, si lo compras</span></div></div>";
    }
    var saldo = t.saldo - v;
    html += saldo >= 0 ? "<p>Te alcanza: el mes cerraría con <b>" + money(saldo) + "</b> disponibles.</p>" : "<p>Este mes no alcanza: faltarían <b>" + money(-saldo) + "</b>.</p>";
    if (saldo < 0 || (h && h.plan && h.resto - v < 0)) {
      var meses = Math.max(2, Math.ceil(v / Math.max(50000, t.saldo > 0 ? t.saldo : 50000)));
      html += "<p>Una idea: apartar <b>" + money(Math.ceil(v / meses / 1000) * 1000) + "</b> al mes y comprarlo en " + pl2(meses, "mes", "meses") + ", sin apretarte.</p>";
    }
    out.innerHTML = html;
  }
  $("ysi-monto").addEventListener("input", ysiCompra);
  $("pron-ysi").addEventListener("click", function () { abrirYsi("r"); });
  $("btn-ysi-menu").addEventListener("click", function () { cerrarMenu(); abrirYsi("r"); });

  // --- Carta del domingo: la semana contada como carta (domingo y lunes) ---
  function lunesDe(d) { d = d0(d); var w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return d; }
  function semanaGasto(ini) {
    var fin = new Date(ini); fin.setDate(fin.getDate() + 7);
    var tot = 0, cats = {}, dias = {}, n = 0;
    state.movs.forEach(function (x) { var f = parseD(x.f); if (!f || f < ini || f >= fin) return; dias[x.f] = 1; if (x.t !== "g") return; tot += x.m; n++; cats[x.cat] = (cats[x.cat] || 0) + x.m; });
    state.registros.concat(state.sinGasto || []).forEach(function (s2) { var f = parseD(s2); if (f && f >= ini && f < fin) dias[s2] = 1; });
    var top = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; })[0];
    return { tot: tot, n: n, top: top, topV: top ? cats[top] : 0, dias: Object.keys(dias).length };
  }
  function cartaSemana(forzar) {
    var hoy = new Date(), dw = hoy.getDay();
    if (!forzar && dw !== 0 && dw !== 1) return null;
    var ini = lunesDe(hoy); if (dw === 1 || (forzar && dw !== 0 && dw !== 1)) ini.setDate(ini.getDate() - 7);
    var prev = new Date(ini); prev.setDate(prev.getDate() - 7);
    var S = semanaGasto(ini), A = semanaGasto(prev), id = hoyStr(ini);
    if (!forzar && (state.prefs.cartaVista === id || (!S.n && !S.dias))) return null;
    var p = [];
    if (S.n) {
      var dif = A.tot - S.tot;
      p.push("Esta semana gastaste <b>" + money(S.tot) + "</b>" + (A.n ? (dif > 0 ? ", <b>" + money(dif) + " menos</b> que la semana anterior. ¡Qué buen ritmo!" : dif < 0 ? ", " + money(-dif) + " más que la anterior. Pasa; la próxima la equilibramos." : ", igual que la anterior: constancia pura.") : "."));
      if (S.top) p.push("Lo que más se llevó fue " + esc((catById(S.top) || { name: "Otros" }).name) + ", con " + money(S.topV) + ".");
    } else p.push("Esta semana no anotaste gastos. Si de verdad no gastaste, ¡felicitaciones!");
    p.push(S.dias >= 6 ? "Anotaste " + S.dias + " de 7 días: tu constancia es admirable." : S.dias >= 3 ? "Anotaste " + S.dias + " de 7 días. Un minuto al día y llegas a los 7." : "Esta semana que viene, ¿probamos anotar algo cada día? Un minuto basta.");
    var t = totalsOf(cur()), h = hoyPuedes(t);
    if (h && h.plan && h.resto > 0) p.push("Para lo que queda del mes tienes " + money(redondeoMil(h.resto / Math.max(1, h.quedan))) + " por día para el día a día.");
    var f1 = new Date(ini), f2 = new Date(ini); f2.setDate(f2.getDate() + 6);
    return { id: id, k: "Semana del " + f1.getDate() + " al " + f2.getDate() + " de " + MESES[f2.getMonth()].toLowerCase(), html: p.map(function (x) { return "<p>" + x + "</p>"; }).join("") };
  }
  function renderCarta(forzar) {
    var c = cartaSemana(forzar), box = $("carta");
    box.hidden = !c; if (!c) return;
    box.dataset.forzada = forzar ? "1" : ""; $("carta-k").textContent = c.k; $("carta-cuerpo").innerHTML = c.html; box.dataset.id = c.id;
  }
  $("carta-ok").addEventListener("click", function () { state.prefs.cartaVista = $("carta").dataset.id; $("carta").hidden = true; $("carta").dataset.forzada = ""; changed(); toast("Nos vemos el próximo domingo."); });
  $("btn-carta-menu").addEventListener("click", function () { cerrarMenu(); irA("inicio"); renderCarta(true); setTimeout(function () { $("carta").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }); $("carta-ok").focus({ preventScroll: true }); }, 80); });

  // ===================== Tu mes contado y Tu año: historias a pantalla completa =====================
  // Todo se calcula en el dispositivo. Al compartir se arma una imagen sin montos: solo porcentajes y logros.
  function resumenPeriodo(keys) {
    var ing = 0, gas = 0, aho = 0, porCat = {}, movsN = 0, mejor = null;
    keys.forEach(function (k) {
      var m = state.meses[k]; if (!m) return;
      var t = totalsOf(m); ing += t.ingReal; gas += t.gasReal; aho += t.ahorro;
      Object.keys(t.byCat).forEach(function (c) { var o = porCat[c] || (porCat[c] = { id: c, real: 0, plan: 0 }); o.real += t.byCat[c].real; o.plan += t.byCat[c].plan; });
      var pa = t.ingReal > 0 ? t.ahorro / t.ingReal : 0; if (t.ingReal > 0 && (!mejor || pa > mejor.p)) mejor = { k: k, p: pa };
    });
    state.movs.forEach(function (x) { if (keys.indexOf((x.f || "").slice(0, 7)) > -1) movsN++; });
    var cats = Object.keys(porCat).map(function (c) { return porCat[c]; }).filter(function (o) { return o.real > 0 && o.id !== "ahorro"; }).sort(function (a, b) { return b.real - a.real; });
    var gasSinAho = cats.reduce(function (s2, o) { return s2 + o.real; }, 0);
    // La estrella: la que más plata dejó sin gastar frente a su plan (sin contar Otros)
    var dentro = cats.filter(function (o) { return o.plan > 0 && o.real <= o.plan; });
    var estrellas = dentro.filter(function (o) { return o.id !== "otros"; }).sort(function (a, b) { return (b.plan - b.real) - (a.plan - a.real); });
    var dias = {}; state.registros.concat(state.actividad || []).forEach(function (d) { if (keys.indexOf(String(d).slice(0, 7)) > -1) dias[d] = 1; });
    var listaD = Object.keys(dias).sort(), racha = 0, r = 0, prev = null;
    listaD.forEach(function (d) { var x = parseD(d); r = prev && (x - prev) / 864e5 === 1 ? r + 1 : 1; racha = Math.max(racha, r); prev = x; });
    return { ing: ing, gas: gas, aho: aho, pAho: ing > 0 ? aho / ing : 0, cats: cats, total: gasSinAho, estrella: estrellas[0] || null, dentroN: dentro.length,
      conPlan: cats.filter(function (o) { return o.plan > 0; }).length, dias: listaD.length, racha: racha, movsN: movsN, mejor: mejor };
  }
  var HI = null;
  function pl2(n, uno, varios) { return n + " " + (n === 1 ? uno : varios); }
  function abrirHistoria(anio) {
    var keys, titulo, sub;
    if (anio) { var y = state.mes.slice(0, 4); keys = monthKeys().filter(function (k) { return k.slice(0, 4) === y; }); titulo = "Tu " + y; sub = "Tu año contado"; }
    else { keys = [state.mes]; var p = parseKey(state.mes); titulo = "Tu " + MESES[p.m - 1]; sub = "Tu mes contado"; }
    var R = resumenPeriodo(keys), escenas = [];
    var periodo = anio ? "este año" : "este mes";
    escenas.push({ c: "#2e5bff", h: '<div class="hi-logo">' + LOGO_VIVO + '</div><p class="hi-k">' + sub + '</p><h2 id="hi-t" class="hi-big">' + esc(titulo) + "</h2><p>" +
      (R.movsN ? "Anotaste " + plural(R.movsN, "movimiento") + (anio ? " en " + pl2(keys.length, "mes", "meses") : "") + ". Te cuento cómo te fue." : "Te cuento cómo te fue.") + "</p>" });
    if (R.cats.length) {
      var top = R.cats.slice(0, 4), C = 2 * Math.PI * 70, off = 0, svg = "";
      var resto = R.total - top.reduce(function (s2, o) { return s2 + o.real; }, 0);
      if (resto > 0) svg += '<circle cx="90" cy="90" r="70" fill="none" stroke="rgba(255,255,255,.32)" stroke-width="22" transform="rotate(-90 90 90)" stroke-dasharray="0 ' + C.toFixed(1) + '" data-d="' + Math.max(0, resto / R.total * C - 3).toFixed(1) + " " + C.toFixed(1) + '" stroke-dashoffset="' + (-(R.total - resto) / R.total * C).toFixed(1) + '"/>';
      top.forEach(function (o, i) { var len = o.real / R.total * C; svg += '<circle cx="90" cy="90" r="70" fill="none" stroke="' + catColor(o.id) + '" stroke-width="22" transform="rotate(-90 90 90)" stroke-dasharray="0 ' + C.toFixed(1) + '" data-d="' + Math.max(0, len - 3).toFixed(1) + " " + C.toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '" style="transition-delay:' + (0.2 + i * 0.3) + 's"/>'; off += len; });
      escenas.push({ c: catColor(top[0].id), h: '<p class="hi-k">En qué se fue tu plata</p><svg class="hi-anillo" viewBox="0 0 180 180" aria-hidden="true">' + svg + "</svg>" +
        '<ul class="hi-lista">' + top.map(function (o) { return '<li style="--c:' + catColor(o.id) + '"><i></i><span>' + esc((catById(o.id) || { name: "Otros" }).name) + "</span><b>" + pctf(o.real / R.total) + "</b></li>"; }).join("") + "</ul>" +
        "<p>" + esc((catById(top[0].id) || { name: "Otros" }).name) + " fue lo que más se llevó " + periodo + ".</p>" });
    }
    if (R.estrella) {
      var e = R.estrella, ne = (catById(e.id) || { name: "Otros" }).name, menos = 1 - e.real / e.plan;
      escenas.push({ c: catColor(e.id), h: '<p class="hi-k">Tu categoría estrella</p><div class="hi-estrella">' + catIcon(e.id) + '</div><h2 class="hi-big' + (ne.length > 9 ? " hi-largo" : "") + '">' + esc(ne) + "</h2><p>" +
        (menos > 0.01 ? "Gastaste " + pctf(menos) + " menos de lo que planeaste. ¡Eso es tener control!" : "Cerraste justo en lo planeado. ¡Precisión total!") + "</p>" +
        (R.dentroN > 1 ? '<p class="hi-peq">Y ' + pl2(R.dentroN - 1, "categoría más quedó", "categorías más quedaron") + " dentro del plan.</p>" : "") });
    }
    escenas.push({ c: "#ffc53d", tinta: "#14121f", h: '<p class="hi-k">Tu ahorro</p><div class="hi-monedas" aria-hidden="true"><i></i><i></i><i></i></div><h2 class="hi-big">' + pctf(R.pAho) + "</h2><p>" +
      (R.pAho >= 0.2 ? "de lo que entró quedó para ti. Superaste la meta del 20 %." : R.pAho > 0.05 ? "de lo que entró quedó para ti. Cada peso cuenta; vamos por más." : R.ing > 0 ? "de lo que entró quedó para ti. El próximo " + (anio ? "año" : "mes") + " lo subimos juntos." : "Cuando anotes lo que te entra, te digo cuánto ahorras.") + "</p>" +
      (anio && R.mejor ? '<p class="hi-peq">Tu mejor mes fue ' + esc(MESES[parseKey(R.mejor.k).m - 1]) + ".</p>" : "") });
    if (R.dias) escenas.push({ c: "#19c3a0", h: '<p class="hi-k">Tu constancia</p><h2 class="hi-big">' + R.dias + '</h2><p>' + (R.dias === 1 ? "día anotaste algo" : "días anotaste algo") + (anio ? " este año." : " este mes.") + "</p>" +
      (R.racha > 1 ? '<p class="hi-peq">Tu mejor racha: ' + pl2(R.racha, "día seguido", "días seguidos") + ".</p>" : '<p class="hi-peq">Anotar un poquito cada día es el secreto.</p>') });
    var lo = R.pAho >= 0.2 ? "Ahorraste más del 20 %." : R.estrella ? "Tuviste a raya " + (catById(R.estrella.id) || { name: "una categoría" }).name + "." : R.dias >= 10 ? "Fuiste constante: " + R.dias + " días anotando." : "Diste el primer paso: mirar tu plata de frente.";
    escenas.push({ c: "#ff5c9a", h: '<p class="hi-k">Lo mejor de ' + (anio ? "tu año" : "tu mes") + '</p><h2 class="hi-big hi-frase">' + esc(lo) + '</h2><div class="hi-acc"><button class="btn hi-btn" type="button" id="hi-compartir">Compartir sin montos</button>' +
      '<button class="link-btn hi-otra" type="button" id="hi-otra">Ver otra vez</button></div><p class="hi-peq">La imagen solo lleva porcentajes y logros, nunca tus cifras.</p>' });
    HI = { escenas: escenas, i: 0, R: R, titulo: titulo, sub: sub, anio: !!anio, t: null, foco: document.activeElement };
    $("hi-barras").innerHTML = escenas.map(function () { return "<span><i></i></span>"; }).join("");
    $("dlg-historia").hidden = false; document.body.classList.add("con-historia");
    hiMostrar(0); sonar("soplo");
    setTimeout(function () { $("hi-cerrar").focus(); }, 50);
    metrica(anio ? "historia_anio" : "historia_mes", "una");
  }
  var LOGO_VIVO = '<svg class="logo-vivo" viewBox="0 0 32 32" aria-hidden="true"><g class="lv-cuadro"><rect width="32" height="32" rx="9" fill="#2e5bff"/><path d="M10 23V9h11M10 16h8" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g><circle class="lv-moneda" cx="23" cy="21" r="2.6" fill="#ffc53d"/></svg>';
  var HI_MS = 5500;
  function hiMostrar(i) {
    if (!HI) return;
    HI.i = Math.max(0, Math.min(i, HI.escenas.length - 1));
    var e = HI.escenas[HI.i], box = $("dlg-historia");
    box.style.setProperty("--hc", e.c); box.style.setProperty("--ht", e.tinta || "#ffffff");
    $("hi-escena").innerHTML = '<div class="hi-in">' + e.h + "</div>";
    [].forEach.call($("hi-barras").children, function (b, k) { b.className = k < HI.i ? "lista" : k === HI.i ? "ahora" : ""; });
    var barra = $("hi-barras").children[HI.i].firstChild; barra.style.animationDuration = HI_MS + "ms";
    setTimeout(function () { [].forEach.call($("hi-escena").querySelectorAll("[data-d]"), function (c) { c.setAttribute("stroke-dasharray", c.dataset.d); }); }, 60);
    clearTimeout(HI.t);
    if (HI.i < HI.escenas.length - 1 && !reduceMotion) HI.t = setTimeout(function () { hiMostrar(HI.i + 1); }, HI_MS);
    if (HI.i === HI.escenas.length - 1) { setTimeout(function () { sonar("meta"); }, 300); if (!logroExtra.historia) { logroExtra.historia = 1; setTimeout(function () { checkLogros(); }, 900); } }
  }
  function cerrarHistoria() {
    if (!HI) return; clearTimeout(HI.t);
    var f = HI.foco; HI = null; $("dlg-historia").hidden = true; document.body.classList.remove("con-historia");
    try { if (f && f.focus) f.focus(); } catch (e) {}
  }
  $("hi-cerrar").addEventListener("click", cerrarHistoria);
  $("hi-sig").addEventListener("click", function () { if (HI.i < HI.escenas.length - 1) hiMostrar(HI.i + 1); });
  $("hi-ant").addEventListener("click", function () { hiMostrar(HI.i - 1); });
  // Mantener presionado pausa (como en las historias de las redes)
  $("hi-escena").addEventListener("pointerdown", function () { if (HI) { clearTimeout(HI.t); $("dlg-historia").classList.add("pausa"); } });
  document.addEventListener("pointerup", function () { if (HI && $("dlg-historia").classList.contains("pausa")) { $("dlg-historia").classList.remove("pausa"); if (HI.i < HI.escenas.length - 1 && !reduceMotion) HI.t = setTimeout(function () { hiMostrar(HI.i + 1); }, 2500); } });
  document.addEventListener("keydown", function (e) {
    if (!HI) return;
    if (e.key === "Escape") cerrarHistoria(); else if (e.key === "ArrowRight") $("hi-sig").click(); else if (e.key === "ArrowLeft") $("hi-ant").click();
  });
  $("hi-escena").addEventListener("click", function (e) {
    if (e.target.closest("#hi-otra")) return hiMostrar(0);
    if (e.target.closest("#hi-compartir")) return compartirHistoria();
  });
  // Imagen para compartir (1080 x 1920), sin montos
  function compartirHistoria() {
    var R = HI.R, cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1920;
    var x = cv.getContext("2d"), g = x.createLinearGradient(0, 0, 260, 1920);
    g.addColorStop(0, "#4a74ff"); g.addColorStop(.3, "#2e5bff"); g.addColorStop(.58, "#1838b8"); g.addColorStop(.82, "#0c1a5c"); g.addColorStop(1, "#09090b"); x.fillStyle = g; x.fillRect(0, 0, 1080, 1920);
    // La F de Finti de marca de agua, como en la banda de Inicio
    x.save(); x.strokeStyle = "rgba(255,255,255,.08)"; x.lineWidth = 46; x.lineCap = "round"; x.lineJoin = "round";
    x.beginPath(); x.moveTo(760, 1010); x.lineTo(760, 150); x.lineTo(1180, 150); x.moveTo(760, 580); x.lineTo(1060, 580); x.stroke(); x.restore();
    var rr = function (X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); };
    var gl = x.createLinearGradient(90, 110, 200, 220); gl.addColorStop(0, "#5c84ff"); gl.addColorStop(.45, "#2e5bff"); gl.addColorStop(1, "#1630b8");
    x.fillStyle = gl; rr(90, 110, 110, 110, 30); x.fill(); x.strokeStyle = "rgba(255,255,255,.25)"; x.lineWidth = 3; x.stroke(); x.strokeStyle = "#fff"; x.lineWidth = 11; x.lineCap = "round"; x.lineJoin = "round";
    x.beginPath(); x.moveTo(124, 190); x.lineTo(124, 140); x.lineTo(164, 140); x.moveTo(124, 165); x.lineTo(153, 165); x.stroke();
    x.fillStyle = "#ffc53d"; x.beginPath(); x.arc(169, 186, 9, 0, 7); x.fill();
    x.fillStyle = "#fff"; x.font = "700 46px Unbounded, sans-serif"; x.fillText("Finti", 225, 182);
    x.font = "600 44px Manrope, sans-serif"; x.globalAlpha = .85; x.fillText(HI.sub, 90, 360); x.globalAlpha = 1;
    // Cada texto se achica hasta caber en su espacio
    var cabe = function (txt, peso, tam, fam, ancho) { do { x.font = peso + " " + tam + "px " + fam; tam -= 2; } while (x.measureText(txt).width > ancho && tam > 16); };
    cabe(HI.titulo, 700, 120, "Unbounded, sans-serif", 900); x.fillText(HI.titulo, 90, 500);
    var y = 640;
    x.font = "600 42px Manrope, sans-serif"; x.fillText("En qué se fue mi plata", 90, y); y += 40;
    R.cats.slice(0, 4).forEach(function (o) {
      y += 90; var p = R.total ? o.real / R.total : 0;
      x.fillStyle = "rgba(255,255,255,.22)"; rr(90, y - 50, 900, 66, 33); x.fill();
      x.fillStyle = catColor(o.id); rr(90, y - 50, Math.max(66, 900 * p), 66, 33); x.fill();
      x.fillStyle = "#fff"; x.font = "700 38px Manrope, sans-serif"; x.fillText((catById(o.id) || { name: "Otros" }).name, 120, y - 5);
      x.textAlign = "right"; x.fillText(pctf(p), 965, y - 5); x.textAlign = "left";
    });
    y += 170;
    [["Ahorré", pctf(R.pAho)], ["Días anotando", String(R.dias)], ["Categorías en el plan", R.conPlan ? R.dentroN + " de " + R.conPlan : "–"]].forEach(function (k, i) {
      var X = 90 + i * 310; x.fillStyle = "rgba(255,255,255,.18)"; rr(X, y - 70, 280, 220, 36); x.fill();
      x.fillStyle = "#fff"; cabe(k[1], 700, 72, "Unbounded, sans-serif", 230); x.fillText(k[1], X + 30, y + 40);
      cabe(k[0], 600, 30, "Manrope, sans-serif", 230); x.fillText(k[0], X + 30, y + 110);
    });
    x.font = "600 36px Manrope, sans-serif"; x.globalAlpha = .9; x.fillText("Mi plata en orden, con Finti.", 90, 1780); x.globalAlpha = 1;
    cv.toBlob(function (blob) {
      if (!blob) return;
      var nombre = (HI && HI.anio ? "mi-año" : "mi-mes") + "-finti.png", file = null;
      try { file = new File([blob], nombre, { type: "image/png" }); } catch (e) {}
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: HI ? HI.sub : "Finti" }).catch(function () {}); return; }
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); toast("Listo: la imagen quedó descargada, sin montos.");
    }, "image/png");
  }
  $("hist-play").addEventListener("click", function () { abrirHistoria(false); });
  $("btn-historia-menu").addEventListener("click", function () { cerrarMenu(); abrirHistoria(false); });
  $("btn-anio-menu").addEventListener("click", function () { cerrarMenu(); abrirHistoria(true); });
  // El reproductor aparece cuando ya hay de qué contar: un mes pasado, o desde el día 20 con algo anotado
  function renderHistPlay() {
    var hoy = new Date(), act = keyOf(hoy), t = totalsOf(cur()), hay = t.gasReal > 0 || t.ingReal > 0;
    var anio = hoy.getMonth() === 11 || (hoy.getMonth() === 0 && hoy.getDate() <= 15);
    $("btn-anio-t").textContent = "Tu " + state.mes.slice(0, 4) + " contado";
    // Siempre a la vista (como en el prototipo), con lo que va del mes; se abre cuando ya hay de qué contar
    var listo = hay && !(state.mes === act && hoy.getDate() < 20 && !anio);
    // Solo aparece cuando hay algo que contar: a quien llegó hoy no le ocupa la pantalla (auditoría del 21 de noviembre)
    $("hist-play").hidden = !listo; $("hist-play").dataset.listo = listo ? "1" : ""; $("hist-play").dataset.hay = hay ? "1" : "";
    var p = parseKey(state.mes), dm = new Date(p.y, p.m, 0).getDate(), dia = state.mes === act ? hoy.getDate() : state.mes < act ? dm : 0;
    $("hist-play-fill").style.width = Math.round(dia / dm * 100) + "%";
    $("hist-play-t").textContent = anio && state.mes === act ? "Tu " + p.y + " contado" : "Tu " + MESES[p.m - 1] + " contado";
    $("hist-play-s").textContent = anio && state.mes === act ? "Tu año en historias" : listo ? "Cinco historias sobre tu mes" : state.mes === act ? dia + " de " + dm : "Sin movimientos";
    $("hist-play").dataset.anio = anio && state.mes === act ? "1" : "";
    // "Nuevo mes" solo cuando sirve: falta el mes de hoy o ya vienen los últimos días. Así el encabezado del celular respira.
    var ult = Object.keys(state.meses).sort().pop() || act;
    $("btn-nuevo-mes").hidden = !(!state.meses[act] || (ult === act && hoy.getDate() >= 25) || ult < act);
  }
  $("hist-play").addEventListener("click", function (e) {
    if (this.dataset.anio) { e.stopImmediatePropagation(); abrirHistoria(true); return; }
    if (!this.dataset.listo) { e.stopImmediatePropagation(); toast(this.dataset.hay ? "Tu mes contado estará listo desde el día 20. Sigue anotando." : "Tu mes contado se arma con lo que anotes este mes."); }
  }, true);

  // --- Te deben (pestaña Cuentas) ---
  function renderMeDeben() {
    var l = state.meDeben, dichos = leerDichos();
    $("td-pagaron").disabled = !l.length; $("tedeben-total").hidden = !l.length;
    $("tedeben-dichos").innerHTML = dichos.map(function (x) {
      return '<div class="td-dicho"><svg class="ic" aria-hidden="true"><use href="#i-chat"/></svg><span>Llegó del atajo: <b>' + esc(x.t) + '</b></span><button class="btn primary" type="button" data-dicho="' + esc(x.id) + '">Anotar</button><button class="icon-btn" type="button" data-dicho-no="' + esc(x.id) + '" aria-label="Descartar"><svg class="ic"><use href="#i-x"/></svg></button></div>';
    }).join("");
    if (!l.length) { $("tedeben-lista").innerHTML = dichos.length ? "" : '<p class="td-vacio">Nadie te debe plata. Cuando le prestes a alguien, anótalo aquí.</p>'; return; }
    var total = l.reduce(function (s, x) { return s + x.m; }, 0);
    $("tedeben-total").textContent = money(total);
    var porQuien = {};
    l.forEach(function (x) { (porQuien[x.quien] = porQuien[x.quien] || []).push(x); });
    $("tedeben-lista").innerHTML = Object.keys(porQuien).map(function (q) {
      var xs = porQuien[q], sum = xs.reduce(function (s, x) { return s + x.m; }, 0);
      return '<div class="td-fila"><span class="td-av" aria-hidden="true">' + esc(q.charAt(0).toUpperCase()) + '</span><div class="td-info"><b>' + esc(q) + "</b><small>" +
        xs.map(function (x) { return esc(x.c || "Me debe") + (x.f ? " · " + esc(chFechaTxt(x.f) || "hoy") : ""); }).join("; ") + '</small></div><b class="cifra td-m">' + money(sum) +
        '</b><button class="btn" type="button" data-pago="' + esc(q) + '">Me pagó</button><button class="icon-btn" type="button" data-borrar-q="' + esc(q) + '" aria-label="Borrar lo que te debe ' + esc(q) + '"><svg class="ic"><use href="#i-x"/></svg></button></div>';
    }).join("");
  }
  // Atajos para deudas con amigos: "Le presté a alguien" y "Me pagaron". Arman la frase y la pasan a Cuéntame,
  // que ya sabe anotarla en Te deben y preguntar de qué cuenta salió o a cuál entró la plata.
  var DD = "preste";
  function abrirDeuda(modo) {
    DD = modo === "pago" ? "pago" : "preste";
    var nombres = []; state.meDeben.forEach(function (x) { if (nombres.indexOf(x.quien) < 0) nombres.push(x.quien); });
    if (DD === "pago" && !nombres.length) { abrirDeuda("preste"); toast("Nadie te debe plata todavía"); return; }
    $("dd-t").textContent = DD === "pago" ? "Me pagaron" : "Le presté a alguien";
    $("dd-sub").textContent = DD === "pago" ? "Lo quito de lo que te deben" : "Te ayudo a recordar quién te debe";
    $("dd-quien").previousElementSibling.textContent = DD === "pago" ? "¿Quién te pagó?" : "¿A quién?";
    $("dd-monto").placeholder = DD === "pago" ? "Si fue todo, déjalo vacío" : "Ej.: $ 50.000";
    $("dd-quien").value = ""; $("dd-monto").value = ""; $("dd-msg").textContent = "";
    $("dd-nombres").innerHTML = nombres.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("");
    $("dd-chips").innerHTML = nombres.slice(0, 6).map(function (n) { return '<button type="button" class="chip-btn" data-n="' + esc(n) + '">' + esc(n) + "</button>"; }).join("");
    openDlg("dlg-deuda", "#dd-quien");
  }
  $("dd-chips").addEventListener("click", function (e) { var b = e.target.closest("[data-n]"); if (b) { $("dd-quien").value = b.dataset.n; $("dd-monto").focus(); } });
  $("dd-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var quien = $("dd-quien").value.trim().replace(/\s+/g, " "), m = $("dd-monto").value.trim();
    if (!quien) { $("dd-msg").textContent = DD === "pago" ? "Escribe quién te pagó." : "Escribe a quién le prestaste."; $("dd-msg").className = "msg err"; return; }
    if (/^[\d.\s$]+$/.test(m)) m = "$ " + m.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (DD === "preste" && !/\d/.test(m)) { $("dd-msg").textContent = "Escribe cuánto le prestaste."; $("dd-msg").className = "msg err"; return; }
    closeDlg("dlg-deuda");
    abrirCharla(DD === "pago" ? quien + " me pagó" + (/\d/.test(m) ? " " + m : "") : "le presté " + m + " a " + quien);
  });
  $("td-preste").addEventListener("click", function () { abrirDeuda("preste"); });
  $("tedeben-dichos").addEventListener("click", function (e) {
    var a = e.target.closest("[data-dicho]"), b = e.target.closest("[data-dicho-no]");
    if (b) return quitarDicho(b.dataset.dichoNo);
    if (a) { var x = leerDichos().filter(function (y) { return y.id === a.dataset.dicho; })[0]; quitarDicho(a.dataset.dicho); if (x) abrirCharla(x.t); }
  });
  $("td-pagaron").addEventListener("click", function () { abrirDeuda("pago"); });
  $("tedeben-lista").addEventListener("click", function (e) {
    var b = e.target.closest("[data-pago]");
    if (b) return abrirCharla(b.dataset.pago + " me pagó");
    var d = e.target.closest("[data-borrar-q]"); if (!d) return;
    var q = d.dataset.borrarQ;
    if (!confirm("¿Borrar lo que te debe " + q + "? No cambia el saldo de tus cuentas.")) return;
    state.meDeben = state.meDeben.filter(function (x) { return x.quien !== q; }); changed(); renderMeDeben();
  });

  // --- Palabras que aprendí ---
  function abrirAprendidas() { $("ap-buscar").value = ""; renderAprendidas(); renderNoEntendi(); openDlg("dlg-aprendidas", "#ap-buscar"); }
  // --- Frases que Finti no entendió: se guardan solo en el teléfono; salen únicamente si la persona las comparte ---
  function noEntendiGuardar(t, de) {
    t = String(t || "").trim().slice(0, 300); if (!t) return;
    state.noEntendi = state.noEntendi.filter(function (x) { return x.t !== t; }).concat([{ t: t, de: de === "pregunta" ? "pregunta" : "charla", f: hoyStr() }]).slice(-40);
    changed();
  }
  function renderNoEntendi() {
    var l = state.noEntendi;
    $("ne-sec").hidden = !l.length;
    $("ne-lista").innerHTML = l.slice().reverse().map(function (x, i) {
      return '<li><span>' + esc(x.t) + '<small>' + (x.de === "pregunta" ? "En Pregúntale" : "En Cuéntame un gasto") + (x.f ? " · " + (+x.f.slice(8)) + " de " + MESES[+x.f.slice(5, 7) - 1] : "") + '</small></span><button class="link-btn" type="button" data-ne-borrar="' + (l.length - 1 - i) + '" aria-label="Borrar esta frase">Borrar</button></li>';
    }).join("");
  }
  $("ne-lista").addEventListener("click", function (e) {
    var b = e.target.closest("[data-ne-borrar]"); if (!b) return;
    state.noEntendi.splice(+b.dataset.neBorrar, 1); changed(); renderNoEntendi();
  });
  $("ne-borrar").addEventListener("click", function () { var antes = state.noEntendi.slice(); state.noEntendi = []; changed(); renderNoEntendi(); toast("Borré las frases.", { action: "Deshacer", onAction: function () { state.noEntendi = antes; changed(); renderNoEntendi(); } }); });
  $("ne-compartir").addEventListener("click", function () {
    var txt = "Frases que Finti no entendió:\n" + state.noEntendi.map(function (x) { return "- " + x.t; }).join("\n");
    if (navigator.share) { navigator.share({ title: "Frases para mejorar Finti", text: txt }).catch(function () {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast("Copié las frases. Pégalas en tu mensaje por Ayuda y PQR."); }, function () { toast("No pude copiarlas. Selecciónalas en la lista y cópialas."); });
  });
  function renderAprendidas() {
    var q = prNorm($("ap-buscar").value || ""), ks = Object.keys(state.reglas).filter(function (k) { return catById(state.reglas[k]) && (!q || prNorm(k).indexOf(q) > -1); }).sort();
    $("ap-vacio").hidden = Object.keys(state.reglas).length > 0;
    var opciones = cats().map(function (c) { return [c.id, c.name]; });
    $("ap-lista").innerHTML = ks.slice(0, 300).map(function (k) {
      var cat = state.reglas[k];
      return '<div class="ap-fila" style="--c:' + catColor(cat) + '" data-k="' + esc(k) + '">' + catIcon(cat) + '<span class="ap-p">' + esc(k) + "</span>" +
        '<select class="field" aria-label="Categoría de ' + esc(k) + '">' + opciones.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cat ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>" +
        '<button class="icon-btn" type="button" data-quitar aria-label="Olvidar ' + esc(k) + '"><svg class="ic"><use href="#i-x"/></svg></button></div>';
    }).join("") || (q ? '<p class="hint">No encontré esa palabra.</p>' : "");
  }
  $("ap-buscar").addEventListener("input", renderAprendidas);
  $("ap-lista").addEventListener("change", function (e) {
    var f = e.target.closest("[data-k]"); if (!f || e.target.tagName !== "SELECT") return;
    state.reglas[f.dataset.k] = e.target.value; changed(); renderAprendidas();
  });
  $("ap-lista").addEventListener("click", function (e) {
    var f = e.target.closest("[data-quitar]") && e.target.closest("[data-k]"); if (!f) return;
    delete state.reglas[f.dataset.k]; changed(); renderAprendidas(); toast("Listo, la olvidé.");
  });
  $("btn-aprendidas-menu").addEventListener("click", function () { cerrarMenu(); abrirAprendidas(); });

  // --- Foto de la tirilla: se lee en el dispositivo con Tesseract (archivos propios en /ocr/). La foto no sale ni se guarda. ---
  var OCR = null;
  function ocrPosible() { return WEB && typeof WebAssembly === "object" && !!window.Worker; }
  function ocrCargar() {
    if (OCR) return OCR;
    OCR = new Promise(function (ok, mal) {
      if (window.Tesseract) return ok(window.Tesseract);
      var sc = document.createElement("script"); sc.src = "/ocr/tesseract.min.js"; sc.onload = function () { ok(window.Tesseract); }; sc.onerror = mal; document.head.appendChild(sc);
    }).then(function (T) {
      var simd = false;
      try { simd = WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) {}
      return T.createWorker("spa", 1, { workerPath: "/ocr/worker.min.js", corePath: "/ocr/tesseract-core-" + (simd ? "simd-" : "") + "lstm.js", langPath: "/ocr", workerBlobURL: false, gzip: true,
        logger: function (m) { if (m.status === "recognizing text" && $("ch-ocr-p")) $("ch-ocr-p").textContent = Math.round(m.progress * 100) + " %"; } });
    });
    OCR.catch(function () { OCR = null; });
    return OCR;
  }
  // Achica y pasa a grises: más rápido y lee mejor.
  function ocrImagen(file) {
    return new Promise(function (ok, mal) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var esc2 = Math.min(1, 1600 / Math.max(img.width, img.height)), cv = document.createElement("canvas");
        cv.width = Math.round(img.width * esc2); cv.height = Math.round(img.height * esc2);
        var cx = cv.getContext("2d"); cx.filter = "grayscale(1) contrast(1.3)"; cx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url); ok(cv);
      };
      img.onerror = function () { URL.revokeObjectURL(url); mal(new Error("imagen")); };
      img.src = url;
    });
  }
  // Lee el total, el comercio y la fecha de una tirilla o factura de Colombia.
  function leerTirilla(texto) {
    var lineas = String(texto || "").split(/\n+/).map(function (l) { return l.replace(/\s+/g, " ").trim(); }).filter(Boolean);
    function montos(l) {
      var out = [], re = /\$?\s?(\d{1,3}(?:[.,]\d{3})+|\d{4,8})(?:[.,](\d{2}))?(?!\d)/g, m;
      while ((m = re.exec(l))) { var v = +m[1].replace(/[.,]/g, ""); if (v >= 100 && v < 5e7) out.push(v); }
      return out;
    }
    var total = 0, mejor = -1;
    lineas.forEach(function (l, i) {
      var n = nrm(l);
      if (/sub ?total|total (items|articulos|unidades|cantidad)|iva|impuesto|propina sugerida|descuento|cambio|vueltas/.test(n)) return;
      var peso = /total a pagar|valor a pagar|neto a pagar|total factura/.test(n) ? 3 : /\btotal\b|vr\.? total|valor total/.test(n) ? 2 : /\b(efectivo|pago|a pagar)\b/.test(n) ? 1 : -1;
      if (peso < 0) return;
      var ms = montos(l); if (!ms.length && lineas[i + 1]) ms = montos(lineas[i + 1]);
      if (ms.length && peso >= mejor) { mejor = peso; total = Math.max.apply(null, ms); }
    });
    if (!total) { var todos = []; lineas.forEach(function (l) { todos = todos.concat(montos(l)); }); if (todos.length) total = Math.max.apply(null, todos); }
    var comercio = "";
    for (var i = 0; i < Math.min(5, lineas.length); i++) {
      var l = lineas[i], n = nrm(l);
      if ((l.match(/[a-záéíóúñ]/gi) || []).length >= 3 && !/\b(nit|factura|fecha|tel|telefono|dir|direccion|calle|cra|carrera|regimen|resolucion|cufe|caja|cajero|ticket)\b/.test(n)) { comercio = LECTOR.bonito(l.replace(/[^\wÁÉÍÓÚÑáéíóúñ&.\- ]/g, "").trim()).slice(0, 40); break; }
    }
    var f = "", fm = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(texto) || null, fi = /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/.exec(texto);
    var d = fi ? new Date(+fi[1], +fi[2] - 1, +fi[3]) : fm ? new Date(fm[3].length === 2 ? 2000 + +fm[3] : +fm[3], +fm[2] - 1, +fm[1]) : null;
    if (d && !isNaN(d) && d <= new Date() && (Date.now() - d) / 864e5 <= 60) f = hoyStr(d);
    return { m: total, c: comercio, f: f };
  }
  function chLeerFoto(file) {
    if (!file) return;
    chMsg("yo", "Foto de una tirilla");
    chMsg("app", 'Leyendo la tirilla aquí en tu teléfono… <span id="ch-ocr-p"></span>' + (OCR ? "" : '<p class="pr-nota">La primera vez descargo el lector (unos 8 MB). Después queda guardado.</p>'));
    Promise.all([ocrCargar(), ocrImagen(file)]).then(function (r) { return r[0].recognize(r[1]); }).then(function (res) {
      var t = leerTirilla(res && res.data ? res.data.text : "");
      if (!t.m && !t.c) { chMsg("app", "No pude leer bien la tirilla. Prueba con más luz y la tirilla derecha, o escríbeme el gasto."); return chInicioChips(); }
      var k = t.c ? chCategoria(prNorm(t.c)) : { cat: "" };
      if (!k.cat && t.c) { var l = LECTOR.sugerirCategoria({ comercio: t.c, tipo: "gasto" }, state.reglas); if (l.por) k.cat = l.cat; }
      // Con qué se pagó, si la tirilla lo dice (efectivo, crédito o débito, cuando hay una sola cuenta de ese tipo)
      var tx = nrm(res && res.data ? res.data.text : ""), cuT = "", unaDe = function (tipo) { var l = state.cuentas.filter(function (c) { return c.tipo === tipo; }); return l.length === 1 ? l[0].id : ""; };
      if (/\befectivo\b/.test(tx)) cuT = chEfectivoId(); else if (/\b(credito|visa|mastercard)\b/.test(tx)) cuT = unaDe("tarjeta"); else if (/\bdebito\b/.test(tx)) cuT = unaDe("banco");
      CH.items = [chItem({ t: "g", m: t.m, cat: k.cat, c: t.c || "Compra", f: t.f, cuenta: cuT })]; CH.idx = 0;
      chMsg("app", "Leí la tirilla" + (t.c ? " de <b>" + esc(t.c) + "</b>" : "") + ". Revisa que el total esté bien antes de anotarla.");
      chSiguiente();
    }).catch(function () { chMsg("app", "No pude abrir el lector de tirillas ahora. Escríbeme el gasto y lo anoto igual."); });
  }
  $("ch-cam").addEventListener("click", function () { $("ch-foto").value = ""; $("ch-foto").click(); });
  $("ch-foto").addEventListener("change", function () { var f = this.files && this.files[0]; this.value = ""; chLeerFoto(f); });

  // --- Voz, solo dentro del dispositivo ---
  var CH_SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var CH_IDIOMAS = ["es-CO", "es-419", "es-US", "es-MX", "es-ES"], chRec = null, chIdioma = null;
  function chVozApp() { return APP_ANDROID.activa && APP_ANDROID.v >= 9; }
  function chVozWeb() { return !!(CH_SR && typeof CH_SR.available === "function"); }
  function chVozPosible() { return chVozApp() || chVozWeb(); }
  function chBuscarIdioma(i) {
    if (i >= CH_IDIOMAS.length) return Promise.resolve(null);
    return CH_SR.available({ langs: [CH_IDIOMAS[i]], processLocally: true }).then(function (st) {
      return st === "unavailable" ? chBuscarIdioma(i + 1) : { lang: CH_IDIOMAS[i], st: st };
    }, function () { return chBuscarIdioma(i + 1); });
  }
  function chEscuchar(lang) {
    try {
      chRec = new CH_SR(); chRec.lang = lang; chRec.processLocally = true; chRec.interimResults = true; chRec.maxAlternatives = 1;
      // Una historia de mercado tiene pausas: se sigue escuchando hasta 3,5 s de silencio o hasta que toque el micrófono otra vez
      chRec.continuous = true;
    } catch (e) { chMsg("app", "No pude usar el micrófono. Escríbemelo y lo anoto igual."); return; }
    var final = "", silencio = null, rec = chRec;
    function callar() { clearTimeout(silencio); silencio = setTimeout(function () { try { rec.stop(); } catch (e) {} }, 3500); }
    $("ch-voz").setAttribute("aria-pressed", "true"); $("ch-input").placeholder = "Te escucho… toca el micrófono al terminar";
    callar();
    chRec.onresult = function (ev) {
      var t = "", f = ""; for (var i = 0; i < ev.results.length; i++) { var x = ev.results[i][0].transcript.trim(); t += (t ? " " : "") + x; if (ev.results[i].isFinal) f += (f ? " " : "") + x; }
      final = f; $("ch-input").value = t; callar();
    };
    chRec.onerror = function (ev) {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") chMsg("app", "Necesito permiso para usar el micrófono. Puedes dármelo en los ajustes del navegador, o escribirme.");
      else if (ev.error !== "no-speech" && ev.error !== "aborted") chMsg("app", "No te escuché bien. Inténtalo otra vez o escríbemelo.");
    };
    chRec.onend = function () {
      clearTimeout(silencio);
      $("ch-voz").setAttribute("aria-pressed", "false"); $("ch-input").placeholder = "Ej.: $ 18.000 en almuerzo"; chRec = null;
      var v = (final || $("ch-input").value).trim(); if (v) { $("ch-input").value = ""; chUsuario(v); }
    };
    try { chRec.start(); } catch (e) { $("ch-voz").setAttribute("aria-pressed", "false"); }
  }
  // Sin voz dentro del navegador (Chrome en Android, Safari en iPhone, la app de Android vieja): se dicta con el micrófono
  // del teclado del celular. Ese dictado lo hace el teléfono; Finti no recibe audio.
  var chDictadoDicho = false;
  function chDictarTeclado() {
    var inp = $("ch-input"); inp.placeholder = "Toca el micrófono de tu teclado y habla"; inp.focus();
    try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) {}
    $("ch-voz").classList.add("dictando"); setTimeout(function () { $("ch-voz").classList.remove("dictando"); }, 2600);
    if (!chDictadoDicho) {
      chDictadoDicho = true;
      var vieja = APP_ANDROID.activa && APP_ANDROID.v < 9;
      chMsg("app", "Toca el <b>micrófono de tu teclado</b> y dime el gasto, por ejemplo <b>dieciocho mil en almuerzo</b>. Tu celular lo convierte en texto y yo lo anoto." +
        (vieja ? " Con la app de Android nueva, el micrófono de aquí te escucha directo." : ""));
    }
  }
  $("ch-voz").addEventListener("click", function () {
    if (chRec) { try { chRec.stop(); } catch (e) {} return; }
    if (chVozApp()) { location.href = "intent://voz#Intent;scheme=fintelligente;package=co.fintelligente.app;end"; return; }
    if (!chVozWeb()) return chDictarTeclado();
    (chIdioma ? Promise.resolve(chIdioma) : chBuscarIdioma(0)).then(function (r) {
      if (!r) return chDictarTeclado();
      if (r.st === "available") { chIdioma = r; return chEscuchar(r.lang); }
      if (r.st === "downloading") { chMsg("app", "Estoy terminando de descargar el español para entenderte sin internet. Prueba en un momento."); return; }
      chMsg("app", "Para entender tu voz sin que salga del teléfono necesito descargar el español una sola vez. ¿Lo descargo?");
      chChips([{ t: "Sí, descargar", v: "voz-instalar", si: true }, { t: "Prefiero escribir", v: "otro" }]);
      chIdioma = r;
    });
  });
  $("ch-chips").addEventListener("click", function (e) {
    var b = e.target.closest('[data-ch="voz-instalar"]'); if (!b || !chIdioma) return;
    chMsg("app", "Descargando… te aviso cuando esté.");
    CH_SR.install({ langs: [chIdioma.lang], processLocally: true }).then(function (ok) {
      if (ok) { chIdioma.st = "available"; chMsg("app", "Listo. Toca el micrófono y dime tu gasto."); chChips([]); }
      else chMsg("app", "No se pudo descargar ahora. Escríbemelo y lo anoto igual.");
    }, function () { chMsg("app", "No se pudo descargar ahora. Escríbemelo y lo anoto igual."); });
  });
  onCloseHooks["dlg-charla"] = function () { if (chRec) try { chRec.abort(); } catch (e) {} };

  // --- Pregúntale también escucha: la voz se entiende dentro del teléfono, como en Cuéntame un gasto ---
  // Con la voz del navegador (sin internet, processLocally), con la app de Android (su reconocimiento en el teléfono;
  // la respuesta vuelve marcada para Pregúntale) o, si no hay ninguna, con el micrófono del teclado.
  var prRec = null;
  function prVozDecir(html) { prBurbuja("<p>" + html + "</p>", "app"); }
  function prEscuchar(lang) {
    var inp = $("pr-input"), boton = $("pr-voz");
    try { prRec = new CH_SR(); prRec.lang = lang; prRec.processLocally = true; prRec.interimResults = true; prRec.maxAlternatives = 1; prRec.continuous = false; }
    catch (e) { prVozDecir("No pude usar el micrófono. Escríbeme tu pregunta."); return; }
    var final = "", rec = prRec, silencio = null;
    function callar() { clearTimeout(silencio); silencio = setTimeout(function () { try { rec.stop(); } catch (e) {} }, 2500); }
    boton.setAttribute("aria-pressed", "true"); inp.placeholder = "Te escucho…";
    callar();
    prRec.onresult = function (ev) {
      var t = "", f = ""; for (var i = 0; i < ev.results.length; i++) { var x = ev.results[i][0].transcript.trim(); t += (t ? " " : "") + x; if (ev.results[i].isFinal) f += (f ? " " : "") + x; }
      final = f; inp.value = t; callar();
    };
    prRec.onerror = function (ev) {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") prVozDecir("Necesito permiso para usar el micrófono. Puedes dármelo en los ajustes del navegador, o escribirme.");
      else if (ev.error !== "no-speech" && ev.error !== "aborted") prVozDecir("No te escuché bien. Inténtalo otra vez o escríbeme.");
    };
    prRec.onend = function () {
      clearTimeout(silencio); boton.setAttribute("aria-pressed", "false"); inp.placeholder = "Escribe o dime tu pregunta…"; prRec = null;
      var v = (final || inp.value).trim(); if (v) { inp.value = ""; prPreguntar(v); }
    };
    try { prRec.start(); } catch (e) { boton.setAttribute("aria-pressed", "false"); }
  }
  var prDictadoDicho = false;
  function prDictarTeclado() {
    var inp = $("pr-input"); inp.placeholder = "Toca el micrófono de tu teclado y pregúntame"; inp.focus();
    $("pr-voz").classList.add("dictando"); setTimeout(function () { $("pr-voz").classList.remove("dictando"); }, 2600);
    if (!prDictadoDicho) { prDictadoDicho = true; prVozDecir("Toca el <b>micrófono de tu teclado</b> y pregúntame, por ejemplo <b>¿cuánto gasté en comida?</b> Tu celular lo convierte en texto y yo te respondo."); }
  }
  $("pr-voz").addEventListener("click", function () {
    if (prRec) { try { prRec.stop(); } catch (e) {} return; }
    if (chVozApp()) { try { sessionStorage.setItem("fintelligente-voz-para", "preguntas"); } catch (e) {} location.href = "intent://voz#Intent;scheme=fintelligente;package=co.fintelligente.app;end"; return; }
    if (!chVozWeb()) return prDictarTeclado();
    (chIdioma ? Promise.resolve(chIdioma) : chBuscarIdioma(0)).then(function (r) {
      if (!r) return prDictarTeclado();
      if (r.st === "available") { chIdioma = r; return prEscuchar(r.lang); }
      if (r.st === "downloading") { prVozDecir("Estoy terminando de descargar el español para entenderte sin internet. Prueba en un momento."); return; }
      chIdioma = r;
      prVozDecir('Para entender tu voz sin que salga del teléfono necesito descargar el español una sola vez. <button type="button" class="pr-chip" data-pr-voz-instalar>Sí, descargar</button>');
    });
  });
  $("pr-log").addEventListener("click", function (e) {
    var b = e.target.closest("[data-pr-voz-instalar]"); if (!b || !chIdioma) return;
    b.disabled = true; prVozDecir("Descargando… te aviso cuando esté.");
    CH_SR.install({ langs: [chIdioma.lang], processLocally: true }).then(function (ok) {
      if (ok) { chIdioma.st = "available"; prVozDecir("Listo. Toca el micrófono y pregúntame."); } else prVozDecir("No se pudo descargar ahora. Escríbeme tu pregunta.");
    }, function () { prVozDecir("No se pudo descargar ahora. Escríbeme tu pregunta."); });
  });
  onCloseHooks["dlg-preguntas"] = (function (antes) { return function () { if (prRec) try { prRec.abort(); } catch (e) {} if (antes) antes(); }; })(onCloseHooks["dlg-preguntas"]);
  window.FinCharla = { entender: function (t) { return chEntender(t); }, todo: function (t) { return chEntenderTodo(t); }, numeros: chNumeros, palabras: function () { return chLista().length; }, tirilla: leerTirilla };

  window.FinPreguntas = { entender: function (t) { var r = prEntender(t); PR.espera = null; return { intent: r.intent || (r.fn ? "accion" : ""), cat: r.q && r.q.cat, monto: r.q && r.q.monto, per: r.q && r.q.per && (r.q.per.k || r.q.per.nombre), com: r.q && r.q.com && r.q.com.nombre }; } };

  // ===================== Leer ofertas con foto =====================
  // Pregúntale y ¿Y si…? leen la foto de una oferta (volante, cartel de la tienda, pantallazo de una página) con el
  // mismo lector de las tirillas, dentro del teléfono: la foto no sale ni se guarda. De la oferta se saca el producto,
  // el precio de ahora y el de antes, el descuento, las promociones (2x1, lleva 3 paga 2, segunda unidad), las cuotas y
  // el tamaño, para decir cuánto se ahorra de verdad, cuánto sale el kilo o el litro, cómo estaba lo que la persona
  // pagó antes y cómo queda su día si la compra.
  function ofMontos(l) {
    var out = [], re = /(\$\s?)?(\d{1,3}(?:[.,]\d{3})+|\d{3,7})(?:[.,](\d{2}))?(?!\d|\s?%|\s?(?:x\b|cuotas?\b|meses\b|g\b|gr|grs|kg|ml|cc|lt?\b|litros?|und|unidades|uds?\b|cm|mm|pulg|gb|tb|mah|w\b|hz))/gi, m;
    while ((m = re.exec(l))) {
      var v = +m[2].replace(/[.,]/g, "");
      // Sin signo de pesos, un número de 3 cifras casi nunca es un precio en Colombia
      if (!m[1] && v < 1000) continue;
      if (v >= 100 && v < 5e7) out.push({ v: v, i: m.index });
    }
    return out;
  }
  function leerOferta(texto) {
    var crudo = String(texto || ""), lineas = crudo.split(/\n+/).map(function (l) { return l.replace(/\s+/g, " ").trim(); }).filter(Boolean);
    var n = nrm(crudo).replace(/\s+/g, " "), o = { producto: "", precio: 0, antes: 0, pct: 0, promo: "", lleva: 0, paga: 0, cuotas: 0, cuota: 0, sinInteres: false, cant: 0, unidad: "" };
    // Precios con su etiqueta: "antes", "ahora", "precio normal", "precio oferta"
    var ahora = [], antes = [], todos = [];
    lineas.forEach(function (l, i) {
      var nl = nrm(l), ms = ofMontos(l);
      if (/(\d+)\s?cuotas?/.test(nl) || /\bx\s?\d+\s?meses\b/.test(nl)) return;
      if (!ms.length && /\b(antes|precio normal|precio regular|precio anterior|de|ahora|hoy|oferta|precio oferta|precio especial|solo|por solo)\s*:?\s*$/.test(nl) && lineas[i + 1]) { ms = ofMontos(lineas[i + 1]); }
      ms.forEach(function (x) { todos.push(x.v); });
      if (/\b(antes|precio normal|precio regular|precio anterior|precio full|normal|pvp)\b/.test(nl) || /\bde \$?\s?\d/.test(nl) && /\ba \$?\s?\d/.test(nl)) {
        if (/\bde \$?\s?\d/.test(nl) && /\ba \$?\s?\d/.test(nl) && ms.length >= 2) { antes.push(Math.max(ms[0].v, ms[1].v)); ahora.push(Math.min(ms[0].v, ms[1].v)); }
        else if (ms.length >= 2 && /\b(ahora|hoy|oferta)\b/.test(nl)) { antes.push(Math.max.apply(null, ms.map(function (x) { return x.v; }))); ahora.push(Math.min.apply(null, ms.map(function (x) { return x.v; }))); }
        else ms.forEach(function (x) { antes.push(x.v); });
      } else if (/\b(ahora|hoy|oferta|precio oferta|precio especial|solo|por solo|lleva(lo|la)?|a solo|precio club|con tarjeta)\b/.test(nl)) ms.forEach(function (x) { ahora.push(x.v); });
    });
    // Descuento en porcentaje
    var pm = /(\d{1,2})\s?%\s?(?:de\s)?(?:dto|desc|descuento|off|menos|de ahorro|ahorro)?/.exec(n) || /-\s?(\d{1,2})\s?%/.exec(n);
    if (pm && /(dto|desc|descuento|off|menos|ahorr|-\s?\d{1,2}\s?%|\d{1,2}\s?%\s?$)/.test(n)) o.pct = +pm[1];
    // Promociones por cantidad
    var px = /\b([2-6])\s?x\s?([1-5])\b/.exec(n), pl = /lleva\s?(\d)\s?(?:y\s)?paga\s?(\d)/.exec(n), ps = /(segund[ao]|2\s?(?:da|do|a|o)?)\s?(?:unidad|und)?\s?(?:al|a|con)\s?(?:el\s)?(\d{2})\s?%|(segund[ao]|2\s?(?:da|do))\s?(?:unidad\s)?(?:a\s)?mitad de precio/.exec(n);
    if (px && +px[1] > +px[2]) { o.lleva = +px[1]; o.paga = +px[2]; o.promo = px[1] + "x" + px[2]; }
    else if (pl && +pl[1] > +pl[2]) { o.lleva = +pl[1]; o.paga = +pl[2]; o.promo = "lleva " + pl[1] + " y paga " + pl[2]; }
    else if (ps) { var desc2 = ps[2] ? +ps[2] : 50; o.lleva = 2; o.paga = 2 - desc2 / 100; o.promo = "la segunda unidad " + (ps[2] ? "con " + desc2 + " % menos" : "a mitad de precio"); }
    // Cuotas
    var cm = /(\d{1,2})\s?cuotas?\s?(?:mensuales\s)?(?:de\s)?\$?\s?(\d{1,3}(?:[.,]\d{3})+|\d{4,7})/.exec(n) || /\$?\s?(\d{1,3}(?:[.,]\d{3})+|\d{4,7})\s?(?:x|por)\s?(\d{1,2})\s?(?:meses|cuotas)/.exec(n);
    if (cm) { var a1 = cm[0].indexOf("cuota") > 0 && /^\d{1,2}\s?cuota/.test(cm[0]); o.cuotas = a1 ? +cm[1] : +cm[2]; o.cuota = +(a1 ? cm[2] : cm[1]).replace(/[.,]/g, ""); }
    else { var cn = /(\d{1,2})\s?cuotas/.exec(n); if (cn) o.cuotas = +cn[1]; }
    o.sinInteres = /sin interes|0\s?% (de )?interes|cero interes/.test(n);
    // Tamaño: 500 g, 1 kg, 900 ml, 1,5 L, x 6 unidades
    var tm = /(\d+(?:[.,]\d+)?)\s?(kg|kilos?|g|gr|grs|gramos|ml|cc|l|lt|lts|litros?)\b/.exec(n);
    if (tm) {
      var q = parseFloat(tm[1].replace(",", ".")), u = tm[2];
      if (/^(kg|kilo)/.test(u)) { o.cant = q; o.unidad = "kg"; } else if (/^(g|gr|gramo)/.test(u)) { o.cant = q / 1000; o.unidad = "kg"; }
      else if (/^(ml|cc)/.test(u)) { o.cant = q / 1000; o.unidad = "l"; } else { o.cant = q; o.unidad = "l"; }
      if (!(o.cant > 0) || o.cant > 50) { o.cant = 0; o.unidad = ""; }
    }
    // El precio de ahora y el de antes
    if (ahora.length) o.precio = Math.min.apply(null, ahora);
    if (antes.length) o.antes = Math.max.apply(null, antes);
    var unicos = todos.filter(function (v, i, a) { return a.indexOf(v) === i && (!o.cuota || v !== o.cuota); });
    if (!o.precio) {
      var resto = unicos.filter(function (v) { return v !== o.antes; });
      if (resto.length) o.precio = o.antes ? Math.max.apply(null, resto.filter(function (v) { return v < o.antes; }).concat([0])) || Math.min.apply(null, resto) : Math.min.apply(null, resto);
    }
    if (!o.antes && unicos.length >= 2 && o.precio) { var may = Math.max.apply(null, unicos); if (may > o.precio && may <= o.precio * 3) o.antes = may; }
    if (o.antes && o.antes <= o.precio) o.antes = 0;
    if (!o.antes && o.pct && o.precio && !o.lleva) o.antes = Math.round(o.precio / (1 - o.pct / 100) / 10) * 10;
    if (o.antes && !o.pct) o.pct = Math.round((1 - o.precio / o.antes) * 100);
    if (!o.precio && o.cuotas && o.cuota) o.precio = o.cuotas * o.cuota;
    // El producto: la primera línea con palabras que no es precio ni etiqueta
    for (var i = 0; i < lineas.length; i++) {
      var l = lineas[i], nl = nrm(l), letras = (l.match(/[a-záéíóúñ]/gi) || []).length;
      if (letras < 4 || /^(oferta|ofertas|promo|promocion|antes|ahora|hoy|precio|solo|por solo|descuento|dto|ahorra|ahorro|aprovecha|super ?oferta|imperdible|exclusivo|valido|aplica|hasta agotar|unidades limitadas|\d)/.test(nl) || /\$\s?\d/.test(l) || /cuotas|interes|tarjeta|valido hasta|aplican? (condiciones|terminos)|www\.|\.com/.test(nl)) continue;
      o.producto = l.replace(/[^\wáéíóúñÁÉÍÓÚÑ.,\- ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
      if (o.producto) break;
    }
    return o;
  }
  // Lo que se paga por unidad con la promoción, el total de las cuotas y el precio por kilo o litro
  function ofCuentas(o) {
    var c = { unidad: o.precio, ahorro: o.antes ? o.antes - o.precio : 0, total: o.precio, porKilo: 0 };
    if (o.lleva && o.paga && o.precio) { c.total = o.precio * o.paga; c.unidad = c.total / o.lleva; c.ahorro = o.precio * o.lleva - c.total; }
    if (o.cuotas && o.cuota) c.cuotasTotal = o.cuotas * o.cuota;
    if (o.cant && c.unidad) c.porKilo = c.unidad / o.cant;
    return c;
  }
  // La respuesta de Pregúntale (y el resumen de ¿Y si…?) sobre una oferta leída
  function ofRespuesta(o) {
    if (!o.precio) return { html: "<p>No alcancé a leer el precio de la oferta. Prueba con la foto más cerca y derecha, o escríbeme: \"¿me alcanza para algo de $ 50.000?\".</p>", chips: ["¿Me alcanza para algo de $ 50.000?", "¿Cuánto puedo gastar hoy?"] };
    var c = ofCuentas(o), nom = o.producto ? "<b>" + esc(o.producto) + "</b>" : "lo de la oferta", h = "", lineas = [];
    h += "<p>" + (o.producto ? "Leí la oferta de " + nom + ": " : "Leí la oferta: ") + "<b>" + money(o.precio) + "</b>" + (o.lleva ? " cada una" : "") + ".</p>";
    if (o.antes && c.ahorro > 0 && !o.lleva) lineas.push("Antes costaba " + money(o.antes) + ": te ahorras " + money(c.ahorro) + (o.pct ? " (" + o.pct + " %)" : "") + ".");
    else if (o.pct && !o.lleva) lineas.push("Dice que tiene " + o.pct + " % de descuento.");
    if (o.lleva) lineas.push("Con la promoción (" + esc(o.promo) + ") pagas " + money(c.total) + " por " + o.lleva + ": cada una te sale a " + money(c.unidad) + ", y te ahorras " + money(c.ahorro) + ". Conviene si de verdad vas a usar las " + o.lleva + ".");
    if (c.porKilo) lineas.push("Te sale a " + canPrecio(c.porKilo) + (o.unidad === "kg" ? " el kilo" : " el litro") + ", útil para comparar con otros tamaños.");
    if (o.cuotas) {
      if (c.cuotasTotal) {
        var extra = c.cuotasTotal - (o.precio || 0);
        lineas.push(o.cuotas + " cuotas de " + money(o.cuota) + " suman " + money(c.cuotasTotal) + (extra > o.precio * 0.02 && o.precio !== c.cuotasTotal ? ": pagarías " + money(extra) + " más que de contado." : o.sinInteres ? ", sin intereses: si ya lo ibas a comprar, no te cuesta más." : "."));
      } else lineas.push("Se puede pagar en " + o.cuotas + " cuotas" + (o.sinInteres ? " sin intereses" : "; pregunta cuánto suman con intereses antes de decidir") + ".");
    }
    // Lo que la persona pagó antes por el mismo producto
    if (o.producto && typeof canResumen === "function") {
      var k = canClave(o.producto), r = k && canResumen(120).find(function (x) { return x.k === k; });
      if (r && r.ult) {
        var suyo = r.ult.pu, compara = r.unidad === "u" ? c.unidad : r.unidad === o.unidad && c.porKilo ? c.porKilo : 0;
        if (compara) lineas.push(compara < suyo * 0.97 ? "La última vez lo pagaste a " + canPrecio(suyo) + canPorUnidad(r) + ": esta oferta está más barata." : compara > suyo * 1.03 ? "Ojo: la última vez lo pagaste a " + canPrecio(suyo) + canPorUnidad(r) + ", más barato que esta oferta." : "Está casi al mismo precio que la última vez que lo compraste.");
      }
    }
    // Cómo queda el día si la compra
    var t = totalsOf(cur()), hp = hoyPuedes(t), paga = o.lleva ? c.total : o.precio;
    if (hp && hp.plan) {
      var queda = hp.puede - paga;
      lineas.push(queda >= 0 ? "Si la compras hoy, todavía te quedarían " + money(redondeoMil(queda)) + " para el día." : "Hoy tienes " + money(Math.max(0, redondeoMil(hp.puede))) + " para gastar: si la compras, tómalo de otra parte del mes o espera unos días.");
    }
    h += lineas.map(function (x) { return "<p>" + x + "</p>"; }).join("");
    return { html: h, chips: ["¿Y si la compro?", "¿Cuánto puedo gastar hoy?"], monto: paga };
  }

  // --- Pregúntale: el botón de la cámara al lado del micrófono ---
  var ofUltimo = 0;
  function ofLeerFoto(file, decir, listo) {
    decir('Leyendo la oferta aquí en tu teléfono… <span id="ch-ocr-p"></span>' + (OCR ? "" : '<p class="pr-nota">La primera vez descargo el lector (unos 8 MB). Después queda guardado.</p>'));
    Promise.all([ocrCargar(), ocrImagen(file)]).then(function (r) { return r[0].recognize(r[1]); }).then(function (res) {
      listo(leerOferta(res && res.data ? res.data.text : ""));
    }).catch(function () { decir("No pude abrir el lector de fotos ahora. Escríbeme el precio y te digo cómo te queda."); });
  }
  if ($("pr-cam")) {
    $("pr-cam").hidden = !ocrPosible();
    $("pr-cam").addEventListener("click", function () { $("pr-foto").value = ""; $("pr-foto").click(); });
    $("pr-foto").addEventListener("change", function () {
      var f = this.files && this.files[0]; this.value = ""; if (!f || PR.ocupado) return;
      prBurbuja("Foto de una oferta", "yo"); prChips([]);
      var p = prBurbuja("", "app");
      ofLeerFoto(f, function (h) { p.innerHTML = "<p>" + h + "</p>"; prDesplazar(); }, function (o) {
        var r = ofRespuesta(o); ofUltimo = r.monto || 0;
        p.innerHTML = prConCifra(r.html); prChips(r.chips); prDesplazar(); metrica("pregunta", "dia");
      });
      prDesplazar();
    });
  }
  // "¿Y si la compro?" después de leer una oferta abre ¿Y si…? con el precio puesto
  $("pr-chips").addEventListener("click", function (e) {
    var b = e.target.closest(".pr-chip"); if (!b || b.textContent !== "¿Y si la compro?" || !ofUltimo) return;
    e.stopImmediatePropagation(); closeDlg("dlg-preguntas"); abrirYsi("c"); $("ysi-monto").value = String(ofUltimo); ysiCompra();
  }, true);

  // --- ¿Y si…?: "Leer una oferta con foto" en la pestaña de compra ---
  if ($("ysi-cam")) {
    $("ysi-cam").hidden = !ocrPosible();
    $("ysi-cam").addEventListener("click", function () { $("ysi-foto").value = ""; $("ysi-foto").click(); });
    $("ysi-foto").addEventListener("change", function () {
      var f = this.files && this.files[0]; this.value = ""; if (!f) return;
      var box = $("ysi-oferta"); box.hidden = false;
      ofLeerFoto(f, function (h) { box.innerHTML = "<p>" + h + "</p>"; }, function (o) {
        var r = ofRespuesta(o); box.innerHTML = r.html;
        if (r.monto) { $("ysi-monto").value = String(r.monto); ysiCompra(); }
        metrica("pregunta", "dia");
      });
    });
  }
  // ===================== Alertas inteligentes =====================
  // Se calculan en el dispositivo con el historial de movimientos: suscripciones que subieron de precio, posibles
  // cobros duplicados, categorías que se dispararon frente al mes pasado, suscripciones nuevas y gastos fuera de lo
  // normal. La persona las descarta con "Entendido" y no vuelven.
  var ALV_KEY = "fintelligente-alertas-vistas";
  function alertasVistas() { try { return JSON.parse(localStorage.getItem(ALV_KEY) || "[]"); } catch (e) { return []; } }
  function claveCom(c) { return nrm(c || "").replace(/[^a-z0-9 ]/g, "").split(" ").filter(function (w) { return w.length > 2; }).slice(0, 2).join(" "); }
  function fechaCorta(f) { var p = f.split("-"); return +p[2] + " de " + MESES[+p[1] - 1]; }
  // Cobros que se repiten cada mes por un valor parecido
  function recurrentes() {
    var g = {};
    state.movs.forEach(function (x) { if (x.t !== "g" || !x.c) return; var k = claveCom(x.c); if (!k) return; (g[k] = g[k] || { nombre: x.c, lista: [] }).lista.push(x); });
    return Object.keys(g).map(function (k) {
      var l = g[k].lista.slice().sort(function (a, b) { return a.f < b.f ? -1 : 1; }), meses = {};
      l.forEach(function (x) { (meses[x.f.slice(0, 7)] = meses[x.f.slice(0, 7)] || []).push(x); });
      var ks = Object.keys(meses).sort();
      if (ks.length < 2 || ks.some(function (m) { return meses[m].length > 2; })) return null;
      var montos = ks.map(function (m) { return meses[m][meses[m].length - 1].m; }), min = Math.min.apply(null, montos), max = Math.max.apply(null, montos);
      if (max > min * 1.6) return null;
      var dias = ks.map(function (m) { return +meses[m][0].f.slice(8, 10); }), spread = Math.max.apply(null, dias) - Math.min.apply(null, dias);
      if (spread > 9) return null;
      return { clave: k, nombre: g[k].nombre, montos: montos, meses: ks, ultimo: l[l.length - 1], cat: l[l.length - 1].cat, dia: dias[dias.length - 1] };
    }).filter(Boolean);
  }
  function calcularAlertas() {
    var out = [], hoy = d0(), hoyS = hoyStr(hoy), hace = function (n) { var d = new Date(hoy); d.setDate(d.getDate() - n); return hoyStr(d); };
    if (!state.movs.length || state.ejemplo) return out;
    // 1. Suscripción o cobro fijo que subió de precio
    recurrentes().forEach(function (r) {
      var n = r.montos.length, a = r.montos[n - 2], b = r.montos[n - 1];
      if (b > a * 1.03 && b - a >= 1000 && r.ultimo.f >= hace(40))
        out.push({ id: "sube|" + r.clave + "|" + r.meses[n - 1], tipo: "sube", ic: "i-trend", t: esc(r.nombre) + " te cobró " + money(b) + ", antes " + money(a) + " (+" + prPct(b / a - 1) + ").", d: "Si es una suscripción, revisa si el nuevo precio te sigue sirviendo." });
    });
    // 2. Posible cobro duplicado: mismo comercio, mismo valor, el mismo día
    var vistos = {};
    state.movs.forEach(function (x) {
      if (x.t !== "g" || x.f < hace(14) || !x.c) return;
      var k = claveCom(x.c) + "|" + x.m + "|" + x.f;
      if (vistos[k]) { if (vistos[k] === 1) out.push({ id: "dup|" + k, tipo: "dup", ic: "i-alert", t: esc(x.c) + " te cobró " + money(x.m) + " dos veces el " + fechaCorta(x.f) + ".", d: "Puede ser normal (dos compras iguales) o un cobro repetido. Revísalo en la app de tu banco." }); vistos[k]++; }
      else vistos[k] = 1;
    });
    // 3. Una categoría variable que va muy por encima del mes pasado a la misma altura
    var k = keyOf(hoy), kp = addMonths(k, -1), dd = ("0" + hoy.getDate()).slice(-2), a = {}, b = {};
    state.movs.forEach(function (x) {
      if (x.t !== "g") return;
      if (x.f >= k + "-01" && x.f <= hoyS) a[x.cat] = (a[x.cat] || 0) + x.m;
      else if (x.f >= kp + "-01" && x.f <= kp + "-" + dd) b[x.cat] = (b[x.cat] || 0) + x.m;
    });
    Object.keys(a).forEach(function (c) {
      var g = (catById(c) || {}).group;
      if (g !== "gus" && c !== "alimentacion" && c !== "transporte") return;
      if (b[c] > 0 && a[c] >= b[c] * 1.5 && a[c] - b[c] >= 50000)
        out.push({ id: "sube-cat|" + c + "|" + k, tipo: "cat", ic: "i-chart", t: "Llevas " + money(a[c]) + " en " + esc(prCatNombre(c)) + ", " + (a[c] >= b[c] * 1.95 ? "el doble" : "un " + prPct(a[c] / b[c] - 1) + " más") + " que el mes pasado a esta altura.", d: "Si fue algo puntual, no pasa nada. Si no, todavía estás a tiempo de ajustar." });
    });
    // 4. Suscripción nueva: un cobro mensual que empezó en los últimos dos meses
    recurrentes().forEach(function (r) {
      var primero = state.movs.filter(function (x) { return x.t === "g" && claveCom(x.c) === r.clave; }).reduce(function (m, x) { return x.f < m ? x.f : m; }, "9999");
      var hayHistoria = state.movs.some(function (x) { return x.f < addMonths(k, -3) + "-01"; });
      if (hayHistoria && primero >= addMonths(k, -1) + "-01" && r.meses.length === 2 && (catById(r.cat) || {}).group !== "nec")
        out.push({ id: "nueva|" + r.clave, tipo: "nueva", ic: "i-bell", t: "Parece un cobro mensual nuevo: " + esc(r.nombre) + ", " + money(r.montos[r.montos.length - 1]) + " al mes.", d: "Son " + money(r.montos[r.montos.length - 1] * 12) + " al año. Si no lo reconoces o ya no lo usas, cancélalo." });
    });
    // 5. Un gasto mucho más alto de lo normal en su categoría (últimos 7 días)
    var porCat = {};
    state.movs.forEach(function (x) { if (x.t === "g" && x.f < hace(7)) (porCat[x.cat] = porCat[x.cat] || []).push(x.m); });
    state.movs.forEach(function (x) {
      if (x.t !== "g" || x.f < hace(7) || x.m < 200000) return;
      var l = (porCat[x.cat] || []).slice().sort(function (p, q) { return p - q; }); if (l.length < 6) return;
      var med = l[Math.floor(l.length / 2)];
      if (x.m >= med * 4) out.push({ id: "grande|" + x.id, tipo: "grande", ic: "i-alert", t: "Gasto grande: " + money(x.m) + " en " + esc(x.c || prCatNombre(x.cat)) + " el " + fechaCorta(x.f) + ".", d: "Es varias veces lo que sueles gastar en " + esc(prCatNombre(x.cat)) + ". Si lo reconoces, todo bien." });
    });
    var fuera = alertasVistas();
    return out.filter(function (x) { return fuera.indexOf(x.id) < 0; });
  }
  function renderAlertas() {
    var box = $("alertas-card"); if (!box) return;
    var l = calcularAlertas();
    box.hidden = !l.length;
    if (!l.length) return;
    $("alertas-lista").innerHTML = l.slice(0, 3).map(function (x) {
      return '<li data-tipo="' + x.tipo + '"><span class="al-ic" aria-hidden="true"><svg class="ic"><use href="#' + x.ic + '"/></svg></span><span class="al-tx"><b>' + x.t + "</b><span>" + x.d + '</span></span><button class="link-btn" type="button" data-alerta="' + esc(x.id) + '">Entendido</button></li>';
    }).join("");
    $("alertas-mas").hidden = l.length <= 3;
    $("alertas-mas").textContent = l.length > 3 ? "Ver las " + l.length + " alertas" : "";
  }
  $("alertas-lista").addEventListener("click", function (e) {
    var b = e.target.closest("[data-alerta]"); if (!b) return;
    var v = alertasVistas(); v.push(b.dataset.alerta);
    try { localStorage.setItem(ALV_KEY, JSON.stringify(v.slice(-300))); } catch (er) {}
    renderAlertas();
  });
  $("alertas-mas").addEventListener("click", function () { abrirPreguntas("¿Hay algo raro en mis gastos?"); });
  PR_R.alertas = function () {
    PR.ctx = { intent: "alertas" };
    var l = calcularAlertas();
    if (!state.movs.length || state.ejemplo) return { html: "<p>Para avisarte de cobros raros necesito tu historial de movimientos. Conecta tu banco o importa el extracto y empiezo a vigilar.</p>", chips: ["¿Cómo conecto mi banco?", "¿Cómo importo el extracto?"] };
    if (!l.length) return { html: "<p>No veo nada raro: ni cobros repetidos, ni suscripciones que subieron, ni gastos fuera de lo normal. ¡Todo en orden!</p>", chips: ["¿Qué suscripciones tengo?", "¿En qué gasto más?"] };
    return { html: "<p>Encontré " + plural(l.length, "cosa") + " para revisar:</p><ul class=\"pr-lista\">" + l.map(function (x) { return "<li><b>" + x.t + "</b> " + x.d + "</li>"; }).join("") + "</ul>", chips: ["¿Qué suscripciones tengo?", "¿Cuánto se me va en gastos hormiga?"] };
  };
  PR_R.suscripciones = function () {
    PR.ctx = { intent: "suscripciones" };
    var r = recurrentes().filter(function (x) { return x.ultimo.f >= addMonths(keyOf(d0()), -1) + "-01"; });
    if (!r.length) return { html: "<p>No encuentro cobros que se repitan cada mes en tu historial" + (state.movs.length ? "" : " (todavía no tengo movimientos tuyos)") + ".</p>", chips: ["¿En qué gasto más?"] };
    var tot = r.reduce(function (a, x) { return a + x.montos[x.montos.length - 1]; }, 0);
    return { html: "<p>Estos cobros se repiten cada mes, por unos <b>" + money(tot) + "</b> en total (" + money(tot * 12) + " al año):</p><ul class=\"pr-lista\">" + r.sort(function (a, b) { return b.montos[b.montos.length - 1] - a.montos[a.montos.length - 1]; }).map(function (x) { return "<li><b>" + esc(x.nombre) + ":</b> " + money(x.montos[x.montos.length - 1]) + ", hacia el día " + x.dia + "</li>"; }).join("") + "</ul><p>¿Hay alguno que ya no uses? Cancelarlo es plata que te queda todos los meses.</p>", chips: ["¿Hay algo raro en mis gastos?", "¿Cuánto me queda este mes?"] };
  };
  PR_INT.splice(1, 0, ["alertas", /algo raro|alertas?|cobros? (raro|raros|duplicad|repetid|doble)|me cobraron (dos veces|doble)|cobro extrano/], ["suscripciones", /suscripcion|cobros? (fijos|mensuales|recurrentes)|que me cobran cada mes|pagos? automaticos/]);
  PR_EJ.push("¿Hay algo raro en mis gastos?", "¿Qué suscripciones tengo?");

  // ===================== Mi negocio =====================
  // Cuentas del negocio aparte de las personales: ventas, gastos del negocio y la ganancia del mes. De la ganancia
  // sale un sueldo fijo que pasa al presupuesto personal como ingreso; así no se mezcla la plata del negocio con la tuya.
  var NEG_CATS = [["mercancia", "Mercancía e insumos"], ["local", "Arriendo del local"], ["servicios", "Servicios e internet"], ["empleados", "Empleados y ayudantes"],
    ["domicilios", "Transporte y domicilios"], ["publicidad", "Publicidad y redes"], ["impuestos", "Impuestos y trámites"], ["otros", "Otros del negocio"]];
  var NEG_NOMBRE = {}; NEG_CATS.forEach(function (c) { NEG_NOMBRE[c[0]] = c[1]; });
  var negTipo = "v";
  function negDelMes(k) { return state.negocio.movs.filter(function (x) { return x.f.slice(0, 7) === k; }); }
  function negResumen(k) {
    var l = negDelMes(k), v = 0, g = 0, porCat = {};
    l.forEach(function (x) { if (x.t === "v") v += x.m; else { g += x.m; porCat[x.cat] = (porCat[x.cat] || 0) + x.m; } });
    return { ventas: v, gastos: g, ganancia: v - g, n: l.length, porCat: porCat, lista: l };
  }
  function mesAnterior(k) { var o = parseKey(k), d = new Date(o.y, o.m - 2, 1); return keyOf(d); }
  function pintarNegocio() {
    var k = state.mes, r = negResumen(k), ant = negResumen(mesAnterior(k));
    $("neg-mes").textContent = nombreMes(parseKey(k));
    $("neg-ventas").textContent = money(r.ventas); $("neg-gastos").textContent = money(r.gastos);
    $("neg-ganancia").textContent = money(r.ganancia); $("neg-ganancia").classList.toggle("neg-rojo", r.ganancia < 0);
    var comp = "";
    if (ant.n && r.n) { var d = r.ganancia - ant.ganancia; comp = d === 0 ? "Igual que el mes pasado." : (d > 0 ? "Ganaste " + money(d) + " más" : "Ganaste " + money(-d) + " menos") + " que el mes pasado."; }
    else if (r.ganancia < 0) comp = "Este mes los gastos van por encima de las ventas.";
    $("neg-comp").textContent = comp;
    var top = Object.keys(r.porCat).sort(function (a, b) { return r.porCat[b] - r.porCat[a]; }).slice(0, 3);
    $("neg-cats").innerHTML = top.length ? "En lo que más gasta tu negocio: " + top.map(function (c) { return esc(NEG_NOMBRE[c] || "Otros") + " (" + money(r.porCat[c]) + ")"; }).join(", ") + "." : "";
    // Sueldo: el que la persona fijó o, si no, lo que sugiere la ganancia de los meses anteriores.
    var sug = negSugerido(k), s = state.negocio.sueldo || sug;
    if (!$("neg-sueldo").matches(":focus")) $("neg-sueldo").value = s ? "$ " + fmtMiles(s) : "";
    $("neg-sueldo-n").textContent = sug ? "Sugerido: " + money(sug) + ", el promedio de lo que ganó tu negocio en sus meses más flojos." : "Escribe cuánto te vas a pagar cada mes. Lo que quede se queda en el negocio.";
    var ya = cur().ingresos.filter(function (x) { return x.id === "neg-sueldo"; })[0];
    $("neg-pasar").textContent = ya ? "Actualizar mi sueldo en el presupuesto" : "Pasar mi sueldo a mi presupuesto";
    var l = r.lista.slice().sort(function (a, b) { return a.f < b.f ? 1 : a.f > b.f ? -1 : 0; });
    $("neg-lista").innerHTML = l.length ? l.slice(0, 60).map(function (x) {
      return '<li><span class="neg-dot ' + (x.t === "v" ? "v" : "g") + '" aria-hidden="true"></span><div><b>' + esc(x.c || (x.t === "v" ? "Venta" : NEG_NOMBRE[x.cat] || "Gasto")) + "</b><small>" + esc(x.f.slice(8) + " de " + MESES[+x.f.slice(5, 7) - 1]) + (x.t === "g" && x.c ? " · " + esc(NEG_NOMBRE[x.cat] || "Otros") : "") + "</small></div>" +
        '<span class="neg-m">' + (x.t === "v" ? "+" : "−") + money(x.m).replace(/^-/, "") + '</span><button type="button" class="icon-btn" data-borrar="' + esc(x.id) + '" aria-label="Borrar">×</button></li>';
    }).join("") : '<li class="empty">Aún no hay ventas ni gastos del negocio este mes.</li>';
  }
  function negSugerido(k) {
    var vals = [];
    for (var i = 1, kk = k; i <= 6; i++) { kk = mesAnterior(kk); var r = negResumen(kk); if (r.n) vals.push(Math.max(0, r.ganancia)); }
    if (!vals.length) return 0;
    vals.sort(function (a, b) { return a - b; });
    var bajos = vals.slice(0, Math.max(1, Math.ceil(vals.length / 2)));
    return Math.floor(bajos.reduce(function (a, b) { return a + b; }, 0) / bajos.length / 10000) * 10000;
  }
  function negSetTipo(t) {
    negTipo = t;
    [].forEach.call(document.querySelectorAll("#neg-tipo [data-t]"), function (b) { b.setAttribute("aria-pressed", b.dataset.t === t ? "true" : "false"); });
    $("neg-cat-l").hidden = t === "v";
    $("neg-concepto").placeholder = t === "v" ? "Venta de mostrador, pedido de Laura…" : "Compra de mercancía, pago del local…";
  }
  function abrirNegocio() {
    $("menu-mas").hidden = true;
    $("neg-fecha").value = hoyStr(); $("neg-msg").textContent = "";
    negSetTipo("v"); pintarNegocio();
    openDlg("dlg-negocio", "#neg-valor");
  }
  $("neg-cat").innerHTML = NEG_CATS.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + "</option>"; }).join("");
  $("neg-tipo").addEventListener("click", function (e) { var b = e.target.closest("[data-t]"); if (b) negSetTipo(b.dataset.t); });
  ["neg-valor", "neg-sueldo"].forEach(function (id) { $(id).addEventListener("input", function () { var v = parseMonto(this.value); this.value = v ? "$ " + fmtMiles(v) : ""; }); });
  $("neg-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var m = parseMonto($("neg-valor").value), f = $("neg-fecha").value || hoyStr(), msg = $("neg-msg");
    if (!m) { msg.textContent = "Escribe el valor."; msg.className = "msg err"; $("neg-valor").focus(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) f = hoyStr();
    state.negocio.movs.push({ id: rid("n"), f: f, t: negTipo, cat: negTipo === "g" ? $("neg-cat").value : "", c: $("neg-concepto").value.trim().slice(0, 80), m: m });
    if (f.slice(0, 7) !== state.mes) msg.textContent = "Listo. Quedó en " + MESES[+f.slice(5, 7) - 1] + ".";
    else msg.textContent = negTipo === "v" ? "Venta anotada." : "Gasto del negocio anotado.";
    msg.className = "msg ok";
    $("neg-valor").value = ""; $("neg-concepto").value = "";
    changed(); pintarNegocio(); renderTrabajo(); metrica("negocio", "dia");
    $("neg-valor").focus();
  });
  $("neg-lista").addEventListener("click", function (e) {
    var b = e.target.closest("[data-borrar]"); if (!b) return;
    var i = state.negocio.movs.findIndex(function (x) { return x.id === b.dataset.borrar; }); if (i < 0) return;
    var quitado = state.negocio.movs.splice(i, 1)[0];
    changed(); pintarNegocio(); renderTrabajo();
    toast("Se borró.", { action: "Deshacer", onAction: function () { state.negocio.movs.push(quitado); changed(); pintarNegocio(); renderTrabajo(); } });
  });
  $("neg-sueldo").addEventListener("change", function () { state.negocio.sueldo = parseMonto(this.value); changed(); pintarNegocio(); });
  $("neg-pasar").addEventListener("click", function () {
    var s = parseMonto($("neg-sueldo").value), msg = $("neg-msg");
    if (!s) { msg.textContent = "Escribe primero cuánto te vas a pagar."; msg.className = "msg err"; $("neg-sueldo").focus(); return; }
    state.negocio.sueldo = s;
    var m = cur(), ya = m.ingresos.filter(function (x) { return x.id === "neg-sueldo"; })[0];
    if (ya) { ya.plan = s; ya.real = s; } else m.ingresos.push({ id: "neg-sueldo", concepto: "Sueldo de mi negocio", plan: s, real: s });
    changed(); renderAll(); pintarNegocio();
    msg.textContent = "Listo: " + money(s) + " entraron a tu presupuesto de " + MESES[parseKey(state.mes).m - 1] + " como sueldo."; msg.className = "msg ok";
  });
  $("btn-negocio-menu").addEventListener("click", abrirNegocio);

  // Tarjeta en Inicio para quien eligió la plantilla de independiente o de negocio.
  function renderTrabajo() {
    var card = $("trabajo-card"), p = state.prefs.perfil;
    if (state.ejemplo || (p !== "negocio" && p !== "independiente" && !state.negocio.movs.length)) { card.hidden = true; return; }
    card.hidden = false;
    if (p === "independiente" && !state.negocio.movs.length) {
      $("h-trabajo").textContent = "Para independientes";
      $("trabajo-txt").textContent = "Calcula tu sueldo fijo, lo que debes apartar para seguridad social y crea cuentas de cobro.";
      $("trabajo-btn").textContent = "Abrir"; $("trabajo-btn").dataset.abrir = "indep"; return;
    }
    var r = negResumen(state.mes);
    $("h-trabajo").textContent = "Mi negocio en " + MESES[parseKey(state.mes).m - 1];
    $("trabajo-txt").textContent = r.n ? "Vendiste " + money(r.ventas) + " y gastaste " + money(r.gastos) + ": " + (r.ganancia >= 0 ? "ganancia de " + money(r.ganancia) + "." : "vas " + money(-r.ganancia) + " abajo.") : "Anota las ventas y los gastos del negocio aparte de los tuyos y mira cuánto te queda.";
    $("trabajo-btn").textContent = r.n ? "Ver y anotar" : "Empezar"; $("trabajo-btn").dataset.abrir = "negocio";
  }
  // Pregúntale: el negocio y la seguridad social
  PR_R.negocio = function (q) {
    var per = q.per && q.per.k ? q.per.k : state.mes, r = negResumen(per), nom = MESES[parseKey(per).m - 1];
    PR.ctx = { intent: "negocio" };
    if (!state.negocio.movs.length) return { html: "<p>Todavía no has anotado ventas ni gastos de tu negocio. En el menú, <b>Mi negocio</b>, los anotas aparte de tus gastos personales y te digo cuánto ganas.</p>", chips: ["¿Cómo anoto las ventas de mi negocio?"] };
    if (!r.n) return { html: "<p>En " + nom + " no hay movimientos de tu negocio.</p>", chips: [] };
    var h = "<p>En " + nom + " tu negocio vendió <b>" + money(r.ventas) + "</b> y gastó " + money(r.gastos) + ": " + (r.ganancia >= 0 ? "<b>ganancia de " + money(r.ganancia) + "</b>." : "va <b>" + money(-r.ganancia) + " abajo</b>.") + "</p>";
    var sug = negSugerido(per); if (sug) h += "<p>Un sueldo fijo sano para ti sería de " + money(sug) + " al mes.</p>";
    return { html: h, chips: ["¿Cuánto me queda este mes?"] };
  };
  PR_R.seguridad = function (q) {
    var ing = q.monto || calcSueldo().prom || totalsOf(cur()).ingReal || totalsOf(cur()).ingPlan;
    PR.ctx = { intent: "seguridad" };
    if (!ing) return { html: "<p>Dime cuánto te entra al mes, por ejemplo: \"¿cuánto pago de seguridad social si gano $ 3.000.000?\"</p>", chips: [] };
    var c = calcSeguridad(ing, true);
    return { html: "<p>Si te entran " + money(ing) + " al mes como independiente, aparta unos <b>" + money(c.total) + "</b>: salud " + money(c.salud) + ", pensión " + money(c.pension) + (c.fsp ? ", solidaridad " + money(c.fsp) : "") + " y ARL " + money(c.arl) + ".</p><p class=\"pr-nota\">Es un cálculo de referencia sobre el 40 % de tus ingresos. El valor exacto lo da tu planilla PILA.</p>", chips: [] };
  };
  PR_INT.splice(1, 0, ["seguridad", /seguridad social|\bpila\b|cuanto (pago|debo pagar|me toca pagar) de (salud|pension)|cotizar (salud|pension)|aportes? (a|de) (salud|pension)/],
    ["negocio", /\bvend(i|o|imos|ido)\b|ventas|mi negocio|el negocio|ganancia|cuanto gane en el negocio/]);
  PR_COMO.unshift(
    [/cuenta de cobro|cobrarle a un cliente/, "trabajo", "En el menú, <b>Para independientes</b>, pestaña Cuenta de cobro: llenas tus datos y los del cliente y la guardas en PDF."],
    [/seguridad social|\bpila\b|sueldo fijo|ingresos? variables?/, "trabajo", "En el menú, <b>Para independientes</b>: ahí calculas tu sueldo fijo y cuánto apartar para seguridad social."],
    [/negocio|ventas|vender/, "trabajo", "En el menú, <b>Mi negocio</b>: anotas ventas y gastos del negocio aparte de los tuyos, ves la ganancia y te pagas un sueldo."],
    [/invit|referi|recomendar la app|compartir la app|premium gratis/, "", "En el menú, <b>Invita y gana Premium</b>: compartes tu enlace y, por cada persona que compre Premium con él, te damos un código de Premium."],
    [/(rehacer|cambiar|armar de nuevo|plantilla).{0,25}presupuesto|plantilla/, "", "En el menú, <b>Rehacer mi presupuesto</b>: eliges para quién es (estudiante, familia, independiente…) y lo armo de nuevo sin perder lo que ya gastaste."]
  );
  PR_EJ.push("¿Cuánto vendí este mes?", "¿Cuánto pago de seguridad social?");
  $("trabajo-btn").addEventListener("click", function () { if (this.dataset.abrir === "indep") abrirIndep(); else abrirNegocio(); });
  window.FinNegocio = { resumen: negResumen, sugerido: negSugerido };

  // ===================== Para independientes =====================
  // 1. Tu sueldo fijo: con ingresos que cambian, te pagas lo mismo cada mes y el resto va a un colchón.
  // 2. Seguridad social: cuánto apartar para salud, pensión y ARL (IBC del 40 %; valores de 2026).
  // 3. Cuenta de cobro: documento listo para imprimir o guardar en PDF. Los datos quedan solo en este dispositivo.
  var SMMLV = 1750905, SMMLV_ANO = 2026, COBRO_KEY = "fintelligente-cobro";
  function ingresosMensuales() {
    return monthKeys().filter(function (k) { return k < keyOf(d0()); }).slice(-12).map(function (k) { return { k: k, v: totalsOf(state.meses[k]).ingReal }; }).filter(function (x) { return x.v > 0; });
  }
  function calcSueldo() {
    var l = ingresosMensuales(), m = cur(), t = totalsOf(m), fijos = t.byGroup.nec || t.gasPlan * 0.5;
    if (l.length < 2) return { pocos: true, n: l.length, fijos: fijos };
    var vals = l.map(function (x) { return x.v; }).sort(function (a, b) { return a - b; });
    var prom = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length, bajos = vals.slice(0, Math.max(1, Math.ceil(vals.length / 2)));
    var sueldo = Math.floor(bajos.reduce(function (a, b) { return a + b; }, 0) / bajos.length / 10000) * 10000;
    return { n: l.length, prom: prom, min: vals[0], max: vals[vals.length - 1], sueldo: sueldo, fijos: fijos, colchon: Math.ceil(fijos * 3 / 10000) * 10000, esteMes: t.ingReal };
  }
  function pintarSueldo() {
    var r = calcSueldo(), h;
    if (r.pocos) h = "<p>Para calcular tu sueldo fijo necesito al menos 2 meses anteriores con ingresos registrados" + (r.n ? " (tengo " + r.n + ")" : "") + ". Mientras tanto, un buen punto de partida: págate lo que te entra en un mes flojo y aparta todo lo demás.</p>";
    else {
      var dif = r.esteMes - r.sueldo;
      h = '<div class="ind-cifra"><span>Págate cada mes</span><b>' + money(r.sueldo) + "</b><small>Es el promedio de tus meses más flojos de los últimos " + prMeses(r.n) + ".</small></div>" +
        "<ul class=\"pr-lista\"><li>Tus ingresos van de " + money(r.min) + " a " + money(r.max) + " (promedio " + money(Math.round(r.prom / 1000) * 1000) + ").</li>" +
        "<li>Tu colchón debería llegar a <b>" + money(r.colchon) + "</b>: tres meses de tus gastos necesarios.</li>" +
        (r.esteMes ? "<li>Este mes te han entrado " + money(r.esteMes) + ": " + (dif >= 0 ? "págate " + money(r.sueldo) + " y <b>aparta " + money(dif) + " al colchón</b>." : "págate tu sueldo completo <b>tomando " + money(-dif) + " del colchón</b>. Para eso está.") + "</li>" : "") + "</ul>";
    }
    $("ind-sueldo-res").innerHTML = h;
  }
  function calcSeguridad(ingreso, arl) {
    var ibc = Math.min(25 * SMMLV, Math.max(SMMLV, Math.round(ingreso * 0.4))), sal = ibc * 0.125, pen = ibc * 0.16, fsp = ibc >= 4 * SMMLV ? ibc * 0.01 : 0, ar = arl ? ibc * 0.00522 : 0;
    var r = function (v) { return Math.ceil(v / 100) * 100; };
    return { ibc: ibc, salud: r(sal), pension: r(pen), fsp: r(fsp), arl: r(ar), total: r(sal) + r(pen) + r(fsp) + r(ar), bajo: ingreso < SMMLV };
  }
  function pintarSeguridad() {
    var ing = parseMonto($("ind-ss-ing").value), arl = $("ind-ss-arl").checked, out = $("ind-ss-res");
    if (!ing) { out.innerHTML = ""; return; }
    var c = calcSeguridad(ing, arl);
    out.innerHTML = (c.bajo ? '<p class="pr-nota">Con ingresos menores a un salario mínimo, por lo general no estás obligado a cotizar como independiente. Confírmalo con tu contador.</p>' : "") +
      '<div class="ind-cifra"><span>Aparta al mes</span><b>' + money(c.total) + "</b><small>El " + prPct(c.total / ing) + " de lo que te entra.</small></div>" +
      '<table class="ind-tabla"><tr><td>Ingreso base de cotización (40 %' + (c.ibc === SMMLV ? ", mínimo un salario" : "") + ")</td><td>" + money(c.ibc) + "</td></tr>" +
      "<tr><td>Salud (12,5 %)</td><td>" + money(c.salud) + "</td></tr><tr><td>Pensión (16 %)</td><td>" + money(c.pension) + "</td></tr>" +
      (c.fsp ? "<tr><td>Fondo de solidaridad pensional (1 %)</td><td>" + money(c.fsp) + "</td></tr>" : "") +
      (arl ? "<tr><td>ARL, riesgo I (0,522 %)</td><td>" + money(c.arl) + "</td></tr>" : "") + "</table>" +
      '<p class="pr-nota">Cálculo de referencia con el salario mínimo de ' + SMMLV_ANO + " (" + money(SMMLV) + "). El valor exacto lo da tu planilla PILA; tu contador puede ayudarte con costos deducibles.</p>";
  }
  // Cifras en letras para la cuenta de cobro: 1.250.000 → "un millón doscientos cincuenta mil pesos"
  function enLetras(n) {
    n = Math.floor(Math.abs(n));
    var U = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
    var D = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
    var C = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
    function cien(x) { if (x === 100) return "cien"; var c = Math.floor(x / 100), r = x % 100, s = C[c]; if (r) s += (s ? " " : "") + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? " y " + U[r % 10] : "")); return s; }
    function un(t) { return t.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un"); }
    function mil(x) { var m = Math.floor(x / 1000), r = x % 1000, s = m ? (m === 1 ? "" : un(cien(m)) + " ") + "mil " : ""; if (r) s += cien(r); return s.trim(); }
    if (!n) return "cero pesos";
    if (n === 1) return "un peso";
    var mm = Math.floor(n / 1e6), r = n % 1e6, s = mm ? (mm === 1 ? "un millón" : un(mil(mm)) + " millones") : "";
    if (r) s += (s ? " " : "") + un(mil(r));
    return s + (r === 0 && mm ? " de pesos" : " pesos");
  }
  function leerCobro() { try { return JSON.parse(localStorage.getItem(COBRO_KEY) || "{}"); } catch (e) { return {}; } }
  var COBRO_CAMPOS = ["nombre", "doc", "ciudad", "tel", "correo", "cliente", "clienteDoc", "banco", "cuenta"];
  function abrirIndep(tab) {
    $("menu-mas").hidden = true;
    var d = leerCobro();
    COBRO_CAMPOS.forEach(function (c) { $("cc-" + c).value = d[c] || ""; });
    $("cc-num").value = d.num ? d.num + 1 : 1; $("cc-iva").checked = d.iva !== false;
    var r = calcSueldo(); if (!$("ind-ss-ing").value) $("ind-ss-ing").value = r.prom ? "$ " + fmtMiles(Math.round(r.prom / 1000) * 1000) : (totalsOf(cur()).ingPlan ? "$ " + fmtMiles(totalsOf(cur()).ingPlan) : "");
    pintarSueldo(); pintarSeguridad(); indTab(tab || "sueldo");
    openDlg("dlg-indep", "#ind-tabs [aria-selected=true]");
  }
  function indTab(t) {
    [].forEach.call(document.querySelectorAll("#ind-tabs [data-tab]"), function (b) { b.setAttribute("aria-selected", b.dataset.tab === t ? "true" : "false"); });
    [].forEach.call(document.querySelectorAll("#dlg-indep [data-panel]"), function (p) { p.hidden = p.dataset.panel !== t; });
  }
  $("ind-tabs").addEventListener("click", function (e) { var b = e.target.closest("[data-tab]"); if (b) indTab(b.dataset.tab); });
  $("ind-ss-ing").addEventListener("input", function () { var v = parseMonto(this.value); this.value = v ? "$ " + fmtMiles(v) : ""; pintarSeguridad(); });
  $("ind-ss-arl").addEventListener("change", pintarSeguridad);
  $("cc-valor").addEventListener("input", function () { var v = parseMonto(this.value); this.value = v ? "$ " + fmtMiles(v) : ""; $("cc-letras").textContent = v ? cap(enLetras(v)) + "." : ""; });
  $("cc-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var d = {}, msg = $("cc-msg");
    COBRO_CAMPOS.forEach(function (c) { d[c] = $("cc-" + c).value.trim().slice(0, 120); });
    var valor = parseMonto($("cc-valor").value), concepto = $("cc-concepto").value.trim().slice(0, 600), num = Math.max(1, Math.floor(+$("cc-num").value || 1));
    if (!d.nombre || !d.doc || !d.cliente || !concepto || !valor) { msg.textContent = "Completa tu nombre y documento, el cliente, el concepto y el valor."; msg.className = "msg err"; return; }
    d.num = num; d.iva = $("cc-iva").checked;
    try { localStorage.setItem(COBRO_KEY, JSON.stringify(d)); } catch (er) {}
    var hoy = new Date(), ciudad = d.ciudad || "";
    $("informe").innerHTML = '<div class="cobro">' +
      '<p class="cobro-fecha">' + esc(ciudad ? ciudad + ", " : "") + fechaLarga(hoy) + " de " + hoy.getFullYear() + "</p>" +
      '<h1>Cuenta de cobro n.º ' + num + "</h1>" +
      '<p class="cobro-cliente"><b>' + esc(d.cliente) + "</b>" + (d.clienteDoc ? "<br>NIT o C. C. " + esc(d.clienteDoc) : "") + "</p>" +
      "<p>Debe a:</p><p class=\"cobro-yo\"><b>" + esc(d.nombre) + "</b><br>C. C. o NIT " + esc(d.doc) + "</p>" +
      '<p>La suma de:</p><p class="cobro-valor"><b>' + money(valor) + "</b><br>" + esc(cap(enLetras(valor))) + ".</p>" +
      "<p>Por concepto de:</p><p class=\"cobro-concepto\">" + esc(concepto).replace(/\n/g, "<br>") + "</p>" +
      (d.banco || d.cuenta ? "<p>Favor consignar a: " + esc(d.banco) + (d.cuenta ? ", cuenta " + esc(d.cuenta) : "") + ".</p>" : "") +
      (d.iva ? "<p class=\"cobro-nota\">No soy responsable del impuesto sobre las ventas (IVA).</p>" : "") +
      '<div class="cobro-firma"><span></span><b>' + esc(d.nombre) + "</b><br>C. C. o NIT " + esc(d.doc) + (d.tel ? "<br>Tel. " + esc(d.tel) : "") + (d.correo ? "<br>" + esc(d.correo) : "") + "</div></div>";
    msg.textContent = ""; $("cc-num").value = num + 1;
    var titulo = document.title; document.title = "Cuenta de cobro " + num + " - " + d.cliente;
    document.body.classList.add("imprimiendo");
    var fin = function () { document.body.classList.remove("imprimiendo"); document.title = titulo; window.removeEventListener("afterprint", fin); };
    window.addEventListener("afterprint", fin);
    metrica("cobro", "dia");
    setTimeout(function () { try { window.print(); } catch (er) {} }, 60);
  });
  $("btn-indep-menu").addEventListener("click", function () { abrirIndep(); });
  window.FinIndep = { seguridad: calcSeguridad, letras: enLetras };

  // ===================== Aprende a usar la app: mini guías =====================
  // Guías cortas por tema. Cada paso ilumina una parte de la pantalla y explica para qué sirve. Si un paso necesita
  // otra sección o una ventana abierta, la guía la abre y la cierra al terminar. Se marcan las guías vistas.
  var GUIA_KEY = "fintelligente-guias";
  var REG_SEL = ["#barra-registrar", "#fab-add", "#lat-registrar", "#btn-registrar-top"];
  var GUIAS = [
    { id: "basico", t: "Lo básico", d: "Qué ves al abrir la app y cómo moverte.", ic: "i-home", pasos: [
      { vista: "inicio", sel: "#hoy-card", t: "Hoy puedes gastar", x: "Lo que puedes gastar hoy para llegar con calma al cierre del mes. La barra muestra cuánto va del mes." },
      { sel: "#hoy-registrar", t: "Cuéntame un gasto", x: "Escríbelo como lo dirías, por ejemplo \"$ 18.000 en almuerzo\", y yo lo anoto en su categoría." },
      { sel: ".month-nav", t: "Cambia de mes", x: "Con las flechas ves los meses anteriores. Con \"+ Nuevo mes\" arrancas el siguiente con la misma lista de conceptos." },
      { sel: ["#btn-menu", "#tabs"], t: "El menú", x: "Aquí están las secciones (Movimientos, Metas, Cuentas, Análisis y Tu presupuesto), además de conectar bancos, importar el extracto y estas guías." },
      { sel: REG_SEL, t: "Registrar", x: "El botón más importante: anota un gasto o un ingreso en segundos." }
    ] },
    { id: "registrar", t: "Registrar un gasto", d: "Anota lo que gastas en 5 segundos.", ic: "i-plus", cierra: ["dlg-add"], pasos: [
      { vista: "inicio", sel: REG_SEL, t: "Empieza aquí", x: "Toca \"Registrar\" cada vez que gastes o te entre plata. Anotarlo al momento es lo que hace que la app te conozca." },
      { antes: function () { abrirRegistro("gasto"); }, sel: "#add-tipo", t: "¿Gasto o ingreso?", x: "Elige qué vas a anotar." },
      { sel: ".amount-box", t: "El valor", x: "Escribe el monto o súmalo con los botones rápidos." },
      { sel: "#add-items", t: "¿En qué?", x: "Elige el concepto de tu presupuesto. El gasto se suma solo a su categoría y a tu mes." },
      { sel: "#add-pegar", t: "Un truco", x: "Si te llegó un aviso del banco, pégalo aquí y lo leemos por ti." }
    ] },
    { id: "presupuesto", t: "Tu presupuesto del mes", d: "Lo planeado frente a lo real.", ic: "i-list", pasos: [
      { vista: "presupuesto", sel: "#h-ing", panel: true, t: "Ingresos", x: "Lo que esperas recibir (planeado) y lo que de verdad te ha entrado (real)." },
      { sel: "#h-gas", panel: true, t: "Gastos", x: "Cada concepto con su categoría. La diferencia en verde es lo que te sobra; en rojo, lo que te pasaste. En \"Día\" va la fecha de pago, si tiene." },
      { sel: "#add-gas", t: "Agrega conceptos", x: "Suma los gastos que faltan: el gimnasio, la cuota del carro, lo que sea tuyo." },
      { sel: "#btn-nuevo-mes", t: "Mes nuevo", x: "Al empezar el mes, crea el siguiente: se copia tu lista con lo planeado y lo real arranca en cero." }
    ] },
    { id: "notas", t: "Notas del mes", d: "Logros, alertas, recordatorios e ideas.", ic: "i-edit", pasos: [
      { vista: "analisis", sel: ".notas-panel", t: "Tus notas", x: "Anota lo que no quieres olvidar del mes. Salen también en tu Excel." },
      { sel: "#nota-tipos", t: "El tipo", x: "Un logro para celebrar, una alerta, un recordatorio o una idea. Las alertas y los recordatorios salen primero." },
      { sel: "#f-nota-nueva", t: "Escríbela", x: "Escribe y toca \"Agregar\". Arriba, en esta misma sección, verás tus notas más importantes, y al cambiar de mes te ofrezco traer los recordatorios pendientes." }
    ] },
    { id: "bancos", t: "Conectar tu banco", d: "Que tus gastos lleguen solos.", ic: "i-wallet", pasos: [
      { vista: "cuentas", sel: "#h-auto", panel: true, t: "Registro automático", x: "Tus compras y pagos llegan desde los avisos de tus bancos y tus facturas electrónicas. Nunca pedimos tus claves." },
      { sel: "[data-open-fuentes]", t: "Conectar bancos", x: "Aquí eliges cómo llegan: en Android se leen los avisos del celular; en iPhone o el computador, por correo." },
      { sel: "#btn-bandeja-cuentas", t: "Por confirmar", x: "Lo que llega espera aquí. Tú lo confirmas con un toque y se suma a tu mes." }
    ] },
    { id: "extracto", t: "Importar el extracto", d: "Trae tus meses anteriores de una vez.", ic: "i-up", cierra: ["dlg-extracto"], pasos: [
      { antes: function () { abrirExtracto(); }, sel: "#dlg-extracto .pasos", t: "Descarga tus movimientos", x: "En la app o la página de tu banco, busca \"Movimientos\" y descárgalos en Excel o CSV (no el PDF)." },
      { sel: "#extracto-elegir", t: "Súbelo aquí", x: "Encuentro la fecha, la descripción y el valor, salto lo repetido y los traslados entre tus cuentas, y te muestro un resumen antes de importar." },
      { sel: "#dlg-extracto .privacy", t: "Privado", x: "El archivo se lee en tu dispositivo y no se envía a ninguna parte." }
    ] },
    { id: "pagos", t: "Pagos y recordatorios", d: "Que no se te pase ninguna fecha.", ic: "i-bell", pasos: [
      { vista: "cuentas", sel: "#h-porpagar", panel: true, t: "Cuentas por pagar", x: "Agrega el arriendo, los servicios, las cuotas o el SOAT con su fecha. Te aviso antes de que venzan y, al pagar, se suma solo a tus gastos." },
      { sel: "#h-cuentas", panel: true, t: "Cuentas de dinero", x: "Tus bancos, Nequi, Daviplata, efectivo y tarjetas. Al registrar un gasto eliges de dónde salió y el saldo se actualiza." },
      { vista: "inicio", sel: "#h-pagos", panel: true, t: "En Inicio", x: "Aquí ves tus próximos pagos y cuánto te falta pagar este mes." }
    ] },
    { id: "metas", t: "Metas y deudas", d: "Ahorra para lo que quieres y sal de deudas.", ic: "i-target", pasos: [
      { vista: "metas", sel: "#h-metas", panel: true, t: "Metas de ahorro", x: "Ponle nombre, valor y fecha a lo que quieres. Te digo cuánto apartar al mes." },
      { sel: "#h-reto", panel: true, t: "Reto de las 52 semanas", x: "Un ahorro que crece cada semana. Es gratis y se vuelve costumbre." },
      { sel: "#h-deudas", panel: true, t: "Plan para salir de deudas", x: "Agrega cada deuda con su saldo, tasa y cuota. Te digo cuál pagar primero y cuándo terminas." }
    ] },
    { id: "analisis", t: "Análisis y asesor", d: "Entiende tus números.", ic: "i-chart", pasos: [
      { vista: "analisis", sel: "#h-cat", panel: true, t: "Ejecución por categoría", x: "Cada categoría frente a lo planeado, en su color: el porcentaje se pone ámbar desde el 90 % y la barra, roja al pasarte." },
      { sel: "#h-rule", panel: true, t: "Regla 50/30/20", x: "Una referencia sencilla: 50 % necesidades, 30 % gustos y 20 % ahorro." },
      { sel: ["#sec-ia", "#h-hist"], panel: true, t: "Historial y asesor", x: "Con Premium ves tus meses anteriores y un asesor que simula tu futuro y te da ideas con tus números." }
    ] },
    { id: "preguntas", t: "Pregúntale a la app", d: "Haz preguntas sobre tu plata.", ic: "i-chat", cierra: ["dlg-preguntas"], pasos: [
      { vista: "analisis", sel: "#preg-card", t: "Pregúntale", x: "Escribe tu pregunta como se la harías a una persona: \"¿cuánto gasté en comida?\" o \"¿me alcanza para unos tenis de $ 300.000?\"." },
      { antes: function () { abrirPreguntas(); }, sel: "#pr-chips", t: "Sugerencias", x: "Si no sabes qué preguntar, toca una de estas. Después de cada respuesta te propongo otras." },
      { sel: "#pr-form", t: "Escribe", x: "También entiendo seguimientos como \"¿y en transporte?\" o \"¿y el mes pasado?\". Todo se calcula en tu dispositivo." }
    ] },
    { id: "excel", t: "Tu Excel y tu respaldo", d: "Lleva tus números a donde quieras.", ic: "i-down", pasos: [
      { sel: "#btn-mas", t: "Más opciones", x: "Aquí descargas tu presupuesto en Excel o lo copias para pegarlo en Google Sheets." },
      { sel: "#btn-colores", t: "Colores", x: "Elige el color de la app y el modo claro u oscuro." },
      { sel: ["#btn-cuenta", "#lat-cuenta"], t: "Tu cuenta", x: "Con tu cuenta, tu presupuesto se guarda cifrado en la nube y lo abres en otros dispositivos." }
    ] },
    { id: "premium", t: "Premium", d: "Qué incluye y cómo activarlo.", ic: "i-star", cierra: ["dlg-premium"], pasos: [
      { sel: ["#btn-premium", "#lat-premium"], t: "Premium", x: "Historial completo, metas, plan de deudas, categorías propias y el asesor. Es un pago único." },
      { antes: function () { openPremium(); }, sel: "#dlg-premium .dlg", t: "Qué incluye", x: "Aquí ves todo lo que trae y el precio. Si te regalaron un código, también se activa aquí." }
    ] },
    { id: "trabajo", t: "Independientes y negocio", d: "Sueldo fijo, seguridad social, cuentas de cobro y Mi negocio.", ic: "i-brief", cierra: ["dlg-indep", "dlg-negocio"], pasos: [
      { antes: function () { abrirIndep("sueldo"); }, sel: "#dlg-indep .dlg", t: "Tu sueldo fijo", x: "Si lo que te entra cambia cada mes, te propongo un sueldo fijo con tus meses más flojos. Lo que sobra va a tu colchón." },
      { antes: function () { indTab("ss"); }, sel: "#ind-tabs", t: "Seguridad social y cuentas de cobro", x: "En las otras pestañas calculas cuánto apartar para salud, pensión y ARL, y creas cuentas de cobro en PDF." },
      { antes: function () { closeDlg("dlg-indep"); abrirNegocio(); }, sel: "#dlg-negocio .neg-tiles", t: "Mi negocio", x: "Anota ventas y gastos del negocio aparte de los tuyos. Ves la ganancia del mes y te pagas un sueldo que pasa a tu presupuesto." }
    ] }
  ];
  var GU = { g: null, i: 0, abiertas: [] };
  function guiasVistas() { try { return JSON.parse(localStorage.getItem(GUIA_KEY) || "[]"); } catch (e) { return []; } }
  function marcarGuia(id) { var v = guiasVistas(); if (v.indexOf(id) < 0) { v.push(id); try { localStorage.setItem(GUIA_KEY, JSON.stringify(v)); } catch (e) {} } }
  function visible(el) { if (!el) return false; var r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !el.closest("[hidden]"); }
  function guiaObjetivo(p) {
    var lista = [].concat(p.sel);
    for (var i = 0; i < lista.length; i++) {
      var el = document.querySelector(lista[i]);
      if (el && p.panel) el = el.closest(".panel, section") || el;
      if (visible(el)) return el;
    }
    return null;
  }
  function renderGuias() {
    var vistas = guiasVistas();
    $("guias-lista").innerHTML = GUIAS.map(function (g) {
      var ok = vistas.indexOf(g.id) > -1;
      return '<button type="button" class="guia-item' + (ok ? " vista" : "") + '" data-guia="' + g.id + '"><span class="guia-ic" aria-hidden="true"><svg class="ic"><use href="#' + g.ic + '"/></svg></span>' +
        '<span class="guia-tx"><b>' + esc(g.t) + "</b><span>" + esc(g.d) + " · " + plural(g.pasos.length, "paso") + "</span></span>" +
        (ok ? '<span class="guia-ok"><svg class="ic"><use href="#i-check"/></svg><span class="sr-only">Vista</span></span>' : "") + "</button>";
    }).join("");
    var n = GUIAS.filter(function (g) { return vistas.indexOf(g.id) > -1; }).length;
    $("guias-progreso").textContent = n ? "Has visto " + n + " de " + GUIAS.length + " guías." : "Elige un tema. Cada guía toma menos de un minuto.";
  }
  function abrirGuias() { $("menu-mas").hidden = true; renderGuias(); openDlg("dlg-guias", ".guia-item"); }
  function iniciarGuia(id) {
    var g = GUIAS.filter(function (x) { return x.id === id; })[0]; if (!g) return;
    if (!$("dlg-guias").hidden) closeDlg("dlg-guias");
    var lat = $("lateral"); if (lat.classList.contains("abierta")) $("lat-cerrar").click();
    GU.g = g; GU.i = 0; GU.foco = document.activeElement;
    $("guia-capa").hidden = false; document.body.classList.add("en-guia");
    metrica("guia", "dia");
    guiaPaso(0);
  }
  function guiaPaso(i) {
    var g = GU.g, p = g.pasos[i]; GU.i = i;
    if (p.vista) irA(p.vista, true);
    if (p.antes) try { p.antes(); } catch (e) {}
    $("guia-globo").classList.add("cargando");
    setTimeout(function () {
      var el = guiaObjetivo(p);
      if (el) { try { el.scrollIntoView({ block: "center", behavior: "auto" }); } catch (e) { el.scrollIntoView(); } }
      setTimeout(function () {
        GU.el = el;
        $("guia-paso").textContent = "Paso " + (i + 1) + " de " + g.pasos.length + " · " + g.t;
        $("guia-t").textContent = p.t; $("guia-x").textContent = p.x;
        $("guia-atras").hidden = i === 0;
        $("guia-sig").textContent = i === g.pasos.length - 1 ? "Terminar" : "Siguiente";
        $("guia-globo").classList.remove("cargando");
        guiaPosicion();
        $("guia-sig").focus({ preventScroll: true });
      }, 60);
    }, p.antes || p.vista ? 220 : 30);
  }
  function guiaPosicion() {
    if (!GU.g) return;
    var luz = $("guia-luz"), globo = $("guia-globo"), el = GU.el, vw = window.innerWidth, vh = window.innerHeight, m = 8;
    if (!el || !visible(el)) { luz.hidden = true; globo.style.left = Math.max(12, (vw - globo.offsetWidth) / 2) + "px"; globo.style.top = Math.max(12, (vh - globo.offsetHeight) / 2) + "px"; globo.dataset.lado = ""; return; }
    var r = el.getBoundingClientRect(), top = Math.max(4, r.top - m), left = Math.max(4, r.left - m), w = Math.min(vw - 8, r.width + 2 * m), h = Math.min(vh - top - 4, r.height + 2 * m);
    luz.hidden = false; luz.style.top = top + "px"; luz.style.left = left + "px"; luz.style.width = w + "px"; luz.style.height = Math.max(24, h) + "px";
    var gh = globo.offsetHeight, gw = globo.offsetWidth, gl = Math.min(Math.max(12, r.left + r.width / 2 - gw / 2), vw - gw - 12), gt;
    if (top + h + 12 + gh <= vh - 8) { gt = top + h + 12; globo.dataset.lado = "abajo"; }
    else if (top - 12 - gh >= 8) { gt = top - 12 - gh; globo.dataset.lado = "arriba"; }
    else { gt = Math.max(8, vh - gh - 12); globo.dataset.lado = ""; }
    globo.style.left = gl + "px"; globo.style.top = gt + "px";
  }
  function terminarGuia(completa) {
    var g = GU.g; if (!g) return;
    if (completa) { marcarGuia(g.id); metrica("guia_completa", "dia"); }
    (g.cierra || []).forEach(function (id) { if (!$(id).hidden) closeDlg(id); });
    GU.g = null; GU.el = null;
    $("guia-capa").hidden = true; document.body.classList.remove("en-guia");
    if (completa) {
      var sig = GUIAS.filter(function (x) { return guiasVistas().indexOf(x.id) < 0; })[0];
      toast("¡Listo! Ya sabes usar \"" + esc(g.t.toLowerCase()) + "\".", sig ? { action: "Siguiente guía", onAction: function () { iniciarGuia(sig.id); } } : {});
    }
  }
  $("guia-sig").addEventListener("click", function () { if (GU.i >= GU.g.pasos.length - 1) terminarGuia(true); else guiaPaso(GU.i + 1); });
  $("guia-atras").addEventListener("click", function () { if (GU.i > 0) { var p = GU.g.pasos[GU.i]; (p.antes && GU.g.cierra ? GU.g.cierra : []).forEach(function (id) { if (!$(id).hidden) closeDlg(id); }); guiaPaso(GU.i - 1); } });
  $("guia-salir").addEventListener("click", function () { terminarGuia(false); });
  document.addEventListener("keydown", function (e) {
    if (!GU.g) return;
    if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); terminarGuia(false); }
    else if (e.key === "ArrowRight") { e.preventDefault(); $("guia-sig").click(); }
    else if (e.key === "ArrowLeft" && GU.i > 0) { e.preventDefault(); $("guia-atras").click(); }
  }, true);
  window.addEventListener("resize", function () { if (GU.g) guiaPosicion(); });
  window.addEventListener("scroll", function () { if (GU.g) guiaPosicion(); }, true);
  $("guias-lista").addEventListener("click", function (e) { var b = e.target.closest("[data-guia]"); if (b) iniciarGuia(b.dataset.guia); });
  $("btn-guias-menu").addEventListener("click", abrirGuias);

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

  // ===================== Informe del mes (PDF) =====================
  // Arma una página de informe con el resumen del mes y abre el diálogo de impresión del navegador, donde se elige
  // "Guardar como PDF". Todo se hace en el dispositivo.
  function armarInforme() {
    var m = cur(), t = totalsOf(m), p = puntaje(t), k = state.mes, hoy = new Date();
    var filaCat = Object.keys(t.byCat).filter(function (id) { return t.byCat[id].plan || t.byCat[id].real; }).sort(function (a, b) { return t.byCat[b].real - t.byCat[a].real; });
    var kp = addMonths(k, -1), tp = state.meses[kp] ? totalsOf(state.meses[kp]) : null;
    var movsMes = state.movs.filter(function (x) { return x.t === "g" && x.f.slice(0, 7) === k; }), porCom = {};
    movsMes.forEach(function (x) { var c = x.c || "Otros"; porCom[c] = (porCom[c] || 0) + x.m; });
    var topCom = Object.keys(porCom).sort(function (a, b) { return porCom[b] - porCom[a]; }).slice(0, 8);
    var notas = leerNotas(m.notas), dif = function (a, b) { return b ? (a >= b ? "+" : "−") + prPct(Math.abs(a / b - 1)) : ""; };
    var logo = '<svg class="inf-logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#2e5bff"/><path d="M10 23V9h11M10 16h8" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="23" cy="21" r="2.6" fill="#ffc53d"/></svg>';
    var h = '<header class="inf-cab"><div class="inf-id">' + logo + '<div><b class="inf-marca">Finti</b><span>' + esc(state.titulo || "Mi presupuesto") + "</span></div></div><div class=\"inf-mes\"><b>" + esc(monthLabel(k)) + "</b><span>Generado el " + fechaLarga(hoy) + " de " + hoy.getFullYear() + "</span></div></header>";
    h += '<section class="inf-cifras"><div><span>Ingresos</span><b>' + money(t.ingReal) + "</b><small>de " + money(t.ingPlan) + " planeados</small></div>" +
      "<div><span>Gastos</span><b>" + money(t.gasReal) + "</b><small>de " + money(t.gasPlan) + " planeados</small></div>" +
      "<div><span>Saldo</span><b>" + money(t.saldo) + "</b><small>" + (tp ? dif(t.gasReal, tp.gasReal) + " en gastos frente a " + esc(monthLabel(kp).toLowerCase()) : "&nbsp;") + "</small></div>" +
      "<div><span>Ahorro</span><b>" + (t.ingReal ? prPct(t.ahorro / t.ingReal) : "0 %") + "</b><small>" + money(t.ahorro) + "</small></div>" +
      "<div><span>Salud financiera</span><b>" + p.score + " de 100</b><small>" + esc(p.label) + "</small></div></section>";
    // Lo mejor del mes (lo mismo que cuenta Tu mes contado)
    var RM = resumenPeriodo([k]), mejores = [];
    if (RM.estrella) mejores.push("Tu categoría estrella fue <b>" + esc(cap(prCatNombre(RM.estrella.id))) + "</b>: " + (RM.estrella.real < RM.estrella.plan ? "gastaste " + prPct(1 - RM.estrella.real / RM.estrella.plan) + " menos de lo planeado." : "cerraste justo en lo planeado."));
    if (RM.dentroN && RM.conPlan) mejores.push(RM.dentroN + " de " + RM.conPlan + " categorías con plan quedaron dentro de él.");
    if (RM.dias) mejores.push("Anotaste algo " + RM.dias + (RM.dias === 1 ? " día" : " días") + (RM.racha > 1 ? ", con una racha de " + RM.racha + " días seguidos." : "."));
    if (mejores.length) h += '<section class="inf-mejor"><h2>Lo mejor del mes</h2><ul>' + mejores.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></section>";
    // Gráfica: real frente a lo planeado por categoría (barra = real, marca = plan)
    var maxC = Math.max.apply(null, filaCat.map(function (id) { return Math.max(t.byCat[id].plan, t.byCat[id].real); }).concat([1]));
    var barras = filaCat.slice(0, 10).map(function (id, i) {
      var c = t.byCat[id], y = i * 26, w = c.real / maxC * 300, pl = c.plan / maxC * 300, pas = c.plan && c.real > c.plan;
      return '<text x="0" y="' + (y + 15) + '" class="ig-n">' + esc(cap(prCatNombre(id))) + '</text><rect x="150" y="' + (y + 5) + '" width="300" height="14" rx="4" class="ig-fondo"/>' +
        '<rect x="150" y="' + (y + 5) + '" width="' + Math.max(3, w).toFixed(1) + '" height="14" rx="4" fill="' + catColor(id) + '"/>' +
        (c.plan ? '<rect x="' + (150 + pl - 1).toFixed(1) + '" y="' + (y + 2) + '" width="2.5" height="20" rx="1" class="ig-plan"/>' : "") +
        '<text x="460" y="' + (y + 15) + '" class="ig-v' + (pas ? " ig-pasa" : "") + '">' + money(c.real) + "</text>";
    }).join("");
    if (filaCat.length) h += '<h2>¿En qué se fue la plata?</h2><svg class="inf-graf" viewBox="0 0 560 ' + (Math.min(10, filaCat.length) * 26 + 4) + '" role="img" aria-label="Gasto real por categoría frente a lo planeado">' + barras + '</svg><p class="inf-ley"><i class="il-real"></i>Gasto real <i class="il-plan"></i>Lo planeado</p>';
    // Ahorro de los últimos meses
    var ult = monthKeys().filter(function (x) { return x <= k; }).slice(-6);
    if (ult.length > 1) {
      var tas = ult.map(function (x) { var tt = totalsOf(state.meses[x]); return tt.ingReal > 0 ? Math.max(0, tt.ahorro / tt.ingReal) : 0; }), mx = Math.max(0.25, Math.max.apply(null, tas));
      h += '<h2>Tu ahorro, mes a mes</h2><svg class="inf-graf" viewBox="0 0 560 120" role="img" aria-label="Porcentaje de ahorro de los últimos meses">' +
        '<line x1="0" x2="560" y1="' + (96 - 0.2 / mx * 80).toFixed(1) + '" y2="' + (96 - 0.2 / mx * 80).toFixed(1) + '" class="ig-meta"/><text x="556" y="' + (92 - 0.2 / mx * 80).toFixed(1) + '" text-anchor="end" class="ig-n">Meta 20 %</text>' +
        tas.map(function (v, i) { var x = 20 + i * (520 / ult.length), w = 520 / ult.length - 24, hh = Math.max(2, v / mx * 80);
          return '<rect x="' + x.toFixed(1) + '" y="' + (96 - hh).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hh.toFixed(1) + '" rx="4" fill="' + (ult[i] === k ? "#2e5bff" : "#b9c8ff") + '"/>' +
            '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (90 - hh).toFixed(1) + '" text-anchor="middle" class="ig-v">' + prPct(v) + '</text><text x="' + (x + w / 2).toFixed(1) + '" y="114" text-anchor="middle" class="ig-n">' + esc(cap(MESES[parseKey(ult[i]).m - 1].slice(0, 3))) + "</text>"; }).join("") + "</svg>";
    }
    h += '<h2>Gastos por categoría</h2><table class="inf-tabla"><thead><tr><th>Categoría</th><th>Planeado</th><th>Real</th><th>Ejecución</th></tr></thead><tbody>' +
      filaCat.map(function (id) { var c = t.byCat[id]; return "<tr><td>" + esc(cap(prCatNombre(id))) + "</td><td>" + money(c.plan) + "</td><td>" + money(c.real) + "</td><td>" + (c.plan ? prPct(c.real / c.plan) : "–") + "</td></tr>"; }).join("") +
      "</tbody><tfoot><tr><td>Total</td><td>" + money(t.gasPlan) + "</td><td>" + money(t.gasReal) + "</td><td>" + (t.gasPlan ? prPct(t.gasReal / t.gasPlan) : "–") + "</td></tr></tfoot></table>";
    h += '<h2>Ingresos</h2><table class="inf-tabla"><thead><tr><th>Concepto</th><th>Planeado</th><th>Real</th></tr></thead><tbody>' +
      m.ingresos.map(function (r) { return "<tr><td>" + esc(r.concepto) + "</td><td>" + money(r.plan) + "</td><td>" + money(r.real) + "</td></tr>"; }).join("") + "</tbody></table>";
    if (topCom.length) h += '<h2>¿Dónde más gastaste?</h2><table class="inf-tabla"><thead><tr><th>Comercio</th><th>Total</th></tr></thead><tbody>' + topCom.map(function (c) { return "<tr><td>" + esc(c) + "</td><td>" + money(porCom[c]) + "</td></tr>"; }).join("") + "</tbody></table>";
    if (state.metas.length) h += '<h2>Metas de ahorro</h2><table class="inf-tabla"><thead><tr><th>Meta</th><th>Ahorrado</th><th>Objetivo</th><th>Avance</th></tr></thead><tbody>' + state.metas.map(function (g) { return "<tr><td>" + esc(g.nombre) + "</td><td>" + money(g.ahorrado) + "</td><td>" + money(g.objetivo) + "</td><td>" + (g.objetivo ? prPct(g.ahorrado / g.objetivo) : "–") + "</td></tr>"; }).join("") + "</tbody></table>";
    if (state.deudas.length) h += '<h2>Deudas</h2><table class="inf-tabla"><thead><tr><th>Deuda</th><th>Saldo</th><th>Tasa E. A.</th><th>Cuota</th></tr></thead><tbody>' + state.deudas.map(function (d) { return "<tr><td>" + esc(d.nombre) + "</td><td>" + money(d.saldo) + "</td><td>" + String(d.tasa).replace(".", ",") + " %</td><td>" + money(d.cuota) + "</td></tr>"; }).join("") + "</tbody></table>";
    if (p.tips.length) h += "<h2>Para el próximo mes</h2><ul>" + p.tips.map(function (x) { return "<li>" + x.txt + "</li>"; }).join("") + "</ul>";
    if (notas.length) h += "<h2>Notas</h2><ul>" + notas.map(function (x) { return "<li><b>" + esc(TIPOS_NOTA[x.tipo].n) + ":</b> " + esc(x.texto) + "</li>"; }).join("") + "</ul>";
    h += '<footer class="inf-pie">Montos en pesos colombianos. Informe generado en tu dispositivo con Finti.</footer>';
    $("informe").innerHTML = h;
  }
  function imprimirInforme() {
    $("menu-mas").hidden = true;
    armarInforme();
    var titulo = document.title;
    document.title = "Finti - " + monthLabel(state.mes);
    document.body.classList.add("imprimiendo");
    var fin = function () { document.body.classList.remove("imprimiendo"); document.title = titulo; window.removeEventListener("afterprint", fin); };
    window.addEventListener("afterprint", fin);
    metrica("informe", "dia");
    setTimeout(function () { try { window.print(); } catch (e) {} }, 60);
  }
  $("btn-informe").addEventListener("click", imprimirInforme);

  wireTable("tb-ing", "ingresos");
  wireTable("tb-gas", "gastos");
  document.body.classList.add("loading");
  renderAll();
  irA((location.hash || "").slice(1), true);
  setTimeout(function () { metrica("abrir", "dia"); try { if (APP_ANDROID.lectura) metrica("conecto", "una"); } catch (e) {} }, 1500);
  setTimeout(quizaInicioGuiado, 1200);

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden" && saveTimer && mode === "cloud") { clearTimeout(saveTimer); flush(); }
  });

  var FREE_NOTE = "Versión gratis. Montos en pesos colombianos (COP). Tus cifras se guardan solo en este navegador y en este dispositivo: nadie más las ve. Con Premium se guardan en tu cuenta de Claude.";
  function loadConfig(db) {
    db.doc("config/premium").get().then(function (snap) {
      var d = snap.exists ? snap.data() : null;
      if (d) config = { mensaje: String(d.mensaje || "").slice(0, 300), link: safeLink(d.link), precio: String(d.precio || "").slice(0, 40) };
      if (!$("dlg-premium").hidden) renderPremium();
    }, function () {});
  }
  // Configuración incluida en el archivo (para la versión que se publica fuera de Claude)
  try {
    var ec = document.getElementById("app-config");
    if (ec) { var cj = JSON.parse(ec.textContent); config = { mensaje: String(cj.mensaje || "").slice(0, 300), link: safeLink(cj.link), precio: String(cj.precio || "").slice(0, 40) }; }
  } catch (e) {}
  if (FREE) {
    try {
      refCode = localStorage.getItem("presupuesto-referencia") || "";
      if (!/^[A-Z0-9]{6}$/.test(refCode)) {
        var rr = new Uint32Array(6); crypto.getRandomValues(rr);
        refCode = Array.prototype.map.call(rr, function (x) { return CODE_ALPHABET[x % CODE_ALPHABET.length]; }).join("");
        localStorage.setItem("presupuesto-referencia", refCode);
      }
    } catch (e) { refCode = ""; }
  }
  var SIN_CUENTA = "Montos en pesos colombianos (COP). Inicia sesión en Claude para guardar tu presupuesto en tu cuenta; por ahora se guarda en este navegador.";
  if (WEB) {
    precargarLocal().then(function () {
      startLocal("Montos en pesos colombianos (COP). Tus cifras se guardan solo en este dispositivo y nadie más las ve. Haz un respaldo de vez en cuando con Exportar respaldo.");
      webInit();
    });
  } else if (FREE) {
    startLocal(FREE_NOTE);
    if (claudeApi && typeof claudeApi.use === "function") {
      Promise.all([claudeApi.use("db"), claudeApi.use("user")]).then(function (res) {
        var db = res[0], user = res[1];
        try { isOwnerFlag = !!(user && user.isOwner && user.isOwner()); } catch (e) { isOwnerFlag = false; }
        if (db) { dbApi = db; loadConfig(db); }
      }, function () {});
    }
  } else if (!claudeApi || typeof claudeApi.use !== "function") {
    startLocal("Montos en pesos colombianos (COP). Abre esta página desde Claude con tu cuenta para guardar tu presupuesto en ella; por ahora se guarda en este navegador.");
  } else {
    Promise.all([claudeApi.use("db"), claudeApi.use("user")]).then(function (res) {
      var db = res[0], user = res[1];
      if (!db || !user) { startLocal(SIN_CUENTA); return; }
      return Promise.resolve(user.id()).then(function (uid) {
        if (!uid) { startLocal(SIN_CUENTA); return; }
        dbApi = db; viewerId = uid;
        try { isOwnerFlag = !!(user.isOwner && user.isOwner()); } catch (e) { isOwnerFlag = false; }
        sha256("ref:" + uid).then(function (h) { refCode = h.slice(0, 6).toUpperCase(); if (!$("dlg-premium").hidden) renderPremium(); }, function () {});
        db.doc("config/premium").get().then(function (snap) {
          var d = snap.exists ? snap.data() : null;
          if (d) config = { mensaje: String(d.mensaje || "").slice(0, 300), link: safeLink(d.link), precio: String(d.precio || "").slice(0, 40) };
          if (!$("dlg-premium").hidden) renderPremium();
        }, function () {});
        startCloud(db, uid, user);
      });
    }).catch(function () {
      startLocal("Montos en pesos colombianos (COP). No se pudo abrir tu espacio privado ahora; tus cambios se guardan en este navegador.");
    });
  }
})();
  // ===================== Todo se siente vivo =====================
  // El lado de la lógica del sistema de movimiento (estilos en fuente/estilos/121-todo-se-siente-vivo.css):
  // las barras se llenan al arrancar, las cifras importantes saltan cuando cambian y la tarjeta flotante se aparta al
  // bajar. Nada de esto cambia los números ni los textos: solo cómo se ven al cambiar.
  (function () {
    var quieto = false;
    try { quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    // Al arrancar, las barras de avance se llenan una vez
    if (!quieto) { document.body.classList.add("vivo-arranque"); setTimeout(function () { document.body.classList.remove("vivo-arranque"); }, 1600); }

    // Las cifras que importan saltan cuando cambian (por ejemplo, al anotar un gasto)
    function saltar(el) {
      if (quieto || !el) return;
      el.classList.remove("cifra-cambia"); void el.offsetWidth; el.classList.add("cifra-cambia");
      clearTimeout(el._vivo); el._vivo = setTimeout(function () { el.classList.remove("cifra-cambia"); }, 700);
    }
    var vigiladas = ["hoy-v", "mv-resumen", "mt-resumen"];
    if (window.MutationObserver) vigiladas.forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      var antes = el.textContent;
      new MutationObserver(function () { if (el.textContent !== antes) { antes = el.textContent; saltar(el); } }).observe(el, { childList: true, characterData: true, subtree: true });
    });
    window.FinVivo = { saltar: saltar };

    // La tarjeta flotante se aparta al bajar y vuelve al subir (o al llegar arriba)
    var ultimo = window.scrollY || 0, pendiente = false;
    window.addEventListener("scroll", function () {
      if (pendiente) return; pendiente = true;
      requestAnimationFrame(function () {
        pendiente = false;
        var y = window.scrollY || 0, d = y - ultimo;
        if (Math.abs(d) > 6) { document.body.classList.toggle("va-bajando", d > 0 && y > 120); ultimo = y; }
        if (y < 40) document.body.classList.remove("va-bajando");
      });
    }, { passive: true });
  })();
