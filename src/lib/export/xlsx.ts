import ExcelJS from "exceljs";

import {
  formatCustomFieldValue,
  parseCfColumnId,
  parseFieldOptions,
  readCustomFieldsJson,
} from "@/lib/custom-fields";
import {
  CORE_LABELS,
  coreValue,
  downloadBlob,
  type ExportAssetRow,
  type ExportFieldDef,
} from "@/lib/export/types";

function hexToArgb(hex: string | undefined): string {
  if (!hex) return "FF9CA3AF";
  const h = hex.replace("#", "");
  if (h.length === 6) return `FF${h.toUpperCase()}`;
  return "FF9CA3AF";
}

export async function buildAssetsXlsx(
  rows: ExportAssetRow[],
  columns: string[],
  fieldDefs: ExportFieldDef[],
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AssetTrack";
  const sheet = workbook.addWorksheet("Assets", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const defByKey = new Map(fieldDefs.map((f) => [f.key, f]));
  const headers = columns.map((col) => {
    const cfKey = parseCfColumnId(col);
    if (cfKey) return defByKey.get(cfKey)?.label ?? cfKey;
    return CORE_LABELS[col] ?? col;
  });

  sheet.addRow(headers);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A5F" },
  };
  headerRow.alignment = { vertical: "middle" };

  const statusColIndex = columns.indexOf("status");

  for (const row of rows) {
    const cf = readCustomFieldsJson(row.customFields);
    const values = columns.map((col) => {
      const cfKey = parseCfColumnId(col);
      if (cfKey) {
        const def = defByKey.get(cfKey);
        if (!def) return String(cf[cfKey] ?? "");
        return formatCustomFieldValue(
          def.type,
          cf[cfKey],
          parseFieldOptions(def.options),
        );
      }
      return coreValue(row, col);
    });
    const excelRow = sheet.addRow(values);
    if (statusColIndex >= 0) {
      const cell = excelRow.getCell(statusColIndex + 1);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: hexToArgb(row.status.color) },
      };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    }
  }

  columns.forEach((_, i) => {
    const col = sheet.getColumn(i + 1);
    col.width = Math.min(
      40,
      Math.max(12, String(headers[i] ?? "").length + 4),
    );
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function downloadAssetsXlsx(
  filename: string,
  rows: ExportAssetRow[],
  columns: string[],
  fieldDefs: ExportFieldDef[],
) {
  const blob = await buildAssetsXlsx(rows, columns, fieldDefs);
  downloadBlob(filename, blob);
}
