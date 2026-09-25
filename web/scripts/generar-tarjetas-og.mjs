/* Genera las tarjetas para compartir (Open Graph) de cada página, y la de turnos.
 *
 *   node scripts/generar-tarjetas-og.mjs
 *
 * POR QUÉ EXISTE
 *
 * Todas las páginas compartían la misma imagen —el logo sobre blanco—: pasar
 * /materias o /contacto por WhatsApp mostraba la misma tarjeta que la portada.
 * Cada página tiene ahora la suya, con su título y su ilustración.
 *
 * POR QUÉ HTML Y NO UNA IMAGEN GENERADA: el texto tiene que salir exacto, con
 * las tipografías de la marca y sin letras inventadas. Se arma una plantilla
 * con Fraunces e Inter (las de @fontsource que ya usa el sitio) y los stickers
 * de public/img, y Playwright la fotografía a 1200×630, el tamaño que piden
 * WhatsApp, Facebook, LinkedIn y X. JPEG: varios bots no leen WebP.
 *
 * Los títulos salen de acá y no de meta.js a propósito: una tarjeta tiene lugar
 * para cinco o seis palabras, el <title> no.
 */
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const raiz = (ruta) => fileURLToPath(new URL(`../${ruta}`, import.meta.url));
const comoDataUrl = (ruta, tipo) => `data:${tipo};base64,${readFileSync(raiz(ruta)).toString("base64")}`;

const FUENTES = {
  fraunces: comoDataUrl("node_modules/@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2", "font/woff2"),
  frauncesItalica: comoDataUrl("node_modules/@fontsource-variable/fraunces/files/fraunces-latin-opsz-italic.woff2", "font/woff2"),
  inter: comoDataUrl("node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", "font/woff2"),
};

const TARJETAS = [
  { archivo: "public/og/inicio.jpg", antetitulo: "Temperley y online", titulo: "Entendé de verdad,", enfasis: "no de memoria.", imagenes: ["public/img/metodo-diagnostico.webp", "public/img/sobremi-el-clic.webp"] },
  { archivo: "public/og/sobre-mi.jpg", antetitulo: "Sobre mí", titulo: "Agustín Elías Sosa,", enfasis: "profesor particular.", foto: "public/agustin.webp" },
  { archivo: "public/og/materias.jpg", antetitulo: "Materias y niveles", titulo: "Matemática, Física, Química,", enfasis: "Fisicoquímica e Inglés.", imagenes: ["public/subjects/matematica.webp", "public/subjects/fisica.webp", "public/subjects/quimica.webp", "public/subjects/ingles.webp"], portadas: true },
  { archivo: "public/og/como-trabajo.jpg", antetitulo: "Cómo trabajo", titulo: "Un método,", enfasis: "no improvisación.", imagenes: ["public/img/como-trabajo-escritorio.webp"] },
  { archivo: "public/og/contacto.jpg", antetitulo: "Contacto", titulo: "Reservá o escribime:", enfasis: "respondo yo.", imagenes: ["public/img/contacto-celular.webp"] },
  { archivo: "public/og/privacidad.jpg", antetitulo: "Privacidad", titulo: "Tus datos,", enfasis: "explicados claro.", imagenes: ["public/img/razon-precio-a-la-vista.webp"] },
  { archivo: "../frontend/public/og-cover.jpg", dominio: "turnos.tuprofesorparticular.com.ar", antetitulo: "Turnos en línea", titulo: "Reservá tu clase", enfasis: "en pocos pasos.", imagenes: ["public/img/razon-reprogramar.webp", "public/img/razon-online-presencial.webp"] },
];

const plantilla = ({ antetitulo, titulo, enfasis, imagenes = [], foto, portadas, dominio = "tuprofesorparticular.com.ar" }) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face{font-family:F;src:url(${FUENTES.fraunces}) format("woff2");font-weight:100 900}
@font-face{font-family:F;font-style:italic;src:url(${FUENTES.frauncesItalica}) format("woff2");font-weight:100 900}
@font-face{font-family:I;src:url(${FUENTES.inter}) format("woff2");font-weight:100 900}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#00214c;color:#fff;font-family:I;overflow:hidden;position:relative}
.cuadricula{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:48px 48px}
.aura{position:absolute;right:-120px;top:-120px;width:720px;height:720px;border-radius:50%;background:radial-gradient(circle,rgba(136,206,147,.20),rgba(136,206,147,0) 62%)}
.texto{position:absolute;left:72px;top:64px;bottom:64px;width:${foto || portadas ? 560 : 600}px;display:flex;flex-direction:column}
.marca{display:flex;align-items:center;gap:16px}
.marca img{width:78px;height:78px}
.marca b{font-family:F;font-size:30px;font-weight:600;letter-spacing:-.01em}
.marca b em{font-style:italic;font-weight:500;color:#88ce93}
.ante{margin-top:auto;font-size:19px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#88ce93}
h1{margin-top:18px;font-family:F;font-weight:500;font-size:66px;line-height:1.02;letter-spacing:-.02em;text-wrap:balance}
h1 em{display:block;font-style:italic;font-weight:420;color:#88ce93}
.pie{margin-top:28px;font-size:21px;color:rgba(255,255,255,.72)}
.imagenes{position:absolute;right:56px;top:50%;transform:translateY(-50%);display:flex;align-items:center}
.imagenes img{width:${imagenes.length > 1 ? 280 : 440}px;filter:drop-shadow(0 18px 30px rgba(0,0,0,.35))}
.imagenes img+img{margin-left:-70px;margin-top:180px}
.portadas{position:absolute;right:56px;top:84px;display:grid;grid-template-columns:repeat(2,230px);gap:18px}
.portadas img{width:230px;height:230px;border-radius:22px;box-shadow:0 18px 34px rgba(0,0,0,.35);object-fit:cover}
.foto{position:absolute;right:80px;top:70px;width:420px;height:490px;border-radius:28px;overflow:hidden;border-top:6px solid #01953c;box-shadow:0 24px 50px rgba(0,0,0,.4)}
.foto img{width:100%;height:100%;object-fit:cover;object-position:center 20%}
</style></head><body>
<div class="cuadricula"></div><div class="aura"></div>
<div class="texto">
  <div class="marca"><img src="${comoDataUrl("public/marca-oscuro.webp", "image/webp")}"><b>Tu Profesor <em>Particular</em></b></div>
  <p class="ante">${antetitulo}</p>
  <h1>${titulo}<em>${enfasis}</em></h1>
  <p class="pie">${dominio}</p>
</div>
${foto ? `<div class="foto"><img src="${comoDataUrl(foto, "image/webp")}"></div>` : ""}
${portadas ? `<div class="portadas">${imagenes.map((i) => `<img src="${comoDataUrl(i, "image/webp")}">`).join("")}</div>` : ""}
${!foto && !portadas ? `<div class="imagenes">${imagenes.map((i) => `<img src="${comoDataUrl(i, "image/webp")}">`).join("")}</div>` : ""}
</body></html>`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
mkdirSync(raiz("public/og"), { recursive: true });
for (const tarjeta of TARJETAS) {
  await pagina.setContent(plantilla(tarjeta), { waitUntil: "load" });
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.screenshot({ path: raiz(tarjeta.archivo), type: "jpeg", quality: 86 });
  console.log("✓", tarjeta.archivo);
}
await navegador.close();
