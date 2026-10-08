import {
  Prisma,
  type ReconciliationEntry,
  type ReconciliationExercise,
  type ReconciliationItem,
  type ReconciliationResult,
} from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  diffObserved,
  formatDiffFields,
  parseObserved,
  type AssetSnapshot,
} from "@/lib/reconciliation/observed";
import { normaliseText } from "@/lib/normalise";
import {
  RECON_APPLY_CHUNK_SIZE,
  type AddUnlistedItemInput,
  type CreateExerciseInput,
  type ObservedFields,
  type VerifyItemInput,
} from "@/schemas/reconciliation";
import { ServiceError } from "@/server/services/admin-org";
import {
  assignAsset,
  changeAssetStatus,
  createAsset,
  transferAsset,
} from "@/server/services/assets";

function parseDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ServiceError("Invalid date.");
  }
  return d;
}

function toSnapshot(asset: {
  statusId: string;
  locationId: string | null;
  assignedToText: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  remarks: string | null;
  categoryId: string;
  assetTag: string | null;
}): AssetSnapshot {
  return {
    statusId: asset.statusId,
    locationId: asset.locationId,
    assignedToText: asset.assignedToText,
    serialNumber: asset.serialNumber,
    brand: asset.brand,
    model: asset.model,
    remarks: asset.remarks,
    categoryId: asset.categoryId,
    assetTag: asset.assetTag,
  };
}

export async function createExercise(
  input: CreateExerciseInput,
  userId: string,
): Promise<ReconciliationExercise> {
  const department = await prisma.department.findFirst({
    where: { id: input.departmentId, deletedAt: null, isActive: true },
  });
  if (!department) throw new ServiceError("Department not found.");

  const branches = await prisma.branch.findMany({
    where: {
      id: { in: input.scopeBranchIds },
      deletedAt: null,
      isActive: true,
    },
    select: { id: true },
  });
  if (branches.length !== input.scopeBranchIds.length) {
    throw new ServiceError("One or more selected branches are invalid.");
  }

  const exercise = await prisma.reconciliationExercise.create({
    data: {
      departmentId: input.departmentId,
      name: input.name.trim(),
      startDate: parseDate(input.startDate),
      endDate: input.endDate ? parseDate(input.endDate) : null,
      scopeBranchIds: input.scopeBranchIds,
      notes: normaliseText(input.notes),
      status: "DRAFT",
      createdById: userId,
    },
  });

  await writeAuditLog({
    userId,
    action: "RECON_EXERCISE_CREATE",
    entityType: "ReconciliationExercise",
    entityId: exercise.id,
    after: {
      name: exercise.name,
      departmentId: exercise.departmentId,
      scopeBranchIds: exercise.scopeBranchIds,
    },
  });

  return exercise;
}

