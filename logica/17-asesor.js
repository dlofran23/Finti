  // ===================== Asesor =====================
  // Tono: acompaña, no regaña. Primero lo que va bien, luego ideas concretas con su efecto en pesos.
  // Disfrutar es parte del plan. Todo se calcula en el dispositivo; no se envía a nadie.
  var FIJAS = { vivienda: 1, servicios: 1, deudas: 1, educacion: 1, ahorro: 1 };
  var DIAS_SEMANA = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];
  function analizarMes() {
    var m = cur(), t = totalsOf(m), ing = t.ingReal, gas = t.gasReal;
    var pk = prevKey(), pt = pk ? totalsOf(state.meses[pk]) : null;
    var recs = [], diag = [], logros = [];
    function rec(peso, clave, titulo, texto, accion) { recs.push({ peso: peso, clave: clave, titulo: titulo, texto: texto, accion: accion || null }); }
    function nombreCat(id) { var c = catById(id); return c ? c.name : "Otros"; }
    function grupo(id) { return (catById(id) || { group: "gus" }).group; }
    if (!ing && !gas) {
      return { vacio: true, diag: ["Todavía no hay cifras de " + monthLabel(state.mes).toLowerCase() + "."],
        recs: [{ clave: "empezar", titulo: "Empecemos por lo fácil", texto: "Registra lo que vas gastando o confírmalo en Por confirmar. Con unos días de movimientos ya te puedo mostrar cómo vas y qué te conviene." }] };
    }
    var tasa = ing ? t.ahorro / ing : 0, hoyD = new Date(), pm = parseKey(state.mes);
    var enCurso = !state.ejemplo && hoyD.getFullYear() === pm.y && hoyD.getMonth() + 1 === pm.m;   // mes a medias: no se compara como si estuviera cerrado
    // Lo que va bien, primero
    if (ing) diag.push(t.saldo >= 0 ? "Este mes entraron " + money(ing) + " y van " + money(gas) + " en gastos: te quedan " + money(t.saldo) + " libres."
      : "Este mes van " + money(gas) + " en gastos y entraron " + money(ing) + ". Con unos ajustes pequeños lo cierras tranquilo.");
    else diag.push("Llevas " + money(gas) + " en gastos. Cuando registres tus ingresos te digo cuánto te queda libre.");
    if (enCurso) { if (t.byGroup.aho > 0) logros.push("Ya apartaste " + money(t.byGroup.aho) + " para tu ahorro este mes. Págate a ti primero: así se hace."); }
    else if (ing && tasa >= 0.2) logros.push("Estás ahorrando el " + pctf(tasa) + " de lo que entra. Eso es excelente.");
    else if (ing && tasa >= 0.1) logros.push("Estás ahorrando el " + pctf(tasa) + ": vas por buen camino hacia el 20 %.");
    else if (t.ahorro > 0) logros.push("Ya apartaste " + money(t.ahorro) + " para ahorrar. Cada peso cuenta.");
    if (!enCurso && pt && pt.gasReal) { var dv = (gas - pt.gasReal) / pt.gasReal; if (dv <= -0.1) logros.push("Gastaste " + pctf(-dv) + " menos que en " + monthLabel(pk).toLowerCase() + ". Buen trabajo."); }
    var gustos = Object.keys(t.byCat).filter(function (k) { return grupo(k) === "gus" && t.byCat[k].real > 0; }).sort(function (a, b) { return t.byCat[b].real - t.byCat[a].real; });
    if (ing && t.saldo < 0) rec(100, "cerrar-mes", "Ajustemos " + money(-t.saldo) + " para cerrar el mes tranquilo",
      "Lo más fácil suele estar en " + (gustos.length ? gustos.slice(0, 2).map(function (k) { return nombreCat(k).toLowerCase(); }).join(" y ") : "los gustos") + ". No tienes que dejarlos: bajar un poco el ritmo estas semanas ya ayuda. Mejor no cubrirlo con la tarjeta de crédito, que luego cobra intereses.");
    Object.keys(t.byCat).map(function (k) { return { k: k, d: t.byCat[k].real - t.byCat[k].plan, c: t.byCat[k] }; })
      .filter(function (x) { return x.c.plan > 0 && x.d >= 20000 && x.c.real > x.c.plan * 1.1; })
      .sort(function (a, b) { return b.d - a.d; }).slice(0, 2).forEach(function (x, i) {
        rec(80 - i * 5, "cat:" + x.k, nombreCat(x.k) + " pidió más de lo planeado",
          "Llevas " + money(x.c.real) + " de " + money(x.c.plan) + ". Si es algo que valoras, súbele el plan y listo. Si prefieres mantenerlo, con unos " + money(Math.round(x.c.plan / 4.3 / 1000) * 1000) + " a la semana llegas a fin de mes sin estrés.",
          { tipo: "plan", cat: x.k, texto: "Ajustar el plan a " + money(Math.ceil(x.c.real / 10000) * 10000) });
      });
    if (ing) {
      var gus = t.byGroup.gus, nec = t.byGroup.nec;
      if (gus > ing * 0.3) rec(70, "gustos-30", "Tus gustos son el " + pctf(gus / ing) + " de lo que entra",
        "Disfrutar es parte del plan. Si quieres más espacio para tus metas, mover " + money(gus - ing * 0.3) + " al mes de " + (gustos.length ? nombreCat(gustos[0]).toLowerCase() : "los gustos") + " te lo da, sin dejar de darte tus gustos.");
      if (nec > ing * 0.6) rec(55, "fijos", "Tus gastos fijos ocupan el " + pctf(nec / ing),
        "Es lo que más espacio te quita, y se arregla una sola vez: revisar el plan del celular, el internet o los seguros puede liberar plata todos los meses sin cambiar tu día a día.");
      if (tasa < 0.1 && t.saldo >= 0) rec(65, "pagate-primero", "Págate a ti primero: " + money(ing * 0.1) + " al mes",
        "Apenas llegue tu ingreso, pasa ese 10 % a una cuenta aparte. Lo que no ves en la cuenta del día a día, no lo extrañas.");
      else if (tasa < 0.2 && t.saldo > 0) rec(35, "ahorro-20", "Un paso más: ahorrar el 20 %",
        "Te faltan " + money(Math.max(0, ing * 0.2 - t.ahorro)) + " al mes. Subiendo un 2 % cada mes llegas sin sentirlo.");
      if (pt && pt.ingReal && ing < pt.ingReal * 0.85) rec(45, "ingreso-bajo", "Este mes entró un poco menos",
        "Pasa. Ajusta el plan a lo que llegó y el resto del mes se siente más liviano.");
    }
    var deudas = state.deudas.filter(function (d) { return d.saldo > 0; });
    if (deudas.length) {
      var cara = deudas.slice().sort(function (a, b) { return b.tasa - a.tasa; })[0];
      var interes = cara.saldo * (Math.pow(1 + (cara.tasa || 0) / 100, 1 / 12) - 1);
      if (cara.tasa >= 20) rec(75, "deuda:" + cara.nombre, "Tu deuda más cara: " + cara.nombre,
        "Tiene " + cara.tasa + " % E. A. y cuesta unos " + money(Math.round(interes / 1000) * 1000) + " al mes en intereses. Cada abono extra ahí rinde más que en cualquier otra, sin descuidar las cuotas de las demás.");
      var cuotas = deudas.reduce(function (a, d) { return a + (d.cuota || 0); }, 0);
      if (ing && cuotas > ing * 0.3) rec(85, "cuotas", "Tus cuotas ocupan el " + pctf(cuotas / ing) + " de lo que entra",
        "Hasta el 30 % es cómodo. Mientras bajas de ahí, mejor no sumar deudas nuevas; también puedes pedirle al banco mejor tasa o más plazo en la más cara.");
    }
    var hoy = parseKey(state.mes);
    state.metas.forEach(function (g) {
      var falta = g.objetivo - g.ahorrado; if (falta <= 0) return;
      if (!g.fecha) { rec(20, "meta-fecha:" + g.nombre, "Ponle fecha a " + g.nombre, "Con una fecha te digo cuánto apartar cada mes y qué tan probable es que llegues."); return; }
      var f = parseKey(g.fecha), meses = Math.max(1, (f.y - hoy.y) * 12 + (f.m - hoy.m)), porMes = falta / meses;
      if (ing && t.saldo >= 0 && porMes > Math.max(t.saldo, 0) + t.byGroup.aho) rec(50, "meta:" + g.nombre, "Para llegar a " + g.nombre + " a tiempo: " + money(porMes) + " al mes",
        "Con lo que te sobra hoy no alcanza todavía. Puedes mover la fecha unos meses o darle un empujón con lo que liberes en otros gastos. Las dos opciones son válidas.");
      else rec(25, "meta:" + g.nombre, g.nombre + ": aparta " + money(porMes) + " al mes", "Así llegas a " + money(g.objetivo) + " en " + monthLabel(g.fecha).toLowerCase() + ". Si lo programas como pago automático, te olvidas.");
    });
    var tieneFondo = state.metas.some(function (g) { return /emergencia|imprevist|colch/i.test(g.nombre); });
    if (!tieneFondo && t.byGroup.nec) rec(40, "fondo", "Arma tu colchón para imprevistos", "Con unos " + money(t.byGroup.nec * 3) + " (tres meses de gastos necesarios) un daño o una cita médica no te descuadra el mes.");
    var ahora = new Date(), en7 = 0, nombres = [];
    (state.porPagar || []).forEach(function (b) {
      if (!b.monto || b.f !== "mensual" || !b.dia) return;
      var d = new Date(ahora.getFullYear(), ahora.getMonth(), b.dia); if (d < new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())) d.setMonth(d.getMonth() + 1);
      if ((d - ahora) / 864e5 <= 7) { en7 += b.monto; nombres.push(b.nombre); }
    });
    if (en7) rec(60, "pagos-semana", "Esta semana vienen " + money(en7) + " en pagos", "De " + nombres.slice(0, 3).join(", ") + ". Si los dejas separados desde ya, pagas a tiempo y sin intereses de mora.");
    state.metas.forEach(function (g) { if (g.objetivo > 0 && g.ahorrado >= g.objetivo) logros.push("Completaste tu meta " + g.nombre + ". Date un gusto, te lo ganaste."); });
    var cerca = state.metas.filter(function (g) { return g.objetivo > 0 && g.ahorrado < g.objetivo && g.ahorrado / g.objetivo >= 0.75; })[0];
    if (cerca) logros.push("Ya tienes el " + pctf(cerca.ahorrado / cerca.objetivo) + " de " + cerca.nombre + ". Falta poco.");
    // Tu canasta: dónde te sale más barato lo que repites y las compras pequeñas que se acumulan
    var canasta = canResumen(90).filter(function (o) { return o.lugares.length > 1 && o.lugares[0].pu < o.lugares[o.lugares.length - 1].pu * 0.9; }).sort(function (a, b) { return b.total - a.total; })[0];
    if (canasta) rec(55, "canasta-lugar:" + canasta.k, canNombre(canasta.n) + " te sale más barato en " + canasta.lugares[0].lugar,
      "Te ha salido a " + canPrecio(canasta.lugares[0].pu) + canPorUnidad(canasta.ult) + " allá y a " + canPrecio(canasta.lugares[canasta.lugares.length - 1].pu) + " en " + canasta.lugares[canasta.lugares.length - 1].lugar + ". Si te queda de camino, ahí rinde más tu plata.");
    var chicas = state.movs.filter(function (x) { return x.t === "g" && x.cat === "alimentacion" && x.f && x.f.slice(0, 7) === state.mes && x.m < 15000; });
    if (chicas.length >= 8) rec(28, "tienda-seguido", "Este mes vas " + chicas.length + " veces a comprar cosas pequeñas de comida",
      "Suman " + money(chicas.reduce(function (a, x) { return a + x.m; }, 0)) + ". Una compra grande con lista a la semana suele salir más barata que muchas sueltas.");
    if (!recs.length) rec(10, "bien", "Vas muy bien", "Tus cifras están en orden. Si al final del mes te sobra, llévalo a tu meta más cercana o abónalo a tu deuda más cara.");
    // Aprende de la persona: lo que marcó como "no es para mí" no vuelve a salir; lo que le sirvió sube.
    recs = recs.filter(function (r) { return state.asesor.no.indexOf(r.clave) < 0; })
      .map(function (r) { if (state.asesor.si.indexOf(r.clave) > -1) r.peso += 15; return r; });
    recs.sort(function (a, b) { return b.peso - a.peso; });
    return { diag: diag, logros: logros.slice(0, 3), recs: recs.slice(0, 6) };
  }

  // Patrones aprendidos del historial de movimientos (últimos 120 días) y de los meses guardados.
  function aprenderPatrones() {
    var hoy = d0(), lim = new Date(hoy); lim.setDate(lim.getDate() - 120);
    var movs = state.movs.filter(function (x) { var d = parseD(x.f); return d && d >= lim && d <= hoy; });
    var gastos = movs.filter(function (x) { return x.t === "g"; }), items = [];
    var dias = {}; gastos.forEach(function (x) { dias[x.f] = 1; });
    var nDias = Object.keys(dias).length, primero = gastos.length ? parseD(gastos.map(function (x) { return x.f; }).sort()[0]) : hoy;
    var span = Math.max(1, Math.round((hoy - primero) / 864e5) + 1), suficiente = gastos.length >= 12 && span >= 14;
    function grupo(id) { return (catById(id) || { group: "gus" }).group; }
    var variables = gastos.filter(function (x) { return !FIJAS[x.cat] && grupo(x.cat) !== "aho"; });
    if (suficiente) {
      // 1. El día de la semana en que más se gasta
      var porDia = [0, 0, 0, 0, 0, 0, 0], cuenta = [0, 0, 0, 0, 0, 0, 0];
      for (var d = new Date(primero); d <= hoy; d.setDate(d.getDate() + 1)) cuenta[d.getDay()]++;
      variables.forEach(function (x) { porDia[parseD(x.f).getDay()] += x.m; });
      var prom = porDia.map(function (v, i) { return cuenta[i] ? v / cuenta[i] : 0; }), media = prom.reduce(function (a, b) { return a + b; }, 0) / 7;
      var top = prom.indexOf(Math.max.apply(null, prom));
      if (media > 0 && prom[top] >= media * 1.6) items.push({ ic: "i-cal", clave: "dia", titulo: "Los " + DIAS_SEMANA[top] + " son tu día de gasto",
        texto: "En promedio gastas " + money(prom[top]) + " ese día, " + (prom[top] / media).toFixed(1).replace(".", ",") + " veces un día normal. Si lo planeas desde el lunes, lo disfrutas igual y sin sorpresas." });
      // 2. La hora (si se conoce)
      var conHora = variables.filter(function (x) { return x.h >= 0; });
      if (conHora.length >= 10) {
        var noche = conHora.filter(function (x) { return x.h >= 20 || x.h < 5; }), sn = noche.reduce(function (a, x) { return a + x.m; }, 0), st = conHora.reduce(function (a, x) { return a + x.m; }, 0);
        if (st && sn / st >= 0.35) items.push({ ic: "i-bell", clave: "noche", titulo: "Muchas compras pasan de noche",
          texto: "El " + pctf(sn / st) + " de tus gastos variables es después de las 8 p. m. Las compras nocturnas suelen ser más impulsivas: dejar el carrito para mañana es un truco que funciona." });
      }
      // 3. Gastos pequeños de los últimos 30 días
      var hace30 = new Date(hoy); hace30.setDate(hace30.getDate() - 30);
      var peq = variables.filter(function (x) { return x.m < 20000 && parseD(x.f) >= hace30; }), sp = peq.reduce(function (a, x) { return a + x.m; }, 0);
      if (peq.length >= 8) items.push({ ic: "i-note", clave: "hormiga", titulo: peq.length + " compras pequeñas suman " + money(sp),
        texto: "Son compras de menos de " + money(20000) + " en los últimos 30 días. No tiene nada de malo; solo que lo tengas presente, porque juntas pesan tanto como un gasto grande." });
    }
    // 4. Después de recibir el pago (si hay ingresos registrados)
    var ingresos = movs.filter(function (x) { return x.t === "i"; });
    if (suficiente && ingresos.length >= 2) {
      var tras = 0, nTras = 0, resto = 0, nResto = 0, diasPago = {};
      ingresos.forEach(function (x) { diasPago[x.f] = 1; });
      var pagos = Object.keys(diasPago).map(parseD);
      for (var e = new Date(primero); e <= hoy; e.setDate(e.getDate() + 1)) {
        var k = hoyStr(e), g = variables.filter(function (x) { return x.f === k; }).reduce(function (a, x) { return a + x.m; }, 0);
        var cerca = pagos.some(function (p) { var dd = (e - p) / 864e5; return dd >= 0 && dd < 4; });
        if (cerca) { tras += g; nTras++; } else { resto += g; nResto++; }
      }
      if (nTras && nResto && resto && (tras / nTras) >= (resto / nResto) * 1.5) items.push({ ic: "i-wallet", clave: "pago", titulo: "Los días de pago gastas más",
        texto: "En los 3 días después de recibir plata gastas " + ((tras / nTras) / (resto / nResto)).toFixed(1).replace(".", ",") + " veces lo de un día normal. Es muy común. Separar el ahorro y los pagos ese mismo día protege lo importante." });
    }
    // 5. Pagos que se repiten cada mes (suscripciones o recurrentes)
    var grupos = {};
    gastos.forEach(function (x) { var n = normal(x.com || x.c); if (!n) return; (grupos[n] = grupos[n] || []).push(x); });
    var recurrentes = [];
    Object.keys(grupos).forEach(function (n) {
      var xs = grupos[n], meses = {};
      xs.forEach(function (x) { (meses[x.f.slice(0, 7)] = meses[x.f.slice(0, 7)] || []).push(x.m); });
      var ms = Object.keys(meses).sort(); if (ms.length < 2 || ms.some(function (k) { return meses[k].length > 1; })) return;
      var vals = ms.map(function (k) { return meses[k][0]; }), medio = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      if (vals.every(function (v) { return Math.abs(v - medio) <= medio * 0.08; })) recurrentes.push({ nombre: xs[xs.length - 1].com || xs[xs.length - 1].c, monto: medio });
    });
    if (recurrentes.length) {
      var anual = recurrentes.reduce(function (a, r) { return a + r.monto; }, 0) * 12;
      items.push({ ic: "i-sync", clave: "recurrentes", titulo: "Encontré " + plural(recurrentes.length, "pago") + " que se repite" + (recurrentes.length > 1 ? "n" : "") + " cada mes",
        texto: recurrentes.slice(0, 4).map(function (r) { return r.nombre + " (" + money(r.monto) + ")"; }).join(", ") + ". Al año son " + money(anual) + (recurrentes.length > 1 ? ". Si alguno ya no lo usas tanto, ahí hay plata fácil." : ". Si ya no lo usas tanto, ahí hay plata fácil.") });
    }
    // 6. Lo que más disfruta
    var porCat = {}; variables.filter(function (x) { return grupo(x.cat) === "gus"; }).forEach(function (x) { porCat[x.cat] = (porCat[x.cat] || 0) + x.m; });
    var tv = variables.reduce(function (a, x) { return a + x.m; }, 0), fav = Object.keys(porCat).sort(function (a, b) { return porCat[b] - porCat[a]; })[0];
    if (suficiente && fav && tv && porCat[fav] / tv >= 0.15) items.push({ ic: "i-star", clave: "favorito", titulo: "Lo que más disfrutas: " + (catById(fav) || { name: "Otros" }).name.toLowerCase(),
      texto: "Es el " + pctf(porCat[fav] / tv) + " de tus gastos variables. Está bien gastar en lo que te hace feliz; la idea es que esté en tu plan para disfrutarlo sin culpa." });
    // 7. Categorías cuyo plan siempre se queda corto (meses guardados; no necesita historial de movimientos)
    var ks = monthKeys().filter(function (k) { return k <= state.mes; }).slice(-3);
    if (ks.length >= 2) {
      var cuentas = {};
      ks.forEach(function (k) { var b = totalsOf(state.meses[k]).byCat; Object.keys(b).forEach(function (c) { if (b[c].plan > 0 && b[c].real > b[c].plan * 1.1) { cuentas[c] = cuentas[c] || []; cuentas[c].push(b[c].real); } }); });
      Object.keys(cuentas).filter(function (c) { return cuentas[c].length >= 2 && !FIJAS[c]; }).slice(0, 2).forEach(function (c) {
        var vals = cuentas[c].slice().sort(function (a, b) { return a - b; }), med = vals[Math.floor(vals.length / 2)];
        items.push({ ic: "i-target", clave: "plan:" + c, titulo: "Tu plan de " + (catById(c) || { name: "Otros" }).name.toLowerCase() + " suele quedarse corto",
          texto: "En " + vals.length + " de tus últimos " + ks.length + " meses gastaste más de lo planeado (alrededor de " + money(med) + "). Un plan realista es más fácil de cumplir y se siente mejor.",
          accion: { tipo: "plan", cat: c, texto: "Ajustar el plan a " + money(Math.ceil(med / 10000) * 10000) } });
      });
    }
    var r = simRacha();
    if (r.actual >= 3) items.push({ ic: "i-flame", clave: "racha", titulo: "Llevas " + plural(r.actual, "día") + " seguidos registrando", texto: "Esa constancia es lo que más cambia las finanzas, más que cualquier recorte." });
    items = items.filter(function (i) { return state.asesor.no.indexOf(i.clave) < 0; });
    return { items: items, suficiente: suficiente, movimientos: gastos.length, faltan: Math.max(0, 12 - gastos.length), dias: span };
  }

  // Plata para disfrutar sin culpa: lo que se puede gastar en gustos de aquí a fin de mes y aun así cerrar en orden
  // (el cierre más probable ya descuenta lo necesario, los pagos y el ahorro planeado).
  function paraDisfrutar(cierre) {
    var quedan = Math.max(1, cierre.dias - cierre.dia + 1), libre = cierre.p50 + (cierre.gusEst - cierre.gusReal);
    return { libre: libre, quedan: quedan, diario: libre > 0 ? libre / quedan : 0, semana: libre > 0 ? Math.min(libre, libre / quedan * 7) : 0 };
  }

