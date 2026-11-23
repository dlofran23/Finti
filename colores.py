p='Main.dc.html'; s=open(p).read()
def rep(a,b,n=1):
    global s
    c=s.count(a); assert c==n,(c,a[:100]); s=s.replace(a,b)
i=s.index('  renderVals() {'); j=s.index('\n  }\n}\n</script>',i)
rv=s[i:j]
rv=rv.replace("'#19C3A0'","SC.ok").replace("'#FFC53D'","SC.warn").replace("'#FF5C9A'","SC.bad").replace("'#7C5CFF'","PV.b").replace("self.catPor(","catPorV(").replace("marca: this.pal(s.paleta),","marca: PV,")
rv=rv.replace("    var k = s.grande ? 1.18 : 1;","""    var claro = s.tema === 'claro';
    var SC = ED ? { ok: PV.b, okTxt: PV.f, warn: claro ? '#111111' : '#F5F5F2', bad: claro ? '#C8102E' : '#FF6B7A', badgeBg: PV.b, badgeTxt: PV.f, avisoBg: claro ? '#E8ECFF' : '#1A2140', avisoTxt: claro ? '#111111' : '#DCE2FF' }
      : { ok: '#19C3A0', okTxt: '#03251D', warn: '#FFC53D', bad: '#FF5C9A', badgeBg: '#FFC53D', badgeTxt: '#2B1E00', avisoBg: '#FFC53D', avisoTxt: '#2B1E00' };
    var k = s.grande ? 1.18 : 1;""",1)
rv=rv.replace("tarjetas: tarjetas, fx: fx,","tarjetas: tarjetas, fx: fx, sc: SC,")
s=s[:i]+rv+s[j:]
rep('background: #FFC53D; color: #2B1E00; font-family: {{ fx.n }}','background: {{ sc.badgeBg }}; color: {{ sc.badgeTxt }}; font-family: {{ fx.n }}')
rep('border: 3px solid #19C3A0; color: #19C3A0;','border: 3px solid {{ sc.ok }}; color: {{ sc.ok }};')
rep('border: 3px solid #FF5C9A; color: #FF5C9A;','border: 3px solid {{ sc.bad }}; color: {{ sc.bad }};')
rep('border: 2px solid #FF5C9A; background: transparent;','border: 2px solid {{ sc.bad }}; background: transparent;')
rep('border: none; background: #19C3A0; color: #03251D;','border: none; background: {{ sc.ok }}; color: {{ sc.okTxt }};')
rep('border-radius: 48px; background: #19C3A0;','border-radius: 48px; background: {{ sc.ok }};')
rep('<div class="voz" role="status" style="background: #FFC53D; color: #2B1E00;','<div class="voz" role="status" style="background: {{ sc.avisoBg }}; color: {{ sc.avisoTxt }};')
open(p,'w').write(s); print('ok', s.count('#19C3A0'))
