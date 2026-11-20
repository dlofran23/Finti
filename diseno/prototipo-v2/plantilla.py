import re
p='Main.dc.html'; s=open(p).read()
def rep(a,b,n=1):
    global s
    c=s.count(a); assert c==n,(c,a[:100]); s=s.replace(a,b)
def bloque(ini, fin_marker):
    i=s.index(ini); j=s.index(fin_marker,i)+len(fin_marker); return i,j

# ---------- Inicio: encabezado con el mes, saludo en una línea ----------
rep("""<span style="font-family: {{ fx.t }}; font-size: {{ fz.a20 }}; font-weight: 700; letter-spacing: -0.02em">{{ nombre }}</span></span>""",
"""<span style="font-family: {{ fx.t }}; font-size: {{ fz.a20 }}; font-weight: 700; letter-spacing: -0.02em">{{ nombre }}</span><button class="resorte tema" aria-label="Cambiar de mes" style="margin-left: 4px; min-height: 32px; padding: 0 10px; border-radius: 16px; border: 1px solid {{ t.borde2 }}; background: transparent; color: {{ t.txt }}; font-family: {{ fx.b }}; font-size: {{ fz.a13 }}; font-weight: 700; display: flex; align-items: center; gap: 4px">{{ mesChip }}<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round"><path d="M6 9l6 6 6-6"></path></svg></button></span>""")
i=s.index('      <button class="resorte tema" onClick="{{ tocarSaludo }}"'); j=s.index('</button>',i)+len('</button>')
s=s[:i]+"""      <p class="tema" style="margin: 2px 4px 0; font-size: {{ fz.a15 }}; line-height: 1.4"><span style="color: {{ t.sec }}">{{ saludo }}.</span> {{ estadoTexto }}</p>"""+s[j:]

# ---------- Tarjetas de categoría ----------
rep("""border: none; border-radius: 22px; background: {{ c.color }}; color: {{ c.tinta }}; text-align: left; padding: 14px;""",
    """border: {{ c.borde }}; border-radius: 22px; background: {{ c.fondo }}; color: {{ c.texto }}; text-align: left; padding: 14px;""")
rep("""            <svg width="140" height="112" viewBox="0 0 140 112" aria-hidden="true" style="position: absolute; right: 0; bottom: 0"><path d="{{ c.d }}" style="fill: {{ c.tinta }}; opacity: 0.14; fill-rule: evenodd"></path></svg>""",
    """            <span style="position: absolute; left: 0; right: 0; top: 0; height: {{ c.raya }}; background: {{ c.color }}; display: block"></span>
            <svg width="140" height="112" viewBox="0 0 140 112" aria-hidden="true" style="position: absolute; right: 0; bottom: 0"><path d="{{ c.d }}" style="fill: {{ c.tinta }}; opacity: {{ c.formaOp }}; fill-rule: evenodd"></path></svg>""")
rep("""              <span style="height: 6px; border-radius: 3px; background: rgba(20,18,31,0.18); overflow: hidden; display: block">
                <span class="barra" style="display: block; height: 6px; border-radius: 3px; background: {{ c.tinta }}; width: {{ c.ancho }}"></span>""",
    """              <span style="height: 6px; border-radius: 3px; background: {{ c.pista }}; overflow: hidden; display: block">
                <span class="barra" style="display: block; height: 6px; border-radius: 3px; background: {{ c.barra }}; width: {{ c.ancho }}"></span>""")

# ---------- Movimientos: buscar, día por día, ícono ----------
rep("""      <span style="font-size: {{ fz.a14 }}; color: {{ t.sec }}">{{ movsResumen }}</span>
    </div>""","""      <span style="font-size: {{ fz.a14 }}; color: {{ t.sec }}">{{ movsResumen }}</span>
    </div>
    <div style="padding: 0 16px 6px"><span class="tema" style="display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 0 14px; border-radius: 16px; background: {{ t.surf2 }}; color: {{ t.sec }}; font-size: {{ fz.a15 }}"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path></svg>Buscar un movimiento</span></div>""")
