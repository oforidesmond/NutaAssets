import type { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type {
  BranchInput,
  CategoryInput,
  LocationInput,
  StatusInput,
} from "@/schemas/admin";

export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceError";
  }
}

export async function createBranch(input: BranchInput, userId: string) {
  const branch = await prisma.branch.create({
    data: {
      name: input.name,
      code: input.code,
      type: input.type,
      address: input.address || null,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });
  await writeAuditLog({
    userId,
    action: "BRANCH_CREATE",
    entityType: "Branch",
    entityId: branch.id,
    after: branch,
  });
  return branch;
}

export async function updateBranch(
  id: string,
  input: BranchInput,
  userId: string,
) {
  const before = await prisma.branch.findFirst({
    where: { id, deletedAt: null },
  });
  if (!before) throw new ServiceError("Branch not found.");

  const branch = await prisma.branch.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code,
      type: input.type,
      address: input.address || null,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });
  await writeAuditLog({
    userId,
    action: "BRANCH_UPDATE",
    entityType: "Branch",
    entityId: id,
    before,
    after: branch,
  });
  return branch;
}

export async function softDeleteBranch(id: string, userId: string) {
  const before = await prisma.branch.findFirst({
    where: { id, deletedAt: null },
    include: { _count: { select: { assets: true, locations: true } } },
  });
  if (!before) throw new ServiceError("Branch not found.");
  const activeAssets = await prisma.asset.count({
    where: { branchId: id, deletedAt: null },
  });
  if (activeAssets > 0) {
    throw new ServiceError(
      `Cannot delete this branch — ${activeAssets} asset(s) still use it. Reassign them first.`,
    );
  }

  const branch = await prisma.branch.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  await writeAuditLog({
    userId,
    action: "BRANCH_DELETE",
    entityType: "Branch",
    entityId: id,
    before,
    after: branch,
  });
  return branch;
}

export async function createLocation(input: LocationInput, userId: string) {
  const location = await prisma.location.create({
    data: {
      branchId: input.branchId,
      name: input.name,
    },
  });
  await writeAuditLog({
    userId,
    action: "LOCATION_CREATE",
    entityType: "Location",
    entityId: location.id,
    after: location,
  });
  return location;
}

export async function updateLocation(
  id: string,
  name: string,
  userId: string,
) {
  const before = await prisma.location.findFirst({
    where: { id, deletedAt: null },
  });
  if (!before) throw new ServiceError("Location not found.");

  const location = await prisma.location.update({
    where: { id },
    data: { name },
  });
  await writeAuditLog({
    userId,
    action: "LOCATION_UPDATE",
    entityType: "Location",
    entityId: id,
    before,
    after: location,
  });
  return location;
}

export async function softDeleteLocation(id: string, userId: string) {
  const before = await prisma.location.findFirst({
    where: { id, deletedAt: null },
  });
  if (!before) throw new ServiceError("Location not found.");
  const activeAssets = await prisma.asset.count({
    where: { locationId: id, deletedAt: null },
  });
  if (activeAssets > 0) {
    throw new ServiceError(
      `Cannot delete this location — ${activeAssets} asset(s) still use it.`,
    );
  }

  const location = await prisma.location.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await writeAuditLog({
    userId,
    action: "LOCATION_DELETE",
    entityType: "Location",
    entityId: id,
    before,
    after: location,
  });
  return location;
}

export async function createCategory(input: CategoryInput, userId: string) {
  const category = await prisma.category.create({
    data: {
      departmentId: input.departmentId,
      name: input.name,
      code: input.code,
      icon: input.icon || null,
      parentId: input.parentId || null,
      isActive: input.isActive,
    },
  });
  await writeAuditLog({
    userId,
    action: "CATEGORY_CREATE",
    entityType: "Category",
    entityId: category.id,
    after: category,
  });
  return category;
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
  userId: string,
) {
  const before = await prisma.category.findFirst({
    where: { id, deletedAt: null },
  });
  if (!before) throw new ServiceError("Category not found.");

  const category = await prisma.category.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code,
      icon: input.icon || null,
      parentId: input.parentId || null,
      isActive: input.isActive,
    },
  });
  await writeAuditLog({
    userId,
    action: "CATEGORY_UPDATE",
    entityType: "Category",
    entityId: id,
    before,
    after: category,
  });
  return category;
}

export async function softDeleteCategory(id: string, userId: string) {
  const before = await prisma.category.findFirst({
    where: { id, deletedAt: null },
  });
  if (!before) throw new ServiceError("Category not found.");
  const activeAssets = await prisma.asset.count({
    where: { categoryId: id, deletedAt: null },
  });
  if (activeAssets > 0) {
    throw new ServiceError(
      `Cannot delete this category — ${activeAssets} asset(s) still use it.`,
    );
  }

  const category = await prisma.category.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  await writeAuditLog({
    userId,
    action: "CATEGORY_DELETE",
    entityType: "Category",
    entityId: id,
    before,
    after: category,
  });
  return category;
}

export async function createStatus(input: StatusInput, userId: string) {
  const status = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.status.updateMany({
        where: {
          departmentId: input.departmentId,
          deletedAt: null,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }
    return tx.status.create({
      data: {
        departmentId: input.departmentId,
        name: input.name,
        color: input.color,
        kind: input.kind,
        isDefault: input.isDefault,
        sortOrder: input.sortOrder,
      },
    });
  });
  await writeAuditLog({
    userId,
    action: "STATUS_CREATE",
    entityType: "Status",
    entityId: status.id,
    after: status,
  });
  return status;
}

export async function updateStatus(
  id: string,
  input: StatusInput,
  userId: string,
) {
  const before = await prisma.status.findFirst({
    where: { id, deletedAt: null },
  });
  if (!before) throw new ServiceError("Status not found.");

  const status = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.status.updateMany({
        where: {
          departmentId: input.departmentId,
          deletedAt: null,
          isDefault: true,
          NOT: { id },
        },
        data: { isDefault: false },
      });
    }
    return tx.status.update({
      where: { id },
      data: {
        name: input.name,
        color: input.color,
        kind: input.kind,
        isDefault: input.isDefault,
        sortOrder: input.sortOrder,
      },
    });
  });
  await writeAuditLog({
    userId,
    action: "STATUS_UPDATE",
    entityType: "Status",
    entityId: id,
    before,
    after: status,
  });
  return status;
}

export async function softDeleteStatus(id: string, userId: string) {
  const before = await prisma.status.findFirst({
    where: { id, deletedAt: null },
  });
  if (!before) throw new ServiceError("Status not found.");
  const activeAssets = await prisma.asset.count({
    where: { statusId: id, deletedAt: null },
  });
  if (activeAssets > 0) {
    throw new ServiceError(
      `Cannot delete this status — ${activeAssets} asset(s) still use it.`,
    );
  }

  const status = await prisma.status.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await writeAuditLog({
    userId,
    action: "STATUS_DELETE",
    entityType: "Status",
    entityId: id,
    before,
    after: status,
  });
  return status;
}

export type BranchWithLocations = Prisma.BranchGetPayload<{
  include: { locations: true; _count: { select: { assets: true } } };
}>;
