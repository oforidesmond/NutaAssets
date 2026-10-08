import { jsPDF } from "jspdf";

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

export function buildAssetsPdf(
  rows: ExportAssetRow[],
  columns: string[],
  fieldDefs: ExportFieldDef[],
  title = "Asset register",
): Blob {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const defByKey = new Map(fieldDefs.map((f) => [f.key, f]));
  const headers = columns.map((col) => {
    const cfKey = parseCfColumnId(col);
    if (cfKey) return defByKey.get(cfKey)?.label ?? cfKey;
    return CORE_LABELS[col] ?? col;
  });

  const margin = 36;
  let y = margin;
  doc.setFontSize(14);
  doc.text(title, margin, y);
  y += 18;
  doc.setFontSize(8);
  doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, margin, y);
  y += 16;

  const usableWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const colWidth = Math.max(40, usableWidth / Math.max(headers.length, 1));

  const drawHeader = () => {
    doc.setFont("helvetica", "bold");
    headers.forEach((h, i) => {
      doc.text(h.slice(0, 18), margin + i * colWidth, y, {
        maxWidth: colWidth - 4,
      });
    });
    y += 12;
    doc.setFont("helvetica", "normal");
  };

  drawHeader();

  for (const row of rows) {
    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
    const cf = readCustomFieldsJson(row.customFields);
    columns.forEach((col, i) => {
      const cfKey = parseCfColumnId(col);
      let value = "";
      if (cfKey) {
        const def = defByKey.get(cfKey);
        value = def
          ? formatCustomFieldValue(
              def.type,
              cf[cfKey],
              parseFieldOptions(def.options),
            )
          : String(cf[cfKey] ?? "");
      } else {
        value = coreValue(row, col);
      }
      doc.text(String(value).slice(0, 28), margin + i * colWidth, y, {
        maxWidth: colWidth - 4,
      });
    });
    y += 11;
  }

  return doc.output("blob");
}

export function downloadAssetsPdf(
  filename: string,
  rows: ExportAssetRow[],
  columns: string[],
  fieldDefs: ExportFieldDef[],
) {
  const blob = buildAssetsPdf(rows, columns, fieldDefs);
  downloadBlob(filename, blob);
}
