#!/usr/bin/env python3
"""Revisa la ortografía de los textos que ve la persona (app web, páginas legales, correos y app de Android)
con las normas de la RAE que más se equivocan. Guía completa: claude/guia-ortografia.md del proyecto.

Uso:  python3 herramientas/ortografia.py          (falla con código 1 si encuentra errores)
      python3 herramientas/ortografia.py --todo   (también muestra las advertencias)
"""
import html
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ARCHIVOS = (
    [RAIZ / "public" / "index.html", RAIZ / "public" / "app.js", RAIZ / "public" / "panel.html", RAIZ / "public" / "historia" / "historia.js", RAIZ / "public" / "historia" / "tarjetas3d.js"]
    + sorted((RAIZ / "legal").glob("*.html"))
    + sorted((RAIZ / "netlify").rglob("*.mjs"))
    + sorted((RAIZ / "correo-worker").rglob("*.js"))
    + sorted((RAIZ / "android").rglob("*.java"))
    + sorted((RAIZ / "android").rglob("strings.xml"))
)
ARCHIVOS = [a for a in ARCHIVOS if a.exists() and "/test/" not in str(a) and "node_modules" not in str(a)]

# Después de dos puntos va minúscula, salvo nombres propios, nombres de pantallas o botones de la app y
# palabras enunciadoras (Nota:, Ejemplo:).
PROPIOS = set("""Nequi Daviplata Davivienda Bancolombia Google Gmail Outlook Android iPhone Apple Fintelligente Premium Wompi
Netlify Chrome Safari Excel Atajos MacroDroid Play Store Nu Lulo Falabella BBVA Banco Bogotá Occidente Colpatria Itaú Mensajes
Configuración Ajustes Por Conectar Registrar Avisos Inicio Metas Cuentas Historial Pegar Activar Abrir Permitir Copia Tu Mis
Agregar Instalar Enviar Guardar Ver Entrar Revisar Crear Descargar Compartir Notificación Alertas Filtrar Reenviar Ejecutar
Obtener Automatización Centro Efectivo Sin Mantener Ruedas Nota Ejemplo Advertencia Importante Recuerda Hola Estimado
Estimada Asunto Ley Decreto Circular Superintendencia DANE DIAN SIC Netflix Spotify Rappi Uber Nubank Lunes Martes""".split())

ERRORES = [
    ("E.A. sin espacio (es E. A.)", re.compile(r"\bE\.A\.")),
    ("cifra con 'mil' (escribe $ 50.000; con millones sí: 4,9 millones)", re.compile(r"\d\s+mil\b(?!lones)")),
    ("la M no es símbolo de millón", re.compile(r"\d\s?M\b(?![a-zá])")),
    ("punto después de ? o !", re.compile(r"[?!]\.(?![\w.])")),
    ("tilde que ya no va (solo, este, guion)", re.compile(r"\b(sólo|éste|ésta|éstos|éstas|ése|ésa|aquél|guión|truhán)\b")),
    ("'aun así' (incluso) va sin tilde", re.compile(r"\baún así\b")),
    ("hora en inglés (usa a. m. o p. m.)", re.compile(r"\d\s?(AM|PM|am|pm)\b|\ba\.m\.|\bp\.m\.")),
    ("comillas angulares: en la app se usan comillas dobles", re.compile(r"[«»]")),
    ("tres puntos: usa el carácter …", re.compile(r"[a-záéíóúñ]\.\.\.(?!\.)")),
    ("porcentaje sin espacio (20 %)", re.compile(r"(?<![\w-])\d+%(?![\w;)\"'])")),
]

# Reglas que se pueden aplicar a la línea completa sin confundirse con código.
CRUDOS = [
    ("mes abreviado sin punto (en., feb., mar., abr., may., jun., jul., ag., sept., oct., nov., dic.)", re.compile(r"[\"'](ene|feb|mar|abr|jun|jul|ago|sep|oct|nov|dic)[\"']")),
    ("cifra con 'mil' (escribe $ 50.000)", re.compile(r">[^<]*\d\s+mil\s*<|[\"']\s?mil[\"']")),
    ("la M no es símbolo de millón (escribe mill. o millones)", re.compile(r"[\"']\s+M[\"']")),
]
# Gramática (Libro de estilo de la RAE y Diccionario panhispánico de dudas): errores claros.
GRAMATICA = [
    ("dequeísmo: sobra el 'de' (pienso que, creo que)", re.compile(r"\b(?:pienso|piensa|creo|cree|creemos|opino|considero|parece|parecía|dijo|dice|decimos|espero|esperamos|resulta|supone|significa|indica|sabemos) de que\b")),
    ("queísmo: falta el 'de' (darse cuenta de que, estar seguro de que, asegúrate de que, a pesar de que, en caso de que)", re.compile(r"\b(?:cuenta|segur[oa]s?|acuérdate|acuerdas|acordarte|olvides|olvidarte|enteres|enterarte|asegúrate|asegurarte|aseguramos|a pesar|en caso|a fin|con tal|encárgate|convencid[oa]|consciente) que\b")),
    ("'haber' de existencia va en singular (hubo, ha habido, había)", re.compile(r"\b(?:hubieron|han habido|habrán habido|habían (?:muchos|muchas|varios|varias|\d))\b")),
    ("'le' con complemento en plural va 'les' (les hemos dado a tus datos)", re.compile(r"\ble (?:\w+ ){0,2}a (?:los|las|tus|sus|ellos|ellas|todos|todas|varios|varias) \w+")),
    ("locución incorrecta: 'con base en', 'de acuerdo con', 'en relación con', 'sobre todo', 'aparte', 'a ver si', 'o sea'", re.compile(r"\b(?:en base a|de acuerdo a|en relación a|sobretodo|a parte de|haber si|osea)\b")),
    ("'clic', no 'click'", re.compile(r"\bclick\b")),
    ("la app tutea: no 'usted'", re.compile(r"\b(?:usted|ustedes)\b")),
    ("'por qué' interrogativo va separado y con tilde", re.compile(r"¿Porque\b|¿Por que\b")),
    ("'aún' (todavía) lleva tilde", re.compile(r"\baun no\b|\baun (?:hay|tienes|falta|faltan|queda|quedan)\b")),
    ("'Sí' afirmativo lleva tilde", re.compile(r"(?:^|[>\"'] ?)Si,")),
]
# Decisión del dueño: un título o etiqueta que empieza con interrogativo se escribe como pregunta, con ¿ y ?.
TITULO_PREGUNTA = re.compile(r"^(?:\d+\.\s*)?(?:Qué|Cómo|Cuánto|Cuánta|Cuántos|Cuántas|Cuándo|Dónde|Quién|Quiénes|Cuál|Cuáles|Por qué|Para qué|Con quién)\b[^?¿]*$")

