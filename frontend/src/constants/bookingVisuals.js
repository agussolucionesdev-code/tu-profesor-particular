import primaria from "../assets/booking/levels/primaria.webp";
import secundaria from "../assets/booking/levels/secundaria.webp";
import secundariaTecnica from "../assets/booking/levels/secundaria-tecnica.webp";
import terciario from "../assets/booking/levels/terciario.webp";
import universitario from "../assets/booking/levels/universitario.webp";
import biologia from "../assets/booking/subjects/biologia.webp";
import fisica from "../assets/booking/subjects/fisica.webp";
import fisicoquimica from "../assets/booking/subjects/fisicoquimica.webp";
import ingles from "../assets/booking/subjects/ingles.webp";
import lenguaLiteratura from "../assets/booking/subjects/lengua-literatura.webp";
import matematica from "../assets/booking/subjects/matematica.webp";
import otraMateria from "../assets/booking/subjects/otra-materia.webp";
import quimica from "../assets/booking/subjects/quimica.webp";

const VISUAL_SIZE = { width: 640, height: 640 };

const LEVEL_VISUALS = {
  Primaria: { src: primaria, ...VISUAL_SIZE },
  Secundaria: { src: secundaria, ...VISUAL_SIZE },
  "Secundaria Tecnica": { src: secundariaTecnica, ...VISUAL_SIZE },
  Terciario: { src: terciario, ...VISUAL_SIZE },
  Universitario: { src: universitario, ...VISUAL_SIZE },
};

const SUBJECT_VISUALS = {
  biologia: { src: biologia, ...VISUAL_SIZE },
  fisica: { src: fisica, ...VISUAL_SIZE },
  fisicoquimica: { src: fisicoquimica, ...VISUAL_SIZE },
  ingles: { src: ingles, ...VISUAL_SIZE },
  lenguaLiteratura: { src: lenguaLiteratura, ...VISUAL_SIZE },
  matematica: { src: matematica, ...VISUAL_SIZE },
  otraMateria: { src: otraMateria, ...VISUAL_SIZE },
  quimica: { src: quimica, ...VISUAL_SIZE },
};

const normalizeLabel = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR")
    .trim();

export const getLevelVisual = (level) =>
  LEVEL_VISUALS[level] ?? LEVEL_VISUALS.Secundaria;

export const getSubjectVisual = (subject) => {
  const normalized = normalizeLabel(subject);

  // El orden importa: Fisicoquímica debe resolverse antes que Física o Química.
  if (normalized.includes("fisicoquim")) return SUBJECT_VISUALS.fisicoquimica;
  if (normalized.includes("matematic") || normalized.includes("algebra")) {
    return SUBJECT_VISUALS.matematica;
  }
  if (normalized.includes("fisic")) return SUBJECT_VISUALS.fisica;
  if (normalized.includes("quim")) return SUBJECT_VISUALS.quimica;
  if (normalized.includes("biolog") || normalized.includes("ciencias naturales")) {
    return SUBJECT_VISUALS.biologia;
  }
  if (normalized.includes("ingles") || normalized.includes("lengua extranjera")) {
    return SUBJECT_VISUALS.ingles;
  }
  if (normalized.includes("lengua") || normalized.includes("literatura")) {
    return SUBJECT_VISUALS.lenguaLiteratura;
  }

  return SUBJECT_VISUALS.otraMateria;
};

export const OTHER_SUBJECT_VISUAL = SUBJECT_VISUALS.otraMateria;
