"""Guarda de contraste de las portadas.

Las cajas NO son estimadas: salen de medir la tinta real con Range.getClientRects()
sobre la tarjeta de 150px renderizada en el navegador. Si cambia la tipografía,
hay que volver a medirlas, no ajustarlas a ojo.

WCAG 1.4.3: texto grande (>=18.66px bold) 3:1; texto normal 4.5:1.
El nombre a 30px bold es grande. El nivel a 9.5px es normal.
"""
import sys, pathlib
from PIL import Image

def lum(c):
    def f(v):
        v/=255
        return v/12.92 if v<=0.04045 else ((v+0.055)/1.055)**2.4
    return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2])

def ratio(tinta, fondo):
    a,b = lum(tinta), lum(fondo)
    hi,lo = max(a,b), min(a,b)
    return (hi+0.05)/(lo+0.05)

BLANCO=(255,255,255); VERDE=(0x88,0xce,0x93)

# x0,y0,x1,y1 en fracción del lado + tinta + mínimo WCAG
ZONAS = [
    ("nombre", 0.093,0.160,0.738,0.595, BLANCO, 3.0),
    ("nivel",  0.093,0.087,0.604,0.160, VERDE,  4.5),
]

def medir(slug, verbose=True):
    ruta = pathlib.Path("portadas/src")/f"{slug}.png"
    if not ruta.exists():
        print(f"  -- falta {slug}.png"); return False
    im = Image.open(ruta).convert("RGB")
    W,H = im.size
    ok = True
    filas = []
    for nombre,x0,y0,x1,y1,tinta,minimo in ZONAS:
        caja = im.crop((int(x0*W),int(y0*H),int(x1*W),int(y1*H)))
        peor = max(caja.convert("RGB").getdata(), key=lum)
        r = ratio(tinta, peor)
        bien = r >= minimo
        ok &= bien
        filas.append(f"    {'OK ' if bien else 'FALLA'} {nombre:7} {r:5.2f}:1 (min {minimo})  peor fondo rgb{peor}")
    if verbose:
        print(f"  {slug}")
        for f in filas: print(f)
    return ok

if __name__ == "__main__":
    todo = True
    for s in sys.argv[1:]:
        todo &= medir(s)
    print("\n  TODAS PASAN" if todo else "\n  HAY FALLAS")
    sys.exit(0 if todo else 1)
