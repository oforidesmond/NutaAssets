import ExcelJS from "exceljs";

import { downloadBlob, type ExportAssetRow } from "@/lib/export/types";

const LEGEND =
  "Active, Faulty, Disposed, In Repair, Lost, Retired, Inactive";

export type LegacySheetMeta = {
  branchName: string;
  inventoryDate: string;
  preparedBy: string;
  orgName?: string;
};

export type LegacyExerciseSheet = {
  rows: ExportAssetRow[];
  meta: LegacySheetMeta;
};

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Excel worksheet names: max 31 chars; no \ / ? * [ ] */
export function sanitizeWorksheetName(
  raw: string,
  used: Set<string>,
): string {
  let base = raw
    .replace(/[\\/?*[\]]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) base = "Branch";
  base = base.slice(0, 31);

  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = `_${n}`;
    candidate = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Fill a worksheet with the original branch inventory sheet layout:
 * title, Branch Name / Inventory Date / Prepared By, status legend, data table.
 */
export function appendLegacyBranchWorksheet(
  workbook: ExcelJS.Workbook,
  rows: ExportAssetRow[],
  meta: LegacySheetMeta,
  sheetName = "Inventory",
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  sheet.mergeCells("A1:I1");
  sheet.getCell("A1").value = "BRANCH ICT ASSET INVENTORY SHEET";
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.getCell("A2").value = "Branch Name";
  sheet.getCell("B2").value = meta.branchName;
  sheet.getCell("D2").value = "Inventory Date";
  sheet.getCell("E2").value = meta.inventoryDate;
  sheet.getCell("G2").value = "Prepared By";
  sheet.getCell("H2").value = meta.preparedBy;

  sheet.getCell("A3").value = "Status Legend";
  sheet.mergeCells("B3:I3");
  sheet.getCell("B3").value = LEGEND;

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
  sheet.addRow([]);
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF94A3B8" } },
    };
  });

  for (const row of rows) {
    sheet.addRow([
      row.assetTag ?? "",
      row.category.name,
      row.brand ?? "",
      row.model ?? "",
      row.serialNumber ?? "",
      row.assignedToText ?? "",
      row.status.name,
      row.location?.name || row.branch.name,
      row.remarks ?? "",
    ]);
  }

  [18, 16, 12, 22, 18, 20, 12, 14, 28].forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  return sheet;
}

/**
 * Export in the original branch inventory sheet layout (single worksheet).
 */
export async function buildLegacyBranchSheet(
  rows: ExportAssetRow[],
  meta: LegacySheetMeta,
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  appendLegacyBranchWorksheet(workbook, rows, meta, "Inventory");
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: XLSX_TYPE });
}

/**
 * One workbook with a worksheet tab per branch (legacy layout each).
 */
export async function buildLegacyExerciseWorkbook(
  sheets: LegacyExerciseSheet[],
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const used = new Set<string>();

  for (const { rows, meta } of sheets) {
    const name = sanitizeWorksheetName(meta.branchName, used);
    appendLegacyBranchWorksheet(workbook, rows, meta, name);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: XLSX_TYPE });
}

export async function downloadLegacyBranchSheet(
  filename: string,
  rows: ExportAssetRow[],
  meta: LegacySheetMeta,
) {
  const blob = await buildLegacyBranchSheet(rows, meta);
  downloadBlob(filename, blob);
}

export async function downloadLegacyExerciseWorkbook(
  filename: string,
  sheets: LegacyExerciseSheet[],
) {
  const blob = await buildLegacyExerciseWorkbook(sheets);
  downloadBlob(filename, blob);
}