export async function startExercise(
  exerciseId: string,
  userId: string,
): Promise<ReconciliationExercise> {
  const exercise = await prisma.reconciliationExercise.findFirst({
    where: { id: exerciseId, deletedAt: null },
  });
  if (!exercise) throw new ServiceError("Exercise not found.");
  if (exercise.status !== "DRAFT" && exercise.status !== "IN_PROGRESS") {
    throw new ServiceError("This exercise cannot be started.");
  }
  if (exercise.status === "IN_PROGRESS") {
    const entryCount = await prisma.reconciliationEntry.count({
      where: { exerciseId },
    });
    if (entryCount > 0) return exercise;
  }

  await prisma.$transaction(async (tx) => {
    await tx.reconciliationExercise.update({
      where: { id: exerciseId },
      data: { status: "IN_PROGRESS" },
    });

    for (const branchId of exercise.scopeBranchIds) {
      const entry = await tx.reconciliationEntry.create({
        data: {
          exerciseId,
          branchId,
          status: "NOT_STARTED",
        },
      });

      const assets = await tx.asset.findMany({
        where: {
          departmentId: exercise.departmentId,
          branchId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (assets.length === 0) continue;

      const BATCH = 500;
      for (let i = 0; i < assets.length; i += BATCH) {
        const slice = assets.slice(i, i + BATCH);
        await tx.reconciliationItem.createMany({
          data: slice.map((a) => ({
            entryId: entry.id,
            assetId: a.id,
            result: null,
          })),
        });
      }
    }
  });

  const updated = await prisma.reconciliationExercise.findUniqueOrThrow({
    where: { id: exerciseId },
  });

  await writeAuditLog({
    userId,
    action: "RECON_EXERCISE_START",
    entityType: "ReconciliationExercise",
    entityId: exerciseId,
    after: { status: "IN_PROGRESS", branches: exercise.scopeBranchIds.length },
  });

  return updated;
}

export async function cancelExercise(exerciseId: string, userId: string) {
  const exercise = await prisma.reconciliationExercise.findFirst({
    where: { id: exerciseId, deletedAt: null },
  });
  if (!exercise) throw new ServiceError("Exercise not found.");
  if (exercise.status === "COMPLETED") {
    throw new ServiceError("A completed exercise cannot be cancelled.");
  }

  const updated = await prisma.reconciliationExercise.update({
    where: { id: exerciseId },
    data: { status: "CANCELLED" },
  });

  await writeAuditLog({
    userId,
    action: "RECON_EXERCISE_CANCEL",
    entityType: "ReconciliationExercise",
    entityId: exerciseId,
  });

  return updated;
}

export async function completeExercise(exerciseId: string, userId: string) {
  const exercise = await prisma.reconciliationExercise.findFirst({
    where: { id: exerciseId, deletedAt: null },
    include: { entries: { select: { status: true } } },
  });
  if (!exercise) throw new ServiceError("Exercise not found.");
  if (exercise.status !== "IN_PROGRESS") {
    throw new ServiceError("Only an in-progress exercise can be completed.");
  }

  const pending = exercise.entries.filter((e) => e.status !== "APPROVED");
  if (pending.length > 0) {
    throw new ServiceError(
      "All branch sheets must be approved before completing the exercise.",
    );
  }

  const updated = await prisma.reconciliationExercise.update({
    where: { id: exerciseId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  await writeAuditLog({
    userId,
    action: "RECON_EXERCISE_COMPLETE",
    entityType: "ReconciliationExercise",
    entityId: exerciseId,
  });

  return updated;
}

async function loadMutableEntry(entryId: string) {
  const entry = await prisma.reconciliationEntry.findUnique({
    where: { id: entryId },
    include: {
      exercise: true,
      branch: true,
    },
  });
  if (!entry || entry.exercise.deletedAt) {
    throw new ServiceError("Branch sheet not found.");
  }
  return entry;
}

export async function verifyItem(
  input: VerifyItemInput,
  userId: string,
): Promise<ReconciliationItem> {
  const item = await prisma.reconciliationItem.findUnique({
    where: { id: input.itemId },
    include: {
      entry: { include: { exercise: true } },
      asset: true,
    },
  });
  if (!item || item.entry.exercise.deletedAt) {
    throw new ServiceError("Item not found.");
  }
  if (
    item.entry.status === "SUBMITTED" ||
    item.entry.status === "APPROVED"
  ) {
    throw new ServiceError("This sheet is locked. Ask an admin to reject it first.");
  }
  if (item.entry.exercise.status !== "IN_PROGRESS") {
    throw new ServiceError("This exercise is not open for verification.");
  }
  if (!item.assetId || !item.asset) {
    throw new ServiceError("Use Add unlisted for assets not on the register.");
  }

  let observed: ObservedFields | null = null;
  if (input.result === "FOUND_DIFFERENT") {
    observed = parseObserved(input.observed);
    const changes = diffObserved(toSnapshot(item.asset), observed);
    if (Object.keys(changes).length === 0) {
      throw new ServiceError(
        "Mark as Found if nothing changed, or enter the differences.",
      );
    }
  } else if (input.result === "MISSING") {
    if (!normaliseText(input.note)) {
      // Soft: allow without note but encourage — plan says note for missing; require it
      throw new ServiceError("Add a short note when marking an asset missing.");
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.reconciliationItem.update({
      where: { id: item.id },
      data: {
        result: input.result,
        observed:
          input.result === "FOUND_DIFFERENT"
            ? (observed as Prisma.InputJsonValue)
            : Prisma.DbNull,
        note: normaliseText(input.note),
        verifiedById: userId,
        verifiedAt: new Date(),
      },
    });

    if (item.entry.status === "NOT_STARTED") {
      await tx.reconciliationEntry.update({
        where: { id: item.entryId },
        data: { status: "IN_PROGRESS" },
      });
    }

    if (input.result === "FOUND" || input.result === "FOUND_DIFFERENT") {
      await tx.assetEvent.create({
        data: {
          assetId: item.assetId!,
          type: "VERIFIED",
          toValue: {
            reconciliationItemId: item.id,
            result: input.result,
          },
          note: normaliseText(input.note),
          userId,
        },
      });
    }

    return next;
  });

  return updated;
}

export async function addUnlistedItem(
  input: AddUnlistedItemInput,
  userId: string,
): Promise<ReconciliationItem> {
  const entry = await loadMutableEntry(input.entryId);
  if (entry.exercise.status !== "IN_PROGRESS") {
    throw new ServiceError("This exercise is not open for verification.");
  }
  if (entry.status === "SUBMITTED" || entry.status === "APPROVED") {
    throw new ServiceError("This sheet is locked.");
  }

  const observed = parseObserved(input.observed);
  if (!observed.categoryId || !observed.statusId) {
    throw new ServiceError("Category and status are required for unlisted assets.");
  }

  const category = await prisma.category.findFirst({
    where: {
      id: observed.categoryId,
      departmentId: entry.exercise.departmentId,
      deletedAt: null,
    },
  });
  if (!category) throw new ServiceError("Category not found.");

  const status = await prisma.status.findFirst({
    where: {
      id: observed.statusId,
      departmentId: entry.exercise.departmentId,
      deletedAt: null,
    },
  });
  if (!status) throw new ServiceError("Status not found.");

  if (observed.locationId) {
    const loc = await prisma.location.findFirst({
      where: {
        id: observed.locationId,
        branchId: entry.branchId,
        deletedAt: null,
      },
    });
    if (!loc) throw new ServiceError("Location does not belong to this branch.");
  }

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.reconciliationItem.create({
      data: {
        entryId: entry.id,
        assetId: null,
        result: "NEW_UNLISTED",
        observed: observed as Prisma.InputJsonValue,
        note: normaliseText(input.note),
        verifiedById: userId,
        verifiedAt: new Date(),
      },
    });
    if (entry.status === "NOT_STARTED") {
      await tx.reconciliationEntry.update({
        where: { id: entry.id },
        data: { status: "IN_PROGRESS" },
      });
    }
    return created;
  });

  return item;
}

export async function removeUnlistedItem(itemId: string, userId: string) {
  const item = await prisma.reconciliationItem.findUnique({
    where: { id: itemId },
    include: { entry: { include: { exercise: true } } },
  });
  if (!item || item.entry.exercise.deletedAt) {
    throw new ServiceError("Item not found.");
  }
  if (item.result !== "NEW_UNLISTED") {
    throw new ServiceError("Only unlisted items can be removed this way.");
  }
  if (item.entry.status === "SUBMITTED" || item.entry.status === "APPROVED") {
    throw new ServiceError("This sheet is locked.");
  }

  await prisma.reconciliationItem.delete({ where: { id: itemId } });
  await writeAuditLog({
    userId,
    action: "RECON_UNLISTED_REMOVE",
    entityType: "ReconciliationItem",
    entityId: itemId,
  });
}

export async function submitEntry(
  entryId: string,
  userId: string,
  inventoryDate?: string | null,
): Promise<ReconciliationEntry> {
  const entry = await loadMutableEntry(entryId);
  if (entry.exercise.status !== "IN_PROGRESS") {
    throw new ServiceError("This exercise is not open.");
  }
  if (entry.status === "SUBMITTED" || entry.status === "APPROVED") {
    throw new ServiceError("This sheet is already submitted.");
  }

  const pending = await prisma.reconciliationItem.count({
    where: {
      entryId,
      assetId: { not: null },
      result: null,
    },
  });
  if (pending > 0) {
    throw new ServiceError(
      `${pending} expected asset(s) still need a result before you can submit.`,
    );
  }

  const updated = await prisma.reconciliationEntry.update({
    where: { id: entryId },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      preparedById: userId,
      inventoryDate: inventoryDate ? parseDate(inventoryDate) : new Date(),
      comment: null,
    },
  });

  await writeAuditLog({
    userId,
    action: "RECON_ENTRY_SUBMIT",
    entityType: "ReconciliationEntry",
    entityId: entryId,
  });

  return updated;
}

export async function rejectEntry(
  entryId: string,
  comment: string,
  userId: string,
): Promise<ReconciliationEntry> {
  const entry = await loadMutableEntry(entryId);
  if (entry.status !== "SUBMITTED") {
    throw new ServiceError("Only a submitted sheet can be rejected.");
  }

  const updated = await prisma.reconciliationEntry.update({
    where: { id: entryId },
    data: {
      status: "IN_PROGRESS",
      comment: comment.trim(),
      submittedAt: null,
      approvedById: null,
    },
  });

  await writeAuditLog({
    userId,
    action: "RECON_ENTRY_REJECT",
    entityType: "ReconciliationEntry",
    entityId: entryId,
    after: { comment: comment.trim() },
  });

  return updated;
}

export type DiffPreviewItem = {
  itemId: string;
  result: ReconciliationResult;
  assetId: string | null;
  assetTag: string | null;
  categoryName: string | null;
  note: string | null;
  fields: { field: string; label: string; before: string | null; after: string | null }[];
  summary: string;
};

export type EntryDiffPreview = {
  entryId: string;
  branchName: string;
  exerciseName: string;
  counts: {
    found: number;
    different: number;
    missing: number;
    unlisted: number;
    unchanged: number;
  };
  items: DiffPreviewItem[];
  applyItemIds: string[];
};

export async function previewEntryDiff(
  entryId: string,
): Promise<EntryDiffPreview> {
  const entry = await prisma.reconciliationEntry.findUnique({
    where: { id: entryId },
    include: {
      branch: true,
      exercise: true,
      items: {
        where: {
          result: { in: ["FOUND_DIFFERENT", "MISSING", "NEW_UNLISTED"] },
        },
        include: {
          asset: {
            include: {
              category: true,
              status: true,
              location: true,
            },
          },
        },
      },
    },
  });
  if (!entry || entry.exercise.deletedAt) {
    throw new ServiceError("Branch sheet not found.");
  }

  const [statuses, locations, categories, foundCount] = await Promise.all([
    prisma.status.findMany({
      where: { departmentId: entry.exercise.departmentId, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.location.findMany({
      where: { branchId: entry.branchId, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.category.findMany({
      where: { departmentId: entry.exercise.departmentId, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.reconciliationItem.count({
      where: { entryId, result: "FOUND" },
    }),
  ]);

  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s.name]));
  const locationMap = Object.fromEntries(locations.map((l) => [l.id, l.name]));
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const items: DiffPreviewItem[] = [];
  const applyItemIds: string[] = [];

  for (const item of entry.items) {
    if (!item.result) continue;
    applyItemIds.push(item.id);
    const observed = parseObserved(item.observed);

    if (item.result === "MISSING" && item.asset) {
      items.push({
        itemId: item.id,
        result: item.result,
        assetId: item.assetId,
        assetTag: item.asset.assetTag,
        categoryName: item.asset.category.name,
        note: item.note,
        fields: [
          {
            field: "statusId",
            label: "Status",
            before: item.asset.status.name,
            after: "Lost",
          },
        ],
        summary: `Mark missing → Lost`,
      });
      continue;
    }

    if (item.result === "NEW_UNLISTED") {
      items.push({
        itemId: item.id,
        result: item.result,
        assetId: null,
        assetTag: observed.assetTag ?? null,
        categoryName: observed.categoryId
          ? (categoryMap[observed.categoryId] ?? null)
          : null,
        note: item.note,
        fields: Object.entries(observed)
          .filter(([, v]) => v != null && v !== "")
          .map(([field, after]) => ({
            field,
            label: field,
            before: null,
            after:
              field === "statusId"
                ? (statusMap[String(after)] ?? String(after))
                : field === "categoryId"
                  ? (categoryMap[String(after)] ?? String(after))
                  : field === "locationId"
                    ? (locationMap[String(after)] ?? String(after))
                    : String(after),
          })),
        summary: "Create new asset",
      });
      continue;
    }

    if (item.result === "FOUND_DIFFERENT" && item.asset) {
      const snap = toSnapshot(item.asset);
      const changes = diffObserved(snap, observed);
      items.push({
        itemId: item.id,
        result: item.result,
        assetId: item.assetId,
        assetTag: item.asset.assetTag,
        categoryName: item.asset.category.name,
        note: item.note,
        fields: formatDiffFields(snap, changes, {
          status: statusMap,
          location: locationMap,
          category: categoryMap,
        }),
        summary: "Update register from observed values",
      });
    }
  }

  return {
    entryId,
    branchName: entry.branch.name,
    exerciseName: entry.exercise.name,
    counts: {
      found: foundCount,
      different: items.filter((i) => i.result === "FOUND_DIFFERENT").length,
      missing: items.filter((i) => i.result === "MISSING").length,
      unlisted: items.filter((i) => i.result === "NEW_UNLISTED").length,
      unchanged: foundCount,
    },
    items,
    applyItemIds,
  };
}

async function findLostStatus(departmentId: string) {
  const status = await prisma.status.findFirst({
    where: {
      departmentId,
      deletedAt: null,
      name: { equals: "Lost", mode: "insensitive" },
    },
  });
  if (!status) {
    throw new ServiceError(
      'No "Lost" status found for this department. Add one in Admin before approving missing assets.',
    );
  }
  return status;
}

async function applyOneItem(
  item: ReconciliationItem & {
    asset: {
      id: string;
      departmentId: string;
      categoryId: string;
      branchId: string;
      locationId: string | null;
      assetTag: string | null;
      serialNumber: string | null;
      brand: string | null;
      model: string | null;
      statusId: string;
      assignedToText: string | null;
      remarks: string | null;
    } | null;
  },
  entry: {
    branchId: string;
    exercise: { departmentId: string };
  },
  userId: string,
  lostStatusId: string,
) {
  if (!item.result) return;

  if (item.result === "FOUND") {
    // Already wrote VERIFIED on verify; nothing else
    return;
  }

  if (item.result === "MISSING" && item.assetId) {
    await changeAssetStatus({
      assetId: item.assetId,
      statusId: lostStatusId,
      note: item.note ?? "Marked missing during reconciliation",
      userId,
    });
    return;
  }

  if (item.result === "NEW_UNLISTED") {
    const observed = parseObserved(item.observed);
    if (!observed.categoryId || !observed.statusId) {
      throw new ServiceError("Unlisted item is missing category or status.");
    }
    const asset = await createAsset(
      {
        departmentId: entry.exercise.departmentId,
        categoryId: observed.categoryId,
        branchId: entry.branchId,
        locationId: observed.locationId ?? null,
        assetTag: observed.assetTag ?? null,
        serialNumber: observed.serialNumber ?? null,
        brand: observed.brand ?? null,
        model: observed.model ?? null,
        statusId: observed.statusId,
        assignedToText: observed.assignedToText ?? null,
        remarks: observed.remarks ?? null,
        customFields: {},
        acknowledgeDuplicates: true,
      },
      userId,
    );
    await prisma.reconciliationItem.update({
      where: { id: item.id },
      data: { assetId: asset.id },
    });
    return;
  }

  if (item.result === "FOUND_DIFFERENT" && item.asset) {
    const observed = parseObserved(item.observed);
    const snap = toSnapshot(item.asset);
    const changes = diffObserved(snap, observed);

    if (changes.statusId) {
      await changeAssetStatus({
        assetId: item.asset.id,
        statusId: changes.statusId,
        note: item.note ?? "Updated during reconciliation",
        userId,
      });
    }

    if (changes.locationId !== undefined) {
      await transferAsset({
        assetId: item.asset.id,
        branchId: entry.branchId,
        locationId: changes.locationId,
        note: item.note ?? "Location updated during reconciliation",
        userId,
      });
    }

    if (changes.assignedToText !== undefined) {
      await assignAsset({
        assetId: item.asset.id,
        assignedToText: changes.assignedToText,
        note: item.note ?? "Reassigned during reconciliation",
        userId,
      });
    }

    const fieldPatch: Prisma.AssetUncheckedUpdateInput = {
      updatedById: userId,
    };
    if (changes.serialNumber !== undefined) {
      fieldPatch.serialNumber = changes.serialNumber;
    }
    if (changes.brand !== undefined) fieldPatch.brand = changes.brand;
    if (changes.model !== undefined) fieldPatch.model = changes.model;
    if (changes.remarks !== undefined) fieldPatch.remarks = changes.remarks;
    if (changes.assetTag !== undefined) fieldPatch.assetTag = changes.assetTag;
    if (changes.categoryId !== undefined) {
      fieldPatch.categoryId = changes.categoryId;
    }

    const hasFieldChanges =
      changes.serialNumber !== undefined ||
      changes.brand !== undefined ||
      changes.model !== undefined ||
      changes.remarks !== undefined ||
      changes.assetTag !== undefined ||
      changes.categoryId !== undefined;

    if (hasFieldChanges) {
      await prisma.$transaction(async (tx) => {
        await tx.asset.update({
          where: { id: item.asset!.id },
          data: fieldPatch,
        });
        await tx.assetEvent.create({
          data: {
            assetId: item.asset!.id,
            type: "UPDATED",
            fromValue: {
              serialNumber: item.asset!.serialNumber,
              brand: item.asset!.brand,
              model: item.asset!.model,
              remarks: item.asset!.remarks,
              assetTag: item.asset!.assetTag,
              categoryId: item.asset!.categoryId,
            },
            toValue: changes,
            note: item.note ?? "Fields updated during reconciliation",
            userId,
          },
        });
      });
    }
  }
}

export async function applyEntryChunk(input: {
  entryId: string;
  itemIds?: string[];
  finalize?: boolean;
  userId: string;
}): Promise<{
  processed: number;
  remaining: number;
  approved: boolean;
  nextItemIds: string[];
}> {
  const entry = await loadMutableEntry(input.entryId);
  if (entry.status === "APPROVED") {
    return { processed: 0, remaining: 0, approved: true, nextItemIds: [] };
  }
  if (entry.status !== "SUBMITTED") {
    throw new ServiceError("Sheet must be submitted before applying changes.");
  }

  const lost = await findLostStatus(entry.exercise.departmentId);

  const candidates = await prisma.reconciliationItem.findMany({
    where: {
      entryId: input.entryId,
      result: { in: ["FOUND_DIFFERENT", "MISSING", "NEW_UNLISTED"] },
      ...(input.itemIds?.length ? { id: { in: input.itemIds } } : {}),
    },
    include: {
      asset: {
        select: {
          id: true,
          departmentId: true,
          categoryId: true,
          branchId: true,
          locationId: true,
          assetTag: true,
          serialNumber: true,
          brand: true,
          model: true,
          statusId: true,
          assignedToText: true,
          remarks: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const toProcess = candidates
    .filter((item) => {
      const obs = item.observed as { __applied?: boolean } | null;
      return !obs?.__applied;
    })
    .slice(0, RECON_APPLY_CHUNK_SIZE);

  let processed = 0;
  for (const item of toProcess) {
    await applyOneItem(item, entry, input.userId, lost.id);
    const obs = {
      ...parseObserved(item.observed),
      __applied: true,
    };
    await prisma.reconciliationItem.update({
      where: { id: item.id },
      data: { observed: obs as Prisma.InputJsonValue },
    });
    processed++;
  }

  const remainingItems = await prisma.reconciliationItem.findMany({
    where: {
      entryId: input.entryId,
      result: { in: ["FOUND_DIFFERENT", "MISSING", "NEW_UNLISTED"] },
    },
    select: { id: true, observed: true },
    orderBy: { createdAt: "asc" },
  });
  const remaining = remainingItems.filter((i) => {
    const obs = i.observed as { __applied?: boolean } | null;
    return !obs?.__applied;
  });

  let approved = false;
  if (remaining.length === 0) {
    await prisma.reconciliationEntry.update({
      where: { id: input.entryId },
      data: {
        status: "APPROVED",
        approvedById: input.userId,
      },
    });
    approved = true;
    await writeAuditLog({
      userId: input.userId,
      action: "RECON_ENTRY_APPROVE",
      entityType: "ReconciliationEntry",
      entityId: input.entryId,
    });
  }

  return {
    processed,
    remaining: remaining.length,
    approved,
    nextItemIds: remaining.slice(0, RECON_APPLY_CHUNK_SIZE).map((i) => i.id),
  };
}

export async function markAssetVerifiedToday(
  assetId: string,
  userId: string,
  note?: string | null,
) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, deletedAt: null },
  });
  if (!asset) throw new ServiceError("Asset not found.");

  await prisma.assetEvent.create({
    data: {
      assetId,
      type: "VERIFIED",
      toValue: { verifiedAt: new Date().toISOString() },
      note: normaliseText(note) ?? "Marked verified today",
      userId,
    },
  });

  await writeAuditLog({
    userId,
    action: "ASSET_VERIFIED",
    entityType: "Asset",
    entityId: assetId,
  });
}
