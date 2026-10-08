import { describe, expect, it } from "vitest";

import {
  diffObserved,
  hasObservedDiff,
  parseObserved,
} from "@/lib/reconciliation/observed";

const asset = {
  statusId: "s1",
  locationId: "l1",
  assignedToText: "Amina",
  serialNumber: "ABC",
  brand: "HP",
  model: "X360",
  remarks: null,
  categoryId: "c1",
  assetTag: "NRB/BK/EQ/1",
};

describe("parseObserved", () => {
  it("returns empty object for invalid input", () => {
    expect(parseObserved(null)).toEqual({});
    expect(parseObserved("x")).toEqual({});
  });

  it("parses valid observed fields", () => {
    expect(parseObserved({ statusId: "s2", brand: "Dell" })).toEqual({
      statusId: "s2",
      brand: "Dell",
    });
  });
});

describe("diffObserved", () => {
  it("returns empty when nothing changed", () => {
    expect(diffObserved(asset, {})).toEqual({});
    expect(hasObservedDiff(asset, { brand: "HP" })).toBe(false);
  });

  it("detects status and assignee changes", () => {
    const d = diffObserved(asset, {
      statusId: "s2",
      assignedToText: "Risk Office",
    });
    expect(d).toEqual({
      statusId: "s2",
      assignedToText: "Risk Office",
    });
  });

  it("compares serials case-insensitively", () => {
    expect(diffObserved(asset, { serialNumber: "abc" })).toEqual({});
    expect(diffObserved(asset, { serialNumber: "XYZ" })).toEqual({
      serialNumber: "XYZ",
    });
  });

  it("treats empty string as clearing a field", () => {
    expect(diffObserved(asset, { assignedToText: "  " })).toEqual({
      assignedToText: null,
    });
  });
});