i=s.index('      <sc-for list="{{ listaMovs }}" as="m"'); j=s.index('</sc-for>',i)+len('</sc-for>')
s=s[:i]+"""      <sc-for list="{{ listaMovs }}" as="m" hint-placeholder-count="6">
        <sc-if value="{{ m.esDia }}" hint-placeholder-val="{{ false }}">
          <span style="font-size: {{ fz.a13 }}; font-weight: 700; color: {{ t.sec }}; padding: 8px 4px 0; text-transform: uppercase; letter-spacing: 0.06em">{{ m.dia }}</span>
        </sc-if>
        <sc-if value="{{ m.esMov }}" hint-placeholder-val="{{ true }}">
        <div class="entra-pantalla tema" style="display: flex; align-items: center; gap: 12px; background: {{ t.surf2 }}; border-radius: 16px; padding: 12px 14px">
          <span style="width: 40px; height: 40px; border-radius: 12px; background: {{ m.avFondo }}; border: {{ m.avBorde }}; color: {{ m.avTinta }}; flex: none; display: flex; align-items: center; justify-content: center; box-sizing: border-box"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round"><path d="{{ m.icono }}"></path></svg></span>
          <span style="flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0">
            <span style="font-size: {{ fz.a15 }}; font-weight: 500">{{ m.c }}</span>
            <span style="font-size: {{ fz.a12 }}; color: {{ t.sec }}">{{ m.sub }}</span>
          </span>
          <span style="font-family: {{ fx.n }}; font-size: {{ fz.a14 }}; font-weight: 500">{{ m.t }}</span>
        </div>
        </sc-if>
      </sc-for>"""+s[j:]

# ---------- Metas ----------
i=s.index('      <sc-for list="{{ metas }}" as="g"'); j=s.index('</sc-for>',i)+len('</sc-for>')
s=s[:i]+"""      <sc-for list="{{ metas }}" as="g" hint-placeholder-count="1">
        <div class="entra-pantalla" style="position: relative; overflow: hidden; background: {{ g.fondo }}; color: {{ g.texto }}; border: {{ g.borde }}; border-radius: 24px; padding: 16px; display: flex; gap: 14px; align-items: center">
          <span style="position: absolute; left: 0; right: 0; top: 0; height: {{ g.raya }}; background: {{ g.color }}; display: block"></span>
          <svg width="76" height="76" viewBox="0 0 120 120" aria-hidden="true" style="transform: rotate(-90deg); flex: none">
            <circle cx="60" cy="60" r="48" style="fill: none; stroke: {{ g.anillo }}; opacity: 0.2; stroke-width: 14"></circle>
            <circle class="trazo" cx="60" cy="60" r="48" style="fill: none; stroke: {{ g.anillo }}; stroke-width: 14; stroke-linecap: round; stroke-dasharray: {{ g.dash }}"></circle>
          </svg>
          <div style="flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0">
            <span style="display: flex; align-items: baseline; gap: 8px"><span style="flex: 1; min-width: 0; font-family: {{ fx.t }}; font-size: {{ fz.a15 }}; font-weight: 700">{{ g.nombre }}</span><span style="font-family: {{ fx.n }}; font-size: {{ fz.a14 }}; font-weight: 700">{{ g.pct }}</span></span>
            <span style="font-size: {{ fz.a13 }}; font-weight: 700">{{ g.linea }}</span>
            <span style="font-size: {{ fz.a13 }}; opacity: 0.85">{{ g.ayuda }}</span>
            <button class="resorte" onClick="{{ g.abonar }}" style="align-self: flex-start; min-height: 40px; padding: 0 14px; border-radius: 20px; border: none; background: {{ g.btnBg }}; color: {{ g.btnTxt }}; font-family: {{ fx.b }}; font-size: {{ fz.a13 }}; font-weight: 700">{{ g.boton }}</button>
          </div>
        </div>
      </sc-for>
      <sc-if value="{{ hayBloqueadas }}" hint-placeholder-val="{{ true }}">
        <div class="tema" style="border: 2px dashed {{ t.borde2 }}; border-radius: 24px; padding: 16px; display: flex; flex-direction: column; gap: 8px">
          <span style="display: flex; align-items: center; gap: 8px; font-family: {{ fx.t }}; font-size: {{ fz.a15 }}; font-weight: 700"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>{{ bloqueadasTitulo }}</span>
          <span style="font-size: {{ fz.a14 }}; color: {{ t.sec }}; line-height: 1.4">{{ bloqueadasNombres }}. Con Premium tienes todas las metas que quieras.</span>
          <button class="resorte" style="align-self: flex-start; min-height: 40px; padding: 0 16px; border-radius: 20px; border: none; background: {{ t.fabBg }}; color: {{ t.fabTxt }}; font-family: {{ fx.b }}; font-size: {{ fz.a13 }}; font-weight: 700">Ver Premium</button>
        </div>
      </sc-if>"""+s[j:]

