"""Toma la placa PNG de 1254px y saca dos salidas:
   - <slug>.jpg  a 400px, para el canvas de diseño (tope 70 KB)
   - web/<slug>.jpg a 800px, para los sitios reales
"""
import sys, pathlib
from PIL import Image

AQUI = pathlib.Path(__file__).parent
CANVAS = AQUI.parent          # .design/tpp  — donde el seeder busca las imágenes
WEB = AQUI / "web"
WEB.mkdir(exist_ok=True)

def procesar(slug):
    origen = AQUI / "src" / f"{slug}.png"
    if not origen.exists():
        raise SystemExit(f"falta {origen}")
    im = Image.open(origen).convert("RGB")

    # el canvas de diseño: chico y liviano
    chica = im.resize((400, 400), Image.LANCZOS)
    salida = CANVAS / f"{slug}.jpg"
    for q in (82, 76, 70, 64, 58):
        chica.save(salida, "JPEG", quality=q, optimize=True, progressive=True)
        if salida.stat().st_size <= 70_000:
            break

    # los sitios reales
    grande = im.resize((800, 800), Image.LANCZOS)
    web = WEB / f"{slug}.jpg"
    grande.save(web, "JPEG", quality=84, optimize=True, progressive=True)

    print(f"{slug:14} canvas {salida.stat().st_size//1024:3} KB q{q}   web {web.stat().st_size//1024:3} KB")

for slug in sys.argv[1:]:
    procesar(slug)
