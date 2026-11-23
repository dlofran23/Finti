// Finti · Lector de movimientos.
// Entiende avisos de bancos y billeteras (SMS, correo o notificación) y facturas electrónicas de la DIAN.
// Corre en el dispositivo de la persona: nada de esto necesita servidor.
(function (root) {
  "use strict";

  function sinTildes(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function normal(t) { return sinTildes(t).toLowerCase().replace(/\s+/g, " ").trim(); }
  function limpiar(t) { return String(t || "").replace(/ | /g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim(); }

  // ---------- Montos ----------
  // $715.275,71 · $ 50.000 · COP 50,000.00 · $1.200.000 · $ 25000
  function parseMonto(s) {
    s = String(s).replace(/\s/g, "");
    var lastDot = s.lastIndexOf("."), lastCom = s.lastIndexOf(",");
    var dec = "";
    if (lastDot > -1 && lastCom > -1) dec = lastDot > lastCom ? "." : ",";
    else if (lastCom > -1 && s.length - lastCom - 1 !== 3) dec = ",";
    else if (lastDot > -1 && s.length - lastDot - 1 !== 3) dec = ".";
    var n;
    if (dec === ",") n = parseFloat(s.replace(/\./g, "").replace(",", "."));
    else if (dec === ".") n = parseFloat(s.replace(/,/g, ""));
    else n = parseFloat(s.replace(/[.,]/g, ""));
    return isFinite(n) ? Math.round(n) : 0;
  }
  var RE_MONTO = /(?:\$|cop|col\$|pesos?)\s*([0-9][0-9.,]*[0-9]|[0-9])|([0-9][0-9.,]*[0-9])\s*(?:cop|pesos)/gi;
  function montos(t) {
    var out = [], m;
    RE_MONTO.lastIndex = 0;
    while ((m = RE_MONTO.exec(t))) { var v = parseMonto(m[1] || m[2]); if (v > 0) out.push({ v: v, i: m.index }); }
    // Sin signo de pesos: "por valor de 75000", "compra por 75.000"
    if (!out.length) { var re2 = /\b(?:por(?: (?:un )?valor(?: de)?)?|valor(?: de)?|monto(?: de)?)\s+([0-9]{1,3}(?:[.,][0-9]{3})+(?:,[0-9]{2})?|[0-9]{4,9})\b/gi; while ((m = re2.exec(t))) { var v2 = parseMonto(m[1]); if (v2 >= 100) out.push({ v: v2, i: m.index }); } }
    return out;
  }

  // ---------- Banco ----------
  var BANCOS = [
    ["Bancolombia", /bancolombia/], ["Nequi", /nequi/], ["Daviplata", /daviplata|85888|87718/], ["Davivienda", /davivienda/],
    ["BBVA", /bbva/], ["Banco de Bogotá", /banco de bogota|bancodebogota/], ["Nu", /\bnu\b|nubank|nu colombia/], ["Falabella", /banco falabella|cmr/],
    ["AV Villas", /av villas|avvillas/], ["Scotiabank Colpatria", /colpatria|scotiabank/], ["Banco de Occidente", /occidente/], ["Banco Popular", /banco popular/],
    ["Caja Social", /caja social/], ["Itaú", /itau/], ["Lulo Bank", /lulo/], ["RappiPay", /rappipay|rappicuenta/], ["Movii", /movii/], ["Dale!", /\bdale\b/],
    ["Banco Agrario", /agrario/], ["Bancoomeva", /bancoomeva|coomeva/], ["Pibank", /pibank/], ["Ualá", /uala/]
  ];
  function banco(n, remitente) {
    // Quien avisa va primero: "Banco de Bogotá: recibiste por llave desde Davivienda" es de Banco de Bogotá.
    var pre = /^\s*([^:\n]{2,40}):/.exec(n), orden = [normal(remitente), pre ? pre[1] : "", n];
    for (var k = 0; k < orden.length; k++) { if (!orden[k]) continue; for (var i = 0; i < BANCOS.length; i++) if (BANCOS[i][1].test(orden[k])) return BANCOS[i][0]; }
    return "";
  }

  // ---------- Tipo de movimiento ----------
  var TIPOS = [
    ["pagoTarjeta", /pago(?: exitoso| realizado| aplicado| recibido)? (?:a |de |de la |a la )?(?:tu |su )?(?:tarjeta|tc\b|t\.? ?cred)|abono a (?:tu |su )?tarjeta/],
    // Una entrada dicha sin dudas ("Laura te envió $35.000 a tu Nequi") gana aunque nombre tu cuenta
    ["ingreso", /\bte (?:envio|enviaron|llego|llegaron|consigno|consignaron|transfirio|transfirieron|giro|giraron|mando|mandaron|paso|pasaron|pago|pagaron)\b|\bse te (?:devolvio|devolvieron|reintegro|reintegraron|abono|abonaron)\b|te llego plata/],
    ["propio", /entre (?:tus|sus) (?:cuentas|productos|bolsillos)|cuentas? propias?|(?:a|hacia) (?:tu|su) (?:nequi|daviplata|bolsillo|colchon|meta|cuenta de ahorros|cuenta corriente|otra cuenta)|trasladaste|traslado (?:de|entre|a)|(?:a|de) (?:tu|su) bolsillo|guardaste en/],
    ["ingreso", /recibiste|te (?:enviaron|llego|llegaron|consignaron|transfirieron|pasaron)|le (?:consignaron|transfirieron)|recibio|recibida|recibido|abono (?:de|por)|abono en|consignacion (?:recibida|de)|deposito (?:recibido|de)|pago de nomina|nomina|reintegro|devolucion|devolvieron|devolvimos|reembolso|reverso|reversaron|anulacion de (?:tu |la )?compra|ingreso de|entrada de/],
    ["retiro", /retiro|retiraste|sacaste|avance/],
    ["gasto", /compra|compraste|pagaste|pago|transferiste|transferencia|enviaste|envio|pasaste|debito|cargo|recarga|cobro|pse/]
  ];
  function tipo(n) { for (var i = 0; i < TIPOS.length; i++) if (TIPOS[i][1].test(n)) return TIPOS[i][0]; return ""; }

  // ---------- Fecha y hora ----------
  // "14 nov 2026", "16 de noviembre de 2026": las tres primeras letras de cada mes
  var PREF_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"].map(function (x) { return x.slice(0, 3); });
  var RE_FECHA_MES = new RegExp("\\b(\\d{1,2})(?:\\s+de)?\\s+(" + PREF_MES.join("|") + ")[a-záéíóú]*\\.?(?:\\s+(?:de\\s+)?(\\d{4}))?\\b", "i");
  function fechaDe(t, hoy) {
    var m = /(\d{4})-(\d{2})-(\d{2})/.exec(t) || null, y, mo, d;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/.exec(t))) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
    else if ((m = RE_FECHA_MES.exec(t))) { d = +m[1]; mo = PREF_MES.indexOf(m[2].toLowerCase()) + 1; y = m[3] ? +m[3] : (hoy || new Date()).getFullYear(); }
    else if ((m = /\b(\d{1,2})\/(\d{1,2})\b(?!\/)/.exec(t))) { d = +m[1]; mo = +m[2]; y = (hoy || new Date()).getFullYear(); }
    if (!m || mo < 1 || mo > 12 || d < 1 || d > 31) return "";
    return y + "-" + ("0" + mo).slice(-2) + "-" + ("0" + d).slice(-2);
  }
  function horaDe(t) { var m = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(t); return m ? ("0" + m[1]).slice(-2) + ":" + m[2] : ""; }

  // ---------- Comercio o destinatario ----------
  var CORTE = /\s+(?:\d{1,2}:\d{2}|con\b|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2}-\d{2,4}|el \d|con (?:tu|su) |(?:en|a|para|desde) (?:tu|su) |desde |por (?:valor|\$|cop|\d)|valor|t\.? ?(?:cred|deb)|tarjeta|cta|cuenta|\*\d{4}|ref(?:erencia)?\b|aprob|fue\b|ha sido|exitos|a \d+ cuotas?)|\.(?!(?:com|co|net)\b)|[;|,]|\s{2,}|$/i;
  function recorta(s) {
    s = s.replace(/^(?:el |la |los |las |comercio |establecimiento )/i, "");
    var c = CORTE.exec(s); if (c) s = s.slice(0, c.index);
    s = s.trim().replace(/[,:\-–]+$/, "").trim().replace(/\s+(?:por|de|del|en|a|al|con|el|la|y)$/i, "").trim(); var sinSas = s.replace(/\s+(?:s\.?\s?a\.?\s?s\.?|s\.?\s?a\.?|ltda\.?)$/i, "").trim(); if (sinSas.length >= 2 && !/^(empresa|compania|sociedad|la empresa)$/i.test(sinSas)) s = sinSas;
    if (/^\d+$/.test(s) || s.length < 2 || /^(su|tu|la|el|los|las|cta|cuenta|tarjeta|su cta|tu cta|por)$/i.test(s) || /^(su|tu) /i.test(s)) return "";
    return s.slice(0, 60);
  }
  function comercio(t) {
    var m;
    if ((m = /(?:^|[:!.]\s*)([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ*][A-Za-zÁÉÍÓÚÑáéíóúñ*]+){0,3})\s+te\s+(?:envi[oó]|transfiri[oó]|consign[oó]|gir[oó]|mand[oó]|pas[oó]|pag[oó])(?=[\s.,!]|$)/.exec(t))) return m[1].slice(0, 60);
    if ((m = /recarg\w*[^\n]*?\b(claro|movistar|tigo|wom|etb|virgin|avantel|exito movil|flash mobile|une)\b/i.exec(t))) return "Recarga " + m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    if ((m = /\b(?:establecimiento|comercio)\s*:\s*(.{2,60})/i.exec(t))) { var r0 = recorta(m[1]); if (r0) return r0; }
    if ((m = /\b(?:en|a favor de|al comercio|comercio:?)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9*&'".\-/: ]{2,80})/.exec(t))) { var r = recorta(m[1]); if (r && !/^(tu|su) (cuenta|tarjeta)/i.test(r)) return r; }
    if ((m = /\b(?:a|para)\s+(?!tu |su |la cuenta|las \d|los \d)([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9*&'.\-: ]{1,60})/.exec(t))) { var r2 = recorta(m[1]); if (r2) return r2; }
    if ((m = /\bde\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9&'.\-: ]{1,60})/.exec(t))) { var r3 = recorta(m[1]); if (r3 && !/^(tu|su|la|el) /i.test(r3)) return r3; }
    // "Te abonaron $1.850.000 por NOMINA EMPRESA XYZ SAS en tu cuenta": el concepto en mayúsculas después de "por"
    if ((m = /\bpor\s+(?!COP\b|USD\b)([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9&.\- ]{2,60})/.exec(t))) { var r4 = recorta(m[1]); if (r4) return r4; }
    return "";
  }
  function medio(n) {
    var m = /\*\s?(\d{4})\b/.exec(n) || /(?:terminada en|termina en|finalizada en)\s*(\d{4})/.exec(n);
    var u4 = m ? m[1] : "";
    var tipoM = /^\s*efectivo\s*:/.test(n) ? "Efectivo" : esBreB(n) ? "Bre-B" : /apple ?pay/.test(n) ? "Apple Pay" : /t\.? ?cred|tarjeta de credito|tc\b|credito/.test(n) ? "Tarjeta de crédito" : /t\.? ?deb|tarjeta debito|tarjeta de debito/.test(n) ? "Tarjeta débito" : /ahorros|cta|cuenta/.test(n) ? "Cuenta" : "";
    return { u4: u4, medio: tipoM };
  }

  // ---------- Bre-B (pagos inmediatos del Banco de la República) ----------
  // Avisos típicos: "Enviaste por llave", "Pagaste con llave a [comercio]", "Recibiste por llave desde [entidad]",
  // "Recibiste $X de MAR*** GOM***", pagos con QR Bre-B. Los nombres llegan enmascarados.
  function esBreB(n) { return /\bbre\s?-?\s?b\b|\b(?:por|con|a la|tu|la|transferencia|transferencia por|pago por|pago con) llave\b|\bllave\s+(?:\d|@)|\bllave bre/.test(n); }
  function comercioBreB(t, tipoMov) {
    var m;
    if ((m = /([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ]{0,20}\*{2,}(?:\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ]{0,20}\*{2,}){0,3})/.exec(t))) return m[1];
    if ((m = /(@[A-Za-z0-9_.\-]{2,30})/.exec(t))) return m[1];
    if ((m = /\b(?:a la |la |tu )?llave\s+(?:bre-?b\s+)?([0-9][0-9\s]{5,14}[0-9]|[A-Za-z0-9._\-]*\d[A-Za-z0-9._\-]*)/i.exec(t))) return "Llave " + m[1].replace(/\s+/g, "");
    if (tipoMov === "ingreso" && (m = /\bdesde\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ ]{1,30}?)(?=\s+(?:por|el|\$)|[.,;]|$)/.exec(t))) return "Bre-B desde " + m[1].trim();
    return "";
  }
  // Mensajes falsos: anuncian una plata recibida o pendiente y piden entrar a un enlace para confirmarla.
  // Bre-B y los bancos nunca piden confirmar un pago por un enlace. Los dominios oficiales no cuentan.
  var DOMINIOS_OFICIALES = ["bancolombia.com", "nequi.com.co", "davivienda.com", "daviplata.com", "bbva.com.co", "bancodebogota.com", "bancodeoccidente.com.co",
    "avvillas.com.co", "bancopopular.com.co", "nu.com.co", "scotiabankcolpatria.com", "bancocajasocial.com", "itau.co", "bancofalabella.com.co", "lulobank.com",
    "banrep.gov.co", "rappipay.co", "movii.com.co", "dale.com.co", "uala.com.co", "bancoagrario.gov.co", "bancamia.com.co", "mibanco.com.co"];
  function esEstafa(n) {
    // Enlace fuerte: con http, www, un acortador o una ruta. Enlace débil: un dominio suelto (también puede ser un comercio, como amazon.com).
    var enlaces = n.match(/https?:\/\/[^\s]+|www\.[^\s]+|\b(?:bit\.ly|tinyurl\.com|cutt\.ly|t\.co|is\.gd|acortar\.link|rebrand\.ly)\/\S*|\b[a-z0-9][a-z0-9\-]*(?:\.[a-z0-9\-]+)*\.(?:co|com|net|org|xyz|info|link|online|site|top|lat|app|me|click|shop)(?:\/\S*)?(?=[\s.,)]|$)/g) || [];
    var fuerte = false, debil = false;
    enlaces.forEach(function (u) {
      var host = u.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[\/?#]/)[0].replace(/[.,)]+$/, "");
      if (DOMINIOS_OFICIALES.some(function (d) { return host === d || host.slice(-(d.length + 1)) === "." + d; })) return;
      // Un dominio que se hace pasar por un banco (bancolombia-seguro.com, nequi-pagos.co) cuenta como enlace fuerte.
      var imita = /bancolombia|nequi|davivienda|daviplata|bbva|bogota|occidente|avvillas|popular|colpatria|cajasocial|falabella|bre-?b|banrep|banco/.test(host);
      if (imita || /^https?:|^www\.|\//.test(u) || /^(?:bit\.ly|tinyurl|cutt\.ly|t\.co|is\.gd|acortar|rebrand)/.test(host)) fuerte = true; else debil = true;
    });
    if (!fuerte && !debil) return false;
    var pideFuerte = /pendiente|confirm(?:a|e|ar|alo|ala)\b|reclam|haz clic|has clic|da clic|dale clic|antes de|\d+\s?horas|bloquead|suspendid|urgente|vence hoy/;
    var plataFuerte = /bre\s?-?\s?b|recibiste una|transferencia (?:pendiente|por recibir|a tu favor)|giro|reembolso|devolucion|pago pendiente/;
    if (fuerte) return (pideFuerte.test(n) || /ingresa|entra (?:a|al|en)|activa|valida|verifica|actualiza|acepta/.test(n)) && (plataFuerte.test(n) || /transferencia|pago|plata|dinero|\$\s?\d/.test(n));
    return pideFuerte.test(n) && plataFuerte.test(n);
  }

  // Código de seguridad (OTP): un número suelto de 4 a 8 cifras cerca de "código", "clave", "OTP" o "token".
  // No cuentan los montos ($50.000), los últimos números de una tarjeta o cuenta (*1234, "terminada en 1234"),
  // las fechas ni los teléfonos.
  function esCodigoSeguridad(n) {
    var re = /(^|[^\d$*.,\/:#])(\d{4,8})(?![\d]|[.,:\/]\d|\s?(?:pesos|cop)\b)/g, m;
    while ((m = re.exec(n))) {
      var ini = m.index + m[1].length, antes = n.slice(Math.max(0, ini - 60), ini), despues = n.slice(ini + m[2].length, ini + m[2].length + 30);
      if (/termina\w*\s(?:en\s)?$|(?:tarjeta|cuenta|cta|nro|no\.)\s*$/.test(antes)) continue;
      if (/\b(?:codigo|clave|otp|token|contrasena|pin)\b/.test(antes) || /^\W{0,3}(?:es|sera)\s(?:tu|su)\s(?:codigo|clave|otp|token)\b/.test(despues)) return true;
    }
    return false;
  }
  // ---------- Lector principal ----------
  function leerAviso(texto, opts) {
    opts = opts || {};
    var t = limpiar(texto).slice(0, 4000), n = normal(t);
    var res = { ok: false, tipo: "", monto: 0, comercio: "", fecha: "", hora: "", banco: banco(n, opts.remitente), medio: "", u4: "", confianza: "baja", texto: t.slice(0, 600) };
    if (esEstafa(n)) { res.motivo = "estafa"; res.texto = ""; return res; }
    if (esCodigoSeguridad(n) || (/codigo de (?:verificacion|seguridad)|clave (?:dinamica|temporal)|no compartas|otp\b|tu codigo es/.test(n) && !/compra|pago|transfer/.test(n))) { res.motivo = "codigo"; res.texto = ""; return res; }
    // Un recordatorio de factura ("tu factura vence el 25") no es un movimiento: todavía no se ha pagado
    if (/\b(vence|vencimiento|fecha limite|fecha de pago|recuerda pagar|ya esta disponible|esta disponible tu factura)\b/.test(n) && !/\b(pagaste|pago exitoso|pago realizado|pago aprobado|se debito|debitamos|compraste|compra)\b/.test(n)) { res.motivo = "factura"; return res; }
    // Frase principal: la que tiene el monto y una palabra de movimiento
    var frases = t.split(/(?<=[.!])\s+|\n/), elegida = "";
    for (var i = 0; i < frases.length; i++) { var fn = normal(frases[i]); if (montos(frases[i]).length && tipo(fn)) { elegida = frases[i]; break; } }
    if (!elegida) for (var j = 0; j < frases.length; j++) if (montos(frases[j]).length) { elegida = frases[j]; break; }
    if (!elegida) { res.motivo = "sin-monto"; return res; }
    var en = normal(elegida), ms = montos(elegida);
    res.tipo = tipo(en) || tipo(n) || "gasto";
    res.monto = ms[0].v;
    res.comercio = res.tipo === "propio" ? (comercio(elegida.slice(ms[0].i + 1)) || "Entre tus cuentas") : res.tipo === "pagoTarjeta" ? "Pago de tarjeta de crédito" : res.tipo === "retiro" && !/\ben\s/.test(elegida) ? "Retiro" : (comercio(elegida.slice(ms[0].i + 1)) || comercio(elegida));
    if (/recarg/i.test(elegida) && res.comercio && !/^recarga/i.test(res.comercio)) res.comercio = "Recarga " + res.comercio.replace(/\s*\d{7,}$/, "");
    res.fecha = fechaDe(t, opts.hoy); res.hora = horaDe(t);
    var md = medio(n); res.medio = md.medio; res.u4 = md.u4;
    if (md.medio === "Bre-B" && res.tipo !== "propio") { var cb = comercioBreB(elegida, res.tipo) || comercioBreB(t, res.tipo); if (cb) res.comercio = cb; }
    else if (res.tipo !== "propio" && /[A-ZÁÉÍÓÚÑ]{2,}\*{2,}/.test(elegida)) res.comercio = comercioBreB(elegida, res.tipo) || res.comercio;   // nombre enmascarado: "ANA*** RUI***"
    res.ok = true;
    res.confianza = tipo(en) && res.comercio ? "alta" : tipo(en) ? "media" : "baja";
    return res;
  }

  // ---------- Facturas electrónicas DIAN (AttachedDocument con la factura UBL 2.1 adentro) ----------
  function tag(xml, nombre, desde) {
    var re = new RegExp("<(?:\\w+:)?" + nombre + "\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?" + nombre + ">", "i");
    var m = re.exec(desde == null ? xml : xml.slice(desde));
    return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
  }
  function bloque(xml, nombre) {
    var re = new RegExp("<(?:\\w+:)?" + nombre + "\\b[\\s\\S]*?</(?:\\w+:)?" + nombre + ">", "i");
    var m = re.exec(xml); return m ? m[0] : "";
  }
  function desescapar(x) { return x.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&"); }
  function leerFactura(xml, asunto) {
    var x = String(xml || "");
    // La factura viaja dentro del AttachedDocument, en un CDATA o escapada
    var interna = /<(?:\w+:)?(Invoice|CreditNote|DebitNote)\b/.exec(x) ? x : "";
    if (!interna) {
      var desc = /<!\[CDATA\[([\s\S]*?<(?:\w+:)?(?:Invoice|CreditNote|DebitNote)\b[\s\S]*?)\]\]>/.exec(x);
      if (desc) interna = desc[1]; else if (/&lt;(?:\w+:)?(?:Invoice|CreditNote)/.test(x)) interna = desescapar(x);
    }
    var cuerpo = interna || x;
    var raiz = /<(?:\w+:)?(Invoice|CreditNote|DebitNote)\b/.exec(cuerpo);
    if (!raiz) return { ok: false, motivo: "no-factura" };
    var i0 = raiz.index;
    var prov = bloque(cuerpo.slice(i0), "AccountingSupplierParty");
    var nombre = tag(prov, "RegistrationName") || tag(prov, "Name");
    var nit = tag(prov, "CompanyID");
    var comercial = (asunto || "").split(";")[4] ? (asunto || "").split(";")[4].trim() : "";
    var total = parseFloat(tag(bloque(cuerpo.slice(i0), "LegalMonetaryTotal"), "PayableAmount")) || 0;
    var items = [], re = /<(?:\w+:)?(?:InvoiceLine|CreditNoteLine)\b[\s\S]*?<\/(?:\w+:)?(?:InvoiceLine|CreditNoteLine)>/g, m, k = 0;
    while ((m = re.exec(cuerpo)) && k++ < 6) { var d = tag(m[0], "Description"); if (d) items.push(d.slice(0, 60)); }
    var esNota = raiz[1] === "CreditNote";
    return {
      ok: total > 0, factura: true, tipo: esNota ? "ingreso" : "gasto", nota: esNota,
      monto: Math.round(total), comercio: (comercial || nombre || "").slice(0, 60), razonSocial: nombre, nit: nit.replace(/[^\d-]/g, ""),
      fecha: tag(cuerpo.slice(i0), "IssueDate"), hora: (tag(cuerpo.slice(i0), "IssueTime") || "").slice(0, 5), numero: tag(cuerpo.slice(i0), "ID"),
      items: items, banco: "", confianza: total > 0 && nombre ? "alta" : "media", texto: (nombre + " · " + items.join(", ")).slice(0, 600)
    };
  }

  // ---------- Categorías ----------
  var COMERCIOS = [
    ["compras", /\b(falabella|mercado ?libre|amazon(?! prime)|temu|shein|aliexpress|zara|h ?& ?m|arturo calle|tennis|koaj|studio f|alkosto|ktronix|homecenter|panamericana|dafiti|linio|adidas|nike|bershka|pull ?& ?bear|totto|flamingo|mac center|ishop|samsung|xiaomi|ferreteria|jugueteria|miniso)\b/],
    ["alimentacion", /\b(exito|carulla|d1\b|tiendas d1|ara\b|tiendas ara|olimpica|jumbo|metro\b|makro|surtimax|super ?inter|colsubsidio mercado|oxxo|justo ?& ?bueno|isimo|megatiendas|pricesmart|euro supermercado|la 14|zapatoca|merkepaisa|mercado|supermercado|fruver|panaderia|carniceria|minimercado|tienda de barrio)\b/],
    ["ocio", /\b(rappi(?!pay)|ifood|didi food|domicilio|restaurante|crepes|frisby|kfc|mc ?donald|burger|el corral|juan valdez|tostao|starbucks|oma\b|presto|cine ?colombia|cinemark|procinal|royal films|bar\b|discoteca|pizza|domino|papa john|subway|wok|sushi|andres carne|hamburguesa|helado|cafe|cafeteria|bolera|parque|concierto|tuboleta|eticket)\b/],
    ["transporte", /\b(uber|didi(?! food)|cabify|indriver|in driver|picap|beat|taxi|terpel|primax|texaco|biomax|esso|mobil|petrobras|gasolina|combustible|eds\b|estacion de servicio|peaje|transmilenio|tu ?llave|sitp|metro de medellin|civica|mio\b|metrolinea|parqueadero|parking|avianca|latam|wingo|jetsmart|clic air|satena|bolivariano|expreso brasilia|copetran|soat|tecnomecanica|lavadero)\b/],
    ["servicios", /\b(epm|codensa|enel|vanti|gas natural|gases de|acueducto|emcali|air-?e|celsia|afinia|essa|electricaribe|aguas de|triple a|claro|movistar|tigo|etb|wom|une\b|directv|hughesnet|internet|energia|servicios publicos)\b/],
    ["salud", /\b(farmatodo|cruz verde|la rebaja|drogueria|droguerias|colsubsidio drog|locatel|farmacia|pasteur|eps\b|sura\b|sanitas|colsanitas|compensar|coomeva|clinica|hospital|odontolog|laboratorio|optica|medico|consultorio|salud total|nueva eps)\b/],
    ["suscripciones", /\b(netflix|spotify|disney|hbo|max\.com|prime video|amazon prime|youtube|apple\.com|itunes|icloud|google one|google storage|google play|chatgpt|openai|claude|anthropic|paramount|crunchyroll|deezer|xbox|playstation|nintendo|microsoft|office 365|adobe|canva|duolingo|vix|star\+|mubi|smart ?fit|bodytech|gimnasio|gym)\b/],
    ["educacion", /\b(universidad|colegio|jardin infantil|platzi|coursera|udemy|icetex|libreria|sena\b|instituto|matricula|pension escolar|escuela|academia)\b/],
    ["vivienda", /\b(arriendo|arrendamiento|administracion|conjunto|inmobiliaria|propiedad horizontal|hipoteca)\b/],
    ["deudas", /\b(cuota|credito|prestamo|leasing|addi|sistecredito|meddipay|cobranza)\b/],
    ["ahorro", /\b(ahorro|cdt|fiducuenta|fiducia|inversion|tyba|trii|bolsillo|meta de ahorro|colchon|pension voluntaria|fondo)\b/]
  ];
  function sugerirCategoria(item, reglas) {
    var c = normal(item.comercio || ""), r = reglas || {};
    if (c && r[c]) return { cat: r[c], por: "aprendida" };
    var base = normal([item.comercio, item.razonSocial, (item.items || []).join(" ")].join(" "));
    for (var i = 0; i < COMERCIOS.length; i++) if (COMERCIOS[i][1].test(base)) return { cat: COMERCIOS[i][0], por: "lista" };
    if (item.tipo === "retiro") return { cat: "", por: "retiro" };
    return { cat: "otros", por: "" };
  }
  function bonito(t) {
    t = String(t || "").trim();
    if (!t) return "";
    if (t === t.toUpperCase()) t = t.toLowerCase().replace(/(^|[\s\-/])([a-záéíóúñ])/g, function (m, a, b) { return a + b.toUpperCase(); });
    return t.replace(/\s+(S\.?a\.?s?\.?|Ltda\.?)$/i, function (m) { return " " + m.trim().toUpperCase().replace(/\./g, ""); });
  }
  function huella(item) { return [item.monto, item.fecha || "", normal(item.comercio || "").slice(0, 20)].join("|"); }

  root.FinLector = { esCodigoSeguridad: esCodigoSeguridad, esEstafa: esEstafa, esBreB: esBreB, leerAviso: leerAviso, leerFactura: leerFactura, sugerirCategoria: sugerirCategoria, bonito: bonito, normal: normal, parseMonto: parseMonto, huella: huella };
})(typeof window !== "undefined" ? window : globalThis);