# ---------- Perfil ----------
rep("""        <span style="font-size: {{ fz.a14 }}; color: {{ t.sec }}">Así se ve y suena tu app</span>""","""        <span style="font-size: {{ fz.a14 }}; color: {{ t.sec }}">Tus ajustes y todo lo demás</span>""")
rep("""      <sc-for list="{{ ajustes }}" as="a" hint-placeholder-count="3">""","""      <div class="tema" style="background: {{ t.surf2 }}; border-radius: 18px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px">
        <span style="font-size: {{ fz.a16 }}; font-weight: 700">Estilo de la app</span>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
          <sc-for list="{{ estilos }}" as="e" hint-placeholder-count="2">
            <button class="resorte" onClick="{{ e.elegir }}" aria-pressed="{{ e.pressed }}" style="min-height: 44px; border-radius: 22px; border: 2px solid {{ t.txt }}; background: {{ e.fondo }}; color: {{ e.texto }}; font-family: {{ fx.b }}; font-size: {{ fz.a14 }}; font-weight: 700">{{ e.n }}</button>
          </sc-for>
        </div>
      </div>
      <sc-for list="{{ ajustes }}" as="a" hint-placeholder-count="3">""")
rep("""      <div class="tema" style="background: {{ t.surf2 }}; border-radius: 18px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px">
        <span style="font-size: {{ fz.a16 }}; font-weight: 700">Paleta de colores</span>""","""      <sc-if value="{{ noEd }}" hint-placeholder-val="{{ true }}">
      <div class="tema" style="background: {{ t.surf2 }}; border-radius: 18px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px">
        <span style="font-size: {{ fz.a16 }}; font-weight: 700">Paleta de colores</span>""")
i=s.index("""      <div class="tema" style="background: {{ t.surf2 }}; border-radius: 18px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px">
        <span style="font-size: {{ fz.a13 }}; color: {{ t.sec }}">Nombre de la app (provisional)</span>""")
j=s.index('</div>',i)+len('</div>')
s=s[:i]+"""      </sc-if>
      <sc-if value="{{ noPremium }}" hint-placeholder-val="{{ true }}">
      <button class="resorte" style="display: flex; align-items: center; gap: 12px; border: none; border-radius: 18px; padding: 14px 16px; background: {{ marca.b }}; color: {{ marca.f }}; text-align: left; font-family: {{ fx.b }}">
        <span style="flex: 1; display: flex; flex-direction: column; gap: 3px"><span style="font-family: {{ fx.t }}; font-size: {{ fz.a16 }}; font-weight: 700">Finti Premium</span><span style="font-size: {{ fz.a13 }}; line-height: 1.4">Metas ilimitadas, historial completo y el asesor. Un solo pago.</span></span>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round"><path d="M9 5l7 7-7 7"></path></svg>
      </button>
      </sc-if>
      <div class="tema" style="background: {{ t.surf2 }}; border-radius: 18px; padding: 6px 0; display: flex; flex-direction: column">
        <span style="display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 16px; font-size: {{ fz.a15 }}; font-weight: 700">Guardar en la nube<span style="margin-left: auto; font-size: {{ fz.a13 }}; font-weight: 500; color: {{ t.sec }}">Con Google o tu correo</span></span>
      </div>
      <div class="tema" style="background: {{ t.surf2 }}; border-radius: 18px; padding: 6px 0; display: flex; flex-direction: column">
        <sc-for list="{{ menuPerfil }}" as="o" hint-placeholder-count="9">
          <span style="display: flex; align-items: center; min-height: 50px; padding: 0 16px; font-size: {{ fz.a15 }}; border-bottom: 1px solid {{ t.borde }}">{{ o.n }}<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="margin-left: auto; fill: none; stroke: {{ t.sec }}; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round"><path d="M9 5l7 7-7 7"></path></svg></span>
        </sc-for>
      </div>"""+s[j:]

# ---------- Pantalla de la categoría ----------
rep("""  <div style="background: {{ cat.color }}; color: {{ cat.tinta }}; padding: 18px 20px 28px;""","""  <div style="background: {{ cat.fondo }}; color: {{ cat.texto }}; border-bottom: 1px solid {{ t.borde }}; padding: 18px 20px 28px;""")
rep("""<path d="{{ cat.d }}" style="fill: {{ cat.tinta }}; opacity: 0.12; fill-rule: evenodd"></path>""","""<path d="{{ cat.d }}" style="fill: {{ cat.tinta }}; opacity: {{ cat.formaOp }}; fill-rule: evenodd"></path>""")
rep("""background: rgba(20,18,31,0.16); color: {{ cat.tinta }}; display: flex""","""background: {{ cat.volverBg }}; color: {{ cat.texto }}; display: flex""")
rep("""        <circle cx="60" cy="60" r="48" style="fill: none; stroke: {{ cat.tinta }}; opacity: 0.18; stroke-width: 14"></circle>
        <circle class="trazo" cx="60" cy="60" r="48" style="fill: none; stroke: {{ cat.tinta }}; stroke-width: 14;""","""        <circle cx="60" cy="60" r="48" style="fill: none; stroke: {{ cat.anillo }}; opacity: 0.18; stroke-width: 14"></circle>
        <circle class="trazo" cx="60" cy="60" r="48" style="fill: none; stroke: {{ cat.anillo }}; stroke-width: 14;""")
