import type { ColumnMapping, ImportCoreField } from "@/lib/import/types";

type FieldCandidate = {
  field: ImportCoreField;
  patterns: RegExp[];
};

const CANDIDATES: FieldCandidate[] = [
  {
    field: "assetTag",
    patterns: [
      /^asset\s*tag/i,
      /tag\s*\/?\s*label/i,
      /^tag$/i,
      /^label$/i,
    ],
  },
  {
    field: "category",
    patterns: [/^asset\s*type$/i, /^type$/i, /^category$/i],
  },
  {
    field: "brand",
    patterns: [/^brand$/i, /^make$/i, /^manufacturer$/i],
  },
  {
    field: "model",
    patterns: [/^model$/i],
  },
  {
    field: "serialNumber",
    patterns: [/^serial/i, /^s\/?n$/i],
  },
  {
    field: "assignedToText",
    patterns: [
      /user\s*assigned/i,
      /assigned\s*to/i,
      /^assignee$/i,
      /^user$/i,
    ],
  },
  {
    field: "status",
    patterns: [/^status$/i, /^condition$/i],
  },
  {
    field: "branch",
    patterns: [/^branch$/i, /^location$/i],
  },
  {
    field: "location",
    patterns: [/^sub[-\s]?location$/i, /^room$/i, /^office$/i],
  },
  {
    field: "remarks",
    patterns: [/^remark/i, /^note/i, /^comment/i],
  },
];

function normaliseHeader(header: string): string {
  return header.trim().replace(/\s+/g, " ");
}

/**
 * Auto-map spreadsheet headers to core import fields.
 * "Location" maps to branch (consolidated Excel convention); sub-location only
 * when explicitly labelled as such.
 */
export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<ImportCoreField>();

  headers.forEach((raw, index) => {
    const header = normaliseHeader(raw);
    if (!header) {
      mapping[`col_${index}`] = "skip";
      return;
    }
    const key = header;
    let matched: ImportCoreField | null = null;
    for (const candidate of CANDIDATES) {
      if (used.has(candidate.field)) continue;
      if (candidate.patterns.some((p) => p.test(header))) {
        matched = candidate.field;
        break;
      }
    }
    if (matched) {
      mapping[key] = matched;
      used.add(matched);
    } else {
      mapping[key] = "skip";
    }
  });

  return mapping;
}

/** Map by header index when headers may be duplicated / empty. */
export function autoMapColumnsByIndex(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<ImportCoreField>();

  headers.forEach((raw, index) => {
    const header = normaliseHeader(raw);
    const key = header || `col_${index}`;
    let matched: ImportCoreField | null = null;
    for (const candidate of CANDIDATES) {
      if (used.has(candidate.field)) continue;
      if (header && candidate.patterns.some((p) => p.test(header))) {
        matched = candidate.field;
        break;
      }
    }
    if (matched) {
      mapping[key] = matched;
      used.add(matched);
    } else {
      mapping[key] = "skip";
    }
  });

  return mapping;
}

export const IMPORT_FIELD_OPTIONS: Array<{
  value: ImportCoreField | string;
  label: string;
}> = [
  { value: "skip", label: "— Skip —" },
  { value: "assetTag", label: "Asset Tag" },
  { value: "category", label: "Category / Type" },
  { value: "brand", label: "Brand" },
  { value: "model", label: "Model" },
  { value: "serialNumber", label: "Serial Number" },
  { value: "assignedToText", label: "Assigned To" },
  { value: "status", label: "Status" },
  { value: "branch", label: "Branch" },
  { value: "location", label: "Sub-location" },
  { value: "remarks", label: "Remarks" },
];
