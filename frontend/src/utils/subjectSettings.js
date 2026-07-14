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

let localIdSequence = 0;

export class SubjectsValidationError extends Error {
  constructor(message, fieldId = "subjects-editor-title") {
    super(message);
    this.name = "SubjectsValidationError";
    this.fieldId = fieldId;
  }
}

const fail = (message, fieldId) => {
  throw new SubjectsValidationError(message, fieldId);
};

const isPlainRecord = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const hasExactKeys = (value, expected) => {
  if (!isPlainRecord(value)) return false;
  const keys = Object.keys(value).sort();
  const expectedKeys = [...expected].sort();
  return keys.length === expectedKeys.length &&
    keys.every((key, index) => key === expectedKeys[index]);
};

const defaultIdFactory = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  localIdSequence += 1;
  return `subject-entry-${localIdSequence}`;
};

export const normalizeSubjectLabel = (value) => {
  if (typeof value !== "string") return null;
  const compatibilityNormalized = value.normalize("NFKC");
  if (UNSAFE_SUBJECT_CHARACTERS.test(compatibilityNormalized)) return null;
  const normalized = compatibilityNormalized.trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > MAX_SUBJECT_LABEL_LENGTH) return null;
  return normalized;
};

const duplicateKey = (label) =>
  label.normalize("NFKC").toLocaleLowerCase("es-AR");

const levelSlug = (level) =>
  level.toLocaleLowerCase("es-AR").replace(/\s+/gu, "-");

const subjectInputId = (level, id) =>
  `subject-${levelSlug(level)}-${id}`;

const subjectAddId = (level) => `subjects-${levelSlug(level)}-add`;

const normalizeSubjectList = (
  subjects,
  level,
  { idFactory = defaultIdFactory, withEntries = false } = {},
) => {
  if (!Array.isArray(subjects) || subjects.length > MAX_SUBJECTS_PER_LEVEL) {
    fail(
      `Cada nivel admite hasta ${MAX_SUBJECTS_PER_LEVEL} materias.`,
      subjectAddId(level),
    );
  }

  const seen = new Set();
  return subjects.map((subject, index) => {
    const rawLabel = withEntries ? subject?.label : subject;
    const id = withEntries ? subject?.id : idFactory();
    if (withEntries && (!isPlainRecord(subject) || typeof id !== "string" || !id)) {
      fail("La lista de materias contiene una fila inválida.", "subjects-editor-title");
    }
    const label = normalizeSubjectLabel(rawLabel);
    const fieldId = subjectInputId(level, id || index);
    if (!label) {
      fail(
        `Cada materia debe ser un texto de hasta ${MAX_SUBJECT_LABEL_LENGTH} caracteres.`,
        fieldId,
      );
    }
    const key = duplicateKey(label);
    if (seen.has(key)) {
      fail(`La materia "${label}" está repetida dentro del mismo nivel.`, fieldId);
    }
    seen.add(key);
    return withEntries ? label : { id, label };
  });
};

const assertCanonicalLevels = (levels) => {
  if (!Array.isArray(levels) || levels.length !== SUBJECT_LEVELS.length) {
    fail("Deben existir exactamente los cinco niveles educativos.");
  }
  levels.forEach((entry, index) => {
    if (
      !isPlainRecord(entry) ||
      !hasExactKeys(entry, ["level", "subjects"]) ||
      entry.level !== SUBJECT_LEVELS[index]
    ) {
      fail("Los niveles educativos recibidos son inválidos o están desordenados.");
    }
  });
};

const parseCanonicalData = (data, idFactory) => {
  if (
    !isPlainRecord(data) ||
    !hasExactKeys(data, ["revision", "mode", "levels"]) ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 0 ||
    !["default", "custom"].includes(data.mode)
  ) {
    fail("La configuración de materias recibida es inválida.");
  }

  assertCanonicalLevels(data.levels);
  const levels = data.levels.map(({ level, subjects }) => ({
    level,
    subjects: normalizeSubjectList(subjects, level, { idFactory }),
  }));
  const total = levels.reduce((sum, entry) => sum + entry.subjects.length, 0);
  if (total > MAX_TOTAL_SUBJECTS) {
    fail(`Se admiten hasta ${MAX_TOTAL_SUBJECTS} materias en total.`);
  }
  if (data.mode === "default" && total !== 0) {
    fail("El modo predeterminado no puede incluir materias personalizadas.");
  }
  if (data.mode === "custom" && total === 0) {
    fail(`Debes configurar entre 1 y ${MAX_TOTAL_SUBJECTS} materias en total.`);
  }

  return { revision: data.revision, mode: data.mode, levels };
};

