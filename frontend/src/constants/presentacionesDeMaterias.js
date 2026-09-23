/* Sin imports de imágenes a propósito: este módulo se usa desde los tests de
   Node, que no saben cargar .webp. Las portadas viven en bookingVisuals.js. */

const normalizeLabel = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es-AR")
    .trim();

/* ══════════════════════════════════════════════════════════════════════════
   UNA LÍNEA POR MATERIA: QUÉ SE TRABAJA

   Rescatado del PR #74, reescrito con la voz del sitio. La tarjeta decía
   «Materia» arriba del nombre, que no agrega nada. Ahora dice qué se trabaja,
   en una línea que se puede sostener: describe la materia, no promete un
   resultado. Nada de «fluidez» en Inglés —el sitio dice a propósito que no es
   un curso de conversación— ni de «aprobás en X clases».

   Primaria tiene su propio registro por la misma razón que sus portadas: le
   habla a una familia con un chico de primaria, no a quien rinde un final.
   Lo cuida tests/unit/materiasConSentido.test.js.
   ══════════════════════════════════════════════════════════════════════════ */

const PRESENTACIONES = {
  matematica: {
    kicker: "Razonamiento",
    description: "Entender el porqué de cada paso y practicar hasta resolver sin ayuda.",
  },
  fisica: {
    kicker: "Fenómenos y modelos",
    description: "De la situación al modelo: datos, magnitudes y cuentas que tienen sentido.",
  },
  quimica: {
    kicker: "Materia y reacciones",
    description: "Conectar fórmulas y reacciones con lo que pasa en la materia.",
  },
  fisicoquimica: {
    kicker: "Materia y energía",
    description: "Física y química juntas, explicadas paso a paso.",
  },
  biologia: {
    kicker: "Seres vivos",
    description: "Relacionar estructuras y procesos para entender cómo funciona lo vivo.",
  },
  ingles: {
    kicker: "Idioma",
    description: "Gramática, comprensión de textos y vocabulario para rendir bien.",
  },
  lenguaLiteratura: {
    kicker: "Lectura y escritura",
    description: "Leer con estrategia y escribir con claridad.",
  },
  cbc: {
    kicker: "Ciclo Básico Común",
    description: "Preparación para las materias del CBC de la UBA.",
  },
};

const PRESENTACIONES_PRIMARIA = {
  matematica: {
    kicker: "Números",
    description: "Las cuatro operaciones y las fracciones, con paciencia y ejemplos.",
  },
  lenguaLiteratura: {
    kicker: "Leer y escribir",
    description: "Leer y escribir con confianza, a su ritmo.",
  },
  ingles: {
    kicker: "Idioma",
    description: "Vocabulario y frases para seguir la clase de la escuela.",
  },
  cienciasNaturales: {
    kicker: "Naturaleza",
    description: "El cuerpo, las plantas y el ambiente, con ejemplos cercanos.",
  },
  cienciasSociales: {
    kicker: "Sociedad",
    description: "Mapas, historia y sociedad, contados de forma clara.",
  },
};

const PRESENTACION_GENERAL = {
  kicker: "Materia",
  description: "Partimos de lo que te está costando y armamos la clase sobre eso.",
};

export const OTHER_SUBJECT_PRESENTATION = {
  key: "otraMateria",
  kicker: "Otra materia",
  description: "Escribila y Agustín te confirma si puede tomarla.",
};

/* Misma resolución que las portadas: primero lo específico de primaria, el CBC
   antes que la materia suelta, y Fisicoquímica antes que Física o Química. */
const claveDeMateria = (normalized, level) => {
  if (level === "Primaria") {
    if (normalized.includes("matematic")) return ["primaria", "matematica"];
    if (normalized.includes("naturales")) return ["primaria", "cienciasNaturales"];
    if (normalized.includes("sociales")) return ["primaria", "cienciasSociales"];
    if (normalized.includes("ingles")) return ["primaria", "ingles"];
    if (normalized.includes("lengua") || normalized.includes("literatura")) return ["primaria", "lenguaLiteratura"];
  }
  if (normalized.includes("cbc") || normalized.includes("ciclo basico")) return ["general", "cbc"];
  if (normalized.includes("fisicoquim")) return ["general", "fisicoquimica"];
  if (normalized.includes("matematic") || normalized.includes("algebra")) return ["general", "matematica"];
  if (normalized.includes("fisic")) return ["general", "fisica"];
  if (normalized.includes("quim")) return ["general", "quimica"];
  if (normalized.includes("biolog")) return ["general", "biologia"];
  if (normalized.includes("ingles")) return ["general", "ingles"];
  if (normalized.includes("lengua") || normalized.includes("literatura")) return ["general", "lenguaLiteratura"];
  return null;
};

export const getSubjectPresentation = (subject, level) => {
  const clave = claveDeMateria(normalizeLabel(subject), level);
  if (!clave) return { key: "general", ...PRESENTACION_GENERAL };
  const [familia, key] = clave;
  const tabla = familia === "primaria" ? PRESENTACIONES_PRIMARIA : PRESENTACIONES;
  return { key, ...tabla[key] };
};
