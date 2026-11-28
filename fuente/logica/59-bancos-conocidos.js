  // ===================== Bancos conocidos =====================
  // Al agregar una cuenta se elige la entidad de una lista: los bancos de Colombia, las billeteras y bancos digitales,
  // las cooperativas y financieras más usadas y las entidades internacionales más comunes. Cada tarjeta lleva el color
  // característico de su entidad (aproximado) y su nombre escrito, sin logos. Son funciones (no variables) para que
  // estén listas desde el primer dibujo de la app.
  // Cada fila: id, nombre, grupo, color de fondo, color del texto, color del aro, tipo de cuenta, otros nombres.
  var BANCOS_GRUPOS = [["d", "Billeteras y bancos digitales"], ["b", "Bancos de Colombia"], ["c", "Cooperativas y financieras"], ["i", "Internacionales"]];
  var _bancos = null;
  function bkNrm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function bancosLista() {
    if (_bancos) return _bancos;
    var B = "#ffffff", filas = [
      ["nequi", "Nequi", "d", "#2a0638", B, "#da0081", "nequi"],
      ["daviplata", "Daviplata", "d", "#d8121b", B, B, "daviplata"],
      ["nu", "Nu", "d", "#820ad1", B, B, "banco", "nubank|nu colombia"],
      ["lulo", "Lulo Bank", "d", "#111214", B, "#d4ff3a", "banco", "lulo"],
      ["rappipay", "RappiPay", "d", "#e8381a", B, B, "banco", "rappi"],
      ["uala", "Ualá", "d", "#3557e8", B, B, "banco"],
      ["movii", "MOVii", "d", "#4f2bb8", B, "#33e0c0", "otra"],
      ["dale", "dale!", "d", "#2c1a66", B, "#ffd100", "otra"],
      ["pibank", "Pibank", "d", "#11225a", B, "#ffd100", "banco"],
      ["global66", "Global66", "d", "#0a2a5e", B, "#00d1b2", "otra"],
      ["mercadopago", "Mercado Pago", "d", "#0a78c2", B, "#fff159", "otra"],
      ["bancolombia", "Bancolombia", "b", "#fdda24", "#2c2a29", "#2c2a29", "banco"],
      ["bogota", "Banco de Bogotá", "b", "#00306e", B, "#d9a520", "banco", "bogota"],
      ["davivienda", "Davivienda", "b", "#e01b22", B, B, "banco"],
      ["bbva", "BBVA", "b", "#004481", B, "#2dcccd", "banco"],
      ["occidente", "Banco de Occidente", "b", "#00529b", B, B, "banco", "occidente"],
      ["popular", "Banco Popular", "b", "#007a4d", B, B, "banco"],
      ["avvillas", "Banco AV Villas", "b", "#c8102e", B, "#0033a0", "banco", "av villas"],
      ["cajasocial", "Banco Caja Social", "b", "#003da5", B, "#e4002b", "banco", "caja social"],
      ["agrario", "Banco Agrario", "b", "#00703c", B, "#ffd100", "banco", "agrario"],
      ["colpatria", "Scotiabank Colpatria", "b", "#d81e05", B, B, "banco", "colpatria|scotiabank"],
      ["itau", "Itaú", "b", "#ec7000", "#0b2a6b", "#0b2a6b", "banco", "itau"],
      ["gnb", "Banco GNB Sudameris", "b", "#006a4e", B, B, "banco", "gnb|sudameris"],
      ["falabella", "Banco Falabella", "b", "#2e7d32", B, "#b5e655", "banco", "falabella|cmr"],
      ["pichincha", "Banco Pichincha", "b", "#ffdd00", "#0f265c", "#0f265c", "banco", "pichincha"],
      ["bancoomeva", "Bancoomeva", "b", "#00805a", B, B, "banco", "coomeva"],
      ["finandina", "Banco Finandina", "b", "#5b2a86", B, B, "banco", "finandina"],
      ["serfinanza", "Banco Serfinanza", "b", "#0033a0", B, "#ff8200", "banco", "serfinanza"],
      ["bancow", "Banco W", "b", "#e0491b", B, B, "banco"],
      ["bancamia", "Bancamía", "b", "#4f8a2b", B, "#f39200", "banco", "bancamia"],
      ["mundomujer", "Banco Mundo Mujer", "b", "#c4006e", B, B, "banco", "mundo mujer"],
      ["mibanco", "Mibanco", "b", "#00843d", B, "#ffd100", "banco"],
      ["coopcentral", "Banco Coopcentral", "b", "#00733c", B, B, "banco", "coopcentral"],
      ["santander", "Banco Santander", "b", "#ec0000", B, B, "banco", "santander"],
      ["union", "Banco Unión", "b", "#0b3d91", B, B, "banco", "banco union"],
      ["contactar", "Banco Contactar", "b", "#0077b6", B, B, "banco", "contactar"],
      ["fna", "Fondo Nacional del Ahorro", "c", "#006e3c", B, "#ffd100", "banco", "fna|fondo nacional del ahorro"],
      ["tuya", "Tuya (Tarjeta Éxito)", "c", "#4b2a7b", B, "#ffd400", "tarjeta", "tuya|tarjeta exito"],
      ["confiar", "Confiar", "c", "#00894f", B, B, "banco"],
      ["cotrafa", "Cotrafa", "c", "#005ba6", B, B, "banco"],
      ["jfk", "JFK Cooperativa", "c", "#0c4da2", B, B, "banco", "jfk"],
      ["juriscoop", "Juriscoop", "c", "#003b71", B, B, "banco"],
      ["paypal", "PayPal", "i", "#003087", B, "#009cde", "otra"],
      ["wise", "Wise", "i", "#9fe870", "#163300", "#163300", "otra"],
      ["revolut", "Revolut", "i", "#191c1f", B, "#0666eb", "banco"],
      ["payoneer", "Payoneer", "i", "#e04400", B, B, "otra"],
      ["chase", "Chase", "i", "#117aca", B, B, "banco"],
      ["bofa", "Bank of America", "i", "#012169", B, "#e31837", "banco", "bank of america|bofa"],
      ["wellsfargo", "Wells Fargo", "i", "#c41f26", B, "#ffcd41", "banco", "wells fargo"],
      ["citi", "Citibank", "i", "#003b70", B, "#e31837", "banco", "citi"],
      ["capitalone", "Capital One", "i", "#004977", B, "#d03027", "banco", "capital one"],
      ["hsbc", "HSBC", "i", "#db0011", B, B, "banco"],
      ["amex", "American Express", "i", "#006fcf", B, B, "tarjeta", "amex|american express"],
      ["skrill", "Skrill", "i", "#862165", B, B, "otra"],
      ["westernunion", "Western Union", "i", "#ffdd00", "#000000", "#000000", "otra", "western union"]
    ];
    _bancos = filas.map(function (f) {
      var nom = bkNrm(f[1]).replace(/[^a-z0-9 ]/g, "").trim();
      var otros = (f[7] ? f[7].split("|") : []).concat([nom]).map(function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
      return { id: f[0], n: f[1], g: f[2], c: f[3], t: f[4], a: f[5], tipo: f[6], re: new RegExp("(^| )(" + otros.join("|") + ")( |$)") };
    });
    return _bancos;
  }
  function bancoPorId(id) { return id ? bancosLista().find(function (b) { return b.id === id; }) || null : null; }
  // La entidad de una cuenta: la que se eligió o, en cuentas viejas, la que dice su nombre.
  function bancoDeCuenta(cu) {
    if (!cu) return null;
    var b = bancoPorId(cu.banco); if (b) return b;
    var n = " " + bkNrm(cu.nombre || "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim() + " ";
    return bancosLista().find(function (x) { return x.re.test(n); }) || null;
  }
  // Los colores de la tarjeta a partir del color de la entidad
  function marcaDeBanco(b, clase) {
    var g = "radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, " + b.c + " 62%, #fff) 0%, " + b.c + " 42%, color-mix(in srgb, " + b.c + " 62%, #000) 100%)";
    return { c: b.c, t: b.t, g: g, a: b.a, s: "color-mix(in srgb, " + b.c + " 55%, transparent)", clase: clase };
  }

  // --- Elegir la entidad al agregar una cuenta ---
  function bancosHtml(q) {
    var n = bkNrm(q || "").trim(), l = bancosLista().filter(function (b) { return !n || bkNrm(b.n).indexOf(n) > -1 || b.re.test(" " + n + " "); });
    var html = BANCOS_GRUPOS.map(function (gr) {
      var del = l.filter(function (b) { return b.g === gr[0]; }); if (!del.length) return "";
      return '<h3 class="bk-grupo">' + gr[1] + '</h3><div class="bk-lista">' + del.map(function (b) {
        return '<button type="button" class="bk-carta" data-banco="' + b.id + '" style="--bk:' + b.c + ";--bk-t:" + b.t + ";--bk-a:" + b.a + '"><span>' + esc(b.n) + "</span></button>";
      }).join("") + "</div>";
    }).join("");
    html += '<h3 class="bk-grupo">Otras</h3><div class="bk-lista">' +
      '<button type="button" class="bk-carta bk-efectivo" data-banco="=efectivo"><span>Efectivo</span></button>' +
      '<button type="button" class="bk-carta bk-otra" data-banco="=otra"><span>' + (n ? "Otra: " + esc(q.trim().slice(0, 40)) : "Otra entidad") + "</span></button></div>";
    return html;
  }
  function abrirBancos() {
    $("bk-buscar").value = ""; $("bk-res").innerHTML = bancosHtml("");
    $("bk-tc").setAttribute("aria-pressed", "false"); $("bk-cta").setAttribute("aria-pressed", "true");
    openDlg("dlg-bancos", "#bk-buscar");
  }
  $("bk-buscar").addEventListener("input", function () { $("bk-res").innerHTML = bancosHtml(this.value); });
  ["bk-cta", "bk-tc"].forEach(function (id) { $(id).addEventListener("click", function () { $("bk-cta").setAttribute("aria-pressed", id === "bk-cta"); $("bk-tc").setAttribute("aria-pressed", id === "bk-tc"); }); });
  $("bk-res").addEventListener("click", function (e) {
    var b = e.target.closest("[data-banco]"); if (!b) return;
    var k = b.dataset.banco, tc = $("bk-tc").getAttribute("aria-pressed") === "true", q = $("bk-buscar").value.trim().slice(0, 40), c;
    if (k === "=efectivo") c = { nombre: "Efectivo", tipo: "efectivo" };
    else if (k === "=otra") c = { nombre: q || "Otra cuenta", tipo: tc ? "tarjeta" : "otra" };
    else { var bk = bancoPorId(k); c = { nombre: bk.n + (tc && bk.tipo !== "tarjeta" ? " · Tarjeta" : ""), tipo: tc ? "tarjeta" : bk.tipo, banco: bk.id }; }
    c.id = rid("a"); c.saldo = 0; c.cupo = 0;
    state.cuentas.push(c); billeteraSel = c.id; closeDlg("dlg-bancos"); vibrar(10); changed(); renderCuentas(); checkLogros();
    var el = $("cuentas-body").querySelector('.acct[data-id="' + c.id + '"] [data-f="saldo"]'); if (el) { el.focus(); el.select(); }
  });
