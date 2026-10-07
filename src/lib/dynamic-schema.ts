import type { FieldType } from "@prisma/client";
import { z } from "zod";

import {
  fieldsForCategory,
  parseFieldOptions,
  type FieldOption,
} from "@/lib/custom-fields";
import { normaliseEmpty } from "@/lib/normalise";

export type FieldDefLike = {
  key: string;
  label: string;
  type: FieldType;
  options?: unknown;
  required: boolean;
  categoryId: string | null;
  isActive: boolean;
  defaultValue?: unknown;
};

function emptyToUndefined(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (Array.isArray(value) && value.length === 0) return undefined;
  return value;
}

function zodForType(
  type: FieldType,
  options: FieldOption[],
  required: boolean,
  label: string,
): z.ZodTypeAny {
  const reqMsg = `${label} is required`;

  let base: z.ZodTypeAny;

  switch (type) {
    case "TEXT":
    case "LONG_TEXT":
    case "PHONE":
      base = z.string().trim().max(2000);
      break;
    case "EMAIL":
      base = z.string().trim().email("Enter a valid email").max(320);
      break;
    case "URL":
      base = z.string().trim().url("Enter a valid URL").max(2000);
      break;
    case "NUMBER":
      base = z.coerce.number({ error: "Enter a number" }).finite();
      break;
    case "DECIMAL":
      base = z.coerce.number({ error: "Enter a number" }).finite();
      break;
    case "DATE":
      base = z
        .string()
        .trim()
        .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date");
      break;
    case "BOOLEAN":
      base = z.union([z.boolean(), z.literal("true"), z.literal("false")]).transform(
        (v) => v === true || v === "true",
      );
      break;
    case "SELECT": {
      const values = options.map((o) => o.value);
      if (values.length === 0) {
        base = z.string().trim();
      } else {
        base = z.string().refine((v) => values.includes(v), `Pick a valid ${label}`);
      }
      break;
    }
    case "MULTI_SELECT": {
      const values = options.map((o) => o.value);
      base = z
        .array(z.string())
        .refine(
          (arr) =>
            values.length === 0 || arr.every((v) => values.includes(v)),
          `Pick valid ${label} options`,
        );
      break;
    }
    default:
      base = z.unknown();
  }

  // Always optional at the Zod level; required is enforced in parseCustomFields
  // so missing keys and empty strings share one clear error message.
  void required;
  void reqMsg;
  return z.preprocess(emptyToUndefined, base.optional().nullable());
}

/** Build a Zod object schema for custom field values keyed by FieldDefinition.key. */
export function buildCustomFieldsSchema(
  defs: FieldDefLike[],
  categoryId?: string | null,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const scoped = fieldsForCategory(defs, categoryId ?? null);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const def of scoped) {
    const options = parseFieldOptions(def.options);
    shape[def.key] = zodForType(def.type, options, def.required, def.label);
  }

  return z.object(shape).passthrough();
}

/**
 * Validate and coerce a customFields payload against definitions.
 * Strips unknown keys that are not in the active scoped defs.
 * Returns a clean Record suitable for Prisma Json.
 */
export function parseCustomFields(
  defs: FieldDefLike[],
  categoryId: string | null | undefined,
  raw: unknown,
): Record<string, unknown> {
  const scoped = fieldsForCategory(defs, categoryId ?? null);
  const input =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const schema = buildCustomFieldsSchema(defs, categoryId);
  const result = schema.safeParse(input);

  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? "Invalid custom field value";
    throw new CustomFieldsValidationError(msg, result.error.issues);
  }

  const cleaned: Record<string, unknown> = {};
  const allowed = new Set(scoped.map((d) => d.key));

  for (const [key, value] of Object.entries(result.data)) {
    if (!allowed.has(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "string") {
      const n = normaliseEmpty(value);
      if (n == null) continue;
      cleaned[key] = n;
    } else if (Array.isArray(value) && value.length === 0) {
      continue;
    } else {
      cleaned[key] = value;
    }
  }

  for (const def of scoped) {
    if (!def.required) continue;
    const v = cleaned[def.key];
    if (v === undefined || v === null || v === "") {
      throw new CustomFieldsValidationError(`${def.label} is required`, [
        { message: `${def.label} is required`, path: [def.key] },
      ]);
    }
  }

  return cleaned;
}

export class CustomFieldsValidationError extends Error {
  issues: { message: string; path: PropertyKey[] }[];
  constructor(
    message: string,
    issues: { message: string; path: PropertyKey[] }[],
  ) {
    super(message);
    this.name = "CustomFieldsValidationError";
    this.issues = issues;
  }
}

/** Apply defaultValue from defs for keys missing in the payload (create forms). */
export function applyCustomFieldDefaults(
  defs: FieldDefLike[],
  categoryId: string | null | undefined,
  existing?: Record<string, unknown>,
): Record<string, unknown> {
  const scoped = fieldsForCategory(defs, categoryId ?? null);
  const out: Record<string, unknown> = { ...(existing ?? {}) };

  for (const def of scoped) {
    if (out[def.key] !== undefined) continue;
    if (def.defaultValue === null || def.defaultValue === undefined) continue;
    out[def.key] = def.defaultValue as unknown;
  }

  return out;
}
