import primaria from "../assets/booking/levels/primaria.webp";
import secundaria from "../assets/booking/levels/secundaria.webp";
import secundariaTecnica from "../assets/booking/levels/secundaria-tecnica.webp";
import terciario from "../assets/booking/levels/terciario.webp";
import universitario from "../assets/booking/levels/universitario.webp";

/* Portadas de materia. Ver el comentario largo más abajo sobre por qué hay dos
   familias y por qué la resolución depende del nivel. */
import biologia from "../assets/booking/subjects/biologia.webp";
import cbc from "../assets/booking/subjects/cbc.webp";
import fisica from "../assets/booking/subjects/fisica.webp";
import fisicoquimica from "../assets/booking/subjects/fisicoquimica.webp";
import ingles from "../assets/booking/subjects/ingles.webp";
import lenguaLiteratura from "../assets/booking/subjects/lengua-literatura.webp";
import matematica from "../assets/booking/subjects/matematica.webp";
import otraMateria from "../assets/booking/subjects/otra-materia.webp";
import quimica from "../assets/booking/subjects/quimica.webp";

import primCienciasNaturales from "../assets/booking/subjects/primaria/ciencias-naturales.webp";
import primCienciasSociales from "../assets/booking/subjects/primaria/ciencias-sociales.webp";
import primIngles from "../assets/booking/subjects/primaria/ingles.webp";
import primLenguaLiteratura from "../assets/booking/subjects/primaria/lengua-literatura.webp";
import primMatematica from "../assets/booking/subjects/primaria/matematica.webp";

/* ══════════════════════════════════════════════════════════════════════════
   POR QUÉ LAS PORTADAS CAMBIAN SEGÚN EL NIVEL

   Hasta ahora había UNA imagen por materia, la misma para un nene de cuarto
   grado y para alguien que cursa Análisis Matemático en la facultad. Eso
   tenía dos problemas.

   El primero es de contenido. La portada de Matemática mostraba
   a² + b² = c² y A = πr², que son contenidos de secundaria. En una tarjeta
   de primaria están de más: en primaria se enseñan las cuatro operaciones y
   fracciones simples.

   El segundo es de público, y lo planteó Agustín: la madre que busca apoyo
   para cuarto grado y el estudiante que rinde un final no son la misma
   persona, y la portada puede hablarle a cada uno.

   Entonces hay dos familias:

     PRIMARIA      multicolor, alegre, con signos y números simples.
     EL RESTO      la identidad de marca: navy, verde, crema y cuadriculado,
                   con las fórmulas reales de cada materia.

   Secundaria, Secundaria Técnica, CENS, Terciario y Universitario comparten
   la familia de marca a propósito: lo que cambia entre esos niveles es la
   materia que se busca, no el tono con que hay que hablarle a quien busca.

   EL CBC TIENE PORTADA PROPIA porque es un producto aparte: quien busca
   preparación para el Ciclo Básico Común ya sabe lo que necesita y tiene una
   fecha encima. No es "una materia más de universitario".
   ══════════════════════════════════════════════════════════════════════════ */

/* 480 y no 640. El tamaño real al que se renderiza la tarjeta en el kiosco es
   152x152 px, medido en el navegador. A 480 se cubre hasta DPR 3 —los
   teléfonos más finos que existen— con margen. Los 640 anteriores eran 4x el
   tamaño lineal y 18x en píxeles: peso sin beneficio visible. */
const VISUAL_SIZE = { width: 480, height: 480 };

/* Las imágenes de NIVEL siguen siendo los renders 3D originales, a 640 y con
   transparencia. No se tocaron: son otra pieza, se usan en otra pantalla y
   ahí el tratamiento flotante sí corresponde. */
const LEVEL_VISUAL_SIZE = { width: 640, height: 640 };

const LEVEL_VISUALS = {
  Primaria: { src: primaria, ...LEVEL_VISUAL_SIZE },
  Secundaria: { src: secundaria, ...LEVEL_VISUAL_SIZE },
  "Secundaria Tecnica": { src: secundariaTecnica, ...LEVEL_VISUAL_SIZE },
  /* CENS comparte la imagen de Secundaria: es la misma secundaria, cursada
     por adultos. */
  CENS: { src: secundaria, ...LEVEL_VISUAL_SIZE },
  Terciario: { src: terciario, ...LEVEL_VISUAL_SIZE },
  Universitario: { src: universitario, ...LEVEL_VISUAL_SIZE },
};

const SUBJECT_VISUALS = {
  biologia: { src: biologia, ...VISUAL_SIZE },
  cbc: { src: cbc, ...VISUAL_SIZE },
  fisica: { src: fisica, ...VISUAL_SIZE },
  fisicoquimica: { src: fisicoquimica, ...VISUAL_SIZE },
  ingles: { src: ingles, ...VISUAL_SIZE },
  lenguaLiteratura: { src: lenguaLiteratura, ...VISUAL_SIZE },
  matematica: { src: matematica, ...VISUAL_SIZE },
  otraMateria: { src: otraMateria, ...VISUAL_SIZE },
  quimica: { src: quimica, ...VISUAL_SIZE },
};

const PRIMARIA_VISUALS = {
  cienciasNaturales: { src: primCienciasNaturales, ...VISUAL_SIZE },
  cienciasSociales: { src: primCienciasSociales, ...VISUAL_SIZE },
  ingles: { src: primIngles, ...VISUAL_SIZE },
  lenguaLiteratura: { src: primLenguaLiteratura, ...VISUAL_SIZE },
  matematica: { src: primMatematica, ...VISUAL_SIZE },
};

const normalizeLabel = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es-AR")
    .trim();

export const getLevelVisual = (level) =>
  LEVEL_VISUALS[level] ?? LEVEL_VISUALS.Secundaria;

/* Las cinco materias de Primaria. Cada una tiene portada propia, así que acá
   no hay fallback silencioso a otra materia: si aparece algo que no es de la
   lista, se devuelve null y el resolvedor general se encarga. */
const resolvePrimaria = (normalized) => {
  if (normalized.includes("matematic")) return PRIMARIA_VISUALS.matematica;
  if (normalized.includes("ciencias naturales") || normalized.includes("naturales")) {
    return PRIMARIA_VISUALS.cienciasNaturales;
  }
  if (normalized.includes("ciencias sociales") || normalized.includes("sociales")) {
    return PRIMARIA_VISUALS.cienciasSociales;
  }
  if (normalized.includes("ingles")) return PRIMARIA_VISUALS.ingles;
  if (normalized.includes("lengua") || normalized.includes("literatura")) {
    return PRIMARIA_VISUALS.lenguaLiteratura;
  }
  return null;
};

/* `level` es opcional a propósito: sin él la función se comporta como antes y
   devuelve la familia de marca. Así ninguna llamada vieja se rompe. */
export const getSubjectVisual = (subject, level) => {
  const normalized = normalizeLabel(subject);

  if (level === "Primaria") {
    const dePrimaria = resolvePrimaria(normalized);
    if (dePrimaria) return dePrimaria;
  }

  /* El CBC antes que cualquier otra cosa: "Matemática (CBC)" tiene que
     resolver a la portada del CBC, no a la de Matemática. */
  if (normalized.includes("cbc") || normalized.includes("ciclo basico")) {
    return SUBJECT_VISUALS.cbc;
  }

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
