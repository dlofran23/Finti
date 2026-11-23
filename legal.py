#!/usr/bin/env python3
"""Genera las páginas legales (public/legal/) desde legal/*.html y legal/datos.json.

Uso:
  python3 herramientas/legal.py            genera las páginas
  python3 herramientas/legal.py --revisar  falla si las páginas no corresponden a las plantillas
                                           y avisa si faltan datos (ciudad, correo, fecha)

Para cambiar un dato de los responsables (dirección, teléfono, correo, fecha de vigencia),
edita solo legal/datos.json y vuelve a correr este archivo.
"""
import html
import json
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FUENTE, DESTINO = RAIZ / "legal", RAIZ / "public" / "legal"
PAGINAS = ["privacidad.html", "terminos.html", "eliminar-cuenta.html", "empresas.html"]


def unir(lista):
    lista = [x for x in lista if x]
    return lista[0] if len(lista) == 1 else ", ".join(lista[:-1]) + " y " + lista[-1]


def nit_de(d, i):
    """NIT de cada responsable (Ley 1480, artículo 50, literal a). Vacío mientras no lo llenen en datos.json."""
    nits = d.get("nit") or []
    n = nits[i].strip() if i < len(nits) and nits[i] else ""
    return f", NIT {html.escape(n)}" if n else ""


def valores(d):
    e = html.escape
    direccion = d["direccion"] + (", " + d["ciudad"] if d.get("ciudad") else "") + ", Colombia"
    tels = d["telefonos"]
    correo = d.get("correo", "")
    correo_html = f'<a href="mailto:{e(correo)}">{e(correo)}</a>' if correo else "(correo por definir)"
    wa = f' (también por <a href="https://wa.me/{e(d["whatsapp"])}">WhatsApp</a>)' if d.get("whatsapp") else ""
    sitio_corto = d["sitio"].rstrip("/").replace("https://", "")
    contacto = (
        '<p><b>Contacto para datos personales, peticiones, quejas y reclamos:</b></p><ul>'
        f'<li>Formulario con número de radicado: en la app, menú, <i>Ayuda y PQR</i>, o en <a href="/#pqr">el formulario del sitio</a></li>'
        f"<li>Correo: {correo_html}</li>"
        f"<li>Teléfonos: {e(unir(tels))}{wa}</li>"
        f"<li>Dirección de notificación judicial: {e(direccion)}</li></ul>"
    )
    linea = f"Contacto: {correo_html}, teléfonos {e(unir(tels))}, {e(direccion)}."
    sitio = d["sitio"].rstrip("/")
    return {
        "VERSION": e(d["version"]),
        "VIGENCIA": e(d["vigencia"]) if d.get("vigencia") else "la fecha de su publicación en este sitio",
        "RESPONSABLES": e(unir(d["responsables"])),
        "RESPONSABLES_LISTA": "\n  ".join(f"<li>{e(n)}, persona natural{nit_de(d, i)}, domiciliada en Colombia.</li>" for i, n in enumerate(d["responsables"])),
        "CONTACTO_BLOQUE": contacto,
        "CONTACTO_LINEA": linea,
        "EDAD": str(int(d["edadMinima"])),
        "SITIO": e(sitio),
        "SITIO_CORTO": e(sitio.replace("https://", "")),
    }


def generar():
    d = json.loads((FUENTE / "datos.json").read_text(encoding="utf-8"))
    v = valores(d)
    salida = {}
    for p in PAGINAS:
        t = (FUENTE / p).read_text(encoding="utf-8")
        # Mientras haya datos en Netlify, la política lo nombra (Ley 1581: hay que decir quién guarda los datos). Cuando el
        # traslado termine y se borren allá, pon "trasladoTerminado": true en datos.json y vuelve a generar.
        fin = bool(d.get("trasladoTerminado"))
        t = re.sub(r"<!--TRASLADO-->.*?<!--/TRASLADO-->", "", t, flags=re.S) if fin else re.sub(r"<!--/?TRASLADO-->", "", t)
        t = re.sub(r"<!--/?SIN-TRASLADO-->", "", t) if fin else re.sub(r"<!--SIN-TRASLADO-->.*?<!--/SIN-TRASLADO-->", "", t, flags=re.S)
        for k, x in v.items():
            t = t.replace("{{" + k + "}}", x)
        if "{{" in t:
            raise SystemExit(f"{p}: quedó una marca sin reemplazar: {t[t.index('{{'):t.index('{{') + 30]}")
        salida[p] = t
    salida["legal.css"] = (FUENTE / "legal.css").read_text(encoding="utf-8")
    faltan = [k for k in ("ciudad", "correo", "vigencia") if not d.get(k)]
    if len([n for n in (d.get("nit") or []) if n and n.strip()]) < len(d["responsables"]):
        faltan.append("nit")
    return salida, faltan


def main():
    salida, faltan = generar()
    if "--revisar" in sys.argv:
        malos = [p for p, t in salida.items() if not (DESTINO / p).exists() or (DESTINO / p).read_text(encoding="utf-8") != t]
        if malos:
            raise SystemExit("Las páginas legales no corresponden a legal/: " + ", ".join(malos) + ". Corre python3 herramientas/legal.py")
        print("Páginas legales al día." + (" Faltan datos en legal/datos.json: " + ", ".join(faltan) if faltan else ""))
        return
    DESTINO.mkdir(parents=True, exist_ok=True)
    for p, t in salida.items():
        (DESTINO / p).write_text(t, encoding="utf-8")
    print(f"Páginas legales generadas en public/legal/ ({len(salida)} archivos)." + (" Faltan datos: " + ", ".join(faltan) if faltan else ""))


if __name__ == "__main__":
    main()
