import { describe, expect, it } from "vitest";

import {
  isPlaceholder,
  matchKey,
  normaliseEmpty,
  normaliseText,
} from "./normalise";

describe("normaliseEmpty", () => {
  it("converts placeholders to null", () => {
    expect(normaliseEmpty("*")).toBeNull();
    expect(normaliseEmpty("N/A")).toBeNull();
    expect(normaliseEmpty("na")).toBeNull();
    expect(normaliseEmpty("none")).toBeNull();
    expect(normaliseEmpty("-")).toBeNull();
    expect(normaliseEmpty("---")).toBeNull();
    expect(normaliseEmpty("  ")).toBeNull();
  });

  it("keeps real values", () => {
    expect(normaliseEmpty("  HP  ")).toBe("HP");
    expect(normaliseEmpty("NRB/BK/EQ/1148")).toBe("NRB/BK/EQ/1148");
  });
});

describe("normaliseText", () => {
  it("collapses whitespace", () => {
    expect(normaliseText("  HP   Pavilion  ")).toBe("HP Pavilion");
  });
});

describe("matchKey", () => {
  it("uppercases for matching", () => {
    expect(matchKey("nrb/bk/eq/1148")).toBe("NRB/BK/EQ/1148");
    expect(matchKey("*")).toBeNull();
  });
});

describe("isPlaceholder", () => {
  it("detects placeholders without converting", () => {
    expect(isPlaceholder("N/A")).toBe(true);
    expect(isPlaceholder("DELL")).toBe(false);
  });
});
