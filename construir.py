"""Une los archivos de fuente/ en public/index.html y public/app.js.

Uso:
  python3 herramientas/construir.py            construye public/index.html y public/app.js
  python3 herramientas/construir.py --revisar  solo comprueba que los dos están al día

La app se edita por partes: estilos/, pantallas/, logica/ y datos/. plantilla.html dice en qué orden van.
El script principal (logica/) se publica aparte, en /app.js?v=<huella>: así el navegador guarda el código
ya compilado entre visitas y la página abre más rápido. La huella cambia con cada versión, por eso
app.js puede guardarse en caché por un año (ver netlify.toml).
"""
import base64, hashlib, pathlib, re, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FUENTE = RAIZ / "fuente"


def construir():
    plantilla = (FUENTE / "plantilla.html").read_text(encoding="utf8")

    def incluir(m):
        ruta = m.group(1)
        if ruta.startswith("b64:"):
            return base64.b64encode((FUENTE / ruta[4:]).read_bytes()).decode()
        return (FUENTE / ruta).read_text(encoding="utf8")

    return re.sub(r"\{\{([a-z0-9:/._-]+)\}\}", incluir, plantilla)


def separar(html):
    """Saca el script principal (el último <script> sin atributos) a app.js y deja en su lugar la referencia."""
    marca = "\n<script>\n"
    i = html.rindex(marca)
    j = html.index("</script>", i)
    js = html[i + len(marca):j]
    huella = hashlib.sha256(js.encode("utf8")).hexdigest()[:12]
    return html[:i] + '\n<script src="/app.js?v=' + huella + '"></script>' + html[j + len("</script>"):], js


if __name__ == "__main__":
    salida, salida_js = RAIZ / "public" / "index.html", RAIZ / "public" / "app.js"
    html, js = separar(construir())
    if "--revisar" in sys.argv:
        if salida.read_text(encoding="utf8") != html or not salida_js.exists() or salida_js.read_text(encoding="utf8") != js:
            print("public/index.html o public/app.js NO coinciden con fuente/. Corre: python3 herramientas/construir.py")
            sys.exit(1)
        print("public/index.html y public/app.js coinciden con fuente/ (idénticos)")
    else:
        salida.write_text(html, encoding="utf8", newline="")
        salida_js.write_text(js, encoding="utf8", newline="")
        print("construido: index.html", len(html.encode("utf8")) // 1024, "KB y app.js", len(js.encode("utf8")) // 1024, "KB")
