  // ===================== Tanda 4: quincena, redondeo, escáner de recibos, retos con amigos, aviso de la mañana =====================
  // --- Aviso de la mañana: el servidor solo manda "es hora"; el service worker calcula la cifra aquí, con esto ---
  function guardarCupo() {
    if (!WEB) return;
    try {
      var k = keyOf(new Date()), m = state.meses[k], P = 0, R = 0;
      if (m) m.gastos.forEach(function (r) { if (r.dia || (catById(r.cat) || { group: "gus" }).group === "aho") return; P += r.plan; R += r.real; });
      idbEscribir("cupo", { mes: k, P: P, R: R, cifra: !!(avDev && avDev.cifra), t: Date.now() }).catch(function () {});
    } catch (e) {}
  }
  // --- Cuenta regresiva a la quincena ---
  function proxPago(hoy) {
    var dias = (state.prefs.diasPago || []).filter(function (d) { return d > 0; }); if (!dias.length) return null;
    var h = d0(hoy), fechas = [];
    for (var mm = -1; mm <= 1; mm++) { var f = new Date(h.getFullYear(), h.getMonth() + mm, 1), u = dim(f.getFullYear(), f.getMonth() + 1);
      dias.forEach(function (d) { fechas.push(new Date(f.getFullYear(), f.getMonth(), Math.min(d, u))); }); }
    fechas.sort(function (a, b) { return a - b; });
    var sig = fechas.find(function (x) { return x >= h; }), ant = fechas.filter(function (x) { return x < sig; }).pop();
    return { f: sig, faltan: Math.round((sig - h) / 864e5), largo: Math.max(1, Math.round((sig - ant) / 864e5)) };
  }
  function renderQuincena() {
    var box = $("quincena"), dp = state.prefs.diasPago || [], hoy = new Date();
    box.hidden = state.ejemplo || state.mes !== keyOf(hoy) || (dp.length === 1 && dp[0] === 0); if (box.hidden) return;
    var q = proxPago(hoy), C = 2 * Math.PI * 27;
    $("qn-elige").hidden = !!q; box.classList.toggle("eligiendo", !q);
    if (!q) { $("qn-t").textContent = "¿Cuándo te pagan?"; $("qn-s").textContent = "Te muestro cuántos días faltan para tu próximo pago."; $("qn-n").textContent = "?"; $("qn-fg").style.strokeDasharray = "0 " + C; return; }
    var avance = 1 - q.faltan / q.largo;
    $("qn-fg").style.strokeDasharray = (C * Math.max(0.02, avance)).toFixed(1) + " " + C.toFixed(1);
    $("qn-n").textContent = q.faltan || "¡Hoy!";
    box.classList.toggle("hoy", q.faltan === 0);
    $("qn-t").textContent = q.faltan === 0 ? "¡Hoy es día de pago!" : q.faltan === 1 ? "Mañana te pagan" : "Faltan " + q.faltan + " días para tu pago";
    var h = hoyPuedes(totalsOf(cur()));
    $("qn-s").textContent = q.faltan === 0 ? "Antes de gastar, separa tu ahorro. Tu yo del futuro te lo agradece." :
      "Llega el " + fechaLarga(q.f) + "." + (h && h.plan && h.resto > 0 ? " Hasta entonces te quedan " + money(redondeoMil(Math.max(0, h.resto) * Math.min(1, (q.faltan + 1) / h.quedan))) + " para el día a día." : "");
    $("qn-n").setAttribute("font-size", q.faltan ? "20" : "13");
  }
  $("qn-elige").addEventListener("click", function (e) {
    var b = e.target.closest("[data-pago]"); if (!b) return;
    var v = b.dataset.pago;
    if (v === "otro") { var d = prompt("¿Qué día del mes te pagan? Si son dos, sepáralos con una coma (por ejemplo: 10, 25)."); if (!d) return; v = d; }
    var dias = String(v).split(/[ ,y]+/).map(function (x) { return Math.round(+x); }).filter(function (x) { return x >= 0 && x <= 31; }).slice(0, 3);
    if (!dias.length) return;
    state.prefs.diasPago = dias; changed(); renderQuincena();
    if (dias[0] === 0) toast("Listo, no te muestro la cuenta regresiva.");
  });

  // --- Ahorro por redondeo ---
  function renderAlcancia() {
    var on = !!state.prefs.redondeo, k = state.mes, a = state.alcancia[k] || { j: 0, p: 0 }, libre = Math.max(0, a.j - a.p);
    $("f-redondeo").checked = on; $("alc-acc").hidden = !on;
    $("alc-v").textContent = money(libre);
    $("alc-s").textContent = !on ? "Actívalo y cada gasto que anotes se redondea hacia arriba: la diferencia va a tu alcancía." :
      libre ? "Juntaste esto redondeando tus gastos de " + MESES[parseKey(k).m - 1].toLowerCase() + "." + (a.p ? " Ya pasaste " + money(a.p) + " a tu ahorro." : "") :
      a.p ? "¡Todo lo de este mes ya está en tu ahorro! Pasaste " + money(a.p) + "." : "Cuando anotes tu próximo gasto, la alcancía empieza a llenarse.";
    [].forEach.call(document.querySelectorAll("[data-rd]"), function (b) { b.setAttribute("aria-pressed", String(+b.dataset.rd === state.prefs.redondeoA)); });
    $("alc-pasar").disabled = !libre;
    document.querySelector(".alcancia").classList.toggle("llena", libre > 0);
  }
  $("f-redondeo").addEventListener("change", function () { state.prefs.redondeo = this.checked; changed(); renderAlcancia(); if (this.checked) toast("Listo: desde tu próximo gasto, la alcancía empieza a juntar."); });
  document.querySelector(".alc-paso").addEventListener("click", function (e) { var b = e.target.closest("[data-rd]"); if (!b) return; state.prefs.redondeoA = +b.dataset.rd; changed(); renderAlcancia(); });
  $("alc-pasar").addEventListener("click", function () {
    var k = state.mes, a = state.alcancia[k]; if (!a) return; var v = a.j - a.p; if (!(v > 0)) return;
    var m = state.meses[k], fila = m.gastos.find(function (r) { return r.cat === "ahorro" && /redondeo/i.test(r.concepto); }) || m.gastos.find(function (r) { return r.cat === "ahorro"; });
    if (!fila) { fila = { id: rid("g"), concepto: "Ahorro por redondeo", cat: "ahorro", dia: 0, plan: 0, real: 0 }; m.gastos.push(fila); }
    fila.real += v; a.p += v; changed(); renderAll(); sonar("monedas"); toast("¡Bien! " + money(v) + " más en tu ahorro de este mes.");
  });

  // --- Escáner del código de barras de los recibos (GS1-128 de las facturas de servicios en Colombia) ---
  // (415) número de la empresa, (8020) referencia de pago, (3900) valor a pagar, (96) fecha límite AAAAMMDD.
  function leerGS1(raw) {
    var s = String(raw || "").replace(/\]C1/g, "").trim(), r = {};
    if (/\(\d{2,4}\)/.test(s)) { var re = /\((\d{2,4})\)\s*([^(]*)/g, m; while ((m = re.exec(s))) r[m[1]] = m[2].replace(/\D/g, ""); }
    else {
      var d = s.replace(/[^\d\x1d]/g, ""), m2 = /^415(\d{13})8020(\d+?)\x1d?3900(\d+?)\x1d?(?:96(\d{8}))?$/.exec(d);
      if (m2) { r["415"] = m2[1]; r["8020"] = m2[2]; r["3900"] = m2[3]; if (m2[4]) r["96"] = m2[4]; }
    }
    if (!r["3900"] || !(+r["3900"] > 0)) return null;
    var f = r["96"] && /^(\d{4})(\d{2})(\d{2})$/.exec(r["96"]), fecha = f && +f[2] >= 1 && +f[2] <= 12 && +f[3] >= 1 && +f[3] <= 31 ? f[1] + "-" + f[2] + "-" + f[3] : "";
    return { empresa: r["415"] || "", ref: (r["8020"] || "").replace(/^0+(?=\d{4})/, ""), valor: +r["3900"], fecha: fecha };
  }
  var RC = null, rcStream = null, rcTimer = null;
  function rcEmpresas() { try { return JSON.parse(localStorage.getItem("fintelligente-empresas") || "{}"); } catch (e) { return {}; } }
  function abrirRecibo() {
    RC = null; $("rc-form").hidden = true; $("rc-msg").textContent = ""; $("rc-codigo").value = "";
    openDlg("dlg-recibo", "#rc-codigo");
    var puede = "BarcodeDetector" in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    $("rc-cam").hidden = true;
    if (!puede) { $("rc-manual-l").textContent = "Este navegador no lee códigos con la cámara. Escribe los números que aparecen debajo del código de barras."; return; }
    window.BarcodeDetector.getSupportedFormats().then(function (fm) {
      var usar = ["code_128", "itf", "ean_13"].filter(function (x) { return fm.indexOf(x) > -1; });
      if (!usar.length) return;
      var det = new window.BarcodeDetector({ formats: usar });
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }).then(function (st) {
        if ($("dlg-recibo").hidden) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
        rcStream = st; var v = $("rc-video"); v.srcObject = st; v.play().catch(function () {}); $("rc-cam").hidden = false;
        $("rc-manual-l").textContent = "O escribe los números que aparecen debajo del código";
        var buscar = function () {
          if (!rcStream) return;
          det.detect(v).then(function (l) {
            var x = null; l.some(function (c) { x = leerGS1(c.rawValue); return !!x; });
            if (x) { rcParar(); rcMostrar(x); sonar("nota"); } else rcTimer = setTimeout(buscar, 350);
          }, function () { rcTimer = setTimeout(buscar, 600); });
        };
        buscar();
      });
    }).catch(function () { $("rc-msg").textContent = "No pude usar la cámara. Puedes escribir los números del código."; });
  }
  function rcParar() { clearTimeout(rcTimer); if (rcStream) { rcStream.getTracks().forEach(function (t) { t.stop(); }); rcStream = null; } $("rc-cam").hidden = true; }
  onCloseHooks["dlg-recibo"] = rcParar;
  function rcMostrar(x) {
    RC = x; $("rc-form").hidden = false; $("rc-msg").textContent = "";
    $("rc-valor").textContent = money(x.valor); $("rc-fecha").textContent = x.fecha ? fechaLarga(parseD(x.fecha), true) : "Sin fecha";
    $("rc-ref").textContent = x.ref || "–";
    $("rc-nombre").value = (x.empresa && rcEmpresas()[x.empresa]) || ""; $("rc-nombre").focus();
  }
  $("rc-leer").addEventListener("click", function () {
    var x = leerGS1($("rc-codigo").value);
    if (!x) { $("rc-msg").textContent = "No reconocí esos números. Copia toda la línea, con los números entre paréntesis."; return; }
    rcMostrar(x);
  });
  $("rc-codigo").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("rc-leer").click(); } });
  $("rc-form").addEventListener("submit", function (e) {
    e.preventDefault(); if (!RC) return;
    var nombre = $("rc-nombre").value.trim().slice(0, 60) || "Servicio";
    if (RC.empresa) { var em = rcEmpresas(); em[RC.empresa] = nombre; try { localStorage.setItem("fintelligente-empresas", JSON.stringify(em)); } catch (er) {} }
    var f = RC.fecha || hoyStr(), dup = state.porPagar.find(function (b) { return b.f === "unica" && b.fecha === f && b.monto === RC.valor && b.nombre === nombre; });
    if (!dup) state.porPagar.push({ id: rid("p"), nombre: nombre, monto: RC.valor, f: "unica", dia: parseD(f).getDate(), fecha: f, cat: "servicios", cuenta: "", aviso: 2, creado: hoyStr(), pagos: {} });
    changed(); closeDlg("dlg-recibo"); irA("cuentas"); renderAll();
    toast(dup ? "Ese recibo ya estaba en tus cuentas por pagar." : "Listo: " + esc(nombre) + " por " + money(RC.valor) + (RC.fecha ? ", hasta el " + fechaLarga(parseD(RC.fecha), true) : "") + ".");
  });

  // --- Retos con amigos: el servidor solo guarda apodos y días cumplidos ---
  var RA_TIPOS = [
    { id: "domicilios", n: "Una semana sin domicilios", d: "7 días cocinando en casa", dias: 7, ic: "i-store" },
    { id: "anotar", n: "Anotar todos los días", d: "14 días seguidos anotando lo que gastan", dias: 14, ic: "i-flame" },
    { id: "antojos", n: "Cero antojos", d: "7 días sin compras por impulso", dias: 7, ic: "i-snow" },
    { id: "cafe", n: "Café de la casa", d: "10 días sin comprar café ni mecato en la calle", dias: 10, ic: "i-coins" }
  ];
  var RA_KEY = "fintelligente-retos", raTipo = "domicilios", raCache = {};
  function raMios() { try { return (JSON.parse(localStorage.getItem(RA_KEY) || "[]") || []).filter(function (x) { return x && /^RETO-[A-Z2-9]{6}$/.test(x.codigo); }).slice(-10); } catch (e) { return []; } }
  function raGuardar(l) { try { localStorage.setItem(RA_KEY, JSON.stringify(l.slice(-10))); } catch (e) {} }
  function raApi(body) {
    return fetch("/api/retos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "No pudimos hablar con el servidor."); return j; }); });
  }
  function raTipo2(id) { return RA_TIPOS.find(function (t) { return t.id === id; }) || RA_TIPOS[0]; }
  function renderRetosAmigos() {
    var l = raMios(), box = $("ra-lista");
    if (!l.length) { box.innerHTML = '<p class="empty">Aún no tienes retos. Crea uno y compártelo por WhatsApp.</p>'; return; }
    box.innerHTML = l.map(function (r) {
      var t = raTipo2(r.tipo), v = raCache[r.codigo];
      var gente = v ? v.participantes.map(function (p) {
        var pct = Math.min(1, p.cumplidos / v.dias);
        return '<li class="' + (p.yo ? "yo" : "") + '"><span class="ra-av" aria-hidden="true">' + esc(p.apodo.slice(0, 1).toUpperCase()) + '</span><span class="ra-nom">' + esc(p.apodo) + (p.yo ? " (tú)" : "") +
          '</span><span class="ra-bar" role="img" aria-label="' + p.cumplidos + " de " + v.dias + ' días"><i style="width:' + (pct * 100).toFixed(0) + '%"></i></span><b>' + p.cumplidos + "/" + v.dias + "</b></li>";
      }).join("") : "";
      var yo = v && v.participantes.find(function (p) { return p.yo; });
      var estado = !v ? '<p class="hint">Cargando…</p>' : v.estado === "antes" ? '<p class="hint">Empieza el ' + esc(fechaLarga(parseD(v.inicio), true)) + ".</p>" : v.estado === "fin" ? '<p class="hint">Terminó. ¡Gracias por jugar!</p>' : "";
      return '<article class="ra-card" data-codigo="' + esc(r.codigo) + '"><div class="ra-top"><span class="ra-ic" aria-hidden="true">' + icono(t.ic) + '</span><div><b>' + esc(t.n) + "</b><small>" + esc(t.d) + " · " + esc(r.codigo) + "</small></div></div>" +
        estado + (gente ? '<ol class="ra-gente">' + gente + "</ol>" : "") +
        '<div class="ra-acc">' + (v && v.estado === "activo" ? (yo && yo.hoy ? '<span class="chip ok">Hoy cumpliste</span>' : '<button class="btn primary sm" type="button" data-ra-marcar>Hoy cumplí</button>') : "") +
        '<button class="btn sm" type="button" data-ra-compartir>Invitar</button><button class="link-btn" type="button" data-ra-salir>Salir</button></div></article>';
    }).join("");
  }
  function raRefrescar() {
    var l = raMios(); if (!WEB || !l.length) { renderRetosAmigos(); return; }
    renderRetosAmigos();
    l.forEach(function (r) {
      raApi({ accion: "ver", codigo: r.codigo, pid: r.pid, token: r.token, hoy: hoyStr() }).then(function (j) { raCache[r.codigo] = j; renderRetosAmigos(); }, function (e) {
        if (/no existe|terminó hace/i.test(e.message)) { raGuardar(raMios().filter(function (x) { return x.codigo !== r.codigo; })); renderRetosAmigos(); }
      });
    });
  }
  function abrirReto(codigo) {
    $("rt-tipos").innerHTML = RA_TIPOS.map(function (t) { return '<button type="button" role="radio" aria-checked="' + (t.id === raTipo) + '" data-rt="' + t.id + '"><span class="ra-ic" aria-hidden="true">' + icono(t.ic) + "</span><span><b>" + esc(t.n) + "</b><small>" + esc(t.d) + "</small></span></button>"; }).join("");
    $("rt-msg").textContent = ""; $("rt-apodo").value = (raMios()[0] || {}).apodo || nombreLocal();
    if (codigo) { $("rt-codigo").value = codigo; document.querySelector(".rt-unirse").open = true; }
    openDlg("dlg-reto", codigo ? "#rt-apodo" : '#rt-tipos [aria-checked="true"]');
  }
  $("rt-tipos").addEventListener("click", function (e) { var b = e.target.closest("[data-rt]"); if (!b) return; raTipo = b.dataset.rt; [].forEach.call(this.children, function (x) { x.setAttribute("aria-checked", String(x === b)); }); });
  // El nombre que la persona escribió en las tarjetas de bienvenida: solo vive en este dispositivo.
  function nombreLocal() { try { return (localStorage.getItem("fintelligente-nombre") || "").slice(0, 20); } catch (e) { return ""; } }
  function raApodo() { var a = $("rt-apodo").value.trim().replace(/\s+/g, " "); if (a.length < 2) { $("rt-msg").textContent = "Escribe un apodo de al menos 2 letras."; $("rt-apodo").focus(); return ""; } return a; }
  function raCompartir(codigo) {
    var t = raTipo2((raMios().find(function (x) { return x.codigo === codigo; }) || {}).tipo), url = location.origin + "/#reto=" + codigo;
    var txt = "Te reto: " + t.n + " (" + t.d + "). Únete en Finti con el código " + codigo + ". Solo se ven apodos y días cumplidos, nunca montos.";
    if (navigator.share) navigator.share({ title: "Reto en Finti", text: txt, url: url }).catch(function () {});
    else {
      var p = null; try { p = navigator.clipboard && navigator.clipboard.writeText(txt + " " + url); } catch (e) { p = null; }
      if (p && p.then) p.then(function () { toast("Copié la invitación. Pégala en WhatsApp."); }, function () { toast("Tu código es <b>" + codigo + "</b>. Compártelo con tus amigos."); });
      else toast("Tu código es <b>" + codigo + "</b>. Compártelo con tus amigos.");
    }
  }
  $("rt-crear").addEventListener("click", function () {
    var apodo = raApodo(); if (!apodo) return; var b = this; b.disabled = true; $("rt-msg").textContent = "Creando el reto…";
    raApi({ accion: "crear", tipo: raTipo, apodo: apodo, hoy: hoyStr() }).then(function (j) {
      var l = raMios(); l.push({ codigo: j.codigo, pid: j.pid, token: j.token, tipo: raTipo, apodo: apodo }); raGuardar(l);
      closeDlg("dlg-reto"); raRefrescar(); irA("metas"); raCompartir(j.codigo); metrica("reto_amigos", "una");
    }, function (e) { $("rt-msg").textContent = e.message; }).then(function () { b.disabled = false; });
  });
  $("rt-unirme").addEventListener("click", function () {
    var apodo = raApodo(); if (!apodo) return;
    var c = $("rt-codigo").value.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^RETO/, ""); if (!/^[A-Z2-9]{6}$/.test(c)) { $("rt-msg").textContent = "El código tiene la forma RETO-ABC234."; return; }
    c = "RETO-" + c; if (raMios().some(function (x) { return x.codigo === c; })) { $("rt-msg").textContent = "Ya estás en ese reto."; return; }
    raApi({ accion: "unirse", codigo: c, apodo: apodo, hoy: hoyStr() }).then(function (j) {
      var l = raMios(); l.push({ codigo: c, pid: j.pid, token: j.token, tipo: j.tipo, apodo: apodo }); raGuardar(l);
      closeDlg("dlg-reto"); irA("metas"); raRefrescar(); toast("¡Te uniste al reto!");
    }, function (e) { $("rt-msg").textContent = e.message; });
  });
  $("ra-lista").addEventListener("click", function (e) {
    var card = e.target.closest("[data-codigo]"); if (!card) return; var c = card.dataset.codigo, r = raMios().find(function (x) { return x.codigo === c; }); if (!r) return;
    if (e.target.closest("[data-ra-compartir]")) return raCompartir(c);
    if (e.target.closest("[data-ra-salir]")) { if (!confirm("¿Salir de este reto? Dejarás de verlo en tu app.")) return; raApi({ accion: "salir", codigo: c, pid: r.pid, token: r.token }).catch(function () {}); raGuardar(raMios().filter(function (x) { return x.codigo !== c; })); delete raCache[c]; renderRetosAmigos(); return; }
    if (e.target.closest("[data-ra-marcar]")) raApi({ accion: "marcar", codigo: c, pid: r.pid, token: r.token, hoy: hoyStr() }).then(function (j) { raCache[c] = j; renderRetosAmigos(); sonar("meta"); toast("¡Un día más! Sigue así."); }, function (er) { toast(esc(er.message)); });
  });
  $("ra-nuevo").addEventListener("click", function () { abrirReto(""); });
  $("btn-retos-menu").addEventListener("click", function () { cerrarMenu(); irA("metas"); raRefrescar(); setTimeout(function () { document.querySelector(".retos-amigos").scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" }); }, 60); });
  if (raMios().length) setTimeout(raRefrescar, 2500);
  (function () { var m = /^#reto=(RETO-[A-Za-z0-9]{6})$/.exec(location.hash || ""); if (m) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} setTimeout(function () { irA("metas"); abrirReto(m[1].toUpperCase()); }, 900); } })();

