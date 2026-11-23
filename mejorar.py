import re
p='Main.dc.html'; s=open(p).read()
def rep(a,b,n=1):
    global s
    c=s.count(a); assert c==n,(c,a[:90]); s=s.replace(a,b)

# ---------- Letras y props ----------
rep('family=Unbounded:wght@400;500;700&amp;family=Manrope:wght@400;500;700&amp;display=swap','family=Unbounded:wght@400;500;700&amp;family=Manrope:wght@400;500;700&amp;family=Schibsted+Grotesk:wght@400;500;700;800&amp;family=Chivo+Mono:wght@400;500;700&amp;display=swap')
rep('''"paleta":{"editor":"enum","options":["vibrante","electrico","jade","lima"],"default":"vibrante"},''','''"paleta":{"editor":"enum","options":["vibrante","electrico","jade","lima"],"default":"vibrante"},"estilo":{"editor":"enum","options":["vibrante","editorial"],"default":"vibrante"},"premium":{"editor":"boolean","default":false},''')
s=s.replace('font-family: Unbounded, sans-serif','font-family: {{ fx.t }}')
s=s.replace('font-family: Manrope, system-ui, sans-serif','font-family: {{ fx.b }}').replace('font-family: Manrope, sans-serif','font-family: {{ fx.b }}')
# Cifras con la letra de números
out=[]
for line in s.split('\n'):
    if '{{ fx.t }}' in line and re.search(r'\{\{ (hoy\.monto|qTexto|x\.montoTexto|m\.t|g\.pct|pend\.t|montoTexto|cat\.grande|k\.t|numPendientes|o\.montoTexto|d\.n|x\.monto) \}\}',line):
        line=line.replace('{{ fx.t }}','{{ fx.n }}')
    out.append(line)
s='\n'.join(out)

# ---------- Estado ----------
rep("      listo: false, qVis: 0\n    };","      listo: false, qVis: 0, estilo: props.estilo === 'editorial' ? 'editorial' : 'vibrante', premium: props.premium === true, cuentaHoja: 'efectivo'\n    };")
rep("      { id: 'p1', c: 'Restaurante del centro', m: 38000, f: 'Hoy, 1:20 p. m. · Tarjeta débito', cat: 'comida' },",
    "      { id: 'p1', c: 'Restaurante del centro', m: 38000, f: 'Hoy, 1:20 p. m.', banco: 'Bancolombia', cuenta: 'Tarjeta débito *1234', cat: 'comida' },")
rep("      { id: 'p2', c: 'Viaje en plataforma', m: 16500, f: 'Hoy, 8:05 a. m. · Tarjeta crédito', cat: 'transporte' },",
    "      { id: 'p2', c: 'Viaje en plataforma', m: 16500, f: 'Hoy, 8:05 a. m.', banco: 'Davivienda', cuenta: 'Tarjeta crédito *5678', cat: 'transporte' },")
rep("      { id: 'p3', c: 'Suscripción de música', m: 16900, f: 'Ayer · Tarjeta crédito', cat: 'salidas' },",
    "      { id: 'p3', c: 'Suscripción de música', m: 16900, f: 'Ayer', banco: 'Davivienda', cuenta: 'Tarjeta crédito *5678', cat: 'salidas' },")
rep("      { id: 'p4', c: 'Supermercado', m: 64300, f: 'Martes · Tarjeta débito', cat: 'comida' }",
    "      { id: 'p4', c: 'Supermercado', m: 64300, f: 'Martes', banco: 'Nequi', cuenta: 'Nequi', cat: 'comida' }")

# ---------- Tema: contraste y estilo editorial ----------
rep("""  tema() {
    if (this.state.tema === 'claro') return {""","""  ed() { return this.state.estilo === 'editorial'; }
  tema() {
    if (this.ed() && this.state.tema === 'claro') return {
      bg: '#FBFBF9', surf: '#FFFFFF', surf2: '#F3F3EF', surf3: '#EAEAE5', txt: '#111111', sec: '#4A4B50', track: '#E2E2DC',
      fabBg: '#1F3FFF', fabTxt: '#FFFFFF', vozBg: '#111111', vozTxt: '#FBFBF9', borde: '#E2E2DC', borde2: '#B9B9B1', nav: '#FFFFFF', mini: '#FFFFFF', hoja: '#FFFFFF', error: '#B3124E'
    };
    if (this.ed()) return {
      bg: '#0C0C0C', surf: '#171717', surf2: '#121212', surf3: '#222222', txt: '#F5F5F2', sec: '#B8B8B1', track: '#2E2E2E',
      fabBg: '#8FA2FF', fabTxt: '#0C0C0C', vozBg: '#F5F5F2', vozTxt: '#0C0C0C', borde: '#262626', borde2: '#4A4A4A', nav: '#0F0F0F', mini: '#1C1C1C', hoja: '#151515', error: '#FF8FA3'
    };
    if (this.state.tema === 'claro') return {""")
