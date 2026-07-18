// Sistema de íconos por materia y nivel para el kiosco.
//
// Se resuelve por PALABRA CLAVE, no por nombre exacto: una materia nueva cargada
// desde el /admin ("Cálculo II", "Química Analítica", "Inglés Técnico") igual
// recibe su ícono sin tocar este archivo. El orden importa: la primera regla que
// matchea gana, así que van de más específica a más general.
//
// Íconos planos (react-icons/fa), coherentes con el flat design de la marca.
import {
  FaCalculator,
  FaSuperscript,
  FaAtom,
  FaFlask,
  FaDna,
  FaMicroscope,
  FaLeaf,
  FaLanguage,
  FaBookOpen,
  FaLandmark,
  FaGlobeAmericas,
  FaBrain,
  FaPalette,
  FaMusic,
  FaRunning,
  FaLaptopCode,
  FaCode,
  FaMicrochip,
  FaBolt,
  FaCogs,
  FaTools,
  FaDraftingCompass,
  FaChartLine,
  FaBriefcase,
  FaBalanceScale,
  FaGavel,
  FaUsers,
  FaChalkboardTeacher,
  FaSearch,
  FaHandshake,
  FaBook,
  FaGraduationCap,
  FaSchool,
  FaUniversity,
} from "react-icons/fa";

const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // saca acentos (diacríticos combinados)

// [substring a buscar, ícono]. Orden = prioridad.
const SUBJECT_RULES = [
  // Exactas / muy específicas primero
  ["dibujo tecnico", FaDraftingCompass],
  ["geometria", FaDraftingCompass],
  ["algebra", FaSuperscript],
  ["trigonometr", FaSuperscript],
  ["calculo", FaSuperscript],
  ["analisis matematico", FaSuperscript],
  ["matematica discreta", FaSuperscript],
  ["estadistica", FaChartLine],
  ["matematica", FaCalculator],
  ["logica", FaBrain],

  // Ciencias exactas
  ["fisicoquimica", FaFlask],
  ["quimica", FaFlask],
  ["termodinamica", FaAtom],
  ["fisica", FaAtom],

  // Ciencias naturales / bio
  ["biologia celular", FaDna],
  ["biologia", FaDna],
  ["fisiologia", FaDna],
  ["ciencias naturales", FaLeaf],
  ["naturales", FaLeaf],

  // Tecnología / sistemas
  ["programacion", FaCode],
  ["sistemas de informacion", FaLaptopCode],
  ["sistemas automaticos", FaMicrochip],
  ["informatica", FaLaptopCode],
  ["tecnologia", FaMicrochip],
  ["electronica", FaMicrochip],
  ["electromecanica", FaCogs],
  ["electricidad", FaBolt],
  ["mecanica", FaCogs],
  ["maquinas", FaCogs],
  ["instalaciones", FaTools],

  // Lengua / idiomas / letras
  ["ingles", FaLanguage],
  ["lengua extranjera", FaLanguage],
  ["lengua", FaBookOpen],
  ["literatura", FaBookOpen],

  // Sociales / humanidades
  ["geografia", FaGlobeAmericas],
  ["historia", FaLandmark],
  ["filosofia", FaBrain],
  ["psicologia", FaBrain],
  ["antropologia", FaUsers],
  ["sociologia", FaUsers],
  ["ciencias sociales", FaUsers],
  ["etica y ciudadana", FaHandshake],

  // Arte / música / ed. física
  ["educacion fisica", FaRunning],
  ["educacion artistica", FaPalette],
  ["arte", FaPalette],
  ["dibujo", FaPalette],
  ["musica", FaMusic],

  // Económicas / derecho / gestión
  ["contabilidad", FaChartLine],
  ["economia", FaChartLine],
  ["microeconomia", FaChartLine],
  ["administracion", FaBriefcase],
  ["gestion", FaBriefcase],
  ["derecho", FaGavel],
  ["legislacion", FaGavel],
  ["politica", FaBalanceScale],

  // Educación / docencia / investigación
  ["metodologia de la investigacion", FaSearch],
  ["investigacion", FaSearch],
  ["pedagogia", FaChalkboardTeacher],
  ["didactica", FaChalkboardTeacher],
  ["curriculo", FaChalkboardTeacher],
  ["practicas docentes", FaChalkboardTeacher],
  ["educacion", FaChalkboardTeacher],
];

// Devuelve el COMPONENTE de ícono (no el elemento) para una materia.
export const getSubjectIcon = (name) => {
  const key = normalize(name);
  for (const [needle, Icon] of SUBJECT_RULES) {
    if (key.includes(needle)) return Icon;
  }
  return FaBookOpen; // default neutro y académico
};

const LEVEL_ICONS = {
  Primaria: FaSchool,
  Secundaria: FaGraduationCap,
  "Secundaria Tecnica": FaTools,
  Terciario: FaChalkboardTeacher,
  Universitario: FaUniversity,
};

export const getLevelIcon = (level) => LEVEL_ICONS[level] ?? FaBook;
