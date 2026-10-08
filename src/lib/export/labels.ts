import { jsPDF } from "jspdf";
import QRCode from "qrcode";

import { downloadBlob, type ExportAssetRow } from "@/lib/export/types";

export type LabelSheetOptions = {
  /** Absolute or site-relative base for QR URLs, e.g. https://app.example.com */
  baseUrl: string;
  cols?: number;
  rows?: number;
};

/**
 * A4 label sheet — default 2×5 grid with QR encoding `/a/{assetId}`.
 */
export async function buildLabelSheet(
  rows: ExportAssetRow[],
  options: LabelSheetOptions,
): Promise<Blob> {
  const cols = options.cols ?? 2;
  const rowsPerPage = options.rows ?? 5;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 10;
  const marginY = 10;
  const gapX = 4;
  const gapY = 4;
  const cellW = (pageW - marginX * 2 - gapX * (cols - 1)) / cols;
  const cellH = (pageH - marginY * 2 - gapY * (rowsPerPage - 1)) / rowsPerPage;

  const withId = rows.filter((r) => r.id);
  let index = 0;

  for (const row of withId) {
    if (index > 0 && index % (cols * rowsPerPage) === 0) {
      doc.addPage();
    }
    const pageIndex = index % (cols * rowsPerPage);
    const col = pageIndex % cols;
    const rowIdx = Math.floor(pageIndex / cols);
    const x = marginX + col * (cellW + gapX);
    const y = marginY + rowIdx * (cellH + gapY);

    doc.setDrawColor(180);
    doc.rect(x, y, cellW, cellH);

    const qrUrl = `${options.baseUrl.replace(/\/$/, "")}/a/${row.id}`;
    const dataUrl = await QRCode.toDataURL(qrUrl, {
      margin: 1,
      width: 128,
      errorCorrectionLevel: "M",
    });
    const qrSize = Math.min(cellH - 8, 28);
    doc.addImage(dataUrl, "PNG", x + 3, y + 3, qrSize, qrSize);

    const textX = x + qrSize + 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(row.assetTag || "(no tag)", textX, y + 8, {
      maxWidth: cellW - qrSize - 10,
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(row.category.name, textX, y + 14, {
      maxWidth: cellW - qrSize - 10,
    });
    doc.text(row.branch.name, textX, y + 20, {
      maxWidth: cellW - qrSize - 10,
    });
    if (row.serialNumber) {
      doc.setFontSize(7);
      doc.text(`S/N ${row.serialNumber}`, textX, y + 26, {
        maxWidth: cellW - qrSize - 10,
      });
    }

    index += 1;
  }

  return doc.output("blob");
}

export async function downloadLabelSheet(
  filename: string,
  rows: ExportAssetRow[],
  options: LabelSheetOptions,
) {
  const blob = await buildLabelSheet(rows, options);
  downloadBlob(filename, blob);
}
