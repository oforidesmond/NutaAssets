import { describe, expect, it } from "vitest";

import {
  buildLookupMaps,
  resolveRows,
  validateImportRows,
} from "@/lib/import/validate-rows";
import type { NormalisedImportRow } from "@/lib/import/types";

function baseRow(
  overrides: Partial<NormalisedImportRow> & { sourceRow: number },
): NormalisedImportRow {
  return {
    assetTag: null,
    serialNumber: null,
    brand: null,
    model: null,
    assignedToText: null,
    remarks: null,
    categoryRaw: "Laptop",
    statusRaw: "Active",
    branchRaw: "Barekese",
    locationRaw: null,
    categoryName: "Laptop",
    statusName: "Active",
    branchName: "Barekese",
    customFields: {},
    reviewReasons: [],
    isBlank: false,
    ...overrides,
  };
}

describe("validateImportRows", () => {
  const lookups = buildLookupMaps({
    categories: [{ id: "c1", name: "Laptop" }],
    statuses: [{ id: "s1", name: "Active" }],
    branches: [{ id: "b1", name: "Barekese" }],
    locations: [],
    categoryAliases: {},
    statusAliases: {},
  });

  it("flags DB duplicate serial and creates under flag policy", () => {
    const { resolved } = resolveRows(
      [
        baseRow({
          sourceRow: 6,
          assetTag: "T1",
          serialNumber: "SN-DUP",
        }),
      ],
      lookups,
      null,
      null,
    );
    const report = validateImportRows({
      rows: resolved,
      existing: [{ id: "a1", assetTag: "OTHER", serialNumber: "SN-DUP" }],
      duplicatePolicy: "flag",
      blankSkipped: 0,
      unknownCategories: [],
      unknownStatuses: [],
      unknownBranches: [],
    });
    expect(report.toCreate).toBe(1);
    expect(report.rows[0]!.reviewReasons).toContain("DUPLICATE_SERIAL");
    expect(report.flagged).toBeGreaterThan(0);
  });

  it("skips when policy is skip", () => {
    const { resolved } = resolveRows(
      [baseRow({ sourceRow: 6, assetTag: "T1", serialNumber: "SN1" })],
      lookups,
      null,
      null,
    );
    const report = validateImportRows({
      rows: resolved,
      existing: [{ id: "a1", assetTag: "T1", serialNumber: "SN1" }],
      duplicatePolicy: "skip",
      blankSkipped: 2,
      unknownCategories: [],
      unknownStatuses: [],
      unknownBranches: [],
    });
    expect(report.toSkip).toBe(1);
    expect(report.blankSkipped).toBe(2);
    expect(report.totalDetected).toBe(3);
  });

  it("updates when policy is update", () => {
    const { resolved } = resolveRows(
      [baseRow({ sourceRow: 6, assetTag: "T1", serialNumber: "SN1" })],
      lookups,
      null,
      null,
    );
    const report = validateImportRows({
      rows: resolved,
      existing: [{ id: "a1", assetTag: "T1", serialNumber: null }],
      duplicatePolicy: "update",
      blankSkipped: 0,
      unknownCategories: [],
      unknownStatuses: [],
      unknownBranches: [],
    });
    expect(report.toUpdate).toBe(1);
    expect(report.rows[0]!.matchAssetId).toBe("a1");
  });

  it("detects in-file duplicate tags", () => {
    const { resolved } = resolveRows(
      [
        baseRow({ sourceRow: 6, assetTag: "SAME", serialNumber: "A" }),
        baseRow({ sourceRow: 7, assetTag: "SAME", serialNumber: "B" }),
      ],
      lookups,
      null,
      null,
    );
    const report = validateImportRows({
      rows: resolved,
      existing: [],
      duplicatePolicy: "flag",
      blankSkipped: 0,
      unknownCategories: [],
      unknownStatuses: [],
      unknownBranches: [],
    });
    expect(report.rows[1]!.inFileDuplicate).toBe(true);
    expect(report.rows[1]!.reviewReasons).toContain("DUPLICATE_TAG");
  });
});
