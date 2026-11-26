  // ===================== ¿Dónde compro? =====================
  function abrirDonde(texto) {
    $("menu-mas").hidden = true;
    var frec = canResumen(90).sort(function (a, b) { return b.veces - a.veces; }).slice(0, 6);
    $("dc-chips").innerHTML = frec.map(function (o) { return '<button type="button" class="chip-btn" data-p="' + esc(canNombre(o.n)) + '">' + esc(canNombre(o.n)) + "</button>"; }).join("");
    if (texto) $("dc-lista").value = texto;
    openDlg("dlg-donde", "#dc-lista");
    $("dc-res").innerHTML = SIPSA.d ? "" : '<p class="dc-vacio">Trayendo los precios del DANE…</p>';
    sipsaCargar().then(function () { pintarCiudades(); pintarDonde(); });
    pintarCiudades(); if (SIPSA.d) pintarDonde();
  }
  function pintarCiudades() {
    var sel = $("dc-ciudad"), cs = {}; if (!SIPSA.d) return;
    SIPSA.d.productos.forEach(function (p) { Object.keys(p.c || {}).forEach(function (c) { cs[c] = (cs[c] || 0) + 1; }); });
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
      if (!o && !p) h += '<p class="dc-vacio">' + (SIPSA.d ? "El DANE no publica este producto (solo alimentos frescos y de la canasta). Cuando me cuentes una compra con su precio, aquí verás dónde te sale más barato." : "No pude traer los precios del DANE; revisa tu conexión. Cuando me cuentes una compra con su precio, aquí verás dónde te sale más barato.") + "</p>";
      return h + "</article>";
    }).join("");
  }
  function pintarNota() {
    $("dc-nota").hidden = !SIPSA.d;
    if (SIPSA.d) $("dc-nota").textContent = "Los precios de referencia son del DANE (SIPSA), " + sipsaFecha() + ": mayoristas y por kilo. En la tienda suelen ser más altos; sirven para saber si algo está barato o caro. Para traerlos, Finti no envía nada tuyo.";
  }
  // Sin nada escrito: todos los productos del DANE con su precio, si suben o bajan y dónde están más baratos.
  function pintarHoy() {
    if (!SIPSA.d) return "";
    var ciudad = $("dc-ciudad").value, f = sipsaFecha();
    var l = SIPSA.d.productos.filter(function (p) { return !ciudad || (p.c && p.c[ciudad]); });
    if (!l.length) return '<p class="dc-vacio">El DANE no trae precios de ' + esc(ciudad) + " para " + f + ". Elige otra ciudad o todo el país.</p>";
    var tit = sipsaDiario() ? "Así amanecieron los precios " + f : "Así estaban los precios " + f;
    return '<article class="dc-item dc-hoy"><h3>' + esc(tit) + "</h3><p>" + (ciudad ? "En " + esc(ciudad) : "En el país") + ", por kilo en la central mayorista. Toca un producto para ver más.</p><ul>" +
      l.map(function (p) {
        var e = ciudad && p.c[ciudad], t = sipsaTendencia(sipsaVar(p, ciudad));
        return '<li><button type="button" class="dc-prod" data-p="' + esc(p.n) + '"><b>' + esc(p.n) + "</b><span class=\"dc-precio\">" + canPrecio(e ? e[0] : p.g) + "</span>" +
          '<span class="dc-tend ' + t.c + '">' + (t.c ? (t.c === "sube" ? "Sube " : "Baja ") + t.t.replace(/^(subió|bajó) /, "") : "Estable") + "</span>" +
          "<small>Mejor precio: " + esc(p.b[0]) + " (" + canPrecio(p.b[1]) + ")</small></button></li>";
      }).join("") + "</ul></article>";
  }
  $("dc-form").addEventListener("submit", function (e) { e.preventDefault(); sipsaCargar().then(pintarDonde); pintarDonde(); });
  $("dc-ciudad").addEventListener("change", function () { state.prefs.ciudad = $("dc-ciudad").value; changed(); pintarDonde(); });
  $("dc-res").addEventListener("click", function (e) {
    var b = e.target.closest(".dc-prod"); if (!b) return;
    $("dc-lista").value = b.dataset.p; pintarDonde(); $("dc-lista").focus();
  });
  $("dc-chips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-p]"); if (!b) return;
    var v = $("dc-lista").value.trim(); $("dc-lista").value = v ? v + ", " + b.dataset.p : b.dataset.p; pintarDonde();
  });
  $("btn-donde-menu").addEventListener("click", function () { abrirDonde(); });

