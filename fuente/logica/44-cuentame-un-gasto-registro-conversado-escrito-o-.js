  // ===================== Cuéntame un gasto: registro conversado, escrito o dicho =====================
  // Entiende frases como "18 mil en almuerzo", "pagué un taxi de doce mil" o "me pagaron 50 mil". Todo se interpreta
  // aquí. La voz solo se usa si se reconoce dentro del dispositivo: en la app de Android (reconocimiento del teléfono)
  // o en un navegador que tenga el español descargado (processLocally). Nunca se manda audio a un servidor.
  var CH = null, CH_ULT = null;
  var CH_NUM = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
    dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
    veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100,
    doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
    setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900 };
  // "veinte mil" → "20000"; "dos millones quinientos mil" → "2500000". Un "un" suelto ("un taxi") no se toca.
  function chNumeros(t) {
    var w = t.split(" "), out = [], i = 0;
    while (i < w.length) {
      var j = i, total = 0, cur = 0, usado = false, mult = false;
      while (j < w.length) {
        var x = w[j];
        if (CH_NUM[x] != null) { cur += CH_NUM[x]; usado = true; }
        else if (/^\d{1,3}$/.test(x) && j === i && /^mil$/.test(w[j + 1] || "")) { cur += +x; usado = true; }
        else if (/^\d{1,3}$/.test(x) && mult && cur === 0 && j > i) { cur += +x; }
        else if (/^mil$/.test(x) && usado) { total += (cur || 1) * 1000; cur = 0; mult = true; }
        else if (/^mil$/.test(x) && !usado && j === i && !/^[\d.,]+$/.test(out[out.length - 1] || "")) { total += 1000; usado = true; mult = true; }
        else if (/^millon(es)?$/.test(x) && usado) { total = (total + (cur || 1)) * 1e6; cur = 0; mult = true; }
        else if (x === "y" && usado && j + 1 < w.length && CH_NUM[w[j + 1]] != null) { /* treinta y cinco */ }
        else break;
        j++;
      }
      var solo = j - i === 1 && /^(un|uno|una)$/.test(w[i]);
      if (usado && !solo && (mult || j - i > 1 || CH_NUM[w[i]] > 1)) { out.push(String(total + cur)); i = j; }
      else { out.push(w[i]); i++; }
    }
    return out.join(" ");
  }
  // Vocabulario para reconocer la categoría en lo que la persona escribe o dice. En minúsculas y sin tildes; cada palabra
  // vale también en plural (empanada → empanadas). Gana la coincidencia más larga ("recarga tullave" le gana a "recarga").
  var CH_VOCAB = {
    alimentacion: "mercado|supermercado|tienda|tienda de barrio|minimercado|fruver|plaza de mercado|galeria|carniceria|panaderia|pescaderia|famia|"
      + "d1|ara|exito|carulla|olimpica|jumbo|makro|pricesmart|isimo|oxxo|justo y bueno|surtimax|super inter|euro supermercado|zapatoca|colsubsidio mercado|"
      + "comida|almuerzo|corrientazo|ejecutivo|menu del dia|desayuno|cena|onces|merienda|lonchera|almorce|almorzamos|desayune|desayunamos|cene|cenamos|comi|comimos|"
      + "tinto|cafe|aromatica|pan|pan de bono|pandebono|almojabana|bunuelo|arepa|empanada|pastel de pollo|tamal|lechona|"
      + "huevo|leche|queso|cuajada|mantequilla|yogurt|kumis|avena|cereal|arroz|frijol|lenteja|garbanzo|pasta|espagueti|"
      + "platano|yuca|mazorca|tomate|cebolla|ajo|verdura|fruta|banano|manzana|naranja|mango|aguacate|limon|guayaba|mora|"
      + "pollo|carne|res|cerdo|chicharron|chorizo|salchicha|jamon|atun|sardina|pescado|mojarra|"
      + "aceite|azucar|panela|sal|harina|chocolate|cafe molido|galleta|mecato|papitas|chitos|chocolatina|dulce|bon bon bum|"
      + "gaseosa|jugo|botella de agua|agua en botella|bolsa de agua|refresco|pony malta|malta|"
      + "detergente|jabon|jabon en polvo|papel higienico|limpido|blanqueador|suavizante|lavaloza|esponja|bolsas de basura|aseo",
    transporte: "transporte|bus|buseta|colectivo|taxi|uber|didi|indrive|indriver|cabify|picap|mototaxi|bicitaxi|"
      + "transmilenio|sitp|metro|metroplus|metrocable|mio cali|megabus|transcaribe|metrolinea|tullave|tu llave|civica|recarga tullave|recarga civica|"
      + "pasaje|tiquete|tiquete de bus|terminal|intermunicipal|vuelo|tiquete aereo|avion|avianca|latam|wingo|jetsmart|"
      + "gasolina|tanqueada|tanquear|acpm|diesel|gas vehicular|terpel|primax|biomax|texaco|peaje|parqueadero|parqueo|"
      + "lavada del carro|lavadero|mecanico|taller del carro|cambio de aceite|aceite del carro|aceite de la moto|llanta|repuesto|bateria del carro|"
      + "soat|tecnomecanica|revision tecnomecanica|multa|comparendo|fotomulta|impuesto vehicular|licencia de conduccion|"
      + "carro|moto|bicicleta|patineta|scooter|gasolinera",
    servicios: "servicios|servicios publicos|recibo|factura de luz|recibo de luz|luz|energia|recibo del agua|factura del agua|acueducto|alcantarillado|"
      + "gas|recibo del gas|pipeta|internet|wifi|celular|plan del celular|plan de datos|datos|minutos|recarga|recarga del celular|telefono|"
      + "television|cable|directv|claro|movistar|tigo|wom|etb|une|enel|codensa|epm|vanti|emcali|air-e|afinia|celsia|triple a|recibo del aseo",
    vivienda: "arriendo|alquiler|administracion|cuota de administracion|predial|impuesto predial|hipoteca|cuota de la casa|casa|apartamento|"
      + "reparacion|arreglo de la casa|plomero|electricista|cerrajero|pintura|ferreteria|homecenter|easy|"
      + "mueble|colchon|cortina|sabana|cobija|almohada|decoracion|olla|vajilla|electrodomestico|nevera|lavadora|estufa|licuadora|"
      + "empleada|empleada domestica|senora del aseo|aseo de la casa|mudanza|trasteo",
    salud: "salud|medicina|medicamento|pastilla|remedio|drogueria|farmacia|farmatodo|cruz verde|la rebaja|locatel|"
      + "cita medica|consulta|medico|doctor|especialista|odontologo|dentista|ortodoncia|examen|laboratorio|terapia|psicologo|fisioterapia|"
      + "vacuna|gafas|lentes|optometra|optica|copago|cuota moderadora|eps|prepagada|urgencias|hospital|clinica|"
      + "acetaminofen|dolex|ibuprofeno|vitamina|curita|tapabocas|alcohol antiseptico",
    educacion: "educacion|colegio|pension del colegio|matricula|universidad|semestre|curso|clase|diplomado|tutoria|refuerzo|"
      + "libro|cuaderno|utiles|utiles escolares|uniforme|lapiz|fotocopia|impresion|ruta escolar|jardin infantil|"
      + "platzi|udemy|coursera|ingles|idiomas|icetex|sena",
    deudas: "deuda|cuota|cuota de la tarjeta|tarjeta|tarjeta de credito|credito|prestamo|abono a la deuda|intereses|cuota de manejo|"
      + "addi|sistecredito|gota a gota|fiado|fiado de la tienda|pagar el fiado|libranza|leasing|cuota del carro|cuota de la moto",
    ocio: "salida|rumba|fiesta|bar|discoteca|cerveza|pola|chela|aguardiente|guaro|ron|whisky|trago|coctel|vino tinto|botella de vino|"
      + "cine|boleta|entrada|concierto|partido|estadio|teatro|museo|bolos|billar|tejo|karaoke|parque de diversiones|"
      + "paseo|viaje|hotel|hostal|airbnb|finca|piscina|playa|"
      + "restaurante|asadero|pizzeria|pizza|hamburguesa|perro caliente|salchipapa|picada|sushi|comida rapida|alitas|"
      + "domicilio|rappi|ifood|frisby|kfc|mcdonalds|el corral|crepes|juan valdez|tostao|starbucks|oma|presto|"
      + "helado|postre|torta|cumpleanos|loteria|chance|baloto|apuesta|betplay|wplay|rushbet|juego|videojuego",
    compras: "compras|ropa|camisa|camiseta|blusa|pantalon|jean|short|falda|vestido|chaqueta|buzo|saco|ropa interior|medias|"
      + "zapatos|tenis|sandalias|chanclas|bolso|morral|maleta|billetera|reloj|accesorio|gafas de sol|"
      + "perfume|maquillaje|crema|shampoo|champu|desodorante|cuchilla|cepillo de dientes|crema dental|toallas higienicas|"
      + "peluqueria|barberia|corte de pelo|manicure|pedicure|unas acrilicas|arreglo de unas|cejas|depilacion|spa|"
      + "audifonos|cargador|cable usb|computador|portatil|tablet|celular nuevo|forro del celular|juguete|regalo|detalle|flores|"
      + "falabella|mercado libre|amazon|temu|shein|aliexpress|zara|koaj|arturo calle|tennis|alkosto|ktronix|dollarcity|miniso|panamericana",
    suscripciones: "suscripcion|membresia|netflix|spotify|disney|max|hbo|prime video|amazon prime|youtube premium|apple music|icloud|google one|"
      + "chatgpt|claude|deezer|crunchyroll|paramount|vix|star plus|game pass|playstation plus|canva|duolingo|"
      + "gimnasio|gym|smart fit|bodytech|mensualidad del gimnasio",
    ahorro: "ahorro|ahorrar|ahorre|ahorramos|guarde para|cdt|alcancia|inversion|bolsillo|colchon de nequi|fondo de emergencia|cripto|acciones|pension voluntaria",
    otros: "otros|propina|donacion|limosna|diezmo|ofrenda|iglesia|vaca|notaria|tramite|pasaporte|cedula|"
      + "mascota|perro|gato|veterinario|vacuna del perro|vacuna del gato|vacuna de la mascota|cita del perro|cita del gato|veterinaria|concentrado|arena para gato|lavanderia|envio|mensajeria|servientrega|interrapidisimo|"
      + "giro|comision|cuatro por mil|4x1000|impuesto|dian|imprevisto"
  };
  var CH_LISTA = null;
  function chRx(t) { return new RegExp("(?:^| )" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:e?s)?(?= |$)"); }
  function chLista() {
    if (CH_LISTA) return CH_LISTA;
    CH_LISTA = [];
    Object.keys(CH_VOCAB).forEach(function (cat) { CH_VOCAB[cat].split("|").forEach(function (t) { t = prNorm(t); if (t) CH_LISTA.push([t, cat, null]); }); });
    return CH_LISTA;
  }
  // La coincidencia más larga entre los pares [palabra, categoría]; las aprendidas de la persona se miran primero.
  function chBuscar(t, pares) {
    var mejor = null;
    pares.forEach(function (p) {
      if (mejor && p[0].length <= mejor[0].length) return;
      if (!p[2]) p[2] = chRx(p[0]);
      if (p[2].test(t)) mejor = p;
    });
    return mejor;
  }
  function chAprendidas() {
    return Object.keys(state.reglas).filter(function (k) { return k.length >= 3 && catById(state.reglas[k]); }).map(function (k) { return [prNorm(k), state.reglas[k], null]; });
  }
  function chCategoria(t) {
    var a = chBuscar(t, chAprendidas()); if (a) return { cat: a[1], por: "aprendida" };
    var v = chBuscar(t, chLista()); if (v) return { cat: v[1], por: "vocabulario" };
    var l = LECTOR.sugerirCategoria({ comercio: t, tipo: "gasto" }, {}); if (l.por === "lista") return { cat: l.cat, por: "comercio" };
    var p = prCat(t); return p ? { cat: p, por: "nombre" } : { cat: "", por: "" };
  }
  var CH_RELLENO = " toco pagar solte bote clavaron tumbaron gastamos pagamos fueron salieron cobraron barras barra gaste gastaste pague pagaste compre compraste me te le pagaron pago recibi llego llegaron dieron consignaron en de del un una uno unos unas el la los las lo por para con y pesos peso mil millon millones lucas luca palos palo k cop cash hoy fue costo vale valio salio que mas mi mis su sus tu tus al a pedi meti di deje puse saque fui hice es era eran ";
  var CH_DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  var CH_MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var CH_DIAS_C = ["dom.", "lun.", "mar.", "miér.", "jue.", "vie.", "sáb."];

  // --- Cuándo fue: hoy, ayer, antier, hace 3 días, el sábado, el 10, el 10 de noviembre. Nunca en el futuro ni hace más de 60 días. ---
  function chFecha(t) {
    var hoy = d0(), m, d = null;
    if ((m = /(?:^| )(antier|anteayer|antes de ayer|antier en la noche)(?= |$)/.exec(t))) d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 2);
    else if ((m = /(?:^| )(ayer(?: en la (?:manana|tarde|noche))?)(?= |$)/.exec(t))) d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
    else if ((m = /(?:^| )hace (\d{1,2}) dias?(?= |$)/.exec(t))) { var n = Math.min(60, +m[1]); d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - n); }
    else if ((m = /(?:^| )(?:el |este |el pasado )?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)( pasado)?(?= |$)/.exec(t))) {
      var dif = (hoy.getDay() - CH_DIAS.indexOf(m[1]) + 7) % 7; if (dif === 0 && m[2]) dif = 7;
      d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dif);
    }
    else if ((m = /(?:^| )el (?:dia )?(\d{1,2})(?: de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))?(?= |$)(?! (?:mil|lucas?|k|millon|millones|pesos|palos?)\b)/.exec(t))) {
      var dia = +m[1], mes = m[2] ? CH_MESES.indexOf(m[2]) : hoy.getMonth(), anio = hoy.getFullYear();
      if (dia >= 1 && dia <= 31) {
        d = new Date(anio, mes, dia);
        if (d > hoy) d = m[2] ? new Date(anio - 1, mes, dia) : new Date(anio, mes - 1, dia);
      }
    }
    else if ((m = /(?:^| )(hoy|esta manana|esta tarde|esta noche)(?= |$)/.exec(t))) d = hoy;
    if (!d || (hoy - d) / 864e5 > 60) return null;
    return { f: hoyStr(d), txt: m[0] };
  }
  function chFechaTxt(f) {
    if (!f || f === hoyStr()) return "";
    var hoy = d0(), d = new Date(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10)), dif = Math.round((hoy - d) / 864e5);
    if (dif === 1) return "ayer";
    if (dif === 2) return "antier";
    return CH_DIAS_C[d.getDay()] + " " + d.getDate() + " " + MESES_C[d.getMonth()];
  }

  // --- Con qué pagó: "con Nequi", "por Daviplata", "con la tarjeta", "en efectivo". Gana el nombre de una cuenta propia. ---
  var CH_TIPO_PAL = { nequi: "nequi", daviplata: "daviplata|davi plata", tarjeta: "tarjeta|tarjeta de credito|la de credito|credito|visa|mastercard|master",
    banco: "debito|tarjeta debito|tarjeta de debito|la cuenta|cuenta|cuenta de ahorros|banco|transferencia|bancolombia|davivienda|bbva|banco de bogota|pse", efectivo: "efectivo|cash|billete|billetes" };
  function chCuentaDe(t) {
    var mejor = null;
    function probar(pal, id) {
      // "de" y "en" solo para billeteras: "la cuota de la tarjeta" no dice con qué se pagó.
      var pre = /^(efectivo|cash)$/.test(pal) ? "(?:^| )(?:(?:en|con|de|por|y)(?: el| mi)? )?"
        : /^(nequi|daviplata|davi plata)$/.test(pal) ? "(?:^| )(?:con|por|desde|usando|via|en|de|del)(?: la| el| mi| mis)? "
        : "(?:^| )(?:con|por|desde|usando|via)(?: la| el| mi| mis| una| un)? ";
      var re = new RegExp(pre + pal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?= |$)"), m = re.exec(t);
      if (m && (!mejor || pal.length > mejor.pal.length)) mejor = { id: id, pal: pal, txt: m[0] };
    }
    state.cuentas.forEach(function (c) {
      var n = prNorm(c.nombre); if (n.length >= 3) probar(n, c.id);
      (CH_TIPO_PAL[c.tipo] || "").split("|").forEach(function (p) { if (p) probar(p, c.id); });
    });
    // Sin cuenta de ese tipo todavía: igual se entiende "en efectivo"
    if (!mejor && /(?:^| )(?:en )?efectivo(?= |$)/.test(t)) { var e = cuentaEfectivo(false); if (e) mejor = { id: e.id, txt: /(?:^| )(?:en )?efectivo(?= |$)/.exec(t)[0] }; }
    return mejor;
  }

  // --- Compartido: "la mitad es de Juan", "entre tres con Ana y Luis", "dividido entre 2" ---
  var CH_NO_NOMBRE = /^(es|era|la|el|los|las|mi|mis|ellos|ellas|nosotros|otro|otra|otros|todos|pagar|paga|pone|debe|toca)$/;
  var CH_NUM_TXT = { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8 };
  function chCompartido(t) {
    var m, partes = 0, quien = "";
    if ((m = /(?:^| )(?:y )?(?:la )?mitad(?: (?:es|era|le toca a|la pone|la paga|me la debe|la debe|lo pone|lo paga))?(?: de)?(?: ([a-z]+(?: y [a-z]+)?))?(?= |$)/.exec(t))) { partes = 2; quien = m[1] || ""; }
    else if ((m = /(?:^| )(?:dividido |partido |a medias )?entre (\d|dos|tres|cuatro|cinco|seis|siete|ocho)(?: personas)?(?: con ([a-z]+(?: y [a-z]+)?))?(?= |$)/.exec(t))) { partes = CH_NUM_TXT[m[1]] || +m[1]; quien = m[2] || ""; }
    else if ((m = /(?:^| )a medias con ([a-z]+(?: y [a-z]+)?)(?= |$)/.exec(t))) { partes = 2; quien = m[1]; }
    if (!partes || partes < 2 || partes > 12) return null;
    quien = quien.split(" y ").filter(function (x) { return x && !CH_NO_NOMBRE.test(x); }).join(" y ");
    return { partes: partes, quien: quien, txt: m[0] };
  }
  // Recupera el nombre como se escribió ("juan" → "Juan", "angela" → "Ángela")
  function chNombre(norm, original) {
    if (!norm) return "";
    var pal = String(original || "").split(/[\s,.;]+/);
    return norm.split(" y ").map(function (w) {
      var o = pal.find(function (p) { return nrm(p) === w; }) || w;
      return o.charAt(0).toUpperCase() + o.slice(1);
    }).join(" y ");
  }

