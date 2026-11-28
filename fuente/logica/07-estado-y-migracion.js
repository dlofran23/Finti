  // ===================== Estado y migración =====================
  var TEMPLATE = document.getElementById("budget-data").textContent;
  var LOCAL_PREFIX = WEB ? "presupuesto-web-" : FREE ? "presupuesto-gratis-" : "presupuesto-v2-";

  function validState(s) {
    return !!s && typeof s === "object" && ((s.meses && typeof s.meses === "object") || (Array.isArray(s.ingresos) && Array.isArray(s.gastos)));
  }
  function cleanMonth(m, catIds) {
    var out = { ingresos: [], gastos: [], notas: String((m && m.notas) || "").slice(0, 4000) };
    (Array.isArray(m && m.ingresos) ? m.ingresos : []).forEach(function (r) {
      if (r && r.id) out.ingresos.push({ id: String(r.id).slice(0, 40), concepto: String(r.concepto || "").slice(0, 80), plan: num(r.plan), real: num(r.real) });
    });
    (Array.isArray(m && m.gastos) ? m.gastos : []).forEach(function (r) {
      if (r && r.id) out.gastos.push({ id: String(r.id).slice(0, 40), concepto: String(r.concepto || "").slice(0, 80), cat: catIds[r.cat] ? r.cat : "otros",
        dia: clamp(Math.round(num(r.dia)), 0, 31), plan: num(r.plan), real: num(r.real) });
    });
    return out;
  }
  function fechas(a) { return (Array.isArray(a) ? a : []).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); }).slice(-400); }
  function sanitize(s) {
    var pr = s.prefs || {};
    var out = {
      v: 3,
      titulo: String(s.titulo || "Mi presupuesto").slice(0, 80),
      ejemplo: !!s.ejemplo,
      prefs: {
        // idv 3 = identidad Finti azul. Quien seguía en un tema por defecto anterior (Cobalto o Vibrante) pasa una sola vez a Finti.
        tema: (pr.idv || 0) < 3 && (!pr.tema || pr.tema === "cobalto" || pr.tema === "vibrante") ? "finti" : THEME_BY_ID[pr.tema] || pr.tema === "personal" ? pr.tema : "finti",
        idv: 3,
        modo: ["auto", "claro", "oscuro"].indexOf(pr.modo) > -1 ? pr.modo : "oscuro",
        sonidos: pr.sonidos !== false,
        letraGrande: pr.letraGrande === true,
        temporada: pr.temporada !== false,
        cartaVista: /^\d{4}-\d{2}-\d{2}$/.test(pr.cartaVista || "") ? pr.cartaVista : "",
        // Ahorro por redondeo: cada gasto anotado se redondea hacia arriba y la diferencia va a la alcancía
        redondeo: pr.redondeo === true,
        redondeoA: [1000, 5000, 10000].indexOf(pr.redondeoA) > -1 ? pr.redondeoA : 1000,
        // Días del mes en que le pagan a la persona (quincena); [0] = no quiere la cuenta regresiva
        diasPago: (Array.isArray(pr.diasPago) ? pr.diasPago : []).map(function (d) { return Math.round(num(d)); }).filter(function (d) { return d >= 0 && d <= 31; }).slice(0, 3),
        // Colores propios por categoría (paleta de la persona); vacío = los de la identidad
        catColores: (function (o) { var out = {}; o = o && typeof o === "object" ? o : {}; Object.keys(o).slice(0, 60).forEach(function (k) { if (k.length <= 40 && /^#[0-9a-f]{6}$/i.test(o[k] || "")) out[k] = o[k].toLowerCase(); }); return out; })(pr.catColores),
        acento: /^#[0-9a-f]{6}$/i.test(pr.acento || "") ? pr.acento : "#2e5bff",
        premium: !!pr.premium,
        codigo: typeof pr.codigo === "string" ? pr.codigo.slice(0, 80) : "",
        perfil: ["personal", "estudiante", "pareja", "familia", "independiente", "negocio"].indexOf(pr.perfil) > -1 ? pr.perfil : "personal",
        // Lo que la persona dijo que quería lograr en el inicio guiado
        enfoque: ["viaje", "fondo", "deudas", "compra", "orden"].indexOf(pr.enfoque) > -1 ? pr.enfoque : "orden",
        metasInicio: (Array.isArray(pr.metasInicio) ? pr.metasInicio : []).filter(function (m, k, l) { return ["viaje", "fondo", "deudas", "compra", "orden"].indexOf(m) > -1 && l.indexOf(m) === k; })
      },
      categorias: [], metas: [], deudas: [],
      deudaExtra: Math.max(0, num(s.deudaExtra)),
      deudaMetodo: s.deudaMetodo === "bola" ? "bola" : "avalancha",
      meses: {}, mes: "",
      actividad: fechas(s.actividad),
      registros: fechas(s.registros),
      sinGasto: fechas(s.sinGasto),
      logros: (Array.isArray(s.logros) ? s.logros : []).filter(function (x) { return typeof x === "string" && /^[a-z0-9]{1,20}$/.test(x); }).slice(0, 40),
      cuentas: [], porPagar: [], pendientes: [],
      reglas: {}, reglasCuenta: {},
      // Lo que otras personas te deben (gastos compartidos y préstamos), anotado desde Cuéntame un gasto.
      meDeben: (Array.isArray(s.meDeben) ? s.meDeben : []).filter(function (x) { return x && num(x.m) > 0; }).slice(-200).map(function (x) {
        return { id: String(x.id || rid("q")).slice(0, 40), quien: String(x.quien || "Otra persona").slice(0, 40), m: Math.round(num(x.m)), c: String(x.c || "").slice(0, 60), f: /^\d{4}-\d{2}-\d{2}$/.test(x.f || "") ? x.f : "" };
      }),
      // Preguntas pendientes de Cuéntame un gasto (precios que faltaron), para hacerlas después
      noEntendi: (Array.isArray(s.noEntendi) ? s.noEntendi : []).filter(function (x) { return x && typeof x.t === "string" && x.t.trim(); }).slice(-40).map(function (x) {
        return { t: x.t.slice(0, 300), de: x.de === "pregunta" ? "pregunta" : "charla", f: /^\d{4}-\d{2}-\d{2}$/.test(x.f || "") ? x.f : "" }; }),
      dudas: (Array.isArray(s.dudas) ? s.dudas : []).filter(function (d) { return d && /^(precio|nuevo)$/.test(d.k) && num(d.cr) > 0; }).slice(-20).map(function (d) {
        return { id: String(d.id || rid("d")).slice(0, 30), k: d.k, mov: String(d.mov || "").slice(0, 20), n: String(d.n || "").slice(0, 40), q: String(d.q || "").slice(0, 12), c: String(d.c || "").slice(0, 80),
          cat: String(d.cat || "").slice(0, 40), lugar: String(d.lugar || "").slice(0, 40), f: /^\d{4}-\d{2}-\d{2}$/.test(d.f || "") ? d.f : "", cuenta: String(d.cuenta || "").slice(0, 30), cr: num(d.cr),
          det: (Array.isArray(d.det) ? d.det : []).slice(0, 25).map(function (x) { return { n: String(x && x.n || "").slice(0, 40), q: String(x && x.q || "").slice(0, 12), m: 0 }; }) };
      }),
      propios: (Array.isArray(s.propios) ? s.propios : []).filter(function (x) { return typeof x === "string" && x.length > 1 && x.length <= 80; }).slice(-100),
      importados: (Array.isArray(s.importados) ? s.importados : []).filter(function (x) { return typeof x === "string" && x.length < 120; }).slice(-3000),
      reto: { base: 0, inicio: "", hechas: [] },
      alcancia: (function (a) { var out = {}; a = a && typeof a === "object" ? a : {}; Object.keys(a).filter(function (k) { return /^\d{4}-\d{2}$/.test(k); }).sort().slice(-24).forEach(function (k) {
        out[k] = { j: Math.max(0, Math.round(num(a[k] && a[k].j))), p: Math.max(0, Math.round(num(a[k] && a[k].p))) }; }); return out; })(s.alcancia),
      invita: (function (i) { i = i && typeof i === "object" ? i : {}; var ok = /^AMIGO-[A-HJ-NP-Z2-9]{6}$/.test(i.codigo || "") && /^[\w-]{20,80}$/.test(i.llave || "");
        return ok ? { codigo: i.codigo, llave: i.llave } : { codigo: "", llave: "" }; })(s.invita),
      // Cuentas del negocio, aparte de las personales.
      negocio: (function (n) { n = n && typeof n === "object" ? n : {};
        return { sueldo: Math.max(0, Math.round(num(n.sueldo))), movs: (Array.isArray(n.movs) ? n.movs : []).filter(function (x) { return x && /^\d{4}-\d{2}-\d{2}$/.test(x.f) && num(x.m) > 0; }).slice(-3000).map(function (x) {
          return { id: String(x.id || "").slice(0, 24), f: x.f, t: x.t === "g" ? "g" : "v", cat: x.t === "g" ? String(x.cat || "otros").slice(0, 20) : "", c: String(x.c || "").slice(0, 80), m: Math.round(num(x.m)) }; }) }; })(s.negocio),
      // Historial de movimientos con fecha (solo en el dispositivo y en la copia cifrada): el asesor aprende de él.
      movs: (Array.isArray(s.movs) ? s.movs : []).filter(function (x) { return x && /^\d{4}-\d{2}-\d{2}$/.test(x.f) && num(x.m) > 0; }).slice(-1500).map(function (x) {
        var mv = { id: String(x.id || "").slice(0, 20), f: x.f, h: x.h >= 0 && x.h < 24 ? Math.floor(x.h) : -1, t: x.t === "i" ? "i" : "g", cat: String(x.cat || "").slice(0, 40), c: String(x.c || "").slice(0, 80), m: Math.round(num(x.m)), com: String(x.com || "").slice(0, 60), rd: Math.max(0, Math.round(num(x.rd))) };
        if (x.o === "ch" || x.o === "aviso") mv.o = x.o;
        if (x.cu) mv.cu = String(x.cu).slice(0, 30);
        if (x.banco) mv.banco = String(x.banco).slice(0, 30);
        if (Array.isArray(x.det) && x.det.length) mv.det = x.det.slice(0, 25).map(function (d) { return { n: String(d && d.n || "").slice(0, 40), q: String(d && d.q || "").slice(0, 12), m: Math.max(0, Math.round(num(d && d.m))) }; });
        return mv;
      }),
      asesor: (function (a) { a = a && typeof a === "object" ? a : {}; var l = function (v) { return (Array.isArray(v) ? v : []).filter(function (x) { return typeof x === "string" && x.length <= 40; }).slice(-80); };
        return { si: l(a.si), no: l(a.no), aprendido: /^\d{4}-\d{2}-\d{2}$/.test(a.aprendido || "") ? a.aprendido : "" }; })(s.asesor),
      avisos: { registro: !(s.avisos && s.avisos.registro === false), pagos: !(s.avisos && s.avisos.pagos === false) }
    };
    var TIPO_IDS = { banco: 1, nequi: 1, daviplata: 1, efectivo: 1, tarjeta: 1, otra: 1 };
    (Array.isArray(s.cuentas) ? s.cuentas : []).slice(0, 30).forEach(function (c) {
      if (c && c.id) out.cuentas.push({ id: String(c.id).slice(0, 40), nombre: String(c.nombre || "").slice(0, 40), tipo: TIPO_IDS[c.tipo] ? c.tipo : "otra",
        saldo: Math.round(num(c.saldo)), cupo: Math.max(0, Math.round(num(c.cupo))), ini: c.ini === undefined ? Math.round(num(c.saldo)) !== 0 : !!c.ini });
      if (c.banco && /^[a-z0-9]{1,20}$/.test(c.banco)) out.cuentas[out.cuentas.length - 1].banco = c.banco;
    });
    ["reglas", "reglasCuenta"].forEach(function (k) {
      var o = s[k] && typeof s[k] === "object" ? s[k] : {};
      Object.keys(o).slice(-400).forEach(function (x) { if (typeof o[x] === "string" && x.length <= 80) out[k][x.slice(0, 80)] = o[x].slice(0, 40); });
    });
    (Array.isArray(s.pendientes) ? s.pendientes : []).slice(-200).forEach(function (p) {
      if (!p || !p.id) return;
      var txt = function (v, n) { return String(v == null ? "" : v).slice(0, n); };
      var q = { id: txt(p.id, 40), origen: txt(p.origen, 12), recibido: txt(p.recibido, 30), banco: txt(p.banco, 30), tipo: ["gasto", "ingreso", "retiro", "pagoTarjeta", "propio"].indexOf(p.tipo) > -1 ? p.tipo : "gasto",
        monto: Math.max(0, Math.round(num(p.monto))), comercio: txt(p.comercio, 60), fecha: /^\d{4}-\d{2}-\d{2}$/.test(p.fecha || "") ? p.fecha : "", hora: txt(p.hora, 5), medio: txt(p.medio, 30), u4: txt(p.u4, 4),
        nit: txt(p.nit, 20), numero: txt(p.numero, 30), items: (Array.isArray(p.items) ? p.items : []).slice(0, 4).map(function (x) { return txt(x, 60); }), confianza: txt(p.confianza, 6),
        pista: txt(p.pista || (p.texto ? ["nequi", "daviplata", "bolsillo", "colchon", "meta"].filter(function (k) { return String(p.texto).toLowerCase().indexOf(k) > -1; }).join(" ") : ""), 120), cat: txt(p.cat, 40), cuenta: txt(p.cuenta, 40), pago: txt(p.pago, 40), dup: txt(p.dup, 40),
        destino: txt(p.destino, 40), par: txt(p.par, 40), parDe: txt(p.parDe, 40), tipoOriginal: ["gasto", "ingreso"].indexOf(p.tipoOriginal) > -1 ? p.tipoOriginal : "",
        contado: txt(p.contado, 20), contadoNo: !!p.contadoNo };
      if (p.verificacion) q.verificacion = { codigo: txt(p.verificacion.codigo, 12) };
      out.pendientes.push(q);
    });
    var rt = s.reto || {};
    if (/^\d{4}-\d{2}-\d{2}$/.test(rt.inicio || "")) {
      var seen52 = {};
      out.reto = { base: clamp(Math.round(num(rt.base)) || 5000, 100, 1000000), inicio: rt.inicio,
        hechas: (Array.isArray(rt.hechas) ? rt.hechas : []).map(function (n) { return Math.round(num(n)); }).filter(function (n) { if (n < 1 || n > 52 || seen52[n]) return false; seen52[n] = 1; return true; }) };
    }
    var catIds = {};
    BASE_CATS.forEach(function (c) { catIds[c.id] = true; });
    (Array.isArray(s.categorias) ? s.categorias : []).slice(0, 40).forEach(function (c) {
      if (c && c.id && c.name && !catIds[c.id]) {
        out.categorias.push({ id: String(c.id).slice(0, 40), name: String(c.name).slice(0, 40), group: GROUP_NAME[c.group] ? c.group : "gus", ic: /^[a-z]{3,14}$/.test(c.ic || "") ? c.ic : "" });
        catIds[c.id] = true;
      }
    });
    (Array.isArray(s.porPagar) ? s.porPagar : []).slice(0, 60).forEach(function (b) {
      if (!b || !b.id) return;
      var pagos = {};
      if (b.pagos && typeof b.pagos === "object") Object.keys(b.pagos).filter(function (k) { return /^(\d{4}(-\d{2})?|u)$/.test(k) && /^\d{4}-\d{2}-\d{2}$/.test(b.pagos[k]); }).sort().slice(-36).forEach(function (k) { pagos[k] = b.pagos[k]; });
      out.porPagar.push({ id: String(b.id).slice(0, 40), nombre: String(b.nombre || "").slice(0, 60), monto: Math.max(0, Math.round(num(b.monto))),
        f: ["mensual", "anual", "unica"].indexOf(b.f) > -1 ? b.f : "mensual", dia: clamp(Math.round(num(b.dia)) || 1, 1, 31),
        fecha: /^\d{4}-\d{2}-\d{2}$/.test(b.fecha || "") ? b.fecha : "", cat: catIds[b.cat] ? b.cat : "otros", cuenta: typeof b.cuenta === "string" ? b.cuenta.slice(0, 40) : "",
        aviso: clamp(Math.round(num(b.aviso)), 0, 15), creado: /^\d{4}-\d{2}-\d{2}$/.test(b.creado || "") ? b.creado : hoyStr(), pagos: pagos });
    });
    (Array.isArray(s.metas) ? s.metas : []).slice(0, 30).forEach(function (g) {
      if (g && g.id) out.metas.push({ id: String(g.id).slice(0, 40), nombre: String(g.nombre || "").slice(0, 60), objetivo: Math.max(0, num(g.objetivo)), ahorrado: Math.max(0, num(g.ahorrado)), fecha: validKey(g.fecha) ? g.fecha : "" });
    });
    (Array.isArray(s.deudas) ? s.deudas : []).slice(0, 30).forEach(function (d) {
      if (d && d.id) out.deudas.push({ id: String(d.id).slice(0, 40), nombre: String(d.nombre || "").slice(0, 60), saldo: Math.max(0, num(d.saldo)), tasa: clamp(num(d.tasa), 0, 400), cuota: Math.max(0, num(d.cuota)) });
    });
    if (s.meses && typeof s.meses === "object") {
      Object.keys(s.meses).forEach(function (k) { if (validKey(k)) out.meses[k] = cleanMonth(s.meses[k], catIds); });
    } else if (Array.isArray(s.ingresos)) {
      out.meses[parsePeriodo(s.periodo) || nowKey()] = cleanMonth(s, catIds);   // formato anterior: un solo mes
    }
    var keys = Object.keys(out.meses).sort();
    if (!keys.length) { out.meses[nowKey()] = { ingresos: [], gastos: [] }; keys = [nowKey()]; }
    out.mes = out.meses[s.mes] ? s.mes : keys[keys.length - 1];
    return out;
  }
  function freshTemplate() {
    var t; try { t = JSON.parse(TEMPLATE); } catch (e) { t = { ingresos: [], gastos: [] }; }
    return sanitize(t);
  }

  var state = freshTemplate();
  function cur() { return state.meses[state.mes]; }
  function monthKeys() { return Object.keys(state.meses).sort(); }

