  // ===================== Precios de referencia del DANE (SIPSA) =====================
  // Una tabla pública que GitHub Actions baja del DANE cada día (herramientas/sipsa.mjs) y la app pide con GET a
  // /api/precios. La petición no lleva nada de la persona; la comparación con sus compras se hace aquí.
  // Se guarda en el dispositivo y se renueva cada 3 días, así funciona sin internet.
  var SIPSA_KEY = "fintelligente-sipsa", SIPSA = { d: null, at: 0, pidiendo: null };
  try { var sp0 = JSON.parse(localStorage.getItem(SIPSA_KEY) || "null"); if (sp0 && sp0.d && Array.isArray(sp0.d.productos)) { SIPSA.d = sp0.d; SIPSA.at = sp0.at || 0; } } catch (e) {}
  function sipsaCargar(forzar) {
    if (SIPSA.pidiendo) return SIPSA.pidiendo;
    if (SIPSA.d && !forzar && Date.now() - SIPSA.at < 3 * 864e5) return Promise.resolve(SIPSA.d);
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
    if (!SIPSA.d) return null;
    var pal = t.split(" ").filter(function (x) { return x.length >= 4 && HI_PARO.indexOf(" " + x + " ") < 0; });
    for (var i = 0; i < pal.length; i++) { var l = sipsaBuscar(pal[i]); if (l.length) return { k: canClave(pal[i]), n: pal[i], dane: true }; }
    return null;
  }
  function sipsaFecha() { var f = SIPSA.d && SIPSA.d.semana; return f ? "la semana del " + (+f.slice(8)) + " de " + MESES[+f.slice(5, 7) - 1] : ""; }
  function sipsaTendencia(v) { return v == null || Math.abs(v) < 3 ? { c: "", t: "estable" } : v > 0 ? { c: "sube", t: "subió " + pctf(v / 100) } : { c: "baja", t: "bajó " + pctf(-v / 100) }; }
  // Párrafo para Pregúntale: referencia en la ciudad de la persona (si la eligió) o en el país, y si sube o baja.
  function sipsaParrafo(palabra) {
    var l = sipsaBuscar(palabra); if (!l.length) return "";
    var p = l[0], ciudad = state.prefs.ciudad || "", enC = ciudad && p.c && p.c[ciudad], tend = sipsaTendencia(p.v);
    var h = "<p>Referencia del DANE para " + sipsaFecha() + " (precio mayorista por kilo): <b>" + esc(p.n.toLowerCase()) + "</b> a " + canPrecio(enC ? enC[0] : p.g) + (enC ? " en " + esc(ciudad) : " en el país") +
      (tend.c ? ", " + tend.t + " frente a la semana anterior" : ", estable frente a la semana anterior") + ".";
    var mejor = enC ? [enC[1], enC[2]] : p.b;
    if (mejor && mejor[0]) h += " Donde más barata estuvo" + (enC ? " en tu ciudad" : "") + ": " + esc(mejor[0]) + " (" + canPrecio(mejor[1]) + ").";
    return h + " En la tienda suele costar más; sirve para saber si está cara o barata.</p>";
  }

