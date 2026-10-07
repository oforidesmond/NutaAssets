import { matchKey } from "@/lib/normalise";

export type DuplicateAssetHit = {
  id: string;
  assetTag: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  branchName?: string | null;
};

export type DuplicateCheckResult = {
  tagHits: DuplicateAssetHit[];
  serialHits: DuplicateAssetHit[];
  reasons: string[];
  hasDuplicates: boolean;
};

export function buildDuplicateResult(input: {
  assetTag?: string | null;
  serialNumber?: string | null;
  tagHits: DuplicateAssetHit[];
  serialHits: DuplicateAssetHit[];
}): DuplicateCheckResult {
  const reasons: string[] = [];
  const tagKey = matchKey(input.assetTag);
  const serialKey = matchKey(input.serialNumber);

  const tagHits =
    tagKey == null
      ? []
      : input.tagHits.filter((h) => matchKey(h.assetTag) === tagKey);
  const serialHits =
    serialKey == null
      ? []
      : input.serialHits.filter((h) => matchKey(h.serialNumber) === serialKey);

  if (tagHits.length > 0) reasons.push("DUPLICATE_TAG");
  if (serialHits.length > 0) reasons.push("DUPLICATE_SERIAL");

  return {
    tagHits,
    serialHits,
    reasons,
    hasDuplicates: reasons.length > 0,
  };
}

export function mergeReviewReasons(
  existing: string[] | null | undefined,
  extra: string[],
): string[] {
  const set = new Set([...(existing ?? []), ...extra]);
  return Array.from(set);
}
