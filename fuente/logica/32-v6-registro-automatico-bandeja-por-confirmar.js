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

