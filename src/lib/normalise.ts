const DEFAULT_PLACEHOLDERS = new Set([
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

let configuredPlaceholders: Set<string> | null = null;

/** Configure placeholder tokens from Settings (lowercase). */
export function configurePlaceholders(values: string[]) {
  configuredPlaceholders = new Set(
    values.map((v) => v.trim().toLowerCase()).filter(Boolean),
  );
}

function activePlaceholders() {
  return configuredPlaceholders ?? DEFAULT_PLACEHOLDERS;
}

/** Trim and convert known placeholders to null. */
export function normaliseEmpty(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (activePlaceholders().has(trimmed.toLowerCase())) return null;
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
  return activePlaceholders().has(trimmed.toLowerCase());
}

export const PLACEHOLDERS = DEFAULT_PLACEHOLDERS;
