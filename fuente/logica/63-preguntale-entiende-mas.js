  // ===================== Pregúntale entiende más (28 de noviembre de 2026) =====================
  // Preguntas que respondía mal: "¿qué es Premium?", "¿estoy mal?", "¿debo sacar un crédito?" (respondía con las
  // deudas), "ayúdame a ahorrar" (mostraba la lista de ejemplos) y "quiero ahorrar 500 mil para diciembre" (no armaba
  // el plan). Además, "¿qué suscripciones tengo?" cuenta también las que anotaste en Tus suscripciones.
  PR_R.premium = function () {
    PR.ctx = null;
    return { html: "<p>Premium es un pago único, sin mensualidades: desbloquea todo tu historial, todas las metas que quieras, el plan para salir de deudas, el asesor que simula cómo cierras el mes, categorías propias, Excel completo y los temas de color.</p><p>Toca la estrella de <b>Premium</b> arriba: ahí ves el precio y, si te regalaron un código, dónde activarlo.</p>", guia: "premium", chips: ["¿Qué puedo preguntarte?"] };
  };
  // "Quiero ahorrar $ 500.000 para diciembre", "necesito juntar 2 millones en 6 meses"
  PR_R.planAhorro = function (q) {
    var t = q.texto, monto = q.monto, hoy = new Date(), meses = 0, cuando = "";
    if (!(monto > 0)) { PR.espera = { tipo: "monto", intent: "planAhorro" }; return { html: "<p>¡Buena idea! ¿Cuánto quieres reunir?</p>", chips: [] }; }
    var mm = /en (\d{1,2}|un|una|dos|tres|cuatro|seis|doce) (mes|meses|ano|anos)\b/.exec(t), NUM = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, seis: 6, doce: 12 };
    if (mm) { var n = NUM[mm[1]] || +mm[1]; meses = /ano/.test(mm[2]) ? n * 12 : n; cuando = "en " + plural(meses, "mes").replace("1 mes", "un mes").replace(/(\d+) mess/, "$1 meses"); }
    else {
      var mi = MESES.findIndex(function (m) { return new RegExp("\\b" + m + "\\b").test(t); });
      if (mi < 0 && /navidad|fin de ano|final del ano|diciembre/.test(t)) mi = 11;
      if (mi > -1) { meses = (mi - hoy.getMonth() + 12) % 12; if (meses === 0) meses = /proximo|siguiente/.test(t) ? 12 : 1; cuando = "en " + MESES[mi]; }
    }
    if (!meses) { meses = 6; cuando = "en 6 meses"; }
    var cada = Math.ceil(monto / meses / 1000) * 1000, t0 = totalsOf(cur()), entra = t0.ingReal > 0 ? Math.max(t0.ingReal, t0.ingPlan) : t0.ingPlan;
    var h = "<p>Para tener <b>" + money(monto) + "</b> " + cuando + " aparta <b>" + money(cada) + "</b>" + (meses > 1 ? " al mes durante " + meses + " meses" : " este mes") + ".</p>";
    if (entra > 0) {
      var pc = cada / entra;
      h += "<p>Es el " + pctf(pc) + " de lo que te entra. " + (pc <= 0.1 ? "Muy alcanzable: apártalo apenas te paguen y casi no lo sientes." : pc <= 0.2 ? "Se puede: apártalo apenas te paguen, antes de gastar." : "Es un esfuerzo grande. Si le das un poco más de tiempo, la cuota baja y es más fácil cumplirla.") + "</p>";
    }
    h += "<p>Créala como meta en <b>Metas</b> y te voy mostrando cuánto llevas.</p>";
    return { html: h, chips: ["¿Cómo creo una meta?", "¿Cuánto debería ahorrar al mes?"] };
  };
  // "¿Qué suscripciones tengo?": también las de Tus suscripciones
  var _prSubs0 = PR_R.suscripciones;
  PR_R.suscripciones = function (q) {
    var l = state.porPagar.filter(esSub);
    if (!l.length) return _prSubs0(q);
    var mes = l.reduce(function (a, b) { return a + (b.f === "anual" ? b.monto / 12 : b.monto); }, 0);
    return { html: "<p>Tienes " + plural(l.length, "suscripción").replace("suscripcións", "suscripciones") + " anotada" + (l.length > 1 ? "s" : "") + ": unos <b>" + money(mes) + "</b> al mes (" + money(mes * 12) + " al año).</p><ul class=\"pr-lista\">" +
      l.map(function (b) { var p = subsProximo(b); return "<li>" + esc(b.nombre) + ": " + money(b.monto) + (b.f === "anual" ? " al año" : " al mes") + (p ? ", se cobra el " + fechaLarga(p) : "") + "</li>"; }).join("") +
      "</ul><p>¿Hay alguna que ya no uses? Cancelarla es plata que te queda todos los meses.</p>", chips: ["¿Hay algo raro en mis gastos?", "¿Qué tengo que pagar?"] };
  };
  PR_INT.splice(1, 0,
    ["premium", /(que es|que trae|que incluye|que tiene|cuanto (vale|cuesta)|para que sirve|como (compro|activo|consigo|tengo)|vale la pena) (el |la )?premium|^premium$/],
    ["consejo", /(?:debo|deberia|me conviene|conviene|vale la pena|es buena idea|puedo|pido|pedir|saco|sacar|tomar|tomo|meterme en|hacer) (?:un |el |otro |una )?(?:credito|prestamo|tarjeta de credito)\b|endeudarme|me endeudo/],
    ["planAhorro", /(?:quiero|necesito|me gustaria|voy a|como hago para|como puedo|ayudame a) (?:ahorrar|juntar|reunir|tener|completar) (?:unos |\$ ?)?\d|(?:quiero|necesito) (?:ahorrar|juntar|reunir) .*\b(para|en) (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|navidad|fin de ano|\d+ meses)/],
    ["consejo", /ayudame a (ahorrar|gastar menos|organizar)|como (ahorro|puedo ahorrar|hago para ahorrar) (mas|plata)|quiero ahorrar mas|ahorrar mas\b|no me alcanza (la plata|el sueldo|nada)|no me rinde/],
    ["estado", /^(estoy|ando|voy|vamos|me va|como ando) (mal|bien|regular|como)\b|^estoy (bien|mal) (de|con) (plata|la plata|mis finanzas)/]
  );
  PR_EJ.push("¿Qué es Premium?", "Quiero ahorrar $ 500.000 para diciembre");
