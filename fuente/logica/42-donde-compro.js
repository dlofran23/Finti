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

