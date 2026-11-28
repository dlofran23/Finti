#!/usr/bin/env python3
"""Saca todos los textos que ve la persona (HTML de fuente/pantallas, plantilla y cadenas de fuente/logica) en una lista
sin repetir, con su archivo y línea, para revisarlos con las normas de la RAE.

Uso:  python3 herramientas/extraer-textos.py > textos.tsv
"""
import html
import pathlib
import re

RAIZ = pathlib.Path(__file__).resolve().parent.parent
vistos = set()


def sacar(archivo, n, t):
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    t = re.sub(r"\s+", " ", t).strip()
    # Solo frases: al menos dos palabras con letras y alguna minúscula con tilde o palabra común
    if len(re.findall(r"[A-Za-zÁÉÍÓÚáéíóúÑñü]{2,}", t)) < 2 or t in vistos:
        return
    if re.search(r"[{};=]|=>|\bfunction\b|\bvar\b|\.test\(|\\[sdbw]", t):
        return
    vistos.add(t)
    print(f"{archivo}:{n}\t{t}")


for f in sorted((RAIZ / "fuente" / "pantallas").glob("*.html")) + [RAIZ / "fuente" / "plantilla.html"]:
    for n, linea in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
        for m in re.finditer(r">([^<>]{3,})<", linea):
            sacar(f.relative_to(RAIZ), n, m.group(1))
        for m in re.finditer(r'(?:aria-label|placeholder|title|alt)="([^"]{3,})"', linea):
            sacar(f.relative_to(RAIZ), n, m.group(1))

for f in sorted((RAIZ / "fuente" / "logica").glob("*.js")):
    for n, linea in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
        if linea.strip().startswith("//"):
            continue
        for m in re.finditer(r'"((?:[^"\\]|\\.){6,})"', linea):
            s = m.group(1)
            if re.search(r"[áéíóúñ¿¡]|\b(el|la|los|las|de|que|tu|tus|en|con|para|por|un|una)\b", s) and " " in s:
                sacar(f.relative_to(RAIZ), n, s)
