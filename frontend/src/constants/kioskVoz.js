/* Cómo le habla el wizard a quien está reservando.
 *
 * EL PROBLEMA QUE RESUELVE ESTE ARCHIVO
 *
 * El paso 1 preguntaba «¿Qué nivel estás cursando?» bajo el título «Tu recorrido
 * empieza acá». Le hablaba al ALUMNO. Pero quien reserva casi nunca es el alumno: es
 * una madre, un padre, una hermana mayor, un tío, una abuela. El sistema ya sabía que
 * son dos personas distintas —el formulario tiene `studentName` y `responsibleName`
 * por separado— pero recién lo preguntaba en el paso 4, con un checkbox.
 *
 * O sea que una abuela reservando para su nieto pasaba TRES PASOS siendo tratada como
 * si fuera ella la que cursa el secundario, y en el cuarto el sistema le preguntaba
 * quién era. No es un error de traducción: es no reconocer a la persona que está del
 * otro lado, justo en el momento en que está haciendo algo por alguien que quiere.
 *
 * LA REGLA QUE ORDENA TODO ESTO, y hay que tenerla presente para editar acá:
 *
 *   Quien LEE es siempre quien reserva.
 *
 * Por eso «Elegí», «te mostramos» y «avisarte» están BIEN en los dos casos: le hablan
 * al lector. Lo único que cambia es lo que se refiere al ALUMNO. «¿Qué nivel estás
 * cursando?» trata al lector como alumno y hay que cambiarlo; «Elegí una tarjeta» no.
 *
 * Esa distinción es la razón de que este archivo tenga dos voces y no un buscar-y-
 * reemplazar de «estás» por «está»: la mitad de los «vos» del wizard son correctos.
 *
 * Lo que NO está acá es intencional: los títulos neutros («¿Cuánto dura y cuándo?»,
 * «Revisá y confirmá», «¿Cómo preferís la clase?» —la modalidad la elige quien
 * reserva—) funcionan igual en los dos casos y duplicarlos sólo daría dos lugares
 * para que se desincronicen.
 */

export const PARA_MI = "mi";
export const PARA_OTRO = "otro";

/* La pregunta que abre el wizard. Va primero porque de acá sale el trato de todo el
   resto, y va como dos tarjetas y no como un checkbox porque un checkbox obliga a
   leer una afirmación y decidir si te describe. Elegir entre dos opciones nombradas
   es más rápido y no tiene una opción "por defecto" que sesgue la respuesta.

   El orden no es casual: «para otra persona» primero porque es el caso mayoritario. */
export const OPCIONES_PARA_QUIEN = Object.freeze([
  Object.freeze({
    value: PARA_OTRO,
    label: "Para otra persona",
    hint: "Un hijo, un hermano, un nieto, alguien a tu cargo",
  }),
  Object.freeze({
    value: PARA_MI,
    label: "Para mí",
    /* Dice «soy mayor de edad» porque esta opción es la que decide si se piden los
       datos de un adulto responsable. Antes eso vivía en un checkbox que decía «Soy
       el alumno y soy mayor de edad»: la condición de edad estaba ahí y no se puede
       perder al mover la pregunta. */
    hint: "Soy mayor de edad y la clase la tomo yo",
  }),
]);

const VOCES = Object.freeze({
  [PARA_OTRO]: Object.freeze({
    nivelEyebrow: "Empecemos por el alumno",
    nivelTitulo: "¿Qué nivel está cursando?",
    nivelSubtitulo:
      "Elegí una tarjeta y te mostramos únicamente las materias que corresponden.",
    materiaEyebrow: "Elegí la materia",
    materiaTitulo: "¿Con qué necesita ayuda?",
    otraMateriaTitulo: "¿Cuál es la materia?",
    otraMateriaAyuda: "Escribila como figura en su plan de estudios. Por ejemplo:",
    turnoSubtitulo: "Elegí la duración y después el horario que mejor les venga.",
    datosTitulo: "Tus datos y los del alumno",
    objetivoLabel: "¿Qué necesita lograr en la clase? *",
    /* El nombre del alumno NO es el de quien está usando el teléfono, así que
       ofrecerle su propio nombre ahí es ofrecerle el dato equivocado. El
       autocompletado del navegador se reserva para el campo del responsable, que sí
       es la persona del dispositivo. */
    autoCompleteAlumno: "off",
    autoCompleteResponsable: "name",
  }),
  [PARA_MI]: Object.freeze({
    nivelEyebrow: "Tu recorrido empieza acá",
    nivelTitulo: "¿Qué nivel estás cursando?",
    nivelSubtitulo:
      "Elegí una tarjeta y te mostramos únicamente las materias que corresponden.",
    materiaEyebrow: "Elegí tu materia",
    materiaTitulo: "¿Qué querés aprender?",
    otraMateriaTitulo: "¿Cuál es tu materia?",
    otraMateriaAyuda: "Escribila como figura en tu plan de estudios. Por ejemplo:",
    turnoSubtitulo: "Elegí la duración y después el horario que más te sirva.",
    datosTitulo: "Tus datos",
    objetivoLabel: "¿Qué querés lograr en la clase? *",
    // Acá el alumno SÍ es quien tiene el teléfono en la mano.
    autoCompleteAlumno: "name",
    autoCompleteResponsable: "off",
  }),
});

/* Cae en la voz de tercera persona cuando todavía no se eligió.
 *
 * Es la opción prudente y no un descuido: tratar de «vos» a alguien que resulta ser
 * la abuela es el error que vinimos a arreglar, mientras que hablar del alumno en
 * tercera persona ante alguien que sí es el alumno se lee neutro, no incorrecto. Ante
 * la duda, el error más barato. */
export const vozDelWizard = (paraQuien) => VOCES[paraQuien] ?? VOCES[PARA_OTRO];
