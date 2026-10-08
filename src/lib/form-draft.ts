export const FORM_DRAFT_VERSION = 1;
export const FORM_DRAFT_PREFIX = "nutaassets:draft";

export type FormDraftPayload<T> = {
  v: number;
  savedAt: string;
  values: T;
};

export function draftStorageKey(userId: string, draftKey: string): string {
  return `${FORM_DRAFT_PREFIX}:${userId}:${draftKey}`;
}

export function parseFormDraft<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FormDraftPayload<T>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.v !== FORM_DRAFT_VERSION ||
      parsed.values === undefined
    ) {
      return null;
    }
    return parsed.values;
  } catch {
    return null;
  }
}

export function serializeFormDraft<T>(values: T, savedAt = new Date()): string {
  const payload: FormDraftPayload<T> = {
    v: FORM_DRAFT_VERSION,
    savedAt: savedAt.toISOString(),
    values,
  };
  return JSON.stringify(payload);
}

export function readFormDraft<T>(storageKey: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    return parseFormDraft<T>(window.localStorage.getItem(storageKey));
  } catch {
    return null;
  }
}

export function writeFormDraft<T>(storageKey: string, values: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, serializeFormDraft(values));
  } catch {
    // Quota or private mode — ignore
  }
}

export function clearFormDraft(storageKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}

/** True when a string/number-like field has user-entered content. */
export function hasText(value: unknown): boolean {
  if (value == null) return false;
  return String(value).trim().length > 0;
}
