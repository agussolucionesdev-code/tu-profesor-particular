// Constantes del flujo kiosco. Vive aparte de bookingWizard.js para no tocar el
// flujo clásico ni su contrato de tests mientras conviven.

export const KIOSK_STEPS = [
  { id: 1, label: "Materia", short: "Materia" },
  { id: 2, label: "Modalidad", short: "Modalidad" },
  { id: 3, label: "Turno", short: "Turno" },
  { id: 4, label: "Tus datos", short: "Datos" },
  { id: 5, label: "Confirmar", short: "Confirmar" },
];

// Los niveles son las claves de SUBJECT_SUGGESTIONS_BY_LEVEL. Acá les damos una
// etiqueta legible y una descripción corta para las tarjetas.
export const LEVEL_OPTIONS = [
  { value: "Primaria", label: "Primaria", hint: "1° a 6° grado" },
  { value: "Secundaria", label: "Secundaria", hint: "1° a 6° año" },
  { value: "Secundaria Tecnica", label: "Secundaria Técnica", hint: "1° a 7° año" },
  { value: "Terciario", label: "Terciario", hint: "Formación docente y superior" },
  { value: "Universitario", label: "Universitario", hint: "Carreras de grado" },
];

export const MODALITY_OPTIONS = [
  {
    value: "online",
    label: "Online",
    hint: "Videollamada. Recibís el enlace por email.",
  },
  {
    value: "presencial",
    label: "Presencial",
    hint: "En el espacio de Temperley, Buenos Aires.",
  },
];

// Duraciones ofrecidas. 1 hora es la recomendada. maxAllowedDuration del hook
// recorta lo que no entra en el turno elegido.
export const KIOSK_DURATION_OPTIONS = [
  { value: 0.5, label: "30 min" },
  { value: 1, label: "1 hora", recommended: true },
  { value: 1.5, label: "1 h 30" },
  { value: 2, label: "2 horas" },
  { value: 2.5, label: "2 h 30" },
  { value: 3, label: "3 horas" },
];

export const getKioskYearGradeOptions = (level) => {
  if (level === "Primaria") {
    return ["1er grado", "2do grado", "3er grado", "4to grado", "5to grado", "6to grado"];
  }
  if (level === "Secundaria" || level === "Secundaria Tecnica") {
    return [
      "1er año",
      "2do año",
      "3er año",
      "4to año",
      "5to año",
      "6to año",
      level === "Secundaria Tecnica" ? "7mo año" : null,
    ].filter(Boolean);
  }
  if (level === "Terciario" || level === "Universitario") {
    return ["1er año", "2do año", "3er año", "4to año", "5to año", "6to año", "Avanzado"];
  }
  return [];
};

// Cuántos días próximos y cuántos turnos por día mostrar de entrada, antes de
// que el usuario pida "ver más".
export const KIOSK_UPCOMING_DAYS = 3;
export const KIOSK_SLOTS_PER_DAY = 6;
