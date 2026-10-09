import type { FieldDefinition, FieldType } from "@prisma/client";

/** Prefix for custom-field column ids in the assets table / saved views. */
export const CF_COLUMN_PREFIX = "cf:" as const;

export function cfColumnId(key: string): string {
  return `${CF_COLUMN_PREFIX}${key}`;
}

export function parseCfColumnId(columnId: string): string | null {
  if (!columnId.startsWith(CF_COLUMN_PREFIX)) return null;
  return columnId.slice(CF_COLUMN_PREFIX.length) || null;
}

export function isCfColumnId(columnId: string): boolean {
  return columnId.startsWith(CF_COLUMN_PREFIX);
}

/**
 * Slugify a label into an immutable machine key.
 * Optionally append a category code suffix (e.g. hostname__lt).
 */
export function slugifyFieldKey(label: string, categoryCode?: string | null): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 48);

  if (!base) return "field";

  if (categoryCode) {
    const code = categoryCode
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 8);
    if (code) return `${base}__${code}`;
  }

  return base;
}

/**
 * Strip the category-code suffix from a field key (`hostname__lt` → `hostname`).
 * Dept-wide keys without a suffix are returned unchanged.
 */
export function fieldKeyBase(key: string): string {
  const i = key.lastIndexOf("__");
  return i === -1 ? key : key.slice(0, i);
}

/**
 * Category-scoped copies of the same field share a label (D6). For list filters /
 * column pickers, keep the first occurrence of each label so "Operating System"
 * does not appear once per category.
 */
export function dedupeFieldsByLabel<T extends { label: string }>(defs: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const def of defs) {
    const label = def.label.trim().toLowerCase();
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(def);
  }
  return out;
}

/** All FieldDefinition keys that share the same base as `key` (incl. itself). */
export function relatedFieldKeys(
  defs: { key: string }[],
  key: string,
): string[] {
  const base = fieldKeyBase(key);
  const keys = defs
    .filter((d) => fieldKeyBase(d.key) === base)
    .map((d) => d.key);
  return keys.length > 0 ? keys : [key];
}

/** Fields that apply to a given category (dept-wide or category-scoped). */
export function fieldsForCategory<
  T extends Pick<FieldDefinition, "categoryId" | "isActive">,
>(defs: T[], categoryId: string | null | undefined, opts?: { includeInactive?: boolean }): T[] {
  return defs.filter((d) => {
    if (!opts?.includeInactive && !d.isActive) return false;
    if (d.categoryId == null) return true;
    if (!categoryId) return false;
    return d.categoryId === categoryId;
  });
}

/** Safe type widenings once data exists; anything else is blocked. */
const SAFE_TYPE_CHANGES: Partial<Record<FieldType, FieldType[]>> = {
  NUMBER: ["DECIMAL", "TEXT", "LONG_TEXT"],
  DECIMAL: ["TEXT", "LONG_TEXT"],
  EMAIL: ["TEXT", "LONG_TEXT", "URL"],
  URL: ["TEXT", "LONG_TEXT"],
  PHONE: ["TEXT", "LONG_TEXT"],
  DATE: ["TEXT", "LONG_TEXT"],
  BOOLEAN: ["TEXT", "LONG_TEXT"],
  SELECT: ["TEXT", "LONG_TEXT", "MULTI_SELECT"],
  MULTI_SELECT: ["TEXT", "LONG_TEXT"],
  TEXT: ["LONG_TEXT"],
};

export function isSafeTypeChange(from: FieldType, to: FieldType): boolean {
  if (from === to) return true;
  return SAFE_TYPE_CHANGES[from]?.includes(to) ?? false;
}

export type FieldOption = { value: string; label: string };

export function parseFieldOptions(options: unknown): FieldOption[] {
  if (!Array.isArray(options)) return [];
  return options
    .map((o) => {
      if (o && typeof o === "object" && "value" in o && "label" in o) {
        const value = String((o as FieldOption).value);
        const label = String((o as FieldOption).label);
        return { value, label };
      }
      if (typeof o === "string") return { value: o, label: o };
      return null;
    })
    .filter((o): o is FieldOption => o != null && o.value.length > 0);
}

/** Format a custom-field value for table cells / CSV export. */
export function formatCustomFieldValue(
  type: FieldType,
  value: unknown,
  options?: FieldOption[],
): string {
  if (value == null || value === "") return "";

  switch (type) {
    case "BOOLEAN":
      return value === true || value === "true" || value === 1 ? "Yes" : "No";
    case "DATE": {
      const d = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleDateString("en-GB");
    }
    case "SELECT": {
      const v = String(value);
      const opt = options?.find((o) => o.value === v);
      return opt?.label ?? v;
    }
    case "MULTI_SELECT": {
      const arr = Array.isArray(value) ? value.map(String) : [String(value)];
      return arr
        .map((v) => options?.find((o) => o.value === v)?.label ?? v)
        .join(", ");
    }
    case "DECIMAL":
    case "NUMBER":
      return String(value);
    default:
      return String(value);
  }
}

export function readCustomFieldsJson(
  raw: unknown,
): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: "Text",
  LONG_TEXT: "Long text",
  NUMBER: "Number",
  DECIMAL: "Decimal",
  DATE: "Date",
  BOOLEAN: "Yes / No",
  SELECT: "Select",
  MULTI_SELECT: "Multi-select",
  EMAIL: "Email",
  URL: "URL",
  PHONE: "Phone",
};

export const ALL_FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldType[];
