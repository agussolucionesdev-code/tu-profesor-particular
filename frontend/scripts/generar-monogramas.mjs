/* Genera los monogramas que sirve la app a partir de los originales del ZIP.
 *
 *   node scripts/generar-monogramas.mjs
 *
 * POR QUÉ EXISTE
 *
 * Los originales (`brand-logo-monogram-{light,dark}.png`) miden 1254 px y son
 * PNG RGB sin canal alfa: traen el fondo pegado. Pesan 850 y 980 KB, y el
 * monograma se dibuja entre 32 y 112 px. Además, el fondo opaco hacía que sobre
 * cualquier color que no fuera el suyo se leyera como una calcomanía.
 *
 * Los originales se quedan en el repo tal cual —son la identidad oficial y
 * `brandAssetsContract.test.js` los fija por SHA—, y de ellos salen estos:
 *
 *   brand-logo-monogram-{light,dark}-168.png   hasta 56 px a DPR 3
 *   brand-logo-monogram-{light,dark}-336.png   hasta 112 px a DPR 3 (login admin)
 *
 * PNG de paleta y no WebP: medido sobre el resultado final del build, el WebP
 * con pérdida pesa el doble y además lava la línea verde del birrete sobre el
 * navy (el submuestreo de croma). En un logo de 38 px eso se ve.
 *
 * Se guardan a calidad máxima de paleta a propósito: `vite-plugin-image-optimizer`
 * los vuelve a cuantizar en el build (png quality 80) y achica cualquier cosa
 * que le den. Si acá también se comprimiera, en producción habría dos pasadas
 * con pérdida en vez de una.
 */
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const IMAGENES = new URL("../src/assets/images/", import.meta.url);
const LADOS = [168, 336];

/* Distancia máxima (por canal) al color de fondo para considerar a un píxel
   parte del fondo. El ruido de compresión del original llega a 3-4 niveles; el
   primer color real del logo está a más de 100. 40 deja margen de los dos lados. */
const UMBRAL_FONDO = 40;

/* Ancho de la banda de antialias, en píxeles del original de 1254. Los bordes
   suavizados de las letras ocupan 2-3 píxeles; ahí el color es una mezcla entre
   el trazo y el fondo, y es donde hay que calcular alfa parcial en vez de
   cortar a 0 o 255, que dejaría el borde serruchado. */
const BANDA = 3;

const vecinos = (i, ancho, alto) => {
  const x = i % ancho;
  const y = (i / ancho) | 0;
  return [
    x > 0 ? i - 1 : -1,
    x < ancho - 1 ? i + 1 : -1,
    y > 0 ? i - ancho : -1,
    y < alto - 1 ? i + ancho : -1,
  ];
};

