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
  duration: "",
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

export const SUBJECT_SUGGESTIONS_BY_LEVEL = {
  Primaria: [
    "Arte",
    "Ciencias Naturales",
    "Ciencias Sociales",
    "Educación Física",
    "Inglés",
    "Lengua y Literatura",
    "Matemática",
    "Música",
  ],
  Secundaria: [
    "Biología",
    "Educación Artística",
    "Educación Ética y Ciudadana",
    "Educación Física",
    "Filosofía",
    "Física",
    "Geografía",
    "Historia",
    "Inglés",
    "Lengua y Literatura",
    "Matemática",
    "Psicología",
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
    "Lengua y Literatura",
    "Matemática",
    "Máquinas",
    "Mecánica",
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
  Universitario: [
    "Administración de Empresas",
    "Álgebra",
    "Álgebra Lineal",
    "Análisis Matemático",
    "Antropología",
    "Biología Celular",
    "Cálculo",
    "Contabilidad",
    "Derecho Constitucional",
    "Derecho Penal",
    "Economía",
    "Estadística",
    "Filosofía",
    "Física",
    "Física General",
    "Fisiología",
    "Geografía",
    "Gestión de Proyectos",
    "Historia",
    "Historia Argentina",
    "Inglés",
    "Inglés Técnico",
    "Introducción a la Administración",
    "Introducción a la Informática",
    "Legislación Laboral",
    "Lógica",
    "Matemática",
    "Matemática Discreta",
    "Metodología de la Investigación",
    "Microeconomía",
    "Programación",
    "Psicología",
    "Química",
    "Química General",
    "Química Orgánica",
    "Sociología",
    "Sistemas de Información",
    "Termodinámica",
    "Trigonometría",
  ],
};

export const getSubjectSuggestions = (educationLevel) =>
  SUBJECT_SUGGESTIONS_BY_LEVEL[educationLevel] ?? [];
