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

