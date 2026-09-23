/* Las portadas de materia, para el sitio institucional.
 *
 * SON ARCHIVOS COPIADOS DE `frontend/`, NO IMPORTADOS. `web/` y `frontend/` son
 * dos proyectos con bundles y deploys separados: ninguno puede alcanzar los
 * assets del otro, y un `../../frontend/src/assets/…` haría que este sitio no
 * compile sin el repo entero al lado.
 *
 * Los archivos viven en `public/subjects/`, no en `src/assets/`, y el mapa de
 * abajo son RUTAS y no imports. El porqué está explicado en detalle más
 * adelante: con imports, esta página terminaba pesando nueve veces lo que debía.
 *
 * El mapa vive acá y no en `site.js` porque `site.js` es texto —datos que
 * alguien edita sin tocar nada más— y esto es una decisión de cómo se sirven
 * los archivos, que tiene su propia explicación y su propio test.
 *
 * La llave es el `slug` de la materia. El archivo se llama distinto —singular—
 * porque el kiosco nombra a la materia "Matemática" y el sitio titula
 * "Matemáticas"; esa diferencia está explicada en `site.js` y ya costó plata
 * una vez, así que acá se hace explícita en vez de deducirla.
 */
/* ══════════════════════════════════════════════════════════════════════════
   POR QUÉ SON RUTAS Y NO `import`.

   Con `import matematica from "../assets/subjects/matematica.webp"` esta página
   terminaba pesando NUEVE VECES lo que debía, y el build lo cantaba: el HTML de
   `/materias` pasó de 51 KB a 453.

   La causa está en `prerender.mjs`. Para poder ejecutar los componentes en Node
   compila con esbuild y le declara `".webp": "dataurl"`, así que cada import de
   imagen se convierte en base64 y queda EMPOTRADO en el HTML prerenderizado. Y
   como el bundle de Vite sí usa el archivo con hash, al hidratar React cambiaba
   el `src` y el navegador descargaba las cinco OTRA VEZ: unos 700 KB para
   mostrar 296.

   De paso, el `loading="lazy"` no servía para nada: una imagen que viaja dentro
   del HTML ya llegó.

   Como rutas de `public/`, el prerender ve un string —no hay import que esbuild
   pueda transformar— y el bundle usa exactamente el mismo. Una sola descarga,
   diferida de verdad, y el HTML vuelve a pesar lo que pesaba.

   Lo que se resigna es el hash de cache-busting que Vite le pone a los assets
   importados. Es un precio barato para ilustraciones que no cambian: si alguna
   cambia, se renombra el archivo y listo.

   Ojo, el problema del prerender sigue ahí para las otras imágenes del sitio
   —`sobre-mi` lleva una foto y tres PNG empotrados—. Es más chico y se arregla
   aparte.
   ══════════════════════════════════════════════════════════════════════════ */

/* El tamaño intrínseco de los cinco archivos. Se declara en el `<img>` para que
   el navegador sepa qué proporción viene antes de descargarla. */
export const PORTADA_SIZE = { width: 480, height: 480 };

export const PORTADA_POR_SLUG = Object.freeze({
  matematicas: "/subjects/matematica.webp",
  fisica: "/subjects/fisica.webp",
  fisicoquimica: "/subjects/fisicoquimica.webp",
  quimica: "/subjects/quimica.webp",
  ingles: "/subjects/ingles.webp",
});
