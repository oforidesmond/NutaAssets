import { resolveAlias, type AliasMap } from "@/lib/import/aliases";
import type {
  DuplicatePolicy,
  DryRunReport,
  NormalisedImportRow,
  ResolvedImportRow,
  ValidatedImportRow,
} from "@/lib/import/types";
import { matchKey } from "@/lib/normalise";

export type LookupMaps = {
  categories: Map<string, string>; // upper name → id
  statuses: Map<string, string>;
  branches: Map<string, string>;
  locations: Map<string, string>; // `${branchId}::${upper name}` → id
  categoryAliases: AliasMap;
  statusAliases: AliasMap;
  branchAliases?: AliasMap;
};

export type ExistingAssetRef = {
  id: string;
  assetTag: string | null;
  serialNumber: string | null;
};

function resolveId(
  raw: string | null,
  resolvedName: string | null,
  aliases: AliasMap,
  map: Map<string, string>,
  knownNames: string[],
): { id: string | null; name: string | null; unknown: boolean } {
  const nameList = knownNames;
  const aliasResult = resolveAlias(raw, aliases, nameList);
  const name = aliasResult.resolved ?? resolvedName;
  if (!name) return { id: null, name: null, unknown: Boolean(raw) };
  const id = map.get(name.toUpperCase()) ?? null;
  return { id, name, unknown: !id };
}

export function resolveRows(
  rows: NormalisedImportRow[],
  lookups: LookupMaps,
  defaultBranchId: string | null,
  defaultBranchName: string | null,
): {
  resolved: ResolvedImportRow[];
  unknownCategories: string[];
  unknownStatuses: string[];
  unknownBranches: string[];
} {
  const knownCategories = [...lookups.categories.keys()];
  const knownStatuses = [...lookups.statuses.keys()];
  const knownBranches = [...lookups.branches.keys()];

  const unknownCategories = new Set<string>();
  const unknownStatuses = new Set<string>();
  const unknownBranches = new Set<string>();

  const resolved: ResolvedImportRow[] = rows.map((row) => {
    const errors: string[] = [];
    const cat = resolveId(
      row.categoryRaw,
      row.categoryName,
      lookups.categoryAliases,
      lookups.categories,
      knownCategories,
    );
    const status = resolveId(
      row.statusRaw,
      row.statusName,
      lookups.statusAliases,
      lookups.statuses,
      knownStatuses,
    );
    const branchRaw = row.branchRaw ?? defaultBranchName;
    const branch = resolveId(
      branchRaw,
      row.branchName ?? defaultBranchName,
      lookups.branchAliases ?? {},
      lookups.branches,
      knownBranches,
    );

    const branchId = branch.id ?? defaultBranchId;
    const branchName = branch.name ?? defaultBranchName;

    if (row.categoryRaw && cat.unknown) {
      unknownCategories.add(row.categoryRaw);
      errors.push(`Unknown category: ${row.categoryRaw}`);
    }
    if (row.statusRaw && status.unknown) {
      unknownStatuses.add(row.statusRaw);
      errors.push(`Unknown status: ${row.statusRaw}`);
    }
    if (branchRaw && branch.unknown && !defaultBranchId) {
      unknownBranches.add(branchRaw);
      errors.push(`Unknown branch: ${branchRaw}`);
    }

    if (!cat.id) errors.push("Category is required");
    if (!status.id) errors.push("Status is required");
    if (!branchId) errors.push("Branch is required");

    let locationId: string | null = null;
    if (row.locationRaw && branchId) {
      locationId =
        lookups.locations.get(
          `${branchId}::${row.locationRaw.toUpperCase()}`,
        ) ?? null;
    }

    return {
      ...row,
      categoryId: cat.id,
      statusId: status.id,
      branchId,
      branchName,
      categoryName: cat.name ?? row.categoryName,
      statusName: status.name ?? row.statusName,
      locationId,
      errors,
    };
  });

  return {
    resolved,
    unknownCategories: [...unknownCategories].sort(),
    unknownStatuses: [...unknownStatuses].sort(),
    unknownBranches: [...unknownBranches].sort(),
  };
}

function findExistingMatch(
  row: ResolvedImportRow,
  bySerial: Map<string, ExistingAssetRef>,
  byTag: Map<string, ExistingAssetRef>,
): ExistingAssetRef | null {
  const serial = matchKey(row.serialNumber);
  if (serial && bySerial.has(serial)) return bySerial.get(serial)!;
  const tag = matchKey(row.assetTag);
  if (tag && byTag.has(tag)) return byTag.get(tag)!;
  return null;
}

/**
 * Validate resolved rows: required fields, in-file duplicates, DB duplicates.
 */
