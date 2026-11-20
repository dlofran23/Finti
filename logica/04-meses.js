  // ===================== Meses =====================
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  // Abreviaturas de la RAE, con su punto.
  var MESES_C = ["en.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ag.", "sept.", "oct.", "nov.", "dic."];
  function keyOf(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2); }
  function nowKey() { return keyOf(new Date()); }
  function validKey(k) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(k || ""); }
  function parseKey(k) { return { y: +k.slice(0, 4), m: +k.slice(5, 7) }; }
  function addMonths(k, n) { var p = parseKey(k); return keyOf(new Date(p.y, p.m - 1 + n, 1)); }
  function monthsBetween(a, b) { var p = parseKey(a), q = parseKey(b); return (q.y - p.y) * 12 + (q.m - p.m); }
  function monthLabel(k) { var p = parseKey(k); var s = MESES[p.m - 1] + " de " + p.y; return s.charAt(0).toUpperCase() + s.slice(1); }
  function monthShort(k) { var p = parseKey(k); return MESES_C[p.m - 1] + " " + String(p.y).slice(2); }
  function parsePeriodo(txt) {
    var m = /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\D*(\d{4})/i.exec(txt || "");
    if (!m) return null;
    var name = m[1].toLowerCase() === "setiembre" ? "septiembre" : m[1].toLowerCase();
    return m[2] + "-" + ("0" + (MESES.indexOf(name) + 1)).slice(-2);
  }