LITERALES = [re.compile(r'"((?:[^"\\\n]|\\.)*)"'), re.compile(r"'((?:[^'\\\n]|\\.)*)'"), re.compile(r">([^<>{}\n]+)<")]
DOS_PUNTOS = re.compile(r"(?:^|[a-záéíóúñ0-9%)]):\s([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)")
ES_TEXTO = re.compile(r"[a-záéíóúñ]{3,}\s+[a-záéíóúñ]{2,}", re.I)
CODIGO = re.compile(r"function|=>|\$\{|\bvar\b|\bnew\b|^\s*[#.]?[\w-]+\s*\{|[{};]|https?:|\.(?:js|css|html|mjs)\b|\\[nrt]")


def textos(linea):
    """Los pedazos de texto visible de una línea: literales de código y texto entre etiquetas."""
    vistos = set()
    for rx in LITERALES:
        for m in rx.finditer(linea):
            t = m.group(1)
            if t not in vistos and (ES_TEXTO.search(t) or re.match(r"[:.] [A-ZÁÉÍÓÚÑa-záéíóúñ]{2,}", t)) and not CODIGO.search(t):
                vistos.add(t)
                yield html.unescape(t)


def revisar():
    errores, avisos = [], []
    for ruta in ARCHIVOS:
        rel = ruta.relative_to(RAIZ)
        en_estilo = False
        for n, linea in enumerate(ruta.read_text(encoding="utf-8").split("\n"), 1):
            if "<style" in linea: en_estilo = True
            if "</style>" in linea: en_estilo = False; continue
            if en_estilo or linea.lstrip().startswith(("//", "*", "/*", "#", "<!--")):
                continue
            visibles = list(textos(linea))
            if not visibles and ruta.suffix == ".html" and "legal" in str(rel):
                visibles = [re.sub(r"<[^>]+>", "", linea)]
            for nombre, rx in CRUDOS:      # reglas seguras sobre la línea completa (también etiquetas cortas)
                if rx.search(linea):
                    errores.append((rel, n, nombre, linea.strip()[:90]))
            for m in re.finditer(r'(?:aria-label|title|alt|placeholder)="([^"]+)"|<(h[1-6]|summary|th|title|b|button|label)[^>]*>([^<]+)</\2>|texto\("([^"]+)"', linea):
                t = (m.group(1) or m.group(3) or m.group(4) or "").strip()
                if TITULO_PREGUNTA.match(t):
                    errores.append((rel, n, "título que empieza con interrogativo: escríbelo como pregunta (¿…?)", t[:90]))
            for t in visibles:
                for nombre, rx in GRAMATICA:
                    if rx.search(t):
                        errores.append((rel, n, nombre, t.strip()[:90]))
                for nombre, rx in ERRORES:
                    if rx.search(t):
                        errores.append((rel, n, nombre, t.strip()[:90]))
                for m in DOS_PUNTOS.finditer(t):
                    palabra = m.group(1)
                    if palabra not in PROPIOS and not re.search(r"https?:$", t[:m.start() + 1]):
                        errores.append((rel, n, "mayúscula después de dos puntos (va minúscula)", t.strip()[:90]))
            # La pregunta se abre con ¿ (en la misma línea, aunque el texto esté partido en pedazos)
            for m in re.finditer(r"[a-záéíóúñ]\?(?=[\s\"'<]|$)", linea):
                antes = linea[:m.start()]
                if "¿" not in antes and not re.search(r"[/=&]\w*$|\?\s*:", antes[-20:] + linea[m.end():m.end() + 3]) and ES_TEXTO.search(antes[-40:]):
                    avisos.append((rel, n, "pregunta sin el signo de apertura ¿", linea.strip()[:90]))
            for m in re.finditer(r"[a-záéíóúñ]!(?=[\s\"'<]|$)", linea):
                if "¡" not in linea[:m.start()] and ES_TEXTO.search(linea[max(0, m.start() - 40):m.start()]):
                    avisos.append((rel, n, "exclamación sin el signo de apertura ¡", linea.strip()[:90]))
    return errores, avisos


def main():
    errores, avisos = revisar()
    for r, n, que, t in errores:
        print(f"ERROR  {r}:{n}  {que}\n       {t}")
    if "--todo" in sys.argv:
        for r, n, que, t in avisos:
            print(f"AVISO  {r}:{n}  {que}\n       {t}")
    print(f"\n{len(ARCHIVOS)} archivos revisados: {len(errores)} errores, {len(avisos)} avisos.")
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()
