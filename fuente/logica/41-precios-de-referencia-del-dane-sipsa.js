  // ===================== Precios de referencia del DANE (SIPSA) =====================
  // Una tabla pública que GitHub Actions baja del DANE cada día de mercado (boletín diario, herramientas/sipsa-diario.mjs)
  // y la app pide con GET a /api/precios. La petición no lleva nada de la persona; la comparación con sus compras se hace
  // aquí. Se guarda en el dispositivo (sirve sin internet) y se renueva cada 2 horas si es del día (3 días si es semanal).
  var SIPSA_KEY = "fintelligente-sipsa", SIPSA = { d: null, at: 0, pidiendo: null };
  try { var sp0 = JSON.parse(localStorage.getItem(SIPSA_KEY) || "null"); if (sp0 && sp0.d && Array.isArray(sp0.d.productos)) { SIPSA.d = sp0.d; SIPSA.at = sp0.at || 0; } } catch (e) {}
  function sipsaCargar(forzar) {
    if (SIPSA.pidiendo) return SIPSA.pidiendo;
    if (SIPSA.d && !forzar && Date.now() - SIPSA.at < (sipsaDiario() ? 2 * 36e5 : 3 * 864e5)) return Promise.resolve(SIPSA.d);
    if (!WEB || (typeof navigator !== "undefined" && navigator.onLine === false)) return Promise.resolve(SIPSA.d);
    SIPSA.pidiendo = api("/api/precios").then(function (j) {
      if (j._status === 200 && Array.isArray(j.productos)) { delete j._status; SIPSA.d = j; SIPSA.at = Date.now(); try { localStorage.setItem(SIPSA_KEY, JSON.stringify({ at: SIPSA.at, d: j })); } catch (e) {} }
      return SIPSA.d;
    }).catch(function () { return SIPSA.d; }).then(function (d) { SIPSA.pidiendo = null; return d; });
    return SIPSA.pidiendo;
  }
  // Las variedades del DANE que corresponden a una palabra: "papa" → Papa capira, Papa criolla, Papa R-12...
  function sipsaBuscar(palabra) {
    if (!SIPSA.d) return [];
    var w = canSingular(prNorm(palabra).split(" ")[0] || ""); if (w.length < 3) return [];
    return SIPSA.d.productos.filter(function (p) { var a = canSingular(prNorm(p.n).split(" ")[0] || ""); return a === w; })
      .sort(function (a, b) { return Object.keys(b.c || {}).length - Object.keys(a.c || {}).length || a.n.length - b.n.length; });
  }
  // Un producto del DANE nombrado en la pregunta ("¿cómo está el tomate?") aunque la persona no lo haya comprado
  function sipsaProducto(t) {
    if (!SIPSA.d && !GENTE.d) return null;
    var pal = t.split(" ").filter(function (x) { return x.length >= 4 && HI_PARO.indexOf(" " + x + " ") < 0; });
    for (var i = 0; i < pal.length; i++) { var l = sipsaBuscar(pal[i]); if (l.length || genteFilas(canClave(pal[i]), state.prefs.ciudad)) return { k: canClave(pal[i]), n: pal[i], dane: true }; }
    return null;
  }
  function sipsaDiario() { return !!(SIPSA.d && SIPSA.d.tipo === "diario" && SIPSA.d.dia); }
  // "hoy", "ayer", "el 25 de noviembre" o, con datos semanales, "la semana del 9 de noviembre"
  function sipsaFecha() {
    if (sipsaDiario()) return diaTexto(SIPSA.d.dia);
    var w = SIPSA.d && SIPSA.d.semana; return w ? "la semana del " + (+w.slice(8)) + " de " + MESES[+w.slice(5, 7) - 1] : "";
  }
  // "de hoy", "de ayer", "del 25 de noviembre", "de la semana del 9 de noviembre"
  function sipsaDe() { var f = sipsaFecha(); return f ? (f.slice(0, 3) === "el " ? "del " + f.slice(3) : "de " + f) : ""; }
  function sipsaAntes() { return sipsaDiario() ? "al día de mercado anterior" : "a la semana anterior"; }
  // Variación del producto: la de la ciudad elegida si el DANE la trae (boletín diario), si no la nacional
  function sipsaVar(p, ciudad) { var e = ciudad && p.c && p.c[ciudad]; return e && e.length > 3 ? e[3] : p.v; }
  function sipsaTendencia(v) { return v == null || Math.abs(v) < 3 ? { c: "", t: "estable" } : v > 0 ? { c: "sube", t: "subió " + pctf(v / 100) } : { c: "baja", t: "bajó " + pctf(-v / 100) }; }
  // Párrafo para Pregúntale: referencia en la ciudad de la persona (si la eligió) o en el país, y si sube o baja.
  function sipsaParrafo(palabra) {
    var l = sipsaBuscar(palabra), gente = genteFrase(canClave(palabra), state.prefs.ciudad || "");
    if (!l.length) return gente ? "<p>" + gente + "</p>" : "";
    var p = l[0], ciudad = state.prefs.ciudad || "", enC = ciudad && p.c && p.c[ciudad], tend = sipsaTendencia(enC ? sipsaVar(p, ciudad) : p.v);
    var h = "<p>Referencia del DANE " + sipsaDe() + " (precio mayorista por kilo): <b>" + esc(p.n.charAt(0).toLowerCase() + p.n.slice(1)) + "</b> a " + canPrecio(enC ? enC[0] : p.g) + (enC ? " en " + esc(ciudad) : " en el país") +
      ", " + (tend.c ? tend.t : "estable") + " frente " + sipsaAntes() + ".";
    // Con el boletín diario hay una central por ciudad: lo útil es saber dónde está más barata en el país
    var mejor = enC && !sipsaDiario() ? [enC[1], enC[2]] : p.b;
    if (mejor && mejor[0]) h += " Donde más barata " + (sipsaDiario() ? "está" : "estuvo") + (enC && !sipsaDiario() ? " en tu ciudad" : " en el país") + ": " + esc(mejor[0]) + " (" + canPrecio(mejor[1]) + ").";
    return h + " En la tienda suele costar más; sirve para saber si está cara o barata." + (gente ? " " + gente : "") + "</p>";
  }


  // ===================== Precios de la gente =====================
  // Lo que pagó la gente en cada cadena de su ciudad (GET /api/precios-gente: público, no lleva nada tuyo). Con permiso
  // (state.prefs.aportar === "si"), la app manda de forma anónima el precio por kilo, litro o unidad de lo que la
  // persona compró en una cadena: el nombre corto del producto (canClave, máximo dos palabras), la cadena (de una lista
  // cerrada), la ciudad y el día. Ni nombre, ni cuenta, ni el total. Sin cookies (credentials: "omit"). Un producto
  // solo se muestra cuando lo reportan al menos 3 personas distintas (lo decide el servidor).
  var GENTE_KEY = "fintelligente-gente", GENTE_ENV = "fintelligente-gente-enviados", GENTE = { d: null, at: 0, pidiendo: null, re: null };
  try { var g0 = JSON.parse(localStorage.getItem(GENTE_KEY) || "null"); if (g0 && g0.d && g0.d.lista) { GENTE.d = g0.d; GENTE.at = g0.at || 0; } } catch (e) {}
  function genteCargar(forzar) {
    if (GENTE.pidiendo) return GENTE.pidiendo;
    if (GENTE.d && !forzar && Date.now() - GENTE.at < 3 * 36e5) return Promise.resolve(GENTE.d);
    if (!WEB || (typeof navigator !== "undefined" && navigator.onLine === false)) return Promise.resolve(GENTE.d);
    GENTE.pidiendo = api("/api/precios-gente", { credentials: "omit" }).then(function (j) {
      if (j._status === 200 && j.lista) { delete j._status; GENTE.d = j; GENTE.at = Date.now(); GENTE.re = null; try { localStorage.setItem(GENTE_KEY, JSON.stringify({ at: GENTE.at, d: j })); } catch (e) {} }
      return GENTE.d;
    }).catch(function () { return GENTE.d; }).then(function (d) { GENTE.pidiendo = null; return d; });
    return GENTE.pidiendo;
  }
  function genteCiudades() { return (GENTE.d && GENTE.d.lista && GENTE.d.lista.ciudades) || []; }
  // Nombre de producto que acepta el servidor (como lo arma canClave: una o dos palabras, sin números sueltos)
  function genteProducto(k) { return typeof k === "string" && k.length <= 40 && /^[a-zñ][a-z0-9ñ]{1,19}( [a-z0-9ñ]{2,20})?$/.test(k) ? k : null; }
  // Claves donde buscar un producto: la exacta y, si no hay datos, la primera palabra ("papa pastusa" → "papa")
  function genteClaves(k) { k = genteProducto(k); if (!k) return []; var w = k.split(" ")[0]; return w !== k && genteProducto(w) ? [k, w] : [k]; }
  function genteCadena(lugar) {
    if (!GENTE.d || !lugar) return null;
    if (!GENTE.re) GENTE.re = GENTE.d.lista.cadenas.map(function (c) { try { return { id: c.id, re: new RegExp(c.patron) }; } catch (e) { return null; } }).filter(Boolean);
    var t = prNorm(lugar); for (var i = 0; i < GENTE.re.length; i++) if (GENTE.re[i].re.test(t)) return GENTE.re[i].id;
    return null;
  }
  // Precios de un producto en las cadenas: los de las tiendas en línea (GitHub los baja cada día, GENTE.d.linea) y lo
  // que pagó la gente en la ciudad. { u, filas: [{ c: cadena, v: precio, n, en: "linea" | "gente", ej }] }, de menor a mayor.
  function genteFilas(k, ciudad) {
    if (!GENTE.d) return null;
    var ks = genteClaves(k), c = ciudad && GENTE.d.ciudades && GENTE.d.ciudades[ciudad], L = GENTE.d.linea && GENTE.d.linea.productos, us = ["kg", "l", "u"];
    for (var j = 0; j < ks.length; j++) { k = ks[j];
    for (var i = 0; i < us.length; i++) {
      var g = c && c[k + "|" + us[i]], l = L && L[k + "|" + us[i]]; if (!g && !l) continue;
      var filas = (g || []).map(function (f) { return { c: f[0], v: f[1], n: f[2], en: "gente" }; })
        .concat((l || []).map(function (f) { return { c: f[0], v: f[1], n: f[2], en: "linea", ej: f[3] }; }));
      return { u: us[i], filas: filas.sort(function (a, b) { return a.v - b.v; }) };
    } }
    return null;
  }
  // Búsqueda en vivo en las tiendas en línea, para cualquier producto: a Finti solo va el nombre del producto, sin
  // cookies; el servidor consulta las cadenas que lo permiten y guarda la respuesta 12 horas. Aquí se recuerda mientras
  // la app está abierta.
  var BUSCADOS = {};
  function buscarLinea(q) {
    var k = prNorm(q).slice(0, 40); if (k.length < 2 || !WEB) return Promise.resolve(null);
    if (BUSCADOS[k]) return BUSCADOS[k];
    BUSCADOS[k] = api("/api/precios-buscar?q=" + encodeURIComponent(k), { credentials: "omit" }).then(function (j) {
      if (j._status !== 200) { delete BUSCADOS[k]; return null; } return j;
    }, function () { delete BUSCADOS[k]; return null; });
    return BUSCADOS[k];
  }
  // "hoy", "ayer" o "el 25 de noviembre"
  function diaTexto(f) {
    var ay = new Date(); ay.setDate(ay.getDate() - 1);
    return f === hoyStr() ? "hoy" : f === hoyStr(ay) ? "ayer" : "el " + (+f.slice(8)) + " de " + MESES[+f.slice(5, 7) - 1];
  }
  // De dónde sale cada precio: "5 personas en Bogotá" o "tienda en línea, hoy"
  function genteOrigen(f, ciudad) { return f.en === "gente" ? plural(f.n, "persona") + " en " + esc(ciudad) : "tienda en línea, " + diaTexto((GENTE.d.linea && GENTE.d.linea.dia) || hoyStr()); }
  function genteUnidad(u) { return u === "kg" ? " el kilo" : u === "l" ? " el litro" : " la unidad"; }
  function genteEnviados() { try { return JSON.parse(localStorage.getItem(GENTE_ENV) || "{}") || {}; } catch (e) { return {}; } }
  // Compras de los últimos 14 días en cadenas, con producto de la lista y que no se hayan mandado
  function genteAportes() {
    var ciudad = state.prefs.ciudad || "", enviados = genteEnviados(), out = [];
    if (genteCiudades().indexOf(ciudad) < 0) return [];
    canRegistros(14).forEach(function (r) {
      var p = genteProducto(r.k), c = genteCadena(r.lugar), id = r.id + "|" + r.k; if (!p || !c || enviados[id]) return;
      var u = r.unidad, v = r.pu;
      if (u === "lb") { u = "kg"; v = r.pu * 2; } else if (u === "g") { u = "kg"; v = r.pu * 1000; }
      if (["kg", "l", "u"].indexOf(u) < 0 || !(v > 0)) return;
      out.push({ id: id, a: { p: p, c: c, u: u, v: Math.round(v), d: r.f } });
    });
    return out.slice(0, 40);
  }
  var genteEnviando = false;
  function genteEnviar(ya) {
    if (state.prefs.aportar !== "si" || !WEB || genteEnviando) return Promise.resolve(0);
    var ult = +(localStorage.getItem(GENTE_ENV + "-at") || 0);
    if (!ya && Date.now() - ult < 6 * 36e5) return Promise.resolve(0);
    genteEnviando = true;
    return genteCargar().then(function () {
      var l = genteAportes(); if (!l.length) return 0;
      return api("/api/precios-gente", { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ciudad: state.prefs.ciudad, aportes: l.map(function (x) { return x.a; }) }) }).then(function (j) {
        if (j._status !== 200 && j._status !== 400) return 0;   // 400: nada válido; no se vuelve a intentar con lo mismo
        var env = genteEnviados(), hoy = hoyStr(), viejo = hoyStr(new Date(Date.now() - 30 * 864e5));
        Object.keys(env).forEach(function (k) { if (env[k] < viejo) delete env[k]; });
        l.forEach(function (x) { env[x.id] = hoy; });
        try { localStorage.setItem(GENTE_ENV, JSON.stringify(env)); localStorage.setItem(GENTE_ENV + "-at", String(Date.now())); } catch (e) {}
        return l.length;
      });
    }).catch(function () { return 0; }).then(function (n) { genteEnviando = false; return n; });
  }
  setTimeout(function () { genteEnviar(); }, 8000);   // al abrir la app, si la persona aceptó (como mucho cada 6 horas)
  // "En las cadenas, lo más barato es D1: $ 3.900 el kilo (5 personas en Bogotá); en Olímpica, $ 4.200."
  function genteFrase(k, ciudad) {
    var g = genteFilas(k, ciudad); if (!g) return "";
    var f = g.filas[0], s = g.filas[1];
    return "En las cadenas, lo más barato es " + esc(f.c) + ": " + canPrecio(f.v) + genteUnidad(g.u) + " (" + genteOrigen(f, ciudad) + ")" + (s ? "; en " + esc(s.c) + ", " + canPrecio(s.v) : "") + ".";
  }
