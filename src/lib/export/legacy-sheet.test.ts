import { describe, expect, it } from "vitest";

import { buildLegacyBranchSheet } from "@/lib/export/legacy-sheet";

describe("buildLegacyBranchSheet", () => {
  it("produces a non-empty xlsx blob", async () => {
    const blob = await buildLegacyBranchSheet(
      [
        {
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
          branch: { name: "Barekese" },
          location: null,
          status: { name: "Active", color: "#16a34a" },
        },
      ],
      {
        branchName: "Barekese",
        inventoryDate: "08/10/2026",
        preparedBy: "Test Officer",
      },
    );
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toContain("spreadsheetml");
  });
});
