import type { FieldType } from "@prisma/client";

export type ExportFieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options: unknown;
};

export type ExportAssetRow = {
  id?: string;
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
  status: { name: string; color?: string };
};

export const CORE_LABELS: Record<string, string> = {
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

export function coreValue(row: ExportAssetRow, col: string): string {
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

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
