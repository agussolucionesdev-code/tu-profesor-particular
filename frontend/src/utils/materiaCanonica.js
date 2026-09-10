import { SUBJECT_SUGGESTIONS_BY_LEVEL } from "../constants/bookingWizard.js";

/* ══════════════════════════════════════════════════════════════════════════
   LA MATERIA QUE LLEGA POR LA URL, DEVUELTA CON SU NOMBRE CANÓNICO.

   POR QUÉ EXISTE

   El sitio institucional enlazaba `/reservar?materia=Matemáticas` —en plural,
   porque el título de la tarjeta allá dice "Matemáticas"— y el kiosco guardaba
   ese texto tal cual. Dos consecuencias, y la segunda es la cara:

   1. Ninguna tarjeta del paso 1 quedaba marcada. La pantalla mostraba
      "Elegiste: Matemáticas" arriba y una lista con "Matemática" sin
      seleccionar. Quien llegaba desde el sitio tenía que elegirla de nuevo.

   2. La excepción de precios está cargada como "Matemática". Con el plural no
      coincidía, y una clase de Secundaria se cotizaba a la tarifa base:
      $20.000 en lugar de $25.000. En la materia más pedida, y entrando desde
      el propio sitio.

   El origen ya se corrigió —el institucional manda el nombre canónico— y el
   servidor también normaliza al cotizar. Este archivo cubre lo que ninguna de
   las dos cosas alcanza: LOS ENLACES QUE YA SE COMPARTIERON. Un `?materia=`
   con el plural mandado por WhatsApp hace tres meses va a seguir existiendo
   para siempre, y quien lo abra tiene que ver su materia elegida.

   QUÉ NORMALIZA, Y NADA MÁS

     - mayúsculas          "MATEMATICA"  -> "Matemática"
     - tildes              "matematica"  -> "Matemática"
     - una "s" final       "Matemáticas" -> "Matemática"

   La "s" se saca de los dos lados de la comparación, así que las materias que
   son plurales de nacimiento —"Ciencias Naturales", "Prácticas Docentes"— se
   normalizan igual y siguen coincidiendo consigo mismas.

   LO QUE NO HACE, a propósito: no adivina. No hay distancia de edición ni
   sinónimos. "Matematica" sin tilde coincide; "Mate" no, y se guarda tal cual.
   Eso último es correcto: el paso 1 acepta materia escrita a mano, y "Mate"
   podría ser una materia real de un plan que no está en la lista. Adivinar de
   más terminaría eligiendo por el alumno una materia que no pidió —y con ella,
   una tarifa que no eligió—, que es un error peor que el que esto arregla.
══════════════════════════════════════════════════════════════════════════ */

/* La misma clave que usa `backend/src/services/pricingMatrix.js`. Está
   duplicada por la misma razón que el resto del texto compartido: son dos
   proyectos sin paquete común. Que las dos se comporten igual lo verifica
   `tests/unit/materiaCanonica.test.js` con la tabla de casos, y el servidor
   sigue siendo el que decide el precio. */
const clave = (valor) => {
  if (typeof valor !== "string") return "";
  const limpio = valor
    .trim()
    .toLocaleLowerCase("es-AR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  // Sólo la "s" del final, y sólo si queda algo antes: "s" a secas no es plural.
  return limpio.length > 1 ? limpio.replace(/s$/, "") : limpio;
};

/* Todas las materias que el kiosco conoce, sin repetir.
   Se arma una vez al cargar el módulo: la lista es constante y recorrer los
   cinco niveles en cada tecleo del paso 1 no aporta nada. */
const CANONICAS = new Map();
for (const materias of Object.values(SUBJECT_SUGGESTIONS_BY_LEVEL)) {
  for (const materia of materias) {
    const k = clave(materia);
    // La primera gana. Si dos materias colapsaran a la misma clave habría que
    // saberlo, y por eso hay un test que verifica que no pase.
    if (k && !CANONICAS.has(k)) CANONICAS.set(k, materia);
  }
}

export const MATERIAS_CONOCIDAS = Object.freeze([...CANONICAS.values()]);

/* Devuelve el nombre canónico de la materia, o el texto recortado si no es una
   materia conocida. Nunca devuelve `null` ni `undefined` para una entrada de
   texto: el paso 1 acepta materia libre y no puede perder lo que el alumno
   escribió. */
export const materiaCanonica = (entrada) => {
  if (typeof entrada !== "string") return "";
  const limpio = entrada.trim();
  if (!limpio) return "";
  return CANONICAS.get(clave(limpio)) ?? limpio;
};

/* Si el texto corresponde a una materia que el kiosco conoce. Lo usa el paso 1
   para decidir entre marcar una tarjeta o abrir el campo de "Otra materia". */
export const esMateriaConocida = (entrada) => CANONICAS.has(clave(entrada ?? ""));
