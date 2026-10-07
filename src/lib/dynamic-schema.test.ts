import { describe, expect, it } from "vitest";

import type { FieldDefLike } from "./dynamic-schema";
import {
  applyCustomFieldDefaults,
  buildCustomFieldsSchema,
  parseCustomFields,
} from "./dynamic-schema";

const defs: FieldDefLike[] = [
  {
    key: "hostname__lt",
    label: "Hostname",
    type: "TEXT",
    options: null,
    required: true,
    categoryId: "cat-lt",
    isActive: true,
    defaultValue: null,
  },
  {
    key: "ram_gb__lt",
    label: "RAM (GB)",
    type: "NUMBER",
    options: null,
    required: false,
    categoryId: "cat-lt",
    isActive: true,
    defaultValue: 8,
  },
  {
    key: "os__lt",
    label: "Operating System",
    type: "SELECT",
    options: [
      { value: "windows", label: "Windows" },
      { value: "linux", label: "Linux" },
    ],
    required: false,
    categoryId: "cat-lt",
    isActive: true,
    defaultValue: null,
  },
  {
    key: "dept_note",
    label: "Note",
    type: "TEXT",
    options: null,
    required: false,
    categoryId: null,
    isActive: true,
    defaultValue: null,
  },
];

describe("buildCustomFieldsSchema", () => {
  it("accepts valid values for scoped fields", () => {
    const schema = buildCustomFieldsSchema(defs, "cat-lt");
    const good = schema.safeParse({ hostname__lt: "PC-01" });
    expect(good.success).toBe(true);
  });

  it("validates select options", () => {
    const schema = buildCustomFieldsSchema(defs, "cat-lt");
    expect(
      schema.safeParse({ hostname__lt: "x", os__lt: "windows" }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ hostname__lt: "x", os__lt: "macos" }).success,
    ).toBe(false);
  });
});

describe("parseCustomFields", () => {
  it("strips empty and unknown keys", () => {
    const result = parseCustomFields(defs, "cat-lt", {
      hostname__lt: "PC-01",
      ram_gb__lt: "16",
      unknown: "nope",
      dept_note: "*",
    });
    expect(result).toEqual({
      hostname__lt: "PC-01",
      ram_gb__lt: 16,
    });
  });

  it("throws on missing required", () => {
    expect(() => parseCustomFields(defs, "cat-lt", {})).toThrow(
      /Hostname is required/i,
    );
  });
});

describe("applyCustomFieldDefaults", () => {
  it("fills defaults for missing keys", () => {
    const result = applyCustomFieldDefaults(defs, "cat-lt", {
      hostname__lt: "PC-01",
    });
    expect(result.ram_gb__lt).toBe(8);
    expect(result.hostname__lt).toBe("PC-01");
  });
});