export const parseAdminSubjectsResponse = (
  responseBody,
  idFactory = defaultIdFactory,
) => {
  if (!isPlainRecord(responseBody) || responseBody.success !== true) {
    fail("La configuración de materias recibida es inválida.");
  }
  return parseCanonicalData(responseBody.data, idFactory);
};

export const parsePublicSubjectsByLevel = (value) => {
  if (value == null) return null;
  if (!isPlainRecord(value)) return null;
  const keys = Object.keys(value);
  if (
    keys.length !== SUBJECT_LEVELS.length ||
    SUBJECT_LEVELS.some((level) => !Object.hasOwn(value, level))
  ) return null;

  try {
    const levels = SUBJECT_LEVELS.map((level) => ({
      level,
      subjects: normalizeSubjectList(value[level], level)
        .map(({ label }) => label),
    }));
    const total = levels.reduce((sum, entry) => sum + entry.subjects.length, 0);
    if (total === 0 || total > MAX_TOTAL_SUBJECTS) return null;
    return Object.fromEntries(levels.map(({ level, subjects }) => [level, subjects]));
  } catch {
    return null;
  }
};

const mapLevel = (draft, level, mapper) => ({
  ...draft,
  levels: draft.levels.map((entry) => entry.level === level ? mapper(entry) : entry),
});

export const createSubjectEntry = (
  draft,
  level,
  idFactory = defaultIdFactory,
) => {
  const target = draft.levels.find((entry) => entry.level === level);
  const total = draft.levels.reduce((sum, entry) => sum + entry.subjects.length, 0);
  if (!target || target.subjects.length >= MAX_SUBJECTS_PER_LEVEL || total >= MAX_TOTAL_SUBJECTS) {
    fail("No se pueden agregar más materias.", subjectAddId(level));
  }
  const id = idFactory();
  if (typeof id !== "string" || !id) fail("No se pudo crear la materia.");
  return mapLevel(draft, level, (entry) => ({
    ...entry,
    subjects: [...entry.subjects, { id, label: "" }],
  }));
};

export const updateSubjectEntry = (draft, level, id, label) =>
  mapLevel(draft, level, (entry) => ({
    ...entry,
    subjects: entry.subjects.map((subject) =>
      subject.id === id ? { ...subject, label } : subject),
  }));

export const removeSubjectEntry = (draft, level, id) =>
  mapLevel(draft, level, (entry) => ({
    ...entry,
    subjects: entry.subjects.filter((subject) => subject.id !== id),
  }));

export const moveSubjectEntry = (draft, level, id, direction) =>
  mapLevel(draft, level, (entry) => {
    const index = entry.subjects.findIndex((subject) => subject.id === id);
    const target = index + direction;
    if (index < 0 || ![-1, 1].includes(direction) || target < 0 || target >= entry.subjects.length) {
      return entry;
    }
    const subjects = [...entry.subjects];
    [subjects[index], subjects[target]] = [subjects[target], subjects[index]];
    return { ...entry, subjects };
  });

export const subjectDraftSnapshot = (draft) => {
  if (draft?.mode === "default") return { mode: "default" };
  return {
    mode: draft?.mode,
    levels: Array.isArray(draft?.levels)
      ? draft.levels.map(({ level, subjects }) => ({
          level,
          subjects: Array.isArray(subjects)
            ? subjects.map((subject) => subject?.label)
            : subjects,
        }))
      : draft?.levels,
  };
};

export const serializeSubjectsDraft = (draft) => {
  if (!isPlainRecord(draft) || !["default", "custom"].includes(draft.mode)) {
    fail("La configuración de materias es inválida.");
  }
  if (draft.mode === "default") return { mode: "default" };

  assertCanonicalLevels(draft.levels);
  const levels = draft.levels.map(({ level, subjects }) => ({
    level,
    subjects: normalizeSubjectList(subjects, level, { withEntries: true }),
  }));
  const total = levels.reduce((sum, entry) => sum + entry.subjects.length, 0);
  if (total === 0 || total > MAX_TOTAL_SUBJECTS) {
    fail(`Debes configurar entre 1 y ${MAX_TOTAL_SUBJECTS} materias en total.`);
  }
  return { mode: "custom", levels };
};

const REVISION_CODES = new Set([
  "SUBJECTS_REVISION_REQUIRED",
  "SUBJECTS_REVISION_CONFLICT",
]);

export const classifySubjectsSaveError = (error) => {
  const code = error?.response?.data?.code;
  const message = error?.response?.data?.message ||
    error?.message ||
    "No se pudo guardar la lista de materias.";
  return {
    kind: REVISION_CODES.has(code) ? "revision" : "error",
    code,
    message,
  };
};

export const subjectEntryInputId = subjectInputId;
export const subjectAddButtonId = subjectAddId;
