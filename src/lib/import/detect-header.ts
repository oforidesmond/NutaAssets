import type { DetectedHeader } from "@/lib/import/types";

/** Known header labels → score weight for detection. */
const HEADER_HINTS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /asset\s*tag|tag\s*\/?\s*label|label/i, weight: 3 },
  { pattern: /asset\s*type|category|type/i, weight: 3 },
  { pattern: /brand|make/i, weight: 2 },
  { pattern: /model/i, weight: 2 },
  { pattern: /serial/i, weight: 3 },
  { pattern: /user\s*assigned|assigned\s*to|assignee|user/i, weight: 2 },
  { pattern: /status/i, weight: 2 },
  { pattern: /location|branch/i, weight: 2 },
  { pattern: /remark|note|comment/i, weight: 1 },
];

function cellText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function scoreRow(cells: string[]): number {
  const nonEmpty = cells.filter(Boolean);
  if (nonEmpty.length < 3) return 0;
  let score = 0;
  for (const cell of nonEmpty) {
    for (const hint of HEADER_HINTS) {
      if (hint.pattern.test(cell)) {
        score += hint.weight;
        break;
      }
    }
  }
  return score;
}

/**
 * Find the most likely header row in a sheet (title/legend rows sit above it).
 * Scans the first 30 rows.
 */
export function detectHeaderRow(rows: unknown[][]): DetectedHeader {
  let bestIndex = 0;
  let bestScore = 0;

  const limit = Math.min(rows.length, 30);
  for (let i = 0; i < limit; i++) {
    const cells = (rows[i] ?? []).map(cellText);
    const score = scoreRow(cells);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  const headers = (rows[bestIndex] ?? []).map(cellText);
  // Trim trailing empty headers
  while (headers.length > 0 && !headers[headers.length - 1]) {
    headers.pop();
  }

  const maxPossible = HEADER_HINTS.reduce((s, h) => s + h.weight, 0);
  const confidence = maxPossible === 0 ? 0 : Math.min(1, bestScore / 12);

  return {
    headerRowIndex: bestIndex,
    headers,
    confidence,
  };
}
