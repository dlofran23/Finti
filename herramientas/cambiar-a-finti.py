"""Kit del cambio de marca a Finti. NO se corre hasta que la consulta en la SIC salga bien.

Uso:
  python3 herramientas/cambiar-a-finti.py                    muestra qué cambiaría (no toca nada)
  python3 herramientas/cambiar-a-finti.py --aplicar iconos   íconos y colores nuevos (la F violeta con la moneda amarilla)
  python3 herramientas/cambiar-a-finti.py --aplicar nombre   el nombre visible pasa de Fintelligente a Finti
  python3 herramientas/cambiar-a-finti.py --aplicar todo     las dos cosas
  Opciones: --legal (también cambia el nombre en los documentos legales; revísalos antes con quien te asesore)
            --tambien RUTA (otro archivo al que aplicar el cambio de nombre, por ejemplo una copia de trabajo)

Los íconos sirven igual con el nombre Fintelligente (la F es de los dos), así que pueden aplicarse antes.
Nunca cambia lo que no se ve: el paquete de Android (co.fintelligente.app), el dominio, las claves guardadas en el
navegador (fintelligente-…), los almacenes ni las direcciones de la API. Cambiarlos borraría los datos de la gente.
Después de aplicar: python3 herramientas/construir.py, npm test, subir la versión de Android y firmarla.
"""
import pathlib, re, shutil, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
KIT = RAIZ / "marca-finti"
ANDROID = RAIZ / "android" / "app" / "src" / "main"
args = sys.argv[1:]
aplicar = args[args.index("--aplicar") + 1] if "--aplicar" in args else ""
LEGAL = "--legal" in args
EXTRA = [pathlib.Path(args[i + 1]) for i, a in enumerate(args) if a == "--tambien"]

# ---------- Íconos y colores ----------
ICONOS = [(KIT / "web" / n, RAIZ / "public" / n) for n in ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "badge-96.png"]]
for d in ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]:
    ICONOS.append((KIT / "android" / f"mipmap-{d}" / "ic_launcher.png", ANDROID / "res" / f"mipmap-{d}" / "ic_launcher.png"))
    ICONOS.append((KIT / "android" / f"drawable-{d}" / "ic_notif.png", ANDROID / "res" / f"drawable-{d}" / "ic_notif.png"))
FAV_VIEJO = "fill='%232f4bd8'/%3E%3Cpath d='M10 23V9h11M10 16h8' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3Ccircle cx='23' cy='21' r='2.6' fill='white'/%3E"
FAV_NUEVO = "fill='%232e5bff'/%3E%3Cpath d='M10 23V9h11M10 16h8' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3Ccircle cx='23' cy='21' r='2.6' fill='%23ffc53d'/%3E"
COLORES = [  # (archivo, viejo, nuevo)
    (RAIZ / "fuente" / "plantilla.html", '<meta name="theme-color" content="#2f4bd8">', '<meta name="theme-color" content="#6a4af0">'),
    (RAIZ / "fuente" / "plantilla.html", FAV_VIEJO, FAV_NUEVO),
    (RAIZ / "public" / "manifest.webmanifest", '"theme_color": "#2f4bd8"', '"theme_color": "#6a4af0"'),
    (RAIZ / "public" / "manifest.webmanifest", '"background_color": "#f2f4f9"', '"background_color": "#f6f4fa"'),
    (RAIZ / "netlify" / "lib" / "avisos.mjs", "#2f4bd8", "#6a4af0"),
    (RAIZ / "public" / "panel.html", "--accent: #2f4bd8", "--accent: #6a4af0"),
    (ANDROID / "res" / "values" / "colors.xml", "#2F4BD8", "#6A4AF0"),
    (ANDROID / "res" / "drawable" / "ic_atajo_gasto.xml", "#FF2F4BD8", "#FF6A4AF0"),
    (ANDROID / "res" / "drawable" / "ic_atajo_privacidad.xml", "#FF2F4BD8", "#FF6A4AF0"),
    (ANDROID / "java" / "co" / "fintelligente" / "app" / "PrivacidadActivity.java", "0xFF2F4BD8", "0xFF6A4AF0"),
    (ANDROID / "java" / "co" / "fintelligente" / "app" / "BienvenidaActivity.java", "0xFF2F4BD8", "0xFF6A4AF0"),
    (ANDROID / "java" / "co" / "fintelligente" / "app" / "Avisador.java", "0xFF2F4BD8", "0xFF6A4AF0"),
]

# ---------- Nombre visible ----------
def archivos_nombre():
    l = sorted(p for p in (RAIZ / "fuente").rglob("*") if p.suffix in (".html", ".js", ".css", ".json"))
    l += [RAIZ / "public" / n for n in ["manifest.webmanifest", "sw.js", "panel.html"]]
    l += sorted((RAIZ / "netlify").rglob("*.mjs")) + sorted((RAIZ / "correo-worker" / "src").rglob("*.js"))
    l += [ANDROID / "res" / "values" / "strings.xml", ANDROID / "res" / "xml" / "accesos.xml"] + sorted((ANDROID / "java").rglob("*.java"))
    if LEGAL: l += sorted((RAIZ / "public" / "legal").glob("*.html"))
    return [p for p in l + EXTRA if p.exists()]

# Solo la palabra con mayúscula inicial (o toda en mayúsculas): las claves y nombres internos van en minúsculas.
NOMBRE = [(re.compile(r"\bFintelligente\b"), "Finti"), (re.compile(r"\bFINTELLIGENTE\b"), "FINTI")]


def cambio_nombre(p):
    t = p.read_text(encoding="utf8"); n = 0
    for rx, nuevo in NOMBRE:
        t, k = rx.subn(nuevo, t); n += k
    return t, n


def main():
    total = 0
    print("== Íconos y colores" + (" (aplicando)" if aplicar in ("iconos", "todo") else ""))
    for a, b in ICONOS:
        if not a.exists(): sys.exit("Falta en el kit: " + str(a))
        print("  ícono  ", b.relative_to(RAIZ))
        if aplicar in ("iconos", "todo"): shutil.copyfile(a, b)
    for p, viejo, nuevo in COLORES:
        t = p.read_text(encoding="utf8"); k = t.count(viejo)
        print(f"  color   {p.relative_to(RAIZ)}: {k} cambio(s)")
        if aplicar in ("iconos", "todo") and k: p.write_text(t.replace(viejo, nuevo), encoding="utf8", newline="")
    print("== Nombre visible: Fintelligente → Finti" + (" (aplicando)" if aplicar in ("nombre", "todo") else ""))
    for p in archivos_nombre():
        t, n = cambio_nombre(p)
        if not n: continue
        total += n
        print(f"  {n:3d}  {p.relative_to(RAIZ) if RAIZ in p.parents else p}")
        if aplicar in ("nombre", "todo"): p.write_text(t, encoding="utf8", newline="")
    if not LEGAL:
        leg = [(p, len(re.findall(r"\bFintelligente\b", p.read_text(encoding="utf8")))) for p in sorted((RAIZ / "public" / "legal").glob("*.html"))]
        print("  Documentos legales sin tocar (revísalos y usa --legal):", ", ".join(f"{p.name} ({n})" for p, n in leg if n))
    print(f"\n{total} cambios de nombre." + ("" if aplicar else " No se tocó nada: es una vista previa."))
    if aplicar:
        print("Ahora: python3 herramientas/construir.py && npm test. En Android sube versionCode y versionName, compila y firma.")


main()
