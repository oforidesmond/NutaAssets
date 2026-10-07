import { unparse } from "papaparse";

import {
  cfColumnId,
  formatCustomFieldValue,
  parseCfColumnId,
  parseFieldOptions,
  readCustomFieldsJson,
} from "@/lib/custom-fields";
import type { FieldType } from "@prisma/client";

export type ExportFieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options: unknown;
};

export type ExportAssetRow = {
  assetTag: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  assignedToText: string | null;
  condition: string | null;
  remarks: string | null;
  needsReview: boolean;
  updatedAt: string | Date;
  customFields?: unknown;
  category: { name: string };
  branch: { name: string };
  location: { name: string } | null;
  status: { name: string };
};

const CORE_LABELS: Record<string, string> = {
  assetTag: "Asset Tag",
  category: "Category",
  brand: "Brand",
  model: "Model",
  serialNumber: "Serial Number",
  status: "Status",
  branch: "Branch",
  location: "Location",
  assignedToText: "Assigned To",
  condition: "Condition",
  remarks: "Remarks",
  needsReview: "Needs Review",
  updatedAt: "Updated",
};

function coreValue(row: ExportAssetRow, col: string): string {
  switch (col) {
    case "assetTag":
      return row.assetTag ?? "";
    case "category":
      return row.category.name;
    case "brand":
      return row.brand ?? "";
    case "model":
      return row.model ?? "";
    case "serialNumber":
      return row.serialNumber ?? "";
    case "status":
      return row.status.name;
    case "branch":
      return row.branch.name;
    case "location":
      return row.location?.name ?? "";
    case "assignedToText":
      return row.assignedToText ?? "";
    case "condition":
      return row.condition ?? "";
    case "remarks":
      return row.remarks ?? "";
    case "needsReview":
      return row.needsReview ? "Yes" : "No";
    case "updatedAt":
      return new Date(row.updatedAt).toLocaleDateString("en-GB");
    default:
      return "";
  }
}

export function buildAssetsCsv(
  rows: ExportAssetRow[],
  columns: string[],
  fieldDefs: ExportFieldDef[],
): string {
  const defByKey = new Map(fieldDefs.map((f) => [f.key, f]));
  const headers = columns.map((col) => {
    const cfKey = parseCfColumnId(col);
    if (cfKey) return defByKey.get(cfKey)?.label ?? cfKey;
    return CORE_LABELS[col] ?? col;
  });

  const data = rows.map((row) => {
    const cf = readCustomFieldsJson(row.customFields);
    return columns.map((col) => {
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
  });

  return unparse({ fields: headers, data });
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function defaultExportColumns(
  visibleColumns: string[],
  fieldDefs: ExportFieldDef[],
): string[] {
  const cols = [...visibleColumns];
  for (const f of fieldDefs.filter((d) => d)) {
    const id = cfColumnId(f.key);
    // include showInList fields already in visible; otherwise keep as-is
    void id;
  }
  return cols.length > 0 ? cols : ["assetTag", "category", "status", "branch"];
}
