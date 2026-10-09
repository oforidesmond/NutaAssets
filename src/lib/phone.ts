/**
 * Normalize a Ghana phone number to `233XXXXXXXXX` (no +).
 * Accepts: 0XXXXXXXXX, 233XXXXXXXXX, +233XXXXXXXXX, and spaced/dashed variants.
 */
export function normalizeGhanaPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  let normalized = digits;
  if (normalized.startsWith("0") && normalized.length === 10) {
    normalized = `233${normalized.slice(1)}`;
  } else if (normalized.startsWith("233") && normalized.length === 12) {
    // already normalized
  } else {
    return null;
  }

  // Ghana mobile: 233 + 9 digits starting with 2–5 typically; keep format check loose
  if (!/^233\d{9}$/.test(normalized)) return null;
  return normalized;
}

export function isValidGhanaPhone(raw: string): boolean {
  return normalizeGhanaPhone(raw) !== null;
}
