import { observedSchema, type ObservedFields } from "@/schemas/reconciliation";

export type AssetSnapshot = {
  statusId: string;
  locationId: string | null;
  assignedToText: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  remarks: string | null;
  categoryId: string;
  assetTag: string | null;
};

export function parseObserved(raw: unknown): ObservedFields {
  const parsed = observedSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

function norm(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/** Fields in observed that differ from the live asset (for FOUND_DIFFERENT). */
export function diffObserved(
  asset: AssetSnapshot,
  observed: ObservedFields,
): Partial<AssetSnapshot> {
  const out: Partial<AssetSnapshot> = {};

  if (observed.statusId != null && observed.statusId !== asset.statusId) {
    out.statusId = observed.statusId;
  }
  if (
    observed.locationId !== undefined &&
    (observed.locationId || null) !== asset.locationId
  ) {
    out.locationId = observed.locationId || null;
  }
  if (
    observed.assignedToText !== undefined &&
    norm(observed.assignedToText) !== norm(asset.assignedToText)
  ) {
    out.assignedToText = norm(observed.assignedToText);
  }
  if (
    observed.serialNumber !== undefined &&
    norm(observed.serialNumber)?.toUpperCase() !==
      norm(asset.serialNumber)?.toUpperCase()
  ) {
    out.serialNumber = norm(observed.serialNumber);
  }
  if (
    observed.brand !== undefined &&
    norm(observed.brand)?.toUpperCase() !== norm(asset.brand)?.toUpperCase()
  ) {
    out.brand = norm(observed.brand);
  }
  if (
    observed.model !== undefined &&
    norm(observed.model)?.toUpperCase() !== norm(asset.model)?.toUpperCase()
  ) {
    out.model = norm(observed.model);
  }
  if (
    observed.remarks !== undefined &&
    norm(observed.remarks) !== norm(asset.remarks)
  ) {
    out.remarks = norm(observed.remarks);
  }
  if (
    observed.categoryId != null &&
    observed.categoryId !== asset.categoryId
  ) {
    out.categoryId = observed.categoryId;
  }
  if (
    observed.assetTag !== undefined &&
    norm(observed.assetTag)?.toUpperCase() !==
      norm(asset.assetTag)?.toUpperCase()
  ) {
    out.assetTag = norm(observed.assetTag);
  }

  return out;
}

export function hasObservedDiff(
  asset: AssetSnapshot,
  observed: ObservedFields,
): boolean {
  return Object.keys(diffObserved(asset, observed)).length > 0;
}

export type DiffField = {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
};

const FIELD_LABELS: Record<string, string> = {
  statusId: "Status",
  locationId: "Location",
  assignedToText: "Assigned To",
  serialNumber: "Serial Number",
  brand: "Brand",
  model: "Model",
  remarks: "Remarks",
  categoryId: "Category",
  assetTag: "Asset Tag",
};

export function formatDiffFields(
  before: AssetSnapshot,
  changes: Partial<AssetSnapshot>,
  labels?: {
    status?: Record<string, string>;
    location?: Record<string, string>;
    category?: Record<string, string>;
  },
): DiffField[] {
  const fields: DiffField[] = [];
  for (const [key, afterVal] of Object.entries(changes)) {
    if (afterVal === undefined) continue;
    const k = key as keyof AssetSnapshot;
    let beforeStr: string | null = (before[k] as string | null) ?? null;
    let afterStr: string | null = (afterVal as string | null) ?? null;

    if (k === "statusId" && labels?.status) {
      beforeStr = labels.status[before.statusId] ?? before.statusId;
      afterStr =
        afterVal != null
          ? (labels.status[afterVal as string] ?? (afterVal as string))
          : null;
    }
    if (k === "locationId" && labels?.location) {
      beforeStr = before.locationId
        ? (labels.location[before.locationId] ?? before.locationId)
        : null;
      afterStr =
        afterVal != null
          ? (labels.location[afterVal as string] ?? (afterVal as string))
          : null;
    }
    if (k === "categoryId" && labels?.category) {
      beforeStr = labels.category[before.categoryId] ?? before.categoryId;
      afterStr =
        afterVal != null
          ? (labels.category[afterVal as string] ?? (afterVal as string))
          : null;
    }

    fields.push({
      field: key,
      label: FIELD_LABELS[key] ?? key,
      before: beforeStr,
      after: afterStr,
    });
  }
  return fields;
}
