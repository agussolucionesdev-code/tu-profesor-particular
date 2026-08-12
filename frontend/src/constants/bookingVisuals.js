import primaria from "../assets/booking/levels/primaria.webp";
import secundaria from "../assets/booking/levels/secundaria.webp";
import secundariaTecnica from "../assets/booking/levels/secundaria-tecnica.webp";
import terciario from "../assets/booking/levels/terciario.webp";
import universitario from "../assets/booking/levels/universitario.webp";
import biologia from "../assets/booking/subjects/biologia.webp";
import fisica from "../assets/booking/subjects/fisica.webp";
import fisicoquimica from "../assets/booking/subjects/fisicoquimica.webp";
import historia from "../assets/booking/subjects/historia.webp";
import ingles from "../assets/booking/subjects/ingles.webp";
import matematica from "../assets/booking/subjects/matematica.webp";
import otraMateria from "../assets/booking/subjects/otra-materia.webp";
import practicasDelLenguaje from "../assets/booking/subjects/practicas-del-lenguaje.webp";
import quimica from "../assets/booking/subjects/quimica.webp";

const LEVEL_VISUAL_SIZE = { width: 640, height: 640 };
const SUBJECT_VISUAL_SIZE = { width: 768, height: 768 };
const OTHER_VISUAL_SIZE = { width: 640, height: 640 };

const LEVEL_VISUALS = {
  Primaria: { src: primaria, ...LEVEL_VISUAL_SIZE },
  Secundaria: { src: secundaria, ...LEVEL_VISUAL_SIZE },
  "Secundaria Tecnica": { src: secundariaTecnica, ...LEVEL_VISUAL_SIZE },
  Terciario: { src: terciario, ...LEVEL_VISUAL_SIZE },
  Universitario: { src: universitario, ...LEVEL_VISUAL_SIZE },
};

const SUBJECT_VISUALS = {
  biologia: { src: biologia, ...SUBJECT_VISUAL_SIZE },
  fisica: { src: fisica, ...SUBJECT_VISUAL_SIZE },
  fisicoquimica: { src: fisicoquimica, ...SUBJECT_VISUAL_SIZE },
  historia: { src: historia, ...SUBJECT_VISUAL_SIZE },
  ingles: { src: ingles, ...SUBJECT_VISUAL_SIZE },
  matematica: { src: matematica, ...SUBJECT_VISUAL_SIZE },
  otraMateria: { src: otraMateria, ...OTHER_VISUAL_SIZE },
  practicasDelLenguaje: { src: practicasDelLenguaje, ...SUBJECT_VISUAL_SIZE },
  quimica: { src: quimica, ...SUBJECT_VISUAL_SIZE },
};

/* Microcopy de cada materia.
 *
 * No promete resultados automáticos ni usa "neuro" como etiqueta comercial.
 * Traduce principios útiles de aprendizaje —comprender, recuperar, practicar y
 * transferir— a una expectativa concreta que el estudiante puede reconocer. */
const SUBJECT_PRESENTATIONS = {
  matematica: {
    kicker: "Lógica aplicada",
    description:
      "Entendé el porqué de cada paso, practicá con guía y resolvé con autonomía.",
    focus: "Razonamiento y resolución",
  },
  fisica: {
    kicker: "Fenómenos y modelos",
    description:
      "Pasá de la situación al modelo: datos, magnitudes y decisiones bien justificadas.",
    focus: "Modelos y problemas",
  },
  quimica: {
    kicker: "Materia y reacciones",
    description:
      "Visualizá partículas y reacciones para conectar fórmulas con fenómenos reales.",
    focus: "Comprensión molecular",
  },
  fisicoquimica: {
    kicker: "Materia + energía",
    description:
      "Integrá materia, energía y mediciones para explicar cada transformación.",
    focus: "Conexiones entre conceptos",
  },
  biologia: {
    kicker: "Sistemas vivos",
    description:
      "Relacioná estructuras, procesos y funciones para comprender los sistemas vivos.",
    focus: "Sistemas y procesos",
  },
  ingles: {
    kicker: "Comunicación",
    description:
      "Comprendé y producí con propósito para ganar precisión, confianza y fluidez.",
    focus: "Comunicación en contexto",
  },
  practicasDelLenguaje: {
    kicker: "Lenguaje en acción",
    description:
      "Leé con estrategia, escribí con claridad y fundamentá tus interpretaciones.",
    focus: "Lectura, escritura y oralidad",
  },
  historia: {
    kicker: "Procesos y fuentes",
    description:
      "Ordená el tiempo, conectá causas y explicá procesos a partir de fuentes.",
    focus: "Tiempo, causas y evidencias",
  },
  otraMateria: {
    kicker: "Plan a medida",
    description:
      "Partimos de tu programa y armamos una ruta clara para comprender, practicar y avanzar.",
    focus: "Tu objetivo académico",
  },
};

const normalizeLabel = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR")
    .trim();

export const getLevelVisual = (level) =>
  LEVEL_VISUALS[level] ?? LEVEL_VISUALS.Secundaria;

const resolveSubjectKey = (subject) => {
  const normalized = normalizeLabel(subject);

  // El orden importa: Fisicoquímica debe resolverse antes que Física o Química.
  if (normalized.includes("fisicoquim")) return "fisicoquimica";
  if (normalized.includes("matematic") || normalized.includes("algebra")) {
    return "matematica";
  }
  if (normalized.includes("fisic")) return "fisica";
  if (normalized.includes("quim")) return "quimica";
  if (normalized.includes("biolog") || normalized.includes("ciencias naturales")) {
    return "biologia";
  }
  if (normalized.includes("ingles") || normalized.includes("lengua extranjera")) {
    return "ingles";
  }
  if (
    normalized.includes("practicas del lenguaje") ||
    normalized.includes("lengua") ||
    normalized.includes("literatura")
  ) {
    return "practicasDelLenguaje";
  }
  if (
    normalized.includes("historia") ||
    normalized.includes("ciencias sociales")
  ) {
    return "historia";
  }

  return "otraMateria";
};

export const getSubjectVisual = (subject) =>
  SUBJECT_VISUALS[resolveSubjectKey(subject)];

export const getSubjectPresentation = (subject) => {
  const key = resolveSubjectKey(subject);
  return {
    key,
    ...SUBJECT_VISUALS[key],
    ...SUBJECT_PRESENTATIONS[key],
  };
};

export const OTHER_SUBJECT_VISUAL = SUBJECT_VISUALS.otraMateria;
export const OTHER_SUBJECT_PRESENTATION = SUBJECT_PRESENTATIONS.otraMateria;
