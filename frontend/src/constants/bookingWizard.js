export const WIZARD_STEPS = [
  {
    id: 1,
    label: "Tus datos",
    title: "Empezamos simple",
    message: "Completá los datos esenciales del alumno y su contacto.",
    chips: ["Contacto claro", "Validación al momento"],
  },
  {
    id: 2,
    label: "Necesidad académica",
    title: "Entendemos qué necesitás",
    message: "Definí nivel, curso, materia y objetivo de la clase.",
    chips: ["Objetivo claro", "Contexto opcional"],
  },
  {
    id: 3,
    label: "Tu turno",
    title: "Elegí y revisá tu turno",
    message: "Seleccioná fecha, horario y duración antes de confirmar.",
    chips: ["Agenda real", "Resumen final"],
  },
];

export const BOOKING_INITIAL_FORM_DATA = {
  responsibleName: "",
  responsibleRelationship: "",
  responsibleRelationshipOther: "",
  studentName: "",
  email: "",
  phone: "",
  school: "",
  educationLevel: "",
  yearGrade: "",
  subject: "",
  objective: "",
  academicSituation: "",
  timeSlot: null,
  /* 2 horas preseleccionadas, que es la duración recomendada.
     Antes arrancaba vacío y el paso 3 mostraba "Elegí una duración para ver los
     horarios": un clic obligatorio antes de poder ver un solo turno, incluso para
     la opción que el propio wizard recomienda. Con un valor por defecto, los
     horarios aparecen apenas se llega al paso, y cambiarlo sigue siendo un clic
     para quien quiera otra duración. */
  duration: 2,
};

export const isAcademicDraftComplete = (draft) =>
  Boolean(
    draft.educationLevel?.trim() &&
      draft.yearGrade?.trim() &&
      draft.subject?.trim() &&
      draft.objective?.trim().length >= 3 &&
      draft.objective?.trim().length <= 300,
  );

export const updateBookingDraft = (draft, patch) => ({ ...draft, ...patch });

export const toBookingApiAcademicSituation = ({
  objective = "",
  academicSituation = "",
}) =>
  [
    `Objetivo: ${objective.trim()}`,
    academicSituation.trim()
      ? `Comentarios: ${academicSituation.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

export const BOOKING_SUPPORT_PILLS = [
  "Reserva guiada",
  "WhatsApp como canal principal",
  "Código para gestionar cambios",
];

/* Materias sugeridas por nivel.
   Depuradas para ofrecer SÓLO lo que se dicta de verdad: antes la lista incluía
   Derecho Penal, Contabilidad, Programación, Antropología y otras 20 materias
   que no se dan, y ofrecer un turno que después hay que cancelar cuesta más que
   no ofrecerlo. Se sacaron también las no académicas (Arte, Música, Educación
   Física), que nadie toma en clases particulares.

   Esta lista es el fallback embebido: si en el panel de administración se carga
   `booking.subjectsByLevel`, ese valor tiene prioridad sobre esto.

   Quien no encuentre su materia acá tiene la opción "Otra materia" en el paso 1,
   que permite escribirla (el backend acepta texto libre de 2 a 120 caracteres). */
/* Las materias que Agustín dicta en secundaria. Viven en una constante propia
   porque Secundaria, Secundaria Técnica y CENS comparten exactamente la misma
   lista, y repetirla tres veces garantizaba que alguna quedara vieja. */
const SECUNDARIA = [
  "Biología",
  "Física",
  "Fisicoquímica",
  "Inglés",
  "Lengua y Literatura",
  "Matemática",
  "Química",
];

export const SUBJECT_SUGGESTIONS_BY_LEVEL = {
  Primaria: [
    "Ciencias Naturales",
    "Ciencias Sociales",
    "Inglés",
    "Lengua y Literatura",
    "Matemática",
  ],
  Secundaria: SECUNDARIA,
  /* Secundaria Técnica dicta lo mismo que Secundaria, a efectos de las clases
     particulares de Agustín.

     Acá había 19 materias: Electricidad, Electromecánica, Electrónica,
     Instalaciones, Máquinas, Mecánica, Sistemas Automáticos, Dibujo Técnico,
     Informática, Tecnología, Educación Física... Ninguna se dicta. Estaban
     porque la lista se armó copiando el plan de estudios de una técnica, no
     preguntando qué enseña Agustín, y cada una de esas tarjetas era un turno
     que después había que cancelar.

     Comparte la referencia con Secundaria a propósito: si mañana se agrega una
     materia allá, aparece acá sola y no hay dos listas que se desincronizan. */
  "Secundaria Tecnica": SECUNDARIA,
  /* CENS, la secundaria de adultos. Mismo contenido que Secundaria: lo que
     cambia es la edad de quien cursa, no el programa. */
  CENS: SECUNDARIA,
  /* Terciario y Universitario NO llevan grilla de tarjetas: llevan buscador.

     Antes había 18 materias cargadas en Terciario (Pedagogía, Antropología
     Social, Didáctica y Currículo, Política y Legislación Educativa...) y 5 en
     Universitario. Dos problemas a la vez: la mayoría no se dicta, y las que
     sí cambian de nombre en cada facultad —"Matemática" en el CBC es "Análisis
     Matemático I" en Exactas y "Álgebra y Geometría Analítica" en la UTN—, así
     que ninguna lista fija iba a alcanzar.

     La respuesta es `components/booking/BuscadorDeMateria.jsx`, que filtra
     sobre `constants/materiasSuperior.js` mientras la persona escribe, sin
     tildes y sin importar mayúsculas, y siempre deja escribir la materia a
     mano. Las listas vacías de acá son deliberadas: son la señal de que ese
     nivel usa buscador. */
  Terciario: [],
  Universitario: [],
};

/* Las materias que más se piden, primero.
 *
 * Las listas de arriba están alfabéticas porque así son fáciles de mantener, pero
 * mostrarlas alfabéticas dejaba Matemática SEXTA en Secundaria: la materia
 * principal del servicio caía en la segunda fila, fuera de la vista al llegar al
 * paso. Quien viene buscando lo más pedido tenía que scrollear para encontrarlo.
 *
 * El orden va acá y no en los datos para no repetir la decisión en cinco listas y
 * que se desincronicen al agregar una materia. Lo que no está en la prioridad
 * conserva su orden alfabético. */
const MATERIAS_PRIORITARIAS = [
  "Matemática",
  "Física",
  "Fisicoquímica",
  "Química",
  "Inglés",
];

const prioridadDe = (materia) => {
  const i = MATERIAS_PRIORITARIAS.indexOf(materia);
  return i === -1 ? MATERIAS_PRIORITARIAS.length : i;
};

export const getSubjectSuggestions = (educationLevel) => {
  const materias = SUBJECT_SUGGESTIONS_BY_LEVEL[educationLevel] ?? [];
  // Copia antes de ordenar: sort() muta, y estas listas son constantes del módulo.
  return [...materias].sort((a, b) => prioridadDe(a) - prioridadDe(b));
};
