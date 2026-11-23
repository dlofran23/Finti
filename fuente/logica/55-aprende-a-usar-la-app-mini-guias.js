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

