import type { Prisma, StatusKind } from "@prisma/client";

import type { AuthUser } from "@/lib/authorize";
import { scopedBranchIds, scopedDepartmentIds } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { getSelectedDepartmentId } from "@/server/queries/org";

function resolveDeptScope(user: AuthUser, cookieDept: string) {
  return scopedDepartmentIds(user, cookieDept === "all" ? null : cookieDept);
}

function baseWhere(
  deptScope: string[] | null,
  branchScope: string[] | null,
): Prisma.AssetWhereInput {
  return {
    deletedAt: null,
    ...(deptScope ? { departmentId: { in: deptScope } } : {}),
    ...(branchScope ? { branchId: { in: branchScope } } : {}),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export async function getDashboardData(user: AuthUser) {
  const cookieDept = await getSelectedDepartmentId();
  const deptScope = resolveDeptScope(user, cookieDept);
  const branchScope = scopedBranchIds(user, null);
  const where = baseWhere(deptScope, branchScope);

  const now = new Date();
  const in90 = new Date(now);
  in90.setDate(in90.getDate() + 90);
  const yearAgo = new Date(now);
  yearAgo.setMonth(yearAgo.getMonth() - 11);
  yearAgo.setDate(1);
  yearAgo.setHours(0, 0, 0, 0);

  const [
    total,
    needsReview,
    missingTag,
    missingSerial,
    statuses,
    byBranchRaw,
    byCategoryRaw,
    byStatusBranchRaw,
    warrantyCount,
    recentAssets,
    needsAttentionAssets,
    addedOverTimeRaw,
    activeExercises,
  ] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.count({ where: { ...where, needsReview: true } }),
    prisma.asset.count({
      where: {
        ...where,
        OR: [{ assetTag: null }, { assetTag: "" }],
      },
    }),
    prisma.asset.count({
      where: {
        ...where,
        OR: [{ serialNumber: null }, { serialNumber: "" }],
      },
    }),
    prisma.status.findMany({
      where: {
        deletedAt: null,
        ...(deptScope ? { departmentId: { in: deptScope } } : {}),
      },
      select: { id: true, name: true, kind: true, color: true },
    }),
    prisma.asset.groupBy({
      by: ["branchId"],
      where,
      _count: { _all: true },
    }),
    prisma.asset.groupBy({
      by: ["categoryId"],
      where,
      _count: { _all: true },
    }),
    prisma.asset.groupBy({
      by: ["branchId", "statusId"],
      where,
      _count: { _all: true },
    }),
    prisma.asset.count({
      where: {
        ...where,
        warrantyExpiry: { gte: now, lte: in90 },
      },
    }),
    prisma.asset.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        assetTag: true,
        brand: true,
        model: true,
        updatedAt: true,
        status: { select: { name: true, color: true } },
        branch: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.asset.findMany({
      where: {
        ...where,
        status: { kind: "NEEDS_ATTENTION" },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        assetTag: true,
        brand: true,
        model: true,
        remarks: true,
        status: { select: { name: true, color: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.asset.findMany({
      where: { ...where, createdAt: { gte: yearAgo } },
      select: { createdAt: true },
    }),
    prisma.reconciliationExercise.findMany({
      where: {
        deletedAt: null,
        status: { in: ["DRAFT", "IN_PROGRESS"] },
        ...(deptScope ? { departmentId: { in: deptScope } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        entries: {
          select: {
            id: true,
            status: true,
            branch: { select: { id: true, name: true, code: true } },
          },
        },
      },
    }),
  ]);

  const statusById = new Map(statuses.map((s) => [s.id, s]));
  const kindCounts: Record<StatusKind, number> = {
    IN_USE: 0,
    NOT_IN_USE: 0,
    NEEDS_ATTENTION: 0,
    END_OF_LIFE: 0,
  };

  // Count by status kind via grouping on statusId
  const byStatusId = await prisma.asset.groupBy({
    by: ["statusId"],
    where,
    _count: { _all: true },
  });
  for (const row of byStatusId) {
    const kind = statusById.get(row.statusId)?.kind;
    if (kind) kindCounts[kind] += row._count._all;
  }

  const branchIds = [
    ...new Set([
      ...byBranchRaw.map((r) => r.branchId),
      ...byStatusBranchRaw.map((r) => r.branchId),
    ]),
  ];
  const categoryIds = byCategoryRaw.map((r) => r.categoryId);

  const [branches, categories] = await Promise.all([
    branchIds.length
      ? prisma.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, name: true, code: true, sortOrder: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    categoryIds.length
      ? prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const byBranch = byBranchRaw
    .map((r) => ({
      branchId: r.branchId,
      name: branchName.get(r.branchId) ?? "Unknown",
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  const byCategory = byCategoryRaw
    .map((r) => ({
      categoryId: r.categoryId,
      name: categoryName.get(r.categoryId) ?? "Unknown",
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  // Stacked: for each branch, counts per status name
  const statusNames = [...new Set(statuses.map((s) => s.name))];
  const stackedByBranch = branches.map((b) => {
    const row: Record<string, string | number> = {
      branch: b.name,
      branchId: b.id,
    };
    for (const name of statusNames) row[name] = 0;
    for (const g of byStatusBranchRaw) {
      if (g.branchId !== b.id) continue;
      const sn = statusById.get(g.statusId)?.name;
      if (sn) row[sn] = (row[sn] as number) + g._count._all;
    }
    return row;
  });

  const monthKeys: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(yearAgo);
    d.setMonth(yearAgo.getMonth() + i);
    monthKeys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  const monthCounts = Object.fromEntries(monthKeys.map((k) => [k, 0]));
  for (const a of addedOverTimeRaw) {
    const d = a.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in monthCounts) monthCounts[key] += 1;
  }
  const addedOverTime = monthKeys.map((key) => ({
    month: key,
    count: monthCounts[key] ?? 0,
  }));

  const reconProgress = activeExercises.map((ex) => ({
    id: ex.id,
    name: ex.name,
    status: ex.status,
    branches: ex.entries
      .filter((e) => !branchScope || branchScope.includes(e.branch.id))
      .map((e) => ({
        entryId: e.id,
        branchName: e.branch.name,
        status: e.status,
      })),
  }));

  return {
    kpis: {
      total,
      inUse: kindCounts.IN_USE,
      needsAttention: kindCounts.NEEDS_ATTENTION,
      endOfLife: kindCounts.END_OF_LIFE,
      needsReview,
      missingTag,
      missingSerial,
      warrantyExpiring: warrantyCount,
    },
    charts: {
      byBranch,
      byCategory,
      stackedByBranch,
      statusNames,
      statusColors: Object.fromEntries(statuses.map((s) => [s.name, s.color])),
      addedOverTime,
    },
    panels: {
      needsAttention: needsAttentionAssets,
      recentlyChanged: recentAssets,
      reconProgress,
    },
  };
}
