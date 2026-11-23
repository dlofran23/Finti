  // ===================== Excel avanzado (plantilla con fórmulas y gráficos) =====================
  // La plantilla trae una fila prototipo por tabla (fila 5; en el Panel, la 76). Se clona por cada dato,
  // se ajustan las tablas y se reemplazan las filas centinela de los gráficos ($991–$994) por la última fila real.
  var jszipLoading = null;
  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (jszipLoading) return jszipLoading;
    jszipLoading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      // En el sitio propio la librería se sirve desde el mismo dominio (no depende de otro servidor).
      s.src = WEB ? "/vendor/jszip-3.10.1.min.js" : "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = function () { window.JSZip ? resolve(window.JSZip) : reject(new Error("jszip")); };
      s.onerror = function () { jszipLoading = null; reject(new Error("jszip")); };
      document.head.appendChild(s);
    });
    return jszipLoading;
  }
  function xmlEsc(v) { return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function shiftFormula(f, delta) {
    if (!delta) return f;
    return f.replace(/("(?:[^"]|"")*"|'(?:[^']|'')*')|(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\d(])/g, function (m, q, d1, col, d2, row) {
      if (q || d2) return m;
      return d1 + col + (+row + delta);
    });
  }
  function cellXml(ref, s, v) {
    var sa = s ? ' s="' + s + '"' : "";
    if (v === null || v === undefined || v === "") return '<c r="' + ref + '"' + sa + "/>";
    if (typeof v === "number" && isFinite(v)) return '<c r="' + ref + '"' + sa + "><v>" + v + "</v></c>";
    return '<c r="' + ref + '"' + sa + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v) + "</t></is></c>";
  }
  function fillRows(xml, protoRow, rows) {
    var m = new RegExp('<row r="' + protoRow + '"([^>]*)>([\\s\\S]*?)</row>').exec(xml);
    if (!m) throw new Error("fila prototipo " + protoRow);
    var rowAttrs = m[1].replace(/\s+spans="[^"]*"/, "");   // conserva la altura de la fila (las filas sin altura quedan ocultas en el Panel)
    var cells = [], re = /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, c;
    while ((c = re.exec(m[2]))) {
      var s = /\ss="(\d+)"/.exec(c[2]), f = c[3] ? /<f>([\s\S]*?)<\/f>/.exec(c[3]) : null;
      cells.push({ col: c[1], s: s ? s[1] : null, f: f ? f[1] : null });
    }
    var out = rows.map(function (vals, i) {
      var r = protoRow + i;
      return '<row r="' + r + '"' + rowAttrs + '>' + cells.map(function (cell, ci) {
        var v = vals[ci];
        if (cell.f && v === undefined) return '<c r="' + cell.col + r + '"' + (cell.s ? ' s="' + cell.s + '"' : "") + "><f>" + shiftFormula(cell.f, i) + "</f></c>";
        return cellXml(cell.col + r, cell.s, v);
      }).join("") + "</row>";
    }).join("");
    return xml.replace(m[0], out);
  }
  function setCell(xml, ref, v) {
    var re = new RegExp('<c r="' + ref + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)');
    return xml.replace(re, function (all, attrs) {
      var s = /\ss="(\d+)"/.exec(attrs);
      return cellXml(ref, s ? s[1] : null, v);
    });
  }
  function setDimension(xml, end) { return xml.replace(/(<dimension ref="[A-Z]+\d+:[A-Z]+)\d+("\/>)/, "$1" + end + "$2"); }
  function setTableEnd(xml, end) { return xml.replace(/ref="([A-Z]+\d+):([A-Z]+)\d+"/g, 'ref="$1:$2' + end + '"'); }
  function dateSerial(k) { var p = parseKey(k); return (Date.UTC(p.y, p.m - 1, 1) - Date.UTC(1899, 11, 30)) / 86400000; }

  // Ubica cada hoja (y su tabla) por nombre, sin depender del número de archivo
  function hojasPorNombre(zip) {
    function abs(base, t) { var parts = (t.charAt(0) === "/" ? t.slice(1) : base + t).split("/"), out = []; parts.forEach(function (p) { if (p === "..") out.pop(); else if (p && p !== ".") out.push(p); }); return out.join("/"); }
    return Promise.all([zip.file("xl/workbook.xml").async("string"), zip.file("xl/_rels/workbook.xml.rels").async("string")]).then(function (r) {
      var rels = {}, m, re = /<Relationship\b[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g, re2 = /<Relationship\b[^>]*?Target="([^"]+)"[^>]*?Id="([^"]+)"/g;
      while ((m = re.exec(r[1]))) rels[m[1]] = m[2];
      while ((m = re2.exec(r[1]))) rels[m[2]] = m[1];
      var out = {}, sr = /<sheet\b[^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"/g, list = [];
      while ((m = sr.exec(r[0]))) list.push({ name: m[1].replace(/&amp;/g, "&"), path: abs("xl/", rels[m[2]]) });
      return Promise.all(list.map(function (h) {
        out[h.name] = { path: h.path, table: null };
        var rp = h.path.replace(/([^/]+)$/, "_rels/$1.rels"), f = zip.file(rp);
        if (!f) return;
        return f.async("string").then(function (x) { var t = /Target="([^"]*tables\/table\d+\.xml)"/.exec(x); if (t) out[h.name].table = abs(h.path.replace(/[^/]+$/, ""), t[1]); });
      })).then(function () { return out; });
    });
  }

  function buildWorkbook(JSZip) {
    var b64 = document.getElementById("xlsx-template").textContent.replace(/\s+/g, "");
    return JSZip.loadAsync(b64, { base64: true }).then(function (zip) {
      var ks = monthKeys();
      var allCats = BASE_CATS.concat(state.categorias), orden = [];
      var mov = [], used = {}, usedOrder = [];
      ks.forEach(function (k) {
        var m = state.meses[k], d = dateSerial(k);
        m.ingresos.forEach(function (r) { mov.push([d, "Ingreso", r.concepto, "", "", r.plan, r.real]); });
        m.gastos.forEach(function (r) {
          var c = catById(r.cat) || BASE_CATS[10];
          mov.push([d, "Gasto", r.concepto, c.name, r.dia || "", r.plan, r.real]);
          if (!used[c.id]) { used[c.id] = 1; }
        });
      });
      // Categorías del Panel: las usadas, ordenadas por gasto real del mes que se está viendo
      var tm = totalsOf(cur());
      orden = allCats.filter(function (c) { return used[c.id]; });
      if (!orden.length) orden = BASE_CATS.slice();
      orden.sort(function (a, b) {
        var x = tm.byCat[a.id] || { real: 0, plan: 0 }, y = tm.byCat[b.id] || { real: 0, plan: 0 };
        return (y.real - x.real) || (y.plan - x.plan);
      });
      usedOrder = orden.map(function (c) { return [c.name]; });
      if (!mov.length) mov = [["", "", "", "", "", "", ""]];
      var cat = allCats.map(function (c) { return [c.name, GROUP_NAME[c.group]]; });
      var hist = ks.map(function (k) { return [dateSerial(k)]; });
      var metas = state.metas.map(function (g) { return [g.nombre, g.objetivo, g.ahorrado, g.fecha ? dateSerial(g.fecha) : ""]; });
      if (!metas.length) metas = [["", "", "", ""]];
      var deudas = state.deudas.map(function (d) { return [d.nombre, d.saldo, d.tasa / 100, d.cuota]; });
      if (!deudas.length) deudas = [["", "", "", ""]];
      var notas = [];   // una fila por mes, con todas las ideas del mes en la misma celda
      ks.forEach(function (k) {
        var lineas = String(state.meses[k].notas || "").split(/\n+/).map(function (t) { return t.trim(); }).filter(Boolean);
        var tipos = leerNotas(state.meses[k].notas).map(function (x) { return x.tipo; }).filter(function (t) { return t !== "nota"; });
        if (lineas.length) notas.push([dateSerial(k), tipos.length ? TIPOS_NOTA[tipos[0]].n : "", lineas.map(function (t) { return "• " + t; }).join("\n")]);
      });
      if (!notas.length) notas = [["", "", ""]];

      // Cuentas por pagar y cuentas de dinero
      var hoyD = d0();
      var pagos = state.porPagar.map(function (b) {
        var c = catById(b.cat) || BASE_CATS[10], f = parseD(b.fecha);
        return [b.nombre, b.monto, b.f === "mensual" ? "Mensual" : b.f === "anual" ? "Anual" : "Una vez", b.f === "mensual" ? b.dia : "",
          f ? (Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()) - Date.UTC(1899, 11, 30)) / 864e5 : "", b.aviso, b.pagos[keyDe(b, hoyD)] || estadoPago(b, hoyD).key > keyDe(b, hoyD) ? "Sí" : "No",
          undefined, undefined, undefined, c.name];
      });
      if (!pagos.length) pagos = [["", "", "", "", "", "", "", undefined, undefined, undefined, ""]];
      var cuentas = state.cuentas.map(function (c) { return [c.nombre, tipoCuenta(c.tipo).name, c.saldo, c.tipo === "tarjeta" && c.cupo ? c.cupo : ""]; });
      if (!cuentas.length) cuentas = [["", "", "", ""]];
      var r0 = simRacha(), m0 = rachaMeses();
      var rachaTxt = state.ejemplo ? "" : "Racha: " + plural(r0.actual, "día") + " · Ahorrando: " + m0.actual + (m0.actual === 1 ? " mes" : " meses") + " · Logros: " + state.logros.length + " de " + LOGROS.length;

      var jobs = [
        { name: "Panel", proto: 76, rows: usedOrder, extra: function (x) { x = setCell(x, "B3", state.titulo || "Mi presupuesto"); x = setCell(x, "F3", rachaTxt); return setCell(x, "C6", dateSerial(state.mes)); } },
        { name: "Movimientos", proto: 5, rows: mov },
        { name: "Pagos", proto: 5, rows: pagos },
        { name: "Cuentas", proto: 5, rows: cuentas },
        { name: "Categorías", proto: 5, rows: cat },
        { name: "Historial", proto: 5, rows: hist },
        { name: "Metas", proto: 5, rows: metas },
        { name: "Deudas", proto: 5, rows: deudas },
        { name: "Notas", proto: 5, rows: notas }
      ];
      var ends = {};
      return hojasPorNombre(zip).then(function (hojas) { return Promise.all(jobs.map(function (j) {
        var h = hojas[j.name]; if (!h) throw new Error("hoja " + j.name);
        var sp = h.path, end = j.proto + j.rows.length - 1;
        ends[j.name] = end;
        return zip.file(sp).async("string").then(function (x) {
          x = fillRows(x, j.proto, j.rows);
          x = setDimension(x, end);
          if (j.extra) x = j.extra(x);
          zip.file(sp, x);
          if (!h.table) return;
          return zip.file(h.table).async("string").then(function (t) { zip.file(h.table, setTableEnd(t, end)); });
        });
      })); }).then(function () {
        var sentinel = { "$991": ends.Panel, "$992": ends.Historial, "$993": ends.Metas, "$994": ends.Deudas };
        var charts = zip.file(/^xl\/charts\/chart\d+\.xml$/);
        return Promise.all(charts.map(function (f) {
          return f.async("string").then(function (x) {
            Object.keys(sentinel).forEach(function (k) { x = x.split(k + "<").join("$" + sentinel[k] + "<"); });
            // Dona: cada porción con el color de su categoría, igual que en la app
            x = x.replace(/A000(\d\d)/g, function (m, i) {
              var c = orden[+i];
              return c ? catColor(c.id).replace("#", "").toUpperCase() : "ADB5BD";
            });
            zip.file(f.name, x);
          });
        }));
      }).then(function () {
        return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      });
    });
  }
  window.__buildWorkbook = function () { return loadJSZip().then(buildWorkbook); }; // usado en pruebas

  $("btn-xlsx").addEventListener("click", function () {
    if (!hasPremium()) { openPremium("Descargar en Excel es parte de Premium."); return; }
    var btn = this, lbl = btn.querySelector("span") || btn, label = lbl.textContent;
    function done(msg) { lbl.textContent = msg; setTimeout(function () { lbl.textContent = label; }, 2600); }
    if (WEB) {
      btn.disabled = true; lbl.textContent = "Preparando…";
      loadJSZip().then(buildWorkbook).then(function (buf) {
        descargar(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "finti-" + state.mes + ".xlsx");
        done("Descargado ✓");
      }, function () { done("No se pudo descargar"); }).then(function () { btn.disabled = false; });
      return;
    }
    if (!claudeApi || typeof claudeApi.use !== "function") { done("Abre la página desde Claude"); return; }
    btn.disabled = true; lbl.textContent = "Preparando…";
    Promise.all([loadJSZip(), claudeApi.use("downloads")]).then(function (r) {
      if (!r[1]) throw { code: "unavailable" };
      return buildWorkbook(r[0]).then(function (buf) {
        return r[1].save({ filename: "finti-" + state.mes + ".xlsx", data: buf });
      });
    }).then(function () { done("Descargado ✓"); }, function (err) {
      var c = err && err.code;
      done(c === "declined" ? "Descarga cancelada" : c === "unavailable" || c === "not_granted" ? "No disponible aquí" : "No se pudo descargar");
    }).then(function () { btn.disabled = false; });
  });

