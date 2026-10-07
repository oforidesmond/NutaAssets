import type { AuthUser } from "@/lib/authorize";
import {
  assertDepartmentAccess,
  scopedDepartmentIds,
} from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { getSelectedDepartmentId } from "@/server/queries/org";

export async function resolveAdminDepartmentId(user: AuthUser) {
  const cookieDept = await getSelectedDepartmentId();
  const scoped = scopedDepartmentIds(user, cookieDept);
  if (scoped === null) {
    // Super admin without cookie — pick first active dept
    const first = await prisma.department.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    return first?.id ?? null;
  }
  return scoped[0] ?? null;
}

export async function listBranchesWithLocations() {
  return prisma.branch.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      locations: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
      },
      _count: {
        select: {
          assets: { where: { deletedAt: null } },
        },
      },
    },
  });
}

export async function listCategoriesForDepartment(
  user: AuthUser,
  departmentId: string,
) {
  assertDepartmentAccess(user, departmentId);
  return prisma.category.findMany({
    where: { departmentId, deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      parent: { select: { id: true, name: true } },
      _count: {
        select: { assets: { where: { deletedAt: null } } },
      },
    },
  });
}

export async function listStatusesForDepartment(
  user: AuthUser,
  departmentId: string,
) {
  assertDepartmentAccess(user, departmentId);
  return prisma.status.findMany({
    where: { departmentId, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: { assets: { where: { deletedAt: null } } },
      },
    },
  });
}

export async function listDeletedAssets(
  user: AuthUser,
  departmentId: string | null,
) {
  const scoped = scopedDepartmentIds(user, departmentId);
  return prisma.asset.findMany({
    where: {
      deletedAt: { not: null },
      ...(scoped ? { departmentId: { in: scoped } } : {}),
    },
    orderBy: { deletedAt: "desc" },
    take: 200,
    include: {
      category: { select: { name: true } },
      branch: { select: { name: true } },
      status: { select: { name: true, color: true } },
    },
  });
}
