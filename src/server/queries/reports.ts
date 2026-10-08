import type { Prisma } from "@prisma/client";

import type { AuthUser } from "@/lib/authorize";
import { scopedBranchIds, scopedDepartmentIds } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { getSelectedDepartmentId } from "@/server/queries/org";

export const REPORT_SLUGS = [
  "register-by-branch",
  "needs-attention",
  "by-assignee",
  "missing",
  "warranty",
  "data-quality",
  "without-tag",
  "without-serial",
  "reconciliation",
] as const;

export type ReportSlug = (typeof REPORT_SLUGS)[number];

export const REPORT_META: Record<
  ReportSlug,
  { title: string; description: string }
> = {
  "register-by-branch": {
    title: "Register by branch",
    description: "Full asset register grouped by branch.",
  },
  "needs-attention": {
    title: "Needs attention",
    description: "Faulty and in-repair assets that need follow-up.",
  },
  "by-assignee": {
    title: "Assets by assignee",
    description: "Everything assigned to each person or unit.",
  },
  missing: {
    title: "Missing / unaccounted",
    description:
      "Assets marked missing in the latest reconciliation exercise.",
  },
  warranty: {
    title: "Warranty expiring",
    description: "Assets with warranty ending in the next 90 days.",
  },
  "data-quality": {
    title: "Data quality",
    description: "Assets flagged for review (duplicates, placeholders, gaps).",
  },
  "without-tag": {
    title: "Without asset tag",
    description: "Assets that have no tag or label.",
  },
  "without-serial": {
    title: "Without serial number",
    description: "Assets that have no serial number recorded.",
  },
  reconciliation: {
    title: "Reconciliation summary",
    description: "Found / missing / new counts per branch for an exercise.",
  },
};

export function isReportSlug(value: string): value is ReportSlug {
  return (REPORT_SLUGS as readonly string[]).includes(value);
}

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

const assetSelect = {
  id: true,
  assetTag: true,
  serialNumber: true,
  brand: true,
  model: true,
  assignedToText: true,
  condition: true,
  remarks: true,
  needsReview: true,
  reviewReasons: true,
  warrantyExpiry: true,
  updatedAt: true,
  customFields: true,
  category: { select: { name: true } },
  branch: { select: { id: true, name: true, code: true, sortOrder: true } },
  location: { select: { name: true } },
  status: { select: { name: true, color: true, kind: true } },
} satisfies Prisma.AssetSelect;

export type ReportAssetRow = Prisma.AssetGetPayload<{
  select: typeof assetSelect;
}>;

async function scope(user: AuthUser) {
  const cookieDept = await getSelectedDepartmentId();
  const deptScope = resolveDeptScope(user, cookieDept);
  const branchScope = scopedBranchIds(user, null);
  return { cookieDept, deptScope, branchScope, where: baseWhere(deptScope, branchScope) };
}

