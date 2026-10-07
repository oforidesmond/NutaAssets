import { describe, expect, it } from "vitest";

import { buildDuplicateResult, mergeReviewReasons } from "./duplicates";

describe("buildDuplicateResult", () => {
  it("flags matching tags and serials case-insensitively", () => {
    const result = buildDuplicateResult({
      assetTag: "nrb/bk/eq/1148",
      serialNumber: "fm00555",
      tagHits: [
        {
          id: "1",
          assetTag: "NRB/BK/EQ/1148",
          serialNumber: "OTHER",
          brand: null,
          model: null,
        },
      ],
      serialHits: [
        {
          id: "2",
          assetTag: "OTHER",
          serialNumber: "FM00555",
          brand: null,
          model: null,
        },
      ],
    });

    expect(result.hasDuplicates).toBe(true);
    expect(result.reasons).toEqual(["DUPLICATE_TAG", "DUPLICATE_SERIAL"]);
    expect(result.tagHits).toHaveLength(1);
    expect(result.serialHits).toHaveLength(1);
  });

  it("ignores blank / placeholder values", () => {
    const result = buildDuplicateResult({
      assetTag: "N/A",
      serialNumber: "*",
      tagHits: [
        {
          id: "1",
          assetTag: "N/A",
          serialNumber: null,
          brand: null,
          model: null,
        },
      ],
      serialHits: [],
    });

    expect(result.hasDuplicates).toBe(false);
  });
});

describe("mergeReviewReasons", () => {
  it("dedupes reasons", () => {
    expect(
      mergeReviewReasons(["DUPLICATE_TAG"], ["DUPLICATE_TAG", "MISSING_SERIAL"]),
    ).toEqual(["DUPLICATE_TAG", "MISSING_SERIAL"]);
  });
});
