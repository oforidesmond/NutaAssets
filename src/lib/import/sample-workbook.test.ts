import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { autoMapColumns } from "@/lib/import/auto-map";
import { detectHeaderRow } from "@/lib/import/detect-header";
import { normaliseSheetRows } from "@/lib/import/normalise-row";
import { parseExcelBuffer } from "@/lib/import/parse-workbook";
import {
  buildLookupMaps,
  resolveRows,
  validateImportRows,
} from "@/lib/import/validate-rows";
import { configurePlaceholders } from "@/lib/normalise";

/**
 * Real sample path uses a space before "Nwabiagya" (D30).
 */
const SAMPLE_PATH = path.resolve(
  process.cwd(),
  "docs/sample/ICT_Asset_Inventory_Sheet Nwabiagya.xlsx",
);

const CATEGORY_ALIASES: Record<string, string> = {
  "SYSTEM UNIT": "Desktop/System Unit",
  DESKTOP: "Desktop/System Unit",
  LAPTOP: "Laptop",
  MONITOR: "Monitor",
  PRINTER: "Printer",
  UPS: "UPS",
  "CORE ROUTER": "Core Router",
  "CISCO SWITCH": "Switch",
  "TP LINK SWITCH": "Switch",
  "POE - SWITCH": "Switch",
  "POE SWITCH": "Switch",
  "MTN - POE": "Switch",
  "STAR LINK": "Satellite/Starlink",
  STARLINK: "Satellite/Starlink",
  "EXTERNAL BACKUP": "External Backup",
  "SERVER R730": "Server",
  "SERVER R630": "Server",
  "SERVER T320": "Server",
  "SERVER R320": "Server",
  SERVER: "Server",
};

const STATUS_ALIASES: Record<string, string> = {
  ACTIVE: "Active",
  FAULTY: "Faulty",
  "IN REPAIR": "In Repair",
  INACTIVE: "Inactive",
  RETIRED: "Retired",
  DISPOSED: "Disposed",
  LOST: "Lost",
};

const KNOWN_CATEGORIES = [
  "Laptop",
  "Desktop/System Unit",
  "Monitor",
  "Printer",
  "Server",
  "Core Router",
  "Switch",
  "UPS",
  "External Backup",
  "Satellite/Starlink",
  "Other Network Device",
];

const KNOWN_STATUSES = [
  "Active",
  "Faulty",
  "In Repair",
  "Inactive",
  "Retired",
  "Disposed",
  "Lost",
];

const KNOWN_BRANCHES = [
  "Barekese",
  "Bohyen",
  "Sagoe Lane",
  "Abuakwa",
  "Asuofia",
  "Offinso",
  "Anwiam",
  "Magazine",
  "Head Office",
  "Data Center",
  "Tech",
];

describe("sample Nwabiagya workbook import pipeline", () => {
  it("parses, normalises, and flags duplicates on the sample Excel", () => {
    expect(fs.existsSync(SAMPLE_PATH)).toBe(true);

    configurePlaceholders(["*", "N/A", "NA", "-", "none", "null"]);

    const buffer = fs.readFileSync(SAMPLE_PATH);
    const workbook = parseExcelBuffer(buffer, path.basename(SAMPLE_PATH));
    expect(workbook.sheets.length).toBeGreaterThan(0);

    const sheet = workbook.sheets[0]!;
    const detected = detectHeaderRow(sheet.rows);
    expect(detected.headerRowIndex).toBeGreaterThanOrEqual(0);
    expect(detected.headers.join(" ")).toMatch(/asset|tag|type|serial/i);

    const mapping = autoMapColumns(detected.headers);
    expect(mapping["Asset Tag/Label"] ?? mapping["Asset Tag"]).toBeDefined();

    const dataRows = sheet.rows.slice(detected.headerRowIndex + 1);
    const { rows, blankSkipped } = normaliseSheetRows({
      dataRows,
      headerRowIndex: detected.headerRowIndex,
      headers: detected.headers,
      mapping,
      categoryAliases: CATEGORY_ALIASES,
      statusAliases: STATUS_ALIASES,
      knownCategories: KNOWN_CATEGORIES,
      knownStatuses: KNOWN_STATUSES,
    });

    // Brief: ≈188 rows detected, ~9 blank skipped, ~179 non-empty
    const totalDetected = rows.length + blankSkipped;
    expect(totalDetected).toBeGreaterThanOrEqual(170);
    expect(totalDetected).toBeLessThanOrEqual(200);
    expect(blankSkipped).toBeGreaterThanOrEqual(5);
    expect(rows.length).toBeGreaterThanOrEqual(160);

    // Categories/statuses largely mapped via aliases
    const withCategory = rows.filter((r) => r.categoryName).length;
    expect(withCategory / rows.length).toBeGreaterThan(0.85);

    const withStatus = rows.filter((r) => r.statusName).length;
    expect(withStatus / rows.length).toBeGreaterThan(0.85);

    const lookups = buildLookupMaps({
      categories: KNOWN_CATEGORIES.map((name, i) => ({
        id: `c${i}`,
        name,
      })),
      statuses: KNOWN_STATUSES.map((name, i) => ({ id: `s${i}`, name })),
      branches: KNOWN_BRANCHES.map((name, i) => ({ id: `b${i}`, name })),
      locations: [],
      categoryAliases: CATEGORY_ALIASES,
      statusAliases: STATUS_ALIASES,
    });

    const { resolved, unknownCategories } = resolveRows(
      rows,
      lookups,
      null,
      null,
    );

    // Most types should resolve; a few "Other" edge cases OK
    expect(unknownCategories.length).toBeLessThan(15);

    const report = validateImportRows({
      rows: resolved.filter((r) => r.errors.length === 0),
      existing: [],
      duplicatePolicy: "flag",
      blankSkipped,
      unknownCategories: [],
      unknownStatuses: [],
      unknownBranches: [],
    });

    const flaggedDupes = report.rows.filter((r) =>
      r.reviewReasons.some(
        (x) => x === "DUPLICATE_TAG" || x === "DUPLICATE_SERIAL",
      ),
    );
    expect(flaggedDupes.length).toBeGreaterThan(0);
    expect(report.toCreate).toBeGreaterThan(150);
  });
});
