import type { AuthUser } from "@/lib/authorize";
import { prisma } from "@/lib/db";

export async function listSavedViews(
  user: AuthUser,
  departmentId?: string | null,
) {
  return prisma.savedView.findMany({
    where: {
      userId: user.id,
      OR: [{ departmentId: null }, ...(departmentId ? [{ departmentId }] : [])],
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function getSavedView(user: AuthUser, id: string) {
  return prisma.savedView.findFirst({
    where: { id, userId: user.id },
  });
}
