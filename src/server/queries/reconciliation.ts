import type { Prisma } from "@prisma/client";

import type { AuthUser } from "@/lib/authorize";
import {
  assertBranchAccess,
  scopedBranchIds,
  scopedDepartmentIds,
} from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { getSelectedDepartmentId } from "@/server/queries/org";

export async function listExercises(user: AuthUser) {
  const selected = await getSelectedDepartmentId();
  const deptScope = scopedDepartmentIds(
    user,
    selected === "all" ? null : selected,
  );

  return prisma.reconciliationExercise.findMany({
    where: {
      deletedAt: null,
      ...(deptScope ? { departmentId: { in: deptScope } } : {}),
    },
    include: {
      department: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true } },
      entries: {
        select: {
          id: true,
          status: true,
          branchId: true,
          branch: { select: { id: true, name: true, code: true } },
        },
      },
      _count: { select: { entries: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getExerciseDetail(user: AuthUser, exerciseId: string) {
  const exercise = await prisma.reconciliationExercise.findFirst({
    where: { id: exerciseId, deletedAt: null },
    include: {
      department: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true } },
      entries: {
        include: {
          branch: { select: { id: true, name: true, code: true } },
          preparedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          _count: { select: { items: true } },
          items: {
            select: { result: true },
          },
        },
        orderBy: { branch: { name: "asc" } },
      },
    },
  });
  if (!exercise) return null;

  scopedDepartmentIds(user, exercise.departmentId);

  const branchScope = scopedBranchIds(user, null);
  const entries = branchScope
    ? exercise.entries.filter((e) => branchScope.includes(e.branchId))
    : exercise.entries;

  const entriesWithCounts = entries.map((e) => {
    const results = e.items;
    const verified = results.filter((i) => i.result != null).length;
    return {
      id: e.id,
      branchId: e.branchId,
      branch: e.branch,
      status: e.status,
      inventoryDate: e.inventoryDate,
      submittedAt: e.submittedAt,
      comment: e.comment,
      preparedBy: e.preparedBy,
      approvedBy: e.approvedBy,
      totalItems: e._count.items,
      verifiedItems: verified,
      counts: {
        pending: results.filter((i) => i.result == null).length,
        found: results.filter((i) => i.result === "FOUND").length,
        different: results.filter((i) => i.result === "FOUND_DIFFERENT").length,
        missing: results.filter((i) => i.result === "MISSING").length,
        unlisted: results.filter((i) => i.result === "NEW_UNLISTED").length,
      },
    };
  });

  return {
    ...exercise,
    entries: entriesWithCounts,
  };
}

export type EntryItemFilter =
  | "all"
  | "pending"
  | "FOUND"
  | "FOUND_DIFFERENT"
  | "MISSING"
  | "NEW_UNLISTED";

export async function getEntrySheet(
  user: AuthUser,
  entryId: string,
  opts?: { q?: string; filter?: EntryItemFilter; page?: number; pageSize?: number },
) {
  const entry = await prisma.reconciliationEntry.findUnique({
    where: { id: entryId },
    include: {
      branch: true,
      exercise: {
        include: {
          department: { select: { id: true, name: true, code: true } },
        },
      },
      preparedBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });
  if (!entry || entry.exercise.deletedAt) return null;

  scopedDepartmentIds(user, entry.exercise.departmentId);
  assertBranchScope(user, entry.branchId);

  const page = Math.max(1, opts?.page ?? 1);
  // Branch sheets need the full expected list on a phone; cap matches export (2000).
  const pageSize = Math.min(2000, Math.max(10, opts?.pageSize ?? 100));
  const q = opts?.q?.trim();
  const filter = opts?.filter ?? "all";

  const where: Prisma.ReconciliationItemWhereInput = { entryId };

  if (filter === "pending") {
    where.result = null;
  } else if (filter !== "all") {
    where.result = filter;
  }

  if (q) {
    where.OR = [
      { asset: { assetTag: { contains: q, mode: "insensitive" } } },
      { asset: { serialNumber: { contains: q, mode: "insensitive" } } },
      { asset: { brand: { contains: q, mode: "insensitive" } } },
      { asset: { model: { contains: q, mode: "insensitive" } } },
      { asset: { assignedToText: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, items, allResults] = await Promise.all([
    prisma.reconciliationItem.count({ where }),
    prisma.reconciliationItem.findMany({
      where,
      include: {
        asset: {
          include: {
            category: { select: { id: true, name: true } },
            status: { select: { id: true, name: true, color: true } },
            location: { select: { id: true, name: true } },
          },
        },
        verifiedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ result: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.reconciliationItem.groupBy({
      by: ["result"],
      where: { entryId },
      _count: true,
    }),
  ]);

  const counts = {
    total: 0,
    pending: 0,
    found: 0,
    different: 0,
    missing: 0,
    unlisted: 0,
  };
  for (const g of allResults) {
    counts.total += g._count;
    if (g.result == null) counts.pending += g._count;
    else if (g.result === "FOUND") counts.found += g._count;
    else if (g.result === "FOUND_DIFFERENT") counts.different += g._count;
    else if (g.result === "MISSING") counts.missing += g._count;
    else if (g.result === "NEW_UNLISTED") counts.unlisted += g._count;
  }

  return {
    entry,
    items,
    total,
    page,
    pageSize,
    counts,
  };
}

function assertBranchScope(user: AuthUser, branchId: string) {
  assertBranchAccess(user, branchId);
}

export async function getAssetReconciliationHistory(
  user: AuthUser,
  assetId: string,
) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId },
    select: { id: true, departmentId: true, branchId: true },
  });
  if (!asset) return [];

  scopedDepartmentIds(user, asset.departmentId);

  return prisma.reconciliationItem.findMany({
    where: { assetId },
    include: {
      entry: {
        include: {
          branch: { select: { id: true, name: true, code: true } },
          exercise: {
            select: {
              id: true,
              name: true,
              status: true,
              startDate: true,
              departmentId: true,
            },
          },
        },
      },
      verifiedBy: { select: { id: true, name: true } },
    },
    orderBy: { verifiedAt: "desc" },
    take: 50,
  });
}

export async function getReconFormOptions(departmentId: string, branchId?: string) {
  const [categories, statuses, locations, branches] = await Promise.all([
    prisma.category.findMany({
      where: { departmentId, deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.status.findMany({
      where: { departmentId, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true },
    }),
    branchId
      ? prisma.location.findMany({
          where: { branchId, deletedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    prisma.branch.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    }),
  ]);

  return { categories, statuses, locations, branches };
}

export async function buildLegacyExportRows(entryId: string) {
  const entry = await prisma.reconciliationEntry.findUnique({
    where: { id: entryId },
    include: {
      branch: true,
      preparedBy: { select: { name: true } },
      exercise: { select: { name: true, departmentId: true } },
      items: {
        where: {
          result: { in: ["FOUND", "FOUND_DIFFERENT", "NEW_UNLISTED", "MISSING"] },
        },
        include: {
          asset: {
            include: {
              category: true,
              status: true,
              location: true,
              branch: true,
            },
          },
        },
      },
    },
  });
  if (!entry) return null;

  const [statuses, categories, locations] = await Promise.all([
    prisma.status.findMany({
      where: { departmentId: entry.exercise.departmentId, deletedAt: null },
    }),
    prisma.category.findMany({
      where: { departmentId: entry.exercise.departmentId, deletedAt: null },
    }),
    prisma.location.findMany({
      where: { branchId: entry.branchId, deletedAt: null },
    }),
  ]);
  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]));
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const locationMap = Object.fromEntries(locations.map((l) => [l.id, l]));

  const rows = entry.items
    .filter((i) => i.result !== "MISSING")
    .map((item) => {
      const obs = (item.observed ?? {}) as Record<string, string | null>;
      const asset = item.asset;
      const statusId = obs.statusId ?? asset?.statusId;
      const categoryId = obs.categoryId ?? asset?.categoryId;
      const locationId =
        obs.locationId !== undefined ? obs.locationId : asset?.locationId;

      return {
        assetTag: obs.assetTag ?? asset?.assetTag ?? null,
        serialNumber: obs.serialNumber ?? asset?.serialNumber ?? null,
        brand: obs.brand ?? asset?.brand ?? null,
        model: obs.model ?? asset?.model ?? null,
        assignedToText: obs.assignedToText ?? asset?.assignedToText ?? null,
        condition: asset?.condition ?? null,
        remarks: obs.remarks ?? asset?.remarks ?? item.note ?? null,
        needsReview: false,
        updatedAt: item.verifiedAt ?? item.updatedAt,
        category: {
          name:
            (categoryId && categoryMap[categoryId]?.name) ||
            asset?.category.name ||
            "",
        },
        branch: { name: entry.branch.name },
        location: locationId
          ? { name: locationMap[locationId]?.name ?? "" }
          : asset?.location
            ? { name: asset.location.name }
            : null,
        status: {
          name:
            (statusId && statusMap[statusId]?.name) ||
            asset?.status.name ||
            "",
          color: (statusId && statusMap[statusId]?.color) || asset?.status.color,
        },
      };
    });

  return {
    entry,
    rows,
    meta: {
      branchName: entry.branch.name,
      inventoryDate: entry.inventoryDate
        ? entry.inventoryDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      preparedBy: entry.preparedBy?.name ?? "—",
    },
  };
}
