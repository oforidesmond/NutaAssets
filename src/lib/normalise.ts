const PLACEHOLDER_VALUES = new Set([
  "*",
  "n/a",
  "na",
  "none",
  "-",
  "--",
  "---",
  ".",
  "null",
  "undefined",
]);

/** Trim and convert known placeholders to null. */
export function normaliseEmpty(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

/** Collapse internal whitespace after empty-normalisation. */
export function normaliseText(value: string | null | undefined): string | null {
  const empty = normaliseEmpty(value);
  if (!empty) return null;
  return empty.replace(/\s+/g, " ");
}

/** Uppercase match key for tags/serials (store display separately if needed). */
export function matchKey(value: string | null | undefined): string | null {
  const text = normaliseText(value);
  if (!text) return null;
  return text.toUpperCase();
}

export function isPlaceholder(value: string | null | undefined): boolean {
  if (value == null) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return PLACEHOLDER_VALUES.has(trimmed.toLowerCase());
}

export const PLACEHOLDERS = PLACEHOLDER_VALUES;
