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
    $("ch-voz").hidden = !chVozPosible(); $("ch-cam").hidden = !ocrPosible();
    chMsg("app", "<p>¿En qué gastaste y cuánto fue? Escríbemelo" + ($("ch-voz").hidden ? "" : " o dímelo con el micrófono") + ", por ejemplo: <b>$ 18.000 en almuerzo</b>. También puedes contarme todo tu mercado, producto por producto." +
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
      if (cambio) return chCorregir(r, n);
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
    CH.items = items.map(function (r) {
      var x = chItem(r);
      if (x.t === "g" && !x.cat && x.c) { var f = chFila("g", "", x.c); if (f) x.cat = f.cat; }
      return x;
    });
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

  function chSiguiente() {
    for (var i = 0; i < CH.items.length; i++) {
      var x = CH.items[i]; CH.idx = i;
      var sobre = CH.items.length > 1 && x.c ? " " + esc(x.c.toLowerCase()) : "";
      if (!x.m) {
        CH.paso = "monto";
        chMsg("app", x.t === "i" ? "¿Cuánto te entró?" : x.t === "p" ? "¿Cuánto le prestaste?" : x.t === "d" ? "¿Cuánto te debe?" : "¿Cuánto fue" + (x.c ? " " + esc(x.c.toLowerCase()) : "") + "?");
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
    if (faltan.length) {
      faltan.forEach(function (x) { var o = chCuentasPara(x); if (o.length === 1) x.cuenta = o[0].id; });
      faltan = faltan.filter(function (x) { return !x.cuenta && chCuentasPara(x).length > 1; });
      if (faltan.length) {
        var x1 = faltan[0], todos = faltan.length > 1, usual = chCuentaUsual(x1), ops = chCuentasPara(x1).slice().sort(function (a, b) { return (b.id === usual) - (a.id === usual); });
        CH.paso = "cuenta"; CH.idx = CH.items.indexOf(x1);
        // Repite lo que entendió (sirve sobre todo si lo dijo por voz) y pregunta
        var en1 = x1.c ? " en " + esc(x1.c.toLowerCase()) : x1.cat ? " en " + esc(((catById(x1.cat) || {}).name || "").toLowerCase()) : "";
        var tot = faltan.reduce(function (a, x) { return a + (x.m || 0); }, 0);
        var dice = todos ? "Son " + faltan.length + " gastos por <b>" + money(tot) + "</b>. ¿Con qué pagaste todo esto?"
          : x1.t === "i" ? "Anoto <b>" + money(x1.m) + "</b> que te entraron. ¿A dónde te llegaron?"
          : x1.t === "p" ? "Anoto el préstamo de <b>" + money(x1.m) + "</b>" + (x1.quien ? " a " + esc(x1.quien) : "") + ". ¿De dónde salió la plata?"
          : "Anoto <b>" + money(x1.m) + "</b>" + en1 + (x1.comp ? " (tu parte es " + money(Math.round(x1.m / x1.comp.partes)) + ")" : "") + ". " + (x1.llave ? "¿Desde qué cuenta salió la llave?" : "¿Con qué lo pagaste?");
        chMsg("app", "<p>" + dice + "</p>");
        return chChips(ops.map(function (c) { return { t: c.nombre, v: (todos ? "cuentas:" : "cuenta:") + c.id, col: marcaCuenta(c).c }; }).concat(CH.ultTexto ? [{ t: "No me entendiste", v: "noent" }] : [], [{ t: "Cancelar", v: "no" }]));
      }
    }
    CH.paso = "confirmar";
    var html = CH.items.map(chTarjeta).join(""), uno = CH.items.length === 1, x0 = CH.items[0];
    var titulo = !uno ? "Anoto estos " + CH.items.length + ":" : x0.t === "i" ? "Anoto este ingreso:" : x0.t === "p" ? "Anoto este préstamo:" : x0.t === "d" ? "Anoto lo que te deben:" : "Anoto este gasto:";
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
    var saldos = Object.keys(cuentasTocadas).map(function (id) { var a = cuentasTocadas[id]; return esc(a.nombre) + " queda en " + money(a.saldo); });
    if (saldos.length) extra += " " + saldos.join("; ") + ".";
    var efNeg = Object.keys(cuentasTocadas).some(function (id) { var a = cuentasTocadas[id]; return a.tipo === "efectivo" && a.saldo < 0; });
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
    var sig = [{ t: "Anotar otro", v: "otro" }, { t: "Deshacer", v: "deshacer" }];
    if (CH.cuadre && chCuadreRevisar()) return;
    if (efNeg) sig.splice(1, 0, { t: "Cuadrar mi billetera", v: "cuadre" });
    if (WEB && avDev && !avDev.efectivo && !chRecordarOfrecido) { chRecordarOfrecido = true; sig.push({ t: "Recordarme cada noche", v: "recordar" }); }
    sig.push({ t: "Cerrar", v: "cerrar" });
    chChips(sig);
  }
  var chRecordarOfrecido = false;
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
      acc.saldo = q.tengo; CH.cuadre = null; changed(); renderCuentas();
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
    if (v === "otracat" && it) { it.cat = ""; it.aprender = true; return chSiguiente(); }
    if (v === "otracuenta") { chMsg("app", "¿Con qué lo pagaste?"); return chChips(state.cuentas.map(function (c) { return { t: c.nombre, v: "cuenta:" + c.id }; })); }
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





