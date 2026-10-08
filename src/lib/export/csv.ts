import { unparse } from "papaparse";

import {
  cfColumnId,
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
  downloadBlob(
    filename,
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
}

export function defaultExportColumns(
  visibleColumns: string[],
  _fieldDefs: ExportFieldDef[],
): string[] {
  void _fieldDefs;
  void cfColumnId;
  return visibleColumns.length > 0
    ? visibleColumns
    : ["assetTag", "category", "status", "branch"];
}