export function validateImportRows(input: {
  rows: ResolvedImportRow[];
  existing: ExistingAssetRef[];
  duplicatePolicy: DuplicatePolicy;
  blankSkipped: number;
  unknownCategories: string[];
  unknownStatuses: string[];
  unknownBranches: string[];
}): DryRunReport {
  const bySerial = new Map<string, ExistingAssetRef>();
  const byTag = new Map<string, ExistingAssetRef>();
  for (const a of input.existing) {
    const s = matchKey(a.serialNumber);
    if (s && !bySerial.has(s)) bySerial.set(s, a);
    const t = matchKey(a.assetTag);
    if (t && !byTag.has(t)) byTag.set(t, a);
  }

  const seenSerial = new Map<string, number>();
  const seenTag = new Map<string, number>();

  const validated: ValidatedImportRow[] = [];
  const errors: { sourceRow: number; message: string }[] = [];
  let toCreate = 0;
  let toUpdate = 0;
  let toSkip = 0;
  let flagged = 0;

  for (const row of input.rows) {
    const reviewReasons = [...row.reviewReasons];
    let inFileDuplicate = false;

    const serial = matchKey(row.serialNumber);
    const tag = matchKey(row.assetTag);
    if (serial) {
      if (seenSerial.has(serial)) {
        inFileDuplicate = true;
        reviewReasons.push("DUPLICATE_SERIAL");
      } else {
        seenSerial.set(serial, row.sourceRow);
      }
    }
    if (tag) {
      if (seenTag.has(tag)) {
        inFileDuplicate = true;
        reviewReasons.push("DUPLICATE_TAG");
      } else {
        seenTag.set(tag, row.sourceRow);
      }
    }

    const match = findExistingMatch(row, bySerial, byTag);
    if (match) {
      const matchSerial = matchKey(match.serialNumber);
      const matchTag = matchKey(match.assetTag);
      if (serial && matchSerial === serial) reviewReasons.push("DUPLICATE_SERIAL");
      if (tag && matchTag === tag) reviewReasons.push("DUPLICATE_TAG");
    }

    const uniqueReasons = Array.from(new Set(reviewReasons));
    const hasErrors = row.errors.length > 0;

    let action: ValidatedImportRow["action"] = "create";
    let matchAssetId: string | null = null;

    if (hasErrors) {
      action = "error";
      for (const message of row.errors) {
        errors.push({ sourceRow: row.sourceRow, message });
      }
    } else if (match) {
      matchAssetId = match.id;
      if (input.duplicatePolicy === "skip") {
        action = "skip";
        toSkip += 1;
      } else if (input.duplicatePolicy === "update") {
        action = "update";
        toUpdate += 1;
      } else {
        // flag: import anyway as create + needs review
        action = "create";
        toCreate += 1;
        if (uniqueReasons.some((r) => r.startsWith("DUPLICATE"))) {
          flagged += 1;
        }
      }
    } else {
      action = "create";
      toCreate += 1;
    }

    if (
      action !== "error" &&
      action !== "skip" &&
      uniqueReasons.length > 0
    ) {
      flagged += 1;
    }

    if (inFileDuplicate && input.duplicatePolicy === "skip" && action === "create") {
      // still create first occurrence; subsequent in-file dups flagged
    }

    validated.push({
      ...row,
      reviewReasons: uniqueReasons,
      action,
      matchAssetId,
      inFileDuplicate,
    });
  }

  return {
    totalDetected: input.rows.length + input.blankSkipped,
    blankSkipped: input.blankSkipped,
    toCreate,
    toUpdate,
    toSkip,
    flagged,
    errors,
    unknownCategories: input.unknownCategories,
    unknownStatuses: input.unknownStatuses,
    unknownBranches: input.unknownBranches,
    rows: validated,
  };
}

export function buildLookupMaps(input: {
  categories: { id: string; name: string }[];
  statuses: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  locations: { id: string; name: string; branchId: string }[];
  categoryAliases: AliasMap;
  statusAliases: AliasMap;
}): LookupMaps {
  return {
    categories: new Map(
      input.categories.map((c) => [c.name.toUpperCase(), c.id]),
    ),
    statuses: new Map(input.statuses.map((s) => [s.name.toUpperCase(), s.id])),
    branches: new Map(input.branches.map((b) => [b.name.toUpperCase(), b.id])),
    locations: new Map(
      input.locations.map((l) => [
        `${l.branchId}::${l.name.toUpperCase()}`,
        l.id,
      ]),
    ),
    categoryAliases: input.categoryAliases,
    statusAliases: input.statusAliases,
  };
}
