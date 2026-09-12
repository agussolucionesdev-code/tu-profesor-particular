"""Mapa de brillo en rejilla 16x16. Muestra dónde la placa deja de estar callada."""
import sys, pathlib
from PIL import Image

def lum(c):
    def f(v):
        v/=255
        return v/12.92 if v<=0.04045 else ((v+0.055)/1.055)**2.4
    return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2])

def contraste_blanco(l):
    return 1.05/(l+0.05)

N = 16
for slug in sys.argv[1:]:
    im = Image.open(pathlib.Path("portadas/src")/f"{slug}.png").convert("RGB")
    W,H = im.size
    print(f"\n{slug} — contraste del BLANCO contra cada celda (16x16)")
    print("   " + "".join(f"{i:>4}" for i in range(N)))
    for fy in range(N):
        fila = []
        for fx in range(N):
            caja = im.crop((fx*W//N, fy*H//N, (fx+1)*W//N, (fy+1)*H//N))
            peor = max(caja.getdata(), key=lum)   # peor caso de la celda
            fila.append(contraste_blanco(lum(peor)))
        print(f"{fy:>2} " + "".join(f"{v:>4.0f}" if v<99 else "  ∞" for v in fila))
