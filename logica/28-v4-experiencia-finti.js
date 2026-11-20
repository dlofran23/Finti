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
