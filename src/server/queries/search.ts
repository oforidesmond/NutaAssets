import type { AuthUser } from "@/lib/authorize";
import { scopedBranchIds, scopedDepartmentIds } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { getSelectedDepartmentId } from "@/server/queries/org";

export async function searchAssetsQuick(user: AuthUser, q: string, take = 10) {
  const term = q.trim();
  if (!term || term.length < 2) return [];

  const cookieDept = await getSelectedDepartmentId();
  const deptScope = scopedDepartmentIds(
    user,
    cookieDept === "all" ? null : cookieDept,
  );
  const branchScope = scopedBranchIds(user, null);

  return prisma.asset.findMany({
    where: {
      deletedAt: null,
      ...(deptScope ? { departmentId: { in: deptScope } } : {}),
      ...(branchScope ? { branchId: { in: branchScope } } : {}),
      OR: [
        { assetTag: { contains: term, mode: "insensitive" } },
        { serialNumber: { contains: term, mode: "insensitive" } },
        { brand: { contains: term, mode: "insensitive" } },
        { model: { contains: term, mode: "insensitive" } },
        { assignedToText: { contains: term, mode: "insensitive" } },
      ],
    },
    take,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      assetTag: true,
      serialNumber: true,
      brand: true,
      model: true,
      category: { select: { name: true } },
      branch: { select: { name: true } },
      status: { select: { name: true, color: true } },
    },
  });
}
