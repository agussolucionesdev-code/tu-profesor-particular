/* Genera los íconos (favicon, Apple, manifest) de los DOS sitios a partir del
 * monograma oficial.
 *
 *   node scripts/generar-iconos.mjs
 *
 * POR QUÉ EXISTE
 *
 * Los dos sitios mostraban el logo viejo en la pestaña: el sitio, un SVG con
 * una «A» genérica; turnos, el «TU» sin birrete, en un PNG de 1254 px y 733 KB
 * que el navegador bajaba entero para dibujarlo a 16. Este script sale del
 * monograma nuevo y produce los tamaños reales.
 *
 * DOS VARIANTES, UNA POR SITIO (pedido de Agustín):
 *
 *   claro  → tuprofesorparticular.com.ar          TU azul marino sobre blanco
 *   oscuro → turnos.tuprofesorparticular.com.ar   TU blanco sobre azul marino
 *
 * Con las dos pestañas abiertas se distinguen de un vistazo.
 *
 * EL TEXTO EN ARCO SE CAE EN LOS ÍCONOS. «PROFESOR PARTICULAR» a 16 px es una
 * línea de ruido. Se separa el monograma en componentes conexos: la T, la U,
 * el birrete, la borla y la sonrisa son piezas grandes; cada letra del arco es
 * una pieza chica (< 150 px² en el archivo de 336). Se quedan las grandes.
 */
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const IMAGENES = new URL("../src/assets/images/", import.meta.url);
const DESTINOS = {
  claro: new URL("../../web/public/", import.meta.url),
  oscuro: new URL("../public/", import.meta.url),
};
const FONDO = { claro: "#ffffff", oscuro: "#00214c" };
/* El trazo navy va sobre el fondo claro y el blanco sobre el oscuro. */
const MONOGRAMA = { claro: "brand-logo-monogram-light-336.png", oscuro: "brand-logo-monogram-dark-336.png" };

/* Medido sobre los dos archivos de 336: las letras del arco ocupan entre 110 y
   140 píxeles; la pieza real más chica (la borla) pasa de 500. */
const AREA_MINIMA = 300;

const simbolo = async (archivo) => {
  const { data, info } = await sharp(fileURLToPath(new URL(archivo, IMAGENES)))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: ancho, height: alto } = info;
  const opaco = (i) => data[i * 4 + 3] > 40;
  const visto = new Uint8Array(ancho * alto);
  const conservar = new Uint8Array(ancho * alto);

  for (let inicio = 0; inicio < ancho * alto; inicio++) {
    if (visto[inicio] || !opaco(inicio)) continue;
    const pieza = [];
    const cola = [inicio];
    visto[inicio] = 1;
    while (cola.length) {
      const i = cola.pop();
      pieza.push(i);
      const x = i % ancho;
      for (const v of [x > 0 ? i - 1 : -1, x < ancho - 1 ? i + 1 : -1, i - ancho, i + ancho]) {
        if (v >= 0 && v < ancho * alto && !visto[v] && opaco(v)) {
          visto[v] = 1;
          cola.push(v);
        }
      }
    }
    if (pieza.length >= AREA_MINIMA) for (const i of pieza) conservar[i] = 1;
  }

  /* Se dilata la máscara dos píxeles para no perder el antialias del borde,
     que tiene alfa bajo y quedó fuera de los componentes. */
  const salida = Buffer.from(data);
  for (let i = 0; i < ancho * alto; i++) {
    let cerca = false;
    const x = i % ancho;
    const y = (i / ancho) | 0;
    for (let dy = -2; dy <= 2 && !cerca; dy++) {
      for (let dx = -2; dx <= 2 && !cerca; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < ancho && ny < alto && conservar[ny * ancho + nx]) cerca = true;
      }
    }
    if (!cerca) salida[i * 4 + 3] = 0;
  }
  return sharp(salida, { raw: { width: ancho, height: alto, channels: 4 } }).trim().png().toBuffer();
};