rep("""bottom: 20px; height: 56px; border: none; border-radius: 28px; background: {{ cat.color }}; color: {{ cat.tinta }};""","""bottom: 20px; height: 56px; border: none; border-radius: 28px; background: {{ cat.btnBg }}; color: {{ cat.btnTxt }};""")

# ---------- Por confirmar ----------
rep("""Los encontré en tus correos del banco. Desliza a la derecha si está bien y a la izquierda si no es tuyo.</p>""","""Llegaron de tus bancos. Desliza a la derecha si está bien y a la izquierda si no es tuyo.</p>""")
rep("""        <span style="font-size: {{ fz.a18 }}; font-weight: 700">{{ pend.c }}</span>""","""        <span style="display: flex; align-items: center; gap: 10px"><span style="width: 32px; height: 32px; border-radius: 10px; background: {{ t.surf3 }}; display: flex; align-items: center; justify-content: center; font-family: {{ fx.t }}; font-size: {{ fz.a14 }}; font-weight: 700">{{ pend.bancoInicial }}</span><span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: {{ fz.a14 }}; font-weight: 700">{{ pend.banco }}</span><span style="font-size: {{ fz.a13 }}; color: {{ t.sec }}">{{ pend.cuenta }}</span></span></span>
        <span style="font-size: {{ fz.a18 }}; font-weight: 700">{{ pend.c }}</span>""")
rep("""        <span style="font-size: {{ fz.a13 }}; color: {{ t.sec }}">{{ pend.f }}</span>
      </div>""","""        <span style="font-size: {{ fz.a13 }}; color: {{ t.sec }}">{{ pend.f }}</span>
        <span style="display: flex; align-items: center; gap: 10px; margin-top: auto; padding-top: 10px; border-top: 1px solid {{ t.borde }}; font-size: {{ fz.a13 }}"><span style="flex: 1">Es entre mis cuentas (no cuenta como gasto)</span><span style="width: 44px; height: 26px; border-radius: 13px; background: {{ t.track }}; position: relative; display: block"><span style="position: absolute; left: 3px; top: 3px; width: 20px; height: 20px; border-radius: 10px; background: #FFFFFF; display: block"></span></span></span>
      </div>""")
rep("""    <div style="position: relative; height: 290px">""","""    <span style="align-self: flex-start; font-size: {{ fz.a14 }}; font-weight: 700; color: {{ marca.b }}">Pegar un aviso del banco</span>
    <div style="position: relative; height: 330px">""")

# ---------- Registrar: cuenta y fecha ----------
rep("""    <sc-if value="{{ hayError }}" hint-placeholder-val="{{ false }}">
      <span role="alert" style="text-align: center;""","""    <div style="display: flex; gap: 8px; align-items: center; overflow-x: auto">
      <span style="font-size: {{ fz.a13 }}; color: {{ t.sec }}; flex: none">Salió de</span>
      <sc-for list="{{ cuentasHoja }}" as="a" hint-placeholder-count="3">
        <button class="resorte" onClick="{{ a.elegir }}" aria-pressed="{{ a.pressed }}" style="flex: none; min-height: 36px; padding: 0 12px; border-radius: 18px; border: 1px solid {{ a.borde }}; background: {{ a.fondo }}; color: {{ a.texto }}; font-family: {{ fx.b }}; font-size: {{ fz.a13 }}; font-weight: 700">{{ a.n }}</button>
      </sc-for>
      <span style="flex: none; margin-left: auto; min-height: 36px; padding: 0 12px; border-radius: 18px; border: 1px solid {{ t.borde2 }}; display: flex; align-items: center; font-size: {{ fz.a13 }}; font-weight: 700">Hoy</span>
    </div>
    <sc-if value="{{ hayError }}" hint-placeholder-val="{{ false }}">
      <span role="alert" style="text-align: center;""")
# teclas un poco más bajas para que quepa la fila nueva
rep("""style="height: 52px; border: none; border-radius: 16px; background: {{ t.surf3 }};""","""style="height: 48px; border: none; border-radius: 16px; background: {{ t.surf3 }};""")
open(p,'w').write(s)
print('plantilla ok')
