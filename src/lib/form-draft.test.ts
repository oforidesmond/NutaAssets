import { describe, expect, it } from "vitest";

import {
  FORM_DRAFT_VERSION,
  draftStorageKey,
  hasText,
  parseFormDraft,
  serializeFormDraft,
} from "./form-draft";

describe("form-draft helpers", () => {
  it("builds a per-user storage key", () => {
    expect(draftStorageKey("user-1", "asset:create:dept")).toBe(
      "nutaassets:draft:user-1:asset:create:dept",
    );
  });

  it("round-trips serialize and parse", () => {
    const values = { name: "Laptop", branchId: "b1" };
    const raw = serializeFormDraft(values, new Date("2026-01-15T12:00:00.000Z"));
    expect(JSON.parse(raw)).toMatchObject({
      v: FORM_DRAFT_VERSION,
      savedAt: "2026-01-15T12:00:00.000Z",
      values,
    });
    expect(parseFormDraft<typeof values>(raw)).toEqual(values);
  });

  it("ignores unknown draft versions", () => {
    const raw = JSON.stringify({
      v: 99,
      savedAt: "2026-01-15T12:00:00.000Z",
      values: { name: "x" },
    });
    expect(parseFormDraft(raw)).toBeNull();
  });

  it("ignores malformed JSON and missing values", () => {
    expect(parseFormDraft("not-json")).toBeNull();
    expect(parseFormDraft(null)).toBeNull();
    expect(
      parseFormDraft(
        JSON.stringify({ v: FORM_DRAFT_VERSION, savedAt: "x" }),
      ),
    ).toBeNull();
  });

  it("detects non-empty text", () => {
    expect(hasText("  hi ")).toBe(true);
    expect(hasText("")).toBe(false);
    expect(hasText("   ")).toBe(false);
    expect(hasText(null)).toBe(false);
    expect(hasText(undefined)).toBe(false);
    expect(hasText(0)).toBe(true);
  });
});
