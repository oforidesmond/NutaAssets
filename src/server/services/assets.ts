import type { Asset, Prisma, Status } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import {
  buildDuplicateResult,
  mergeReviewReasons,
  type DuplicateAssetHit,
} from "@/lib/duplicates";
import { prisma } from "@/lib/db";
import {
  CustomFieldsValidationError,
  parseCustomFields,
} from "@/lib/dynamic-schema";
import { matchKey, normaliseText } from "@/lib/normalise";
import {
  parseTagFormatSetting,
  suggestNextTag,
} from "@/lib/tag-generator";
import {
  STATUSES_REQUIRING_NOTE,
  type AssetFormInput,
  type BulkActionInput,
} from "@/schemas/asset";
import { ServiceError } from "@/server/services/admin-org";

async function loadFieldDefs(departmentId: string) {
  return prisma.fieldDefinition.findMany({
    where: { departmentId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}

async function resolveCustomFields(
  departmentId: string,
  categoryId: string,
  raw: unknown,
) {
  const defs = await loadFieldDefs(departmentId);
  try {
    return parseCustomFields(defs, categoryId, raw ?? {});
  } catch (error) {
    if (error instanceof CustomFieldsValidationError) {
      throw new ServiceError(error.message);
    }
    throw error;
  }
}

function parseOptionalDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseOptionalDecimal(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isNaN(n) ? null : n;
}

function statusRequiresNote(status: Pick<Status, "name">) {
  return (STATUSES_REQUIRING_NOTE as readonly string[]).includes(status.name);
}

async function findDuplicateHits(input: {
  departmentId: string;
  assetTag?: string | null;
  serialNumber?: string | null;
  excludeId?: string;
}): Promise<{ tagHits: DuplicateAssetHit[]; serialHits: DuplicateAssetHit[] }> {
  const tagKey = matchKey(input.assetTag);
  const serialKey = matchKey(input.serialNumber);

  const [byTag, bySerial] = await Promise.all([
    tagKey
      ? prisma.asset.findMany({
          where: {
            departmentId: input.departmentId,
            deletedAt: null,
            assetTag: { equals: tagKey, mode: "insensitive" },
            ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}),
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
    serialKey
      ? prisma.asset.findMany({
          where: {
            departmentId: input.departmentId,
            deletedAt: null,
            serialNumber: { equals: serialKey, mode: "insensitive" },
            ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}),
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

  return {
    tagHits: byTag.map((a) => ({
      id: a.id,
      assetTag: a.assetTag,
      serialNumber: a.serialNumber,
      brand: a.brand,
      model: a.model,
      branchName: a.branch.name,
    })),
    serialHits: bySerial.map((a) => ({
      id: a.id,
      assetTag: a.assetTag,
      serialNumber: a.serialNumber,
      brand: a.brand,
      model: a.model,
      branchName: a.branch.name,
    })),
  };
}

export async function checkAssetDuplicates(input: {
  departmentId: string;
  assetTag?: string | null;
  serialNumber?: string | null;
  excludeId?: string;
}) {
  const hits = await findDuplicateHits(input);
  return buildDuplicateResult({
    assetTag: input.assetTag,
    serialNumber: input.serialNumber,
    ...hits,
  });
}

function normaliseAssetFields(input: AssetFormInput) {
  return {
    departmentId: input.departmentId,
    categoryId: input.categoryId,
    branchId: input.branchId,
    locationId: input.locationId || null,
    assetTag: normaliseText(input.assetTag),
    serialNumber: normaliseText(input.serialNumber),
    brand: normaliseText(input.brand),
    model: normaliseText(input.model),
    statusId: input.statusId,
    assignedToText: normaliseText(input.assignedToText),
    purchaseDate: parseOptionalDate(input.purchaseDate),
    purchaseCost: parseOptionalDecimal(input.purchaseCost),
    warrantyExpiry: parseOptionalDate(input.warrantyExpiry),
    condition: input.condition ?? null,
    remarks: normaliseText(input.remarks),
  };
}

export async function createAsset(
  input: AssetFormInput,
  userId: string,
): Promise<Asset> {
  const { loadPlaceholdersIntoNormalise } = await import(
    "@/server/queries/settings"
  );
  await loadPlaceholdersIntoNormalise();
  const fields = normaliseAssetFields(input);
  const status = await prisma.status.findFirst({
    where: { id: fields.statusId, deletedAt: null },
  });
  if (!status) throw new ServiceError("Status not found.");

  const dup = await checkAssetDuplicates({
    departmentId: fields.departmentId,
    assetTag: fields.assetTag,
    serialNumber: fields.serialNumber,
  });
  if (dup.hasDuplicates && !input.acknowledgeDuplicates) {
    const err = new ServiceError(
      "Possible duplicate found. Review and acknowledge to continue.",
    ) as ServiceError & { duplicates: typeof dup };
    err.duplicates = dup;
    throw err;
  }

  const reviewReasons = dup.hasDuplicates ? dup.reasons : [];
  const customFields = await resolveCustomFields(
    fields.departmentId,
    fields.categoryId,
    input.customFields,
  );

  const asset = await prisma.$transaction(async (tx) => {
    const created = await tx.asset.create({
      data: {
        ...fields,
        purchaseCost:
          fields.purchaseCost == null
            ? null
            : fields.purchaseCost.toFixed(2),
        customFields: customFields as Prisma.InputJsonValue,
        needsReview: reviewReasons.length > 0,
        reviewReasons,
        retiredAt: status.kind === "END_OF_LIFE" ? new Date() : null,
        createdById: userId,
        updatedById: userId,
      },
    });
    await tx.assetEvent.create({
      data: {
        assetId: created.id,
        type: "CREATED",
        toValue: {
          assetTag: created.assetTag,
          serialNumber: created.serialNumber,
          statusId: created.statusId,
          branchId: created.branchId,
          customFields: created.customFields,
        },
        userId,
      },
    });
    return created;
  });

  await writeAuditLog({
    userId,
    action: "ASSET_CREATE",
    entityType: "Asset",
    entityId: asset.id,
    after: asset,
  });
  return asset;
}

export async function updateAsset(
  id: string,
  input: AssetFormInput,
  userId: string,
): Promise<Asset> {
  const { loadPlaceholdersIntoNormalise } = await import(
    "@/server/queries/settings"
  );
  await loadPlaceholdersIntoNormalise();

  const existing = await prisma.asset.findFirst({
    where: { id, deletedAt: null },
    include: { status: true },
  });
  if (!existing) throw new ServiceError("Asset not found.");

  if (input.updatedAt) {
    const clientTs = new Date(input.updatedAt).getTime();
    if (clientTs !== existing.updatedAt.getTime()) {
      const err = new ServiceError(
        "This asset was changed by someone else. Refresh and try again.",
      ) as ServiceError & { conflict: boolean };
      err.conflict = true;
      throw err;
    }
  }

  const fields = normaliseAssetFields(input);
  const status = await prisma.status.findFirst({
    where: { id: fields.statusId, deletedAt: null },
  });
  if (!status) throw new ServiceError("Status not found.");

  const dup = await checkAssetDuplicates({
    departmentId: fields.departmentId,
    assetTag: fields.assetTag,
    serialNumber: fields.serialNumber,
    excludeId: id,
  });
  if (dup.hasDuplicates && !input.acknowledgeDuplicates) {
    const err = new ServiceError(
      "Possible duplicate found. Review and acknowledge to continue.",
    ) as ServiceError & { duplicates: typeof dup };
    err.duplicates = dup;
    throw err;
  }

  const reviewReasons = mergeReviewReasons(
    existing.reviewReasons.filter(
      (r) => r !== "DUPLICATE_TAG" && r !== "DUPLICATE_SERIAL",
    ),
    dup.reasons,
  );

  const customFields = await resolveCustomFields(
    fields.departmentId,
    fields.categoryId,
    input.customFields,
  );

  const asset = await prisma.$transaction(async (tx) => {
    const updated = await tx.asset.update({
      where: { id },
      data: {
        ...fields,
        purchaseCost:
          fields.purchaseCost == null
            ? null
            : fields.purchaseCost.toFixed(2),
        customFields: customFields as Prisma.InputJsonValue,
        needsReview: reviewReasons.length > 0 || existing.needsReview,
        reviewReasons,
        retiredAt:
          status.kind === "END_OF_LIFE"
            ? (existing.retiredAt ?? new Date())
            : null,
        updatedById: userId,
      },
    });

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of [
      "assetTag",
      "serialNumber",
      "brand",
      "model",
      "statusId",
      "branchId",
      "locationId",
      "categoryId",
      "assignedToText",
      "remarks",
    ] as const) {
      if (existing[key] !== updated[key]) {
        changes[key] = { from: existing[key], to: updated[key] };
      }
    }
    if (
      JSON.stringify(existing.customFields ?? {}) !==
      JSON.stringify(updated.customFields ?? {})
    ) {
      changes.customFields = {
        from: existing.customFields,
        to: updated.customFields,
      };
    }

    if (Object.keys(changes).length > 0) {
      let eventType: "UPDATED" | "STATUS_CHANGED" | "TRANSFERRED" | "ASSIGNED" =
        "UPDATED";
      if (existing.statusId !== updated.statusId) eventType = "STATUS_CHANGED";
      else if (existing.branchId !== updated.branchId) eventType = "TRANSFERRED";
      else if (existing.assignedToText !== updated.assignedToText)
        eventType = "ASSIGNED";

      await tx.assetEvent.create({
        data: {
          assetId: id,
          type: eventType,
          fromValue: Object.fromEntries(
            Object.entries(changes).map(([k, v]) => [k, v.from]),
          ) as Prisma.InputJsonValue,
          toValue: Object.fromEntries(
            Object.entries(changes).map(([k, v]) => [k, v.to]),
          ) as Prisma.InputJsonValue,
          userId,
        },
      });
    }

    return updated;
  });

  await writeAuditLog({
    userId,
    action: "ASSET_UPDATE",
    entityType: "Asset",
    entityId: id,
    before: existing,
    after: asset,
  });
  return asset;
}

export async function softDeleteAsset(id: string, userId: string) {
  const existing = await prisma.asset.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new ServiceError("Asset not found.");

  const asset = await prisma.$transaction(async (tx) => {
    const updated = await tx.asset.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
    });
    await tx.assetEvent.create({
      data: {
        assetId: id,
        type: "DELETED",
        note: "Moved to recycle bin",
        userId,
      },
    });
    return updated;
  });

  await writeAuditLog({
    userId,
    action: "ASSET_DELETE",
    entityType: "Asset",
    entityId: id,
    before: existing,
    after: asset,
  });
  return asset;
}

export async function restoreAsset(id: string, userId: string) {
  const existing = await prisma.asset.findFirst({
    where: { id, deletedAt: { not: null } },
  });
  if (!existing) throw new ServiceError("Deleted asset not found.");

  const asset = await prisma.$transaction(async (tx) => {
    const updated = await tx.asset.update({
      where: { id },
      data: { deletedAt: null, updatedById: userId },
    });
    await tx.assetEvent.create({
      data: {
        assetId: id,
        type: "RESTORED",
        note: "Restored from recycle bin",
        userId,
      },
    });
    return updated;
  });

  await writeAuditLog({
    userId,
    action: "ASSET_RESTORE",
    entityType: "Asset",
    entityId: id,
    before: existing,
    after: asset,
  });
  return asset;
}

export async function changeAssetStatus(input: {
  assetId: string;
  statusId: string;
  note?: string | null;
  userId: string;
}) {
  const existing = await prisma.asset.findFirst({
    where: { id: input.assetId, deletedAt: null },
    include: { status: true },
  });
  if (!existing) throw new ServiceError("Asset not found.");

  const status = await prisma.status.findFirst({
    where: { id: input.statusId, deletedAt: null },
  });
  if (!status) throw new ServiceError("Status not found.");

  if (statusRequiresNote(status) && !normaliseText(input.note)) {
    throw new ServiceError(
      `A note is required when setting status to ${status.name}.`,
    );
  }

  const asset = await prisma.$transaction(async (tx) => {
    const updated = await tx.asset.update({
      where: { id: input.assetId },
      data: {
        statusId: status.id,
        retiredAt:
          status.kind === "END_OF_LIFE"
            ? (existing.retiredAt ?? new Date())
            : null,
        remarks: normaliseText(input.note)
          ? [existing.remarks, normaliseText(input.note)]
              .filter(Boolean)
              .join("\n")
          : existing.remarks,
        updatedById: input.userId,
      },
    });
    await tx.assetEvent.create({
      data: {
        assetId: input.assetId,
        type:
          status.kind === "END_OF_LIFE" &&
          ["Disposed", "Lost", "Retired"].includes(status.name)
            ? "DISPOSED"
            : "STATUS_CHANGED",
        fromValue: { statusId: existing.statusId, status: existing.status.name },
        toValue: { statusId: status.id, status: status.name },
        note: normaliseText(input.note),
        userId: input.userId,
      },
    });
    return updated;
  });

  await writeAuditLog({
    userId: input.userId,
    action: "ASSET_STATUS_CHANGE",
    entityType: "Asset",
    entityId: input.assetId,
    before: { statusId: existing.statusId },
    after: { statusId: status.id },
  });
  return asset;
}

export async function transferAsset(input: {
  assetId: string;
  branchId: string;
  locationId?: string | null;
  note?: string | null;
  userId: string;
}) {
  const existing = await prisma.asset.findFirst({
    where: { id: input.assetId, deletedAt: null },
    include: { branch: true, location: true },
  });
  if (!existing) throw new ServiceError("Asset not found.");

  const branch = await prisma.branch.findFirst({
    where: { id: input.branchId, deletedAt: null },
  });
  if (!branch) throw new ServiceError("Branch not found.");

  if (input.locationId) {
    const loc = await prisma.location.findFirst({
      where: {
        id: input.locationId,
        branchId: input.branchId,
        deletedAt: null,
      },
    });
    if (!loc) throw new ServiceError("Location does not belong to that branch.");
  }

  const asset = await prisma.$transaction(async (tx) => {
    const updated = await tx.asset.update({
      where: { id: input.assetId },
      data: {
        branchId: input.branchId,
        locationId: input.locationId || null,
        updatedById: input.userId,
      },
    });
    await tx.assetEvent.create({
      data: {
        assetId: input.assetId,
        type: "TRANSFERRED",
        fromValue: {
          branchId: existing.branchId,
          branch: existing.branch.name,
          locationId: existing.locationId,
          location: existing.location?.name ?? null,
        },
        toValue: {
          branchId: branch.id,
          branch: branch.name,
          locationId: input.locationId || null,
        },
        note: normaliseText(input.note),
        userId: input.userId,
      },
    });
    return updated;
  });

  await writeAuditLog({
    userId: input.userId,
    action: "ASSET_TRANSFER",
    entityType: "Asset",
    entityId: input.assetId,
    before: { branchId: existing.branchId, locationId: existing.locationId },
    after: { branchId: input.branchId, locationId: input.locationId || null },
  });
  return asset;
}

export async function assignAsset(input: {
  assetId: string;
  assignedToText?: string | null;
  note?: string | null;
  userId: string;
}) {
  const existing = await prisma.asset.findFirst({
    where: { id: input.assetId, deletedAt: null },
  });
  if (!existing) throw new ServiceError("Asset not found.");

  const assignedToText = normaliseText(input.assignedToText);

  const asset = await prisma.$transaction(async (tx) => {
    const updated = await tx.asset.update({
      where: { id: input.assetId },
      data: {
        assignedToText,
        updatedById: input.userId,
      },
    });
    await tx.assetEvent.create({
      data: {
        assetId: input.assetId,
        type: "ASSIGNED",
        fromValue: { assignedToText: existing.assignedToText },
        toValue: { assignedToText },
        note: normaliseText(input.note),
        userId: input.userId,
      },
    });
    return updated;
  });

  await writeAuditLog({
    userId: input.userId,
    action: "ASSET_ASSIGN",
    entityType: "Asset",
    entityId: input.assetId,
    before: { assignedToText: existing.assignedToText },
    after: { assignedToText },
  });
  return asset;
}

export async function duplicateAsset(id: string, userId: string) {
  const existing = await prisma.asset.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new ServiceError("Asset not found.");

  return createAsset(
    {
      departmentId: existing.departmentId,
      categoryId: existing.categoryId,
      branchId: existing.branchId,
      locationId: existing.locationId,
      assetTag: null,
      serialNumber: null,
      brand: existing.brand,
      model: existing.model,
      statusId: existing.statusId,
      assignedToText: existing.assignedToText,
      purchaseDate: null,
      purchaseCost: null,
      warrantyExpiry: null,
      condition: existing.condition,
      remarks: existing.remarks,
      customFields:
        existing.customFields &&
        typeof existing.customFields === "object" &&
        !Array.isArray(existing.customFields)
          ? (existing.customFields as Record<string, unknown>)
          : {},
      acknowledgeDuplicates: true,
    },
    userId,
  );
}

export async function bulkUpdateAssets(
  input: BulkActionInput,
  userId: string,
) {
  const ids = input.ids.slice(0, 200);
  let processed = 0;

  for (const id of ids) {
    switch (input.action) {
      case "change_status":
        if (!input.statusId) throw new ServiceError("Status is required.");
        await changeAssetStatus({
          assetId: id,
          statusId: input.statusId,
          note: input.note,
          userId,
        });
        break;
      case "transfer":
        if (!input.branchId) throw new ServiceError("Branch is required.");
        await transferAsset({
          assetId: id,
          branchId: input.branchId,
          locationId: input.locationId,
          note: input.note,
          userId,
        });
        break;
      case "assign":
        await assignAsset({
          assetId: id,
          assignedToText: input.assignedToText,
          note: input.note,
          userId,
        });
        break;
      case "set_category": {
        if (!input.categoryId) throw new ServiceError("Category is required.");
        const existing = await prisma.asset.findFirst({
          where: { id, deletedAt: null },
        });
        if (!existing) continue;
        await prisma.$transaction(async (tx) => {
          await tx.asset.update({
            where: { id },
            data: { categoryId: input.categoryId!, updatedById: userId },
          });
          await tx.assetEvent.create({
            data: {
              assetId: id,
              type: "UPDATED",
              fromValue: { categoryId: existing.categoryId },
              toValue: { categoryId: input.categoryId },
              userId,
            },
          });
        });
        break;
      }
      case "add_remark": {
        const remark = normaliseText(input.remark);
        if (!remark) throw new ServiceError("Remark is required.");
        const existing = await prisma.asset.findFirst({
          where: { id, deletedAt: null },
        });
        if (!existing) continue;
        await prisma.$transaction(async (tx) => {
          await tx.asset.update({
            where: { id },
            data: {
              remarks: [existing.remarks, remark].filter(Boolean).join("\n"),
              updatedById: userId,
            },
          });
          await tx.assetEvent.create({
            data: {
              assetId: id,
              type: "NOTE",
              note: remark,
              userId,
            },
          });
        });
        break;
      }
      case "soft_delete":
        await softDeleteAsset(id, userId);
        break;
    }
    processed += 1;
  }

  return { processed };
}

export async function suggestTagForAsset(input: {
  departmentId: string;
  branchId: string;
  categoryId: string;
}) {
  const [branch, department, category, setting, tags] = await Promise.all([
    prisma.branch.findFirst({ where: { id: input.branchId, deletedAt: null } }),
    prisma.department.findFirst({
      where: { id: input.departmentId, deletedAt: null },
    }),
    prisma.category.findFirst({
      where: { id: input.categoryId, deletedAt: null },
    }),
    prisma.setting.findUnique({ where: { key: "tag_format" } }),
    prisma.asset.findMany({
      where: { departmentId: input.departmentId, deletedAt: null },
      select: { assetTag: true },
    }),
  ]);

  if (!branch || !department || !category) {
    throw new ServiceError("Branch, department, or category not found.");
  }

  return suggestNextTag({
    template: parseTagFormatSetting(setting?.value),
    branchCode: branch.code,
    departmentCode: department.code,
    categoryCode: category.code,
    existingTags: tags.map((t) => t.assetTag).filter(Boolean) as string[],
  });
}

export async function listBrandSuggestions(
  departmentId: string,
  q: string,
  take = 8,
) {
  const term = q.trim();
  if (!term) return [];
  const rows = await prisma.asset.findMany({
    where: {
      departmentId,
      deletedAt: null,
      brand: { contains: term, mode: "insensitive" },
    },
    select: { brand: true },
    distinct: ["brand"],
    take,
  });
  return rows.map((r) => r.brand!).filter(Boolean);
}

export async function listModelSuggestions(
  departmentId: string,
  q: string,
  take = 8,
) {
  const term = q.trim();
  if (!term) return [];
  const rows = await prisma.asset.findMany({
    where: {
      departmentId,
      deletedAt: null,
      model: { contains: term, mode: "insensitive" },
    },
    select: { model: true },
    distinct: ["model"],
    take,
  });
  return rows.map((r) => r.model!).filter(Boolean);
}

export type AssetListInclude = Prisma.AssetGetPayload<{
  include: {
    category: { select: { id: true; name: true; code: true; icon: true } };
    branch: { select: { id: true; name: true; code: true } };
    location: { select: { id: true; name: true } };
    status: {
      select: { id: true; name: true; color: true; kind: true };
    };
  };
}>;
