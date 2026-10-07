import { describe, expect, it } from "vitest";

import {
  cfColumnId,
  fieldsForCategory,
  formatCustomFieldValue,
  isSafeTypeChange,
  parseCfColumnId,
  slugifyFieldKey,
} from "./custom-fields";

describe("slugifyFieldKey", () => {
  it("slugifies labels", () => {
    expect(slugifyFieldKey("Operating System")).toBe("operating_system");
    expect(slugifyFieldKey("  RAM (GB)  ")).toBe("ram_gb");
  });

  it("appends category code", () => {
    expect(slugifyFieldKey("Hostname", "LT")).toBe("hostname__lt");
  });

  it("falls back for empty label", () => {
    expect(slugifyFieldKey("!!!")).toBe("field");
  });
});

describe("cf column ids", () => {
  it("round-trips", () => {
    expect(cfColumnId("hostname__lt")).toBe("cf:hostname__lt");
    expect(parseCfColumnId("cf:hostname__lt")).toBe("hostname__lt");
    expect(parseCfColumnId("assetTag")).toBeNull();
  });
});

describe("fieldsForCategory", () => {
  const defs = [
    { key: "a", categoryId: null, isActive: true },
    { key: "b", categoryId: "cat1", isActive: true },
    { key: "c", categoryId: "cat2", isActive: true },
    { key: "d", categoryId: null, isActive: false },
  ];

  it("includes dept-wide and matching category", () => {
    const result = fieldsForCategory(defs, "cat1");
    expect(result.map((d) => d.key)).toEqual(["a", "b"]);
  });

  it("can include inactive", () => {
    const result = fieldsForCategory(defs, "cat1", { includeInactive: true });
    expect(result.map((d) => d.key)).toEqual(["a", "b", "d"]);
  });
});

describe("isSafeTypeChange", () => {
  it("allows same type and widenings", () => {
    expect(isSafeTypeChange("NUMBER", "NUMBER")).toBe(true);
    expect(isSafeTypeChange("NUMBER", "TEXT")).toBe(true);
    expect(isSafeTypeChange("TEXT", "LONG_TEXT")).toBe(true);
  });

  it("blocks unsafe changes", () => {
    expect(isSafeTypeChange("TEXT", "NUMBER")).toBe(false);
    expect(isSafeTypeChange("SELECT", "DATE")).toBe(false);
  });
});

describe("formatCustomFieldValue", () => {
  it("formats booleans and multi-select", () => {
    expect(formatCustomFieldValue("BOOLEAN", true)).toBe("Yes");
    expect(
      formatCustomFieldValue("MULTI_SELECT", ["laser", "ink"], [
        { value: "laser", label: "Laser" },
        { value: "ink", label: "Inkjet" },
      ]),
    ).toBe("Laser, Inkjet");
  });
});
