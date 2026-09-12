"""Convierte las portadas aprobadas al formato que consume la app.

`frontend/src/constants/bookingVisuals.js` importa .webp de 640x640 desde
`frontend/src/assets/booking/subjects/`. Esto toma los PNG de 1254 que bajamos
de ChatGPT y deja los webp con el nombre exacto que el código ya espera, así
no hay que tocar el mapeo.
"""
import pathlib, sys
from PIL import Image

AQUI = pathlib.Path(__file__).parent
SALIDA = AQUI / "produccion"
SALIDA.mkdir(exist_ok=True)
# 480 y no 640. Medí el tamaño real al que se renderiza la tarjeta en el
# kiosco: 152x152 px. A 480 se cubre hasta DPR 3, que son los teléfonos más
# finos que existen hoy, con margen. Los 640 que había eran 4x el tamaño
# lineal y 18x en píxeles: peso puro sin ningún beneficio visible.
LADO = 480

# origen -> nombre de archivo que el codigo ya importa
MAPA = {
    # ── secundaria, secundaria técnica, CENS y superiores: paleta de marca ──
    "sec-matematica":  "matematica.webp",
    "fis-v2":          "fisica.webp",
    "sec-quimica":     "quimica.webp",
    "fq-v1":           "fisicoquimica.webp",
    "bio-v1":          "biologia.webp",
    "ing-v1":          "ingles.webp",
    "len-v1":          "lengua-literatura.webp",
    "otra-materia":    "otra-materia.webp",
    # ── primaria: multicolor, sin fórmulas de secundaria ──
    "prim-matematica": "primaria/matematica.webp",
    "prim-naturales":  "primaria/ciencias-naturales.webp",
    "prim-sociales":   "primaria/ciencias-sociales.webp",
    "prim-ingles":     "primaria/ingles.webp",
    "prim-lengua":     "primaria/lengua-literatura.webp",
    # ── el CBC, producto aparte ──
    "cbc":             "cbc.webp",
}

def convertir(origen, destino):
    ruta = AQUI / "src" / f"{origen}.png"
    if not ruta.exists():
        return None
    im = Image.open(ruta).convert("RGB").resize((LADO, LADO), Image.LANCZOS)
    fuera = SALIDA / destino
    fuera.parent.mkdir(parents=True, exist_ok=True)
    im.save(fuera, "WEBP", quality=84, method=6)
    return fuera.stat().st_size

total = 0
faltan = []
for origen, destino in MAPA.items():
    peso = convertir(origen, destino)
    if peso is None:
        faltan.append(origen)
        continue
    total += peso
    print(f"  {destino:36} {peso//1024:3} KB")

print(f"\n  {len(MAPA)-len(faltan)} archivos, {total//1024} KB en total")
if faltan:
    print("  faltan los PNG de:", ", ".join(faltan))
