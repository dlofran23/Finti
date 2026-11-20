"""Imprime la CSP estricta con hashes de los scripts en línea de public/index.html.
Úsala solo cuando el sitio ya no muestre la marca Powered by Netlify (plan Personal o superior):
reemplaza 'unsafe-inline' de script-src en netlify.toml por los hashes que imprime este script."""
import base64, hashlib, pathlib, re
html = (pathlib.Path(__file__).resolve().parent.parent / "public" / "index.html").read_text(encoding="utf8")
hashes = []
for attrs, cuerpo in re.findall(r"<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)</script>", html):
    if re.search(r'type="(application/json|text/plain)"', attrs):
        continue
    hashes.append("'sha256-" + base64.b64encode(hashlib.sha256(cuerpo.encode("utf8")).digest()).decode() + "'")
print("script-src 'self' 'wasm-unsafe-eval' " + " ".join(hashes) + " https://accounts.google.com/gsi/client")
