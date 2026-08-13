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
export const SUBJECT_SUGGESTIONS_BY_LEVEL = {
  Primaria: [
    "Ciencias Naturales",
    "Ciencias Sociales",
    "Inglés",
    "Matemática",
    "Prácticas del Lenguaje",
  ],
  Secundaria: [
    "Biología",
    "Física",
    // Fisicoquímica es una de las materias principales que se dictan y se cursa
    // en secundaria, pero nunca había estado en esta lista: quien la buscaba
    // desde el Inicio no la encontraba al llegar al formulario.
    "Fisicoquímica",
    "Historia",
    "Inglés",
    "Matemática",
    "Prácticas del Lenguaje",
    "Química",
  ],
  "Secundaria Tecnica": [
    "Biología",
    "Dibujo Técnico",
    "Educación Física",
    "Electricidad",
    "Electromecánica",
    "Electrónica",
    "Física",
    "Geometría",
    "Historia",
    "Informática",
    "Inglés",
    "Instalaciones",
    "Matemática",
    "Máquinas",
    "Mecánica",
    "Prácticas del Lenguaje",
    "Química",
    "Sistemas Automáticos",
    "Tecnología",
  ],
  Terciario: [
    "Administración General",
    "Antropología Social",
    "Didáctica y Currículo",
    "Filosofía de la Educación",
    "Gestión Educativa",
    "Historia de la Educación",
    "Historia Social Argentina",
    "Informática Educativa",
    "Inglés",
    "Lengua Extranjera",
    "Metodología de la Investigación Educativa",
    "Pedagogía",
    "Política y Legislación Educativa Argentina",
    "Prácticas Docentes",
    "Psicología de la Educación",
    "Sociología",
    "Sociología de la Educación",
    "Tecnología Educativa",
  ],
  // Corte a las 5 materias principales que se declaran en el sitio. Quien curse
  // Análisis Matemático, Álgebra u otra, la escribe con "Otra materia".
  Universitario: [
    "Fisicoquímica",
    "Física",
    "Inglés",
    "Matemática",
    "Química",
  ],

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
  "Química",
  "Fisicoquímica",
  "Biología",
  "Inglés",
  "Prácticas del Lenguaje",
  "Historia",
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
