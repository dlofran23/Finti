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