rep("txt: '#14121F', sec: '#5B576B'","txt: '#14121F', sec: '#4B4759'")
rep("txt: '#F4F2FF', sec: '#A9A6BD'","txt: '#F4F2FF', sec: '#BEBBD1'")
# Paleta editorial: tinta, grises y un azul (el azul es el ahorro)
rep("  pal(id, custom) {\n","""  palVista() {
    if (!this.ed()) return this.pal(this.state.paleta);
    return this.state.tema === 'claro'
      ? { n: 'Editorial', b: '#1F3FFF', f: '#FFFFFF', m: '#1F3FFF', c: ['#111111', '#6B6B66', '#B5B5AE', '#7E95FF', '#1F3FFF'] }
      : { n: 'Editorial', b: '#8FA2FF', f: '#0C0C0C', m: '#8FA2FF', c: ['#F2F2EE', '#9C9C95', '#5C5C57', '#4F68F0', '#8FA2FF'] };
  }
  pal(id, custom) {
""")
rep("var pA = this.pct(ahorro), P = this.pal(this.state.paleta);","var pA = this.pct(ahorro), P = this.palVista();")

# ---------- renderVals: colores de la vista, letras, tamaños ----------
rep("""    var self = this, s = this.state, f = this.fecha(), t = this.tema();
    var k = s.grande ? 1.18 : 1;""","""    var self = this, s = this.state, f = this.fecha(), t = this.tema(), ED = this.ed(), PV = this.palVista();
    var ORD = ['comida', 'transporte', 'hogar', 'salidas', 'ahorro'], IDX = { portatil: 3, viaje: 1, emergencia: 0 };
    var cv = ED ? s.cats.map(function (c) { var col = PV.c[ORD.indexOf(c.id)]; return Object.assign({}, c, { color: col, tinta: self.tintaDe(col) }); }) : s.cats;
    var mv = ED ? s.metas.map(function (g) { var col = PV.c[IDX[g.id]]; return Object.assign({}, g, { color: col, tinta: self.tintaDe(col) }); }) : s.metas;
    var catPorV = function (id) { return cv.filter(function (c) { return c.id === id; })[0] || null; };
    var fx = ED ? { t: "'Schibsted Grotesk', sans-serif", n: "'Chivo Mono', monospace", b: "'Schibsted Grotesk', sans-serif" } : { t: 'Unbounded, sans-serif', n: 'Unbounded, sans-serif', b: 'Manrope, sans-serif' };
    var ICON = { comida: 'M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-2.5 2-2.5 7 0 8v10', transporte: 'M6 17h12V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2zM6 12h12M8 20v-3M16 20v-3', hogar: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', salidas: 'M8 3h8l-1 8a3 3 0 0 1-6 0zM12 14v6M8 21h8', ahorro: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M15 9.5h-4a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H9' };
    var k = s.grande ? 1.18 : 1;""")
# Letra mínima más legible: 11 → 12 y 12 → 13
rep("[11, 12, 13, 14, 15, 16, 17, 18, 20, 24, 26, 30, 40, 44].forEach(function (n) { fz['a' + n] = Math.round(n * k) + 'px'; });",
    "[11, 12, 13, 14, 15, 16, 17, 18, 20, 24, 26, 30, 40, 44].forEach(function (n) { fz['a' + n] = Math.round((n === 11 ? 12 : n === 12 ? 13 : n) * k) + 'px'; });")
# dentro de renderVals, usar los colores de la vista
i=s.index('  renderVals() {'); j=s.index('\n  }\n}\n</script>',i)
rv=s[i:j]
rv=rv.replace('var cv = ED ? s.cats.map','var cv = ED ? CATS_ORIG.map').replace('var mv = ED ? s.metas.map','var mv = ED ? METAS_ORIG.map')
rv=rv.replace('s.cats','cv').replace('s.metas','mv').replace('this.catPor(','catPorV(')
rv=rv.replace('var cv = ED ? CATS_ORIG.map','var cv = ED ? s.cats.map').replace('var mv = ED ? METAS_ORIG.map','var mv = ED ? s.metas.map').replace(' : cv;\n',' : s.cats;\n').replace(' : mv;\n',' : s.metas;\n')
s=s[:i]+rv+s[j:]

