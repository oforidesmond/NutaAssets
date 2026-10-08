import { describe, expect, it } from "vitest";

import { detectHeaderRow } from "@/lib/import/detect-header";

describe("detectHeaderRow", () => {
  it("finds the header row beneath title and legend", () => {
    const rows = [
      ["BRANCH ICT ASSET INVENTORY SHEET"],
      ["Branch Name", "Barekese", "Inventory Date", "01/01/2026"],
      ["Status Legend: Active, Faulty, Disposed"],
      [],
      [
        "Asset Tag/Label",
        "Asset Type",
        "Brand",
        "Model",
        "Serial Number",
        "User Assigned",
        "Status",
        "Location",
        "Remarks",
      ],
      ["NRB/BK/EQ/1148", "PRINTER", "CANON", "MF3010", "SN1", "ICT", "ACTIVE", "Barekese", ""],
    ];
    const result = detectHeaderRow(rows);
    expect(result.headerRowIndex).toBe(4);
    expect(result.headers[0]).toMatch(/asset tag/i);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("handles header on first row", () => {
    const rows = [
      ["Tag", "Type", "Brand", "Serial Number", "Status", "Location"],
      ["A1", "LAPTOP", "HP", "X", "ACTIVE", "HO"],
    ];
    const result = detectHeaderRow(rows);
    expect(result.headerRowIndex).toBe(0);
  });
});
