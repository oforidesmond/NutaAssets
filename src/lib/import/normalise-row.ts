import {
  extractModelFromType,
  resolveAlias,
  type AliasMap,
} from "@/lib/import/aliases";
import type {
  ColumnMapping,
  NormalisedImportRow,
} from "@/lib/import/types";
import { isPlaceholder, normaliseEmpty, normaliseText } from "@/lib/normalise";

function cellAt(row: unknown[], index: number): string | null {
  if (index < 0 || index >= row.length) return null;
  const v = row[index];
  if (v == null) return null;
  return String(v);
}

/**
 * Map a single data row using header labels + column mapping.
 */
export function normaliseImportRow(input: {
  sourceRow: number;
  cells: unknown[];
  headers: string[];
  mapping: ColumnMapping;
  categoryAliases: AliasMap;
  statusAliases: AliasMap;
  knownCategories: string[];
  knownStatuses: string[];
}): NormalisedImportRow {
  const { headers, mapping, cells } = input;

  const get = (field: string): string | null => {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]?.trim() || `col_${i}`;
      if (mapping[header] === field) {
        return cellAt(cells, i);
      }
    }
    return null;
  };

  const customFields: Record<string, unknown> = {};
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]?.trim() || `col_${i}`;
    const mapped = mapping[header];
    if (mapped && mapped.startsWith("cf:")) {
      const key = mapped.slice(3);
      const raw = normaliseEmpty(cellAt(cells, i));
      if (raw != null) customFields[key] = raw;
    }
  }

  const rawTag = get("assetTag");
  const rawSerial = get("serialNumber");
  const rawBrand = get("brand");
  const rawModel = get("model");
  const rawAssigned = get("assignedToText");
  const rawRemarks = get("remarks");
  const rawCategory = get("category");
  const rawStatus = get("status");
  const rawBranch = get("branch");
  const rawLocation = get("location");

  const reviewReasons: string[] = [];

  // Detect placeholders before normalising
  for (const [label, raw] of [
    ["tag", rawTag],
    ["serial", rawSerial],
    ["brand", rawBrand],
    ["model", rawModel],
  ] as const) {
    if (raw != null && isPlaceholder(raw)) {
      reviewReasons.push("PLACEHOLDER_VALUE");
      void label;
      break;
    }
  }

  const assetTag = normaliseText(rawTag);
  const serialNumber = normaliseText(rawSerial);
  const brand = normaliseText(rawBrand);
  let model = normaliseText(rawModel);
  const assignedToText = normaliseText(rawAssigned);
  const remarks = normaliseText(rawRemarks);
  const categoryRaw = normaliseText(rawCategory);
  const statusRaw = normaliseText(rawStatus);
  const branchRaw = normaliseText(rawBranch);
  const locationRaw = normaliseText(rawLocation);

  const catResolved = resolveAlias(
    categoryRaw,
    input.categoryAliases,
    input.knownCategories,
  );
  const statusResolved = resolveAlias(
    statusRaw,
    input.statusAliases,
    input.knownStatuses,
  );

  if (!assetTag) reviewReasons.push("MISSING_TAG");
  if (!serialNumber) reviewReasons.push("MISSING_SERIAL");
  if (catResolved.fromAlias && categoryRaw) {
    // tracked but not necessarily a review reason
  }
  if (statusResolved.fromAlias && statusRaw?.toUpperCase() === "INACTIVE") {
    reviewReasons.push("UNKNOWN_STATUS_MAPPED");
  }

  // Capture model from "SERVER R730" style types when model blank
  if (!model) {
    const extracted = extractModelFromType(categoryRaw, catResolved.resolved);
    if (extracted) model = extracted;
  }

  const isBlank =
    !assetTag &&
    !serialNumber &&
    !brand &&
    !model &&
    !assignedToText &&
    !remarks &&
    !categoryRaw &&
    !statusRaw &&
    !branchRaw &&
    !locationRaw &&
    Object.keys(customFields).length === 0;

  return {
    sourceRow: input.sourceRow,
    assetTag,
    serialNumber,
    brand,
    model,
    assignedToText,
    remarks,
    categoryRaw,
    statusRaw,
    branchRaw,
    locationRaw,
    categoryName: catResolved.resolved,
    statusName: statusResolved.resolved,
    branchName: branchRaw, // branch resolution happens with known branches later
    customFields,
    reviewReasons: Array.from(new Set(reviewReasons)),
    isBlank,
  };
}

export function normaliseSheetRows(input: {
  dataRows: unknown[][];
  headerRowIndex: number;
  headers: string[];
  mapping: ColumnMapping;
  categoryAliases: AliasMap;
  statusAliases: AliasMap;
  knownCategories: string[];
  knownStatuses: string[];
}): { rows: NormalisedImportRow[]; blankSkipped: number } {
  const rows: NormalisedImportRow[] = [];
  let blankSkipped = 0;

  input.dataRows.forEach((cells, i) => {
    const sourceRow = input.headerRowIndex + 2 + i; // 1-based Excel row after header
    const row = normaliseImportRow({
      sourceRow,
      cells,
      headers: input.headers,
      mapping: input.mapping,
      categoryAliases: input.categoryAliases,
      statusAliases: input.statusAliases,
      knownCategories: input.knownCategories,
      knownStatuses: input.knownStatuses,
    });
    if (row.isBlank) {
      blankSkipped += 1;
      return;
    }
    rows.push(row);
  });

  return { rows, blankSkipped };
}