# Tarjetas de categoría: color sólido (vibrante) o tarjeta clara con raya de color (editorial)
rep("""        nombre: c.nombre, color: c.color, tinta: c.tinta, d: c.d, linea: linea,""","""        nombre: c.nombre, color: c.color, tinta: c.tinta, d: c.d, linea: linea,
        fondo: ED ? t.surf : c.color, texto: ED ? t.txt : c.tinta, raya: ED ? '6px' : '0px', borde: ED ? '1px solid ' + t.borde : 'none',
        pista: ED ? t.track : 'rgba(20,18,31,0.18)', barra: ED ? c.color : c.tinta, formaOp: ED ? '0' : '0.14',""")
# Centro del anillo: el porcentaje del plan, no otra cifra en pesos
rep("""      qEtiqueta = q >= 0 ? 'Te quedan' : 'Te pasaste';
      qTexto = this.fmt(s.listo ? s.qVis : q * 0.55);
      sub = f.faltan === 1 ? 'Falta 1 día' : 'Faltan ' + f.faltan + ' días';""","""      var gastG = cv.filter(function (c) { return !c.meta; }), usado = gastG.reduce(function (a, c) { return a + c.gastado; }, 0) / Math.max(1, gastG.reduce(function (a, c) { return a + c.ppto; }, 0));
      qEtiqueta = 'Llevas del plan';
      qTexto = this.porc(s.listo ? usado : usado * 0.55);
      sub = 'y va el ' + this.porc(f.dia / (f.dia + f.faltan)) + ' del mes';""")
# Pantalla de la categoría
rep("""      nombre: c.nombre, color: c.color, tinta: c.tinta, d: c.d,
      etiquetaGrande:""","""      nombre: c.nombre, color: c.color, tinta: c.tinta, d: c.d,
      fondo: ED ? t.surf : c.color, texto: ED ? t.txt : c.tinta, anillo: ED ? c.color : c.tinta, formaOp: ED ? '0' : '0.12', volverBg: ED ? t.surf2 : 'rgba(20,18,31,0.16)',
      btnBg: ED ? t.fabBg : c.color, btnTxt: ED ? t.fabTxt : c.tinta, raya: ED ? '6px' : '0px',
      etiquetaGrande:""")
# Movimientos: ícono de la categoría y separados por día
rep("""    var listaMovs = filtrados.map(function (x) { return { c: x.m.c, sub: x.cat.nombre + ' · ' + x.m.f, t: self.fmt(x.m.m), color: x.cat.color, tinta: x.cat.tinta, inicial: x.cat.nombre.charAt(0) }; });""",
"""    var listaMovs = [], diaAnt = null;
    filtrados.forEach(function (x) {
      if (x.m.f !== diaAnt) { listaMovs.push({ esDia: true, esMov: false, dia: x.m.f }); diaAnt = x.m.f; }
      listaMovs.push({ esDia: false, esMov: true, c: x.m.c, sub: x.cat.nombre, t: self.fmt(x.m.m), color: x.cat.color, tinta: x.cat.tinta, icono: ICON[x.cat.id],
        avFondo: ED ? 'transparent' : x.cat.color, avTinta: ED ? x.cat.color : x.cat.tinta, avBorde: ED ? '2px solid ' + x.cat.color : 'none' });
    });""")
