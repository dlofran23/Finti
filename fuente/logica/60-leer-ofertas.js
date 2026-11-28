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
