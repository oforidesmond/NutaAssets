import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  buildLegacyBranchSheet,
  buildLegacyExerciseWorkbook,
  sanitizeWorksheetName,
} from "@/lib/export/legacy-sheet";
import type { ExportAssetRow } from "@/lib/export/types";

const sampleRow = (branch: string): ExportAssetRow => ({
  assetTag: "NRB/BK/EQ/0001",
  serialNumber: "SN1",
  brand: "HP",
  model: "Elite",
  assignedToText: "ICT",
  condition: null,
  remarks: null,
  needsReview: false,
  updatedAt: new Date().toISOString(),
  category: { name: "Laptop" },
  branch: { name: branch },
  location: null,
  status: { name: "Active", color: "#16a34a" },
});

const meta = (branchName: string) => ({
  branchName,
  inventoryDate: "08/10/2026",
  preparedBy: "Test Officer",
});

async function worksheetNames(blob: Blob): Promise<string[]> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  // exceljs Buffer typing differs across builds; ArrayBuffer view is accepted at runtime
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return workbook.worksheets.map((ws) => ws.name);
}

describe("buildLegacyBranchSheet", () => {
  it("produces a non-empty xlsx blob", async () => {
    const blob = await buildLegacyBranchSheet(
      [sampleRow("Barekese")],
      meta("Barekese"),
    );
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toContain("spreadsheetml");
  });
});

describe("sanitizeWorksheetName", () => {
  it("strips illegal Excel characters and truncates to 31", () => {
    const used = new Set<string>();
    expect(sanitizeWorksheetName("Foo/Bar?*", used)).toBe("Foo_Bar__");
    expect(
      sanitizeWorksheetName("A".repeat(40), used).length,
    ).toBeLessThanOrEqual(31);
  });

  it("de-duplicates colliding names (case-insensitive)", () => {
    const used = new Set<string>();
    expect(sanitizeWorksheetName("Barekese", used)).toBe("Barekese");
    expect(sanitizeWorksheetName("Barekese", used)).toBe("Barekese_2");
    expect(sanitizeWorksheetName("barekese", used)).toBe("barekese_3");
  });
});

describe("buildLegacyExerciseWorkbook", () => {
  it("produces one worksheet tab per branch", async () => {
    const blob = await buildLegacyExerciseWorkbook([
      { rows: [sampleRow("Barekese")], meta: meta("Barekese") },
      { rows: [sampleRow("Bohyen")], meta: meta("Bohyen") },
    ]);
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toContain("spreadsheetml");

    const names = await worksheetNames(blob);
    expect(names).toEqual(["Barekese", "Bohyen"]);
  });

  it("sanitizes and unique-ifies awkward branch names", async () => {
    const long = "Very Long Branch Name That Exceeds Limit!!";
    const blob = await buildLegacyExerciseWorkbook([
      { rows: [sampleRow("A/B")], meta: meta("A/B") },
      { rows: [sampleRow("A/B")], meta: meta("A/B") },
      { rows: [sampleRow(long)], meta: meta(long) },
    ]);

    const names = await worksheetNames(blob);
    expect(names).toHaveLength(3);
    expect(names[0]).toBe("A_B");
    expect(names[1]).toBe("A_B_2");
    expect(names[2]!.length).toBeLessThanOrEqual(31);
    expect(names[2]).not.toMatch(/[\\/?*[\]]/);
  });
});