# Metas: porcentaje en la misma fila, abono sugerido y 1 meta gratis
rep("""    var metas = mv.map(function (g) {
      var p = Math.min(1, g.llevas / g.meta), lista = g.llevas >= g.meta;
      return {
        nombre: g.nombre, color: g.color, tinta: g.tinta, pct: self.porc(p),
        linea: lista ? '¡Cumplida! ' + self.fmt(g.meta) : 'Llevas ' + self.fmt(g.llevas) + ' de ' + self.fmt(g.meta),
        dash: (Cm * p).toFixed(1) + ' ' + Cm.toFixed(1), boton: lista ? 'Crear otra meta' : 'Abonar ' + self.fmt(100000),""","""    var metasTodas = mv.map(function (g) {
      var p = Math.min(1, g.llevas / g.meta), lista = g.llevas >= g.meta, falta = Math.max(0, g.meta - g.llevas);
      var sugerido = Math.min(falta, Math.max(20000, Math.ceil(falta / 6 / 10000) * 10000));
      return {
        nombre: g.nombre, color: g.color, tinta: g.tinta, pct: self.porc(p),
        fondo: ED ? t.surf : g.color, texto: ED ? t.txt : g.tinta, anillo: ED ? g.color : g.tinta, btnBg: ED ? t.fabBg : g.tinta, btnTxt: ED ? t.fabTxt : g.color,
        borde: ED ? '1px solid ' + t.borde : 'none', raya: ED ? '6px' : '0px',
        linea: lista ? '¡Cumplida! ' + self.fmt(g.meta) : 'Llevas ' + self.fmt(g.llevas) + ' de ' + self.fmt(g.meta),
        ayuda: lista ? '' : 'Con ' + self.fmt(sugerido) + ' al mes llegas en ' + Math.max(1, Math.ceil(falta / sugerido)) + (Math.ceil(falta / sugerido) === 1 ? ' mes' : ' meses'),
        dash: (Cm * p).toFixed(1) + ' ' + Cm.toFixed(1), boton: lista ? 'Crear otra meta' : 'Abonar ' + self.fmt(sugerido),""")
rep("""    var faltaMetas = mv.reduce(""","""    var metas = s.premium ? metasTodas : metasTodas.slice(0, 1);
    var bloqueadas = s.premium ? [] : metasTodas.slice(1);
    var faltaMetas = mv.reduce(""")
# Por confirmar: de qué banco y cuenta viene
rep("""      c: p0 ? p0.c : '', t: p0 ? this.fmt(p0.m) : '', f: p0 ? p0.f : '',""","""      c: p0 ? p0.c : '', t: p0 ? this.fmt(p0.m) : '', f: p0 ? p0.f : '', banco: p0 ? p0.banco : '', cuenta: p0 ? p0.cuenta : '', bancoInicial: p0 ? p0.banco.charAt(0) : '',""")
# Registrar: cuenta y fecha
rep("""    var teclas = ['1',""","""    var cuentasHoja = [['efectivo', 'Efectivo'], ['nequi', 'Nequi'], ['tarjeta', 'Tarjeta débito']].map(function (x) {
      var sel = s.cuentaHoja === x[0];
      return { n: x[1], pressed: sel ? 'true' : 'false', fondo: sel ? t.txt : 'transparent', texto: sel ? t.bg : t.txt, borde: sel ? t.txt : t.borde2, elegir: function () { self.sonar('toque'); self.setState({ cuentaHoja: x[0] }); } };
    });
    var teclas = ['1',""")
# Perfil: estilo, Premium y el menú
rep("""    var iconos = {""","""    var estilos = [['vibrante', 'Vibrante'], ['editorial', 'Editorial']].map(function (x) {
      var sel = s.estilo === x[0];
      return { n: x[1], pressed: sel ? 'true' : 'false', fondo: sel ? t.txt : 'transparent', texto: sel ? t.bg : t.txt, elegir: function () { self.sonar('toque'); self.setState({ estilo: x[0] }); } };
    });
    var menuPerfil = ['Tu presupuesto', 'Análisis', 'Cuentas y pagos', 'Conectar bancos', 'Avisos y recordatorios', 'Pregúntale', 'Herramientas', 'Tus historias', 'Ayuda y privacidad'].map(function (n) { return { n: n }; });
    var iconos = {""")
rep("""      tarjetas: tarjetas,""","""      tarjetas: tarjetas, fx: fx, ed: ED, noEd: !ED, mesChip: f.mes.charAt(0).toUpperCase() + f.mes.slice(1),
      bloqueadas: bloqueadas, hayBloqueadas: bloqueadas.length > 0, bloqueadasTitulo: bloqueadas.length === 1 ? 'Tu otra meta' : 'Tus otras ' + bloqueadas.length + ' metas',
      bloqueadasNombres: bloqueadas.map(function (g) { return g.nombre; }).join(', '),
      cuentasHoja: cuentasHoja, estilos: estilos, menuPerfil: menuPerfil, esPremium: s.premium, noPremium: !s.premium,""")
open(p,'w').write(s)
print('js ok')
