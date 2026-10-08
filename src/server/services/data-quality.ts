import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { isPlaceholder, normaliseText } from "@/lib/normalise";
import { ServiceError } from "@/server/services/admin-org";
import { suggestTagForAsset } from "@/server/services/assets";

export async function clearNeedsReview(assetId: string, userId: string) {
  const existing = await prisma.asset.findFirst({
    where: { id: assetId, deletedAt: null },
  });
  if (!existing) throw new ServiceError("Asset not found.");

  const asset = await prisma.$transaction(async (tx) => {
    const updated = await tx.asset.update({
      where: { id: assetId },
      data: {
        needsReview: false,
        reviewReasons: [],
        updatedById: userId,
      },
    });
    await tx.assetEvent.create({
      data: {
        assetId,
        type: "NOTE",
        note: "Marked as reviewed (cleared needs-review flag)",
        fromValue: {
          needsReview: existing.needsReview,
          reviewReasons: existing.reviewReasons,
        },
        toValue: { needsReview: false, reviewReasons: [] },
        userId,
      },
    });
    return updated;
  });

  await writeAuditLog({
    userId,
    action: "ASSET_CLEAR_REVIEW",
    entityType: "Asset",
    entityId: assetId,
    before: {
      needsReview: existing.needsReview,
      reviewReasons: existing.reviewReasons,
    },
    after: { needsReview: false, reviewReasons: [] },
  });

  return asset;
}

export async function bulkClearNeedsReview(
  assetIds: string[],
  userId: string,
) {
  const ids = [...new Set(assetIds)].slice(0, 200);
  let processed = 0;
  for (const id of ids) {
    await clearNeedsReview(id, userId);
    processed += 1;
  }
  return { processed };
}

export async function applySuggestedTag(assetId: string, userId: string) {
  const existing = await prisma.asset.findFirst({
    where: { id: assetId, deletedAt: null },
  });
  if (!existing) throw new ServiceError("Asset not found.");
  if (existing.assetTag && !isPlaceholder(existing.assetTag)) {
    throw new ServiceError("This asset already has a tag.");
  }

  const tag = await suggestTagForAsset({
    departmentId: existing.departmentId,
    branchId: existing.branchId,
    categoryId: existing.categoryId,
  });

  const reasons = existing.reviewReasons.filter(
    (r) => r !== "MISSING_TAG" && r !== "PLACEHOLDER_VALUE",
  );

  const asset = await prisma.$transaction(async (tx) => {
    const updated = await tx.asset.update({
      where: { id: assetId },
      data: {
        assetTag: tag,
        reviewReasons: reasons,
        needsReview: reasons.length > 0,
        updatedById: userId,
      },
    });
    await tx.assetEvent.create({
      data: {
        assetId,
        type: "UPDATED",
        note: `Assigned suggested tag ${tag}`,
        fromValue: { assetTag: existing.assetTag },
        toValue: { assetTag: tag },
        userId,
      },
    });
    return updated;
  });

  await writeAuditLog({
    userId,
    action: "ASSET_SUGGEST_TAG",
    entityType: "Asset",
    entityId: assetId,
    before: { assetTag: existing.assetTag },
    after: { assetTag: tag },
  });

  return asset;
}

const PLACEHOLDER_FIELDS = [
  "assetTag",
  "serialNumber",
  "brand",
  "model",
  "assignedToText",
] as const;

export async function clearPlaceholderFields(assetId: string, userId: string) {
  const { loadPlaceholdersIntoNormalise } = await import(
    "@/server/queries/settings"
  );
  await loadPlaceholdersIntoNormalise();

  const existing = await prisma.asset.findFirst({
    where: { id: assetId, deletedAt: null },
  });
  if (!existing) throw new ServiceError("Asset not found.");

  const updates: Record<string, string | null> = {};
  for (const field of PLACEHOLDER_FIELDS) {
    const value = existing[field];
    if (value != null && isPlaceholder(value)) {
      updates[field] = null;
    } else if (value != null) {
      const normalised = normaliseText(value);
      if (normalised !== value) updates[field] = normalised;
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new ServiceError("No placeholder values to clear on this asset.");
  }

  const reasons = existing.reviewReasons.filter((r) => r !== "PLACEHOLDER_VALUE");
  // Re-check missing tag/serial after clearing
  const nextTag =
    "assetTag" in updates ? updates.assetTag : existing.assetTag;
  const nextSerial =
    "serialNumber" in updates ? updates.serialNumber : existing.serialNumber;
  let nextReasons = [...reasons];
  if (!nextTag && !nextReasons.includes("MISSING_TAG")) {
    // keep MISSING_TAG if already present; don't add if tag was placeholder→null
    if (existing.reviewReasons.includes("MISSING_TAG") || !nextTag) {
      if (!nextReasons.includes("MISSING_TAG") && !nextTag) {
        nextReasons.push("MISSING_TAG");
      }
    }
  }
  if (!nextSerial && existing.reviewReasons.includes("MISSING_SERIAL")) {
    if (!nextReasons.includes("MISSING_SERIAL")) {
      nextReasons.push("MISSING_SERIAL");
    }
  }
  nextReasons = [...new Set(nextReasons)];

  const asset = await prisma.$transaction(async (tx) => {
    const updated = await tx.asset.update({
      where: { id: assetId },
      data: {
        ...updates,
        reviewReasons: nextReasons,
        needsReview: nextReasons.length > 0,
        updatedById: userId,
      },
    });
    await tx.assetEvent.create({
      data: {
        assetId,
        type: "UPDATED",
        note: "Cleared placeholder values",
        fromValue: Object.fromEntries(
          Object.keys(updates).map((k) => [
            k,
            existing[k as keyof typeof existing],
          ]),
        ),
        toValue: updates,
        userId,
      },
    });
    return updated;
  });

  await writeAuditLog({
    userId,
    action: "ASSET_CLEAR_PLACEHOLDERS",
    entityType: "Asset",
    entityId: assetId,
    before: updates,
    after: asset,
  });

  return asset;
}

export async function findDuplicatePeers(assetId: string) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, deletedAt: null },
    select: {
      id: true,
      departmentId: true,
      assetTag: true,
      serialNumber: true,
    },
  });
  if (!asset) return { tagHits: [], serialHits: [] };

  const [tagHits, serialHits] = await Promise.all([
    asset.assetTag
      ? prisma.asset.findMany({
          where: {
            departmentId: asset.departmentId,
            deletedAt: null,
            id: { not: asset.id },
            assetTag: { equals: asset.assetTag, mode: "insensitive" },
          },
          select: {
            id: true,
            assetTag: true,
            serialNumber: true,
            brand: true,
            model: true,
            branch: { select: { name: true } },
          },
          take: 10,
        })
      : Promise.resolve([]),
    asset.serialNumber
      ? prisma.asset.findMany({
          where: {
            departmentId: asset.departmentId,
            deletedAt: null,
            id: { not: asset.id },
            serialNumber: {
              equals: asset.serialNumber,
              mode: "insensitive",
            },
          },
          select: {
            id: true,
            assetTag: true,
            serialNumber: true,
            brand: true,
            model: true,
            branch: { select: { name: true } },
          },
          take: 10,
        })
      : Promise.resolve([]),
  ]);

  return { tagHits, serialHits };
}
