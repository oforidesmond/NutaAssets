import type { HeaderBlockMeta } from "@/lib/import/types";

function cellText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function findLabelValue(
  rows: unknown[][],
  headerRowIndex: number,
  labelPattern: RegExp,
): string | null {
  const limit = Math.min(headerRowIndex, rows.length);
  for (let i = 0; i < limit; i++) {
    const cells = (rows[i] ?? []).map(cellText);
    for (let j = 0; j < cells.length; j++) {
      const cell = cells[j]!;
      if (!labelPattern.test(cell)) continue;
      // Value may be in same cell after colon, or next non-empty cell
      const colon = cell.split(/[:：]/);
      if (colon.length > 1 && colon.slice(1).join(":").trim()) {
        return colon.slice(1).join(":").trim();
      }
      for (let k = j + 1; k < cells.length; k++) {
        if (cells[k]) return cells[k]!;
      }
    }
  }
  return null;
}

/** Extract Branch Name / Inventory Date / Prepared By from rows above the header. */
export function extractHeaderBlock(
  rows: unknown[][],
  headerRowIndex: number,
): HeaderBlockMeta {
  return {
    branchName: findLabelValue(
      rows,
      headerRowIndex,
      /branch\s*name|^branch$/i,
    ),
    inventoryDate: findLabelValue(
      rows,
      headerRowIndex,
      /inventory\s*date|date/i,
    ),
    preparedBy: findLabelValue(
      rows,
      headerRowIndex,
      /prepared\s*by|prepared/i,
    ),
  };
}