export async function getReportAssets(
  user: AuthUser,
  slug: Exclude<ReportSlug, "reconciliation">,
  options?: { page?: number; pageSize?: number },
) {
  const { where, deptScope } = await scope(user);
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(500, Math.max(25, options?.pageSize ?? 200));

  let filter: Prisma.AssetWhereInput = { ...where };

  const now = new Date();
  const in90 = new Date(now);
  in90.setDate(in90.getDate() + 90);

  switch (slug) {
    case "needs-attention":
      filter = { ...where, status: { kind: "NEEDS_ATTENTION" } };
      break;
    case "warranty":
      filter = {
        ...where,
        warrantyExpiry: { gte: now, lte: in90 },
      };
      break;
    case "data-quality":
      filter = { ...where, needsReview: true };
      break;
    case "without-tag":
      filter = {
        ...where,
        OR: [{ assetTag: null }, { assetTag: "" }],
      };
      break;
    case "without-serial":
      filter = {
        ...where,
        OR: [{ serialNumber: null }, { serialNumber: "" }],
      };
      break;
    case "missing": {
      const latest = await prisma.reconciliationExercise.findFirst({
        where: {
          deletedAt: null,
          ...(deptScope ? { departmentId: { in: deptScope } } : {}),
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true },
      });
      if (!latest) {
        return {
          rows: [] as ReportAssetRow[],
          total: 0,
          page,
          pageSize,
          pageCount: 1,
          meta: { exerciseName: null as string | null },
        };
      }
      const missingItems = await prisma.reconciliationItem.findMany({
        where: {
          result: "MISSING",
          assetId: { not: null },
          entry: { exerciseId: latest.id },
        },
        select: { assetId: true },
        take: 2000,
      });
      const ids = missingItems
        .map((i) => i.assetId)
        .filter((id): id is string => Boolean(id));
      filter = { ...where, id: { in: ids.length ? ids : ["__none__"] } };
      const [total, rows] = await Promise.all([
        prisma.asset.count({ where: filter }),
        prisma.asset.findMany({
          where: filter,
          select: assetSelect,
          orderBy: [{ branch: { sortOrder: "asc" } }, { assetTag: "asc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);
      return {
        rows,
        total,
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
        meta: { exerciseName: latest.name },
      };
    }
    case "register-by-branch":
    case "by-assignee":
    default:
      break;
  }

  const orderBy: Prisma.AssetOrderByWithRelationInput[] =
    slug === "by-assignee"
      ? [{ assignedToText: "asc" }, { assetTag: "asc" }]
      : [{ branch: { sortOrder: "asc" } }, { category: { name: "asc" } }, { assetTag: "asc" }];

  const [total, rows] = await Promise.all([
    prisma.asset.count({ where: filter }),
    prisma.asset.findMany({
      where: filter,
      select: assetSelect,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    meta: { exerciseName: null as string | null },
  };
}

export async function getReconciliationReport(
  user: AuthUser,
  exerciseId?: string,
) {
  const { deptScope, branchScope } = await scope(user);

  const exercises = await prisma.reconciliationExercise.findMany({
    where: {
      deletedAt: null,
      ...(deptScope ? { departmentId: { in: deptScope } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true, startDate: true },
    take: 20,
  });

  const selectedId = exerciseId ?? exercises[0]?.id;
  if (!selectedId) {
    return { exercises, selected: null, rows: [] as never[] };
  }

  const exercise = await prisma.reconciliationExercise.findFirst({
    where: {
      id: selectedId,
      deletedAt: null,
      ...(deptScope ? { departmentId: { in: deptScope } } : {}),
    },
    include: {
      entries: {
        include: {
          branch: { select: { id: true, name: true, code: true } },
          items: { select: { result: true } },
        },
        orderBy: { branch: { name: "asc" } },
      },
    },
  });

  if (!exercise) {
    return { exercises, selected: null, rows: [] as never[] };
  }

  const entries = branchScope
    ? exercise.entries.filter((e) => branchScope.includes(e.branchId))
    : exercise.entries;

  const rows = entries.map((e) => {
    const total = e.items.length;
    const found = e.items.filter(
      (i) => i.result === "FOUND" || i.result === "FOUND_DIFFERENT",
    ).length;
    const missing = e.items.filter((i) => i.result === "MISSING").length;
    const unlisted = e.items.filter((i) => i.result === "NEW_UNLISTED").length;
    const pending = e.items.filter((i) => i.result == null).length;
    const verified = total - pending;
    return {
      entryId: e.id,
      branchName: e.branch.name,
      branchCode: e.branch.code,
      status: e.status,
      total,
      found,
      missing,
      unlisted,
      pending,
      completionPct: total === 0 ? 0 : Math.round((verified / total) * 100),
    };
  });

  return {
    exercises,
    selected: {
      id: exercise.id,
      name: exercise.name,
      status: exercise.status,
      startDate: exercise.startDate,
    },
    rows,
  };
}

/** URL filter hints for deep-linking to Assets from simple reports */
export function reportAssetFilters(
  slug: ReportSlug,
): Record<string, string> | null {
  switch (slug) {
    case "data-quality":
      return { needsReview: "1" };
    case "without-tag":
      return { hasTag: "0" };
    case "without-serial":
      return { hasSerial: "0" };
    default:
      return null;
  }
}
