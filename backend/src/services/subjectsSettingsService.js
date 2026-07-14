export const SUBJECTS_SETTINGS_KEY = "booking.subjectsByLevel";

export const SUBJECT_LEVELS = Object.freeze([
  "Primaria",
  "Secundaria",
  "Secundaria Tecnica",
  "Terciario",
  "Universitario",
]);

export const MAX_SUBJECTS_PER_LEVEL = 80;
export const MAX_TOTAL_SUBJECTS = 300;
export const MAX_SUBJECT_LABEL_LENGTH = 80;

const UNSAFE_SUBJECT_CHARACTERS =
  /[\p{Cc}\p{Cs}\p{Default_Ignorable_Code_Point}]/u;

const DEFAULT_SENTINEL = Object.freeze({ __mode: "default" });

export class SubjectsSettingsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SubjectsSettingsValidationError";
  }
}

const isPlainRecord = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const hasExactKeys = (value, expected) => {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length &&
    keys.every((key, index) => key === [...expected].sort()[index]);
};

export const normalizeSubjectLabel = (value) => {
  if (typeof value !== "string") return null;
  const compatibilityNormalized = value.normalize("NFKC");
  if (UNSAFE_SUBJECT_CHARACTERS.test(compatibilityNormalized)) return null;
  const normalized = compatibilityNormalized.trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > MAX_SUBJECT_LABEL_LENGTH) return null;
  return normalized;
};

const uniqueKey = (label) => label.normalize("NFKC").toLocaleLowerCase("es-AR");

const normalizeSubjects = (subjects, { rejectDuplicates }) => {
  if (!Array.isArray(subjects) || subjects.length > MAX_SUBJECTS_PER_LEVEL) {
    throw new SubjectsSettingsValidationError(
      `Cada nivel admite hasta ${MAX_SUBJECTS_PER_LEVEL} materias.`,
    );
  }
  const normalized = [];
  const seen = new Set();
  for (const subject of subjects) {
    const label = normalizeSubjectLabel(subject);
    if (!label) {
      throw new SubjectsSettingsValidationError(
        `Cada materia debe ser un texto de hasta ${MAX_SUBJECT_LABEL_LENGTH} caracteres.`,
      );
    }
    const key = uniqueKey(label);
    if (seen.has(key)) {
      if (rejectDuplicates) {
        throw new SubjectsSettingsValidationError(
          `La materia "${label}" está repetida dentro del mismo nivel.`,
        );
      }
      continue;
    }
    seen.add(key);
    normalized.push(label);
  }
  return normalized;
};

const emptyLevels = () => SUBJECT_LEVELS.map((level) => ({ level, subjects: [] }));

export const parseSubjectsSettingsPayload = (body) => {
  if (!isPlainRecord(body) || typeof body.mode !== "string") {
    throw new SubjectsSettingsValidationError("La configuración de materias es inválida.");
  }
  if (body.mode === "default") {
    if (!hasExactKeys(body, ["mode"])) {
      throw new SubjectsSettingsValidationError(
        "El modo predeterminado no admite campos adicionales.",
      );
    }
    return {
      storageValue: { ...DEFAULT_SENTINEL },
      canonical: { mode: "default", levels: emptyLevels() },
    };
  }
  if (body.mode !== "custom" || !hasExactKeys(body, ["mode", "levels"])) {
    throw new SubjectsSettingsValidationError("El modo de materias es inválido.");
  }
  if (!Array.isArray(body.levels) || body.levels.length !== SUBJECT_LEVELS.length) {
    throw new SubjectsSettingsValidationError(
      "Debes enviar exactamente los cinco niveles educativos.",
    );
  }

  const byLevel = new Map();
  for (const entry of body.levels) {
    if (!isPlainRecord(entry) || !hasExactKeys(entry, ["level", "subjects"])) {
      throw new SubjectsSettingsValidationError("Cada nivel contiene campos inválidos.");
    }
    if (!SUBJECT_LEVELS.includes(entry.level) || byLevel.has(entry.level)) {
      throw new SubjectsSettingsValidationError("Los niveles educativos son inválidos o están repetidos.");
    }
    byLevel.set(
      entry.level,
      normalizeSubjects(entry.subjects, { rejectDuplicates: true }),
    );
  }

  const levels = SUBJECT_LEVELS.map((level) => ({ level, subjects: byLevel.get(level) }));
  const totalSubjects = levels.reduce((total, entry) => total + entry.subjects.length, 0);
  if (totalSubjects === 0 || totalSubjects > MAX_TOTAL_SUBJECTS) {
    throw new SubjectsSettingsValidationError(
      `Debes configurar entre 1 y ${MAX_TOTAL_SUBJECTS} materias en total.`,
    );
  }
  return {
    storageValue: Object.fromEntries(
      levels.map(({ level, subjects }) => [level, [...subjects]]),
    ),
    canonical: { mode: "custom", levels },
  };
};

export const normalizeStoredSubjectsSettings = (value) => {
  if (value == null) return { mode: "default", levels: emptyLevels() };
  if (
    isPlainRecord(value) &&
    hasExactKeys(value, ["__mode"]) &&
    value.__mode === "default"
  ) {
    return { mode: "default", levels: emptyLevels() };
  }
  if (!isPlainRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length === 0) return { mode: "default", levels: emptyLevels() };
  if (keys.some((key) => !SUBJECT_LEVELS.includes(key))) return null;

  try {
    const levels = SUBJECT_LEVELS.map((level) => ({
      level,
      subjects: Object.hasOwn(value, level)
        ? normalizeSubjects(value[level], { rejectDuplicates: false })
        : [],
    }));
    const totalSubjects = levels.reduce((total, entry) => total + entry.subjects.length, 0);
    if (totalSubjects === 0) return { mode: "default", levels: emptyLevels() };
    if (totalSubjects > MAX_TOTAL_SUBJECTS) return null;
    return { mode: "custom", levels };
  } catch {
    return null;
  }
};

export const toPublicSubjectsByLevel = (value) => {
  const normalized = normalizeStoredSubjectsSettings(value);
  if (!normalized || normalized.mode === "default") return null;
  return Object.fromEntries(
    normalized.levels.map(({ level, subjects }) => [level, [...subjects]]),
  );
};

export const toAdminSubjectsDto = (record) => {
  const normalized = normalizeStoredSubjectsSettings(record?.value);
  const canonical = normalized || { mode: "default", levels: emptyLevels() };
  return {
    revision: Number.isSafeInteger(record?.revision) ? record.revision : 0,
    mode: canonical.mode,
    levels: canonical.levels.map(({ level, subjects }) => ({
      level,
      subjects: [...subjects],
    })),
  };
};

export const subjectSettingsAuditSnapshot = (record) => {
  const dto = toAdminSubjectsDto(record);
  return { key: SUBJECTS_SETTINGS_KEY, ...dto };
};