/* Una baldosa con el símbolo centrado. `redondeo` es la fracción del lado:
   0 para Apple y maskable, que recortan su propia forma. `ocupa` es cuánto del
   lado ocupa el símbolo: en maskable tiene que caber en el círculo seguro. */
const baldosa = async ({ lado, fondo, simboloPng, redondeo, ocupa }) => {
  const r = Math.round(lado * redondeo);
  const forma = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}"><rect width="${lado}" height="${lado}" rx="${r}" ry="${r}" fill="${fondo}"/></svg>`,
  );
  const medida = Math.round(lado * ocupa);
  const figura = await sharp(simboloPng)
    .resize(medida, medida, { fit: "inside", kernel: "lanczos3" })
    .toBuffer();
  const { width, height } = await sharp(figura).metadata();
  return sharp(forma)
    .composite([{ input: figura, left: Math.round((lado - width) / 2), top: Math.round((lado - height) / 2) }])
    .png({ compressionLevel: 9, palette: lado <= 48 ? false : true, quality: 100 })
    .toBuffer();
};

/* ICO con las imágenes en PNG adentro: lo entienden todos los navegadores
   actuales y Google lo usa para el ícono del resultado de búsqueda. */
const ico = (pngs) => {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(0, 0);
  cabecera.writeUInt16LE(1, 2);
  cabecera.writeUInt16LE(pngs.length, 4);
  const entradas = [];
  let desplazamiento = 6 + 16 * pngs.length;
  for (const { lado, png } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(lado >= 256 ? 0 : lado, 0);
    e.writeUInt8(lado >= 256 ? 0 : lado, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(desplazamiento, 12);
    desplazamiento += png.length;
    entradas.push(e);
  }
  return Buffer.concat([cabecera, ...entradas, ...pngs.map((p) => p.png)]);
};

for (const variante of ["claro", "oscuro"]) {
  const simboloPng = await simbolo(MONOGRAMA[variante]);
  const fondo = FONDO[variante];
  const destino = (nombre) => fileURLToPath(new URL(nombre, DESTINOS[variante]));

  const chicos = [];
  for (const lado of [16, 32, 48]) {
    chicos.push({ lado, png: await baldosa({ lado, fondo, simboloPng, redondeo: 0.22, ocupa: 0.84 }) });
  }
  await writeFile(destino("favicon.ico"), ico(chicos));

  const archivos = {
    "icon-192.png": { lado: 192, redondeo: 0.22, ocupa: 0.74 },
    "icon-512.png": { lado: 512, redondeo: 0.22, ocupa: 0.74 },
    /* Apple recorta su propia forma: baldosa cuadrada a sangre. */
    "apple-touch-icon.png": { lado: 180, redondeo: 0, ocupa: 0.66 },
    /* Maskable: el sistema recorta hasta un círculo del 80 % del lado. El
       símbolo entra con aire en ese círculo. */
    "icon-maskable-512.png": { lado: 512, redondeo: 0, ocupa: 0.56 },
  };
  for (const [nombre, opciones] of Object.entries(archivos)) {
    await writeFile(destino(nombre), await baldosa({ ...opciones, fondo, simboloPng }));
  }
  console.log(`${variante}: favicon.ico, ${Object.keys(archivos).join(", ")}`);

  /* La insignia de las notificaciones push (sólo turnos las manda). Android la
     pinta como SILUETA: usa el canal alfa y descarta el color. Un ícono con
     fondo lleno se vería como un cuadrado blanco; esto es el símbolo solo. */
  if (variante === "oscuro") {
    const silueta = await sharp(simboloPng)
      .resize(84, 84, { fit: "inside" })
      .extend({ top: 6, bottom: 6, left: 6, right: 6, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(96, 96, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .tint("#ffffff")
      .png()
      .toBuffer();
    await writeFile(destino("badge-96.png"), silueta);
  }
}
