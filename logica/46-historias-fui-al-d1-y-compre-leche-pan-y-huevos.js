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