async function recortarFondo(archivo) {
  const { data, info } = await sharp(archivo).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: ancho, height: alto } = info;
  const total = ancho * alto;
  const color = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];

  // El fondo es la mediana del borde de la imagen: el logo no toca los bordes, y
  // la mediana ignora el ruido que un promedio arrastraría.
  const borde = [];
  for (let x = 0; x < ancho; x++) borde.push(color(x), color((alto - 1) * ancho + x));
  for (let y = 0; y < alto; y++) borde.push(color(y * ancho), color(y * ancho + ancho - 1));
  const fondo = [0, 1, 2].map((c) => borde.map((p) => p[c]).sort((a, b) => a - b)[borde.length >> 1]);

  /* Clave de color global y no un relleno desde los bordes: el relleno no llega a
     los huecos cerrados de las letras (la O, la P, la R, la A de «PROFESOR
     PARTICULAR»), que quedaban opacos y sobre cualquier otro fondo aparecían como
     puntitos. */
  const esFondo = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const [r, g, b] = color(i);
    const distancia = Math.max(Math.abs(r - fondo[0]), Math.abs(g - fondo[1]), Math.abs(b - fondo[2]));
    if (distancia < UMBRAL_FONDO) esFondo[i] = 1;
  }

  const cola = new Int32Array(total);

  // Distancia de cada píxel al fondo más cercano, hasta BANDA.
  const aFondo = new Int16Array(total).fill(32767);
  let cabeza = 0;
  let fin = 0;
  for (let i = 0; i < total; i++) if (esFondo[i]) { aFondo[i] = 0; cola[fin++] = i; }
  while (cabeza < fin) {
    const i = cola[cabeza++];
    const siguiente = aFondo[i] + 1;
    if (siguiente > BANDA) continue;
    for (const j of vecinos(i, ancho, alto)) {
      if (j >= 0 && aFondo[j] > siguiente) { aFondo[j] = siguiente; cola[fin++] = j; }
    }
  }
  const esNucleo = (i) => aFondo[i] > BANDA;

  /* Para cada píxel de la banda, el color del trazo sólido más cercano. Con eso el
     alfa sale de proyectar el píxel sobre la recta fondo→trazo. La fórmula clásica
     de «color a alfa» supone que el trazo es el color más lejano al fondo, y con el
     verde sobre navy le daba un 67% de opacidad al verde puro. */
  const origen = new Int32Array(total).fill(-1);
  const aNucleo = new Int16Array(total).fill(32767);
  cabeza = 0;
  fin = 0;
  for (let i = 0; i < total; i++) if (esNucleo(i)) { origen[i] = i; aNucleo[i] = 0; cola[fin++] = i; }
  const alcance = BANDA * 3;
  while (cabeza < fin) {
    const i = cola[cabeza++];
    const siguiente = aNucleo[i] + 1;
    if (siguiente > alcance) continue;
    for (const j of vecinos(i, ancho, alto)) {
      if (j >= 0 && aNucleo[j] > siguiente) { aNucleo[j] = siguiente; origen[j] = origen[i]; cola[fin++] = j; }
    }
  }

  const salida = Buffer.alloc(total * 4);
  for (let i = 0; i < total; i++) {
    let [r, g, b] = color(i);
    let alfa = 255;

    if (!esNucleo(i)) {
      if (origen[i] < 0) {
        alfa = 0;
      } else {
        const trazo = color(origen[i]);
        const haciaTrazo = trazo.map((v, c) => v - fondo[c]);
        const haciaPixel = [r, g, b].map((v, c) => v - fondo[c]);
        const largo = haciaTrazo.reduce((s, v) => s + v * v, 0);
        const proyeccion = largo > 0 ? haciaPixel.reduce((s, v, c) => s + v * haciaTrazo[c], 0) / largo : 0;
        const cobertura = Math.min(1, Math.max(0, proyeccion));
        // Por debajo del 4% es ruido del fondo, no borde.
        alfa = cobertura < 0.04 ? 0 : Math.round(cobertura * 255);
        // El color del borde es el del trazo: el fondo ya está expresado en el alfa.
        [r, g, b] = trazo;
      }
    }

    salida.set([r, g, b, alfa], i * 4);
  }

  return sharp(salida, { raw: { width: ancho, height: alto, channels: 4 } }).png().toBuffer();
}

for (const tono of ["light", "dark"]) {
  const original = fileURLToPath(new URL(`brand-logo-monogram-${tono}.png`, IMAGENES));
  const recortado = await recortarFondo(original);

  for (const lado of LADOS) {
    const destino = new URL(`brand-logo-monogram-${tono}-${lado}.png`, IMAGENES);
    // sharp premultiplica el alfa antes de reescalar: sin eso, el color de los
    // píxeles transparentes se colaría en los bordes como un halo.
    const png = await sharp(recortado)
      .resize(lado, lado, { kernel: "lanczos3" })
      .png({ palette: true, quality: 100, effort: 10, compressionLevel: 9 })
      .toBuffer();
    await writeFile(destino, png);
    console.log(`${fileURLToPath(destino).split(/[\\/]/).pop()}  ${(png.length / 1024).toFixed(1)} KB`);
  }
}
