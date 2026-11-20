  // ===================== Importar el extracto del banco (Excel o CSV) =====================
  // La persona descarga sus movimientos en la app o la página de su banco y los sube aquí. Todo se lee en este
  // dispositivo: el archivo no sale de él. Se buscan las columnas de fecha, descripción y valor (o débito y
  // crédito), se saltan los que ya estaban registrados y los traslados entre cuentas propias, y cada movimiento
  // va a su mes y su categoría. Así el asesor tiene historial desde el primer día.
  var extractoLeido = null;
  function nrm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function leerCSV(txt) {
    txt = String(txt || "").replace(/^﻿/, "");
    var muestra = txt.split(/\r?\n/).slice(0, 15).join("\n"), cand = [";", ",", "\t", "|"], sep = ";", mejor = -1;
    cand.forEach(function (c) { var n = muestra.split(c).length; if (n > mejor) { mejor = n; sep = c; } });
    var filas = [], fila = [], campo = "", comillas = false;
    for (var i = 0; i < txt.length; i++) {
      var ch = txt[i];
      if (comillas) { if (ch === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else comillas = false; } else campo += ch; continue; }
      if (ch === '"') comillas = true;
      else if (ch === sep) { fila.push(campo); campo = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && txt[i + 1] === "\n") i++; fila.push(campo); filas.push(fila); fila = []; campo = ""; }
      else campo += ch;
    }
    if (campo || fila.length) { fila.push(campo); filas.push(fila); }
    return filas;
  }
  function leerXLSX(buf) {
    return loadJSZip().then(function (JSZip) { return JSZip.loadAsync(buf); }).then(function (zip) {
      var hoja = Object.keys(zip.files).filter(function (n) { return /^xl\/worksheets\/sheet\d*\.xml$/.test(n); }).sort()[0];
      if (!hoja) throw new Error("sin-hoja");
      var ss = zip.file("xl/sharedStrings.xml");
      return Promise.all([zip.file(hoja).async("string"), ss ? ss.async("string") : ""]);
    }).then(function (r) {
      var dp = new DOMParser(), comp = [];
      if (r[1]) [].forEach.call(dp.parseFromString(r[1], "application/xml").getElementsByTagName("si"), function (si) {
        comp.push([].map.call(si.getElementsByTagName("t"), function (t) { return t.textContent; }).join(""));
      });
      var filas = [];
      [].forEach.call(dp.parseFromString(r[0], "application/xml").getElementsByTagName("row"), function (row) {
        var f = [];
        [].forEach.call(row.getElementsByTagName("c"), function (c) {
          var ref = c.getAttribute("r") || "", col = 0, m = /^([A-Z]+)/.exec(ref);
          if (m) for (var k = 0; k < m[1].length; k++) col = col * 26 + (m[1].charCodeAt(k) - 64);
          var t = c.getAttribute("t"), v = c.getElementsByTagName("v")[0], is = c.getElementsByTagName("is")[0];
          var val = t === "s" ? comp[+(v && v.textContent)] : t === "inlineStr" ? (is ? is.textContent : "") : v ? v.textContent : "";
          if (t !== "s" && t !== "inlineStr" && t !== "str" && val !== "" && !isNaN(+val)) val = { n: +val };
          f[(col || f.length + 1) - 1] = val;
        });
        filas.push(f);
      });
      return filas;
    });
  }
  // "1.234.567,89" · "-45.900" · "1,234,567.89" · "(45.900)" · "$ 45.900" · número de Excel
  function montoExtracto(v) {
    if (v && typeof v === "object") return Math.round(v.n);
    var s = String(v == null ? "" : v).trim();
    if (!s) return NaN;
    var neg = /^\(.*\)$/.test(s) || /^\$?\s*-|-\s*$/.test(s);
    s = s.replace(/[^\d.,]/g, "");
    if (!/\d/.test(s)) return NaN;
    var p = s.lastIndexOf("."), c = s.lastIndexOf(",");
    if (p > -1 && c > -1) { var dec = p > c ? "." : ","; s = s.split(dec === "." ? "," : ".").join(""); if (dec === ",") s = s.replace(",", "."); }
    else if (p > -1 || c > -1) {
      var sep = p > -1 ? "." : ",", partes = s.split(sep);
      if (partes.length > 2 || partes[1].length === 3) s = partes.join("");   // separador de miles: 45.900 · 1.234.567
      else s = partes[0] + "." + partes[1];                                   // decimales: 45900,50
    }
    var n = parseFloat(s);
    return isFinite(n) ? Math.round(neg ? -n : n) : NaN;
  }
  var MESES_TXT = { en: 1, ene: 1, ja: 1, feb: 2, fe: 2, mar: 3, abr: 4, ap: 4, may: 5, jun: 6, jul: 7, ag: 8, ago: 8, au: 8, sep: 9, sept: 9, set: 9, oct: 10, nov: 11, dic: 12, de: 12 };
  function fechaExtracto(v) {
    var d = null, m;
    if (v && typeof v === "object") { if (v.n > 20000 && v.n < 80000) { var t = new Date(Date.UTC(1899, 11, 30) + Math.floor(v.n) * 86400000); return t.toISOString().slice(0, 10); } v = String(v.n); }
    var s = String(v == null ? "" : v).trim().toLowerCase();
    if ((m = /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/.exec(s))) d = [+m[1], +m[2], +m[3]];
    else if ((m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(s))) d = [+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]];
    else if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) d = [+m[1], +m[2], +m[3]];
    else if ((m = /^(\d{1,2})[\s\-\/]*([a-záéíóú]{2,4})\.?[\s\-\/]*(?:de\s+)?(\d{2,4})/.exec(nrm(s)))) { var mm = MESES_TXT[m[2]] || MESES_TXT[m[2].slice(0, 3)]; if (mm) d = [+m[3] < 100 ? 2000 + +m[3] : +m[3], mm, +m[1]]; }
    if (!d || d[1] < 1 || d[1] > 12 || d[2] < 1 || d[2] > 31 || d[0] < 2000 || d[0] > 2100) return "";
    return d[0] + "-" + ("0" + d[1]).slice(-2) + "-" + ("0" + d[2]).slice(-2);
  }
  // De la tabla del banco a una lista de movimientos { fecha, desc, monto (negativo = sale) }.
  function tablaExtracto(filas) {
    var cab = -1, col = {};
    for (var i = 0; i < Math.min(filas.length, 40) && cab < 0; i++) {
      var f = (filas[i] || []).map(function (x) { return nrm(x && typeof x === "object" ? "" : x); }), c = {};
      f.forEach(function (h, j) {
        if (c.fecha == null && /^fecha|^date$|fecha (de )?(transaccion|movimiento|operacion)/.test(h)) c.fecha = j;
        else if (c.tipo == null && /^tipo|naturaleza|^d\/c$|^dc$/.test(h)) c.tipo = j;
        else if (c.desc == null && /descripcion|detalle|concepto|^movimiento|transaccion|comercio|establecimiento|^nombre/.test(h)) c.desc = j;
        else if (c.debito == null && /debito|cargo|retiro|salida|egreso|^debe$/.test(h) && !/saldo/.test(h)) c.debito = j;
        else if (c.credito == null && /credito|abono|deposito|entrada|ingreso|^haber$/.test(h) && !/saldo/.test(h)) c.credito = j;
        else if (c.valor == null && /^valor|^monto|importe|^cantidad/.test(h) && !/saldo/.test(h)) c.valor = j;
      });
      if (c.fecha != null && (c.valor != null || c.debito != null || c.credito != null)) { cab = i; col = c; }
    }
    if (cab < 0) return { error: "No encontramos las columnas de fecha y valor. Revisa que sea el archivo de movimientos del banco (no el PDF del extracto)." };
    var movs = [], soloPositivos = true, conValor = col.valor != null && col.debito == null && col.credito == null;
    for (var r = cab + 1; r < filas.length; r++) {
      var f2 = filas[r] || [], fecha = fechaExtracto(f2[col.fecha]);
      if (!fecha) continue;
      var desc = String(col.desc != null ? (f2[col.desc] && typeof f2[col.desc] === "object" ? f2[col.desc].n : f2[col.desc] || "") : "").trim();
      if (/^(saldo|total|subtotal)\b/i.test(nrm(desc))) continue;
      var monto = 0;
      if (conValor) {
        monto = montoExtracto(f2[col.valor]);
        var tp = col.tipo != null ? nrm(f2[col.tipo]) : "";
        if (isFinite(monto) && monto > 0 && /^(?:d|db|dr|-)$|^(?:debito|cargo|retiro|egreso|compra|pago)/.test(tp)) monto = -monto;
        if (isFinite(monto) && monto < 0 && /^(?:c|cr|\+)$|^(?:credito|abono|ingreso|consignacion|deposito)/.test(tp)) monto = -monto;
      } else {
        var deb = col.debito != null ? montoExtracto(f2[col.debito]) : NaN, cre = col.credito != null ? montoExtracto(f2[col.credito]) : NaN;
        monto = (isFinite(cre) && Math.abs(cre) > 0) ? Math.abs(cre) : (isFinite(deb) && Math.abs(deb) > 0) ? -Math.abs(deb) : 0;
      }
      if (!isFinite(monto) || !monto) continue;
      if (monto < 0) soloPositivos = false;
      movs.push({ fecha: fecha, desc: desc.slice(0, 120), monto: monto });
    }
    // Una sola columna de valor sin signos: se decide por la descripción (abonos y consignaciones son ingresos).
    if (conValor && soloPositivos) movs.forEach(function (m) {
      if (!/abono|consignacion|recibid|nomina|deposito|reintegro|devolucion|intereses? (?:ganados|abonados)|transferencia de|te enviaron|te llego/.test(nrm(m.desc))) m.monto = -m.monto;
    });
    if (!movs.length) return { error: "El archivo no tiene movimientos con fecha y valor que podamos leer." };
    return { movs: movs.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; }), sinSigno: conValor && soloPositivos };
  }
  // "COMPRA EN EXITO LAURELES 1234" → "Exito Laureles"
  function limpiarDesc(d) {
    var s = String(d || "").replace(/\s{2,}/g, " ").trim();
    s = s.replace(/^(?:compra(?:s)?(?: intl| nacional| internacional)?(?: en)?|pago(?: pse| de| a| en)?|pse|transf(?:erencia)?(?: a| de)?|retiro(?: en)? (?:cajero|atm)?|abono(?: de| por)?|cargo(?: de| por)?|debito(?: automatico)?(?: de)?)\s+/i, "");
    s = s.replace(/\s+(?:ref\.?|referencia|nro\.?|no\.)?\s*[\d*#\-]{4,}$/i, "").replace(/\s+\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/, "");
    return LECTOR.bonito(s.slice(0, 60)) || "Movimiento del banco";
  }
  function esTrasladoPropio(desc) {
    var n = nrm(desc);
    if (/traslado|entre (?:tus|sus|mis) (?:cuentas|productos)|a (?:tu|su|mi) (?:bolsillo|colchon|meta|nequi|daviplata)|ahorro programado|pago (?:a |de )?(?:tu |su )?(?:tarjeta|tc\b)|abono a (?:tu |su )?tarjeta|pago recibido|gracias por su pago/.test(n)) return true;
    return (state.cuentas || []).some(function (c) { var nc = nrm(c.nombre); return nc.length > 3 && c.tipo !== "efectivo" && new RegExp("(?:a|hacia|de|desde) (?:tu |su |mi )?" + nc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(n); });
  }
  function analizarExtracto(lista) {
    var yaMovs = {}, out = { nuevos: [], repetidos: 0, traslados: 0, retiros: 0, gastos: 0, ingresos: 0, nG: 0, nI: 0, porCat: {}, meses: {} };
    (state.movs || []).forEach(function (m) { yaMovs[m.f + "|" + m.m] = (yaMovs[m.f + "|" + m.m] || 0) + 1; });
    lista.forEach(function (x) {
      var abs = Math.abs(x.monto), com = limpiarDesc(x.desc), huella = LECTOR.huella({ monto: abs, fecha: x.fecha, comercio: com });
      if (state.importados.indexOf(huella) > -1 || yaMovs[x.fecha + "|" + abs] > 0) { if (yaMovs[x.fecha + "|" + abs] > 0) yaMovs[x.fecha + "|" + abs]--; out.repetidos++; return; }
      if (esTrasladoPropio(x.desc)) { out.traslados++; return; }
      if (x.monto < 0 && /^retiro\b|\bretiro (?:en )?(?:cajero|atm|corresponsal)|\bavance\b/.test(nrm(x.desc))) { out.retiros++; return; }
      var tipo = x.monto < 0 ? "gasto" : "ingreso", cat = "";
      if (tipo === "gasto") { var r = LECTOR.sugerirCategoria({ comercio: com, tipo: "gasto" }, state.reglas); cat = r.cat || "otros"; out.gastos += abs; out.nG++; out.porCat[cat] = (out.porCat[cat] || 0) + abs; }
      else { out.ingresos += abs; out.nI++; }
      out.meses[x.fecha.slice(0, 7)] = 1;
      out.nuevos.push({ fecha: x.fecha, comercio: com, monto: abs, tipo: tipo, cat: cat, huella: huella });
    });
    return out;
  }
  function mesesPermitidos() {
    if (hasPremium()) return null;
    var hoy = new Date(), ks = [];
    for (var i = 0; i < MESES_GRATIS; i++) ks.push(keyOf(new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)));
    return ks;
  }
  function asegurarMes(k) {
    if (state.meses[k]) return state.meses[k];
    var base = cur();
    state.meses[k] = { ingresos: base.ingresos.map(function (r) { return { id: r.id, concepto: r.concepto, plan: r.plan, real: 0 }; }),
      gastos: base.gastos.map(function (r) { return { id: r.id, concepto: r.concepto, cat: r.cat, dia: r.dia, plan: r.plan, real: 0 }; }), notas: "" };
    return state.meses[k];
  }
  function importarExtracto(an, cuentaId) {
    var antes = JSON.stringify(state), permitidos = mesesPermitidos(), enTablas = 0, soloHistorial = 0;
    if (state.ejemplo) {   // el ejemplo se va: queda la lista de conceptos con montos en cero
      Object.keys(state.meses).forEach(function (k) { if (k !== state.mes) delete state.meses[k]; });
      cur().ingresos.forEach(function (r) { r.plan = 0; r.real = 0; }); cur().gastos.forEach(function (r) { r.plan = 0; r.real = 0; });
      state.cuentas.forEach(function (c) { c.saldo = 0; c.cupo = 0; }); state.metas = []; state.deudas = []; state.porPagar = []; state.movs = []; state.ejemplo = false;
    }
    an.nuevos.forEach(function (x) {
      var k = x.fecha.slice(0, 7);
      anotarMov({ t: x.tipo === "ingreso" ? "i" : "g", f: x.fecha, hora: "", cat: x.cat, c: x.comercio, m: x.monto, com: x.comercio });
      state.importados.push(x.huella);
      if (permitidos && permitidos.indexOf(k) < 0) { soloHistorial++; return; }
      var m = asegurarMes(k);
      if (x.tipo === "ingreso") {
        var ri = m.ingresos[0]; if (!ri) { ri = { id: rid("i"), concepto: "Ingresos", plan: 0, real: 0 }; m.ingresos.push(ri); }
        ri.real += x.monto;
      } else {
        var rg = m.gastos.find(function (g) { return g.cat === x.cat; });
        if (!rg) { var c = catById(x.cat); rg = { id: rid("g"), concepto: c ? c.name : "Otros", cat: x.cat, dia: 0, plan: 0, real: 0 }; m.gastos.push(rg); }
        rg.real += x.monto;
      }
      enTablas++;
    });
    if (permitidos) { var ks = Object.keys(state.meses).sort(); while (ks.length > MESES_GRATIS) { var k0 = ks.shift(); if (k0 !== state.mes) delete state.meses[k0]; } }
    state.importados = state.importados.slice(-3000);
    changed(); renderAll();
    metrica("extracto", "una");
    return { antes: antes, enTablas: enTablas, soloHistorial: soloHistorial };
  }
  function pintarExtracto() {
    var an = extractoLeido, box = $("extracto-res");
    if (!an) { box.hidden = true; return; }
    var ms = Object.keys(an.meses).sort(), permitidos = mesesPermitidos(), fuera = permitidos ? ms.filter(function (k) { return permitidos.indexOf(k) < 0; }) : [];
    var top = Object.keys(an.porCat).sort(function (a, b) { return an.porCat[b] - an.porCat[a]; }).slice(0, 5);
    var desde = an.nuevos.length ? an.nuevos[0].fecha : "", hasta = an.nuevos.length ? an.nuevos[an.nuevos.length - 1].fecha : "";
    var f = function (d, conAno) { var p = d.split("-"); return +p[2] + " de " + MESES[+p[1] - 1] + (conAno ? " de " + p[0] : ""); };
    var rango = desde.slice(0, 4) === hasta.slice(0, 4) ? "Del " + f(desde) + " al " + f(hasta, 1) : "Del " + f(desde, 1) + " al " + f(hasta, 1);
    box.innerHTML = !an.nuevos.length ? '<p class="msg">No hay movimientos nuevos para importar' + (an.repetidos ? ": los " + an.repetidos + " del archivo ya estaban registrados." : ".") + "</p>" :
      '<div class="extracto-res-top"><b>' + plural(an.nuevos.length, "movimiento") + " nuevo" + (an.nuevos.length === 1 ? "" : "s") + "</b><span>" + rango + "</span></div>" +
      '<div class="extracto-cifras"><span><small>Gastos</small><b>' + money(an.gastos) + "</b><small>" + plural(an.nG, "movimiento") + '</small></span><span><small>Ingresos</small><b>' + money(an.ingresos) + "</b><small>" + plural(an.nI, "movimiento") + "</small></span></div>" +
      (top.length ? '<ul class="extracto-cats">' + top.map(function (k) { var c = catById(k); return "<li><span>" + esc(c ? c.name : "Otros") + "</span><b>" + money(an.porCat[k]) + "</b></li>"; }).join("") + "</ul>" : "") +
      '<ul class="extracto-notas">' + (an.repetidos ? "<li>" + plural(an.repetidos, "movimiento") + " ya estaba" + (an.repetidos === 1 ? "" : "n") + " registrado" + (an.repetidos === 1 ? "" : "s") + ": no se repite" + (an.repetidos === 1 ? "" : "n") + ".</li>" : "") +
      (an.traslados ? "<li>" + plural(an.traslados, "traslado") + " entre tus cuentas o pagos de tarjeta: no cuentan como gasto.</li>" : "") +
      (an.retiros ? "<li>" + plural(an.retiros, "retiro") + " de cajero: ese efectivo cuenta como gasto cuando lo uses.</li>" : "") +
      (an.sinSigno ? "<li>El archivo no dice qué es gasto y qué es ingreso; lo deducimos por la descripción. Puedes corregirlo después en la tabla del mes.</li>" : "") +
      (fuera.length ? "<li>En la versión gratis se guardan tus últimos " + MESES_GRATIS + " meses en las tablas. Los movimientos de " + fuera.map(function (k) { return monthLabel(k).toLowerCase(); }).join(", ") + " también le sirven al asesor para conocerte.</li>" : "") + "</ul>" +
      '<button class="btn primary full" type="button" id="extracto-ok">Importar ' + plural(an.nuevos.length, "movimiento") + "</button>";
    box.hidden = false;
  }
  function abrirExtracto() {
    $("menu-mas").hidden = true; extractoLeido = null; $("extracto-msg").textContent = ""; $("extracto-res").hidden = true; $("f-extracto").value = "";
    openDlg("dlg-extracto", "#extracto-elegir");
  }
  $("btn-extracto-menu").addEventListener("click", abrirExtracto);
  document.addEventListener("click", function (e) { if (e.target.closest("[data-open-extracto]")) { closeDlg("dlg-fuentes"); setTimeout(abrirExtracto, 50); } });
  $("extracto-elegir").addEventListener("click", function () { $("f-extracto").click(); });
  $("f-extracto").addEventListener("change", function () {
    var file = this.files && this.files[0], msg = $("extracto-msg");
    if (!file) return;
    extractoLeido = null; $("extracto-res").hidden = true;
    if (file.size > 8 * 1024 * 1024) { msg.textContent = "El archivo es muy grande. Descarga un rango más corto, por ejemplo de 3 meses."; msg.className = "msg err"; return; }
    var nombre = file.name.toLowerCase();
    if (/\.pdf$/.test(nombre)) { msg.textContent = "El PDF del extracto no se puede leer. En la app o la página de tu banco, busca la opción de descargar los movimientos en Excel o CSV."; msg.className = "msg err"; return; }
    if (/\.xls$/.test(nombre)) { msg.textContent = "Ese es un Excel antiguo (.xls). Ábrelo y guárdalo como .xlsx o .csv, y súbelo de nuevo."; msg.className = "msg err"; return; }
    msg.textContent = "Leyendo " + file.name + "…"; msg.className = "msg";
    var leer = /\.xlsx$/.test(nombre) ? file.arrayBuffer().then(leerXLSX) : file.text().then(leerCSV);
    leer.then(function (filas) {
      var t = tablaExtracto(filas);
      if (t.error) { msg.textContent = t.error; msg.className = "msg err"; return; }
      extractoLeido = analizarExtracto(t.movs); extractoLeido.sinSigno = t.sinSigno;
      msg.textContent = ""; pintarExtracto();
    }).catch(function () { msg.textContent = "No pudimos abrir ese archivo. Revisa que sea un Excel (.xlsx) o un CSV de movimientos."; msg.className = "msg err"; });
  });
  $("extracto-res").addEventListener("click", function (e) {
    if (!e.target.closest("#extracto-ok") || !extractoLeido || !extractoLeido.nuevos.length) return;
    var r = importarExtracto(extractoLeido), n = extractoLeido.nuevos.length;
    closeDlg("dlg-extracto"); extractoLeido = null;
    toast("Listo: importamos " + plural(n, "movimiento") + ". El asesor ya puede conocer tus hábitos.", { action: "Deshacer", onAction: function () { state = sanitize(JSON.parse(r.antes)); changed(); renderAll(); } });
  });

