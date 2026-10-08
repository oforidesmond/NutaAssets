import { describe, expect, it } from "vitest";

import { normaliseImportRow, normaliseSheetRows } from "@/lib/import/normalise-row";
import { configurePlaceholders } from "@/lib/normalise";

const headers = [
  "Asset Tag/Label",
  "Asset Type",
  "Brand",
  "Model",
  "Serial Number",
  "User Assigned",
  "Status",
  "Location",
  "Remarks",
];

const mapping = {
  "Asset Tag/Label": "assetTag" as const,
  "Asset Type": "category" as const,
  Brand: "brand" as const,
  Model: "model" as const,
  "Serial Number": "serialNumber" as const,
  "User Assigned": "assignedToText" as const,
  Status: "status" as const,
  Location: "branch" as const,
  Remarks: "remarks" as const,
};

const categoryAliases = {
  "SYSTEM UNIT": "Desktop/System Unit",
  "SERVER R730": "Server",
};

const statusAliases = { INACTIVE: "Inactive", ACTIVE: "Active" };

describe("normaliseImportRow", () => {
  it("converts placeholders to null and flags them", () => {
    configurePlaceholders(["*", "N/A", "NA", "-", "none"]);
    const row = normaliseImportRow({
      sourceRow: 6,
      cells: ["N/A", "LAPTOP", "*", "Pavilion", "*", "ICT", "ACTIVE", "Barekese", ""],
      headers,
      mapping,
      categoryAliases,
      statusAliases,
      knownCategories: ["Laptop", "Desktop/System Unit", "Server"],
      knownStatuses: ["Active", "Inactive"],
    });
    expect(row.assetTag).toBeNull();
    expect(row.brand).toBeNull();
    expect(row.serialNumber).toBeNull();
    expect(row.reviewReasons).toContain("PLACEHOLDER_VALUE");
    expect(row.reviewReasons).toContain("MISSING_TAG");
    expect(row.reviewReasons).toContain("MISSING_SERIAL");
    expect(row.categoryName).toBe("Laptop");
    expect(row.statusName).toBe("Active");
  });

  it("extracts model from SERVER R730 type", () => {
    const row = normaliseImportRow({
      sourceRow: 7,
      cells: ["T1", "SERVER R730", "DELL", "", "SN9", "ICT", "ACTIVE", "DC", ""],
      headers,
      mapping,
      categoryAliases,
      statusAliases,
      knownCategories: ["Laptop", "Server"],
      knownStatuses: ["Active"],
    });
    expect(row.categoryName).toBe("Server");
    expect(row.model).toBe("R730");
  });

  it("skips blank rows in sheet normalisation", () => {
    const { rows, blankSkipped } = normaliseSheetRows({
      dataRows: [
        ["T1", "LAPTOP", "HP", "X", "S1", "A", "ACTIVE", "BK", ""],
        ["", "", "", "", "", "", "", "", ""],
        ["*", "*", "*", "*", "*", "*", "*", "*", "*"],
      ],
      headerRowIndex: 4,
      headers,
      mapping,
      categoryAliases,
      statusAliases,
      knownCategories: ["Laptop"],
      knownStatuses: ["Active"],
    });
    // third row has only placeholders → all null → blank
    expect(blankSkipped).toBe(2);
    expect(rows).toHaveLength(1);
  });
});
