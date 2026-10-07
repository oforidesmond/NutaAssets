import { hash } from "bcryptjs";
import type { Role } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { UserCreateInput, UserUpdateInput } from "@/schemas/admin";
import { ServiceError } from "@/server/services/admin-org";

async function countActiveSuperAdmins(excludeUserId?: string) {
  return prisma.user.count({
    where: {
      role: "SUPER_ADMIN",
      isActive: true,
      deletedAt: null,
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
  });
}

export async function listUsersAdmin() {
  return prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      lockedUntil: true,
      createdAt: true,
      departments: {
        select: { departmentId: true, department: { select: { name: true } } },
      },
      branches: {
        select: { branchId: true, branch: { select: { name: true } } },
      },
    },
  });
}

export async function createUser(input: UserCreateInput, actorId: string) {
  const passwordHash = await hash(input.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        role: input.role,
        isActive: input.isActive,
        mustChangePassword: true,
      },
    });

    if (input.departmentIds.length > 0) {
      await tx.userDepartment.createMany({
        data: input.departmentIds.map((departmentId) => ({
          userId: created.id,
          departmentId,
        })),
      });
    }
    if (input.branchIds.length > 0) {
      await tx.userBranch.createMany({
        data: input.branchIds.map((branchId) => ({
          userId: created.id,
          branchId,
        })),
      });
    }

    return created;
  });

  await writeAuditLog({
    userId: actorId,
    action: "USER_CREATE",
    entityType: "User",
    entityId: user.id,
    after: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentIds: input.departmentIds,
      branchIds: input.branchIds,
    },
  });

  return user;
}

export async function updateUser(
  id: string,
  input: UserUpdateInput,
  actorId: string,
) {
  const before = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: { departments: true, branches: true },
  });
  if (!before) throw new ServiceError("User not found.");

  const demotingOrDeactivatingSa =
    before.role === "SUPER_ADMIN" &&
    (input.role !== "SUPER_ADMIN" || !input.isActive);

  if (demotingOrDeactivatingSa) {
    const others = await countActiveSuperAdmins(id);
    if (others === 0) {
      throw new ServiceError(
        "Cannot remove or deactivate the last Super Admin.",
      );
    }
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        role: input.role as Role,
        isActive: input.isActive,
      },
    });

    await tx.userDepartment.deleteMany({ where: { userId: id } });
    if (input.departmentIds.length > 0) {
      await tx.userDepartment.createMany({
        data: input.departmentIds.map((departmentId) => ({
          userId: id,
          departmentId,
        })),
      });
    }

    await tx.userBranch.deleteMany({ where: { userId: id } });
    if (input.branchIds.length > 0) {
      await tx.userBranch.createMany({
        data: input.branchIds.map((branchId) => ({
          userId: id,
          branchId,
        })),
      });
    }

    return updated;
  });

  await writeAuditLog({
    userId: actorId,
    action: "USER_UPDATE",
    entityType: "User",
    entityId: id,
    before: {
      name: before.name,
      email: before.email,
      role: before.role,
      isActive: before.isActive,
      departmentIds: before.departments.map((d) => d.departmentId),
      branchIds: before.branches.map((b) => b.branchId),
    },
    after: {
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      departmentIds: input.departmentIds,
      branchIds: input.branchIds,
    },
  });

  return user;
}

export async function resetUserPassword(
  id: string,
  password: string,
  actorId: string,
) {
  const before = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
  if (!before) throw new ServiceError("User not found.");

  const passwordHash = await hash(password, 12);
  const user = await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      mustChangePassword: true,
      failedLogins: 0,
      lockedUntil: null,
    },
  });

  await writeAuditLog({
    userId: actorId,
    action: "USER_RESET_PASSWORD",
    entityType: "User",
    entityId: id,
    after: { mustChangePassword: true },
  });

  return user;
}
