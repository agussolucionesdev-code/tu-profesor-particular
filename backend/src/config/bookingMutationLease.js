const parsePositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// A bounded lease prevents crashed requests from blocking a booking forever.
export const SLOT_MUTATION_LOCK_MS = Math.max(
  10_000,
  parsePositiveInteger(process.env.SLOT_MUTATION_LOCK_MS, 30_000),
);

export const SLOT_MUTATION_LEASE_SAFETY_MARGIN_MS = Math.min(
  5_000,
  Math.floor(SLOT_MUTATION_LOCK_MS / 3),
);
