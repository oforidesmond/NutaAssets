import { describe, expect, it } from "vitest";

import { isValidGhanaPhone, normalizeGhanaPhone } from "./phone";

describe("normalizeGhanaPhone", () => {
  it("normalizes local 0-prefixed numbers", () => {
    expect(normalizeGhanaPhone("0244123456")).toBe("233244123456");
  });

  it("accepts already-normalized 233 numbers", () => {
    expect(normalizeGhanaPhone("233244123456")).toBe("233244123456");
  });

  it("strips + and punctuation", () => {
    expect(normalizeGhanaPhone("+233 24-412-3456")).toBe("233244123456");
  });

  it("rejects invalid lengths", () => {
    expect(normalizeGhanaPhone("0244")).toBeNull();
    expect(normalizeGhanaPhone("1234567890")).toBeNull();
  });

  it("isValidGhanaPhone mirrors normalize", () => {
    expect(isValidGhanaPhone("0541234567")).toBe(true);
    expect(isValidGhanaPhone("not-a-phone")).toBe(false);
  });
});
