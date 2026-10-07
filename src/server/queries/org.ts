import { cookies } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  DEPARTMENT_COOKIE,
  parseDepartmentCookie,
} from "@/lib/department-cookie";

export async function getOrgName() {
  const setting = await prisma.setting.findUnique({ where: { key: "org" } });
  const value = setting?.value as { name?: string } | null;
  return value?.name ?? "AssetTrack";
}

export async function getAccessibleDepartments() {
  const session = await auth();
  if (!session?.user) return [];

  if (session.user.role === "SUPER_ADMIN") {
    return prisma.department.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    });
  }

  if (session.user.departmentIds.length === 0) return [];

  return prisma.department.findMany({
    where: {
      id: { in: session.user.departmentIds },
      isActive: true,
      deletedAt: null,
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
}

export async function getSelectedDepartmentId() {
  const store = await cookies();
  return parseDepartmentCookie(store.get(DEPARTMENT_COOKIE)?.value);
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}
